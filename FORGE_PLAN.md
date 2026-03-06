# FORGE

## A terminal multiplexer for parallel Claude Code workflows

---

## Concept

Forge is a lightweight Windows desktop app that adds a missing layer of organization to working with multiple Claude Code sessions simultaneously. It wraps Windows Terminal / PowerShell sessions in a two-tier tab system — **project groups** on the left, **terminal tabs** across the top — so you can run Claude Code across many repos without losing track of what's happening where.

The core problem it solves: when you're running Claude Code in 6+ terminals across multiple virtual desktops, you lose context. You don't know when tasks finish. You can't see status at a glance. Switching between projects means hunting through desktops and tabs. Forge eliminates that friction.

### Key principles

- **Organization over automation.** Forge doesn't try to auto-detect or manage Claude Code sessions. It's a manually organized workspace — you create groups, name tabs, and run commands. The structure is yours.
- **Status awareness.** The one "smart" feature: Forge watches terminal output to detect when Claude Code transitions between working and idle states, surfaces that as visual status indicators, and optionally plays a sound on completion.
- **Minimal, fast, native.** This ships as a single Windows `.exe`. No Electron bloat. Tauri + webview keeps it under 10MB. Starts instantly.
- **Terminal-first aesthetic.** Dark, monospace, tight. Feels like a tool built by a developer for developers. Not a dashboard — a forge.

---

## Architecture

### Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Shell | **Tauri v2** (Rust) | Native Windows app, small binary, can spawn/manage child processes, system tray, native notifications |
| UI | **React + Vite** | Fast dev loop, component model fits the tab/group structure |
| Terminal emulation | **xterm.js** | Battle-tested terminal emulator for the web. Handles ANSI codes, scrollback, resize |
| Process management | **Rust (tokio)** | Async process spawning, stdout/stderr streaming via PTY |
| PTY | **conpty** (Windows ConPTY API) via `portable-pty` or `conpty` Rust crate | Required to get a proper pseudo-terminal on Windows so xterm.js renders correctly |
| State | **React context + zustand** | Lightweight state management for groups, tabs, settings |
| Persistence | **JSON file** (`~/.forge/config.json`) | Save/restore workspace layout, group names, settings |
| Sound | **Web Audio API** or bundled `.wav` files | Completion chime. Keep it simple |

### Why Tauri over Electron

- Binary size: ~5-8MB vs ~150MB+
- Memory: ~30-50MB vs ~200MB+
- Startup: near-instant
- Native Windows integration (notifications, tray) built in
- Rust backend is ideal for process management

---

## Core features (MVP)

### 1. Project groups (left sidebar)

- Vertical list of named project groups
- Each group contains 1+ terminal tabs
- Visual status summary per group (count of active/done tabs)
- Double-click to rename
- Drag to reorder (post-MVP is fine)
- Add/remove groups
- Collapsed state shows mini status dots for each tab

### 2. Terminal tabs (top bar)

- Horizontal tabs within the selected group
- Each tab is a live terminal session (PowerShell by default)
- Status indicator per tab: `idle` / `working` / `done`
- Double-click to rename
- Add/remove tabs
- Active tab border color matches its status

### 3. Terminal emulator

- Full xterm.js terminal per tab
- Each tab spawns its own PowerShell process via ConPTY
- Supports everything a normal terminal does: colors, cursor movement, scrollback
- User types directly into xterm.js, which pipes to the PTY

### 4. Status detection

This is the key differentiator. Forge watches terminal output to determine Claude Code's state.

**Detection strategy:**

Claude Code has observable output patterns:
- **Working:** Continuous output streaming, spinner characters, "Working..." indicators
- **Done/idle:** Output stops, prompt returns, or Claude Code prints its completion marker

Implementation approach:
- Stream PTY stdout through a lightweight parser in Rust
- Track output velocity (bytes/second over a rolling window)
- When output velocity drops to zero for N seconds after prior activity → status = `done`
- When new output begins → status = `working`
- Fresh terminal with no Claude activity → status = `idle`
- Expose status changes to the frontend via Tauri events

**Tuning considerations:**
- The idle timeout (N seconds) should be configurable (default: 3-5 seconds)
- Avoid false positives from Claude "thinking" pauses — may need a longer threshold
- Optional: regex pattern matching on known Claude Code output patterns for higher confidence

### 5. Notifications

