import { Note } from "../types";

const GIST_FILENAME = "bloco_de_notas.json";
const GIST_DESCRIPTION = "Bloco de Notas Nuvem - Backup e Sincronização Privada";

export interface GistSyncStatus {
  enabled: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  gistId: string | null;
  gistUrl: string | null;
  error: string | null;
  username: string | null;
}

export class GitHubGistService {
  private static TOKEN_KEY = "bloco_github_token";
  private static GIST_ID_KEY = "bloco_github_gist_id";
  private static LAST_SYNC_KEY = "bloco_github_last_sync";
  private static USERNAME_KEY = "bloco_github_username";

  static getToken(): string {
    return localStorage.getItem(this.TOKEN_KEY) || "";
  }

  static setToken(token: string): void {
    const clean = token.trim();
    if (clean) {
      localStorage.setItem(this.TOKEN_KEY, clean);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.GIST_ID_KEY);
      localStorage.removeItem(this.USERNAME_KEY);
      localStorage.removeItem(this.LAST_SYNC_KEY);
    }
  }

  static getGistId(): string {
    return localStorage.getItem(this.GIST_ID_KEY) || "";
  }

  static setGistId(gistId: string): void {
    if (gistId) {
      localStorage.setItem(this.GIST_ID_KEY, gistId);
    } else {
      localStorage.removeItem(this.GIST_ID_KEY);
    }
  }

  static getUsername(): string {
    return localStorage.getItem(this.USERNAME_KEY) || "";
  }

  static getLastSync(): number | null {
    const val = localStorage.getItem(this.LAST_SYNC_KEY);
    return val ? parseInt(val, 10) : null;
  }

  static async verifyToken(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          return { valid: false, error: "Token inválido ou expirado. Verifique as permissões no GitHub." };
        }
        return { valid: false, error: `Erro ao validar token (${res.status}).` };
      }

      const data = await res.json();
      localStorage.setItem(this.USERNAME_KEY, data.login || "");
      return { valid: true, username: data.login };
    } catch (err: any) {
      return { valid: false, error: err?.message || "Falha de conexão com a API do GitHub." };
    }
  }

  static async findOrCreateGist(token: string, initialNotes: Note[]): Promise<{ gistId: string; htmlUrl: string; notes?: Note[] }> {
    const existingGistId = this.getGistId();

    // 1. If we have a saved Gist ID, try to fetch it first
    if (existingGistId) {
      try {
        const res = await fetch(`https://api.github.com/gists/${existingGistId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        });

        if (res.ok) {
          const gist = await res.json();
          const file = gist.files?.[GIST_FILENAME];
          let remoteNotes: Note[] | undefined;
          if (file && file.content) {
            try {
              const parsed = JSON.parse(file.content);
              if (Array.isArray(parsed)) {
                remoteNotes = parsed;
              } else if (parsed && Array.isArray(parsed.notes)) {
                remoteNotes = parsed.notes;
              }
            } catch (e) {
              console.warn("Could not parse notes JSON from gist", e);
            }
          }
          return { gistId: existingGistId, htmlUrl: gist.html_url, notes: remoteNotes };
        }
      } catch (err) {
        console.warn("Failed to fetch existing gist by ID, searching...", err);
      }
    }

    // 2. Search user's gists for our file or description
    try {
      const listRes = await fetch("https://api.github.com/gists?per_page=100", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (listRes.ok) {
        const gists = await listRes.json();
        const found = gists.find(
          (g: any) =>
            (g.files && g.files[GIST_FILENAME]) ||
            g.description === GIST_DESCRIPTION
        );

        if (found) {
          this.setGistId(found.id);
          // Fetch full gist to get content
          const fullRes = await fetch(`https://api.github.com/gists/${found.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
          });
          if (fullRes.ok) {
            const fullGist = await fullRes.json();
            const file = fullGist.files?.[GIST_FILENAME];
            let remoteNotes: Note[] | undefined;
            if (file && file.content) {
              try {
                const parsed = JSON.parse(file.content);
                if (Array.isArray(parsed)) {
                  remoteNotes = parsed;
                } else if (parsed && Array.isArray(parsed.notes)) {
                  remoteNotes = parsed.notes;
                }
              } catch (e) {
                console.warn(e);
              }
            }
            return { gistId: found.id, htmlUrl: found.html_url, notes: remoteNotes };
          }
          return { gistId: found.id, htmlUrl: found.html_url };
        }
      }
    } catch (err) {
      console.warn("Could not list gists", err);
    }

    // 3. Create a new secret Gist
    const payload = {
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify({ notes: initialNotes, updatedAt: Date.now() }, null, 2),
        },
      },
    };

    const createRes = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      throw new Error(`Falha ao criar Gist no GitHub (${createRes.status}).`);
    }

    const newGist = await createRes.json();
    this.setGistId(newGist.id);
    return { gistId: newGist.id, htmlUrl: newGist.html_url, notes: initialNotes };
  }

  static async pushNotes(token: string, gistId: string, notes: Note[]): Promise<void> {
    const payload = {
      description: GIST_DESCRIPTION,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify({ notes, updatedAt: Date.now() }, null, 2),
        },
      },
    };

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Falha ao salvar no Gist (${res.status}).`);
    }

    localStorage.setItem(this.LAST_SYNC_KEY, Date.now().toString());
  }

  static async pullNotes(token: string, gistId: string): Promise<Note[] | null> {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      throw new Error(`Falha ao carregar do Gist (${res.status}).`);
    }

    const data = await res.json();
    const file = data.files?.[GIST_FILENAME];
    if (!file || !file.content) return null;

    try {
      const parsed = JSON.parse(file.content);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.notes)) return parsed.notes;
    } catch {
      return null;
    }
    return null;
  }
}
