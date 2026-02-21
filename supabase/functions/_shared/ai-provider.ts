/**
 * AI_ORCHESTRATOR — Sistema centralizado de orquestación de IA.
 * 
 * TODA solicitud de IA en la aplicación DEBE pasar por este módulo.
 * Ningún módulo puede llamar directamente a un proveedor de IA.
 * 
 * Exports principales:
 *   - callAIWithFallback(messages, options) — bajo nivel, envía messages raw
 *   - generateWithFallback(prompt, metadata)  — alto nivel, estandariza formato
 * 
 * Cadena de fallback (6 intentos antes de fallar):
 *   1. Gemini Pro (API directa)
 *   2. Gemini Flash (API directa — cuota separada)
 *   3. ChatGPT (via Lovable AI Gateway)
 *   4. IA nativa de Lovable — Gemini via Gateway
 *   5. IA nativa de Lovable — Flash via Gateway
 *   6. ChatGPT Nano (via Gateway — modelo más económico)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 120_000;

// ══════════════════════════════════════════════════════════
//  CIRCUIT BREAKER — In-memory provider health tracking
// ══════════════════════════════════════════════════════════

const CIRCUIT_BREAKER_THRESHOLD = 3;     // failures to trigger
const CIRCUIT_BREAKER_WINDOW_MS = 10 * 60 * 1000; // 10 min window
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown

interface CircuitState {
  failures: number[];        // timestamps of recent failures
  unstableSince: number | null; // when it was marked unstable (null = healthy)
}

/** In-memory circuit state per provider. Persists across requests within same isolate. */
const circuitStates: Record<string, CircuitState> = {};

function getCircuitState(provider: string): CircuitState {
  if (!circuitStates[provider]) {
    circuitStates[provider] = { failures: [], unstableSince: null };
  }
  return circuitStates[provider];
}

/** Record a failure for a provider. Returns true if provider is now unstable. */
function recordProviderFailure(provider: string): boolean {
  const state = getCircuitState(provider);
  const now = Date.now();

  state.failures.push(now);
  state.failures = state.failures.filter(t => now - t < CIRCUIT_BREAKER_WINDOW_MS);

  if (state.failures.length >= CIRCUIT_BREAKER_THRESHOLD && !state.unstableSince) {
    state.unstableSince = now;
    console.warn(`🔴 Circuit breaker OPEN: ${provider} marcado como inestable (${state.failures.length} fallos en 10 min). Cooldown: 5 min.`);
    return true;
  }
  return state.unstableSince !== null;
}

/** Record a success — reset the circuit breaker for this provider. */
function recordProviderSuccess(provider: string) {
  const state = getCircuitState(provider);
  if (state.unstableSince) {
    console.log(`🟢 Circuit breaker CLOSED: ${provider} recuperado.`);
  }
  state.failures = [];
  state.unstableSince = null;
}

/** Check if a provider should be skipped (circuit is open and cooldown hasn't elapsed). */
function isProviderUnstable(provider: string): boolean {
  const state = getCircuitState(provider);
  if (!state.unstableSince) return false;

  const elapsed = Date.now() - state.unstableSince;
  if (elapsed >= CIRCUIT_BREAKER_COOLDOWN_MS) {
    console.log(`🟡 Circuit breaker HALF-OPEN: ${provider} — probando tras ${Math.round(elapsed / 1000)}s de cooldown.`);
    state.unstableSince = null;
    state.failures = [];
    return false;
  }

  console.log(`⏭️ Saltando ${provider} — inestable (${Math.round((CIRCUIT_BREAKER_COOLDOWN_MS - elapsed) / 1000)}s restantes de cooldown).`);
  return true;
}

// ══════════════════════════════════════════════════════════
//  PROVIDER STATUS CACHE — Global availability tracking
// ══════════════════════════════════════════════════════════

interface ProviderStatus {
  name: string;
  status: "available" | "temporarily_unavailable" | "cooldown";
  cooldownUntil: number | null;
  lastError: string | null;
  lastSuccess: number | null;
}

const providerStatuses: Record<string, ProviderStatus> = {};

function getProviderStatus(name: string): ProviderStatus {
  if (!providerStatuses[name]) {
    providerStatuses[name] = {
      name,
      status: "available",
      cooldownUntil: null,
      lastError: null,
      lastSuccess: null,
    };
  }
  // Auto-recover from cooldown
  const ps = providerStatuses[name];
  if (ps.status === "cooldown" && ps.cooldownUntil && Date.now() > ps.cooldownUntil) {
    ps.status = "available";
    ps.cooldownUntil = null;
  }
  return ps;
}

function markProviderFailed(name: string, reason: string) {
  const ps = getProviderStatus(name);
  ps.status = "cooldown";
  ps.cooldownUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
  ps.lastError = reason;
}

