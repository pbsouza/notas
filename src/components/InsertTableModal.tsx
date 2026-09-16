import React, { useState } from "react";
import { Table, X, Check, Grid } from "lucide-react";

interface InsertTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTable: (rows: number, cols: number, withHeader: boolean) => void;
}

export const InsertTableModal: React.FC<InsertTableModalProps> = ({
  isOpen,
  onClose,
  onInsertTable,
}) => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [withHeader, setWithHeader] = useState(true);
  const [hoverRow, setHoverRow] = useState(3);
  const [hoverCol, setHoverCol] = useState(3);

  if (!isOpen) return null;

  const handleGridHover = (r: number, c: number) => {
    setHoverRow(r);
    setHoverCol(c);
  };

  const handleGridClick = (r: number, c: number) => {
    setRows(r);
    setCols(c);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInsertTable(Math.max(1, rows), Math.max(1, cols), withHeader);
    onClose();
  };

  return (
    <div
      id="insert-table-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="insert-table-modal"
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <Table className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Inserir Tabela
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Grid Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
            Tamanho: {rows} linhas × {cols} colunas
          </label>
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 flex flex-col items-center justify-center">
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((r) =>
                [1, 2, 3, 4, 5, 6].map((c) => {
                  const isSelected = r <= rows && c <= cols;
                  const isHovered = r <= hoverRow && c <= hoverCol;
                  return (
                    <div
                      key={`${r}-${c}`}
                      onMouseEnter={() => handleGridHover(r, c)}
                      onClick={() => handleGridClick(r, c)}
                      className={`w-6 h-6 rounded cursor-pointer transition-all border ${
                        isSelected || isHovered
                          ? "bg-blue-500 border-blue-600"
                          : "bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 hover:border-blue-400"
                      }`}
                    />
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Passe o mouse e clique para escolher o tamanho
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                Linhas:
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                Colunas:
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={cols}
                onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={withHeader}
              onChange={(e) => setWithHeader(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Incluir linha de cabeçalho formatada</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Inserir Tabela
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
