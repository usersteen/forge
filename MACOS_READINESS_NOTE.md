# macOS Readiness Note

## Status

Forge does not need active macOS port work yet.

The current priority is to make the product more usable for other people on the existing Windows build. Once that UX is validated, macOS work should happen on a dedicated branch with external Mac testers.

## Goal

Target later: desktop parity on macOS for the validated Forge UX.

Non-goal for now: a full macOS implementation plan or active porting work before the Windows UX is ready for broader use.

## Why Defer

- Product and UX are still changing, so a detailed port guide would rot quickly.
- There is no local Mac test environment yet.
- The highest-risk macOS work is terminal and desktop integration behavior, which needs real tester feedback more than speculative coding.

## Known Platform Blockers

These are the main Windows-specific assumptions to revisit later:

1. Terminal shell launch
   `src-tauri/src/pty.rs` hardcodes `powershell.exe` for PTY sessions.

2. Config path handling
   `src-tauri/src/config.rs` uses `USERPROFILE` and writes to `.forge/config.json` with Windows-oriented assumptions.

3. Folder picker
   `src-tauri/src/workspace.rs` uses a PowerShell COM folder picker on Windows only.

4. Window chrome and desktop behavior
   `src/components/TabBar.jsx` and `src/App.jsx` assume desktop window controls and window geometry behavior that need validation on macOS.

## What To Validate Before Starting macOS

- New users can understand the current Forge UX without explanation.
- The Windows build feels stable enough that platform work will not be invalidated by ongoing UX changes.
- There are at least 1-3 Mac users willing to install test builds and report issues quickly.

## Later Branch Plan

When macOS work starts:

1. Create a dedicated macOS branch.
2. Isolate platform behavior in small Rust seams instead of forking the repo.
3. Produce the first tester build as early as possible.
4. Iterate on real tester failures, especially PTY behavior, shortcuts, notifications, and window interactions.

## Expected First Pass Scope

The first macOS pass should focus on:

- platform-aware shell selection
- platform-aware config/data paths
- a cross-platform folder picker
- light desktop UX cleanup where the current Windows assumptions leak through

## Reminder

The right milestone is not "finished macOS port."

The right milestone is "first external macOS build that is good enough to learn from."
