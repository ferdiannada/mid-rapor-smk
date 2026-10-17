import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ChevronDown, Search, Check, X } from 'lucide-react';
import { Subject } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export interface SearchableSubjectSelectProps {
  subjects: Subject[];
  selectedSubjectId: string;
  onSelect: (subjectId: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const SearchableSubjectSelect: React.FC<SearchableSubjectSelectProps> = ({
  subjects,
  selectedSubjectId,
  onSelect,
  label,
  placeholder = 'Pilih Mata Pelajaran',
  disabled = false,
  className = '',
  id = 'subject-select',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const dropdownStyle = useDropdownPosition(containerRef, isOpen);

  useClickOutside(
    [containerRef, listboxRef],
    () => {
      setIsOpen(false);
      setSearchQuery('');
    },
    isOpen
  );

  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase().trim();
    return subjects.filter((s) => {
      const matchName = s.nama.toLowerCase().includes(q);
      const matchKelompok = s.kelompok?.toLowerCase().includes(q) ?? false;
      return matchName || matchKelompok;
    });
  }, [subjects, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const total = filteredList.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, total));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + total) % Math.max(1, total));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredList[highlightedIndex]) {
        onSelect(filteredList[highlightedIndex].id);
        setIsOpen(false);
        setSearchQuery('');
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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled || subjects.length === 0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2.5 bg-white hover:bg-slate-50 border rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 transition-all cursor-pointer min-h-[44px] focus:outline-none focus:ring-2 focus:ring-m3-primary/30 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen
            ? 'border-m3-primary ring-2 ring-m3-primary/20 shadow-xs'
            : 'border-slate-200 hover:border-m3-primary'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">
            {selectedSubject ? selectedSubject.nama : placeholder}
          </span>
          {selectedSubject?.kelompok && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
              {selectedSubject.kelompok}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
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
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Search Input Box */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Cari mata pelajaran atau kelompok..."
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

            {/* Subject Options List */}
            <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1">
              {filteredList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Tidak ada mata pelajaran yang cocok
                </div>
              ) : (
                filteredList.map((subject, idx) => {
                  const isSelected = subject.id === selectedSubjectId;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <button
                      key={subject.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelect(subject.id);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-950 font-bold'
                          : isHighlighted
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {subject.nama}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {subject.kelompok && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                            {subject.kelompok}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
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
