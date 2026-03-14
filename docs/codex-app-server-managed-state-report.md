# Codex `app-server` Investigation for Forge

Date: 2026-03-14

Purpose: preserve the findings from investigating Codex `app-server` as a possible structured integration path for Forge, without committing to implementation now.

## Bottom Line

`codex app-server` is a real structured integration surface with explicit thread, turn, approval, and error events. It looks suitable for a managed-runtime integration if Forge ever decides terminal heuristics are not good enough.

It is not a passive observer for an existing Codex terminal session. Adopting it would mean running Codex through a different runtime path, with different process and UX behavior from the current PTY-first model.

For now, the practical conclusion is:

- Forge should remain PTY-first unless heuristics clearly hit a ceiling.
- If Forge later needs precise Codex state, `app-server` is the most credible path found.
- A future implementation should be framed as an optional managed Codex mode, not a replacement for normal terminal tabs.

## Source-Backed Facts

### Launch and transport

- The Codex CLI exposes `app-server` as `codex app-server`.
- The CLI help marks it as `[experimental]`.
- The `--listen` option supports:
  - `stdio://` as the default
  - `ws://IP:PORT`
- The upstream README states the transport is JSON-RPC over raw stdio or websocket, and specifically says stdio does not use LSP-style `Content-Length` framing.
- The upstream README also says websocket support exists but is experimental / unsupported.

Implication:

- The safest transport for Forge would be stdio.
- A Tauri backend could spawn the child process and speak JSON-RPC directly over stdin/stdout.

### Handshake and session startup

The protocol starts with:

1. client request: `initialize`
2. server response: initialize result containing `userAgent`
3. client notification: `initialized`

`initialize` includes:

- `clientInfo`
  - `name`
  - `version`
  - optional `title`
- optional `capabilities`
  - `experimentalApi`
  - `optOutNotificationMethods`

This is source-backed by the generated schemas:

- `.codex-app-server-schema/v1/InitializeParams.json`
- `.codex-app-server-schema/v1/InitializeResponse.json`
- `.codex-app-server-schema/ClientNotification.json`

### Thread and turn lifecycle

The protocol has explicit thread and turn methods.

Requests from client to server include:

- `thread/start`
- `thread/resume`
- `thread/fork`
- `thread/unsubscribe`
- `turn/start`
- `turn/interrupt`
- `turn/steer`

Key request shapes:

- `thread/start` accepts config such as `cwd`, `approvalPolicy`, `sandbox`, `model`, `modelProvider`, `baseInstructions`, `developerInstructions`, `ephemeral`.
- `turn/start` requires:
  - `threadId`
  - `input`
  - optional overrides for `cwd`, `approvalPolicy`, `sandboxPolicy`, `model`, `effort`, `summary`, `personality`, `serviceTier`, `outputSchema`

Key responses:

- `thread/start` returns resolved runtime config plus a `thread`
- `turn/start` returns a `turn`

Key notifications from server to client include:

- `thread/started`
- `thread/status/changed`
- `thread/closed`
- `turn/started`
- `turn/completed`
- `item/started`
- `item/completed`

Thread waiting state is first-class:

- `thread/status/changed` can report:
  - `notLoaded`
  - `idle`
  - `systemError`
  - `active`
- `active` can carry flags:
  - `waitingOnApproval`
  - `waitingOnUserInput`

This is materially better than PTY heuristics because the runtime can say exactly why it is waiting.

### Approval and user-input requests

The protocol includes server-initiated requests to the client for cases where Forge would need to show UI and send a decision back.

Approval-related requests:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `item/permissions/requestApproval`

User-input request:

- `item/tool/requestUserInput`

The user-input request is explicitly labeled experimental in the schema.

Examples of response semantics:

- command approval can return:
  - `accept`
  - `acceptForSession`
  - `decline`
  - `cancel`
  - policy amendment variants
- file change approval can return:
  - `accept`
  - `acceptForSession`
  - `decline`
  - `cancel`
- permissions approval returns a granted permission profile and optional scope:
  - `turn`
  - `session`
- request-user-input returns an answer map keyed by question id

This means Forge would need explicit approval and input UI if it ever adopts this runtime path.

### Errors

There are at least two structured error surfaces:

- server notification `error`
  - includes `threadId`
  - includes `turnId`
  - includes `willRetry`
  - includes a typed `TurnError`
- turn object
  - `status` can be `failed`
  - `error` is populated when the turn fails

The exposed error info includes typed categories such as:

- `contextWindowExceeded`
- `usageLimitExceeded`
- `serverOverloaded`
- `internalServerError`
- `unauthorized`
- `badRequest`
- `sandboxError`
- connection/stream failure variants with optional `httpStatusCode`

