/**
 * Sistema de proveedores de IA con prioridad, fallback automático y logging de errores.
 * 
 * Orden de prioridad:
 *   1. Gemini Pro (API directa) — principal
 *   2. ChatGPT (via Lovable AI Gateway) — secundario
 *   3. IA nativa de Lovable (Gemini via Gateway) — terciario
 * 
 * Tipos de error detectados y logueados:
 *   - quota_exhausted (cuota agotada)
 *   - rate_limit (429 - límite de llamadas/segundo)
 *   - invalid_token (401/403 - token inválido)
 *   - network_error (error de red)
 *   - timeout (>timeout configurado)
 *   - server_error (500/503)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 120_000;

export interface AIProviderOptions {
  model?: string;
  stream?: boolean;
  temperature?: number;
  response_mime_type?: string;
  userId?: string; // Optional: for logging
}

type ErrorType = "quota_exhausted" | "rate_limit" | "invalid_token" | "network_error" | "timeout" | "server_error" | "unknown";

function classifyError(status: number | "timeout" | "error", responseBody?: string): ErrorType {
  if (status === "timeout") return "timeout";
  if (status === "error") return "network_error";
  if (status === 429) {
    // Check if it's quota exhausted vs rate limit
    const lower = (responseBody || "").toLowerCase();
    if (lower.includes("quota") || lower.includes("exhausted") || lower.includes("billing") || lower.includes("402")) {
      return "quota_exhausted";
    }
    return "rate_limit";
  }
  if (status === 401 || status === 403) return "invalid_token";
  if (status === 500 || status === 503) return "server_error";
  return "unknown";
}

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

async function logError(userId: string | undefined, proveedor: string, tipoError: ErrorType, detalles?: string) {
  console.warn(`📝 Log IA: [${proveedor}] ${tipoError}${detalles ? ` — ${detalles}` : ""}`);
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    await sb.from("logs_ia").insert({
      user_id: userId || "anonymous",
      proveedor,
      tipo_error: tipoError,
      detalles: detalles?.slice(0, 500) || null,
    });
  } catch (e) {
    console.error("Failed to log AI error:", e);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type TryResult = {
  ok: true;
  response: Response;
} | {
  ok: false;
  status: number | "timeout" | "error";
  body?: string;
};

async function tryProvider(
  name: string,
  url: string,
  headers: Record<string, string>,
  body: any,
): Promise<TryResult> {
  try {
    const resp = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      console.log(`✅ ${name}: respuesta exitosa`);
      return { ok: true, response: resp };
    }
    let responseBody = "";
    try { responseBody = await resp.text(); } catch { /* ignore */ }
    console.warn(`⚠️ ${name}: error HTTP ${resp.status}`);
    return { ok: false, status: resp.status, body: responseBody };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      console.error(`⏱️ ${name}: timeout (${REQUEST_TIMEOUT_MS / 1000}s)`);
      return { ok: false, status: "timeout" };
    }
    console.error(`❌ ${name}: error de red:`, e);
    return { ok: false, status: "error", body: e instanceof Error ? e.message : String(e) };
  }
}

async function tryWithRetry(
  name: string,
  url: string,
  headers: Record<string, string>,
  body: any,
  userId?: string,
): Promise<Response | null> {
  const result = await tryProvider(name, url, headers, body);
  if (result.ok) return result.response;

  const errorType = classifyError(result.status, result.body);
  await logError(userId, name, errorType, result.body);

  // On rate_limit, wait 2s and retry once
  if (errorType === "rate_limit") {
    console.log(`🔄 ${name} 429: esperando 2s para reintentar...`);
    await sleep(RETRY_DELAY_MS);
    const retry = await tryProvider(`${name} (retry)`, url, headers, body);
    if (retry.ok) return retry.response;
    const retryErrorType = classifyError(retry.status, retry.body);
    await logError(userId, `${name} (retry)`, retryErrorType, retry.body);
  }

  return null;
}

/**
 * Llama a la IA con sistema de fallback triple y logging de errores.
 */
export async function callAIWithFallback(
  messages: any[],
  options: AIProviderOptions = {},
): Promise<Response | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const userId = options.userId;

  const geminiModel = options.model || "gemini-2.5-pro";
  const baseBody: any = { model: geminiModel, messages };
  if (options.stream) baseBody.stream = true;
  if (options.temperature !== undefined) baseBody.temperature = options.temperature;
  if (options.response_mime_type) baseBody.response_mime_type = options.response_mime_type;

  // ── 1. Gemini Pro (API directa) ──
  if (GEMINI_API_KEY) {
    const resp = await tryWithRetry(
      "Gemini Direct", GEMINI_API_URL,
      { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      baseBody, userId,
    );
    if (resp) return resp;
  }

  // ── 2. ChatGPT (via Lovable Gateway) ──
  if (LOVABLE_API_KEY) {
    const chatGPTModel = geminiModel.includes("flash") ? "openai/gpt-5-mini" : "openai/gpt-5";
    const resp = await tryWithRetry(
      "ChatGPT (Gateway)", LOVABLE_GATEWAY_URL,
      { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      { ...baseBody, model: chatGPTModel }, userId,
    );
    if (resp) return resp;
  }

  // ── 3. IA nativa Lovable (Gemini via Gateway) ──
  if (LOVABLE_API_KEY) {
    const resp = await tryWithRetry(
      "Lovable Native", LOVABLE_GATEWAY_URL,
      { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      { ...baseBody, model: `google/${geminiModel}` }, userId,
    );
    if (resp) return resp;
  }

  console.error("❌ Todos los proveedores de IA han fallado");
  return null;
}
