# Forge Motion Implementation Brief

## Purpose

This document is a one-shot execution brief for the next agent.

It combines:

- the existing transition intent from `TRANSITION_IMPROVEMENT_PLAN.md`
- a code audit of the current implementation
- additional direction from the product fantasy

The goal is to let one agent implement the motion pass without having to rediscover the design intent or the technical traps in the current codebase.

## Product Intent

Forge should feel like a **code forge**.

Not a literal blacksmith simulator.
Not a generic desktop utility.
Not a translucent sci-fi dashboard.

The feeling target is:

- controlled
- anchored
- responsive
- restrained
- slightly physical
- tool-oriented
- crafted

The user explicitly does **not** want this work constrained by fear of “game UI.”
Good game UI is a valid reference.
Forge is almost entirely composed of menus, buttons, panels, selection states, and navigation surfaces.
That means the craft lives in interaction feel.

The right fantasy is:

- your computer is a forge
- your tools deploy with intent
- surfaces feel seated and weighted
- choices feel engaged, not merely highlighted
- motion communicates mechanism, not spectacle

## Primary Design Rules

These are the rules the implementation must follow.

1. Prefer motion over extra styling.
2. Prefer directional movement over new glow systems.
3. Prefer compression and release over opacity-heavy decoration.
4. Prefer local interaction polish over shell-wide reactions.
5. Use subtle travel and strong timing, not large theatrical motion.
6. Keep border clarity and structural discipline intact.
7. Do not turn Forge into a spark-and-bloom theme pass.

## Implementation Scope

The original transition plan was too narrow for a clean one-shot implementation.
If you keep the old file limits exactly as written, you will likely get trapped by parent-owned open/close behavior and repeat the previous partial execution.

For this pass, the scope should include the owners of the affected menus so open and close motion can both be implemented correctly.

### Files Expected To Change

- `src/components/NewTabMenu.jsx`
- `src/components/NewProjectMenu.jsx`
- `src/components/ProjectExplorer.jsx`
- `src/components/TabBar.jsx`
- `src/components/Sidebar.jsx`
- `src/components/Settings.jsx`
- `src/components/InfoPanel.jsx`
- `src/components/WelcomeModal.jsx`
- `src/components/GuidedTour.jsx`
- `src/hooks/useFlashAnimation.js`
- `src/components/Terminal.jsx`
- `src/store/useForgeStore.js`
- `src/styles/global.css`

You do **not** need to touch particle systems, themes, shell utility files, or app architecture unless required for a very small integration fix.

## Non-Negotiable Guardrails

1. Do not break existing behavior.
2. Do not revert unrelated user changes.
3. Do not change layout, spacing, or information architecture unless absolutely required for a motion fix.
4. Do not introduce shell-wide impulse reactions.
5. Do not solve this by adding more glow.
6. Do not make opacity the main read.
7. Do not introduce complicated new global state if a local component state or existing mounted/exiting pattern is sufficient.
8. Keep menus clickable immediately and reliably.
9. Preserve drag behavior for tabs and sidebar groups.
10. Preserve filtering, selection, and close behavior for all current menus and panels.

## Technical Reality Check

The previous pass was incomplete for structural reasons, not just taste reasons.

### Important Constraint

Some menu surfaces are mounted and unmounted by parent components immediately.
That means a child-only implementation can add open motion but cannot produce a proper close animation before unmount.

This specifically affects:

- new tab menu ownership in `src/components/TabBar.jsx`
- new project menu ownership in `src/components/Sidebar.jsx`
- repository explorer ownership in `src/components/TabBar.jsx`

If you want real close animation, you must coordinate with the parent owner.
Do not ignore this and pretend the close path is solved.

## Current Audit Findings

### 1. Important tool surfaces still appear instantly

These surfaces currently lack meaningful deploy motion:

- `src/components/NewTabMenu.jsx`
- `src/components/NewProjectMenu.jsx`
- `src/components/ProjectExplorer.jsx`

Current problem:

- they mostly render immediately
- they rely on static styling rather than deployed motion
- hover states are functional but weak

Why this matters:

- these are exactly the kinds of surfaces that should feel like tools being brought into position
- their current feel is generic utility UI, not Forge

### 2. The app has both too little motion and the wrong motion

Missing motion:

- menu deployment
- staged submenu reveal
- stronger hover engagement in menus and explorer
- better press/release feel in tool rows and actions

Too much or wrong motion:

- waiting attention flashes on tabs/sidebar are too long and too present
- working indicators pulse continuously
- some modal motion is generic and keyframe-heavy rather than crisp and interruptible
- guided tour ring uses layout-property animation and persistent pulsing

The problem is not “too much animation everywhere.”
The problem is:

- not enough motion where motion should create weight and deployment
- too much persistent motion where the interface should feel calm

### 3. Menus do not yet reflect actual rendered placement

`NewProjectMenu` already computes whether it clamps or flips near the viewport edge.
That information is not fully converted into motion language.

This is a missed opportunity.
If a menu renders on a different side than originally requested, the motion should reflect the actual final side.

### 4. Hover states are underpowered

Many current hover treatments are mostly:

- background recolor
- text recolor
- minimal or no spatial response

This is too weak for Forge’s fantasy.
Hover should feel like engagement and readiness, not like a CSS color swap.

### 5. Persistent nav/status motion is too chatty

Current waiting and working state animation is too attention-seeking for a premium tool surface.

Forge should feel warm and alive, but not restless.
Persistent motion should be calmer than deploy motion.

## What The Agent Should Build

This is the actual implementation target.

## Phase 1: Menus And Tool Trays

### Surfaces

- New Tab menu
- New Project menu
- Repository explorer

### Goal

Make these feel like deployed tools, not spawned panels.

### Requirements

1. Add subtle directional open motion.
2. Add real close motion where the owner allows it.
3. Add transform-origin and directional travel based on actual rendered placement.
4. Add light staged reveal of existing menu content.
5. Strengthen hover timing and feel inside these menus.
6. Strengthen press/release feel for rows and action buttons inside these menus.

### Motion Character

- directional travel: `6px` to `10px`
- scale: `0.985` to `1`
- open: `180ms` to `200ms`
- close: `120ms` to `150ms`
- hover: `120ms` to `160ms`
- press-in: immediate
- press-out: `140ms` to `180ms`

### Easing

Use stronger custom curves, not weak default easing.

Recommended:

- `cubic-bezier(0.23, 1, 0.32, 1)` for enter and deployment
- `cubic-bezier(0.16, 1, 0.3, 1)` for hover travel and short settling moves
- `cubic-bezier(0.4, 0, 1, 1)` or a similar decisive exit curve for close if needed

### Visual Read

The first read should be:

- motion
- direction
- weight

Not:

- fade
- glow
- blur

Opacity can support the move, but should not be the main effect.

### Specific Notes

#### New Tab Menu

Should feel like a compact tool list dropping into reach from the trigger.

The server submenu should not just “appear.”
It should expand with a restrained staged reveal.

The submenu chevron or indicator should feel like it engages, not merely flips text.

#### New Project Menu

Should feel like a placement-sensitive deployment from the `+ New Project` trigger.

Because this menu already clamps against viewport edges, use the computed placement to drive:

- `transform-origin`
- open direction
- close direction

This surface is one of the clearest opportunities to make Forge feel designed.

#### Repository Explorer

This should feel less like a generic popover and more like opening a working compartment.

Do not redesign it.
Do not add spectacle.

Do:

- give the panel a subtle deploy
- give header actions firmer engagement
- give tree rows better hover/press response
- make expand/collapse and row activation feel more intentional

## Phase 2: Core Selection Surfaces

### Surfaces

- top tabs
- sidebar project rows

### Goal

Selection surfaces should feel slightly heavier and more physical.

### Requirements

1. Preserve drag behavior completely.
2. Improve hover feel with slight spatial engagement.
3. Improve press feel with immediate compression.
4. Improve release feel with a measured settle.
5. Keep utility controls lighter than primary selection surfaces.

### Important Rule

Do not over-style active states.
Use transform and timing first.

## Phase 3: Modal And Panel Motion Cleanup

### Surfaces

- settings
- guide/info panel
- welcome modal

### Goal

Remove generic app-modal feel.

### Requirements

1. Replace keyframe-heavy motion where possible with transition-based motion.
2. Keep modals centered.
3. Use subtle vertical deploy and decisive close.
4. Avoid sluggish `ease-in` style exits.

These should feel like panels settling into place, not like animated dialogs from a template library.

## Phase 4: Reduce Chatty Attention Motion

### Surfaces

- waiting flashes
- working indicator pulses

### Goal

Retain urgency without making the shell feel restless.

### Requirements

1. Shorten or simplify waiting-attention motion.
2. Replace continuous “please look at me” behavior with a short arrival cue plus calmer resting state.
3. Tone down perpetual pulsing on working states.

Forge should feel hot, not noisy.

## Phase 5: Guided Tour Cleanup

### Goal

Make the tour feel more exact and less mechanically heavy.

### Requirements

1. Avoid animating layout properties when transform can do the job.
2. Tone down persistent pulse behavior.
3. Keep tooltip and highlight movement precise and understated.

## Concrete Hotspots

These are the current hotspots the implementing agent should inspect first.