This is a much stronger basis for reliable state than terminal scraping.

### Resume and detach behavior

The protocol clearly supports resuming persisted threads:

- `thread/resume`
- `thread/read`
- `thread/list`

The resume schema says a thread can be resumed by:

1. `threadId`
2. in-memory history
3. path

with precedence `history > path > thread_id`, while recommending `threadId` when possible.

The protocol also includes:

- `thread/unsubscribe`

The upstream README states:

- when the last subscriber unsubscribes, the server unloads that thread

What is clear:

- structured resume exists
- detaching/unsubscribing is explicit

What is not fully clear from the docs reviewed:

- whether a Forge client can robustly reconnect to a still-running in-flight stdio session after client failure
- how much live resubscription behavior should be relied on for production UX

### Intended audience / interface posture

The upstream README describes `app-server` as powering rich interfaces such as the VS Code extension. That strongly suggests local IDE / app integrations are an intended use case.

At the same time:

- the CLI command is labeled experimental
- websocket transport is described as experimental / unsupported
- some protocol methods and fields are gated behind `experimentalApi`

So the interface appears public enough to use, but not stable enough to treat as frozen.

## Plausible Inferences

These are not explicitly guaranteed by the sources, but they fit the evidence.

### `app-server` is a new runtime path, not a better monitor for the current PTY flow

I did not find evidence of a supported attach/observe mode for an already-running interactive `codex` terminal session.

The likely integration model is:

- Forge launches `codex app-server`
- Forge creates and resumes threads itself
- Forge submits turns via protocol calls
- Forge renders structured events

That is materially different from monitoring a shell tab.

### A managed Codex implementation would feel different in UX

Because approvals and input are explicit JSON-RPC requests, a future Forge integration would naturally become:

- a transcript or event-log pane
- a prompt composer
- approval cards or modal sheets
- precise status indicators

rather than:

- a raw terminal tab where the user types into the shell whenever needed

This mismatch is the biggest reason not to adopt it casually.

### The safest prototype shape is one app-server process per managed Codex tab

A shared server with many threads is likely possible, but one process per tab is simpler for:

- event routing
- cleanup
- crash isolation
- tab lifecycle mapping

That would be the least risky prototype if Forge ever revisits this.

## Unknowns

These remain unresolved from the official code/docs inspected.

- There is no clear long-term compatibility promise for third-party clients.
- I did not find a formal versioning or deprecation guarantee beyond the existence of `v1` and `v2` schemas plus experimental gating.
- I did not find a documented passive observer mode for the existing terminal CLI UX.
- I did not verify how resilient reconnect is after client or transport failure during an active turn.
- I did not verify whether all event ordering semantics are guaranteed strongly enough for a production reducer without additional empirical testing.

## Forge-Specific Implications

## Current Forge architecture

Forge today is PTY-first.

Frontend:

- `src/components/Terminal.jsx` owns xterm rendering and current Codex heuristics.
- Codex state is inferred from:
  - bell bytes
  - bell events
  - recent output text
  - typed commands and replies
- `src/components/TerminalArea.jsx` assumes tab bodies are terminal instances.
- `src/store/useForgeStore.js` keeps tab type, status, and name, but not structured agent state.

Backend:

- `src-tauri/src/pty.rs` spawns `powershell.exe` PTYs and streams raw output events back to the frontend.

This means Forge does not currently have a generic “managed agent runtime” abstraction.

### What would need to change for managed Codex

If implemented later, Forge would likely need:

- a new backend runtime adapter in Tauri
  - spawn `codex app-server`
  - read and write JSON-RPC
  - correlate request ids
  - maintain thread and turn ids
  - surface typed events to the frontend
- a new frontend runtime mode
  - not just xterm
  - likely transcript + composer + approvals
- process lifecycle changes
  - managed child process startup
  - graceful shutdown / unsubscribe
  - resume support if desired
- more detailed state in the store
  - thread id
  - active turn id
  - waiting reason
  - pending server requests
  - approval queue

### Reuse vs new tab type

The existing tab chrome can probably be reused:

- tabs
- active/inactive behavior
- status dots
- notifications

The actual tab body should probably not reuse the current terminal component for a managed implementation.

Best later option:

- keep normal terminal tabs
- add a distinct optional managed Codex tab/runtime

That preserves the current lightweight workflow instead of forcing all Codex use into a heavier interface.

## UI / UX Implications

This is the main product concern.

### What managed Codex would feel like

Likely traits:

- more precise
- more explicit
- less “just a terminal”
- more similar to an IDE chat/agent panel

Likely visible elements:

- prompt composer instead of shell prompt
- event log or transcript
- precise state chip
  - working
  - waiting for approval
  - waiting for input
  - failed
