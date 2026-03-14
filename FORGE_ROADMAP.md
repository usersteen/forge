# Forge Roadmap

## Purpose

This document bridges the gap between the original Forge plan, the V2 workspace spec, and the current app state.

It answers three questions:

1. What is Forge right now?
2. What categories of work matter most next?
3. What does each category actually mean in product terms?

This is a roadmap, not a full implementation spec. It should stay readable even when chat context is gone.

## Current Read

Forge is no longer just a terminal multiplexer, but it is not yet a finished agent workspace.

Today it is best understood as:

- a desktop control room for multiple AI coding terminals
- organized into project groups
- with lightweight repository reading and markdown editing
- plus terminal attention signals for Claude/Codex-style workflows

What is already real:

- per-tab PTY terminals
- grouped projects in the sidebar
- tab status detection and notifications
- persisted project/tab/window state
- repository tree scanning
- side-by-side document reading
- markdown editing inside the reader

What is still weak:

- first-run setup and repository binding
- attention routing after a tab needs the user
- repository retrieval beyond basic tree browsing
- product focus because some features are half-present or abandoned
- native hardening and platform clarity

## Product Position

Forge should be narrowed to this:

`The best desktop control room for multiple AI coding terminals.`

That means the core loop is:

1. Open a project.
2. Launch or resume one or more AI terminals.
3. See which terminal is working, waiting, or idle.
4. Pull in repo context quickly without leaving the app.
5. Jump to the terminal that needs attention.
6. Repeat across multiple projects without losing state.

Anything that does not strengthen that loop is lower priority.

## Workstream 1: Project Binding

### Definition

Project binding means attaching a Forge project group to a specific repository root on disk.

Once a project is bound:

- new terminal tabs in that project inherit the repo as their working directory
- repo browsing is scoped to that root
- document preview and write actions are scoped to that root
- recent files, search, and future retrieval features are scoped to that root
- the binding persists across app restarts

### Why It Matters

Right now the user mostly has to paste a path manually. That is functional, but it feels like an internal tool, not a product.

Binding is the first real act in Forge. If it is awkward, the whole app feels awkward.

### In Scope

- native folder picker wired into the UI
- recent projects and starred projects
- invalid-path and missing-folder recovery
- clear bound/unbound project states
- rebind flow that does not feel destructive or confusing
- explicit trust language around local file access

### Out Of Scope

- git-aware project detection
- multi-root workspaces
- automatic monorepo package detection
- cloud sync of recent projects

### Definition Of Done

- a new user can bind a project without pasting a raw path
- a returning user can reopen a recent project in one action
- broken bindings fail gracefully and explain what happened
- the bound root is visibly part of project identity

## Workstream 2: Attention Routing

### Definition

Attention routing means turning status detection into a workflow, not just colored dots.

Forge already knows when a terminal is working, waiting, or idle. The missing step is helping the user act on that information.

### In Scope

- jump to next waiting tab
- waiting queue or inbox
- timestamps or recency markers for attention events
- stronger project-level rollups when multiple tabs need attention
- better session recovery when a tab dies or disconnects

### Product Goal

The user should never have to visually scan the whole UI to figure out where they are needed.

## Workstream 3: Repository Retrieval

### Definition

Repository retrieval means moving beyond a file tree into fast access to relevant context.

The current tree-and-reader model is useful, but it is not enough for real repo work, especially in larger codebases.

### In Scope

- quick open by filename
- text search across the bound repo
- recent files
- stronger file affordances in the reader
- future-friendly hooks for symbols or semantic search

### Non-Goal For Now

Forge does not need to become a full IDE or LSP-heavy editor. The point is to support terminals, not replace VS Code.

### Product Goal

A user should be able to get the file or context they need in a few seconds without leaving Forge.

## Workstream 4: Shell Cleanup

### Definition

Shell cleanup means removing dead or half-finished product surface so the app has a clear shape again.

This is partly UX cleanup and partly state-model cleanup.

### In Scope

- remove or finish abandoned surfaces
- delete stale store branches that no longer map to visible product behavior
- split overloaded app orchestration into smaller modules
- reduce duplicate payload normalization and document-loading logic

### Why It Matters

Right now some parts of Forge feel current and intentional, while others feel like remnants of previous directions. That weakens iteration speed and product clarity.

## Workstream 5: Native Hardening

### Definition

Native hardening means making the desktop layer safe and reliable enough for daily use.

### In Scope

- decide whether Forge is Windows-first or actually cross-platform
- align build targets with reality
- enable a sane CSP
- make config persistence crash-safe
- make PTY lifecycle harder to break
- improve error reporting around terminal and filesystem failures

### Product Goal

Forge should feel dependable before it feels feature-rich.

## Workstream 6: Performance And Release Readiness

### Definition

This workstream covers the boring parts that become critical once the product loop is coherent.

### In Scope

- repo-scan performance on larger projects
- async or incremental retrieval work where needed
- bundle-size reduction where it matters
- smoke tests for core workflows
- Rust tests for path containment and invalid roots
- migration tests for persisted config

### Note

This work should follow the higher-level product decisions above. Testing a blurry product shape locks in blur.

## Recommended Sequence

### Phase 1: Make Setup Feel Real

Focus:

- project binding
- recent projects
- bound/unbound project states

Success condition:

- opening Forge and getting into a repo feels obvious

### Phase 2: Make Attention Management The Product

Focus:

- waiting queue
- jump-to-next-waiting
- better project/tab urgency model

Success condition:

- Forge clearly beats a raw terminal multiplexer for multi-agent work

### Phase 3: Make Repo Context Fast

Focus:

- quick open
- repo search
- recent files

Success condition:

- users can retrieve context fast enough that they stay inside Forge

### Phase 4: Clean The Shape

Focus:

- remove dead surfaces
- simplify the store
- split orchestration code

Success condition:

- the codebase matches the actual product

### Phase 5: Harden For Daily Use

Focus:

- PTY reliability
- config safety
- platform clarity
- security posture

Success condition:

- Forge feels stable enough to trust with everyday work

### Phase 6: Test And Ship

Focus:

- smoke coverage
- backend safety tests
- release process cleanup

Success condition:

- changes can ship without fear-driven manual testing every time

## What To Deprioritize

Until the core loop is stronger, these should stay secondary:

- heat/demo polish
- ornamental animation work
- broad IDE-style editing ambitions
- advanced cross-project abstractions
- open-source packaging work beyond what supports the main product

## Immediate Recommendation

If only one roadmap item is started next, it should be `project binding`.

That is the most useful first move because it:

- improves first-run UX
- clarifies what a project means in Forge
- unlocks future search and retrieval features
- makes the app feel less like an internal prototype

After that, the next best move is `attention routing`, because that is the actual wedge that makes Forge different.
