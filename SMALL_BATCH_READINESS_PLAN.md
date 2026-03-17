# Forge Small-Batch Readiness Plan

## Goal

Get Forge ready for a small batch of external testers.

This is not a full open-source launch. It is a controlled step toward that:

- public GitHub repo is acceptable if the repo is understandable and safe to share
- distribution should optimize for easy install, not source builds
- scope should stay Windows-first until real external usage is validated

## Recovered Context

The repo already preserves the main product direction:

- `FORGE_ROADMAP.md` says the next priority is making setup feel real, especially project binding and first-run clarity
- `HANDOFF.md` says the current repo browser works, but is still dense and needs calmer hierarchy
- `MACOS_READINESS_NOTE.md` says not to spread effort into macOS yet; validate the Windows experience first
- `CLAUDE.md` shows the current release path is installer-oriented, not source-install-oriented

That points to a clear interpretation:

Forge is close to "share with a few people" if the next pass focuses on onboarding, documentation, and reliability instead of new product surface.

## Current Gaps

These are the highest-signal gaps for external testers right now:

1. No `README.md`
- A public repo without a README will feel unfinished and confusing.
- Testers will not know whether they should install a build, clone the repo, or run it from source.

2. First-run setup is functional but not productized
- A new group starts unbound.
- The app already supports repo binding and a native folder picker, but the first-run path is still closer to an internal tool than an external product.

3. Windows distribution path is implicit
- The repo already has `build.bat` and `release.bat`.
- The likely tester path should be a packaged Windows installer from GitHub Releases, not "clone and run build."

4. Reliability work is partially identified but not yet packaged into a release checklist
- broken path recovery
- PTY lifecycle resilience
- config persistence safety
- filesystem/terminal error clarity
- security posture such as CSP and scoped file access language

## Recommended Tester Distribution

For a small batch, do this:

1. Keep the repo Windows-first.
2. Publish a GitHub Release with the installer artifacts produced by `release.bat`.
3. Tell testers to install the app from Releases.
4. Keep "build from source" as a secondary README section for technical users only.

Do not make first-wave testers build with Rust, Tauri, Node, and Visual Studio unless they explicitly want to.

## Recommended README Shape

The README only needs to answer the practical questions a first external visitor will have.

Suggested structure:

1. What Forge is
- "A Windows desktop control room for multiple AI coding terminals."

2. Current status
- preview / early access
- Windows-first
- optimized for Claude Code and Codex-style terminal workflows

3. Install
- primary path: download installer from GitHub Releases
- note that source build is optional

4. First-run
- open Forge
- bind a repository
- open a terminal tab
- start Claude Code or Codex in that terminal
- use status indicators to monitor attention

5. Build from source
- prerequisites
- `npm install`
- dev command
- build command

6. Known limitations
- Windows-only for now
- repo browsing is intentionally lightweight
- product is still being hardened for broader use

7. Feedback
- where testers should report friction and bugs

## Recommended Onboarding Pass

The app does not need a heavy tutorial. It needs a clear first-run state.

Best next move:

1. Add a first-run empty state or welcome modal when the active project has no bound repo.
2. Make the primary action "Choose Repository."
3. Explain the first loop in one sentence:
- bind a repo, open a terminal, run your coding agent, return when Forge marks attention
4. After first bind, keep the existing repo trigger and "Change Path" flow as secondary controls.

The modal can be skipped entirely after the first successful bind. A persistent empty state is also acceptable if it feels calmer than a modal.

## Hardening Work Before External Testers

Keep this list short and release-oriented.

### Must do

- add a clear README
- verify installer build flow end to end
- handle missing or invalid repo paths gracefully on relaunch
- improve visible error messages for repo scan and terminal failures
- define the product as Windows-first in docs and release notes

### Strongly recommended

- add a basic first-run onboarding state
- make config writes crash-safe if they are not already
- add at least one smoke pass for bind repo -> open terminal -> restart -> recover state
- enable a sane CSP instead of `null` before broader sharing

### Can wait

- macOS work
- deeper IDE-style editing
- broad open-source contributor setup
- advanced repo intelligence beyond quick retrieval

## Public Repo Minimum

Before switching the repo public, check:

- no secrets or personal tokens are committed
- README exists
- release/install path is documented
- known limitations are explicit
- any personal/internal notes that should stay private are removed or rewritten

This repo scan did not show obvious committed secrets, but it is still worth doing a manual publication pass.

## Suggested Sequence

### Phase 1: Make It Understandable

- write `README.md`
- decide the exact tester install path
- add a short release note template

Success condition:
- a new visitor knows what Forge is and how to install it in under two minutes

### Phase 2: Make First Run Feel Intentional

- add onboarding empty state or welcome modal
- make folder selection the primary CTA
- reduce raw-path/power-user feel during first bind

Success condition:
- a tester can reach a working repo-bound session without outside explanation

### Phase 3: Harden The Core Loop

- verify PTY/session recovery behavior
- verify root-path recovery and error messaging
- run release smoke tests on a clean-ish machine

Success condition:
- the core loop feels dependable for day-to-day trial use

### Phase 4: Share With 3-5 Testers

- publish the repo
- publish a Windows installer release
- collect friction reports specifically on setup, first-run comprehension, and failure cases

Success condition:
- testers can install, bind a repo, and run real sessions without live hand-holding

## Immediate Recommendation

If only one pass happens next, it should combine:

- `README.md`
- a simple first-run onboarding state
- one release-candidate smoke test using the installer flow

That is the shortest path from "promising internal tool" to "safe to hand to a few people."
