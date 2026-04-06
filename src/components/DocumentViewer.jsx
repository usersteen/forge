import { useEffect, useMemo, useRef, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import useForgeStore from "../store/useForgeStore";
import ParticleLayer from "./ParticleLayer";
import { renderMarkdown } from "../utils/markdown";


function formatBytes(value) {
  if (value == null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeFilePayload(payload) {
  const type = payload.type ?? payload.file_type ?? "unsupported";
  return {
    path: payload.path,
    type,
    title: payload.title,
    content: payload.content ?? null,
    assetPath: payload.assetPath ?? payload.asset_path ?? null,
    byteSize: payload.byteSize ?? payload.byte_size ?? 0,
    truncated: payload.truncated ?? false,
  };
}

function getImageSrc(assetPath) {
  if (!assetPath) return "";
  return assetPath.startsWith("data:") ? assetPath : convertFileSrc(assetPath);
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export default function DocumentViewer() {
  const activeGroupId = useForgeStore((state) => state.activeGroupId);
  const groups = useForgeStore((state) => state.groups);
  const documentStateByGroup = useForgeStore((state) => state.documentStateByGroup);
  const setActiveDocument = useForgeStore((state) => state.setActiveDocument);
  const closeDocument = useForgeStore((state) => state.closeDocument);
  const setDocumentState = useForgeStore((state) => state.setDocumentState);
  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const documentStateMap = documentStateByGroup[activeGroupId] || {};
  const activeDocument = activeGroup?.openDocuments.find(
    (document) => document.path === activeGroup.activeDocumentPath
  );
  const documentState = activeDocument ? documentStateMap[activeDocument.path] : null;

  const [draftsByPath, setDraftsByPath] = useState({});
  const [editModeByPath, setEditModeByPath] = useState({});
  const [savingByPath, setSavingByPath] = useState({});
  const [saveErrorsByPath, setSaveErrorsByPath] = useState({});
  const [reloadingByPath, setReloadingByPath] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);

  useEffect(() => {
    if (!activeGroup) return;
    const openPaths = new Set(activeGroup.openDocuments.map((document) => document.path));

    const filterMap = (current) =>
      Object.fromEntries(Object.entries(current).filter(([path]) => openPaths.has(path)));

    setDraftsByPath(filterMap);
    setEditModeByPath(filterMap);
    setSavingByPath(filterMap);
    setSaveErrorsByPath(filterMap);
    setReloadingByPath(filterMap);
  }, [activeGroup]);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const handlePointerDown = (event) => {
      if (contextMenuRef.current?.contains(event.target)) return;
      setContextMenu(null);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    setContextMenu(null);
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeDocument || documentState?.status !== "ready" || documentState.payload?.type !== "markdown") {
      return;
    }

    setDraftsByPath((current) => {
      if (current[activeDocument.path] !== undefined) {
        return current;
      }
      return {
        ...current,
        [activeDocument.path]: documentState.payload.content || "",
      };
    });
  }, [
    activeDocument,
    documentState?.payload?.content,
    documentState?.payload?.type,
    documentState?.status,
  ]);

  const isMarkdown = documentState?.payload?.type === "markdown";
  const activeContent = documentState?.payload?.content || "";
  const activeDraft = activeDocument ? draftsByPath[activeDocument.path] : undefined;
  const editorValue = activeDraft ?? activeContent;
  const isEditing = Boolean(activeDocument && editModeByPath[activeDocument.path]);
  const isSaving = Boolean(activeDocument && savingByPath[activeDocument.path]);
  const isReloading = Boolean(activeDocument && reloadingByPath[activeDocument.path]);
  const saveError = activeDocument ? saveErrorsByPath[activeDocument.path] : "";
  const isDirty = Boolean(isMarkdown && activeDocument && editorValue !== activeContent);

  const dirtyPaths = useMemo(() => {
    const result = new Set();
    if (!activeGroup) return result;

    for (const document of activeGroup.openDocuments) {
      const documentStateEntry = documentStateMap[document.path];
      if (document.type !== "markdown" || documentStateEntry?.payload?.type !== "markdown") {
        continue;
      }
      const draft = draftsByPath[document.path];
      if (draft !== undefined && draft !== (documentStateEntry.payload.content || "")) {
        result.add(document.path);
      }
    }

    return result;
  }, [activeGroup, documentStateMap, draftsByPath]);

  useEffect(() => {
    if (dirtyPaths.size === 0) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyPaths]);

  if (!activeGroup || activeGroup.openDocuments.length === 0) {
    return null;
  }

  const handleToggleEdit = () => {
    if (!activeDocument || !isMarkdown) return;
    setEditModeByPath((current) => ({
      ...current,
      [activeDocument.path]: !current[activeDocument.path],
    }));
    setSaveErrorsByPath((current) => ({
      ...current,
      [activeDocument.path]: "",
    }));
  };

  const handleSave = async () => {
    if (!activeGroup?.rootPath || !activeDocument || !isMarkdown) return;

    const nextContent = draftsByPath[activeDocument.path] ?? activeContent;
    if (nextContent === activeContent) return;

    setSavingByPath((current) => ({
      ...current,
      [activeDocument.path]: true,
    }));
    setSaveErrorsByPath((current) => ({
      ...current,
      [activeDocument.path]: "",
    }));

    try {
      const payload = await invoke("write_workspace_file", {
        rootPath: activeGroup.rootPath,
        relativePath: activeDocument.path,
        content: nextContent,
      });
      const normalizedPayload = normalizeFilePayload(payload);
      setDocumentState(activeGroup.id, activeDocument.path, {
        status: "ready",
        error: "",
        payload: normalizedPayload,
      });
      setDraftsByPath((current) => ({
        ...current,
        [activeDocument.path]: normalizedPayload.content || "",
      }));
      setEditModeByPath((current) => ({
        ...current,
        [activeDocument.path]: false,
      }));
    } catch (error) {
      setSaveErrorsByPath((current) => ({
        ...current,
        [activeDocument.path]: String(error),
      }));
    } finally {
      setSavingByPath((current) => ({
        ...current,
        [activeDocument.path]: false,
      }));
    }
  };

  const handleReloadDocument = async (documentPath) => {
    if (!activeGroup?.rootPath || !documentPath) return;
    const targetDocument = activeGroup.openDocuments.find((document) => document.path === documentPath);
    if (!targetDocument) return;

    if (
      dirtyPaths.has(documentPath) &&
      !window.confirm(`Discard unsaved changes in ${targetDocument.title} and reload from disk?`)
    ) {
      return;
    }

    setReloadingByPath((current) => ({
      ...current,
      [documentPath]: true,
    }));
    setSaveErrorsByPath((current) => ({
      ...current,
      [documentPath]: "",
    }));
    setDocumentState(activeGroup.id, documentPath, {
      status: "loading",
      error: "",
      payload: null,
    });

    try {
      const payload = await invoke("read_workspace_file", {
        rootPath: activeGroup.rootPath,
        relativePath: documentPath,
      });
      const normalizedPayload = normalizeFilePayload(payload);
      const nextStatus =
        normalizedPayload.type === "unsupported"
          ? "unsupported"
          : normalizedPayload.truncated
            ? "too-large"
            : "ready";

      setDocumentState(activeGroup.id, documentPath, {
        status: nextStatus,
        error: "",
        payload: normalizedPayload,
      });
      setDraftsByPath((current) => ({
        ...current,
        [documentPath]: normalizedPayload.content || "",
      }));
    } catch (error) {
      setDocumentState(activeGroup.id, documentPath, {
        status: "error",
        error: String(error),
        payload: null,
      });
    } finally {
      setReloadingByPath((current) => ({
        ...current,
        [documentPath]: false,
      }));
    }
  };

  const handleCloseDocument = (document) => {
    if (!document || !activeGroup) return;
    if (dirtyPaths.has(document.path) && !window.confirm(`Discard unsaved changes in ${document.title}?`)) {
      return;
    }
    closeDocument(activeGroup.id, document.path);
  };

  const handleRevert = () => {
    if (!activeDocument || !isMarkdown) return;
    setDraftsByPath((current) => ({
      ...current,
      [activeDocument.path]: activeContent,
    }));
    setSaveErrorsByPath((current) => ({
      ...current,
      [activeDocument.path]: "",
    }));
  };

  const openDocumentContextMenu = (event, document) => {
    if (!document) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      path: document.path,
      title: document.title,
    });
  };

  return (
    <aside
      className="document-viewer-shell"
      onContextMenu={(event) => {
        if (isEditableTarget(event.target)) return;
        if (window.getSelection?.()?.toString()) return;
        if (activeDocument) {
          openDocumentContextMenu(event, activeDocument);
          return;
        }
        event.preventDefault();
      }}
    >
      <div className="document-viewer-header">
        <div className="document-viewer-tab-bar">
          <ParticleLayer location="documentTabs" />
          <div className="document-viewer-tabs">
            {activeGroup.openDocuments.map((document) => (
              <div
                key={document.path}
                role="button"
                tabIndex={0}
                className={`document-viewer-tab ${activeGroup.activeDocumentPath === document.path ? "document-viewer-tab-active" : ""}`}
                onClick={() => setActiveDocument(activeGroup.id, document.path)}
                onContextMenu={(event) => openDocumentContextMenu(event, document)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveDocument(activeGroup.id, document.path);
                  }
                }}
              >
                <span className="document-viewer-tab-name">{document.title}</span>
                {dirtyPaths.has(document.path) ? <span className="document-viewer-tab-dirty" /> : null}
                <span
                  className="document-viewer-tab-close"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCloseDocument(document);
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  x
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!activeDocument ? (
        <div className="document-viewer-empty">
          <p>No document is open for this project.</p>
        </div>
      ) : null}

      {activeDocument && (!documentState || documentState.status === "loading") ? (
        <div className="document-viewer-empty">
          <p>Loading document...</p>
        </div>
      ) : null}

      {activeDocument && documentState?.status === "error" ? (
        <div className="document-viewer-empty">
          <p>{documentState.error || "The document could not be loaded."}</p>
        </div>
      ) : null}

      {activeDocument && documentState?.status === "unsupported" ? (
        <div className="document-viewer-empty">
          <p>This file type is not supported for preview.</p>
        </div>
      ) : null}

      {activeDocument && documentState?.status === "too-large" ? (
        <div className="document-viewer-empty">
          <p>This file is too large to preview.</p>
          {documentState.payload ? (
            <p className="document-viewer-subtle">{documentState.payload.byteSize.toLocaleString()} bytes</p>
          ) : null}
        </div>
      ) : null}

      {activeDocument && documentState?.status === "ready" ? (
        <div className="document-viewer-body">
          <div className="document-viewer-content-header">
            <div className="document-viewer-meta">
              <div className="document-viewer-path" title={activeDocument.path}>
                {activeDocument.path}
              </div>
              {activeDocument && documentState?.status === "too-large" && documentState.payload ? (
                <div className="document-viewer-status">
                  Preview unavailable: {formatBytes(documentState.payload.byteSize)}
                </div>
              ) : null}
              {!saveError && isDirty ? <div className="document-viewer-dirty-label">Unsaved changes</div> : null}
              {saveError ? <div className="document-viewer-status">{saveError}</div> : null}
            </div>
            {isMarkdown ? (
              <button type="button" className="document-viewer-action" onClick={handleToggleEdit}>
                {isEditing ? "Preview" : "Edit"}
              </button>
            ) : null}
            <button
              type="button"
              className="document-viewer-action"
              onClick={() => handleReloadDocument(activeDocument.path)}
              disabled={isReloading || isSaving}
            >
              {isReloading ? "Reloading..." : "Reload"}
            </button>
            {isEditing && isDirty ? (
              <button type="button" className="document-viewer-action" onClick={handleRevert}>
                Revert
              </button>
            ) : null}
            {isEditing ? (
              <button
                type="button"
                className={`document-viewer-action ${isDirty ? "document-viewer-action-primary" : ""}`}
                onClick={handleSave}
                disabled={!isDirty || isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            ) : null}
          </div>

          {documentState.payload?.type === "markdown" && isEditing ? (
            <textarea
              className="document-editor"
              value={editorValue}
              spellCheck={false}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDraftsByPath((current) => ({
                  ...current,
                  [activeDocument.path]: nextValue,
                }));
              }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                  event.preventDefault();
                  handleSave();
                }
              }}
            />
          ) : null}

          {documentState.payload?.type === "markdown" && !isEditing ? (
            <div
              className="document-markdown"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(documentState.payload.content || "") }}
            />
          ) : null}

          {documentState.payload?.type === "text" ? (
            <pre className="document-text">{documentState.payload.content || ""}</pre>
          ) : null}

          {documentState.payload?.type === "image" && documentState.payload.assetPath ? (
            <div className="document-image-wrap">
              <img className="document-image" src={getImageSrc(documentState.payload.assetPath)} alt={activeDocument.title} />
            </div>
          ) : null}
        </div>
      ) : null}
      {contextMenu ? (
        <div ref={contextMenuRef} className="tab-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            type="button"
            className="tab-context-item"
            onClick={() => {
              setContextMenu(null);
              void handleReloadDocument(contextMenu.path);
            }}
          >
            Reload {contextMenu.title}
          </button>
          <button
            type="button"
            className="tab-context-item"
            onClick={() => {
              const targetDocument = activeGroup.openDocuments.find((document) => document.path === contextMenu.path);
              setContextMenu(null);
              if (targetDocument) {
                handleCloseDocument(targetDocument);
              }
            }}
          >
            Close {contextMenu.title}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
