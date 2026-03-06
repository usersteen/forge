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
- [x] Rust installed on machine
- [x] Tauri v2 project scaffolded with React + Vite
- [x] PTY management (spawn, write, resize, kill) in Rust
- [x] xterm.js terminal component connected to PTY
- [x] Single working terminal (type commands, see output)

### Session 2: Tabs and Groups
- [x] Zustand store for groups/tabs
- [x] Sidebar with project groups
- [x] Tab bar with terminal tabs
- [x] Tab switching (keep xterm.js instances alive)
- [x] Keyboard shortcuts (Ctrl+Tab/Shift+Tab, Ctrl+PageUp/Down)
- [x] Status bar, inline rename (double-click)

### Session 3: Status Detection + Notifications + Tab Types + DnD
- [x] Parse OSC title-change sequences from PTY output to detect Claude Code status
- [x] Two states: "working" (Claude active) and "waiting" (needs user input)
- [x] Visual status indicators (colored dots, glowing pulse for "waiting")
- [x] Native notifications + synthesized sound on "waiting" transition
- [x] Server tab type (right-click context menu to toggle, blue/red dots)
- [x] PTY exit event from Rust for server tab "exited" detection
- [x] Drag-to-reorder tabs and sidebar groups via @dnd-kit
- [x] Status summary in sidebar (waiting/working counts, priority border color)
- [x] Removed status bar (redundant with sidebar/tab indicators)

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
dev.bat              # Run in dev mode (sets up MSVC env)
npm run tauri build  # Build .exe
```

## Build Notes
- Must run via `dev.bat` (or VS Developer Command Prompt) because Git Bash's `link` shadows MSVC's `link.exe`
- Windows SDK 10.0.18362.0 required for linking
- Vite 6 (not 7) due to Node 20 compatibility
