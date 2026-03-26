# Forge

**Attention management for parallel AI coding agents.**

Run 5, 10, 20 Claude Code or Codex terminals at once. Forge tells you which one needs you right now — with live status detection, audio cues, and a heat streak that rewards your response time with escalating visual feedback.

Windows + macOS. Early preview.

## Install

[Download the latest release](https://github.com/dillionverma/forge-v2/releases) — `.exe` for Windows, `.dmg` for macOS.

## Features

**Live status detection** — Forge reads each terminal's state in real time. Working, waiting, idle — always visible.

**Heat streak** — Respond fast and the UI comes alive. Color shifts, glowing borders, rising embers. Six stages from Cold to Meltdown. Fully configurable.

**Project groups** — Organize terminals by repo or workstream. Context-switch without losing state.

**Server tabs** — Mark long-running processes (dev servers, watchers) separately from agent terminals. Forge tracks their status independently.

**Repo context + markdown editor** — Bind a repo, browse files, and edit markdown side-by-side with your terminal.

**Themes** — Multiple built-in themes, each with heat-aware color progressions.

**Audio + visual alerts** — Sound and notification cues the moment an agent needs input.

**Session state** — Tabs, groups, layout, and window position persist across restarts.

## Quick Start

1. Create a project group and bind it to a local repo.
2. Open a terminal tab and start your coding agent.
3. Forge handles the rest — status, alerts, and session state across all your terminals.

## Limitations

- Lightweight repo browsing, not a full IDE
- Onboarding still being refined
- Preview build — rough edges expected

## Build From Source

Requires Node.js, Rust, and platform build tools (MSVC on Windows, Xcode CLT on macOS).

```bash
npm install

# dev
dev.bat        # Windows
./dev.sh       # macOS

# release
release.bat    # Windows
./release.sh   # macOS
```

## Tech

Tauri v2 · React · Vite · xterm.js · Zustand · PTY via `portable-pty`

Config lives at `~/.forge/config.json`. Shell is detected per platform (PowerShell on Windows, `$SHELL` or `/bin/zsh` on macOS).

## Feedback

Testing the preview? The most useful feedback right now: install friction, first-run clarity, terminal reliability, and session recovery. Open an issue or reach out directly.
