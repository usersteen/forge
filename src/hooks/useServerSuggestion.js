import { useEffect, useState } from "react";
import { inferDefaultServerLaunch } from "../utils/devServerSuggestion";

export default function useServerSuggestion(rootPath, preferredCommand = null) {
  const [serverExpanded, setServerExpanded] = useState(false);
  const [defaultServerSuggestion, setDefaultServerSuggestion] = useState({
    status: rootPath ? "loading" : "idle",
    value: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!rootPath) {
      setDefaultServerSuggestion({ status: "idle", value: null });
      return () => { cancelled = true; };
    }

    setDefaultServerSuggestion({ status: "loading", value: null });
    inferDefaultServerLaunch(rootPath).then((value) => {
      if (cancelled) return;
      setDefaultServerSuggestion({
        status: value ? "ready" : "idle",
        value,
      });
    });

    return () => { cancelled = true; };
  }, [rootPath]);

  const serverSuggestion =
    typeof preferredCommand === "string" && preferredCommand.trim()
      ? {
          status: "ready",
          value: {
            command: preferredCommand.trim(),
            reason: "Saved for this project",
            source: "saved",
          },
        }
      : defaultServerSuggestion;

  const hasSubmenu = defaultServerSuggestion.status === "loading" || !!serverSuggestion.value;

  const serverHint =
    !serverSuggestion.value && defaultServerSuggestion.status === "loading"
      ? "Inspecting the attached repo for a likely dev command"
      : serverSuggestion.value
        ? "Open a server tab or choose a launch command"
        : rootPath
          ? "Open a blank server tab in the attached repo"
          : "Open a blank server tab";

  const toggleServerExpanded = () => setServerExpanded((c) => !c);

  return {
    serverSuggestion,
    defaultServerSuggestion,
    serverExpanded,
    hasSubmenu,
    serverHint,
    toggleServerExpanded,
  };
}
