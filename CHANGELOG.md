# Changelog

All notable changes to this project are documented in this file.

## Unreleased

## 2026-03-10
- Fixed Electron sandboxed preload loading by emitting CommonJS preload bundles (`.cjs`) instead of ESM (`.mjs`), restoring `workflowAPI`/`overlayAPI` bridge availability in renderer windows.
- Fixed a dev-startup crash where unreadable or legacy-encrypted Electron settings files caused the main process to abort before the app window appeared.
- Added automatic quarantine-and-recreate recovery for invalid `electron-store` config files during boot.
- Replaced manual `WORKFLOW_STUDIO_STORE_KEY` setup with automatic OS-backed encryption-key provisioning for the local settings store.

## 2026-03-06
- Added centralized BrowserWindow hardening (`src/main/lib/window-security.ts`) to deny untrusted navigation, block `window.open`, and block webview attachment.
- Added safe external URL policy (`http/https` only) and routed app external link opens through guarded helper logic.
- Added centralized IPC sender guard utilities (`src/main/lib/ipc-guard.ts`) and applied them to shared IPC and updater handlers.
- Enforced sender validation for overlay event channels in `region-selector`, `quick-record`, `floating-bar`, and `workflow-preview` services.
- Made overlay IPC registration idempotent by clearing prior listeners/handlers before re-registration.
- Strengthened preload architecture by importing shared IPC channel constants directly instead of duplicating channel maps.
- Added unit tests for window-security URL rules and IPC sender guard behavior.
- Added first-class lint/format tooling setup (`eslint.config.mjs`, Prettier config) and changed `lint` script to run ESLint + TypeScript checks.
- Added CSP meta tags to auxiliary renderer HTML pages to explicitly constrain script/style/image sources.
- Expanded strict typecheck scope to include new security libraries.

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
- Added dedicated secure overlay preload bridge (`src/preload/overlay.ts`) and switched all auxiliary windows to `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
- Removed direct `require('electron')` usage from overlay HTML pages and migrated to preload-exposed `window.overlayAPI`.
- Hardened `workflow-preview` label rendering to avoid unsafe `innerHTML` interpolation for workflow-controlled text.
- Added IPC sender binding and payload validation helpers in `src/main/ipc/index.ts`, then applied validation across workflow/execution/settings/detection/template/hotkey routes.
- Added update IPC sender validation in `src/main/services/auto-updater.ts`.
- Added safe filesystem path guards (`src/main/lib/safe-path.ts`) and enforced them in `StorageService` for workflows/templates/images.
- Updated runtime bundle generation to transpile TypeScript chunks to JavaScript and fail fast on invalid generated output.
- Hardened renderer toast rendering to use DOM text assignment instead of HTML interpolation for dynamic strings.
- Added quality gates: `lint`, `test`, `test:unit`, `test:integration`, and `typecheck:strict` scripts plus new unit/integration tests under `tests/`.
- Added PRD `prds/electron-security-hardening.md` to document security hardening scope, threat model, and rollout plan.

## 2026-02-23
- Expanded `/prds/workflow-builder.md` with game-aware AI workflow generation requirements.
- Added hybrid game-context decision (optional selector + prompt/profile inference fallback).
- Added internal game context pack schema, security/threat model updates, and performance budgets for AI generation.
- Implemented AI workflow draft generation in the editor using OpenRouter, with game context selection and apply modes.
- Added AI settings for OpenRouter API key and model selection (`Codex 5.3` with fallback to `Codex 5.2`, or `Opus 4.6`).
- Kept OpenRouter orchestration and response normalization together in a single service file for cohesion around model fallback, prompt assembly, and JSON validation.
- Made the editor AI workflow panel collapsible from a toolbar toggle and defaulted it to collapsed to reduce workspace usage.
- macOS permission flow now avoids auto-opening System Settings on run; permission prompts are explicit and user-initiated from branded modals.
