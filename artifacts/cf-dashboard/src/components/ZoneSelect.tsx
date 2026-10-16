import React, { useState, useRef, useEffect } from "react";
import { GlobeIcon, Search, Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ZoneItem {
  id: string;
  name: string;
  status?: string;
}

interface ZoneSelectProps {
  zones: ZoneItem[];
  value: string;
  onChange: (zoneId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ZoneSelect({
  zones,
  value,
  onChange,
  placeholder = "Pilih domain...",
  className,
  disabled = false,
}: ZoneSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedZone = zones.find((z) => z.id === value);

  // Filtered zones
  const filteredZones = zones.filter((z) =>
    z.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || zones.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between h-9 px-3 py-1.5 text-xs rounded-md border transition-colors bg-gray-900 border-gray-700 text-white shadow-xs focus:outline-none focus:ring-1 focus:ring-orange-500",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "border-orange-500/80 ring-1 ring-orange-500/40"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GlobeIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="truncate font-mono">
            {selectedZone ? selectedZone.name : placeholder}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-orange-400"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#161a23] border border-gray-700/90 rounded-lg shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
          style={{ minWidth: "240px" }}
        >
          {/* Search Bar at Top */}
          <div className="p-2 border-b border-gray-800 bg-[#12151b]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari domain..."
                className="w-full bg-[#1e2330] border border-gray-700 text-white placeholder:text-gray-500 text-xs rounded-md pl-8 pr-7 py-1.5 h-8 focus:outline-none focus:border-orange-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
              <span>{zones.length} domain tersedia</span>
              {search && <span>{filteredZones.length} hasil cocok</span>}
            </div>
          </div>

          {/* Smooth Touch-Scrollable Domain List */}
          <div
            ref={listRef}
            className="max-h-56 sm:max-h-64 overflow-y-auto overscroll-contain touch-pan-y divide-y divide-gray-800/60 p-1"
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
            }}
            onTouchMove={(e) => {
              // Crucial: prevent touchmove from being captured or blocked by parent dialogs!
              e.stopPropagation();
            }}
          >
            {filteredZones.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500">
                Tidak ada domain yang cocok dengan "{search}"
              </div>
            ) : (
              filteredZones.map((z) => {
                const isSelected = z.id === value;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => {
                      onChange(z.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 text-left rounded-md transition-colors text-xs font-mono",
                      isSelected
                        ? "bg-orange-500/15 text-orange-400 font-medium"
                        : "text-gray-200 hover:bg-gray-800/80 active:bg-gray-800"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GlobeIcon
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isSelected ? "text-orange-400" : "text-gray-400"
                        )}
                      />
                      <span className="truncate">{z.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-orange-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
