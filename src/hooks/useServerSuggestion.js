import { useEffect, useState } from "react";
import { inferServerLaunch } from "../utils/devServerSuggestion";

export default function useServerSuggestion(rootPath) {
  const [serverExpanded, setServerExpanded] = useState(false);
  const [serverSuggestion, setServerSuggestion] = useState({
    status: rootPath ? "loading" : "idle",
    value: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!rootPath) {
      setServerSuggestion({ status: "idle", value: null });
      return () => { cancelled = true; };
    }

    setServerSuggestion({ status: "loading", value: null });
    inferServerLaunch(rootPath).then((value) => {
      if (cancelled) return;
      setServerSuggestion({
        status: value ? "ready" : "idle",
        value,
      });
    });

    return () => { cancelled = true; };
  }, [rootPath]);

  const hasSubmenu = serverSuggestion.status === "loading" || !!serverSuggestion.value;

  const serverHint =
    serverSuggestion.status === "loading"
      ? "Inspecting the attached repo for a likely dev command"
      : serverSuggestion.value
        ? `Suggested: ${serverSuggestion.value.command}`
        : rootPath
          ? "Open a blank server tab in the attached repo"
          : "Open a blank server tab";

  const toggleServerExpanded = () => setServerExpanded((c) => !c);

  return { serverSuggestion, serverExpanded, hasSubmenu, serverHint, toggleServerExpanded };
}
