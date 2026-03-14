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
- [x] Config save/load (`~/.forge/config.json` via Rust commands)
- [x] Keyboard shortcuts (Ctrl+1-9 jump to tab N)
- [x] Window position/size persistence (restore on startup)
- [x] CWD persistence per tab (passed to PTY spawn)
- [x] Debounced auto-save + save on close
- [x] Build to .exe

## Key Decisions
- Windows-only, built for personal use
- PowerShell as default shell (hardcoded is fine)
- Keep it simple — no over-engineering

## Dev Commands
```bash
dev.bat              # Run in dev mode (sets up MSVC env)
npx tauri build      # Build .exe (run from Git Bash, no vcvarsall needed)
```

## Build Notes
- Build with `npx tauri build` directly from Git Bash — no need for `dev.bat` or Developer Command Prompt
- Build target is at `~/.forge-build/target` (moved outside OneDrive to prevent Explorer freezing)
- Installers output to `~/.forge-build/target/release/bundle/nsis/` and `.../msi/`
- Version bumps are manual via `npm run version:bump`; full builds no longer mutate tracked files
- Vite 6 (not 7) due to Node 20 compatibility
