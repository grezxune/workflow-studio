# AI Workflow Generation Service

This folder contains the OpenRouter-backed workflow generation service used by the editor AI composer.

## Files

- `ai-workflow-generator.js`: orchestrates model resolution, OpenRouter calls, and response normalization.
- `game-context-packs.js`: versioned in-app game context packs (currently includes RuneScape 3).

## Notes

- Preferred model options are product-level aliases:
  - `codex-5.3` (falls back to `openai/gpt-5.2-codex` if 5.3 is unavailable on OpenRouter)
  - `opus-4.6`
- Service returns workflow drafts only. Execution still requires explicit user action in the editor.
