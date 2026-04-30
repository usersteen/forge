const ANSI_PATTERN =
  /\u001b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][\s\S]*?(?:\u0007|\u001b\\)|P[\s\S]*?\u001b\\|_[\s\S]*?\u001b\\|\^[\s\S]*?\u001b\\)/g;

const CONTROL_PATTERN = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

const CODEX_SESSION_PATTERNS = [
  /\bOpenAI Codex\b/i,
  /\bCodex CLI\b/i,
  /\bApproval policy\b/i,
  /\bSign in with ChatGPT\b/i,
  /\bUse \/help for commands\b/i,
];

const CLAUDE_LAUNCH_COMMAND = /^claude(?:\.cmd)?(?:\s|$)/i;
const CODEX_LAUNCH_COMMAND = /^codex(?:\.cmd)?(?:\s|$)/i;
const CODEX_EXIT_COMMAND = /^(?:exit|quit|\/exit|\/quit)$/i;
const CODEX_NONINTERACTIVE_SUBCOMMANDS = new Set([
  "exec",
  "review",
  "login",
  "logout",
  "mcp",
  "mcp-server",
  "app-server",
  "completion",
  "sandbox",
  "debug",
  "apply",
  "cloud",
  "features",
  "help",
]);
const CODEX_SESSION_UI_COMMANDS = new Set([
  "/approvals",
  "/config",
  "/help",
  "/history",
  "/login",
  "/logout",
  "/mcp",
  "/memory",
  "/model",
  "/providers",
  "/resume",
  "/status",
  "/theme",
]);

const AGENT_WAITING_TITLE_PREFIX = /^[\u2733\u273b\u273d]\uFE0F?/u;
const CODEX_INTERRUPTED_LINE_PATTERN = /\bconversation interrupted\b/i;
const CODEX_CONNECTION_ISSUE_PATTERN = /\b(?:connection|network|request)\s+(?:interrupted|lost|failed)\b/i;
const CODEX_GENERIC_ERROR_PATTERN = /\bsomething went wrong\b/i;
const CODEX_FEEDBACK_PATTERN = /\b\/feedback\b/i;

function stripAgentTitlePrefix(title) {
  return title
    .trimStart()
    .replace(/^[\u2800-\u28ff\u2733\u273b\u273d\uFE0F]+\s*/u, "")
    .replace(/^[\s:|.-]+/u, "")
    .trim();
}

export function extractPlainText(payload) {
  return payload
    .replace(ANSI_PATTERN, "")
    .replace(/\r/g, "\n")
    .replace(CONTROL_PATTERN, "");
}

export function summarizeStatusText(text, fallback = "") {
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);

  if (!line) return fallback;
  return line.slice(0, 120);
}

export function detectCodexAttentionText(text) {
  if (typeof text !== "string" || !text) return "";

  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const matchedLine = lines.find(
    (line) =>
      CODEX_INTERRUPTED_LINE_PATTERN.test(line) ||
      CODEX_CONNECTION_ISSUE_PATTERN.test(line)
  );
  if (matchedLine) {
    return summarizeStatusText(matchedLine, "Codex needs attention");
  }

  const joined = lines.join(" ");
  if (CODEX_GENERIC_ERROR_PATTERN.test(joined) && CODEX_FEEDBACK_PATTERN.test(joined)) {
    return summarizeStatusText(joined, "Codex needs attention");
  }

  return "";
}

export function looksLikeCodexSession(text) {
  return CODEX_SESSION_PATTERNS.some((pattern) => pattern.test(text));
}

export function isClaudeLaunchCommand(command) {
  return CLAUDE_LAUNCH_COMMAND.test(command);
}

export function isCodexLaunchCommand(command) {
  return CODEX_LAUNCH_COMMAND.test(command);
}

export function isCodexExitCommand(command) {
  return CODEX_EXIT_COMMAND.test(command);
}

export function classifyCodexSessionCommand(command) {
  const normalized = typeof command === "string" ? command.trim() : "";
  if (!normalized) return "unknown";
  if (!normalized.startsWith("/")) return "prompt";

  const [verb] = normalized.split(/\s+/, 1);
  if (CODEX_SESSION_UI_COMMANDS.has(verb.toLowerCase())) {
    return "ui";
  }

  return "slash";
}

export function classifyClaudeSessionCommand(command) {
  const normalized = typeof command === "string" ? command.trim() : "";
  if (!normalized) return "unknown";
  return normalized.startsWith("/") ? "ui" : "prompt";
}

export function getClaudeLaunchMode(command) {
  if (!isClaudeLaunchCommand(command)) return null;

  const tokens = command.trim().split(/\s+/).slice(1);
  for (const token of tokens) {
    if (!token) continue;
    return token.startsWith("-") ? "interactive" : "task";
  }

  return "interactive";
}

export function getCodexLaunchMode(command) {
  if (!isCodexLaunchCommand(command)) return null;

  const tokens = command.trim().split(/\s+/).slice(1);
  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith("-")) continue;
    return CODEX_NONINTERACTIVE_SUBCOMMANDS.has(token) ? "task" : "prompt";
  }

  return "interactive";
}

export function getAgentLaunchPreset(command) {
  const codexLaunchMode = getCodexLaunchMode(command);
  if (codexLaunchMode === "interactive") {
    return {
      provider: "codex",
      status: "waiting",
      title: "Codex ready",
    };
  }

  if (codexLaunchMode) {
    return {
      provider: "codex",
      status: "working",
      title: summarizeStatusText(command, "Codex"),
    };
  }

  const claudeLaunchMode = getClaudeLaunchMode(command);
  if (claudeLaunchMode === "interactive") {
    return {
      provider: "claude",
      status: "waiting",
      title: "Claude ready",
    };
  }

  if (claudeLaunchMode) {
    return {
      provider: "claude",
      status: "working",
      title: summarizeStatusText(command, "Claude"),
    };
  }

  return null;
}

export function parseAgentStatusTitle(title) {
  if (typeof title !== "string" || !title) return null;

  const normalizedTitle = title.trimStart();
  const firstChar = normalizedTitle.codePointAt(0);
  let status = null;
  if (firstChar >= 0x2800 && firstChar <= 0x28ff) {
    status = "working";
  } else if (AGENT_WAITING_TITLE_PREFIX.test(normalizedTitle)) {
    status = "waiting";
  }

  if (!status) return null;
  return {
    status,
    label: stripAgentTitlePrefix(normalizedTitle),
  };
}
