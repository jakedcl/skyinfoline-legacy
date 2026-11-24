"use client";

import { useMemo, useRef, useState } from "react";
import type { Building } from "@/types/building";

type BuildingSearchProps = {
  buildings: Building[];
  onPick: (id: string) => void;
};

export function BuildingSearch({ buildings, onPick }: BuildingSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return buildings
      .filter((b) =>
        [b.name, b.architect, b.neighborhood, b.style, ...(b.nicknames ?? [])]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.heightFt - a.heightFt)
      .slice(0, 8);
  }, [buildings, query]);

  const pick = (id: string) => {
    onPick(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Find a building…"
        aria-label="Search buildings"
        aria-expanded={open && results.length > 0}
        aria-controls="building-search-results"
        role="combobox"
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            pick(results[active].id);
          } else if (e.key === "Escape") {
            setQuery("");
            setOpen(false);
          }
        }}
        className="glass w-36 rounded-full px-3.5 py-1.5 text-xs text-white placeholder:text-white/50 focus:w-52 focus:outline-2 focus:outline-[var(--op-signal)] sm:w-44 sm:focus:w-64"
        style={{ transition: "width 0.25s ease" }}
      />
      {open && results.length > 0 ? (
        <ul id="building-search-results" role="listbox" className="search-results">
          {results.map((b, i) => (
            <li key={b.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                data-active={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(b.id)}
              >
                <span>{b.name}</span>
                <span className="text-white/50">{b.heightFt.toLocaleString()} ft</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
