name: "PRP-sse-heartbeat-phase-1"
description: "Implement SSE Heartbeat for Stream Resilience in adventure-forge-api"

## Goal
Add a heartbeat mechanism to the SSE stream in `PromptAssemblyService` to prevent frontend timeouts and infinite loading states.

## Why
- Fixes #162 (Frontend infinite loading) and #113 (Backend SSE resilience).
- Provides a keep-alive signal for long-running AI generations.
- Prevents browsers and proxies from killing idle connections.

## What
- Inject a `heartbeat` event every 5 seconds.
- Format: `{"type": "heartbeat", "timestamp": "ISO-string"}`.
- Heartbeat must stop when the AI stream ends or errors.

### Success Criteria
- [ ] SSE stream emits a `heartbeat` event every 5 seconds.
- [ ] Heartbeat events are valid JSON.
- [ ] Real AI events (text, image, audio) are interleaved correctly.
- [ ] Connection closes properly at the end of the narrative.

## All Needed Context

### Documentation & References
```yaml
- file: src/ai/prompt-assembly.service.ts
  why: Main service where SSE stream is assembled.
- file: src/ai/ai.controller.ts
  why: Endpoint that consumes the stream.
```

### Environment Check
```yaml
project_type: NestJS / TypeScript
test_command: npm test
lint_command: npm run lint
build_command: npm run build
```

## Implementation Blueprint

### list of tasks

```yaml
Task 1:
MODIFY src/ai/prompt-assembly.service.ts:
  - Import `interval`, `map`, `merge`, `takeUntil` from 'rxjs'.
  - Modify `assembleStream` method.
  - Create a `heartbeat$` observable that emits every 5 seconds.
  - Use `merge` to combine the AI event stream with the heartbeat stream.
  - Ensure the heartbeat stream completes when the main stream completes.

Task 2:
UPDATE tests (if existing):
  - Add a test case to verify heartbeat events are present in the stream.
```

### Pseudocode
```typescript
// Task 1: assembleStream logic
const heartbeat$ = interval(5000).pipe(
  map(() => ({ type: 'heartbeat', timestamp: new Date().toISOString() })),
  takeUntil(mainStreamCompleted$) // Critical: stop when main stream ends
);

return merge(aiStream$, heartbeat$);
```

## Validation Loop

### Level 1: Syntax & Style
```bash
npm run lint
npm run build
```

### Level 2: Unit Tests
```bash
npm test
```

### Level 3: Manual Integration (Mock)
- Trigger a stream via a tool or curl and observe the raw output for 10-15 seconds.
- Look for `event: message` followed by the heartbeat JSON.
