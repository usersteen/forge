export const NEW_TAB_OPTIONS = [
  {
    id: "claude",
    label: "Claude Code",
    hint: "Run `claude` in a new terminal",
    tabOptions: {
      name: "Claude Code",
      type: "ai",
      provider: "claude",
      launchCommand: "claude",
    },
  },
  {
    id: "codex",
    label: "Codex",
    hint: "Run `codex` in a new terminal",
    tabOptions: {
      name: "Codex",
      type: "ai",
      provider: "codex",
      launchCommand: "codex",
    },
  },
  {
    id: "server",
    label: "Server",
  },
  {
    id: "blank",
    label: "Blank",
    hint: "Open a shell in the attached repo when available",
    tabOptions: {},
  },
];
