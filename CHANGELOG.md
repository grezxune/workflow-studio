# Changelog

All notable changes to this project are documented in this file.

## 2026-03-05
- Migrated app architecture to `electron-vite` with React + TypeScript renderer entrypoint.
- Converted main-process and shared runtime modules from JavaScript to TypeScript (`src/main/**`, `src/shared/**`).
- Migrated preload bridge to TypeScript (`src/preload/index.ts`) and preserved existing IPC API surface.
- Replaced monolithic renderer compatibility layer with modular runtime chunks under `src/renderer/src/runtime/chunks/**`.
- Removed `src/renderer/legacy/**` and switched React shell boot to typed runtime loader (`src/renderer/src/runtime/bootstrap.ts`).
- Converted renderer runtime chunks to TypeScript source modules under `src/renderer/src/runtime/chunks/**`.
- Refactored runtime chunks into smaller files (app/workflows/editor/images/settings/execution/hotkeys/quick-record) loaded in deterministic order.
- Switched runtime chunk loading from URL assets to inline `?raw` source injection for stable dev/packaged execution.
- Fixed renderer startup sequencing so `initApp` and `initExecutionUI` run even when chunks load after `DOMContentLoaded`.
- Added shared button runtime component (`ui-buttons`) to normalize button icon wrappers and enforce consistent button/icon alignment.
- Fixed runtime initialization ordering by moving `initApp`/`initExecutionUI` invocation into `runtime/bootstrap.ts` after all chunks load.
- Fixed Settings workflow-directory display fallback to show `settings.workflowsDir` when direct directory lookup is unavailable.
- Hardened storage directory initialization to always normalize and create the default workflows root plus required subdirectories (`workflows`, `images`, `detections`, `templates`).
- Updated settings directory loading/browse fallback so the workflows path remains populated even if one IPC lookup fails.
- Repaired split runtime chunk boundaries that left malformed doc comments, restoring parser-safe chunk loading across settings/workflows/execution/editor helpers.
- Added renderer bridge handlers for preload-dispatched `app:navigate` and `app:action` events so native menu actions and shortcuts route to the active UI flows.
- Replaced inline runtime chunk injection with generated external runtime bundle loading (`src/renderer/public/runtime/runtime.bundle.js`) and added `gen:runtime` build/dev pipeline.
- Tightened renderer CSP to remove script `unsafe-inline` and `unsafe-eval`; scripts now load only from `self`.
- Enabled Electron renderer sandboxing (`webPreferences.sandbox = true`) while preserving context-isolated preload APIs.
- Removed preload `createRequire` usage for app version exposure, switching to bundled `package.json` import.
- Made TypeScript quality gate operational again (`bun run typecheck` now passes) by aligning TS compiler mode to bundler resolution and excluding legacy script chunks from module typechecking.
- Replaced React shell `dangerouslySetInnerHTML` rendering with parsed React nodes via `html-react-parser`.
- Added Vite/Electron build config (`electron.vite.config.ts`) and TypeScript project config (`tsconfig.json`).
- Updated package scripts and Electron Builder file inclusion to build from `out/**`.
- Removed obsolete JavaScript entrypoints (`src/main.js`, `src/preload.js`, `src/renderer.js`, and `src/renderer/js/**`).

## 2026-02-23
- Expanded `/prds/workflow-builder.md` with game-aware AI workflow generation requirements.
- Added hybrid game-context decision (optional selector + prompt/profile inference fallback).
- Added internal game context pack schema, security/threat model updates, and performance budgets for AI generation.
- Implemented AI workflow draft generation in the editor using OpenRouter, with game context selection and apply modes.
- Added AI settings for OpenRouter API key and model selection (`Codex 5.3` with fallback to `Codex 5.2`, or `Opus 4.6`).
- Kept OpenRouter orchestration and response normalization together in a single service file for cohesion around model fallback, prompt assembly, and JSON validation.
- Made the editor AI workflow panel collapsible from a toolbar toggle and defaulted it to collapsed to reduce workspace usage.
- macOS permission flow now avoids auto-opening System Settings on run; permission prompts are explicit and user-initiated from branded modals.
