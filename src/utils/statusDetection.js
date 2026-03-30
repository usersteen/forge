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

const CLAUDE_LAUNCH_COMMAND = /^claude(?:\s|$)/i;
const CODEX_LAUNCH_COMMAND = /^codex(?:\s|$)/i;
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

const AGENT_WAITING_TITLE_PREFIX = /^\u2733\uFE0F?/u;

function stripAgentTitlePrefix(title) {
  return title
    .replace(/^[\u2800-\u28ff\u2733\uFE0F]+\s*/u, "")
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

export function parseAgentStatusTitle(title) {
  if (typeof title !== "string" || !title) return null;

  const firstChar = title.codePointAt(0);
  let status = null;
  if (firstChar >= 0x2800 && firstChar <= 0x28ff) {
    status = "working";
  } else if (AGENT_WAITING_TITLE_PREFIX.test(title)) {
    status = "waiting";
  }

  if (!status) return null;
  return {
    status,
    label: stripAgentTitlePrefix(title),
  };
}
