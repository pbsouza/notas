import React, { useState, useEffect } from "react";
import { Search, Replace, X, ChevronDown, ChevronUp, CaseSensitive } from "lucide-react";

interface FindReplaceBarProps {
  content: string;
  onReplace: (newContent: string) => void;
  onClose: () => void;
}

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  content,
  onReplace,
  onClose,
}) => {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matchCount, setMatchCount] = useState(0);

  // Compute matches
  useEffect(() => {
    if (!findText) {
      setMatchCount(0);
      return;
    }
    try {
      const flags = matchCase ? "g" : "gi";
      const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, flags);
      const matches = content.match(regex);
      setMatchCount(matches ? matches.length : 0);
    } catch {
      setMatchCount(0);
    }
  }, [findText, content, matchCase]);

  const handleFindNext = () => {
    if (!findText) return;
    // In browser window find
    const win = window as unknown as { find?: (str: string, matchCase?: boolean, searchBackwards?: boolean, wrapAround?: boolean, wholeWord?: boolean, searchInFrames?: boolean, showDialog?: boolean) => boolean };
    if (typeof win.find === "function") {
      win.find(findText, matchCase, false, true, false, false, false);
    }
  };

  const handleFindPrev = () => {
    if (!findText) return;
    const win = window as unknown as { find?: (str: string, matchCase?: boolean, searchBackwards?: boolean, wrapAround?: boolean, wholeWord?: boolean, searchInFrames?: boolean, showDialog?: boolean) => boolean };
    if (typeof win.find === "function") {
      win.find(findText, matchCase, true, true, false, false, false);
    }
  };

  const handleReplaceOne = () => {
    if (!findText) return;
    try {
      const flags = matchCase ? "" : "i";
      const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, flags);
      const updated = content.replace(regex, replaceText);
      onReplace(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    try {
      const flags = matchCase ? "g" : "gi";
      const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, flags);
      const updated = content.replace(regex, replaceText);
      onReplace(updated);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      id="find-replace-bar"
      className="flex flex-wrap items-center gap-2 p-2.5 sm:p-3 bg-white/95 dark:bg-neutral-800/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-700 shadow-sm z-20 text-xs"
    >
      <div className="flex items-center gap-1.5 flex-1 min-w-[140px] sm:min-w-[180px]">
        <Search className="w-4 h-4 text-neutral-400 shrink-0" />
        <input
          id="find-input"
          type="text"
          placeholder="Localizar no texto..."
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) handleFindPrev();
              else handleFindNext();
            }
          }}
          className="w-full bg-neutral-100 dark:bg-neutral-700/60 border border-neutral-200 dark:border-neutral-600 rounded px-2.5 py-1 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
          autoFocus
        />
        {findText && (
          <span className="text-[11px] text-neutral-400 whitespace-nowrap px-1">
            {matchCount} {matchCount === 1 ? "res." : "res."}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-[140px] sm:min-w-[180px]">
        <Replace className="w-4 h-4 text-neutral-400 shrink-0" />
        <input
          id="replace-input"
          type="text"
          placeholder="Substituir por..."
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleReplaceOne();
            }
          }}
          className="w-full bg-neutral-100 dark:bg-neutral-700/60 border border-neutral-200 dark:border-neutral-600 rounded px-2.5 py-1 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
        />
      </div>

      <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap shrink-0">
        <button
          id="match-case-toggle"
          type="button"
          onClick={() => setMatchCase(!matchCase)}
          title="Diferenciar Maiúsculas/Minúsculas"
          className={`p-1.5 rounded border transition-colors ${
            matchCase
              ? "bg-blue-100 dark:bg-blue-900/60 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300"
              : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          }`}
        >
          <CaseSensitive className="w-4 h-4" />
        </button>

        <button
          id="find-prev-btn"
          type="button"
          onClick={handleFindPrev}
          title="Localizar Anterior (Shift+Enter)"
          className="p-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        <button
          id="find-next-btn"
          type="button"
          onClick={handleFindNext}
          title="Localizar Próximo (Enter)"
          className="p-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        <button
          id="replace-one-btn"
          type="button"
          onClick={handleReplaceOne}
          className="px-2.5 py-1 text-xs font-medium rounded border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          Substituir
        </button>

        <button
          id="replace-all-btn"
          type="button"
          onClick={handleReplaceAll}
          className="px-2.5 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          Substituir Todos
        </button>

        <button
          id="close-find-bar-btn"
          type="button"
          onClick={onClose}
          className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
