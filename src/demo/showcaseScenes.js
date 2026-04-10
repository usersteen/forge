function file(path, fileType) {
  const parts = path.split("/");
  return {
    kind: "file",
    path,
    name: parts[parts.length - 1],
    file_type: fileType,
  };
}

function dir(path, children) {
  const parts = path.split("/");
  return {
    kind: "directory",
    path,
    name: parts[parts.length - 1],
    children,
  };
}

function makeDoc(path, type, content, title = null) {
  return {
    ref: {
      path,
      title: title || path.split("/").pop(),
      type,
    },
    state: {
      status: "ready",
      error: "",
      payload: {
        path,
        type,
        title: title || path.split("/").pop(),
        content,
        assetPath: null,
        byteSize: content.length,
        truncated: false,
      },
    },
  };
}

function makeTerminalScreen(options) {
  return {
    sessionLabel: options.sessionLabel,
    pathLabel: options.pathLabel,
    command: options.command,
    lines: options.lines,
    footer: options.footer || "",
  };
}

function nowOffsets() {
  const now = Date.now();
  return {
    now,
    hot: now - 15_000,
    warm: now - 70_000,
    stale: now - 9 * 60_000,
  };
}

function buildHeroOverviewScene() {
  const stamp = nowOffsets();
  const readmeDoc = makeDoc(
    "README.md",
    "markdown",
    [
      "# Forge Landing Push",
      "",
      "## Positioning",
      "",
      "- Forge is the desktop workspace for parallel AI coding agents.",
      "- The UI should answer one question at a glance: who needs me right now?",
      "",
      "## Next",
      "",
      "1. Lock the hero promise.",
      "2. Stage three canonical showcase scenes.",
      "3. Export one clean screenshot per feature.",
    ].join("\n")
  );

  return {
    id: "hero-overview",
    kicker: "Command Surface",
    title: "The full Forge command surface in one frame.",
    summary: "A balanced hero scene with active agent work, one waiting terminal in the sidebar, and a real document open beside the terminal.",
    feature: "Overview",
    theme: "forge",
    heatStage: 3,
    fxEnabled: true,
    repoExplorerOpen: false,
    groups: [
      {
        id: "scene-hero-forge",
        name: "Forge",
        activeTabId: "scene-hero-codex",
        rootPath: "C:/Users/tenis/Documents/GitHub/forge",
        explorerVisible: true,
        inspectorVisible: true,
        selectedPath: "README.md",
        openDocuments: [readmeDoc.ref],
        activeDocumentPath: readmeDoc.ref.path,
        activeSurface: "document",
        readerWidth: 0.36,
        lastIndexedAt: stamp.now,
        worktreeParentId: null,
        gitBranch: "showcase/studio",
        gitCommonDir: "C:/Users/tenis/Documents/GitHub/forge/.git",
        tabs: [
          {
            id: "scene-hero-server",
            name: "Vite",
            cwd: "C:/Users/tenis/Documents/GitHub/forge",
            status: "idle",
            statusTitle: "",
            waitingReason: null,
            type: "server",
            provider: "unknown",
            manuallyRenamed: true,
            suggestedServerName: "localhost:5173",
            waitingSince: null,
            heatWaitingSince: null,
            lastEngagedAt: stamp.stale,
            launchCommand: null,
          },
          {
            id: "scene-hero-claude",
            name: "Landing Copy",
            cwd: "C:/Users/tenis/Documents/GitHub/forge",
            status: "working",
            statusTitle: "Tightening hero positioning",
            waitingReason: null,
            type: "ai",
            provider: "claude",
            manuallyRenamed: true,
            suggestedServerName: "",
            waitingSince: null,
            heatWaitingSince: null,
            lastEngagedAt: stamp.hot,
            launchCommand: null,
          },
          {
            id: "scene-hero-codex",
            name: "Showcase Studio",
            cwd: "C:/Users/tenis/Documents/GitHub/forge",
            status: "working",
            statusTitle: "Building deterministic scenes",
            waitingReason: null,
            type: "ai",
            provider: "codex",
            manuallyRenamed: true,
            suggestedServerName: "",
            waitingSince: null,
            heatWaitingSince: null,
            lastEngagedAt: stamp.hot,
            launchCommand: null,
          },
        ],
      },
      {
        id: "scene-hero-client",
        name: "Client Site",
        activeTabId: "scene-hero-client-claude",
        rootPath: "C:/Users/tenis/Documents/GitHub/client-site",
        explorerVisible: true,
        inspectorVisible: true,
        selectedPath: null,
        openDocuments: [],
        activeDocumentPath: null,
        activeSurface: "terminal",
        readerWidth: 0.4,
        lastIndexedAt: stamp.now,
        worktreeParentId: null,
        gitBranch: "feat/agent-nav",
        gitCommonDir: "C:/Users/tenis/Documents/GitHub/client-site/.git",
        tabs: [
          {
            id: "scene-hero-client-claude",
            name: "Navbar Audit",
            cwd: "C:/Users/tenis/Documents/GitHub/client-site",
            status: "waiting",
            statusTitle: "Waiting for approval",
            waitingReason: "userInput",
            type: "ai",
            provider: "claude",
            manuallyRenamed: true,
            suggestedServerName: "",
            waitingSince: stamp.hot,
            heatWaitingSince: stamp.hot,
            lastEngagedAt: stamp.hot,
            launchCommand: null,
          },
          {
            id: "scene-hero-client-server",
            name: "Preview",
            cwd: "C:/Users/tenis/Documents/GitHub/client-site",
            status: "idle",
            statusTitle: "",
            waitingReason: null,
            type: "server",
            provider: "unknown",
            manuallyRenamed: true,
            suggestedServerName: "localhost:3000",
            waitingSince: null,
            heatWaitingSince: null,
            lastEngagedAt: stamp.warm,
            launchCommand: null,
          },
        ],
      },
    ],
    activeGroupId: "scene-hero-forge",
    workspaceByGroup: {
      "scene-hero-forge": {
        status: "ready",
        error: "",
        rootPath: "C:/Users/tenis/Documents/GitHub/forge",
        tree: [
          dir("docs", [file("docs/showcase-staging-guide.md", "markdown")]),
          dir("src", [file("src/App.jsx", "text"), file("src/components/ShowcaseStudio.jsx", "text")]),
          file("README.md", "markdown"),
        ],
        recentImages: [],
        recentImagesStatus: "idle",
        recentImagesError: "",
      },
      "scene-hero-client": {
        status: "ready",
        error: "",
        rootPath: "C:/Users/tenis/Documents/GitHub/client-site",
        tree: [dir("src", [file("src/app.tsx", "text")]), file("README.md", "markdown")],
        recentImages: [],
        recentImagesStatus: "idle",
        recentImagesError: "",
      },
    },
    documentStateByGroup: {
      "scene-hero-forge": {
        [readmeDoc.ref.path]: readmeDoc.state,
      },
      "scene-hero-client": {},
    },
    terminalScreensByTab: {
      "scene-hero-server": makeTerminalScreen({
        sessionLabel: "server",
        pathLabel: "forge",
        command: "npm run dev",
        lines: [
          { tone: "muted", text: "> forge-v2@0.5.32 dev" },
          { tone: "muted", text: "> vite" },
          { tone: "success", text: "Local:   http://localhost:5173/" },
          { tone: "dim", text: "ready in 428ms" },
        ],
        footer: "Watching for changes across src/ and docs/",
      }),
      "scene-hero-claude": makeTerminalScreen({
        sessionLabel: "claude",
        pathLabel: "forge",
        command: "claude",
        lines: [
          { tone: "section", text: "Landing pass" },
          { tone: "working", text: "Analyzing section hierarchy and CTA density..." },
          { tone: "dim", text: "Found repeated value props in hero, proof, and footer." },
          { tone: "dim", text: "Drafting tighter narrative with three dominant sections." },
        ],
        footer: "Preparing revised homepage structure",
      }),
      "scene-hero-codex": makeTerminalScreen({
        sessionLabel: "codex",
        pathLabel: "forge",
        command: "codex",
        lines: [
          { tone: "section", text: "Showcase Studio" },
          { tone: "working", text: "Creating a deterministic scene registry..." },
          { tone: "dim", text: "Loaded 3 canonical launch scenes." },
          { tone: "dim", text: "Boot path switched to seeded state with persistence disabled." },
          { tone: "success", text: "Studio dock styled to match Forge chrome." },
        ],
        footer: "One source for screenshots and short clips",
      }),
      "scene-hero-client-claude": makeTerminalScreen({
        sessionLabel: "claude",
        pathLabel: "client-site",
        command: "claude",
        lines: [
          { tone: "section", text: "Navbar audit" },
          { tone: "waiting", text: "Need a decision on mobile navigation pattern." },
          { tone: "dim", text: "Option A keeps brand lockup. Option B prioritizes search." },
        ],
        footer: "Waiting for approval to proceed",
      }),
      "scene-hero-client-server": makeTerminalScreen({
        sessionLabel: "server",
        pathLabel: "client-site",
        command: "npm run dev",
        lines: [
          { tone: "success", text: "Local:   http://localhost:3000/" },
          { tone: "dim", text: "Proxying API requests to localhost:8787" },
        ],
      }),
    },
    notes: [
      "Best for hero and overview sections.",
      "Keep the document viewer open so the frame reads as a full workspace, not only a terminal manager.",
      "Use this scene when the copy talks about orchestrating multiple agents across projects.",
    ],
    captureNotes: "1920x1080. Keep the studio dock visible for internal reviews, then collapse it for final exports.",
  };
}

