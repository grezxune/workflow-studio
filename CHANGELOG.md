# Changelog

All notable changes to this project are documented in this file.

## 2026-02-23
- Expanded `/prds/workflow-builder.md` with game-aware AI workflow generation requirements.
- Added hybrid game-context decision (optional selector + prompt/profile inference fallback).
- Added internal game context pack schema, security/threat model updates, and performance budgets for AI generation.
- Implemented AI workflow draft generation in the editor using OpenRouter, with game context selection and apply modes.
- Added AI settings for OpenRouter API key and model selection (`Codex 5.3` with fallback to `Codex 5.2`, or `Opus 4.6`).
- Kept OpenRouter orchestration and response normalization together in a single service file for cohesion around model fallback, prompt assembly, and JSON validation.
- Made the editor AI workflow panel collapsible from a toolbar toggle and defaulted it to collapsed to reduce workspace usage.
- macOS permission flow now avoids auto-opening System Settings on run; permission prompts are explicit and user-initiated from branded modals.
