import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Layers, ChevronDown, Search, Users, Check, X } from 'lucide-react';
import { Rombel } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export interface SearchableRombelSelectProps {
  rombels: Rombel[];
  selectedRombelId: string;
  onSelect: (rombelId: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  filterEmpty?: boolean;
  showStudentCount?: boolean;
  showAllOption?: boolean;
  allOptionLabel?: string;
  id?: string;
}

export const SearchableRombelSelect: React.FC<SearchableRombelSelectProps> = ({
  rombels,
  selectedRombelId,
  onSelect,
  label,
  placeholder = 'Pilih Rombongan Belajar',
  disabled = false,
  className = '',
  buttonClassName = '',
  filterEmpty = true,
  showStudentCount = true,
  showAllOption = false,
  allOptionLabel = 'Semua Rombel',
  id = 'rombel-select',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const dropdownStyle = useDropdownPosition(containerRef, isOpen);

  // Close dropdown on outside click
  useClickOutside(
    [containerRef, listboxRef],
    () => {
      setIsOpen(false);
      setSearchQuery('');
    },
    isOpen
  );

  // Filter out rombels with 0 students if filterEmpty is true
  const availableRombels = useMemo(() => {
    if (!filterEmpty) return rombels;
    return rombels.filter((r) => (r.student_count ?? 0) > 0);
  }, [rombels, filterEmpty]);

  // Find currently active/selected rombel object
  const selectedRombel = useMemo(() => {
    return availableRombels.find((r) => r.id === selectedRombelId) || null;
  }, [availableRombels, selectedRombelId]);

  // Filtered list based on search query
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return availableRombels;
    const q = searchQuery.toLowerCase().trim();
    return availableRombels.filter((r) => {
      const matchName = r.name.toLowerCase().includes(q);
      const matchTingkat = `tingkat ${r.tingkat}`.includes(q) || `kelas ${r.tingkat}`.includes(q);
      const matchWali = r.wali_kelas?.name?.toLowerCase().includes(q) ?? false;
      return matchName || matchTingkat || matchWali;
    });
  }, [availableRombels, searchQuery]);

  // Auto focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalItems = filteredList.length + (showAllOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showAllOption && highlightedIndex === 0) {
        onSelect('all');
        setIsOpen(false);
        setSearchQuery('');
      } else {
        const itemIdx = showAllOption ? highlightedIndex - 1 : highlightedIndex;
        if (filteredList[itemIdx]) {
          onSelect(filteredList[itemIdx].id);
          setIsOpen(false);
          setSearchQuery('');
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleSelectItem = (idVal: string) => {
    onSelect(idVal);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled || (availableRombels.length === 0 && !showAllOption)}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2.5 bg-m3-surface hover:bg-m3-surface-container/60 border rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-m3-on-surface transition-all cursor-pointer min-h-[42px] focus:outline-none focus:ring-2 focus:ring-m3-primary/30 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen
            ? 'border-m3-primary ring-2 ring-m3-primary/20 shadow-xs'
            : 'border-m3-outline-variant/50 hover:border-m3-primary'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Layers className="w-4 h-4 text-m3-primary shrink-0" />
          <span className="truncate">
            {selectedRombelId === 'all' && showAllOption
              ? allOptionLabel
              : selectedRombel
              ? selectedRombel.name
              : placeholder}
          </span>
          {showStudentCount && selectedRombel && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100/80 shrink-0">
              {selectedRombel.student_count ?? 0} siswa
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-m3-outline shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-m3-primary' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Portal */}
      {isOpen &&
        dropdownStyle &&
        createPortal(
          <div
            ref={listboxRef}
            role="listbox"
            style={dropdownStyle}
            className="bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Search Input Box */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Cari kelas / rombel..."
                  className="w-full pl-9 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Rombel Options List */}
            <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1">
              {showAllOption && (
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedRombelId === 'all'}
                  onClick={() => handleSelectItem('all')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                    selectedRombelId === 'all'
                      ? 'bg-m3-primary-container/40 text-m3-primary font-bold'
                      : highlightedIndex === 0
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span>{allOptionLabel}</span>
                  {selectedRombelId === 'all' && <Check className="w-3.5 h-3.5 text-m3-primary" />}
                </button>
              )}

              {filteredList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Tidak ada rombel yang cocok
                </div>
              ) : (
                filteredList.map((rombel, idx) => {
                  const isSelected = rombel.id === selectedRombelId;
                  const effectiveIdx = showAllOption ? idx + 1 : idx;
                  const isHighlighted = effectiveIdx === highlightedIndex;

                  return (
                    <button
                      key={rombel.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectItem(rombel.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-m3-primary-container/40 text-m3-primary font-bold'
                          : isHighlighted
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{rombel.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            (Tk. {rombel.tingkat})
                          </span>
                        </div>
                        {rombel.wali_kelas?.name && (
                          <p className="text-[10px] text-slate-400 truncate">
                            Wali: {rombel.wali_kelas.name}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {showStudentCount && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                            {rombel.student_count ?? 0} siswa
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-m3-primary" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
