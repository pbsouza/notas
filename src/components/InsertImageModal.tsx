import React, { useState, useRef } from "react";
import { Image as ImageIcon, Upload, Link as LinkIcon, X, Check, AlertCircle } from "lucide-react";

interface InsertImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertImage: (src: string, alt: string) => void;
}

export const InsertImageModal: React.FC<InsertImageModalProps> = ({
  isOpen,
  onClose,
  onInsertImage,
}) => {
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP, GIF).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("A imagem é muito grande. O limite recomendado é de 10 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPreviewSrc(result);
      if (!altText) {
        setAltText(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlBlur = () => {
    if (imageUrl.trim()) {
      setPreviewSrc(imageUrl.trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSrc = tab === "upload" ? previewSrc : imageUrl.trim();
    if (!finalSrc) {
      setError("Por favor selecione uma imagem ou forneça uma URL válida.");
      return;
    }
    onInsertImage(finalSrc, altText.trim() || "Imagem do documento");
    handleClose();
  };

  const handleClose = () => {
    setPreviewSrc(null);
    setImageUrl("");
    setAltText("");
    setError(null);
    onClose();
  };

  return (
    <div
      id="insert-image-modal-backdrop"
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div
        id="insert-image-modal"
        className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Inserir Imagem no Documento
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
              tab === "upload"
                ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold"
                : "text-neutral-600 dark:text-neutral-400"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Carregar do Computador
          </button>
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
              tab === "url"
                ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold"
                : "text-neutral-600 dark:text-neutral-400"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Endereço URL da Web
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === "upload" ? (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer bg-neutral-50/60 dark:bg-neutral-800/30 transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Clique para selecionar uma foto ou imagem
                </p>
                <p className="text-[11px] text-neutral-500">
                  Suporte para PNG, JPG, WebP, SVG, GIF (até 10MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                URL da Imagem:
              </label>
              <input
                type="text"
                placeholder="https://exemplo.com/imagem.png"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setPreviewSrc(e.target.value);
                }}
                onBlur={handleUrlBlur}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs"
              />
            </div>
          )}

          {/* Alt text input */}
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Legenda ou Descrição alternativa:
            </label>
            <input
              type="text"
              placeholder="Ex: Gráfico de vendas anual"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="w-full px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Image Preview */}
          {previewSrc && (
            <div className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 flex flex-col items-center">
              <span className="text-[10px] text-neutral-400 mb-1 font-semibold uppercase tracking-wider">
                Pré-visualização
              </span>
              <img
                src={previewSrc}
                alt="Prévia"
                className="max-h-36 max-w-full rounded-lg object-contain shadow-2xs"
                onError={() => setError("Não foi possível carregar a imagem desta URL.")}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!previewSrc && !imageUrl}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Inserir no Documento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
