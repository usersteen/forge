# Forge - Terminal Multiplexer for Claude Code

## What is this?
A Windows desktop app (Tauri v2 + React) for managing multiple Claude Code terminal sessions.
Two-tier organization: project groups (sidebar) -> terminal tabs (top bar), each running a real terminal via xterm.js + ConPTY.

## Tech Stack
- **Backend:** Tauri v2 (Rust) — process/PTY management
- **Frontend:** React + Vite — UI components
- **Terminal:** xterm.js — renders terminal output
- **PTY:** Windows ConPTY via `portable-pty` crate
- **State:** Zustand
- **Persistence:** JSON config at `~/.forge/config.json`

## Project Structure
See FORGE_PLAN.md for full architecture and spec.

## Build Status

### Session 1: Scaffold + Terminal Foundation
- [ ] Rust installed on machine
- [ ] Tauri v2 project scaffolded with React + Vite
- [ ] PTY management (spawn, write, resize, kill) in Rust
- [ ] xterm.js terminal component connected to PTY
- [ ] Single working terminal (type commands, see output)

### Session 2: Tabs and Groups
- [ ] Zustand store for groups/tabs
- [ ] Sidebar with project groups
- [ ] Tab bar with terminal tabs
- [ ] Tab switching (keep xterm.js instances alive)

### Session 3: Status Detection + Notifications
- [ ] Parse OSC title-change sequences from PTY output to detect Claude Code status
- [ ] Two states only: "working" (Claude active) and "waiting" (needs user input)
- [ ] Visual status indicators in UI
- [ ] Native notifications + sound on "waiting" transition

### Session 4: Persistence + Polish + Build
- [ ] Config save/load
- [ ] Keyboard shortcuts
- [ ] Window position/size persistence
- [ ] Build to .exe

## Key Decisions
- Windows-only, built for personal use
- PowerShell as default shell (hardcoded is fine)
- Keep it simple — no over-engineering

## Dev Commands
```bash
npm run tauri dev    # Run in dev mode
npm run tauri build  # Build .exe
```
