# Nocturne — Permanent Agent Instructions

These instructions apply to every AI agent, model, swarm worker, and coding session working on Nocturne.

## 1. Repository & Legal Boundaries
- **Preserve Reference Repositories:** Never modify, delete, or write to external reference repositories. Keep all new development inside this repository.
- **Authorized Sources Only:** Do not bypass DRM, authentication, ads, or access restrictions. Preserve Apache 2.0 attribution to Monochrome.
- **No Unnecessary Paid APIs / Cloud:** Keep the app local-first, free to run, Windows 10/11 compatible.
- **Version Control:** Do not commit or push without explicit user permission. Never perform destructive Git operations. Preserve lockfiles. Never expose credentials or secrets.

## 2. Recovery Protocol (Start of Every Session)
1. Read `AGENTS.md`, `docs/development/CURRENT_STATE.md`, `docs/development/TASKS.md`, and `docs/development/PROJECT_HANDOFF.md`.
2. Inspect relevant worker checkpoints under `docs/checkpoints/`.
3. Verify actual filesystem / `npx tsc --noEmit` / git status against documentation.
4. Complete or repair any `IN_PROGRESS` task before starting unrelated work.

## 3. Atomic Task Workflow
- **Before Implementation:** Update `docs/development/CURRENT_STATE.md` with task ID, objective, expected files, approach, dependencies, verification commands, and recovery instructions. Mark task `IN_PROGRESS` in `docs/development/TASKS.md`.
- **During Implementation:** Write changes to disk immediately in small checkpoints. Update `docs/development/CURRENT_STATE.md` at major subtasks. Record errors in `docs/development/KNOWN_ISSUES.md`.
- **After Implementation:**
  1. Save all modified files.
  2. Run validation (`npx tsc --noEmit`, `npm run build`, or runtime/unit checks) and record actual observed results.
  3. Update `docs/development/TASKS.md` (`IMPLEMENTED` vs `VERIFIED` — never mark untested features `VERIFIED`).
  4. Append a concise entry to `docs/development/PROGRESS_LOG.md`.
  5. Update `docs/development/CURRENT_STATE.md` and `docs/development/PROJECT_HANDOFF.md` if architecture/state changed.
  6. Proceed directly to the next task autonomously.

## 4. Swarm Coordination Rules
- Assign each worker a unique task ID and non-overlapping file ownership scope.
- Workers must write their own checkpoint to `docs/checkpoints/<worker-name>.md` before completing or switching tasks.
- Only the main orchestrator (`coordinator`) updates global `docs/development/TASKS.md`, `docs/development/CURRENT_STATE.md`, `docs/development/PROGRESS_LOG.md`, and `docs/development/PROJECT_HANDOFF.md`.

## 5. Quality & Accuracy Rules
- Do not claim untested features are working.
- Target 60 FPS for visualizations; dispose of animation frames, audio nodes, and listeners on unmount.
- Keep `contextIsolation: true` and `nodeIntegration: false` in Electron; expose only explicit IPC methods via `electron/preload.ts`.
