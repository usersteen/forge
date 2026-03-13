export const MARKDOWN_EXTENSIONS = new Set(["md", "mdx", "markdown"]);
export const TEXT_EXTENSIONS = new Set([
  "txt",
  "log",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "env",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "html",
  "rs",
  "py",
  "sh",
  "ps1",
  "c",
  "h",
  "cpp",
  "hpp",
  "java",
  "go",
  "rb",
  "php",
  "sql",
]);
export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);

export const DEFAULT_EXPLORER_STATE = {
  status: "empty",
  error: "",
  rootPath: null,
  tree: [],
  recentImages: [],
  recentImagesStatus: "idle",
  recentImagesError: "",
};

export const DEFAULT_READER_WIDTH = 0.4;
export const MIN_READER_WIDTH = 0.28;
export const MAX_READER_WIDTH = 0.62;

export function normalizeRootPath(path) {
  if (!path || typeof path !== "string") return null;
  const normalized = path.trim().replace(/[\\/]+/g, "/");
  return normalized.replace(/\/+$/, "") || null;
}

export function normalizeRelativePath(path) {
  if (!path || typeof path !== "string") return null;
  const normalized = path
    .trim()
    .replace(/[\\/]+/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
  if (!normalized || normalized.split("/").some((part) => part === "..")) {
    return null;
  }
  return normalized;
}

export function classifyWorkspacePath(path) {
  const normalized = normalizeRelativePath(path) ?? path ?? "";
  const extension = normalized.includes(".") ? normalized.split(".").pop().toLowerCase() : "";
  if (MARKDOWN_EXTENSIONS.has(extension)) return "markdown";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  return "other";
}

export function titleFromPath(path) {
  const normalized = normalizeRelativePath(path) ?? path ?? "";
  if (!normalized) return "Untitled";
  const segments = normalized.split("/");
  return segments[segments.length - 1] || "Untitled";
}

export function normalizeDocumentRef(doc) {
  const path = normalizeRelativePath(doc?.path);
  if (!path) return null;
  const type = ["markdown", "text", "image"].includes(doc?.type) ? doc.type : classifyWorkspacePath(path);
  if (!["markdown", "text", "image"].includes(type)) return null;
  return {
    path,
    title: typeof doc?.title === "string" && doc.title.trim() ? doc.title.trim() : titleFromPath(path),
    type,
  };
}

export function normalizeSurface(surface, openDocuments) {
  if (surface === "document" && openDocuments.length > 0) {
    return "document";
  }
  return "terminal";
}

export function normalizeReaderWidth(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_READER_WIDTH;
  }
  return Math.min(MAX_READER_WIDTH, Math.max(MIN_READER_WIDTH, numericValue));
}

export function withWorkspaceDefaults(group) {
  const openDocuments = Array.isArray(group?.open_documents)
    ? group.open_documents.map((doc) => normalizeDocumentRef({
        path: doc?.path,
        title: doc?.title,
        type: doc?.type,
      })).filter(Boolean)
    : [];

  const activeDocumentPath = normalizeRelativePath(group?.active_document_path);
  const reconciledActiveDocumentPath = openDocuments.some((doc) => doc.path === activeDocumentPath)
    ? activeDocumentPath
    : null;

  return {
    rootPath: normalizeRootPath(group?.root_path),
    explorerVisible: group?.explorer_visible ?? true,
    inspectorVisible: group?.inspector_visible ?? true,
    selectedPath: normalizeRelativePath(group?.selected_path),
    openDocuments,
    activeDocumentPath: reconciledActiveDocumentPath,
    activeSurface: normalizeSurface(group?.active_surface, openDocuments),
    readerWidth: normalizeReaderWidth(group?.reader_width),
    lastIndexedAt: typeof group?.last_indexed_at === "number" ? group.last_indexed_at : null,
  };
}

export function makeRuntimeWorkspaceState(rootPath = null) {
  return {
    ...DEFAULT_EXPLORER_STATE,
    rootPath,
  };
}
