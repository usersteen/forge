import useForgeStore from "../store/useForgeStore";

export default function DocumentTabs() {
  const activeGroupId = useForgeStore((state) => state.activeGroupId);
  const groups = useForgeStore((state) => state.groups);
  const setActiveDocument = useForgeStore((state) => state.setActiveDocument);
  const closeDocument = useForgeStore((state) => state.closeDocument);
  const setActiveSurface = useForgeStore((state) => state.setActiveSurface);

  const activeGroup = groups.find((group) => group.id === activeGroupId);
  if (!activeGroup || activeGroup.openDocuments.length === 0) {
    return null;
  }

  return (
    <div className="document-tabs">
      {activeGroup.openDocuments.map((document) => (
        <div
          key={document.path}
          className={`document-tab ${activeGroup.activeDocumentPath === document.path ? "document-tab-active" : ""}`}
          onClick={() => setActiveDocument(activeGroup.id, document.path)}
        >
          <span className="document-tab-name">{document.title}</span>
          <button
            className="document-tab-close"
            onClick={(event) => {
              event.stopPropagation();
              closeDocument(activeGroup.id, document.path);
            }}
          >
            x
          </button>
        </div>
      ))}
      <button className="document-surface-toggle" onClick={() => setActiveSurface(activeGroup.id, "terminal")}>
        Terminal
      </button>
    </div>
  );
}
