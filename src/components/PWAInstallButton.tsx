import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs transition-colors"
        title="Instalar Bloco de Notas como aplicativo no celular ou PC"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-install-ios-btn"
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Como instalar no iPhone ou iPad"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instalar</span>
        </button>

        {showIOSGuide && (
          <div
            id="pwa-ios-modal-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              id="pwa-ios-modal"
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4 text-neutral-900 dark:text-neutral-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Instalar no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Para usar o Bloco de Notas Nuvem em tela cheia com ícone próprio na sua tela de início:
              </p>

              <div className="space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/60 p-3.5 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    1
                  </span>
                  <span>
                    Toque no botão <strong>Compartilhar</strong> <Share className="w-3.5 h-3.5 inline mx-0.5" /> na barra inferior do Safari.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    2
                  </span>
                  <span>
                    Role a lista e selecione <strong>Adicionar à Tela de Início</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5" />.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    3
                  </span>
                  <span>Toque em <strong>Adicionar</strong> no canto superior direito.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