### Menus And Explorer

- `src/components/NewTabMenu.jsx`
- `src/components/NewProjectMenu.jsx`
- `src/components/ProjectExplorer.jsx`
- `src/components/TabBar.jsx`
- `src/components/Sidebar.jsx`
- `src/styles/global.css`

### Modal Stack

- `src/components/Settings.jsx`
- `src/components/InfoPanel.jsx`
- `src/components/WelcomeModal.jsx`
- `src/styles/global.css`

### Attention Motion

- `src/hooks/useFlashAnimation.js`
- `src/components/Terminal.jsx`
- `src/store/useForgeStore.js`
- `src/styles/global.css`

### Guided Tour

- `src/components/GuidedTour.jsx`
- `src/styles/global.css`

## Suggested Implementation Sequence

Follow this order.

1. Read `TRANSITION_IMPROVEMENT_PLAN.md`.
2. Inspect current ownership of new tab, new project, and repo explorer open/close state.
3. Implement menu open/close motion first.
4. Implement hover and press refinement inside those same surfaces.
5. Verify all menu behaviors still work.
6. Then refine tabs and sidebar project rows.
7. Then clean up modal motion.
8. Then tone down status motion.
9. Then clean up guided tour motion.

Do not jump directly to tab/sidebar polish before the menu deployment work is solid.

## Verification Checklist

Run these checks before finishing.

### Menus

- New Tab menu still opens reliably.
- New Tab menu still closes reliably.
- New Tab menu still creates the selected tab correctly.
- Server submenu still expands and selects correctly.
- New Project menu still opens reliably.
- New Project menu still filters correctly while typing.
- New Project menu still handles paste-path flow correctly.
- New Project menu still selects starred repos and repo list items correctly.
- Repository explorer still opens and closes correctly.
- Repository explorer still edits path correctly.
- Repository explorer still opens files correctly.
- Repository explorer still refreshes and clears correctly.

### Selection Surfaces

- Dragging tabs still works.
- Dragging sidebar groups still works.
- Close buttons still work normally.

### Panels

- Settings still opens and closes correctly.
- Guide still opens and closes correctly.
- Welcome modal still opens and closes correctly.

### Attention Motion

- Waiting states still communicate attention.
- Working states still communicate activity.
- Neither feels noisy in steady-state use.

### Regression Checks

- No layout shifts were introduced.
- No padding changes were introduced accidentally.
- No unrelated theme or particle behaviors changed.
- No shell-wide reaction system was added.

## Implementation Advice

### Do

- use CSS transitions wherever possible
- keep motion property-specific
- use transform and opacity first
- use small distances
- bias toward precision and repeatability
- make hover feel more intentional
- make press feel immediate

### Do Not

- use `transition: all`
- solve premium feel with new glow
- rely on fade as the main effect
- increase motion amplitude because something feels weak
- add shell theatrics
- change structure just to show animation

If something feels weak, improve:

- direction
- easing
- timing
- transform-origin
- press/release behavior

before adding decoration.

## Risk Notes

### Highest Risk

Parent-owned unmount timing for menus.

If you do not handle this correctly, you will end up with:

- open animation only
- no real close animation
- inconsistent behavior across menus

Handle ownership deliberately.

### Medium Risk

Accidentally making the UI feel like a generic modern web app by using soft opacity-heavy motion.

Forge should feel sharper and more intentional than that.

### Medium Risk

Over-correcting into noisy “fantasy UI.”

The user is not afraid of game UI.
That does **not** mean louder is better.
Aim for high-quality game UI logic:

- clear deployment
- excellent input feel
- precise response
- disciplined motion

## Delivery Standard

The pass is successful if:

- menus and tool trays unmistakably feel deployed
- hover states feel engaged, not merely recolored
- tabs and sidebar rows feel slightly heavier and more deliberate
- modal and panel motion feels more custom and less template-like
- waiting/working motion is calmer and more premium
- the app stays structurally disciplined
- nothing important breaks

## Workflow Recommendation

Before touching code:

1. run `git status`
2. inspect any existing edits in files you plan to change
3. do not revert unrelated work
4. if a file has conflicting user edits, adapt to them instead of overwriting them

## Branch / Worktree Recommendation

Yes, this work is a good candidate for a **new branch or worktree**.

Reason:

- it touches multiple core UI surfaces
- it mixes interaction feel with behavior ownership
- it is likely to require iteration
- it is easy to regress existing UX while tuning motion

Recommended approach:

- create a new branch if the current working tree is otherwise quiet
- create a new worktree if the current tree is already carrying unrelated UI or product work

Use a separate worktree if you want the safest review and iteration loop.
That is my recommendation for this specific pass.
