import React, { useState, useMemo } from 'react';
import { Search, X, CheckSquare, Square, Layers, Users } from 'lucide-react';
import { Rombel } from '../../types';

export interface SearchableRombelMultiSelectProps {
  rombels: Rombel[];
  selectedRombelIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filterEmpty?: boolean;
  showStudentCount?: boolean;
  id?: string;
}

export const SearchableRombelMultiSelect: React.FC<SearchableRombelMultiSelectProps> = ({
  rombels,
  selectedRombelIds,
  onSelectionChange,
  label,
  placeholder = 'Cari kelas (contoh: XI RPL, X TKJ)...',
  disabled = false,
  className = '',
  filterEmpty = false,
  showStudentCount = true,
  id = 'rombel-multi-select',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTingkat, setSelectedTingkat] = useState<number | 'all'>('all');

  const availableRombels = useMemo(() => {
    if (!filterEmpty) return rombels;
    return rombels.filter((r) => (r.student_count ?? 0) > 0);
  }, [rombels, filterEmpty]);

  // Distinct tingkat list for quick filters (e.g. 10, 11, 12)
  const availableTingkats = useMemo(() => {
    const set = new Set<number>();
    availableRombels.forEach((r) => {
      if (r.tingkat) set.add(r.tingkat);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [availableRombels]);

  // Filtered rombels based on search query and tingkat
  const filteredList = useMemo(() => {
    return availableRombels.filter((r) => {
      if (selectedTingkat !== 'all' && r.tingkat !== selectedTingkat) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = r.name.toLowerCase().includes(q);
      const matchTingkat = `tingkat ${r.tingkat}`.includes(q) || `kelas ${r.tingkat}`.includes(q);
      const matchWali = r.wali_kelas?.name?.toLowerCase().includes(q) ?? false;
      return matchName || matchTingkat || matchWali;
    });
  }, [availableRombels, searchQuery, selectedTingkat]);

  // Map of selected objects
  const selectedRombelsMap = useMemo(() => {
    const map = new Map<string, Rombel>();
    availableRombels.forEach((r) => {
      if (selectedRombelIds.includes(r.id)) {
        map.set(r.id, r);
      }
    });
    return map;
  }, [availableRombels, selectedRombelIds]);

  const handleToggleRombel = (rombelId: string) => {
    if (disabled) return;
    if (selectedRombelIds.includes(rombelId)) {
      onSelectionChange(selectedRombelIds.filter((idVal) => idVal !== rombelId));
    } else {
      onSelectionChange([...selectedRombelIds, rombelId]);
    }
  };

  const handleSelectAllFiltered = () => {
    if (disabled) return;
    const currentSet = new Set(selectedRombelIds);
    filteredList.forEach((r) => currentSet.add(r.id));
    onSelectionChange(Array.from(currentSet));
  };

  const handleDeselectAllFiltered = () => {
    if (disabled) return;
    const filteredIdSet = new Set(filteredList.map((r) => r.id));
    onSelectionChange(selectedRombelIds.filter((idVal) => !filteredIdSet.has(idVal)));
  };

  const handleClearAll = () => {
    if (disabled) return;
    onSelectionChange([]);
  };

  const handleRemoveChip = (rombelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onSelectionChange(selectedRombelIds.filter((idVal) => idVal !== rombelId));
  };

  const isAllFilteredSelected =
    filteredList.length > 0 && filteredList.every((r) => selectedRombelIds.includes(r.id));

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-700">
          {label}
        </label>
      )}

      {/* Embedded Selector Container */}
      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs">
        {/* Search & Tingkat Filter Bar */}
        <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 space-y-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id={id}
              type="text"
              disabled={disabled}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-9 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary"
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

          {/* Quick Filter Tingkat & Action Helper */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
            {availableTingkats.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedTingkat('all')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                    selectedTingkat === 'all'
                      ? 'bg-m3-primary text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/60'
                  }`}
                >
                  Semua
                </button>
                {availableTingkats.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTingkat(t)}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                      selectedTingkat === t
                        ? 'bg-m3-primary text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/60'
                    }`}
                  >
                    Kelas {t}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {filteredList.length > 0 && (
                isAllFilteredSelected ? (
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                  >
                    Batal Pilih ({filteredList.length})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-m3-primary hover:text-blue-700 font-bold cursor-pointer"
                  >
                    Pilih Semua ({filteredList.length})
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Selected Badges Area (if any) */}
        {selectedRombelIds.length > 0 && (
          <div className="px-2.5 py-1.5 bg-blue-50/40 border-b border-blue-100/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-y-auto">
              <span className="text-[11px] font-bold text-blue-900 shrink-0">
                {selectedRombelIds.length} Kelas Dipilih:
              </span>
              {selectedRombelIds.map((rombelId) => {
                const rombel = selectedRombelsMap.get(rombelId);
                return (
                  <span
                    key={rombelId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs"
                  >
                    <span>{rombel?.name || rombelId}</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveChip(rombelId, e)}
                      className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      title="Batalkan pilihan kelas ini"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
            {selectedRombelIds.length > 1 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 shrink-0 cursor-pointer ml-1"
              >
                Hapus Semua
              </button>
            )}
          </div>
        )}

        {/* Scrollable Class Checklist */}
        <div className="max-h-44 sm:max-h-52 overflow-y-auto p-1 divide-y divide-slate-100">
          {filteredList.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              <Layers className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
              Tidak ada rombongan belajar yang sesuai pencarian
            </div>
          ) : (
            filteredList.map((rombel) => {
              const isSelected = selectedRombelIds.includes(rombel.id);
              return (
                <div
                  key={rombel.id}
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => handleToggleRombel(rombel.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-50/80 text-blue-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="shrink-0 text-m3-primary">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 fill-m3-primary text-white" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-200/60">
                      {rombel.tingkat}
                    </span>
                    <span className="truncate">{rombel.name}</span>
                  </div>

                  {showStudentCount && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 shrink-0 ml-2">
                      {rombel.student_count ?? 0} siswa
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
