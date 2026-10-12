import React, { useMemo, useState } from "react";
import { scriptInstructionsCatalog, scriptInstructionCategories, ScriptInstructionEntry, SubEntry } from "./scriptInstructionsCatalog.ts";

interface InstructionPaletteProps {
  visible: boolean,
  onClose: () => void,
  onInsert: (syntax: string) => void
}

type FilteredEntry = ScriptInstructionEntry & {
  matchedSyntaxes: number[],
  matchedVariants: number[]
};

const entryIsMatch = (entry: ScriptInstructionEntry, query: string): boolean => {
  return (
    entry.name.toLowerCase().includes(query) ||
    entry.description.toLowerCase().includes(query) ||
    entry.category.toLowerCase().includes(query)
  );
};

const subEntryIsMatch = (sub: SubEntry, query: string): boolean => {
  return (
    sub.subtitle.toLowerCase().includes(query) ||
    sub.syntax.toLowerCase().includes(query) ||
    (sub.description ?? "").toLowerCase().includes(query)
  );
};

const matchEntry = (entry: ScriptInstructionEntry, query: string): FilteredEntry => {
  const matchedSyntaxes: number[] = [];
  entry.syntaxes.forEach((syntaxData, i) => {
    if (syntaxData.syntax.toLowerCase().includes(query) || (syntaxData.description ?? "").toLowerCase().includes(query)) {
      matchedSyntaxes.push(i);
    }
  });
  const matchedVariants: number[] = [];
  (entry.variants ?? []).forEach((variant, i) => {
    if (subEntryIsMatch(variant, query)) {
      matchedVariants.push(i);
    }
  });
  if (matchedSyntaxes.length > 0 || matchedVariants.length > 0) {
    return { ...entry, matchedSyntaxes, matchedVariants };
  }
  if (entryIsMatch(entry, query)) {
    return {
      ...entry,
      matchedSyntaxes: entry.syntaxes.map((_, i) => i),
      matchedVariants: (entry.variants ?? []).map((_, i) => i)
    };
  }
  return { ...entry, matchedSyntaxes: [], matchedVariants: [] };
};

export default function InstructionPalette({ visible, onClose, onInsert }: InstructionPaletteProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q == "") {
      return scriptInstructionsCatalog.map(entry => ({
        ...entry,
        matchedSyntaxes: entry.syntaxes.map((_, i) => i),
        matchedVariants: (entry.variants ?? []).map((_, i) => i)
      }));
    }
    return scriptInstructionsCatalog
      .map(entry => matchEntry(entry, q))
      .filter(entry => entry.matchedSyntaxes.length > 0 || entry.matchedVariants.length > 0);
  }, [query]);

  const grouped = useMemo(() => {
    return scriptInstructionCategories
      .map(category => ({ category, entries: filtered.filter(e => e.category == category) }))
      .filter(group => group.entries.length > 0);
  }, [filtered]);

  const syntaxBlockClass = "text-[#A18649] bg-black/40 rounded px-1.5 py-0.5 my-0.5 text-[11px] "
    + "block whitespace-pre-wrap font-mono hover:bg-[#00405566] cursor-pointer transition-colors";

  return (
    <div
      className={
        "absolute top-0 bottom-0 left-0 z-20 w-96 flex flex-col bg-neutral-900/95 backdrop-blur-sm "
        + "border-r border-neutral-700 shadow-lg shadow-black/60 transition-transform duration-150 "
        + (visible ? "translate-x-0" : "-translate-x-full")
      }
    >
      <div className="flex flex-row items-center gap-2 px-2 py-1.5 border-b border-neutral-800">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          placeholder="Search instructions..."
          spellCheck={false}
          className="w-full bg-neutral-800 text-neutral-200 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-cyan-600 placeholder-neutral-500"
        />
        <button
          onClick={onClose}
          title="Close instruction palette"
          className="text-neutral-400 hover:text-neutral-100 text-sm leading-none px-1"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 text-neutral-300">
        {
          grouped.length == 0 &&
          <div className="text-neutral-500 text-xs italic text-center mt-4">No results</div>
        }
        {
          grouped.map(({ category, entries }) => (
            <div key={category} className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-cyan-500 mb-1">{category}</div>
              {
                entries.map(entry => (
                  <div key={entry.name} className="mb-2">
                    <div className="text-xs font-semibold text-neutral-100">{entry.name}</div>
                    <div className="text-[11px] text-neutral-400 leading-snug">{entry.description}</div>
                    {
                      entry.matchedSyntaxes.map(i => {
                        const syntaxData = entry.syntaxes[i];
                        return (
                          <div key={"s" + i}>
                            <code
                              className={syntaxBlockClass}
                              title="Insert into editor"
                              onClick={() => { onInsert(syntaxData.syntax); }}
                            >
                              {syntaxData.syntax}
                            </code>
                            {
                              syntaxData.description &&
                              <div className="text-[10px] text-neutral-500 mt-0.5">{syntaxData.description}</div>
                            }
                          </div>
                        );
                      })
                    }
                    {
                      entry.matchedVariants.map(i => {
                        const variant = (entry.variants ?? [])[i];
                        return (
                          <div key={"v" + i} className="border-l border-neutral-700 pl-2 my-1">
                            <div className="text-[10px] uppercase tracking-wide text-cyan-600 mt-1">{variant.subtitle}</div>
                            <code
                              className={syntaxBlockClass}
                              title="Insert into editor"
                              onClick={() => { onInsert(variant.syntax); }}
                            >
                              {variant.syntax}
                            </code>
                            {
                              variant.description &&
                              <div className="text-[10px] text-neutral-500 mt-0.5">{variant.description}</div>
                            }
                          </div>
                        );
                      })
                    }
                    {
                      entry.example &&
                      <div className="text-[10px] text-neutral-500 mt-0.5 border-l border-neutral-700 pl-1.5 whitespace-pre-wrap font-mono">{entry.example}</div>
                    }
                  </div>
                ))
              }
            </div>
          ))
        }
      </div>
    </div>
  );
}
