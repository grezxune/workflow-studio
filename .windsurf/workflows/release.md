---
description: How to release a new version of Workflow Studio
---

# Release Guide

## 1. Bump the version in `package.json`

Update the `"version"` field following semver:
- **Patch** (1.3.1 → 1.3.2): Bug fixes only
- **Minor** (1.3.2 → 1.4.0): New features, backward-compatible
- **Major** (1.4.0 → 2.0.0): Breaking changes

// turbo
## 2. Commit and push all changes

```
git add -A
git commit -m "chore: bump version to <VERSION>"
git push
```

If there are feature/fix commits to include, commit those first with descriptive messages, then push everything together.

// turbo
## 3. Build the Windows installer

```
npm run build:win
```

This produces three files in the `dist/` folder:
- `Workflow Studio Setup <VERSION>.exe` — the installer
- `Workflow Studio Setup <VERSION>.exe.blockmap` — delta update map
- `latest.yml` — auto-update metadata

Wait for the build to complete successfully before proceeding.

## 4. Create a GitHub release with `gh`

```
gh release create v<VERSION> "dist\Workflow Studio Setup <VERSION>.exe" "dist\Workflow Studio Setup <VERSION>.exe.blockmap" "dist\latest.yml" --repo grezxune/workflow-studio --title "Workflow Studio v<VERSION>" --notes "<RELEASE_NOTES>"
```

Replace `<VERSION>` with the version number (e.g. `1.4.0`) and `<RELEASE_NOTES>` with markdown release notes.

### Release notes template

```markdown
## Workflow Studio v<VERSION>

### New Features
- **Feature name** — Short description

### Bug Fixes
- **Fix description** — What was wrong and what changed

### Download
Download and run **Workflow Studio Setup <VERSION>.exe** to install or update on Windows.
```

## 5. Verify the release

- Visit https://github.com/grezxune/workflow-studio/releases to confirm the release is published
- The three assets (`.exe`, `.blockmap`, `latest.yml`) should all be attached
- Existing users will receive the update automatically via `electron-updater` (checks `latest.yml`)
- Users can also manually check via **Settings → About & Updates → Check for Updates**

## Notes

- Always upload all three files (`exe`, `blockmap`, `latest.yml`) — the auto-updater needs all of them
- The `gh` CLI must be authenticated (`gh auth login`) before creating releases
- If you need to refresh the PATH to find `gh`, prefix the command with:
  ```
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  ```
