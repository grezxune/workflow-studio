/**
 * Game context packs for AI workflow generation.
 *
 * Packs provide domain terminology and pattern hints for specific games.
 */

const GAME_CONTEXT_PACKS = [
  {
    id: 'runescape-3',
    name: 'RuneScape 3',
    aliases: ['rs3', 'runescape', 'rune scape 3'],
    terminology: [
      {
        phrase: 'shift click inventory',
        meaning: 'Hold shift while clicking inventory slots to perform bulk inventory actions',
        canonicalIntent: 'inventory.bulk_shift_click'
      },
      {
        phrase: 'drop inventory',
        meaning: 'Rapidly clear an inventory by repeated slot interactions',
        canonicalIntent: 'inventory.bulk_shift_click'
      },
      {
        phrase: 'bank preset',
        meaning: 'Interact with a known UI element in the bank interface',
        canonicalIntent: 'bank.preset_interaction'
      }
    ],
    workflowHints: [
      'Inventory commonly behaves like a 28-slot grid (4 columns x 7 rows).',
      'When exact coordinates are unknown, prefer a bounded region + repeated move/click loop draft users can refine.',
      'For shift-click inventory tasks, prefer keyboard hold_and_act with nested loop + mouse actions.'
    ],
    constraints: [
      'Avoid assuming fixed screen coordinates unless user provided them.',
      'Use realistic delays to avoid robotic patterns.'
    ]
  }
];

const GAME_PACK_INDEX = new Map(GAME_CONTEXT_PACKS.map((pack) => [pack.id, pack]));

/**
 * Return lightweight game list for UI selectors.
 * @returns {Array<{id: string, name: string}>}
 */
export function listSupportedGames() {
  return GAME_CONTEXT_PACKS.map((pack) => ({ id: pack.id, name: pack.name }));
}

/**
 * Resolve a context pack by explicit ID.
 * @param {string | null | undefined} gameId
 * @returns {object | null}
 */
export function getGameContextPackById(gameId) {
  if (!gameId || gameId === 'generic') return null;
  return GAME_PACK_INDEX.get(gameId) || null;
}

/**
 * Infer game context from free-form prompt text.
 * @param {string} prompt
 * @returns {{pack: object | null, confidence: number, matchedAlias: string | null}}
 */
export function inferGameContextFromPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { pack: null, confidence: 0, matchedAlias: null };
  }

  const lowerPrompt = prompt.toLowerCase();
  for (const pack of GAME_CONTEXT_PACKS) {
    const aliases = [pack.name, ...(pack.aliases || [])];
    for (const alias of aliases) {
      if (lowerPrompt.includes(alias.toLowerCase())) {
        return { pack, confidence: 0.9, matchedAlias: alias };
      }
    }
  }

  return { pack: null, confidence: 0, matchedAlias: null };
}

