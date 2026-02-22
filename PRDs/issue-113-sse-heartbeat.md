# PRD: SSE Stream Heartbeat for Resilience

## Context
Adventure Forge experiences intermittent "infinite loading" bugs (Issue #162) on the frontend. The root cause is a race condition where the frontend waits for specific SSE events (like `text_structure` or `image_url`) that may never arrive if the AI provider stalls or the connection hangs without error.

## Objective
Implement a server-side heartbeat mechanism in the SSE stream to keep the connection alive and provide the frontend with a signal that the backend is still processing.

## Scope
- Modify `PromptAssemblyService` in the backend.
- Inject a `heartbeat` event every 5 seconds into the SSE stream.
- Ensure heartbeat events do not interfere with the narrative or JSON parsing on the frontend.
- Provide a clear architectural pattern for stream resilience.

## Acceptance Criteria
- [ ] SSE stream emits a `{"type": "heartbeat", "timestamp": "..."}` event every 5 seconds.
- [ ] Heartbeat continues even if AI generation is slow.
- [ ] Stream closure (complete or error) correctly stops the heartbeat.
- [ ] No regression in narrative text or image delivery.

## Technical Notes
- Use `rxjs` intervals merged with the main stream.
- Update `PromptAssemblyService.assembleStream` to include the heartbeat logic.
- Target Issue: Backend #113 (fixes Frontend #162).
