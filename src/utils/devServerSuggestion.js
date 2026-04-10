import { invoke } from "@tauri-apps/api/core";

const LOCKFILE_TO_PACKAGE_MANAGER = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
];

function commandForPackageScript(packageManager, scriptName) {
  if (packageManager === "pnpm") {
    return `pnpm ${scriptName}`;
  }
  if (packageManager === "yarn") {
    return `yarn ${scriptName}`;
  }
  if (packageManager === "bun") {
    return `bun run ${scriptName}`;
  }
  return `npm run ${scriptName}`;
}

function makeSuggestion(command, reason, source = "script") {
  return { command, reason, source };
}

async function readWorkspaceFileIfPresent(rootPath, relativePath) {
  try {
    return await invoke("read_workspace_file", { rootPath, relativePath });
  } catch {
    return null;
  }
}

async function detectPackageManager(rootPath, packageJson) {
  const packageManagerField = packageJson?.packageManager;
  if (typeof packageManagerField === "string") {
    const normalized = packageManagerField.trim().toLowerCase();
    if (normalized.startsWith("pnpm@")) return "pnpm";
    if (normalized.startsWith("yarn@")) return "yarn";
    if (normalized.startsWith("bun@")) return "bun";
    if (normalized.startsWith("npm@")) return "npm";
  }

  const lockfiles = await Promise.all(
    LOCKFILE_TO_PACKAGE_MANAGER.map(async ([fileName, packageManager]) => ({
      fileName,
      packageManager,
      exists: Boolean(await readWorkspaceFileIfPresent(rootPath, fileName)),
    }))
  );

  const detected = lockfiles.find((entry) => entry.exists);
  return detected?.packageManager || "npm";
}

async function inferTauriLaunch(rootPath, scripts, packageManager) {
  if (typeof scripts?.tauri !== "string" || !scripts.tauri.trim()) {
    return null;
  }

  const tauriConfigFiles = await Promise.all([
    readWorkspaceFileIfPresent(rootPath, "src-tauri/tauri.conf.json"),
    readWorkspaceFileIfPresent(rootPath, "src-tauri/tauri.macos.conf.json"),
    readWorkspaceFileIfPresent(rootPath, "tauri.conf.json"),
  ]);

  const isTauriProject = tauriConfigFiles.some(Boolean);
  if (!isTauriProject) {
    return null;
  }

  return makeSuggestion(
    commandForPackageScript(packageManager, "tauri dev"),
    "Suggested from a Tauri repo and package.json scripts.tauri",
    "tauri"
  );
}

export async function inferDefaultServerLaunch(rootPath) {
  if (!rootPath) return null;

  const packageJsonFile = await readWorkspaceFileIfPresent(rootPath, "package.json");
  if (!packageJsonFile?.content) return null;

  let packageJson;
  try {
    packageJson = JSON.parse(packageJsonFile.content);
  } catch {
    return null;
  }

  const scripts = packageJson?.scripts;
  if (!scripts || typeof scripts !== "object") return null;

  const packageManager = await detectPackageManager(rootPath, packageJson);
  const tauriSuggestion = await inferTauriLaunch(rootPath, scripts, packageManager);
  if (tauriSuggestion) {
    return tauriSuggestion;
  }

  const scriptName =
    typeof scripts.dev === "string" && scripts.dev.trim()
      ? "dev"
      : typeof scripts.start === "string" && scripts.start.trim()
        ? "start"
        : null;

  if (!scriptName) return null;

  return makeSuggestion(
    commandForPackageScript(packageManager, scriptName),
    `Suggested from package.json scripts.${scriptName}`,
    "script"
  );
}

export async function inferServerLaunch(rootPath, preferredCommand = null) {
  const normalizedPreferredCommand =
    typeof preferredCommand === "string" && preferredCommand.trim()
      ? preferredCommand.trim()
      : null;

  if (normalizedPreferredCommand) {
    return makeSuggestion(normalizedPreferredCommand, "Saved for this project", "saved");
  }

  return inferDefaultServerLaunch(rootPath);
}
