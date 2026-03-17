# Forge

Forge is a Windows desktop control room for multiple AI coding terminals.

It is built for workflows where you have several Claude Code or Codex-style terminal sessions running across different projects and need one place to monitor status, switch context, and pull in repo files without losing terminal state.

## Status

Forge is an early preview.

- Windows-first
- built with Tauri + React
- focused on terminal-first multi-agent workflows
- still being hardened for external testers

## Install

The intended install path for most people is:

1. Open the repo's `Releases` page on GitHub.
2. Download the latest Windows installer.
3. Install Forge like a normal desktop app.

If you are just trying Forge, use the installer release instead of building from source.

## What Forge Does

- runs real PTY-backed terminal tabs inside a desktop app
- organizes work into project groups
- detects working / waiting terminal states for Claude Code and Codex-style flows
- persists project, tab, and window state across restarts
- lets you bind a local repository and browse lightweight file context inside the app
- supports side-by-side terminal and document reading

## First Run

The current core loop is:

1. Create or select a project group.
2. Bind that group to a local repository.
3. Open or resume a terminal tab.
4. Start your coding agent in that terminal.
5. Use Forge to monitor which terminal is active, waiting, or idle.

## Current Limitations

- Windows-focused for now
- repo browsing is intentionally lightweight, not a full IDE
- first-run onboarding is still being refined
- broader release hardening is still in progress

## Build From Source

### Prerequisites

- Node.js
- Rust
- Tauri prerequisites for Windows
- Visual Studio C++ build tools

### Install dependencies

```bash
npm install
```

### Run in dev mode

```bash
dev.bat
```

### Build a local production package

```bash
build.bat
```

### Build a release package

```bash
release.bat
```

Project notes currently expect release artifacts under:

- `~/.forge-build/target/release/bundle/nsis/`
- `~/.forge-build/target/release/bundle/msi/`

## Tech Stack

- Tauri v2
- React
- Vite
- xterm.js
- Zustand
- Windows ConPTY via `portable-pty`

## Notes

- default shell behavior is currently Windows-oriented
- persisted config is stored at `~/.forge/config.json`
- Forge is being prepared for small-batch external testing before any broader open-source push

## Feedback

Early feedback is most useful in these areas:

- install friction
- first-run clarity
- repo binding problems
- terminal reliability
- session recovery after restart
