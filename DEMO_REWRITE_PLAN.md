# Forge Demo Rewrite Plan

## Goal

Reposition the website demo so it showcases Forge as a focus workspace for parallel AI work, not just a terminal organizer with a visual gimmick.

Organization is still core, but it should be framed as the mechanism that protects focus. The heat system should stay, but as the emotional expression of momentum: the feeling of "working at the forge."

## Product Story

The website demo should communicate this sequence:

1. Multiple AI work lanes are active at once.
2. Forge surfaces the lane that needs attention now.
3. Grouping and status signals make context switching cheaper.
4. The heat system turns sustained focus into a visible, aspirational feeling.

Suggested positioning:

- Headline: one place to run parallel AI work without losing the thread
- Core promise: grouped terminals, automatic status detection, and attention routing for Claude Code and Codex
- Emotional layer: when you stay responsive and keep momentum, the forge comes alive

## Demo Principles

- Proof before mood
- Real product behavior before decorative flourish
- No dead controls that look interactive
- No fake transcript content that references nonexistent files
- Keep the web demo structurally linked to the desktop app

## Phase 1: Improve The Existing Standalone Demo

This phase keeps `forge-demo.html`, but rewrites it so the story is sharper and more credible.

### Messaging

- Replace "terminal multiplexer" language with "focus workspace"
- Mention both Claude Code and Codex
- Frame heat as momentum, not the main feature

### Demo Flow

- Tour order:
  1. Parallel work lanes
  2. Attention routing
  3. Project memory
  4. Context switching
  5. Server lanes
  6. Real terminal sessions
  7. Focus momentum
  8. Working at the forge
  9. Interactive replay

### Interaction Model

- Keep interactions that support the story:
  - switch project
  - switch tab
  - cycle status dots
  - preview heat stages
  - jump between scripted scenarios
- Disable or remove controls that do nothing in the web demo:
  - new project
  - new tab
  - settings/info buttons
  - window controls

### Demo Scenarios

- `Feature Lane`
  - one coding lane working
  - one build lane idle
  - one server lane marked blue
  - one review lane waiting
- `Prompt Lane`
  - foreground the waiting lane and show approval/input friction
- `Context Switch`
  - switch active group while preserving active work elsewhere

### Transcript Content

- Use believable, repo-aligned content
- Avoid hardcoded version theater
- Include at least one Codex-flavored lane

## Phase 2: Shared React Demo Architecture

The desktop app and website should not share a runtime, but they should share the shell, data shape, and product language.

### Target Architecture

- `src/presentation/`
  - pure UI shell components with minimal runtime assumptions
- `src/runtime/desktop/`
  - Tauri window controls
  - PTY lifecycle
  - notifications
  - persistence
- `src/runtime/demo/`
  - scripted state adapter
  - replay events
  - web-safe control behavior
- `src/demo/fixtures/`
  - scenarios
  - transcripts
  - tour steps
- `src/demo/copy/`
  - headline/subhead/callout text shared across web demo and in-app info surfaces

### Shared Boundaries

- Shared:
  - sidebar shell
  - tab bar shell
  - heat visuals
  - status visuals
  - tab/group data shape
- Desktop-only:
  - PTY spawn/write/resize/kill
  - native notifications
  - window dragging and window controls
- Web-demo-only:
  - scripted scenario buttons
  - replay state
  - disabled desktop affordances

## Migration Plan

### Step 1

- Keep `forge-demo.html` alive as the public-facing demo
- Finish the messaging rewrite and scenario model

### Step 2

- Extract shared data shapes from the current store in `src/store/useForgeStore.js`
- Identify which parts of `Sidebar.jsx`, `TabBar.jsx`, and `TerminalArea.jsx` can become presentational

### Step 3

- Build a React web-demo entry that renders the same shell with a demo adapter
- Move scenario state and transcripts out of the standalone HTML file into reusable fixtures

### Step 4

- Retire or freeze `forge-demo.html`
- Use the React demo as the canonical showcase

## Definition Of Done

The website demo is successful when:

- a user understands the focus/attention value proposition in the first 15-20 seconds
- the strongest claims are shown, not just described
- the forge metaphor feels earned by the workflow
- the website demo does not drift from the desktop product shell