- When any tab transitions to `done`:
  - Update sidebar/tab status indicators immediately
  - Show Windows native toast notification (via Tauri's notification API)
  - If sound is enabled, play completion chime
- Notification includes: group name, tab name
- Clicking notification switches to that tab

### 6. Sound

- Toggle on/off (persisted in config)
- Single bundled sound file for task completion
- Play via Web Audio API in the frontend
- Keep it subtle — short, clean chime. Not gamified. Think: a quiet anvil ping

### 7. Persistence

Save to `~/.forge/config.json`:
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "Project Name",
      "tabs": [
        { "id": "uuid", "name": "frontend", "cwd": "C:/repos/project/frontend" }
      ]
    }
  ],
  "settings": {
    "sound": true,
    "shell": "powershell.exe",
    "idleTimeoutMs": 4000,
    "theme": "default"
  },
  "window": {
    "width": 1400,
    "height": 900,
    "x": null,
    "y": null
  }
}
```

On launch: restore groups/tabs, re-spawn terminals. Don't try to restore terminal scrollback — just start fresh shells in the saved working directories.

---

## UI specification

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ [FORGE v0.1]  [🔊]     ← Logo + sound toggle            │
│ ─────────────────                                        │
│ 2 active · 3 done       ← Global status counts           │
│ ═════════════════                                        │
│                    ┌─────────────────────────────────────┐│
│  ● Other ETH       │ ● frontend  ● contracts  + │ breadcrumb ││
│    ◈2 ◆1           │─────────────────────────────────────││
│                    │                                     ││
│  ○ Expedition 33   │  ❯ claude "refactor vault logic"    ││
│    frontend · api  │    ✓ Updated VaultCore.sol          ││
│                    │    ◌ Migrating distribution...       ││
│  ○ Eidolon         │    ◈ Working — allocation math      ││
│    renderer·assets │                                     ││
│                    │                                     ││
│ ─────────────────  │                                     ││
│ + New project      │                                     ││
│                    └─────────────────────────────────────┘│
│ ⌂ Other ETH │ 3 tabs │ sound on          2 active · 3 done │
└──────────────────────────────────────────────────────────┘
```

### Sidebar (240px)

- Background: very dark blue-black (`#0a0f1a`)
- Active group: left border accent (green), slightly lighter background
- Inactive groups: show mini dot+name list of tabs underneath the group name
- Group status counts: small colored numbers next to group name
- Hover: subtle background shift

### Tab bar (44px height)

- Active tab: bottom border colored by status (green=done, amber=working, gray=idle)
- Status dot before tab name
- Active tab shows status label text (COMPLETE / ACTIVE / IDLE)

### Terminal area

- Full black background with subtle radial gradient from top center
- xterm.js fills the space
- Standard terminal colors/rendering

### Status bar (28px)

- Current group name, tab count, sound state, global active/done counts

### Colors

```css
--bg-deep: #080c14;
--bg-sidebar: #0a0f1a;
--bg-active: #0d1525;
--border: #151d2e;
--text-primary: #e2e8f0;
--text-secondary: #94a3b8;
--text-muted: #475569;
--text-dim: #334155;
--accent-done: #34d399;
--accent-working: #fbbf24;
--accent-idle: #475569;
```

### Typography

- Terminal / UI text: `IBM Plex Mono` (weights: 400, 500, 600)
- Group names / branding: `Outfit` (weights: 400, 500, 600, 700)

---

## Execution plan

### Phase 0: Scaffold

1. Initialize Tauri v2 project with React + Vite frontend
2. Verify Tauri builds and launches on Windows
3. Set up the project structure:

```
forge/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Tauri entry, app setup
│   │   ├── pty.rs           # PTY spawning and management
│   │   ├── status.rs        # Output monitoring, status detection
│   │   └── config.rs        # JSON config read/write
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── Sidebar.jsx      # Project groups
│   │   ├── TabBar.jsx       # Terminal tabs
│   │   ├── Terminal.jsx     # xterm.js wrapper
│   │   ├── StatusBar.jsx    # Bottom bar
│   │   └── Notification.jsx # Toast notifications
│   ├── store/
│   │   └── useForgeStore.js # Zustand store
│   ├── hooks/
│   │   └── usePty.js        # Tauri PTY command hooks
│   └── styles/
│       └── global.css
├── package.json
└── README.md
```

### Phase 1: Terminal foundation

1. **Rust: PTY management**
   - Use `portable-pty` or `conpty` crate to spawn PowerShell sessions
   - Create Tauri commands: `spawn_pty`, `write_pty`, `resize_pty`, `kill_pty`
   - Stream PTY output to frontend via Tauri events (`pty-output-{tab_id}`)
   - Handle process cleanup on tab close

2. **React: xterm.js integration**
   - Install xterm.js + addons (fit, webgl renderer)
   - Create `Terminal` component that:
     - Initializes xterm.js instance
     - Connects to Tauri PTY events for output
     - Sends keystrokes to Rust via `write_pty` command
     - Handles resize (fit addon + `resize_pty`)
   - Verify: can type in terminal, run commands, see colored output

