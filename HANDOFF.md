# Forge V2 Handoff

## Current State

Forge now has a simpler V2 workspace shell layered onto the existing terminal-first app.

Implemented in this pass:
- sidebar restored to a narrow project rail
- workspace binding controls removed from the sidebar
- repository access moved into the top header as an on-demand browser popover
- permanent explorer panel removed from the default layout
- permanent inspector panel removed from the default layout
- terminal tabs remain global in the top header
- document tabs now live inside the document reader instead of as a second global row
- supported files opened from the repository browser load into a persistent side-by-side reader
- terminal and reader can now remain visible together
- reader width is adjustable via a draggable divider and persists per project

Build status:
- `npm run build` passes
- `cargo check` not rerun in this pass

## Important Product/UX Context

This pass was driven by combined feedback on the previous shell:

- the sidebar had become too wide because it was carrying workspace management chrome
- the full file tree is useful, but not useful enough to deserve a permanent panel most of the time
- terminal tabs and document tabs should not compete in the same global header stack
- the inspector did not justify a full-time right rail
- duplicate terminal-return controls were confusing and at times effectively dead UI

The current design direction is:
- keep the project rail focused on projects
- keep terminal navigation global
- keep document navigation scoped to the reader
- make repository browsing available on demand from the header
- keep terminal and document work visible at the same time

## Files Touched In This Pass

Core shell and state:
- `src/App.jsx`
- `src/store/useForgeStore.js`
- `src/utils/workspace.js`

UI:
- `src/components/Sidebar.jsx`
- `src/components/TabBar.jsx`
- `src/components/ProjectExplorer.jsx`
- `src/components/DocumentViewer.jsx`
- `src/styles/global.css`

Backend:
- none in this pass

## Backend Behavior Added Earlier

Workspace commands already present and still relied on:
- `pick_workspace_folder`
- `scan_workspace`
- `read_workspace_file`
- `collect_images`

Safety and limits still apply:
- canonical root checks
- relative-path containment checks
- bounded recursion depth
- bounded directory entry count
- bounded total scan nodes
- bounded preview size
- ignored directories: `.git`, `node_modules`, `dist`, `target`, `.next`, `.turbo`, `.idea`, `.vscode`

Current numeric limits:
- max scan depth: `8`
- max entries per directory: `200`
- max total nodes: `5000`
- max preview bytes: `512 KB`
- max recent images: `24`

## Current Interaction Model

- terminals remain mounted in `TerminalArea`
- reader now sits beside the terminal area instead of replacing it
- repository browser opens from the header via the repository-path trigger
- repository browser contains:
  - paste-path binding
  - browse fallback
  - refresh action
  - file tree
- selecting a supported file in the repository browser opens it in the reader and closes the browser
- terminal tabs stay in the global header
- document tabs stay inside the reader header
- reader width persists per project

## Known Design Problems

These are the next agent's real targets.

1. The repository browser is structurally better than the old permanent panel, but it is still dense.
- Binding, refresh, path display, and tree browsing are all in one popover.
- It may need a calmer header treatment or progressive disclosure for path editing.

2. Reader polish is still incomplete.
- The reader is much more coherent now, but the layout still needs refinement under real content density.
- Tab treatment, metadata, and divider affordance may still need tuning after visual review.

3. Explorer/tree styling is still utilitarian.
- It is more appropriate as a transient tool now, but iconography and row treatment still feel placeholder-ish.

## Recommended Next Pass

This should remain a design-first pass, not a backend pass.

Priority order:
1. refine the repository-browser popover hierarchy
2. polish reader header, tabs, and reading surface
3. tune divider affordance and split proportions under more content types
4. improve file-tree visual language and density
5. add tests after the shell behavior feels settled

Concrete directions worth testing:
- make the repo trigger read more like a bound repository status pill than a generic button
- collapse path editing behind a smaller "Change Path" affordance after first bind
- give the document tabs a calmer, more editorial tone
- test reader sizing against long markdown files, code-heavy text files, and large images

## Things Not To Break

- do not unmount PTYs during terminal/document switching
- do not merge terminal tabs and document tabs into one model
- keep new terminal tabs defaulting to project `rootPath` when present
- keep persisted state lightweight; do not persist trees or file content
- keep file access scoped to `rootPath`

## Suggested Smoke Test After Design Changes

1. Launch with `npm run tauri dev`
2. Click the repository trigger in the header
3. Paste a local folder path and press `Enter`
4. Confirm the repository browser shows a tree
5. Open markdown/text/image files from the browser
6. Confirm document tabs appear only inside the document surface
7. Drag the reader divider and confirm the width changes smoothly
8. Restart app and confirm binding + open documents + reader width persist

## Recommendation Beyond Design

After the next design pass, the best engineering task is test coverage:
- Rust tests for path containment, invalid roots, oversized files, and symlink/junction handling
- store/config migration tests for V1 -> V2 loading rules
