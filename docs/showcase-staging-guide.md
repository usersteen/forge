# Showcase Staging Guide

This guide is for building and using Forge's showcase scenes for landing page screenshots, videos, and demos.

## Goal

The showcase system exists to stop marketing assets from drifting away from the real product UI.

A showcase scene should be:

- built from real Forge components
- deterministic
- easy to reopen later
- good enough to capture without manual cleanup

Do not build fake landing page mockups when a real scene can be staged in the app.

## Core Idea

Treat each marketing asset as a named scene.

Examples:

- `hero-overview`
- `needs-attention`
- `repo-explorer`
- `heat-streak`
- `theme-cycle`

Each scene should define:

- the feature it represents
- the exact seeded UI state
- whether it is static or animated
- any framing notes for capture

If a feature matters enough to market, it should have a canonical scene.

## How You Should Use It

The normal workflow should be:

1. Decide which feature you want to show.
2. Ask an agent to create or refine a showcase scene for that feature.
3. Open Forge in that scene.
4. Capture the screenshot or short video from the real UI.
5. Reuse that same scene later instead of rebuilding it by hand.

Primary entry point in development:

- click the dev-only `Showcase` button in the Forge sidebar
- click it again to exit showcase mode

Useful controls once showcase mode is open:

- `Shift+S` toggles the Showcase Studio dock

Developer fallback:

- `?showcase=hero-overview`
- `?showcase=needs-attention`
- `?showcase=repo-explorer`

You should be able to say things like:

- "Create a new showcase scene for repo explorer."
- "Add a landing-page-ready scene for project switching."
- "Tighten the hero showcase scene so it reads clearly in one screenshot."
- "Make a short scripted showcase for waiting to working status changes."

That is the intended usage model.

## What To Ask An Agent For

When you want a new scene, give the agent:

- the feature name
- the buyer takeaway
- whether you need a screenshot or a video
- any preferred theme
- whether the scene should be calm or high-energy

Good prompt:

```text
Create a new showcase scene for Forge's repo explorer. I want one static screenshot scene that clearly shows repo binding, file browsing, and markdown viewing. Keep it clean and landing-page ready.
```

Good prompt:

```text
Create a scripted showcase scene for agent attention management. I want a short 8-12 second clip where one tab moves from working to waiting and the heat state responds clearly.
```

## Scene Rules

Every scene should follow these rules:

- Use real Forge UI, not a recreated marketing-only component.
- Use seeded demo data, not your personal working state.
- Avoid placeholder junk, empty panes, and noisy labels.
- Show one main idea per scene.
- Keep terminal content readable but secondary unless the terminal itself is the feature.
- Do not rely on long paragraphs to explain the screenshot.

If the image needs a paragraph to make sense, the scene is not staged tightly enough.

## Scene Types

Use two types of scenes only.

### Static scenes

Use for screenshots.

These should:

- render correctly on first paint
- have stable layout and data
- look intentional without motion

Examples:

- hero product overview
- repo explorer open
- settings panel overview

### Scripted scenes

Use for short clips.

These should:

- start from a valid static scene
- animate one meaningful change
- finish in a clear end state

Examples:

- waiting -> working
- heat ramp
- project switch
- theme transition

Do not make long cinematic sequences unless there is a specific reason.

## What Makes A Good Screenshot Scene

A screenshot scene is good when:

- the feature is obvious within 2 seconds
- the frame has one visual focal point
- the UI looks real, not staged in a fake way
- the surrounding chrome supports the feature instead of competing with it

For landing pages, most scenes should be cleaner than normal usage. That means:

- fewer tabs
- fewer distractions
- stronger active states
- deliberate content in side panels

This is still real UI. It is just curated real UI.

## What Makes A Good Video Scene

A video scene is good when:

- the starting state is already clear
- one thing changes
- the change is easy to notice
- the clip is short enough to loop or scrub quickly

Aim for 8-15 seconds for most marketing clips.

Bad video pattern:

- several panels changing at once
- long pans
- slow decorative motion with no product meaning

Good video pattern:

- one tab needs attention
- a status changes
- the UI responds
- the viewer understands why Forge matters

## Asset Quality Rules

Use these defaults unless there is a reason not to:

- one core feature = one canonical scene
- one screenshot per scene before making alternates
- one short clip per animated feature before making a montage
- consistent theme, framing, and window treatment across related assets

The objective is not "many assets." The objective is "reusable canonical assets."

## Recommended Initial Scene Set

Start with a small set:

- `hero-overview`
- `needs-attention`
- `repo-explorer`
- `heat-streak`
- `project-switching`

That is enough for a homepage without creating an asset maintenance burden.

## Decision Filter

Before adding a scene, ask:

1. Is this a launch-level feature?
2. Can the feature be understood visually?
3. Does this need its own scene, or can it live in the smaller-features grid?

If the answer to 3 is "smaller-features grid," do not build a full showcase scene for it yet.

## Maintenance Rule

If Forge UI changes and a scene becomes inaccurate, update the scene definition first.

Do not patch the landing page asset in isolation unless it is an emergency.

The scene is the source.
The screenshot or video is the export.

## Practical Summary

Think of the showcase system as a small internal studio for Forge.

You are not asking agents to invent fake marketing comps.
You are asking them to:

- create or refine a real scene
- make that scene readable
- make it capture-ready

That is the right mental model.
