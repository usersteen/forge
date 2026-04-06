# Forge Transition Improvement Plan

## Intent

This document is an execution plan, not a mood board.

Its purpose is to make Forge feel more deliberate and physical through motion, hover behavior, and transition timing without changing layout, spacing, padding, border geometry, or app architecture.

This plan is intentionally narrow.

## Core Rule

Prioritize motion over styling.

That means:

- prefer directional movement over new glow systems
- prefer compression and release over new visual decoration
- prefer timing changes over opacity-heavy treatments
- prefer local interaction polish over shell-wide effects

## What This Plan Is Not

This plan does **not** currently authorize:

- chassis reaction
- shell impulses
- store changes for animation state
- app-wide event systems
- padding changes
- border thickness changes
- structural layout changes
- opacity-driven visual redesign
- new ambient glow language

If a pass appears to require any of the above, stop and reduce scope.

## Product Standard

Forge should feel:

- controlled
- anchored
- responsive
- restrained

Not:

- flashy
- glowy
- theatrical
- translucent for its own sake

## Global Constraints

These apply to every pass.

- Do not change layout, spacing, or information architecture.
- Do not change padding values unless explicitly requested in a later document.
- Do not reduce border clarity with semi-transparent treatments.
- Do not make opacity the primary visual effect.
- Do not add new store state unless the pass explicitly allows it.
- Do not modify more files than the pass allows.
- Do not begin the next pass unless explicitly asked.

## Motion Rules

These are the default motion rules for all approved work in this document.

- Directional translate should be subtle, usually in the `4px` to `12px` range.
- Scale should be slight, usually `0.985` to `1`.
- Opacity may support motion but should not be the main read.
- Open transitions should usually land in `160ms` to `220ms`.
- Close transitions should usually land in `120ms` to `160ms`.
- Hover transitions should usually land in `120ms` to `160ms`.
- Press-in should feel immediate.
- Press-out should usually land in `140ms` to `180ms`.

## Accessibility

- Respect `prefers-reduced-motion`.
- Reduced motion should still preserve hierarchy and direction.
- Reduce travel distance and expressive timing.
- Do not replace motion with abrupt state swaps.

## Execution Rule

Implement only one pass per task.

Before making changes:

1. Read the pass.
2. Confirm the allowed files.
3. Refuse all non-pass changes.

If a proposed implementation touches more than the pass file list, stop and reduce scope.

## Pass 1: Menus Only

### Goal

Menus should feel deployed from their trigger instead of appearing instantly.

### Allowed Files

- `src/components/NewTabMenu.jsx`
- `src/components/NewProjectMenu.jsx`
- `src/components/ProjectExplorer.jsx`
- `src/styles/global.css`

### Forbidden Files

- `src/App.jsx`
- `src/store/useForgeStore.js`
- `src/components/TabBar.jsx`
- `src/components/Sidebar.jsx`
- any particle, theme, or shell utility files

### Allowed Changes

- subtle open and close motion
- directional deployment based on rendered placement
- light staged reveal of existing content
- hover timing improvements inside menus

### Forbidden Changes

- changing menu contents
- changing menu information hierarchy
- changing padding or spacing
- changing border thickness or border placement
- adding global hooks unless they are used only by these menus
- adding glow blooms as a major effect
- adding shell-level reactions
- changing trigger styling outside what is necessary to preserve alignment or state

### Implementation Notes

- Menus must remain clickable immediately and reliably.
- Do not gate usability behind an animation if that risks evaluation.
- If a menu is clamped to a different side of the viewport, motion should reflect the actual rendered side.
- Keep motion subtle enough that repeated use still feels fast.

### Acceptance Checks

- `NewTabMenu` still opens, closes, and selects correctly.
- `NewProjectMenu` still opens, filters, and selects correctly.
- `ProjectExplorer` still opens, edits path, and opens files correctly.
- Menus feel slightly directional, not decorative.
- No visible changes appear outside those menus.

### Revert Rule

If a menu effect adds noise, remove the effect rather than tuning in more styling.

## Pass 2: Click Feel Only

### Goal

Selection surfaces should feel slightly compressed and released, not just recolored.

### Allowed Files

- `src/components/TabBar.jsx`
- `src/components/Sidebar.jsx`
- `src/styles/global.css`

### Forbidden Files

- `src/App.jsx`
- `src/store/useForgeStore.js`
- menu component files
- particle or theme files

### Allowed Changes

- press and release transforms on tabs
- press and release transforms on sidebar project rows
- restrained active-state travel for existing selection indicators
- hover timing refinement

### Forbidden Changes

- new store state
- chassis impulses
- shell overlays
- glow-heavy active treatments
- opacity-heavy active treatments
- changing padding, spacing, or hit targets
- changing close button behavior

### Implementation Notes

- Use transform first.
- Keep drag behavior intact.
- Utility controls should remain lighter than primary selection surfaces.
- Active states should remain clear without becoming brighter everywhere.

### Acceptance Checks

- Tabs feel slightly heavier on press.
- Sidebar rows feel slightly heavier on press.
- Dragging tabs and projects still works.
- No shell-level visual reaction exists.

### Revert Rule

If press feel starts to feel mushy, reduce amplitude before adjusting styling.

## Deferred: Chassis Reaction

Chassis reaction is intentionally removed from this plan.

Reason:

- it expands change scope too quickly
- it forces coordination across store, shell, and interaction systems
- it is easy to make noisy
- it is not required to improve Forge in the near term

If chassis work is revisited later, it should live in a separate document with its own constraints and should begin as a single isolated experiment.

## Recommended Prompt Template

When handing this plan to another agent, use wording like this:

> Implement Pass 1 only from `TRANSITION_IMPROVEMENT_PLAN.md`. Do not modify any files outside the pass file list. Do not change padding, spacing, border geometry, store state, shell reactions, or unrelated visual systems. Focus on motion, hover timing, and reliable usability.

## Success Criteria

This plan succeeds if:

- menus feel more intentional through motion alone
- clicks feel slightly more physical through motion alone
- the app remains visually disciplined
- no architectural spread is introduced
- changes stay easy to evaluate and easy to revert