function buildNeedsAttentionScene() {
  const stamp = nowOffsets();

  return {
    id: "needs-attention",
    kicker: "Attention Management",
    title: "Urgency should snap into focus without turning the whole UI loud.",
    summary: "This scene concentrates on waiting states, hot recency, and the heat ramp that makes critical work impossible to miss.",
    feature: "Attention",
    theme: "void",
    heatStage: 4,
    fxEnabled: true,
    repoExplorerOpen: false,
    groups: [
      {
        id: "scene-attention",
        name: "Launch",
        activeTabId: "scene-attention-review",
        rootPath: "C:/Users/tenis/Documents/GitHub/forge",
        explorerVisible: true,
        inspectorVisible: true,
        selectedPath: null,
        openDocuments: [],
        activeDocumentPath: null,
        activeSurface: "terminal",
        readerWidth: 0.4,
        lastIndexedAt: stamp.now,
        worktreeParentId: null,
        gitBranch: "feat/launch-readiness",
        gitCommonDir: "C:/Users/tenis/Documents/GitHub/forge/.git",
        tabs: [
          {
            id: "scene-attention-plan",
            name: "Plan",
            cwd: "C:/Users/tenis/Documents/GitHub/forge",
            status: "working",
            statusTitle: "Comparing surfaces",
            waitingReason: null,
            type: "ai",
            provider: "codex",
            manuallyRenamed: true,
            suggestedServerName: "",
            waitingSince: null,
            heatWaitingSince: null,
            lastEngagedAt: stamp.warm,
            launchCommand: null,
          },
          {
            id: "scene-attention-review",
            name: "Review Pass",
            cwd: "C:/Users/tenis/Documents/GitHub/forge",
            status: "waiting",
            statusTitle: "Waiting for direction",
            waitingReason: "userInput",
            type: "ai",
            provider: "claude",
            manuallyRenamed: true,
            suggestedServerName: "",
            waitingSince: stamp.hot,
            heatWaitingSince: stamp.hot,
            lastEngagedAt: stamp.hot,
            launchCommand: null,
          },
          {
            id: "scene-attention-bug",
            name: "Tauri Bug",
            cwd: "C:/Users/tenis/Documents/GitHub/forge",
            status: "waiting",
            statusTitle: "Needs reproduction details",
            waitingReason: "userInput",
            type: "ai",
            provider: "codex",
            manuallyRenamed: true,
            suggestedServerName: "",
            waitingSince: stamp.warm,
            heatWaitingSince: stamp.warm,
            lastEngagedAt: stamp.warm,
            launchCommand: null,
          },
        ],
      },
      {
        id: "scene-attention-docs",
        name: "Docs",
        activeTabId: "scene-attention-docs-tab",
        rootPath: "C:/Users/tenis/Documents/GitHub/forge-docs",
        explorerVisible: true,
        inspectorVisible: true,
        selectedPath: null,
        openDocuments: [],
        activeDocumentPath: null,
        activeSurface: "terminal",
        readerWidth: 0.4,
        lastIndexedAt: stamp.now,
        worktreeParentId: null,
        gitBranch: "docs/launch-assets",
        gitCommonDir: "C:/Users/tenis/Documents/GitHub/forge-docs/.git",
        tabs: [
          {
            id: "scene-attention-docs-tab",
            name: "Changelog",
            cwd: "C:/Users/tenis/Documents/GitHub/forge-docs",
            status: "working",
            statusTitle: "Writing release notes",
            waitingReason: null,
            type: "ai",
            provider: "claude",
            manuallyRenamed: true,
            suggestedServerName: "",
            waitingSince: null,
            heatWaitingSince: null,
            lastEngagedAt: stamp.stale,
            launchCommand: null,
          },
        ],
      },
    ],
    activeGroupId: "scene-attention",
    workspaceByGroup: {
      "scene-attention": {
        status: "ready",
        error: "",
        rootPath: "C:/Users/tenis/Documents/GitHub/forge",
        tree: [],
        recentImages: [],
        recentImagesStatus: "idle",
        recentImagesError: "",
      },
      "scene-attention-docs": {
        status: "ready",
        error: "",
        rootPath: "C:/Users/tenis/Documents/GitHub/forge-docs",
        tree: [],
        recentImages: [],
        recentImagesStatus: "idle",
        recentImagesError: "",
      },
    },
    documentStateByGroup: {
      "scene-attention": {},
      "scene-attention-docs": {},
    },
    terminalScreensByTab: {
      "scene-attention-plan": makeTerminalScreen({
        sessionLabel: "codex",
        pathLabel: "forge",
        command: "codex",
        lines: [
          { tone: "working", text: "Mapping README, tour, and landing page copy surfaces..." },
          { tone: "dim", text: "Found three overlapping descriptions of the product promise." },
        ],
        footer: "Working through source-of-truth recommendations",
      }),
      "scene-attention-review": makeTerminalScreen({
        sessionLabel: "claude",
        pathLabel: "forge",
        command: "claude",
        lines: [
          { tone: "section", text: "Review findings" },
          { tone: "waiting", text: "Need a call on whether to freeze the launch baseline now." },
          { tone: "dim", text: "Current copy surfaces are likely to drift unless one landing variant is chosen." },
          { tone: "dim", text: "Recommend: lock hero, core features, and limitations before asset production." },
        ],
        footer: "Press enter to reply",
      }),
      "scene-attention-bug": makeTerminalScreen({
        sessionLabel: "codex",
        pathLabel: "forge",
        command: "codex",
        lines: [
          { tone: "section", text: "Reproduction blocked" },
          { tone: "waiting", text: "Need exact steps or a log snippet to continue." },
          { tone: "dim", text: "Issue appears during repo binding and workspace scan." },
        ],
        footer: "Waiting on missing context",
      }),
      "scene-attention-docs-tab": makeTerminalScreen({
        sessionLabel: "claude",
        pathLabel: "forge-docs",
        command: "claude",
        lines: [
          { tone: "working", text: "Condensing release notes into a delta-only update..." },
          { tone: "dim", text: "Removing repeated product narrative from changelog." },
        ],
      }),
    },
    notes: [
      "Use this when the page copy is about who needs your attention now.",
      "The active tab should be waiting so the border and dot states read immediately.",
      "Leave the second project visible in the sidebar to prove multi-project context.",
    ],
    captureNotes: "Best cropped slightly tighter on the active tab row and sidebar group stack.",
  };
}

