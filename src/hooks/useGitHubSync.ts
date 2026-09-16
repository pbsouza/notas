import { useState, useEffect, useRef, useCallback } from "react";
import { Note } from "../types";
import { GitHubGistService } from "../services/githubGistSync";

export interface UseGitHubSyncReturn {
  isConfigured: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  username: string;
  gistId: string;
  gistUrl: string;
  error: string | null;
  saveToken: (token: string, currentNotes: Note[]) => Promise<{ success: boolean; message: string }>;
  disconnect: () => void;
  syncNow: (currentNotes: Note[], onNotesMerged: (merged: Note[]) => void) => Promise<boolean>;
}

export function useGitHubSync(
  notes: Note[],
  onNotesMerged: (merged: Note[]) => void
): UseGitHubSyncReturn {
  const [token, setTokenState] = useState<string>(() => GitHubGistService.getToken());
  const [username, setUsername] = useState<string>(() => GitHubGistService.getUsername());
  const [gistId, setGistIdState] = useState<string>(() => GitHubGistService.getGistId());
  const [gistUrl, setGistUrl] = useState<string>(() => {
    const id = GitHubGistService.getGistId();
    return id ? `https://gist.github.com/${id}` : "";
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => GitHubGistService.getLastSync());
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = Boolean(token && gistId);
  const notesRef = useRef<Note[]>(notes);
  notesRef.current = notes;

  // Manual or automatic sync
  const syncNow = useCallback(
    async (currentNotes: Note[], mergeCallback: (merged: Note[]) => void): Promise<boolean> => {
      const activeToken = GitHubGistService.getToken();
      const activeGistId = GitHubGistService.getGistId();
      if (!activeToken) return false;

      setIsSyncing(true);
      setError(null);

      try {
        let currentId = activeGistId;
        if (!currentId) {
          const res = await GitHubGistService.findOrCreateGist(activeToken, currentNotes);
          currentId = res.gistId;
          setGistIdState(res.gistId);
          setGistUrl(res.htmlUrl);
          if (res.notes && res.notes.length > 0) {
            mergeCallback(res.notes);
          }
        } else {
          // Pull remote notes first
          const remoteNotes = await GitHubGistService.pullNotes(activeToken, currentId);
          if (remoteNotes && remoteNotes.length > 0) {
            // Merge with local notes
            const map = new Map<string, Note>();
            currentNotes.forEach((n) => map.set(n.id, n));
            remoteNotes.forEach((rn) => {
              const existing = map.get(rn.id);
              if (!existing || (rn.updatedAt || 0) > (existing.updatedAt || 0)) {
                map.set(rn.id, rn);
              }
            });
            const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            mergeCallback(merged);
            // Push merged back to gist
            await GitHubGistService.pushNotes(activeToken, currentId, merged);
          } else {
            // Push current notes
            await GitHubGistService.pushNotes(activeToken, currentId, currentNotes);
          }
        }

        const now = Date.now();
        setLastSyncedAt(now);
        setIsSyncing(false);
        return true;
      } catch (err: any) {
        console.error("Gist sync error:", err);
        setError(err?.message || "Erro ao sincronizar com o GitHub Gist.");
        setIsSyncing(false);
        return false;
      }
    },
    []
  );

  // Save new Token
  const saveToken = useCallback(
    async (newToken: string, currentNotes: Note[]): Promise<{ success: boolean; message: string }> => {
      if (!newToken.trim()) {
        GitHubGistService.setToken("");
        setTokenState("");
        setUsername("");
        setGistIdState("");
        setGistUrl("");
        setLastSyncedAt(null);
        return { success: true, message: "Token removido." };
      }

      setIsSyncing(true);
      setError(null);

      const verify = await GitHubGistService.verifyToken(newToken);
      if (!verify.valid) {
        setIsSyncing(false);
        setError(verify.error || "Token inválido.");
        return { success: false, message: verify.error || "Token inválido." };
      }

      GitHubGistService.setToken(newToken.trim());
      setTokenState(newToken.trim());
      if (verify.username) setUsername(verify.username);

      try {
        const gistInfo = await GitHubGistService.findOrCreateGist(newToken.trim(), currentNotes);
        setGistIdState(gistInfo.gistId);
        setGistUrl(gistInfo.htmlUrl);

        if (gistInfo.notes && gistInfo.notes.length > 0) {
          onNotesMerged(gistInfo.notes);
        } else {
          await GitHubGistService.pushNotes(newToken.trim(), gistInfo.gistId, currentNotes);
        }

        setLastSyncedAt(Date.now());
        setIsSyncing(false);
        return { success: true, message: `Conectado com sucesso como @${verify.username}!` };
      } catch (err: any) {
        setIsSyncing(false);
        setError(err?.message || "Erro ao vincular Gist.");
        return { success: false, message: err?.message || "Erro ao vincular Gist." };
      }
    },
    [onNotesMerged]
  );

  // Disconnect
  const disconnect = useCallback(() => {
    GitHubGistService.setToken("");
    setTokenState("");
    setUsername("");
    setGistIdState("");
    setGistUrl("");
    setLastSyncedAt(null);
    setError(null);
  }, []);

  // Debounced auto-push when notes change and Gist is configured
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Initial pull on load if configured
      if (token && gistId) {
        syncNow(notesRef.current, onNotesMerged);
      }
      return;
    }

    if (!token || !gistId) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      GitHubGistService.pushNotes(token, gistId, notesRef.current)
        .then(() => {
          setLastSyncedAt(Date.now());
          setError(null);
        })
        .catch((err) => {
          console.warn("Auto-sync to Gist failed:", err);
        });
    }, 2500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [notes, token, gistId, syncNow, onNotesMerged]);

  return {
    isConfigured,
    isSyncing,
    lastSyncedAt,
    username,
    gistId,
    gistUrl,
    error,
    saveToken,
    disconnect,
    syncNow: (curNotes, callback) => syncNow(curNotes, callback),
  };
}
