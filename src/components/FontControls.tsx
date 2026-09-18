import React, { useState, useRef, useEffect } from "react";
import {
  Type,
  ChevronDown,
  Search,
  Check,
  Sparkles,
  AArrowUp,
  AArrowDown,
  X,
} from "lucide-react";
import { FONT_OPTIONS, FONT_SIZES, FontOption } from "../data/fonts";
import { EditorTheme } from "../types";

interface FontControlsProps {
  activeFontFamily: string;
  activeFontSize: string;
  onSelectFont: (font: FontOption) => void;
  onSelectFontSize: (sizeObj: { label: string; value: string; execSize: string }) => void;
  onStepFontSize: (direction: "up" | "down") => void;
  onApplyBaseFontToDocument?: (font: FontOption) => void;
  theme?: EditorTheme;
}

export const FontControls: React.FC<FontControlsProps> = ({
  activeFontFamily,
  activeFontSize,
  onSelectFont,
  onSelectFontSize,
  onStepFontSize,
  onApplyBaseFontToDocument,
}) => {
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const fontMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fontMenuRef.current &&
        !fontMenuRef.current.contains(e.target as Node)
      ) {
        setShowFontMenu(false);
      }
      if (
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(e.target as Node)
      ) {
        setShowSizeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when font menu opens
  useEffect(() => {
    if (showFontMenu) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setSelectedCategory("all");
    }
  }, [showFontMenu]);

  // Find active font object
  const currentFont =
    FONT_OPTIONS.find(
      (f) =>
        f.name.toLowerCase() === activeFontFamily.toLowerCase() ||
        f.id.toLowerCase() === activeFontFamily.toLowerCase() ||
        activeFontFamily.toLowerCase().includes(f.id.toLowerCase())
    ) || FONT_OPTIONS[0];

  // Filtered fonts
  const filteredFonts = FONT_OPTIONS.filter((f) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.sample.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || f.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: "all", label: "Todas" },
    { id: "sans", label: "Sem Serifa" },
    { id: "serif", label: "Com Serifa" },
    { id: "mono", label: "Código/Mono" },
    { id: "handwriting", label: "Manuscrita" },
  ];

  return (
    <div className="flex items-center gap-1">
      {/* 1. Font Family Dropdown */}
      <div className="relative" ref={fontMenuRef}>
        <button
          id="toolbar-font-family-button"
          type="button"
          onClick={() => {
            setShowFontMenu((prev) => !prev);
            setShowSizeMenu(false);
          }}
          title="Fonte do Texto (estilo Word)"
          className={`h-7 px-2 flex items-center justify-between gap-1.5 rounded text-xs font-medium border transition-colors ${
            showFontMenu
              ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-700 dark:text-blue-300"
              : "bg-white/80 dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          }`}
          style={{ width: "135px" }}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Type className="w-3.5 h-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" />
            <span
              className="truncate text-[12px]"
              style={{ fontFamily: currentFont.fontFamily }}
            >
              {currentFont.name}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 shrink-0 text-neutral-400" />
        </button>

        {showFontMenu && (
          <div
            id="toolbar-font-family-menu"
            className="absolute top-full left-0 mt-1 w-72 sm:w-80 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in-50 duration-100"
          >
            {/* Search Header */}
            <div className="p-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2 bg-neutral-50/70 dark:bg-neutral-900/70">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar fontes do Word..."
                className="w-full text-xs bg-transparent border-none outline-none text-neutral-800 dark:text-neutral-200 placeholder-neutral-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 overflow-x-auto no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Font Options List */}
            <div className="max-h-64 overflow-y-auto p-1.5 divide-y divide-neutral-100/60 dark:divide-neutral-800/60">
              {filteredFonts.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-400">
                  Nenhuma fonte encontrada com &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredFonts.map((font) => {
                  const isSelected =
                    currentFont.name.toLowerCase() === font.name.toLowerCase();

                  return (
                    <div
                      key={font.id}
                      className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200"
                      }`}
                      onClick={() => {
                        onSelectFont(font);
                        setShowFontMenu(false);
                      }}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-semibold truncate"
                            style={{ fontFamily: font.fontFamily }}
                          >
                            {font.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-mono">
                            {font.categoryLabel}
                          </span>
                        </div>
                        <span
                          className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5"
                          style={{ fontFamily: font.fontFamily }}
                        >
                          {font.sample}
                        </span>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Document Default Font Setting Footer */}
            {onApplyBaseFontToDocument && (
              <div className="p-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/90 flex justify-between items-center text-[11px]">
                <span className="text-neutral-500 dark:text-neutral-400">
                  Fonte selecionada: <strong className="text-neutral-700 dark:text-neutral-200">{currentFont.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onApplyBaseFontToDocument(currentFont);
                    setShowFontMenu(false);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Definir como padrão</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Font Size Dropdown */}
      <div className="relative" ref={sizeMenuRef}>
        <button
          id="toolbar-font-size-button"
          type="button"
          onClick={() => {
            setShowSizeMenu((prev) => !prev);
            setShowFontMenu(false);
          }}
          title="Tamanho da Fonte"
          className={`h-7 px-2 flex items-center justify-between gap-1 rounded text-xs font-semibold border transition-colors ${
            showSizeMenu
              ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-700 dark:text-blue-300"
              : "bg-white/80 dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          }`}
          style={{ width: "56px" }}
        >
          <span>{activeFontSize || "12"}</span>
          <ChevronDown className="w-3 h-3 text-neutral-400" />
        </button>

        {showSizeMenu && (
          <div
            id="toolbar-font-size-menu"
            className="absolute top-full left-0 mt-1 w-24 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 p-1 max-h-56 overflow-y-auto flex flex-col animate-in fade-in-50 duration-100"
          >
            {FONT_SIZES.map((size) => {
              const isSelected = size.label === activeFontSize;
              return (
                <button
                  key={size.label}
                  type="button"
                  onClick={() => {
                    onSelectFontSize(size);
                    setShowSizeMenu(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-md text-xs text-left font-medium flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                  }`}
                >
                  <span>{size.label}</span>
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Increase & Decrease Font Size (A^ / Av Word style) */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onStepFontSize("up")}
          title="Aumentar Tamanho da Fonte (Ctrl+Shift+>)"
          className="p-1 rounded text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
        >
          <AArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onStepFontSize("down")}
          title="Diminuir Tamanho da Fonte (Ctrl+Shift+<)"
          className="p-1 rounded text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
        >
          <AArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
