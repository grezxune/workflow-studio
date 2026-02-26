/**
 * OpenRouter-backed workflow generation service.
 */

import { inferGameContextFromPrompt, getGameContextPackById } from './game-context-packs.js';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL_PREFERENCE = 'codex-5.3';

const MODEL_CHAIN = {
  'codex-5.3': ['openai/gpt-5.3-codex', 'openai/gpt-5.2-codex', 'openai/gpt-5-codex'],
  'opus-4.6': ['anthropic/claude-opus-4.6', 'openai/gpt-5.2-codex']
};

let cachedModels = { ids: null, fetchedAt: 0 };

/**
 * Generate a workflow draft using OpenRouter.
 * @param {{
 *   prompt: string,
 *   gameId?: string | null,
 *   currentWorkflow?: object | null,
 *   preferredModel?: string | null
 * }} request
 * @param {{
 *   settings?: object,
 *   availableImages?: Array<{id: string}>,
 * }} options
 * @returns {Promise<{success: boolean, error?: string, data?: object, meta?: object}>}
 */
export async function generateWorkflowDraftWithAI(request, options = {}) {
  const prompt = (request?.prompt || '').trim();
  if (!prompt) {
    return { success: false, error: 'Prompt is required.' };
  }

  const apiKey = options.settings?.ai?.openRouterApiKey?.trim();
  if (!apiKey) {
    return { success: false, error: 'OpenRouter API key is missing. Set it in Settings > AI Assistant.' };
  }

  const preferredModel =
    request?.preferredModel ||
    options.settings?.ai?.preferredModel ||
    DEFAULT_MODEL_PREFERENCE;

  const modelResolution = await resolveModel(preferredModel);
  const gameContext = resolveGameContext(request?.gameId, prompt);
  const systemPrompt = buildSystemPrompt(gameContext.pack);
  const userPayload = {
    prompt,
    currentWorkflow: request?.currentWorkflow || null,
    availableImageIds: (options.availableImages || []).map((img) => img.id),
    gameContext: {
      id: gameContext.pack?.id || null,
      name: gameContext.pack?.name || 'Generic',
      source: gameContext.source,
      confidence: gameContext.confidence
    }
  };

  const raw = await callOpenRouter({
    apiKey,
    model: modelResolution.modelId,
    systemPrompt,
    userPayload
  });

  if (!raw.success) {
    return raw;
  }

  const normalized = normalizeAIResponse(raw.content);
  if (!normalized.success) {
    return normalized;
  }

  return {
    success: true,
    data: normalized.data,
    meta: {
      model: modelResolution.modelId,
      modelPreference: preferredModel,
      fallbackApplied: modelResolution.fallbackApplied,
      gameContext: {
        id: gameContext.pack?.id || null,
        source: gameContext.source,
        confidence: gameContext.confidence
      }
    }
  };
}

function resolveGameContext(selectedGameId, prompt) {
  const selectedPack = getGameContextPackById(selectedGameId);
  if (selectedPack) {
    return { pack: selectedPack, source: 'selector', confidence: 1 };
  }

  const inferred = inferGameContextFromPrompt(prompt);
  if (inferred.pack) {
    return { pack: inferred.pack, source: 'inference', confidence: inferred.confidence };
  }

  return { pack: null, source: 'generic', confidence: 1 };
}

async function resolveModel(preferredModel) {
  const preferred = MODEL_CHAIN[preferredModel] ? preferredModel : DEFAULT_MODEL_PREFERENCE;
  const available = await fetchAvailableModelIds();
  const chain = MODEL_CHAIN[preferred];
  const selected = chain.find((candidate) => available.has(candidate)) || chain[chain.length - 1];

  return {
    modelId: selected,
    fallbackApplied: selected !== chain[0]
  };
}

async function fetchAvailableModelIds() {
  const now = Date.now();
  if (cachedModels.ids && now - cachedModels.fetchedAt < 15 * 60 * 1000) {
    return cachedModels.ids;
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`OpenRouter models request failed: ${response.status}`);
    }
    const payload = await response.json();
    const ids = new Set((payload?.data || []).map((model) => model.id).filter(Boolean));
    cachedModels = { ids, fetchedAt: now };
    return ids;
  } catch (error) {
    const fallbackIds = new Set([
      'openai/gpt-5.2-codex',
      'openai/gpt-5-codex',
      'anthropic/claude-opus-4.6'
    ]);
    cachedModels = { ids: fallbackIds, fetchedAt: now };
    return fallbackIds;
  }
}

