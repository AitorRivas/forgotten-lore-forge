/**
 * Sistema de proveedores de IA con prioridad y fallback automático.
 * 
 * Orden de prioridad:
 *   1. Gemini Pro (API directa) — principal
 *   2. ChatGPT (via Lovable AI Gateway) — secundario
 *   3. IA nativa de Lovable (Gemini via Gateway) — terciario
 * 
 * Comportamiento ante errores:
 *   - 429 (rate limit): espera 2s y reintenta 1 vez antes de escalar
 *   - 401, 403, 500, 503, timeout: escala inmediatamente al siguiente proveedor
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RETRYABLE_ERRORS = new Set([429]);
const ESCALATION_ERRORS = new Set([401, 403, 500, 503]);
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 120_000; // 2 min

export interface AIProviderOptions {
  model?: string;
  stream?: boolean;
  temperature?: number;
  response_mime_type?: string;
}

interface ProviderResult {
  response: Response | null;
  provider: string;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryProvider(
  name: string,
  url: string,
  headers: Record<string, string>,
  body: any,
): Promise<{ ok: true; response: Response } | { ok: false; status: number | "timeout" | "error" }> {
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
    console.warn(`⚠️ ${name}: error HTTP ${resp.status}`);
    // Consume body to avoid resource leak
    try { await resp.text(); } catch { /* ignore */ }
    return { ok: false, status: resp.status };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      console.error(`⏱️ ${name}: timeout (${REQUEST_TIMEOUT_MS / 1000}s)`);
      return { ok: false, status: "timeout" };
    }
    console.error(`❌ ${name}: error de red:`, e);
    return { ok: false, status: "error" };
  }
}

/**
 * Llama a la IA con sistema de fallback triple.
 * Devuelve la Response del primer proveedor que responda exitosamente, o null si todos fallan.
 */
export async function callAIWithFallback(
  messages: any[],
  options: AIProviderOptions = {},
): Promise<Response | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const geminiModel = options.model || "gemini-2.5-pro";
  const baseBody: any = { model: geminiModel, messages };
  if (options.stream) baseBody.stream = true;
  if (options.temperature !== undefined) baseBody.temperature = options.temperature;
  if (options.response_mime_type) baseBody.response_mime_type = options.response_mime_type;

  // ── 1. Proveedor PRINCIPAL: Gemini Pro (API directa) ──
  if (GEMINI_API_KEY) {
    const geminiHeaders = {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    };

    const result = await tryProvider("Gemini Direct", GEMINI_API_URL, geminiHeaders, baseBody);
    if (result.ok) return result.response;

    // Si es 429, esperar 2s y reintentar una vez
    if (!result.ok && result.status === 429) {
      console.log("🔄 Gemini 429: esperando 2s para reintentar...");
      await sleep(RETRY_DELAY_MS);
      const retry = await tryProvider("Gemini Direct (retry)", GEMINI_API_URL, geminiHeaders, baseBody);
      if (retry.ok) return retry.response;
    }
  }

  // ── 2. Proveedor SECUNDARIO: ChatGPT (via Lovable Gateway) ──
  if (LOVABLE_API_KEY) {
    const chatGPTModel = geminiModel.includes("flash") ? "openai/gpt-5-mini" : "openai/gpt-5";
    const chatGPTBody = { ...baseBody, model: chatGPTModel };
    const gatewayHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    const result = await tryProvider("ChatGPT (Gateway)", LOVABLE_GATEWAY_URL, gatewayHeaders, chatGPTBody);
    if (result.ok) return result.response;

    // Si es 429, esperar 2s y reintentar una vez
    if (!result.ok && result.status === 429) {
      console.log("🔄 ChatGPT 429: esperando 2s para reintentar...");
      await sleep(RETRY_DELAY_MS);
      const retry = await tryProvider("ChatGPT (retry)", LOVABLE_GATEWAY_URL, gatewayHeaders, chatGPTBody);
      if (retry.ok) return retry.response;
    }
  }

  // ── 3. Proveedor TERCIARIO: IA nativa Lovable (Gemini via Gateway) ──
  if (LOVABLE_API_KEY) {
    const nativeBody = { ...baseBody, model: `google/${geminiModel}` };
    const gatewayHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    const result = await tryProvider("Lovable Native (Gemini)", LOVABLE_GATEWAY_URL, gatewayHeaders, nativeBody);
    if (result.ok) return result.response;
  }

  console.error("❌ Todos los proveedores de IA han fallado");
  return null;
}
