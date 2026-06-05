# AI Workflow Generation Service

This folder contains the OpenRouter-backed workflow generation service used by the editor AI composer.

## Files

- `ai-workflow-generator.js`: orchestrates model resolution, OpenRouter calls, and response normalization.
- `game-context-packs.js`: versioned in-app game context packs (currently includes RuneScape 3).

## Notes

- Preferred model options are product-level aliases that resolve to an OpenRouter model chain (first available wins):
  - `gpt-5.5` (default) → `openai/gpt-5.5-pro`
  - `opus-4.8` → `anthropic/claude-opus-4.8-fast`, falling back to `anthropic/claude-opus-4.8`
- Service returns workflow drafts only. Execution still requires explicit user action in the editor.
