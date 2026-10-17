import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

const getPaginationRange = (currentPage: number, totalPages: number): (number | string)[] => {
  const delta = 1;
  const range: number[] = [];

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      range.push(i);
    }
  }

  const rangeWithDots: (number | string)[] = [];
  let prev: number | null = null;

  for (const page of range) {
    if (prev !== null) {
      if (page - prev === 2) {
        rangeWithDots.push(prev + 1);
      } else if (page - prev !== 1) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(page);
    prev = page;
  }

  return rangeWithDots;
};

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 0],
  itemLabel = 'data',
  onPageChange,
  onPageSizeChange,
  className = '',
}) => {
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const startIndex = totalItems === 0 ? 0 : pageSize <= 0 ? 1 : (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = pageSize <= 0 ? totalItems : Math.min(safeCurrentPage * pageSize, totalItems);

  const paginationRange = useMemo(() => {
    return getPaginationRange(safeCurrentPage, totalPages);
  }, [safeCurrentPage, totalPages]);

  if (totalItems === 0) return null;

  return (
    <div
      className={`px-4 py-3 bg-slate-50/90 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 ${className}`}
    >
      {/* Left side: Rows per page and showing info */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2">
          <label htmlFor="pagination-page-size" className="text-slate-500 font-medium whitespace-nowrap">
            Baris per halaman:
          </label>
          <select
            id="pagination-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-m3-primary/30 cursor-pointer shadow-2xs"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 0 ? 'Semua' : opt}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-400 hidden sm:inline">•</span>

        <div className="text-slate-600">
          Menampilkan <strong className="text-slate-900 font-bold">{startIndex}</strong> -{' '}
          <strong className="text-slate-900 font-bold">{endIndex}</strong> dari{' '}
          <strong className="text-slate-900 font-bold">{totalItems}</strong> {itemLabel}
        </div>
      </div>

      {/* Right side: Navigation buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
          {/* First page button */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage === 1}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Halaman Pertama"
            aria-label="Halaman Pertama"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous page button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(safeCurrentPage - 1, 1))}
            disabled={safeCurrentPage === 1}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Halaman Sebelumnya"
            aria-label="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page numbers (tablet and desktop) */}
          <div className="hidden sm:flex items-center gap-1">
            {paginationRange.map((page, pIdx) => {
              if (typeof page === 'string') {
                return (
                  <span key={`dots-${pIdx}`} className="px-2 py-1 text-slate-400 select-none font-bold">
                    ...
                  </span>
                );
              }
              const isCurrent = page === safeCurrentPage;
              return (
                <button
                  key={`page-${page}`}
                  type="button"
                  onClick={() => onPageChange(page)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-m3-primary text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          {/* Mobile simple page indicator */}
          <span className="sm:hidden px-2 text-xs font-bold text-slate-700">
            {safeCurrentPage} / {totalPages}
          </span>

          {/* Next page button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(safeCurrentPage + 1, totalPages))}
            disabled={safeCurrentPage === totalPages}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Halaman Selanjutnya"
            aria-label="Halaman Selanjutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last page button */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrentPage === totalPages}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Halaman Terakhir"
            aria-label="Halaman Terakhir"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