function markProviderAvailable(name: string) {
  const ps = getProviderStatus(name);
  ps.status = "available";
  ps.cooldownUntil = null;
  ps.lastError = null;
  ps.lastSuccess = Date.now();
}

function isProviderInCooldown(name: string): boolean {
  const ps = getProviderStatus(name);
  return ps.status !== "available";
}

// ══════════════════════════════════════════════════════════
//  UNIFIED ERROR MESSAGES — Never expose technical details
// ══════════════════════════════════════════════════════════

/** User-friendly error messages. NEVER expose provider names, status codes, or technical details. */
export const AI_ERRORS = {
  ALL_UNAVAILABLE: "No hay proveedores de IA disponibles en este momento. Inténtalo en unos minutos.",
  GENERATION_FAILED: "Error procesando la solicitud. Inténtalo de nuevo.",
  INVALID_INPUT: "Los datos de entrada son inválidos. Verifica los campos e intenta de nuevo.",
} as const;

// ══════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════

export interface AIProviderOptions {
  model?: string;
  stream?: boolean;
  temperature?: number;
  response_mime_type?: string;
  userId?: string;
}

/** Metadata para generateWithFallback — describe QUÉ se genera y CÓMO */
export interface GenerationMetadata {
  contentType: string;
  outputFormat?: "markdown" | "json";
  jsonSchema?: string;
  formatInstructions?: string;
  campaignContext?: string;
  region?: string;
  tone?: string;
  partyLevel?: string;
  userId?: string;
  model?: string;
  temperature?: number;
  stream?: boolean;
}

type ErrorType = "quota_exhausted" | "rate_limit" | "invalid_token" | "network_error" | "timeout" | "server_error" | "payment_required" | "unknown";

// ══════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ══════════════════════════════════════════════════════════