### Phase 2: Tab and group management

1. **Zustand store**
   - State shape: `{ groups: [...], activeGroupId, activeTabId, settings }`
   - Actions: add/remove/rename groups, add/remove/rename tabs, set active, reorder
   - Each tab holds: `{ id, name, status, ptyId, cwd }`

2. **Sidebar component**
   - Render groups from store
   - Click to select, double-click to rename
   - Status summary per group (derived from tab statuses)
   - Mini tab preview for inactive groups
   - "+" button to add group

3. **TabBar component**
   - Render tabs for active group
   - Click to switch (swap which xterm.js instance is visible)
   - Status dot per tab
   - Double-click to rename
   - "+" button adds tab (spawns new PTY)

4. **Tab switching logic**
   - Keep xterm.js instances alive in background (don't destroy on tab switch)
   - Use CSS visibility or detach/reattach to DOM
   - PTY processes run continuously regardless of which tab is focused

### Phase 3: Status detection

1. **Rust: output monitor**
   - For each PTY, maintain a rolling output tracker
   - Track: last output timestamp, bytes in last N seconds, is_active flag
   - State machine per tab:
     - `idle` → receives output → `working`
     - `working` → no output for `idleTimeoutMs` → `done`
     - `done` → receives output → `working`
     - Fresh/no prior activity → `idle`
   - Emit Tauri event on state transitions: `status-change-{tab_id}`

2. **React: status updates**
   - Listen for status change events
   - Update store → UI reflects immediately (dots, labels, colors)
   - Trigger notification + sound on `working → done` transition

### Phase 4: Notifications and sound

1. **Native notifications**
   - Use Tauri's notification plugin
   - On `done` transition: fire notification with group/tab name
   - Click notification → switch to that group/tab and focus window

2. **Sound**
   - Bundle a short completion chime (`.wav` or `.mp3`) in assets
   - Play via Web Audio API when `done` fires and sound is enabled
   - Sound toggle in UI + persisted in config

### Phase 5: Persistence and polish

1. **Config save/load**
   - Save workspace layout on every change (debounced)
   - Restore on launch: recreate groups/tabs, spawn PTYs with saved cwds
   - Save window position/size

2. **Polish**
   - Keyboard shortcuts: `Ctrl+Tab` next tab, `Ctrl+Shift+Tab` prev, `Ctrl+1-9` jump to tab
   - Tab close confirmation if PTY has running process
   - Smooth transitions on tab/group switch
   - Clean error handling for PTY failures

### Phase 6: Build and distribute

1. Tauri build for Windows → produces `.msi` or `.exe`
2. Test on clean Windows machine
3. Write minimal README

---

## Implementation notes for the agent

### Critical gotchas

- **ConPTY is Windows-specific.** The `portable-pty` crate abstracts this but make sure to test on Windows. Don't develop on Mac/Linux expecting it to just work.
- **xterm.js instance management.** Don't create/destroy xterm instances on every tab switch — this is slow and loses scrollback. Instead, keep all instances alive and toggle visibility.
- **PTY output is bytes, not lines.** The output stream from ConPTY is raw bytes with ANSI escape codes. The status detector needs to work at the byte/timing level, not by parsing "lines."
- **Tauri v2 vs v1.** Use Tauri v2. The plugin system and event model are different from v1. Check docs at https://v2.tauri.app.
- **xterm.js fit addon.** Must be called on tab switch AND window resize, or the terminal dimensions will be wrong.

### What NOT to build (MVP scope)

- No split panes
- No drag-and-drop tab reordering (use up/down buttons or just rename)
- No themes or customization beyond sound toggle
- No auto-detection of Claude Code vs regular shell usage
- No session replay or scrollback persistence across app restarts
- No auto-update mechanism
- No multi-monitor awareness

### Testing the status detection

Before wiring up the full UI, test the status detector in isolation:
1. Spawn a PTY
2. Run `claude` in it
3. Give it a task
4. Verify the detector correctly identifies working → done transitions
5. Tune the idle timeout threshold

The detection doesn't need to be perfect for MVP. False positives (briefly showing "done" during a Claude pause) are acceptable. False negatives (staying on "working" after completion) are not — err on the side of triggering "done."

---

## Reference

- **UI mockup:** See the React artifact (`empire.jsx` / `forge.jsx`) for visual reference of layout, colors, typography, and interaction patterns. The mockup is a static simulation — the real app replaces the fake terminal output with live xterm.js instances.
- **Tauri v2 docs:** https://v2.tauri.app
- **xterm.js docs:** https://xtermjs.org
- **portable-pty crate:** https://docs.rs/portable-pty
- **Zustand:** https://zustand-demo.pmnd.rs
