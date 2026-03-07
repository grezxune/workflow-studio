---
title: Electron Security and Runtime Hardening
created: 2026-03-05
owner: Tommy
log:
  - 2026-03-05: Initial requirements documented for Electron security, IPC validation, and runtime hardening.
  - 2026-03-05: Implemented overlay preload isolation, IPC sender/payload validation, path safety guards, and test gates.
  - 2026-03-06: Added browser-window navigation hardening, centralized IPC sender guard library, overlay IPC sender enforcement, and formal lint/format tooling gates.
---

## Problem
The app had multiple architecture and security risks that prevented a production-grade Electron posture:
- Auxiliary windows allowed Node integration with disabled context isolation.
- IPC handlers accepted unvalidated payloads from renderer.
- Filesystem IDs were used directly in file paths.
- Runtime bundle generation concatenated raw TypeScript into JavaScript output.
- Renderer toast path allowed unescaped user-controlled strings.
- No test scripts existed to protect these boundaries.

## Business Context
Workflow Studio automates user interaction at OS level. Any compromised renderer state can cause sensitive actions (keyboard/mouse automation, file access, and execution control). Security regressions here create outsized trust and support risk.

## Goals & KPIs
- Eliminate Node exposure in non-main renderer windows.
- Enforce sender and payload checks on privileged IPC routes.
- Block path traversal in storage path construction.
- Guarantee runtime bundle generation emits valid executable JS.
- Add minimum quality gates with runnable unit + integration tests.

KPIs:
- `rg "nodeIntegration: true|contextIsolation: false" src/main` returns zero matches.
- `bun run typecheck` passes.
- `bun run test` passes.
- `bun run gen:runtime` fails fast if bundle output is invalid.

## Personas/Journeys
- End user running automations with multi-window tooling overlays.
- Maintainer shipping releases through Electron Builder.
- Developer modifying runtime chunks and IPC surfaces.

## Functional Requirements
1. Auxiliary windows must run with preload bridge only (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).
2. Overlay windows must use a narrow bridge API with explicit channel mapping.
3. IPC invoke handlers in `src/main/ipc/index.ts` must reject non-main-window senders.
4. Sensitive IPC payloads must be type-checked before use.
5. Storage path resolution must reject unsafe IDs and enforce in-root resolution.
6. Runtime generator must transpile TS chunk files before emit and validate generated JS parseability.
7. Renderer toast rendering must treat title/message as text, not HTML.
8. Repo must expose test scripts and include at least one unit and one integration test for new guardrails.
9. Every BrowserWindow must deny untrusted navigation and `window.open` requests by default.
10. Overlay event-channel IPC (`ipcMain.on`) must enforce sender identity, not just invoke-channel IPC (`ipcMain.handle`).
11. Security rules for trusted renderer URLs and external URLs must be unit-tested.
12. Linting must run as a first-class gate (not an alias of typecheck).

## Non-functional Requirements
- Keep behavior backwards compatible for expected workflow operations.
- Avoid runtime performance regression in automation execution loop.
- Preserve cross-platform compatibility (macOS/Windows/Linux builds).

## Data & Integrations
- Electron IPC between main and renderer.
- Local filesystem storage for workflows/templates/images.
- Electron Updater IPC events.

## Security Architecture & Threat Model
Trust boundaries:
- Renderer content is not trusted for privileged actions.
- Main process is trusted authority for file IO and execution.
- Overlay windows are untrusted display surfaces unless bridged via preload.

Primary abuse cases:
- XSS in renderer triggers privileged IPC calls.
- Overlay HTML with Node integration executes arbitrary code.
- Path traversal reads/writes outside app data root.
- Malformed IPC payload crashes services or bypasses assumptions.

Mitigations:
- Disable Node integration and enable context isolation/sandbox in overlays.
- Introduce dedicated overlay preload API with minimal methods.
- Add sender binding (`event.sender === mainWindow.webContents`) for invoke handlers.
- Add payload guards for string/object/number/boolean/workflow-like data.
- Add safe-path checks (`assertSafeFileId`, `resolvePathWithin`).
- Replace direct toast HTML interpolation with DOM text assignment.
- Add centralized BrowserWindow hardening (`setWindowOpenHandler`, `will-navigate`, `will-attach-webview`) and safe external URL policy.
- Add reusable sender guard primitives for all IPC patterns (`handle`, `on`, overlay channels).

## Performance Strategy & Budgets
Budgets:
- IPC validation overhead should remain negligible (<1ms per call in typical payload sizes).
- Runtime generation can add transpilation cost during build/dev startup, but should stay under 1s for current chunk count on developer hardware.

Strategy:
- Keep validation logic synchronous and lightweight.
- Validate generated bundle syntax once during `gen:runtime`, not per app request.

## Open Questions
- Whether to migrate remaining runtime chunk string-templating paths to fully DOM-based rendering.
- Whether to split `ipc/index.ts` into domain modules with formal schemas.
- Whether to move overlay pages from inline scripts to bundled module scripts so CSP can drop script `unsafe-inline`.

## Risks & Mitigations
- Risk: Stricter ID validation may reject previously accepted unsafe filenames.
  - Mitigation: Restrict only path separators/traversal/null, keep general text support.
- Risk: Sender restrictions may block future non-main renderer clients.
  - Mitigation: Add explicit allowlist only when a legitimate second caller is introduced.

## Success Metrics
- Security grep checks remain clean after release.
- No regression in core workflow execution and hotkeys.
- CI/local checks catch invalid runtime chunk output before packaging.
- Unauthorized overlay IPC senders cannot trigger action channels.
- Main window blocks arbitrary navigation and new-window creation attempts.

## Rollout Plan
1. Ship hardening in next patch release.
2. Run manual smoke pass for workflows, hotkeys, overlays, and updates.
3. Monitor crash/error logs for IPC validation failures to detect unintended client payloads.

## Next Steps
1. Add schema-based validators (zod/io-ts) for deeper nested payload contracts.
2. Migrate high-risk `innerHTML` usage paths to safer DOM construction.
3. Move overlay HTML pages to external module scripts and tighten CSP to remove script `unsafe-inline`.
4. Split `src/main/ipc/index.ts` by domain to reduce file size and increase auditability.
