import React, { useState } from "react";
import {
  X,
  Smartphone,
  Laptop,
  Copy,
  Check,
  RefreshCw,
  Radio,
  QrCode,
  ShieldCheck,
  Edit2,
  Lock,
  ExternalLink,
  Eye,
  EyeOff,
  Github,
  Key,
  CheckCircle2,
  AlertCircle,
  Cloud,
} from "lucide-react";
import { ConnectedDevice, Note } from "../types";
import { UseGitHubSyncReturn } from "../hooks/useGitHubSync";

interface DeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  setRoomId: (newRoom: string) => void;
  devices: ConnectedDevice[];
  isConnected: boolean;
  deviceId: string;
  deviceName: string;
  setDeviceName: (name: string) => void;
  serverUrl?: string;
  setServerUrl?: (url: string) => void;
  isStaticHost?: boolean;
  githubSync?: UseGitHubSyncReturn;
  notes?: Note[];
  onNotesMerged?: (merged: Note[]) => void;
}

export const DeviceSyncModal: React.FC<DeviceSyncModalProps> = ({
  isOpen,
  onClose,
  roomId,
  setRoomId,
  devices,
  isConnected,
  deviceId,
  deviceName,
  setDeviceName,
  serverUrl = "",
  setServerUrl,
  isStaticHost = false,
  githubSync,
  notes = [],
  onNotesMerged,
}) => {
  const [activeTab, setActiveTab] = useState<"gist" | "live">(() => {
    if (githubSync?.isConfigured || isStaticHost) return "gist";
    return "live";
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [roomInput, setRoomInput] = useState(roomId);
  const [serverInput, setServerInput] = useState(serverUrl);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);
  const [showQr, setShowQr] = useState(false);

  // GitHub Gist form state
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [gistStatusMsg, setGistStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("room", roomId);
  const syncUrl = currentUrl.toString();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(syncUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim()) {
      setRoomId(roomInput.trim());
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      setDeviceName(tempName.trim());
      setIsEditingName(false);
    }
  };

  const handleConnectGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || !githubSync) return;
    setIsSavingToken(true);
    setGistStatusMsg(null);

    const result = await githubSync.saveToken(tokenInput.trim(), notes);
    setIsSavingToken(false);

    if (result.success) {
      setGistStatusMsg({ type: "success", text: result.message });
      setTokenInput("");
    } else {
      setGistStatusMsg({ type: "error", text: result.message });
    }
  };

  const handleSyncGistNow = async () => {
    if (!githubSync || !onNotesMerged) return;
    setGistStatusMsg(null);
    const ok = await githubSync.syncNow(notes, onNotesMerged);
    if (ok) {
      setGistStatusMsg({ type: "success", text: "Notas sincronizadas com seu GitHub com sucesso!" });
      setTimeout(() => setGistStatusMsg(null), 3000);
    }
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return "Nunca";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 30) return "Agora mesmo";
    if (diff < 60) return "Há menos de um minuto";
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `Há ${mins} min`;
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    syncUrl
  )}&bgcolor=ffffff&color=0f172a&margin=1`;

  return (
    <div
      id="sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="sync-modal"
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shrink-0">
              <Github className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white truncate">
                Sincronização entre Aparelhos
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    githubSync?.isConfigured
                      ? "bg-emerald-500 animate-pulse"
                      : isConnected
                      ? "bg-emerald-500 animate-pulse"
                      : isStaticHost && !serverUrl
                      ? "bg-amber-400"
                      : "bg-blue-400 animate-pulse"
                  }`}
                />
                <span className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {githubSync?.isConfigured
                    ? `Sincronizado com GitHub (@${githubSync.username})`
                    : isConnected
                    ? "Sincronização ao vivo conectada"
                    : isStaticHost && !serverUrl
                    ? "GitHub Pages (Sem servidor)"
                    : "Tentando conectar ao servidor..."}
                </span>
              </div>
            </div>
          </div>
          <button
            id="close-sync-modal"
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-100 dark:border-neutral-800 px-3 sm:px-6 bg-neutral-50/50 dark:bg-neutral-900/50 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("gist")}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "gist"
                ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            <Github className="w-4 h-4" />
            <span>GitHub Gist (100% Grátis)</span>
            <span className="text-[9px] sm:text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-medium">
              Recomendado
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "live"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Servidor / WebSocket</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          {activeTab === "gist" && (
            <div className="space-y-4">
              {/* How it works banner */}
              <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 rounded-xl space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                <div className="font-semibold flex items-center gap-1.5 text-neutral-900 dark:text-white">
                  <Github className="w-4 h-4 text-neutral-800 dark:text-neutral-200" />
                  <span>Como funciona a sincronização no GitHub Pages?</span>
                </div>
                <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Como você só tem o GitHub e não possui um servidor backend ativo, o aplicativo utiliza a{" "}
                  <strong>API oficial do GitHub</strong> para salvar suas notas em um <strong>Gist Privado</strong> na sua própria conta.
                </p>
                <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  É <strong>100% gratuito</strong>, <strong>ilimitado</strong> e ninguém além de você tem acesso. Basta colocar o mesmo token no celular e no computador!
                </p>
              </div>

              {/* Connected Gist State */}
              {githubSync?.isConfigured ? (
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-semibold text-xs">Conectado ao GitHub</span>
                    </div>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                      @{githubSync.username}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-600 dark:text-neutral-300 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Última sincronização:</span>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {formatTime(githubSync.lastSyncedAt)}
                      </span>
                    </div>
                    {githubSync.gistUrl && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-neutral-500 dark:text-neutral-400">Gist Privado de Backup:</span>
                        <a
                          href={githubSync.gistUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-mono text-[10px]"
                        >
                          Ver no GitHub <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <button
                      id="sync-gist-now-btn"
                      type="button"
                      onClick={handleSyncGistNow}
                      disabled={githubSync.isSyncing}
                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${githubSync.isSyncing ? "animate-spin" : ""}`} />
                      {githubSync.isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
                    </button>
                    <button
                      id="disconnect-gist-btn"
                      type="button"
                      onClick={() => githubSync.disconnect()}
                      className="py-1.5 px-3 bg-neutral-200 dark:bg-neutral-800 hover:bg-red-100 dark:hover:bg-red-950/40 text-neutral-700 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      Desconectar
                    </button>
                  </div>

                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300/90 pt-1">
                    💡 <strong>Como conectar seu celular:</strong> Acesse seu site do GitHub Pages no celular, abra esta mesma tela e cole o mesmo token. Suas notas aparecerão instantaneamente!
                  </div>
                </div>
              ) : (
                /* Not Connected Form */
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60 rounded-xl space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                      <Key className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                      <span>Conectar com Token Pessoal do GitHub</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Gere um token gratuito no GitHub com permissão de <code>gist</code>:
                    </p>
                  </div>

                  {/* Step by step guide */}
                  <div className="bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-[11px] space-y-1.5 text-neutral-600 dark:text-neutral-300">
                    <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1">
                      <span>Passo a passo (leva 30 segundos):</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-neutral-600 dark:text-neutral-400">
                      <li>
                        Abra o link oficial:{" "}
                        <a
                          href="https://github.com/settings/tokens/new?description=Bloco+de+Notas+Sync&scopes=gist"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-0.5"
                        >
                          Gerar Token no GitHub <ExternalLink className="w-3 h-3 inline" />
                        </a>{" "}
                        (a permissão de Gist já vem pré-marcada).
                      </li>
                      <li>Role até o final da página e clique no botão verde <strong>"Generate token"</strong>.</li>
                      <li>Copie o código do token (começa com <code>ghp_...</code>) e cole no campo abaixo:</li>
                    </ol>
                  </div>

                  <form onSubmit={handleConnectGithub} className="space-y-2">
                    <div className="relative">
                      <input
                        id="github-token-input"
                        type={showToken ? "text" : "password"}
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Cole seu token aqui (ghp_...)"
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 pr-10 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        title={showToken ? "Ocultar" : "Mostrar"}
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      id="save-github-token-btn"
                      type="submit"
                      disabled={isSavingToken || !tokenInput.trim()}
                      className="w-full py-2 px-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {isSavingToken ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Validando e conectando ao GitHub...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Conectar e Sincronizar Notas</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Status or Error Message */}
              {gistStatusMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    gistStatusMsg.type === "success"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                  }`}
                >
                  {gistStatusMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{gistStatusMsg.text}</span>
                </div>
              )}

              {/* Security Privacy Note */}
              <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-100/70 dark:bg-neutral-800/40 p-2.5 rounded-lg border border-neutral-200/50 dark:border-neutral-700/40">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  O token fica salvo apenas localmente no seu navegador e suas notas são guardadas em um Gist 100% <strong>Privado</strong>.
                </span>
              </div>
            </div>
          )}

          {activeTab === "live" && (
            <div className="space-y-6">
              {/* GitHub Pages Notice */}
              {isStaticHost && !serverUrl && (
                <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <span>Aviso: GitHub Pages não possui WebSocket nativo</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                    A sincronização em tempo real via WebSocket necessita de um servidor ativo (Node.js). Para usar 100% no GitHub sem servidor, utilize a aba <strong>GitHub Gist</strong>!
                  </p>
                </div>
              )}

              {/* Quick sync link & QR Code */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/80 dark:border-neutral-700/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Link de Pareamento Instantâneo
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQr(!showQr)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {showQr ? "Ocultar QR Code" : "Mostrar QR Code"}
                  </button>
                </div>

                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                  Abra este link no celular, tablet ou em outro computador.
                </p>

                {showQr && (
                  <div className="flex flex-col items-center justify-center p-4 mb-3 bg-white rounded-xl border border-neutral-200 shadow-xs">
                    <img
                      src={qrImageUrl}
                      alt="QR Code de Sincronização"
                      className="w-48 h-48 rounded-lg mb-2"
                    />
                    <span className="text-[11px] text-neutral-500 font-medium">
                      Aponte a câmera do seu celular para abrir
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    id="sync-link-input"
                    type="text"
                    readOnly
                    value={syncUrl}
                    className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 font-mono select-all focus:outline-none"
                  />
                  <button
                    id="copy-sync-link-btn"
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Connected devices list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Dispositivos Conectados na Sala
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                    {devices.length || 1} online
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Current device */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                        {/Mobile|Android|iPhone/i.test(navigator.userAgent) ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Laptop className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        {isEditingName ? (
                          <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={tempName}
                              onChange={(e) => setTempName(e.target.value)}
                              className="text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 font-medium text-neutral-900 dark:text-white"
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-medium"
                            >
                              OK
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                              {deviceName}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsEditingName(true)}
                              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                              title="Editar nome deste aparelho"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Este dispositivo (Você)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Remote devices */}
                  {devices
                    .filter((d) => d.id !== deviceId)
                    .map((dev) => (
                      <div
                        key={dev.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="p-2 rounded-lg text-white font-bold text-xs"
                            style={{ backgroundColor: dev.color || "#3b82f6" }}
                          >
                            {dev.type === "mobile" ? (
                              <Smartphone className="w-4 h-4" />
                            ) : (
                              <Laptop className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                              {dev.name}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              Conectado e sincronizado
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Room Identifier Configuration */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Código da Sala Privada
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">{roomId}</span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
                  Dispositivos com a mesma sala compartilham automaticamente o mesmo bloco de notas.
                </p>
                <form onSubmit={handleSaveRoom} className="flex gap-2">
                  <input
                    id="room-input"
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Nome ou código da sala"
                    className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    id="save-room-btn"
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Mudar Sala
                  </button>
                </form>
              </div>

              {/* Custom Backend Server URL */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Servidor Backend de Sincronização (Opcional)
                  </span>
                  {serverUrl ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                      Ativo
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400">
                      {isStaticHost ? "Opcional" : "Padrão (Automático)"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
                  Se você subir o backend em um serviço gratuito como Render ou Railway, insira a URL aqui:
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setServerUrl?.(serverInput.trim());
                  }}
                  className="flex gap-2"
                >
                  <input
                    id="server-url-input"
                    type="url"
                    value={serverInput}
                    onChange={(e) => setServerInput(e.target.value)}
                    placeholder="https://meu-servidor.onrender.com"
                    className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    id="apply-server-url-btn"
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    Salvar
                  </button>
                  {serverUrl && (
                    <button
                      id="clear-server-url-btn"
                      type="button"
                      onClick={() => {
                        setServerInput("");
                        setServerUrl?.("");
                      }}
                      className="px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-red-500 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-red-300"
                      title="Restaurar padrão"
                    >
                      Restaurar
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
