# Project State (Adventure Forge - Backend)
*Auto-updated by CHATYI (SPTA Protocol)*

## Last Commit
- **Hash:** 85ccfd1
- **Message:** chore: update PROJECT_STATE.md after PR manager sync
- **Branch:** main
- **When:** 2026-02-19

## Recent Merges (Production)
- 75cab53: Merge PR #95 — Limit concurrency in batch audio and stream generation
- cd1953a: Merge PR #94 — Restore MongoDB game saves
- cc041af: Merge PR #93 — Enforce AuthGuard on AiController

## Technical Architect Findings (SPTA - 2026-02-19)
- **Build Status:** ✅ SUCCESS (npm run build — no errors)
- **Open Issues:** 30 open issues

### 🔴 New Issues Created This Session

| # | Title | Priority |
|---|-------|----------|
| #96 | [SECURITY] Body size limit 50MB (DoS vector) | P1 |
| #97 | [PERFORMANCE] Unbounded sentence-level audio concurrency in streamTurn | P1 |
| #98 | [STABILITY] Missing MongoDB connection pool + heartbeat | P1 |
| #99 | [TECH-DEBT] Duplicated sanitize() x4 in AiController | P2 |
| #100 | [TECH-DEBT] Dynamic runtime require('rxjs') in GameService | P2 |

### Existing Critical Issues
- **#91** [P0 SECURITY] Hardcoded API Keys in Test Scripts
- **#54** [P1 SECURITY] Restrict CORS origins in production
- **#92** [P1] Decompose monolithic AiService (47KB)
- **#85** [P2] Missing env var validation on startup
- **#87** [P2] Global Exception Filter missing

## Suggested Next Steps
1. **#96** Fix body size limit — 5 min fix in main.ts (P1 security)
2. **#98** Add MongoDB heartbeat config — 10 min fix in app.module.ts (P1 stability)
3. **#97** Add sentence concurrency limit in streamTurn (P1 performance)
4. **#91** Purge hardcoded keys from test scripts (P0 security)
5. **#92** Begin AiService decomposition (P1 refactor, large task)

## Technical State
- Build: ✅ SUCCESS
- Tests: Unit tests present for AiController + PromptAssemblyService
- Concurrency: Paragraphs (2) + BatchAudio (3) limited; ⚠️ Sentences still unbounded
- MongoDB: ⚠️ No heartbeat configured — connection may drop on Render idle
