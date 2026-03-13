import { convertFileSrc } from "@tauri-apps/api/core";
import useForgeStore from "../store/useForgeStore";
import { renderMarkdown } from "../utils/markdown";

function formatBytes(value) {
  if (value == null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getImageSrc(assetPath) {
  if (!assetPath) return "";
  return assetPath.startsWith("data:") ? assetPath : convertFileSrc(assetPath);
}

export default function InspectorPane({ onOpenImage }) {
  const activeGroupId = useForgeStore((state) => state.activeGroupId);
  const groups = useForgeStore((state) => state.groups);
  const workspaceByGroup = useForgeStore((state) => state.workspaceByGroup);
  const documentStateByGroup = useForgeStore((state) => state.documentStateByGroup);
  const setSelectedPath = useForgeStore((state) => state.setSelectedPath);

  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const workspace = workspaceByGroup[activeGroupId];
  const selectedDocument = activeGroup?.openDocuments.find((document) => document.path === activeGroup.selectedPath);
  const selectedDocumentState = activeGroup?.selectedPath
    ? documentStateByGroup[activeGroupId]?.[activeGroup.selectedPath]
    : null;

  if (!activeGroup?.inspectorVisible) {
    return null;
  }

  return (
    <aside className="inspector-pane">
      <div className="workspace-pane-header">
        <span>Inspector</span>
      </div>

      {!activeGroup.rootPath && (
        <div className="workspace-empty-state">
          <p>Bind a workspace folder to see file context.</p>
        </div>
      )}

      {activeGroup.rootPath && (
        <div className="inspector-sections">
          <section className="inspector-section">
            <h3>Selection</h3>
            {activeGroup.selectedPath ? (
              <>
                <div className="inspector-path">{activeGroup.selectedPath}</div>
                {selectedDocument ? (
                  <div className="inspector-meta">Previewing as {selectedDocument.type}</div>
                ) : (
                  <div className="inspector-meta">Selected in explorer</div>
                )}
              </>
            ) : (
              <div className="inspector-meta">No file selected.</div>
            )}
          </section>

          <section className="inspector-section">
            <h3>Preview</h3>
            {!selectedDocument && <div className="inspector-meta">Select a markdown, text, or image file to preview it.</div>}
            {selectedDocument && (!selectedDocumentState || selectedDocumentState.status === "loading") && (
              <div className="inspector-meta">Loading preview...</div>
            )}
            {selectedDocument && selectedDocumentState?.status === "error" && (
              <div className="inspector-meta">{selectedDocumentState.error || "Preview failed to load."}</div>
            )}
            {selectedDocument && selectedDocumentState?.status === "unsupported" && (
              <div className="inspector-meta">This file type is not supported for preview.</div>
            )}
            {selectedDocument && selectedDocumentState?.status === "too-large" && (
              <div className="inspector-meta">This file is too large to preview.</div>
            )}
            {selectedDocument && selectedDocumentState?.status === "ready" && selectedDocumentState.payload?.type === "markdown" && (
              <div
                className="inspector-preview inspector-preview-markdown"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedDocumentState.payload.content || "") }}
              />
            )}
            {selectedDocument && selectedDocumentState?.status === "ready" && selectedDocumentState.payload?.type === "text" && (
              <pre className="inspector-preview inspector-preview-text">{selectedDocumentState.payload.content || ""}</pre>
            )}
            {selectedDocument && selectedDocumentState?.status === "ready" && selectedDocumentState.payload?.type === "image" && selectedDocumentState.payload.assetPath && (
              <div className="inspector-preview inspector-preview-image-wrap">
                <img
                  className="inspector-preview-image"
                  src={getImageSrc(selectedDocumentState.payload.assetPath)}
                  alt={selectedDocument.title}
                />
              </div>
            )}
          </section>

          <section className="inspector-section">
            <h3>Recent Images</h3>
            {workspace?.recentImagesStatus === "loading" ? (
              <div className="inspector-meta">Loading images...</div>
            ) : null}
            {workspace?.recentImagesStatus === "error" ? (
              <div className="inspector-meta">{workspace.recentImagesError || "Image collection failed."}</div>
            ) : null}
            {workspace?.recentImagesStatus === "ready" && workspace.recentImages.length === 0 ? (
              <div className="inspector-meta">No recent images found.</div>
            ) : null}
            {workspace?.recentImages?.length > 0 ? (
              <div className="inspector-image-list">
                {workspace.recentImages.map((image) => (
                  <div
                    key={image.path}
                    className={`inspector-image-item ${activeGroup.selectedPath === image.path ? "inspector-image-item-selected" : ""}`}
                    onClick={() => setSelectedPath(activeGroup.id, image.path)}
                    onDoubleClick={() => onOpenImage(image.path)}
                  >
                    <div className="inspector-image-title">{image.title}</div>
                    <div className="inspector-image-meta">{formatBytes(image.byte_size)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </aside>
  );
}
