"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AircraftRef } from "@/lib/types";

/**
 * Searchable in-page combobox, replacing the native <select>. A native
 * select is the right call for a short list; with 30+ aircraft, typing to
 * filter is faster than scrolling, on desktop and mobile alike. Built by
 * hand rather than pulling a combobox library in for one field.
 */
export default function AircraftCombobox({
  aircraft,
  value,
  onSelect,
  placeholder,
}: {
  aircraft: AircraftRef[];
  value: string;
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const sorted = useMemo(
    () => [...aircraft].sort((a, b) => a.label.localeCompare(b.label)),
    [aircraft],
  );

  const selected = aircraft.find((a) => a.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.operator.toLowerCase().includes(q),
    );
  }, [sorted, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      listRef.current
        ?.querySelector(`[data-index="${activeIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIndex];
      if (pick) choose(pick.id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
        className="min-h-11 w-full border-0 border-b border-rule bg-transparent px-0 pb-1.5 text-[16px] font-light text-ink outline-none transition-colors focus:border-blue"
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className={`pointer-events-none absolute right-0 top-2.5 h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        fill="currentColor"
      >
        <path d="M5.5 7.5 L10 12 L14.5 7.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full min-w-[280px] overflow-y-auto border border-ink bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-[14px] text-muted">No match</li>
          ) : (
            filtered.map((a, i) => (
              <li
                key={a.id}
                id={`${listboxId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={a.id === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(a.id);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-[14px] ${
                  i === activeIndex ? "bg-bluePale" : ""
                } ${a.id === value ? "font-medium text-blue" : "text-ink"}`}
              >
                <span>
                  {a.label}
                  {a.gtf_exposed && (
                    <span className="ml-2 text-[11px] font-medium uppercase tracking-eyebrow text-muted">
                      GTF
                    </span>
                  )}
                </span>
                {a.operator && (
                  <span className="shrink-0 text-[12px] text-muted">{a.operator}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