function buildRepoExplorerScene() {
  const stamp = nowOffsets();
  const guideDoc = makeDoc(
    "docs/showcase-staging-guide.md",
    "markdown",
    [
      "# Showcase Staging Guide",
      "",
      "## Workflow",
      "",
      "1. Pick a feature-level scene.",
      "2. Seed the app into a deterministic state.",
      "3. Capture one screenshot or a short scripted clip.",
      "",
      "## Rule",
      "",
      "Do not build detached landing page mockups when the real UI can be staged cleanly.",
    ].join("\n")
  );

  return {
    id: "repo-explorer",
    kicker: "Context",
    title: "Show the repo browser as part of the working environment, not as a side feature.",
    summary: "This scene opens the repository browser and keeps a markdown document visible so the relationship between files, docs, and terminals is obvious.",
    feature: "Repo Context",
    theme: "ice",
    heatStage: 2,
    fxEnabled: true,
    repoExplorerOpen: true,
    groups: [
      {
        id: "scene-repo",
        name: "Forge",
        activeTabId: "scene-repo-tab",
        rootPath: "C:/Users/tenis/Documents/GitHub/forge",
        explorerVisible: true,
        inspectorVisible: true,
        selectedPath: "docs/showcase-staging-guide.md",
        openDocuments: [guideDoc.ref],
        activeDocumentPath: guideDoc.ref.path,
        activeSurface: "document",
        readerWidth: 0.38,
        lastIndexedAt: stamp.now,
        worktreeParentId: null,
        gitBranch: "feat/showcase-studio",
        gitCommonDir: "C:/Users/tenis/Documents/GitHub/forge/.git",
        tabs: [
          {
            id: "scene-repo-server",
            name: "Preview",
            cwd: "C:/Users/tenis/Documents/GitHub/forge",
            status: "idle",
            statusTitle: "",
            waitingReason: null,
            type: "server",
            provider: "unknown",
            manuallyRenamed: true,
            suggestedServerName: "localhost:5173",
            waitingSince: null,
            heatWaitingSince: null,
            lastEngagedAt: stamp.stale,
            launchCommand: null,
          },
          {
            id: "scene-repo-tab",
            name: "Docs Pass",
            cwd: "C:/Users/tenis/Documents/GitHub/forge",
            status: "working",
            statusTitle: "Reviewing showcase docs",
            waitingReason: null,
            type: "ai",
            provider: "codex",
            manuallyRenamed: true,
            suggestedServerName: "",
            waitingSince: null,
            heatWaitingSince: null,
            lastEngagedAt: stamp.hot,
            launchCommand: null,
          },
        ],
      },
    ],
    activeGroupId: "scene-repo",
    workspaceByGroup: {
      "scene-repo": {
        status: "ready",
        error: "",
        rootPath: "C:/Users/tenis/Documents/GitHub/forge",
        tree: [
          dir("docs", [file("docs/showcase-staging-guide.md", "markdown"), file("docs/launch-checklist.md", "markdown")]),
          dir("src", [
            dir("src/components", [file("src/components/ShowcaseStudio.jsx", "text"), file("src/components/ShowcaseTerminal.jsx", "text")]),
            dir("src/demo", [file("src/demo/showcaseScenes.js", "text")]),
          ]),
          file("README.md", "markdown"),
        ],
        recentImages: [],
        recentImagesStatus: "idle",
        recentImagesError: "",
      },
    },
    documentStateByGroup: {
      "scene-repo": {
        [guideDoc.ref.path]: guideDoc.state,
      },
    },
    terminalScreensByTab: {
      "scene-repo-server": makeTerminalScreen({
        sessionLabel: "server",
        pathLabel: "forge",
        command: "npm run dev",
        lines: [
          { tone: "success", text: "Local:   http://localhost:5173/" },
          { tone: "dim", text: "ready in 391ms" },
        ],
      }),
      "scene-repo-tab": makeTerminalScreen({
        sessionLabel: "codex",
        pathLabel: "forge",
        command: "codex",
        lines: [
          { tone: "section", text: "Repo context" },
          { tone: "working", text: "Checking that scene data, docs, and exports stay in sync..." },
          { tone: "dim", text: "Project explorer should feel attached to the workspace, not like a generic popover." },
        ],
        footer: "Reviewing staged document and tree state",
      }),
    },
    notes: [
      "Use this when talking about repo binding, browsing, and document viewing.",
      "The repository browser should stay open so the relationship between the tree and the doc is legible.",
      "Best used in a side-by-side feature block, not as the hero.",
    ],
    captureNotes: "Keep the repo browser open. A slight crop toward the left makes the file tree more legible.",
  };
}

const BUILT_SCENES = [
  buildHeroOverviewScene(),
  buildNeedsAttentionScene(),
  buildRepoExplorerScene(),
];

export const showcaseScenes = BUILT_SCENES;

export function getDefaultShowcaseSceneId() {
  return BUILT_SCENES[0]?.id || "hero-overview";
}

export function getShowcaseScene(sceneId) {
  return BUILT_SCENES.find((scene) => scene.id === sceneId) || null;
}
