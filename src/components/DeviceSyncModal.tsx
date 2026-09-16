import React, { useState } from "react";
import { X, Smartphone, Laptop, Copy, Check, RefreshCw, Radio, QrCode, ShieldCheck, Edit2 } from "lucide-react";
import { ConnectedDevice } from "../types";

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
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [roomInput, setRoomInput] = useState(roomId);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);
  const [showQr, setShowQr] = useState(false);

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

  // Generate a high-contrast clean SVG QR code representation of the sync link
  // using quick URL encoder for QR service or direct encoded SVG
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    syncUrl
  )}&bgcolor=ffffff&color=0f172a&margin=1`;

  return (
    <div
      id="sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="sync-modal"
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Sincronização entre Dispositivos
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
                  }`}
                />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {isConnected ? "Sincronização ao vivo conectada" : "Tentando conectar ao servidor..."}
                </span>
              </div>
            </div>
          </div>
          <button
            id="close-sync-modal"
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
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
              Abra este link no celular, tablet ou em outro computador. Todas as anotações digitadas aparecerão em tempo real em todos os aparelhos!
            </p>

            {showQr && (
              <div className="flex flex-col items-center justify-center p-4 mb-3 bg-white rounded-xl border border-neutral-200 shadow-xs">
                <img
                  src={qrImageUrl}
                  alt="QR Code de Sincronização"
                  className="w-44 h-44 rounded-lg"
                  loading="lazy"
                />
                <span className="text-[11px] text-neutral-500 mt-2 text-center">
                  Aponte a câmera do celular para abrir o bloco de notas sincronizado
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id="sync-url-input"
                type="text"
                readOnly
                value={syncUrl}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 font-mono select-all focus:outline-none"
              />
              <button
                id="copy-sync-url-btn"
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? "Copiado!" : "Copiar Link"}
              </button>
            </div>
          </div>

          {/* Current Device Identifier */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
              <span>Nome deste Dispositivo</span>
              {!isEditingName && (
                <button
                  type="button"
                  onClick={() => {
                    setTempName(deviceName);
                    setIsEditingName(true);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                >
                  <Edit2 className="w-3 h-3" /> Alterar nome
                </button>
              )}
            </label>

            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex gap-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Laptop className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-neutral-900 dark:text-white">
                    {deviceName}
                  </span>
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                    Você
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">ID: {deviceId.slice(0, 8)}...</span>
              </div>
            )}
          </div>

          {/* Connected Devices List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Dispositivos Conectados na Mesma Sala ({devices.length || 1})
              </span>
              <span className="text-[11px] text-neutral-400">Atualização em tempo real</span>
            </div>

            <div className="space-y-2">
              {devices.length === 0 ? (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/30 rounded-xl text-center text-xs text-neutral-500">
                  Nenhum outro aparelho conectado ainda. Compartilhe o link acima para sincronizar!
                </div>
              ) : (
                devices.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      {dev.name.toLowerCase().includes("celular") || dev.name.toLowerCase().includes("iphone") ? (
                        <Smartphone className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                      ) : (
                        <Laptop className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-neutral-900 dark:text-white">
                            {dev.name}
                          </span>
                          {dev.isSelf && (
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-full font-medium">
                              Este aparelho
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400">
                          {dev.isTyping ? "✍️ Digitando no momento..." : "Conectado e sincronizado"}
                        </span>
                      </div>
                    </div>
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: dev.color || "#22c55e" }}
                      title="Status do dispositivo"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Change Room Code */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
              Código da Sala de Sincronização
            </span>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
              Dispositivos com o mesmo código compartilham o mesmo bloco de notas e atualizam instantaneamente.
            </p>
            <form onSubmit={handleSaveRoom} className="flex gap-2">
              <input
                id="room-code-input"
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Ex: meu-bloco-pessoal"
                className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                id="apply-room-code-btn"
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-lg flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Mudar Sala
              </button>
            </form>
          </div>

          {/* Security note */}
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/50 dark:border-emerald-900/30">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Suas anotações são salvas na nuvem com isolamento de sala. Use um código exclusivo para suas notas privadas.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
