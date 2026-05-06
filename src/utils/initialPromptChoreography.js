import { isClaudeLaunchCommand, isCodexLaunchCommand } from "./statusDetection.js";

export const INITIAL_PROMPT_PASTE_POLL_MS = 300;

const DEFAULT_TIMING = {
  minDelayMs: 1200,
  fallbackMs: 6000,
};

const PROVIDER_TIMING = {
  claude: {
    minDelayMs: 1000,
    fallbackMs: 5000,
  },
  codex: {
    minDelayMs: 1500,
    fallbackMs: 7000,
  },
};

const BRACKETED_PASTE_ACK_PATTERN =
  /\[[^\]\r\n]*(?:paste|pasted)[^\]\r\n]*(?:content|text|chars?|characters?|\d)[^\]\r\n]*\]/i;

function providerForLaunchCommand(command) {
  if (isCodexLaunchCommand(command)) return "codex";
  if (isClaudeLaunchCommand(command)) return "claude";
  return "default";
}

export function getInitialPromptPasteTiming(command) {
  return PROVIDER_TIMING[providerForLaunchCommand(command)] || DEFAULT_TIMING;
}

function promptMarkers(prompt) {
  const lines = String(prompt || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const lastLongLine = [...lines].reverse().find((line) => line.length >= 18);
  return [
    lines.find((line) => line.length >= 18),
    lastLongLine,
  ].filter(Boolean);
}

export function initialPromptPasteSettled({ command, prompt, screenText, elapsedMs }) {
  const timing = getInitialPromptPasteTiming(command);
  const text = screenText || "";

  if (elapsedMs >= timing.fallbackMs) {
    return { settled: true, reason: "timeout" };
  }

  if (elapsedMs < timing.minDelayMs) {
    return { settled: false, reason: "minimum-delay" };
  }

  if (BRACKETED_PASTE_ACK_PATTERN.test(text)) {
    return { settled: true, reason: "paste-ack" };
  }

  if (String(prompt || "").length <= 1200) {
    const visibleMarker = promptMarkers(prompt).find((marker) => text.includes(marker));
    if (visibleMarker) {
      return { settled: true, reason: "visible-prompt" };
    }
  }

  return { settled: false, reason: "waiting-for-paste" };
}
