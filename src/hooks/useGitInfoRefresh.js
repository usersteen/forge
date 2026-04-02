import { useEffect, useRef } from "react";
import useForgeStore, { refreshGitInfo } from "../store/useForgeStore";

const REFRESH_INTERVAL_MS = 30000;

export default function useGitInfoRefresh() {
  const groups = useForgeStore((s) => s.groups);
  const refreshedIds = useRef(new Set());

  // Refresh git info for any group that has a rootPath but no gitCommonDir yet
  useEffect(() => {
    for (const group of groups) {
      if (group.rootPath && !refreshedIds.current.has(group.id)) {
        refreshedIds.current.add(group.id);
        refreshGitInfo(group.id);
      }
    }
  }, [groups]);

  // Periodic refresh of branch names (picks up branch switches in terminal)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = useForgeStore.getState().groups;
      for (const group of current) {
        if (group.gitCommonDir) {
          refreshGitInfo(group.id);
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
