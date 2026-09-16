import React, { useState } from "react";
import {
  Search,
  Calendar,
  X,
  Pin,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import { AdvancedSearchFilter } from "../types";

interface AdvancedSearchPanelProps {
  filters: AdvancedSearchFilter;
  onChange: (filters: AdvancedSearchFilter) => void;
  totalMatches: number;
  totalNotes: number;
  isOpen: boolean;
  onClose: () => void;
}

export const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  filters,
  onChange,
  totalMatches,
  totalNotes,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleReset = () => {
    onChange({
      query: "",
      dateField: "all",
      dateRange: "all",
      startDate: "",
      endDate: "",
      pinnedOnly: false,
      sortBy: "updated-desc",
    });
  };

  const isFiltered =
    Boolean(filters.query) ||
    filters.dateRange !== "all" ||
    filters.pinnedOnly ||
    filters.sortBy !== "updated-desc";

  return (
    <div
      id="advanced-search-panel"
      className="p-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Busca Avançada & Filtros</span>
        </div>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca avançada"
            className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Date Field & Range Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Filtrar por data:
        </label>
        
        <div className="grid grid-cols-2 gap-1.5">
          <select
            id="filter-date-field"
            value={filters.dateField}
            onChange={(e) =>
              onChange({
                ...filters,
                dateField: e.target.value as AdvancedSearchFilter["dateField"],
              })
            }
            className="w-full px-2 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Criação ou Modificação</option>
            <option value="updated">Data de Modificação</option>
            <option value="created">Data de Criação</option>
          </select>

          <select
            id="filter-date-range"
            value={filters.dateRange}
            onChange={(e) =>
              onChange({
                ...filters,
                dateRange: e.target.value as AdvancedSearchFilter["dateRange"],
              })
            }
            className="w-full px-2 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Qualquer período</option>
            <option value="today">Hoje</option>
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
            <option value="custom">Período personalizado</option>
          </select>
        </div>

        {/* Custom date range inputs */}
        {filters.dateRange === "custom" && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div>
              <label className="text-[10px] text-neutral-500 block mb-0.5">De:</label>
              <input
                id="filter-start-date"
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
                className="w-full px-2 py-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block mb-0.5">Até:</label>
              <input
                id="filter-end-date"
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
                className="w-full px-2 py-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sorting and Quick Toggles */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
        <div>
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1 mb-1">
            <ArrowUpDown className="w-3 h-3" />
            Ordenar por:
          </label>
          <select
            id="filter-sort-by"
            value={filters.sortBy}
            onChange={(e) =>
              onChange({
                ...filters,
                sortBy: e.target.value as AdvancedSearchFilter["sortBy"],
              })
            }
            className="w-full px-2 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="updated-desc">Modificação (Mais recente)</option>
            <option value="updated-asc">Modificação (Mais antiga)</option>
            <option value="created-desc">Criação (Mais recente)</option>
            <option value="created-asc">Criação (Mais antiga)</option>
            <option value="title-asc">Título (A - Z)</option>
            <option value="title-desc">Título (Z - A)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
            Filtro de fixação:
          </label>
          <button
            id="filter-toggle-pinned"
            type="button"
            onClick={() => onChange({ ...filters, pinnedOnly: !filters.pinnedOnly })}
            className={`w-full py-1.5 px-2 rounded-md border text-xs flex items-center justify-center gap-1.5 transition-colors ${
              filters.pinnedOnly
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-medium"
                : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
            }`}
          >
            <Pin className={`w-3 h-3 ${filters.pinnedOnly ? "fill-current text-amber-500" : ""}`} />
            <span>Apenas fixadas</span>
          </button>
        </div>
      </div>

      {/* Results status badge */}
      <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>
          Exibindo <strong>{totalMatches}</strong> de {totalNotes} anotações
        </span>
        {isFiltered && (
          <span className="text-blue-600 dark:text-blue-400 font-medium">
            Filtros ativos
          </span>
        )}
      </div>
    </div>
  );
};
