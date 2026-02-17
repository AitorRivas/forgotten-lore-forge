/**
 * Sistema de proveedores de IA con prioridad, fallback automático y logging de errores.
 * 
 * Exports principales:
 *   - callAIWithFallback(messages, options) — bajo nivel, envía messages raw
 *   - generateWithFallback(prompt, metadata)  — alto nivel, estandariza formato
 * 
 * Orden de prioridad:
 *   1. Gemini Pro (API directa) — principal
 *   2. ChatGPT (via Lovable AI Gateway) — secundario
 *   3. IA nativa de Lovable (Gemini via Gateway) — terciario
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

  // Add failure timestamp
  state.failures.push(now);

  // Prune old failures outside the window
  state.failures = state.failures.filter(t => now - t < CIRCUIT_BREAKER_WINDOW_MS);

  // Check if threshold exceeded
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
    // Cooldown elapsed — allow a probe attempt (half-open state)
    console.log(`🟡 Circuit breaker HALF-OPEN: ${provider} — probando tras ${Math.round(elapsed / 1000)}s de cooldown.`);
    state.unstableSince = null; // Reset, will re-trigger if it fails again
    state.failures = [];
    return false;
  }

  console.log(`⏭️ Saltando ${provider} — inestable (${Math.round((CIRCUIT_BREAKER_COOLDOWN_MS - elapsed) / 1000)}s restantes de cooldown).`);
  return true;
}

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
  /** Tipo de contenido: "encounter", "npc", "mission", "location", etc. */
  contentType: string;
  /** Formato de salida esperado: "markdown" | "json" */
  outputFormat?: "markdown" | "json";
  /** Esquema JSON esperado (si outputFormat es "json"). Descripción textual del esquema. */
  jsonSchema?: string;
  /** Instrucciones extra de formato que se añaden al system prompt */
  formatInstructions?: string;
  /** Contexto de campaña (se inyecta automáticamente) */
  campaignContext?: string;
  /** Región de Faerûn */
  region?: string;
  /** Tono narrativo */
  tone?: string;
  /** Nivel del grupo */
  partyLevel?: string;
  /** ID de usuario para logging */
  userId?: string;
  /** Modelo preferido (default: gemini-2.5-pro) */
  model?: string;
  /** Temperatura (default: 0.8) */
  temperature?: number;
  /** Usar streaming (default: false) */
  stream?: boolean;
}

type ErrorType = "quota_exhausted" | "rate_limit" | "invalid_token" | "network_error" | "timeout" | "server_error" | "unknown";

// ══════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ══════════════════════════════════════════════════════════