function buildSystemPrompt(gamePack) {
  const gameContextBlock = gamePack
    ? `
Game context (${gamePack.name}):
- Terminology: ${gamePack.terminology.map((t) => `${t.phrase} => ${t.meaning}`).join('; ')}
- Workflow hints: ${gamePack.workflowHints.join(' | ')}
- Constraints: ${gamePack.constraints.join(' | ')}
`
    : `
Game context: Generic mode.
- Do not assume game-specific mechanics unless the user explicitly states them.
`;

  return `You are a workflow generation assistant for Workflow Studio.

Return valid JSON only. No markdown fences.

${gameContextBlock}

Action schema:
- mouse_move: { type: "mouse_move", moveMode?: "point"|"bounds", x?: number, y?: number, bounds?: {x:number,y:number,width:number,height:number}, duration?: number, name?: string }
- mouse_click: { type: "mouse_click", button?: "left"|"right"|"middle", clickType?: "single"|"double", x?: number, y?: number, name?: string }
- keyboard: { type: "keyboard", mode: "type"|"press"|"hold_and_act", text?: string, key?: string, actions?: Action[], name?: string }
- wait: { type: "wait", duration: { min:number, max:number }, name?: string }
- conditional: { type: "conditional", condition: { type:"image_present"|"image_absent"|"pixel_match", imageId?:string, confidence?:number, color?:{r:number,g:number,b:number}, tolerance?:number }, thenActions: Action[], elseActions: Action[] }
- loop: { type: "loop", count?: number, infinite?: boolean, actions: Action[], delay: { min:number, max:number }, name?: string }
- image_detect: { type: "image_detect", imageId?: string, confidence?: number, failOnNotFound?: boolean, name?: string }
- pixel_detect: { type: "pixel_detect", color: {r:number,g:number,b:number}, tolerance?: number, failOnNotFound?: boolean, name?: string }

Response schema:
{
  "action": "replace" | "append" | "clarify",
  "workflow": {
    "name"?: string,
    "description"?: string,
    "loopCount"?: number,
    "loopDelay"?: { "min": number, "max": number },
    "actions"?: Action[]
  },
  "assumptions": string[],
  "clarification": string,
  "explanation": string
}

Rules:
- If user intent is clear, provide a draft workflow even if rough.
- If key details are missing, still return a workable draft and list assumptions.
- Keep delays realistic.
- For "shift click inventory"-type requests, prefer keyboard hold_and_act + nested loop + mouse actions.
`;
}

async function callOpenRouter({ apiKey, model, systemPrompt, userPayload }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://workflowstudio.local',
        'X-Title': 'Workflow Studio'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) }
        ]
      })
    });

    const responseText = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.error?.message || `OpenRouter request failed: ${response.status}`;
      return { success: false, error: message };
    }

    const message = payload?.choices?.[0]?.message?.content;
    const content = Array.isArray(message)
      ? message.map((part) => part?.text || '').join('\n')
      : message;

    if (!content || typeof content !== 'string') {
      return { success: false, error: 'AI returned an empty response.' };
    }

    return { success: true, content };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'AI request timed out after 30 seconds.' };
    }
    return { success: false, error: error.message || 'Failed to call OpenRouter.' };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAIResponse(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const extracted = extractJSONObject(content);
    if (!extracted) {
      return { success: false, error: 'AI returned invalid JSON. Try again.' };
    }
    try {
      parsed = JSON.parse(extracted);
    } catch {
      return { success: false, error: 'AI returned invalid JSON. Try again.' };
    }
  }

  const action = ['replace', 'append', 'clarify'].includes(parsed?.action) ? parsed.action : 'replace';
  if (action === 'clarify') {
    return {
      success: true,
      data: {
        action: 'clarify',
        clarification: String(parsed?.clarification || 'Please clarify your request.'),
        assumptions: Array.isArray(parsed?.assumptions) ? parsed.assumptions.slice(0, 8) : []
      }
    };
  }

  const workflow = parsed?.workflow || {};
  const normalized = {
    action,
    workflow: {
      name: typeof workflow.name === 'string' ? workflow.name.trim() : undefined,
      description: typeof workflow.description === 'string' ? workflow.description.trim() : undefined,
      loopCount: Number.isInteger(workflow.loopCount) ? Math.max(1, workflow.loopCount) : undefined,
      loopDelay: normalizeRange(workflow.loopDelay),
      actions: normalizeActions(workflow.actions || [])
    },
    assumptions: Array.isArray(parsed?.assumptions) ? parsed.assumptions.slice(0, 10).map(String) : [],
    explanation: typeof parsed?.explanation === 'string' ? parsed.explanation : ''
  };

  if (!normalized.workflow.actions.length) {
    return { success: false, error: 'AI did not return any actionable workflow steps.' };
  }

  return { success: true, data: normalized };
}

function extractJSONObject(text) {
  if (!text || typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) return [];
  const allowed = new Set([
    'mouse_move',
    'mouse_click',
    'keyboard',
    'wait',
    'conditional',
    'loop',
    'image_detect',
    'pixel_detect'
  ]);

  return actions
    .filter((action) => action && typeof action === 'object' && allowed.has(action.type))
    .map((action) => {
      const normalized = { ...action };
      if (typeof normalized.name === 'string') normalized.name = normalized.name.trim();

      if (normalized.type === 'keyboard' && normalized.mode === 'hold_and_act') {
        normalized.actions = normalizeActions(normalized.actions || []);
      }
      if (normalized.type === 'conditional') {
        normalized.thenActions = normalizeActions(normalized.thenActions || []);
        normalized.elseActions = normalizeActions(normalized.elseActions || []);
      }
      if (normalized.type === 'loop') {
        normalized.actions = normalizeActions(normalized.actions || []);
        normalized.delay = normalizeRange(normalized.delay) || { min: 500, max: 1000 };
      }
      if (normalized.type === 'wait') {
        normalized.duration = normalizeRange(normalized.duration) || { min: 500, max: 1000 };
      }

      return normalized;
    });
}

function normalizeRange(value) {
  if (!value || typeof value !== 'object') return undefined;
  const min = Number.isFinite(Number(value.min)) ? Number(value.min) : undefined;
  const max = Number.isFinite(Number(value.max)) ? Number(value.max) : undefined;
  if (min === undefined || max === undefined) return undefined;
  return { min: Math.max(0, Math.round(min)), max: Math.max(Math.round(min), Math.round(max)) };
}