function classifyError(status: number | "timeout" | "error", responseBody?: string): ErrorType {
  if (status === "timeout") return "timeout";
  if (status === "error") return "network_error";
  if (status === 402) return "payment_required";
  if (status === 429) {
    const lower = (responseBody || "").toLowerCase();
    if (lower.includes("quota") || lower.includes("exhausted") || lower.includes("billing")) {
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
  console.warn(`📝 Log IA: [${proveedor}] ${tipoError}${detalles ? ` — ${detalles.slice(0, 200)}` : ""}`);
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

  // Only retry on rate_limit (temporary), not on quota_exhausted or payment_required
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

// ══════════════════════════════════════════════════════════
//  MODEL DEGRADATION — Auto-select cheaper model when needed
// ══════════════════════════════════════════════════════════

/** Get a cheaper/faster alternative model when the requested model's quota is exhausted */
function getFallbackModel(requestedModel: string): string | null {
  const fallbacks: Record<string, string> = {
    "gemini-2.5-pro": "gemini-2.5-flash",
    "gemini-2.5-flash": "gemini-2.5-flash-lite",
  };
  return fallbacks[requestedModel] || null;
}

/** Map Gemini model to equivalent Gateway model */
function getGatewayModel(geminiModel: string, tier: "chatgpt" | "native"): string {
  if (tier === "chatgpt") {
    if (geminiModel.includes("flash-lite")) return "openai/gpt-5-nano";
    if (geminiModel.includes("flash")) return "openai/gpt-5-mini";
    return "openai/gpt-5";
  }
  // native tier - prefix with google/
  return `google/${geminiModel}`;
}

// ══════════════════════════════════════════════════════════
//  callAIWithFallback — LOW LEVEL (raw messages)
// ══════════════════════════════════════════════════════════

/** Result with provider metadata for UI indicators */
export interface AIResult {
  response: Response;
  provider: "primary" | "alternative";
  /** User-friendly provider label (no technical details) */
  providerLabel: string;
  /** Whether a fallback model was used (lighter than requested) */
  modelDegraded: boolean;
}

/**
 * AI_ORCHESTRATOR.generate — Llamada centralizada con cadena de fallback completa.
 * 
 * Cadena de intentos:
 * 1. Gemini Pro (directo) → 2. Gemini Flash (directo)
 * 3. ChatGPT (gateway) → 4. Gemini Pro (gateway) → 5. Gemini Flash (gateway)
 * 6. ChatGPT Nano (gateway)
 * 
 * Returns AIResult with provider info, or null if ALL providers fail.
 */
export async function callAIWithFallback(
  messages: any[],
  options: AIProviderOptions = {},
): Promise<AIResult | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const userId = options.userId;

  const requestedModel = options.model || "gemini-2.5-pro";
  const baseBody: any = { messages };
  if (options.stream) baseBody.stream = true;
  if (options.temperature !== undefined) baseBody.temperature = options.temperature;
  if (options.response_mime_type) baseBody.response_mime_type = options.response_mime_type;

  // ══════════════════════════════════════════════════════════
  //  TIER 1: Gemini Direct (user's API key) — Pro then Flash
  // ══════════════════════════════════════════════════════════

  if (GEMINI_API_KEY) {
    const geminiModels = [requestedModel];
    const fallback = getFallbackModel(requestedModel);
    if (fallback) geminiModels.push(fallback);

    for (const model of geminiModels) {
      const providerName = `Gemini Direct (${model})`;
      if (isProviderUnstable(providerName) || isProviderInCooldown(providerName)) continue;

      const resp = await tryWithRetry(
        providerName, GEMINI_API_URL,
        { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
        { ...baseBody, model }, userId,
      );
      if (resp) {
        recordProviderSuccess(providerName);
        markProviderAvailable(providerName);
        return {
          response: resp,
          provider: "primary",
          providerLabel: "Generador Principal",
          modelDegraded: model !== requestedModel,
        };
      }
      recordProviderFailure(providerName);
      markProviderFailed(providerName, "request_failed");
    }
  }

  // ══════════════════════════════════════════════════════════
  //  TIER 2: Lovable AI Gateway — ChatGPT equivalent
  // ══════════════════════════════════════════════════════════

  if (LOVABLE_API_KEY) {
    const gatewayProviderName = "Gateway ChatGPT";
    if (!isProviderUnstable(gatewayProviderName) && !isProviderInCooldown(gatewayProviderName)) {
      const chatGPTModel = getGatewayModel(requestedModel, "chatgpt");
      const resp = await tryWithRetry(
        gatewayProviderName, LOVABLE_GATEWAY_URL,
        { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        { ...baseBody, model: chatGPTModel }, userId,
      );
      if (resp) {
        recordProviderSuccess(gatewayProviderName);
        markProviderAvailable(gatewayProviderName);
        return {
          response: resp,
          provider: "alternative",
          providerLabel: "Generador Alternativo",
          modelDegraded: false,
        };
      }
      recordProviderFailure(gatewayProviderName);
      markProviderFailed(gatewayProviderName, "request_failed");
    }

    // ══════════════════════════════════════════════════════════
    //  TIER 3: Lovable Native — Gemini via Gateway (Pro then Flash)
    // ══════════════════════════════════════════════════════════

    const nativeModels = [requestedModel];
    const nativeFallback = getFallbackModel(requestedModel);
    if (nativeFallback) nativeModels.push(nativeFallback);

    for (const model of nativeModels) {
      const providerName = `Gateway Native (${model})`;
      if (isProviderUnstable(providerName) || isProviderInCooldown(providerName)) continue;

      const gatewayModel = getGatewayModel(model, "native");
      const resp = await tryWithRetry(
        providerName, LOVABLE_GATEWAY_URL,
        { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        { ...baseBody, model: gatewayModel }, userId,
      );
      if (resp) {
        recordProviderSuccess(providerName);
        markProviderAvailable(providerName);
        return {
          response: resp,
          provider: "alternative",
          providerLabel: "Generador Alternativo",
          modelDegraded: model !== requestedModel,
        };
      }
      recordProviderFailure(providerName);
      markProviderFailed(providerName, "request_failed");
    }

    // ══════════════════════════════════════════════════════════
    //  TIER 4: Last resort — cheapest model via Gateway
    // ══════════════════════════════════════════════════════════

    const lastResortName = "Gateway Nano";
    if (!isProviderUnstable(lastResortName) && !isProviderInCooldown(lastResortName)) {
      const resp = await tryWithRetry(
        lastResortName, LOVABLE_GATEWAY_URL,
        { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        { ...baseBody, model: "openai/gpt-5-nano" }, userId,
      );
      if (resp) {
        recordProviderSuccess(lastResortName);
        markProviderAvailable(lastResortName);
        return {
          response: resp,
          provider: "alternative",
          providerLabel: "Generador de Respaldo",
          modelDegraded: true,
        };
      }
      recordProviderFailure(lastResortName);
      markProviderFailed(lastResortName, "request_failed");
    }
  }

  console.error("❌ AI_ORCHESTRATOR: Todos los proveedores han fallado");
  return null;
}

// ══════════════════════════════════════════════════════════
//  generateWithFallback — HIGH LEVEL (standardized prompts)
// ══════════════════════════════════════════════════════════

/**
 * AI_ORCHESTRATOR.generateWithFallback — Punto de entrada de alto nivel.
 * 
 * Construye un prompt estandarizado agnóstico de proveedor y lo envía con fallback completo.
 * 
 * Garantías:
 *   - El prompt NO usa sintaxis específica de ningún proveedor.
 *   - Las instrucciones de formato son explícitas y universales.
 *   - La salida es siempre estructurada (markdown con secciones o JSON).
 *   - El mismo prompt produce resultados coherentes en cualquier modelo.
 */
export async function generateWithFallback(
  systemPrompt: string,
  userPrompt: string,
  metadata: GenerationMetadata = { contentType: "generic" },
): Promise<AIResult | null> {
  const standardizedSystem = buildStandardizedSystemPrompt(systemPrompt, metadata);
  const standardizedUser = buildStandardizedUserPrompt(userPrompt, metadata);

  const messages = [
    { role: "system", content: standardizedSystem },
    { role: "user", content: standardizedUser },
  ];

  const options: AIProviderOptions = {
    model: metadata.model || "gemini-2.5-pro",
    stream: metadata.stream ?? false,
    temperature: metadata.temperature ?? 0.8,
    userId: metadata.userId,
  };

  if (metadata.outputFormat === "json" && !metadata.stream) {
    options.response_mime_type = "application/json";
  }

  return callAIWithFallback(messages, options);
}

/**
 * Construye el system prompt estandarizado.
 */
function buildStandardizedSystemPrompt(originalSystem: string, meta: GenerationMetadata): string {
  const parts: string[] = [];

  parts.push(`Eres un asistente experto para Dungeon Masters de Dungeons & Dragons 5e.
Tu tarea es generar contenido de tipo: ${meta.contentType}.

REGLAS UNIVERSALES DE FORMATO:
1. Responde SIEMPRE en español.
2. Usa SOLO lore oficial de Forgotten Realms.
3. NO uses funciones, herramientas ni sintaxis específica de ningún sistema.
4. Tu respuesta debe ser autocontenida y completa.
5. NO incluyas comentarios meta sobre tu proceso de generación.`);

  if (meta.outputFormat === "json") {
    parts.push(`
FORMATO DE SALIDA: JSON ESTRICTO
- Responde ÚNICAMENTE con un objeto JSON válido.
- NO envuelvas en bloques de código (\`\`\`).
- NO incluyas texto antes ni después del JSON.
- Asegúrate de que todos los strings estén correctamente escapados.
- Usa comillas dobles para claves y valores string.`);
    if (meta.jsonSchema) {
      parts.push(`ESQUEMA ESPERADO:\n${meta.jsonSchema}`);
    }
  } else {
    parts.push(`
FORMATO DE SALIDA: MARKDOWN ESTRUCTURADO
- Usa encabezados (##, ###) para organizar secciones.
- Usa listas con guiones (-) para elementos.
- Usa negritas (**texto**) para datos clave.
- Usa tablas markdown cuando sea apropiado.
- Incluye emojis de sección para mejor legibilidad.
- Cada sección debe ser autocontenida y claramente separada.`);
  }

  if (meta.formatInstructions) {
    parts.push(`\nINSTRUCCIONES ADICIONALES DE FORMATO:\n${meta.formatInstructions}`);
  }

  parts.push(`\n--- INSTRUCCIONES ESPECÍFICAS ---\n${originalSystem}`);

  return parts.join("\n");
}

/**
 * Construye el user prompt estandarizado.
 */
function buildStandardizedUserPrompt(originalUser: string, meta: GenerationMetadata): string {
  const parts: string[] = [];

  const hasContext = meta.region || meta.tone || meta.partyLevel || meta.campaignContext;
  if (hasContext) {
    parts.push("=== CONTEXTO DE GENERACIÓN ===");
    if (meta.region) parts.push(`REGIÓN: ${meta.region}`);
    if (meta.tone) parts.push(`TONO NARRATIVO: ${meta.tone}`);
    if (meta.partyLevel) parts.push(`NIVEL DEL GRUPO: ${meta.partyLevel}`);
    if (meta.campaignContext) parts.push(`\nCONTEXTO DE CAMPAÑA:\n${meta.campaignContext}`);
    parts.push("=== FIN CONTEXTO ===\n");
  }

  parts.push(originalUser);

  if (meta.outputFormat === "json") {
    parts.push("\nRECUERDA: Responde SOLO con JSON válido. Sin markdown, sin bloques de código, sin texto adicional.");
  }

  return parts.join("\n");
}

// ══════════════════════════════════════════════════════════
//  UTILITY: Parse robust JSON from AI responses
// ══════════════════════════════════════════════════════════

export function parseAIJsonResponse<T = any>(raw: string, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;

  try { return JSON.parse(raw); } catch { /* continue */ }

  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1]); } catch { /* continue */ }
  }

  const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch { /* continue */ }
  }

  console.warn("⚠️ Could not parse AI JSON response, using fallback");
  return fallback;
}