function classifyError(status: number | "timeout" | "error", responseBody?: string): ErrorType {
  if (status === "timeout") return "timeout";
  if (status === "error") return "network_error";
  if (status === 429) {
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
//  callAIWithFallback — LOW LEVEL (raw messages)
// ══════════════════════════════════════════════════════════

/** Result with provider metadata for UI indicators */
export interface AIResult {
  response: Response;
  provider: "primary" | "alternative";
  /** User-friendly provider label (no technical details) */
  providerLabel: string;
}

/**
 * Llama a la IA con sistema de fallback triple y logging de errores.
 * Returns AIResult with provider info, or null if all fail.
 */
export async function callAIWithFallback(
  messages: any[],
  options: AIProviderOptions = {},
): Promise<AIResult | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const userId = options.userId;

  const geminiModel = options.model || "gemini-2.5-pro";
  const baseBody: any = { model: geminiModel, messages };
  if (options.stream) baseBody.stream = true;
  if (options.temperature !== undefined) baseBody.temperature = options.temperature;
  if (options.response_mime_type) baseBody.response_mime_type = options.response_mime_type;

  const geminiUnstable = isProviderUnstable("Gemini Direct");

  // ── 1. Gemini Pro (API directa) — skip if circuit breaker is open ──
  if (GEMINI_API_KEY && !geminiUnstable) {
    const resp = await tryWithRetry(
      "Gemini Direct", GEMINI_API_URL,
      { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      baseBody, userId,
    );
    if (resp) {
      recordProviderSuccess("Gemini Direct");
      return { response: resp, provider: "primary", providerLabel: "Gemini Pro" };
    }
    recordProviderFailure("Gemini Direct");
  }

  // ── 2. ChatGPT (via Lovable Gateway) ──
  if (LOVABLE_API_KEY && !isProviderUnstable("ChatGPT (Gateway)")) {
    const chatGPTModel = geminiModel.includes("flash") ? "openai/gpt-5-mini" : "openai/gpt-5";
    const resp = await tryWithRetry(
      "ChatGPT (Gateway)", LOVABLE_GATEWAY_URL,
      { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      { ...baseBody, model: chatGPTModel }, userId,
    );
    if (resp) {
      recordProviderSuccess("ChatGPT (Gateway)");
      return { response: resp, provider: "alternative", providerLabel: "ChatGPT" };
    }
    recordProviderFailure("ChatGPT (Gateway)");
  }

  // ── 3. IA nativa Lovable (Gemini via Gateway) ──
  if (LOVABLE_API_KEY && !isProviderUnstable("Lovable Native")) {
    const resp = await tryWithRetry(
      "Lovable Native", LOVABLE_GATEWAY_URL,
      { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      { ...baseBody, model: `google/${geminiModel}` }, userId,
    );
    if (resp) {
      recordProviderSuccess("Lovable Native");
      return { response: resp, provider: "alternative", providerLabel: "IA Nativa" };
    }
    recordProviderFailure("Lovable Native");
  }

  console.error("❌ Todos los proveedores de IA han fallado");
  return null;
}

// ══════════════════════════════════════════════════════════
//  generateWithFallback — HIGH LEVEL (standardized prompts)
// ══════════════════════════════════════════════════════════

/**
 * Construye un prompt estandarizado agnóstico de proveedor y lo envía con fallback.
 * 
 * Garantías:
 *   - El prompt NO usa sintaxis específica de ningún proveedor (ni Gemini, ni OpenAI).
 *   - Las instrucciones de formato son explícitas y universales.
 *   - La salida es siempre estructurada (markdown con secciones o JSON).
 *   - El mismo prompt produce resultados coherentes en cualquier modelo.
 * 
 * @param systemPrompt  Instrucciones del sistema (rol, reglas, formato de salida)
 * @param userPrompt    Instrucciones del usuario (qué generar, contexto)
 * @param metadata      Configuración de generación
 * @returns Response del proveedor o null si todos fallan
 */
export async function generateWithFallback(
  systemPrompt: string,
  userPrompt: string,
  metadata: GenerationMetadata = { contentType: "generic" },
): Promise<AIResult | null> {
  // ── Build standardized system prompt ──
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

  // Only set response_mime_type for non-streaming JSON requests
  // NOTE: This is an optimization hint, NOT a provider-specific feature.
  // The actual format is enforced via prompt instructions, not provider features.
  if (metadata.outputFormat === "json" && !metadata.stream) {
    options.response_mime_type = "application/json";
  }

  return callAIWithFallback(messages, options);
}

/**
 * Construye el system prompt estandarizado.
 * Envuelve el prompt original con instrucciones universales de formato.
 */
function buildStandardizedSystemPrompt(originalSystem: string, meta: GenerationMetadata): string {
  const parts: string[] = [];

  // ── Universal preamble ──
  parts.push(`Eres un asistente experto para Dungeon Masters de Dungeons & Dragons 5e.
Tu tarea es generar contenido de tipo: ${meta.contentType}.

REGLAS UNIVERSALES DE FORMATO:
1. Responde SIEMPRE en español.
2. Usa SOLO lore oficial de Forgotten Realms.
3. NO uses funciones, herramientas ni sintaxis específica de ningún sistema.
4. Tu respuesta debe ser autocontenida y completa.
5. NO incluyas comentarios meta sobre tu proceso de generación.`);

  // ── Output format instructions ──
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

  // ── Extra format instructions ──
  if (meta.formatInstructions) {
    parts.push(`\nINSTRUCCIONES ADICIONALES DE FORMATO:\n${meta.formatInstructions}`);
  }

  // ── Original domain-specific system prompt ──
  parts.push(`\n--- INSTRUCCIONES ESPECÍFICAS ---\n${originalSystem}`);

  return parts.join("\n");
}

/**
 * Construye el user prompt estandarizado.
 * Inyecta contexto de campaña, región y tono de forma uniforme.
 */
function buildStandardizedUserPrompt(originalUser: string, meta: GenerationMetadata): string {
  const parts: string[] = [];

  // ── Context header ──
  const hasContext = meta.region || meta.tone || meta.partyLevel || meta.campaignContext;
  if (hasContext) {
    parts.push("=== CONTEXTO DE GENERACIÓN ===");
    if (meta.region) parts.push(`REGIÓN: ${meta.region}`);
    if (meta.tone) parts.push(`TONO NARRATIVO: ${meta.tone}`);
    if (meta.partyLevel) parts.push(`NIVEL DEL GRUPO: ${meta.partyLevel}`);
    if (meta.campaignContext) parts.push(`\nCONTEXTO DE CAMPAÑA:\n${meta.campaignContext}`);
    parts.push("=== FIN CONTEXTO ===\n");
  }

  // ── Original user prompt ──
  parts.push(originalUser);

  // ── Output reminder (universal, no provider-specific) ──
  if (meta.outputFormat === "json") {
    parts.push("\nRECUERDA: Responde SOLO con JSON válido. Sin markdown, sin bloques de código, sin texto adicional.");
  }

  return parts.join("\n");
}

// ══════════════════════════════════════════════════════════
//  UTILITY: Parse robust JSON from AI responses
// ══════════════════════════════════════════════════════════

/**
 * Parsea JSON de manera robusta desde respuestas de IA.
 * Maneja: bloques de código, texto extra, JSON malformado.
 */
export function parseAIJsonResponse<T = any>(raw: string, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;

  // Try direct parse first
  try { return JSON.parse(raw); } catch { /* continue */ }

  // Try extracting from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1]); } catch { /* continue */ }
  }

  // Try finding first { ... } or [ ... ]
  const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch { /* continue */ }
  }

  console.warn("⚠️ Could not parse AI JSON response, using fallback");
  return fallback;
}