- approval card or sheet
  - command preview
  - file change approval
  - permission grants
- optional per-turn artifacts
  - plan updates
  - file/output deltas

### Why that may be undesirable right now

Forge’s current appeal is that tabs are lightweight shell surfaces.

Moving only Codex into a structured managed UI would create asymmetry versus Claude:

- Codex would feel like a managed agent
- Claude would still feel like a terminal

That may be acceptable eventually, but it is a real product cost.

### Product guidance for later

If Forge ever adopts this:

- do not replace PTY tabs wholesale
- ship it as an optional managed Codex mode
- reuse the same tab chrome and status model where possible
- avoid a giant special-case screen if a compact agent pane will do

## Recommended Minimal Prototype Plan

If this is revisited later, the least risky prototype would be:

1. Add a new optional runtime kind, for example `codex-app`, without touching the default PTY flow.
2. In Tauri, spawn `codex app-server --listen stdio://`.
3. Perform handshake:
   - `initialize`
   - `initialized`
4. Start a thread with `thread/start`.
5. Submit prompts with `turn/start`.
6. Support only stable monitoring-critical events first:
   - `thread/status/changed`
   - `turn/started`
   - `item/started`
   - `item/completed`
   - `item/commandExecution/outputDelta`
   - `item/fileChange/outputDelta`
   - `turn/completed`
   - `error`
   - `serverRequest/resolved`
7. Implement only the minimum response UI:
   - command approval
   - file change approval
   - permissions approval
8. Delay experimental `item/tool/requestUserInput` until the core flow proves worthwhile.
9. Keep process lifetime tied to tab lifetime in v1.
10. Add `thread/resume` only if the managed mode proves valuable enough to justify persistence complexity.

## Recommendation for Current Product Direction

Given Forge’s current strengths and the actual problem observed so far, the better immediate path is still heuristic improvement in PTY tabs rather than managed Codex runtime work.

Reason:

- the main issue appears to be readiness detection reliability
- not a total inability to interact with Codex through the terminal
- managed runtime would solve precision, but at significant UI/UX cost

Therefore:

- keep PTY as the default model
- improve heuristics first
- retain this document as the structured fallback path if heuristics later prove insufficient

## Evidence References

Official upstream sources:

- Codex app-server README:
  - https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md
- Codex app-server transport source:
  - https://github.com/openai/codex/blob/main/codex-rs/app-server/src/transport.rs

Local generated protocol evidence from installed `codex-cli 0.114.0`:

- `.codex-app-server-schema/ClientRequest.json`
- `.codex-app-server-schema/ServerRequest.json`
- `.codex-app-server-schema/ServerNotification.json`
- `.codex-app-server-schema/v1/InitializeParams.json`
- `.codex-app-server-schema/v1/InitializeResponse.json`
- `.codex-app-server-schema/v2/ThreadStartParams.json`
- `.codex-app-server-schema/v2/ThreadStartResponse.json`
- `.codex-app-server-schema/v2/ThreadResumeParams.json`
- `.codex-app-server-schema/v2/ThreadResumeResponse.json`
- `.codex-app-server-schema/v2/ThreadStatusChangedNotification.json`
- `.codex-app-server-schema/v2/TurnStartParams.json`
- `.codex-app-server-schema/v2/TurnStartResponse.json`
- `.codex-app-server-schema/v2/TurnStartedNotification.json`
- `.codex-app-server-schema/v2/TurnCompletedNotification.json`
- `.codex-app-server-schema/v2/ErrorNotification.json`
- `.codex-app-server-schema/CommandExecutionRequestApprovalParams.json`
- `.codex-app-server-schema/CommandExecutionRequestApprovalResponse.json`
- `.codex-app-server-schema/FileChangeRequestApprovalParams.json`
- `.codex-app-server-schema/FileChangeRequestApprovalResponse.json`
- `.codex-app-server-schema/PermissionsRequestApprovalParams.json`
- `.codex-app-server-schema/PermissionsRequestApprovalResponse.json`
- `.codex-app-server-schema/ToolRequestUserInputParams.json`
- `.codex-app-server-schema/ToolRequestUserInputResponse.json`

Forge architecture references used for integration assessment:

- `src/components/Terminal.jsx`
- `src/components/TerminalArea.jsx`
- `src/store/useForgeStore.js`
- `src/utils/statusDetection.js`
- `src-tauri/src/pty.rs`

## Practical Summary

If Forge ever needs high-confidence Codex monitoring and richer integration, `app-server` is the strongest path found.

If Forge wants to preserve its lightweight terminal-first character, it should stay PTY-first and treat managed Codex as an optional future mode rather than the new default.
