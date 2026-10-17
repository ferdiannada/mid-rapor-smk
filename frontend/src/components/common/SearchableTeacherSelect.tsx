import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Users, ChevronDown, Search, Check, X } from 'lucide-react';
import { TeacherItem } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export interface SearchableTeacherSelectProps {
  teachers: TeacherItem[];
  selectedTeacherId: string;
  onSelect: (teacherId: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  allowClear?: boolean;
  emptyLabel?: string;
}

export const SearchableTeacherSelect: React.FC<SearchableTeacherSelectProps> = ({
  teachers,
  selectedTeacherId,
  onSelect,
  label,
  placeholder = 'Pilih Guru Pengampu',
  disabled = false,
  className = '',
  id = 'teacher-select',
  allowClear = false,
  emptyLabel = '-- Kosongkan (Tanpa Guru) --',
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

  const activeTeachers = useMemo(() => {
    return teachers.filter((t) => t.is_active !== false);
  }, [teachers]);

  const selectedTeacher = useMemo(() => {
    return activeTeachers.find((t) => t.id === selectedTeacherId) || null;
  }, [activeTeachers, selectedTeacherId]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return activeTeachers;
    const q = searchQuery.toLowerCase().trim();
    return activeTeachers.filter((t) => {
      const matchName = t.name.toLowerCase().includes(q);
      const matchNip = t.nip_nik?.toLowerCase().includes(q) ?? false;
      const matchEmail = t.email?.toLowerCase().includes(q) ?? false;
      return matchName || matchNip || matchEmail;
    });
  }, [activeTeachers, searchQuery]);

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

    const total = filteredList.length + (allowClear ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, total));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + total) % Math.max(1, total));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allowClear && highlightedIndex === 0) {
        onSelect('');
        setIsOpen(false);
        setSearchQuery('');
      } else {
        const itemIdx = allowClear ? highlightedIndex - 1 : highlightedIndex;
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

  const getInitials = (name?: string) => {
    if (!name) return 'PT';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
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
        disabled={disabled || (activeTeachers.length === 0 && !allowClear)}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2.5 bg-white hover:bg-slate-50 border rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 transition-all cursor-pointer min-h-[44px] focus:outline-none focus:ring-2 focus:ring-m3-primary/30 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen
            ? 'border-m3-primary ring-2 ring-m3-primary/20 shadow-xs'
            : 'border-slate-200 hover:border-m3-primary'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          {selectedTeacher ? (
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
              {getInitials(selectedTeacher.name)}
            </div>
          ) : (
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className="truncate">
            {selectedTeacher ? selectedTeacher.name : selectedTeacherId === '' && allowClear ? emptyLabel : placeholder}
          </span>
          {selectedTeacher?.nip_nik && (
            <span className="text-[10px] font-mono text-slate-400 truncate hidden sm:inline">
              ({selectedTeacher.nip_nik})
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
                  placeholder="Cari nama guru atau NIP..."
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

            {/* Teacher Options List */}
            <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1">
              {allowClear && (
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedTeacherId === ''}
                  onClick={() => {
                    onSelect('');
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                    selectedTeacherId === ''
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : highlightedIndex === 0
                      ? 'bg-slate-50 text-slate-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span>{emptyLabel}</span>
                  {selectedTeacherId === '' && <Check className="w-3.5 h-3.5 text-slate-600" />}
                </button>
              )}

              {filteredList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Tidak ada guru yang cocok
                </div>
              ) : (
                filteredList.map((teacher, idx) => {
                  const isSelected = teacher.id === selectedTeacherId;
                  const effectiveIdx = allowClear ? idx + 1 : idx;
                  const isHighlighted = effectiveIdx === highlightedIndex;

                  return (
                    <button
                      key={teacher.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelect(teacher.id);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-900 font-bold'
                          : isHighlighted
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {getInitials(teacher.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {teacher.name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 truncate">
                            {teacher.nip_nik ? `NIP: ${teacher.nip_nik}` : teacher.email || 'Tanpa NIP'}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
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
