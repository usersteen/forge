export const TOUR_STEPS = [
  // Step 0: Project Bar (merged sidebar + project groups)
  {
    id: "project-bar",
    target: "[data-tour='sidebar-groups']",
    highlightMultiple: ["[data-tour='sidebar-groups']", "[data-tour='new-project']"],
    placement: "right",
    header: "The Project Bar",
    body: "Your projects are organized here. Each group holds terminals for one project. Double-click to rename, drag to reorder, or right-click for options.",
  },

  // Step 1: Adding Projects — tooltip anchors to the expanded menu
  {
    id: "new-project",
    target: "[data-tour='new-project']",
    placement: "right",
    tooltipTarget: ".new-project-menu",
    tooltipPlacement: "right",
    header: "Adding Projects",
    body: "Click + New Project to add a project. If you\u2019ve set a Repos Folder in Settings, your repos appear as quick picks.",
    expandPanel: "new-project-menu",
  },

  // Step 2: Tab Bar
  {
    id: "tab-bar",
    target: "[data-tour='tab-bar']",
    placement: "bottom",
    header: "The Tab Bar",
    body: "Each tab is a full terminal session. Double-click to rename, drag to reorder, or right-click for options like Close or converting to a Server tab.",
  },

  // Step 3: New Tab Menu — tooltip anchors to the expanded menu
  {
    id: "new-tab",
    target: "[data-tour='tab-add']",
    placement: "bottom",
    tooltipTarget: ".quick-tab-menu",
    tooltipPlacement: "right",
    header: "New Tab Menu",
    body: "Four tab types: Claude Code (CL) and Codex (CX) auto-launch their agents. Server opens a terminal for dev processes. Blank opens a plain shell.",
    expandPanel: "new-tab-menu",
  },

  // Step 4: Project Explorer — tooltip anchors to the expanded explorer panel
  {
    id: "repo-explorer",
    target: "[data-tour='repo-trigger']",
    placement: "bottom",
    tooltipTarget: ".repo-browser-popover",
    tooltipPlacement: "right",
    header: "Project Explorer",
    body: "Browse your project\u2019s file tree here. Star repos for quick access, expand folders, and click supported files to open them. Viewable files include code, text, Markdown, and images (PNG, JPG, GIF, SVG).",
    expandPanel: "project-explorer",
  },

  // Step 5: Terminal (now before doc viewer)
  {
    id: "terminal",
    target: "[data-tour='terminal-area']",
    placement: "left",
    header: "The Terminal",
    body: "A full terminal powered by xterm.js. AI agent status is detected automatically from terminal output \u2014 no setup needed.",
    padding: 0,
  },

  // Step 6: Document Viewer — tooltip anchors to the mock doc viewer pane
  {
    id: "doc-viewer",
    target: "[data-tour='terminal-area']",
    placement: "left",
    tooltipTarget: ".tour-mock-doc-viewer",
    tooltipPlacement: "left",
    header: "Document Viewer",
    body: "Open a file from the explorer and it appears in a resizable pane beside the terminal. Edit Markdown directly with Save and Revert buttons in the toolbar. Drag the divider to resize.",
    expandPanel: "doc-viewer-mock",
  },

  // Step 7: Status & Notifications
  {
    id: "status",
    target: "[data-tour='tab-list']",
    highlightMultiple: ["[data-tour='tab-list']", "[data-tour='sidebar-groups']"],
    placement: "bottom",
    header: "Status & Notifications",
    body: "Tab dots show status: gray (idle), red (working), amber (waiting for input). Server tabs show a steady blue dot. The sidebar shows a dot summary per project. A notification sound plays when a background tab starts waiting \u2014 adjust volume in Settings.",
    demo: "status-cycle",
  },

  // Step 8: Heat System
  {
    id: "heat-system",
    target: "[data-tour='sidebar-header']",
    placement: "right",
    header: "The Forge Heat System",
    body: "Respond quickly to waiting tabs and the forge heats up through five stages \u2014 the logo glows, particles rise, and the whole UI comes alive. Let it cool by stepping away.",
    demo: "heat-ramp",
  },

  // Step 9: Themes (NEW)
  {
    id: "themes",
    target: null,
    placement: "center",
    header: "Themes",
    body: "Four themes \u2014 Forge, Ice, Void, and Grass \u2014 each with unique colors and particle effects. Select your theme in Settings.",
    demo: "theme-cycle-hot",
  },

  // Step 10: Settings — tooltip anchors to the expanded settings panel
  {
    id: "settings",
    target: "[data-tour='settings-btn']",
    placement: "right",
    tooltipTarget: ".settings-panel",
    tooltipPlacement: "right",
    header: "Settings",
    body: "Themes, particle effects, sound volume, Repos Folder, and heat tuning \u2014 all in one place.",
    expandPanel: "settings",
  },

  // Step 11: Info (last step) — tooltip anchors to the expanded info panel
  {
    id: "info",
    target: "[data-tour='info-btn']",
    placement: "right",
    tooltipTarget: ".info-panel",
    tooltipPlacement: "right",
    header: "Info",
    body: "Documentation, keyboard shortcuts, heat color preview, and a link to retake this tour anytime.",
    expandPanel: "info",
  },
];
