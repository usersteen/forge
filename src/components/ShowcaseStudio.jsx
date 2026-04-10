import useForgeStore from "../store/useForgeStore";
import { showcaseScenes } from "../demo/showcaseScenes";

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3.5 5.5 8 10 12.5" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5 1.5 8 6 12.5" />
      <path d="M2 8h8.5" />
      <path d="M10.5 2.5h2v11h-2" />
    </svg>
  );
}

export default function ShowcaseStudio() {
  const showcaseSceneId = useForgeStore((state) => state.showcaseSceneId);
  const showcaseMeta = useForgeStore((state) => state.showcaseMeta);
  const showcaseStudioVisible = useForgeStore((state) => state.showcaseStudioVisible);
  const showcaseCleanMode = useForgeStore((state) => state.showcaseCleanMode);
  const loadShowcaseScene = useForgeStore((state) => state.loadShowcaseScene);
  const setShowcaseStudioVisible = useForgeStore((state) => state.setShowcaseStudioVisible);
  const setShowcaseCleanMode = useForgeStore((state) => state.setShowcaseCleanMode);
  const exitShowcase = useForgeStore((state) => state.exitShowcase);

  const sceneIndex = Math.max(0, showcaseScenes.findIndex((scene) => scene.id === showcaseSceneId));
  const currentScene = showcaseScenes[sceneIndex] || showcaseScenes[0];

  if (!showcaseStudioVisible) {
    return (
      <button
        type="button"
        className="showcase-rail"
        onClick={() => setShowcaseStudioVisible(true)}
        title="Open Showcase Studio"
      >
        <span className="showcase-rail-label">Studio</span>
        <span className="showcase-rail-scene">{currentScene?.feature || "Scene"}</span>
      </button>
    );
  }

  const goToScene = (nextSceneId) => loadShowcaseScene(nextSceneId, {
    studioVisible: true,
    cleanMode: showcaseCleanMode,
  });

  return (
    <aside className="showcase-studio">
      <div className="showcase-studio-header">
        <div>
          <div className="showcase-studio-kicker">Showcase Studio</div>
          <h2 className="showcase-studio-title">Deterministic staging for landing assets.</h2>
        </div>
        <div className="showcase-studio-header-actions">
          <button
            type="button"
            className="showcase-studio-exit-btn"
            onClick={() => setShowcaseStudioVisible(false)}
            title="Hide studio"
          >
            Hide Panel
          </button>
          <button
            type="button"
            className="showcase-studio-exit-btn showcase-studio-exit-btn-strong"
            onClick={exitShowcase}
            title="Exit showcase"
          >
            <span className="showcase-studio-exit-icon" aria-hidden="true">
              <ExitIcon />
            </span>
            <span>Exit Showcase</span>
          </button>
        </div>
      </div>

      <div className="showcase-studio-status">
        <span className="showcase-chip">Real components</span>
        <span className="showcase-chip">Seeded state</span>
        <span className="showcase-chip">{showcaseCleanMode ? "Capture mode" : "Review mode"}</span>
      </div>

      <section className="showcase-studio-panel showcase-studio-panel-featured">
        <div className="showcase-scene-headline-row">
          <button
            type="button"
            className="showcase-scene-nav"
            onClick={() => goToScene(showcaseScenes[(sceneIndex - 1 + showcaseScenes.length) % showcaseScenes.length].id)}
            aria-label="Previous scene"
          >
            <ChevronLeft />
          </button>
          <div className="showcase-scene-headline">
            <div className="showcase-scene-kicker">{showcaseMeta?.kicker || currentScene?.kicker}</div>
            <div className="showcase-scene-title">{showcaseMeta?.title || currentScene?.title}</div>
            <p className="showcase-scene-summary">{showcaseMeta?.summary || currentScene?.summary}</p>
          </div>
          <button
            type="button"
            className="showcase-scene-nav"
            onClick={() => goToScene(showcaseScenes[(sceneIndex + 1) % showcaseScenes.length].id)}
            aria-label="Next scene"
          >
            <ChevronRight />
          </button>
        </div>
        <div className="showcase-scene-meta-row">
          <span className="showcase-scene-index">
            {String(sceneIndex + 1).padStart(2, "0")} / {String(showcaseScenes.length).padStart(2, "0")}
          </span>
          <span className="showcase-scene-feature">{showcaseMeta?.feature || currentScene?.feature}</span>
        </div>
      </section>

      <section className="showcase-studio-panel">
        <div className="showcase-panel-label">Scenes</div>
        <div className="showcase-scene-list">
          {showcaseScenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={`showcase-scene-card${scene.id === showcaseSceneId ? " showcase-scene-card-active" : ""}`}
              onClick={() => goToScene(scene.id)}
            >
              <span className="showcase-scene-card-kicker">{scene.feature}</span>
              <span className="showcase-scene-card-title">{scene.title}</span>
              <span className="showcase-scene-card-summary">{scene.summary}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="showcase-studio-panel">
        <div className="showcase-panel-label">Capture</div>
        <div className="showcase-capture-row">
          <button
            type="button"
            className={`showcase-toggle${showcaseCleanMode ? " showcase-toggle-active" : ""}`}
            onClick={() => setShowcaseCleanMode(!showcaseCleanMode)}
          >
            {showcaseCleanMode ? "Disable clean capture" : "Enable clean capture"}
          </button>
          <div className="showcase-capture-hint">`Shift+S` toggles the studio dock while you frame the shot.</div>
        </div>
        <p className="showcase-capture-note">{showcaseMeta?.captureNotes || currentScene?.captureNotes}</p>
      </section>

      <section className="showcase-studio-panel">
        <div className="showcase-panel-label">Use This Scene For</div>
        <div className="showcase-note-list">
          {(showcaseMeta?.notes || currentScene?.notes || []).map((note) => (
            <div key={note} className="showcase-note-item">{note}</div>
          ))}
        </div>
      </section>
    </aside>
  );
}
