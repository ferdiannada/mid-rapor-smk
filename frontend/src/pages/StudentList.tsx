import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Layers,
  GraduationCap,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { masterService } from '../services/master.service';
import { Rombel, Student } from '../types';
import { SearchableRombelSelect } from '../components/common/SearchableRombelSelect';
import { M3Card, M3Button, M3Chip, M3TextField, M3Dialog } from '../components/m3';
import { Skeleton } from '../components/common/Skeleton';

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

export const StudentList: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rombels, setRombels] = useState<Rombel[]>([]);
  const [selectedRombelId, setSelectedRombelId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [activeRombel, setActiveRombel] = useState<Rombel | null>(null);

  const [isLoadingRombels, setIsLoadingRombels] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedTingkat, setSelectedTingkat] = useState<number | 'all'>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNisn, setFormNisn] = useState('');
  const [formNis, setFormNis] = useState('');
  const [formJk, setFormJk] = useState<'L' | 'P'>('L');
  const [formTempatLahir, setFormTempatLahir] = useState('');
  const [formTanggalLahir, setFormTanggalLahir] = useState('');
  const [formRombelId, setFormRombelId] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [forceDelete, setForceDelete] = useState(false);

  // Action feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load rombels on mount
  useEffect(() => {
    loadRombels();
  }, []);

  const loadRombels = async () => {
    setIsLoadingRombels(true);
    try {
      const res = await masterService.getRombels();
      const list = res.rombels || [];
      setRombels(list);
      if (list.length > 0 && !selectedRombelId) {
        const firstWithStudents = list.find((r) => (r.student_count || 0) > 0);
        setSelectedRombelId(firstWithStudents ? firstWithStudents.id : list[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingRombels(false);
    }
  };

  // Load students when selected rombel or includeInactive changes
  useEffect(() => {
    if (selectedRombelId) {
      loadStudents(selectedRombelId, includeInactive);
    }
  }, [selectedRombelId, includeInactive]);

  const loadStudents = async (rombelId: string, withInactive: boolean) => {
    setIsLoadingStudents(true);
    try {
      const res = await masterService.getRombelStudents(rombelId, withInactive);
      setStudents(res.students || []);
      setActiveRombel(res.rombel || null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const filterableRombels = useMemo(() => {
    return rombels.filter((r) => (r.student_count || 0) > 0);
  }, [rombels]);

  const tingkats = useMemo(() => {
    const list = Array.from(new Set(filterableRombels.map((r) => r.tingkat))).filter(Boolean);
    return list.sort((a, b) => a - b);
  }, [filterableRombels]);

  const displayedRombels = useMemo(() => {
    if (selectedTingkat === 'all') return filterableRombels;
    return filterableRombels.filter((r) => r.tingkat === selectedTingkat);
  }, [filterableRombels, selectedTingkat]);

  useEffect(() => {
    if (filterableRombels.length > 0 && selectedRombelId) {
      const exists = filterableRombels.some((r) => r.id === selectedRombelId);
      if (!exists) {
        setSelectedRombelId(filterableRombels[0].id);
      }
    }
  }, [filterableRombels, selectedRombelId]);

  const { maleCount, femaleCount } = useMemo(() => {
    let male = 0;
    let female = 0;
    students.forEach((s) => {
      if (s.jenis_kelamin === 'L') male++;
      else if (s.jenis_kelamin === 'P') female++;
    });
    return { maleCount: male, femaleCount: female };
  }, [students]);

  const handleTingkatChange = (tingkat: number | 'all') => {
    setSelectedTingkat(tingkat);
    if (tingkat !== 'all') {
      const firstInTingkat = filterableRombels.find((r) => r.tingkat === tingkat);
      if (firstInTingkat && activeRombel?.tingkat !== tingkat) {
        setSelectedRombelId(firstInTingkat.id);
      }
    }
  };

  const handleRombelChange = (rombelId: string) => {
    setSelectedRombelId(rombelId);
    const target = filterableRombels.find((r) => r.id === rombelId);
    if (target && selectedTingkat !== 'all' && target.tingkat !== selectedTingkat) {
      setSelectedTingkat(target.tingkat);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRombelId, includeInactive, itemsPerPage]);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return students.filter((s) => {
      return (
        s.name.toLowerCase().includes(term) ||
        (s.nisn && s.nisn.includes(term)) ||
        (s.nis && s.nis.includes(term))
      );
    });
  }, [students, searchTerm]);

  const totalItems = filteredStudents.length;
  const totalPages = itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;

  const safeCurrentPage = useMemo(() => {
    if (totalPages === 0) return 1;
    return Math.min(Math.max(currentPage, 1), totalPages);
  }, [currentPage, totalPages]);

  const paginatedStudents = useMemo(() => {
    if (itemsPerPage <= 0) return filteredStudents;
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, safeCurrentPage, itemsPerPage]);

  const startIndex = totalItems === 0 ? 0 : itemsPerPage <= 0 ? 1 : (safeCurrentPage - 1) * itemsPerPage + 1;
  const endIndex = itemsPerPage <= 0 ? totalItems : Math.min(safeCurrentPage * itemsPerPage, totalItems);

  const paginationRange = useMemo(() => {
    return getPaginationRange(safeCurrentPage, totalPages);
  }, [safeCurrentPage, totalPages]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setFormName('');
    setFormNisn('');
    setFormNis('');
    setFormJk('L');
    setFormTempatLahir('');
    setFormTanggalLahir('');
    setFormRombelId(selectedRombelId || (filterableRombels[0]?.id ?? rombels[0]?.id ?? ''));
    setActionMessage(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setSelectedStudent(student);
    setFormName(student.name);
    setFormNisn(student.nisn || '');
    setFormNis(student.nis || '');
    setFormJk(student.jenis_kelamin === 'P' ? 'P' : 'L');
    setFormTempatLahir(student.tempat_lahir || '');
    setFormTanggalLahir(student.tanggal_lahir || '');
    setFormIsActive(student.is_active !== false);
    setActionMessage(null);
    setIsEditModalOpen(true);
  };

  const handleOpenTransferModal = (student: Student) => {
    setSelectedStudent(student);
    const otherRombel = filterableRombels.find((r) => r.id !== student.rombel_id);
    setFormRombelId(otherRombel ? otherRombel.id : filterableRombels[0]?.id || student.rombel_id);
    setActionMessage(null);
    setIsTransferModalOpen(true);
  };

  const handleOpenDeleteModal = (student: Student) => {
    setSelectedStudent(student);
    setForceDelete(false);
    setActionMessage(null);
    setIsDeleteModalOpen(true);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRombelId) {
      setActionMessage({ type: 'error', text: 'Nama siswa dan rombel wajib diisi' });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await masterService.createStudent({
        name: formName.trim(),
        nisn: formNisn.trim() || undefined,
        nis: formNis.trim() || undefined,
        rombel_id: formRombelId,
        jenis_kelamin: formJk,
        tempat_lahir: formTempatLahir.trim() || undefined,
        tanggal_lahir: formTanggalLahir.trim() || undefined,
      });

      setIsAddModalOpen(false);
      await loadRombels();
      if (formRombelId === selectedRombelId) {
        await loadStudents(selectedRombelId, includeInactive);
      } else {
        setSelectedRombelId(formRombelId);
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal menambahkan peserta didik' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !formName.trim()) return;

    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await masterService.updateStudent(selectedStudent.id, {
        name: formName.trim(),
        nisn: formNisn.trim() || undefined,
        nis: formNis.trim() || undefined,
        jenis_kelamin: formJk,
        tempat_lahir: formTempatLahir.trim() || undefined,
        tanggal_lahir: formTanggalLahir.trim() || undefined,
        is_active: formIsActive,
      });

      setIsEditModalOpen(false);
      await loadStudents(selectedRombelId, includeInactive);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal memperbarui data siswa' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !formRombelId) return;

    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await masterService.transferStudent(selectedStudent.id, formRombelId);
      setIsTransferModalOpen(false);
      await loadRombels();
      await loadStudents(selectedRombelId, includeInactive);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal memindahkan rombel siswa' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;

    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await masterService.deleteStudent(selectedStudent.id, forceDelete);
      setIsDeleteModalOpen(false);
      await loadRombels();
      await loadStudents(selectedRombelId, includeInactive);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal memproses penghapusan siswa' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-m3-outline-variant/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-m3-on-surface">
              Data Peserta Didik
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-m3-secondary-container text-m3-on-secondary-container">
              Kurikulum Merdeka
            </span>
          </div>
          <p className="text-xs text-m3-on-surface-variant mt-0.5">
            Pengelolaan data siswa per rombongan belajar terintegrasi Dapodik.
          </p>
        </div>

        {isAdmin && (
          <M3Button
            variant="filled"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAddModal}
          >
            Tambah Siswa Manual
          </M3Button>
        )}
      </div>

      {/* Rombel Selector & Filter Toolbar (M3 Card) */}
      <M3Card variant="outlined" className="p-4 space-y-3">
        {/* Top Controls: Grade Tabs & Class Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Tingkat Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-[11px] font-bold text-m3-on-surface-variant uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-m3-outline" />
              Tingkat:
            </span>
            <M3Chip
              selected={selectedTingkat === 'all'}
              onClick={() => handleTingkatChange('all')}
            >
              Semua ({filterableRombels.length})
            </M3Chip>
            {tingkats.map((t) => {
              const count = filterableRombels.filter((r) => r.tingkat === t).length;
              return (
                <M3Chip
                  key={t}
                  selected={selectedTingkat === t}
                  onClick={() => handleTingkatChange(t)}
                >
                  Kelas {t} ({count})
                </M3Chip>
              );
            })}
          </div>

          {/* Searchable Rombel Select */}
          <div className="w-full lg:w-auto lg:min-w-[300px]">
            <SearchableRombelSelect
              id="student-list-rombel"
              rombels={displayedRombels}
              selectedRombelId={selectedRombelId}
              onSelect={handleRombelChange}
              disabled={isLoadingRombels || filterableRombels.length === 0}
              filterEmpty={true}
            />
          </div>
        </div>

        {/* Active Class Metadata & Quick Search */}
        {activeRombel && (
          <div className="pt-2.5 border-t border-m3-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Class info badges */}
            <div className="flex flex-wrap items-center gap-2 text-m3-on-surface-variant">
              <span className="font-bold text-m3-on-surface flex items-center gap-1.5 bg-m3-surface-container px-2.5 py-1 rounded-lg">
                <Layers className="w-3.5 h-3.5 text-m3-primary" />
                {activeRombel.name}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-m3-primary-container text-m3-on-primary-container font-bold text-[11px]">
                Tingkat {activeRombel.tingkat}
              </span>
              {activeRombel.is_manual_override && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                  Manual Override
                </span>
              )}
              <div className="flex items-center gap-1 text-m3-on-surface-variant">
                <GraduationCap className="w-3.5 h-3.5 text-m3-outline" />
                <span>
                  Wali: <strong className="text-m3-on-surface">{activeRombel.wali_kelas?.name || 'Belum Ditetapkan'}</strong>
                </span>
                {activeRombel.wali_kelas?.nip_nik && (
                  <span className="text-[10px] text-m3-outline font-mono">
                    ({activeRombel.wali_kelas.nip_nik})
                  </span>
                )}
              </div>
              <span className="text-m3-on-surface-variant font-medium">
                • {students.length} siswa ({maleCount} L, {femaleCount} P)
              </span>
            </div>

            {/* Search and Inactive filter */}
            <div className="flex items-center gap-2 self-stretch md:self-auto">
              {isAdmin && (
                <label className="flex items-center gap-1.5 text-m3-on-surface-variant cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-m3-surface-container text-xs shrink-0">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                    className="rounded text-m3-primary focus:ring-m3-primary"
                  />
                  <span>Siswa Nonaktif</span>
                </label>
              )}

              <div className="w-full md:w-56">
                <M3TextField
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari siswa atau NISN..."
                  leadingIcon={<Search className="w-3.5 h-3.5" />}
                />
              </div>
            </div>
          </div>
        )}
      </M3Card>

      {/* Students Table */}
      {activeRombel && (
        <M3Card variant="outlined" className="overflow-hidden">
          {isLoadingStudents ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-m3-on-surface-variant space-y-2">
              <Users className="w-9 h-9 mx-auto text-m3-outline" />
              <p className="text-sm font-semibold text-m3-on-surface">Tidak ada siswa ditemukan</p>
              <p className="text-xs text-m3-on-surface-variant">
                {searchTerm
                  ? 'Coba ubah kata kunci pencarian Anda.'
                  : 'Rombel ini belum memiliki peserta didik aktif.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="border-b border-m3-outline-variant/20 bg-m3-surface-container text-m3-on-surface-variant text-left">
                    <th className="py-2.5 px-4 font-bold w-12 text-center">No</th>
                    <th className="py-2.5 px-4 font-bold">NISN / NIS</th>
                    <th className="py-2.5 px-4 font-bold">Nama Lengkap Siswa</th>
                    <th className="py-2.5 px-4 font-bold text-center">L/P</th>
                    <th className="py-2.5 px-4 font-bold">Tempat, Tanggal Lahir</th>
                    <th className="py-2.5 px-4 font-bold text-center">Sumber Data</th>
                    {isAdmin && <th className="py-2.5 px-4 font-bold text-center">Aksi Pengelolaan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-outline-variant/10 text-m3-on-surface">
                  {paginatedStudents.map((s, idx) => (
                    <tr
                      key={s.id}
                      className={`hover:bg-m3-surface-container/40 transition-colors ${
                        s.is_active === false ? 'opacity-60 bg-m3-surface-container/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center font-bold text-m3-outline">
                        {itemsPerPage <= 0 ? idx + 1 : (safeCurrentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono font-bold text-m3-primary block">{s.nisn || '-'}</span>
                        {s.nis && <span className="font-mono text-[10px] text-m3-outline">NIS: {s.nis}</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-m3-on-surface text-sm block">{s.name}</span>
                        {s.is_active === false && (
                          <span className="text-[10px] font-bold text-m3-error bg-m3-error-container px-1.5 py-0.5 rounded">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            s.jenis_kelamin === 'L'
                              ? 'bg-m3-primary-container text-m3-on-primary-container'
                              : 'bg-m3-secondary-container text-m3-on-secondary-container'
                          }`}
                        >
                          {s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-m3-on-surface-variant">
                        {s.tempat_lahir || '-'}, {s.tanggal_lahir || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {s.is_manual_override ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full"
                            title="Data siswa ini disesuaikan manual"
                          >
                            <ShieldCheck className="w-3 h-3 text-amber-700" />
                            <span>Manual</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-m3-outline font-medium">Dapodik</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(s)}
                              className="p-1.5 text-m3-primary hover:bg-m3-primary-container/40 rounded-full transition cursor-pointer"
                              title="Edit Data Siswa"
                              aria-label={`Edit ${s.name}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTransferModal(s)}
                              className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-full transition cursor-pointer"
                              title="Pindah Rombel"
                              aria-label={`Pindahkan rombel ${s.name}`}
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(s)}
                              className="p-1.5 text-m3-error hover:bg-m3-error-container/40 rounded-full transition cursor-pointer"
                              title="Hapus / Nonaktifkan"
                              aria-label={`Hapus atau nonaktifkan ${s.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* M3 Pagination Toolbar */}
              <div className="p-3.5 border-t border-m3-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-m3-surface">
                <div className="flex items-center gap-2 text-m3-on-surface-variant">
                  <span>Baris per halaman:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="bg-m3-surface-container border border-m3-outline-variant rounded-lg px-2 py-1 text-xs text-m3-on-surface font-semibold outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={0}>Semua</option>
                  </select>
                  <span>• Menampilkan {startIndex} - {endIndex} dari {totalItems} siswa</span>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={safeCurrentPage === 1}
                      className="p-1.5 rounded-lg border border-m3-outline-variant bg-m3-surface text-m3-on-surface hover:bg-m3-surface-container disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Halaman Pertama"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={safeCurrentPage === 1}
                      className="p-1.5 rounded-lg border border-m3-outline-variant bg-m3-surface text-m3-on-surface hover:bg-m3-surface-container disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="hidden sm:flex items-center gap-1">
                      {paginationRange.map((page, pIdx) => {
                        if (typeof page === 'string') {
                          return (
                            <span key={`dots-${pIdx}`} className="px-2 py-1 text-m3-outline select-none font-bold">
                              ...
                            </span>
                          );
                        }
                        const isCurrent = page === safeCurrentPage;
                        return (
                          <button
                            key={`page-${page}`}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-m3-primary text-m3-on-primary shadow-xs'
                                : 'bg-m3-surface border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>

                    <span className="sm:hidden px-2 text-xs font-bold text-m3-on-surface">
                      {safeCurrentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={safeCurrentPage === totalPages}
                      className="p-1.5 rounded-lg border border-m3-outline-variant bg-m3-surface text-m3-on-surface hover:bg-m3-surface-container disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Halaman Selanjutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safeCurrentPage === totalPages}
                      className="p-1.5 rounded-lg border border-m3-outline-variant bg-m3-surface text-m3-on-surface hover:bg-m3-surface-container disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Halaman Terakhir"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </M3Card>
      )}

      {/* 1. Modal Tambah Siswa Manual */}
      <M3Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Peserta Didik Manual"
        icon={<Users className="w-5 h-5 text-m3-primary" />}
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          {actionMessage && (
            <div
              role="alert"
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                actionMessage.type === 'error'
                  ? 'bg-m3-error-container text-m3-on-error-container'
                  : 'bg-m3-secondary-container text-m3-on-secondary-container'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionMessage.text}</span>
            </div>
          )}

          <M3TextField
            label="Nama Lengkap Siswa"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Contoh: Muhammad Rizki"
          />

          <div className="grid grid-cols-2 gap-3">
            <M3TextField
              label="NISN (10 Digit)"
              value={formNisn}
              onChange={(e) => setFormNisn(e.target.value)}
              placeholder="0071234567"
            />
            <M3TextField
              label="NIS Sekolah"
              value={formNis}
              onChange={(e) => setFormNis(e.target.value)}
              placeholder="2425101"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-m3-on-surface-variant px-1">
                Jenis Kelamin
              </label>
              <select
                value={formJk}
                onChange={(e) => setFormJk(e.target.value as 'L' | 'P')}
                className="w-full bg-m3-surface border border-m3-outline-variant focus:border-2 focus:border-m3-primary rounded-xl px-3 py-2 text-xs text-m3-on-surface outline-none"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-m3-on-surface-variant px-1">
                Rombel (Kelas)
              </label>
              <SearchableRombelSelect
                id="modal-add-student-rombel"
                rombels={filterableRombels}
                selectedRombelId={formRombelId}
                onSelect={(id) => setFormRombelId(id)}
                filterEmpty={true}
                placeholder="Pilih Rombel"
                buttonClassName="py-2 px-3 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <M3TextField
              label="Tempat Lahir"
              value={formTempatLahir}
              onChange={(e) => setFormTempatLahir(e.target.value)}
              placeholder="Contoh: Banyuwangi"
            />
            <M3TextField
              label="Tanggal Lahir"
              type="date"
              value={formTanggalLahir}
              onChange={(e) => setFormTanggalLahir(e.target.value)}
            />
          </div>

          <div className="pt-3 border-t border-m3-outline-variant/20 flex items-center justify-end gap-2">
            <M3Button variant="text" onClick={() => setIsAddModalOpen(false)}>
              Batal
            </M3Button>
            <M3Button
              type="submit"
              variant="filled"
              disabled={isSubmitting}
              icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              Simpan Siswa
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* 2. Modal Edit Identitas Siswa */}
      <M3Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Data Peserta Didik"
        icon={<Edit2 className="w-5 h-5 text-m3-primary" />}
      >
        <form onSubmit={handleUpdateStudent} className="space-y-4">
          {actionMessage && (
            <div
              role="alert"
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                actionMessage.type === 'error'
                  ? 'bg-m3-error-container text-m3-on-error-container'
                  : 'bg-m3-secondary-container text-m3-on-secondary-container'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionMessage.text}</span>
            </div>
          )}

          <M3TextField
            label="Nama Lengkap Siswa"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <M3TextField
              label="NISN"
              value={formNisn}
              onChange={(e) => setFormNisn(e.target.value)}
            />
            <M3TextField
              label="NIS Sekolah"
              value={formNis}
              onChange={(e) => setFormNis(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-m3-on-surface-variant px-1">
                Jenis Kelamin
              </label>
              <select
                value={formJk}
                onChange={(e) => setFormJk(e.target.value as 'L' | 'P')}
                className="w-full bg-m3-surface border border-m3-outline-variant focus:border-2 focus:border-m3-primary rounded-xl px-3 py-2 text-xs text-m3-on-surface outline-none"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-m3-on-surface-variant px-1">
                Status Keaktifan
              </label>
              <select
                value={formIsActive ? 'true' : 'false'}
                onChange={(e) => setFormIsActive(e.target.value === 'true')}
                className="w-full bg-m3-surface border border-m3-outline-variant focus:border-2 focus:border-m3-primary rounded-xl px-3 py-2 text-xs text-m3-on-surface outline-none font-bold"
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif / Mutasi</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <M3TextField
              label="Tempat Lahir"
              value={formTempatLahir}
              onChange={(e) => setFormTempatLahir(e.target.value)}
            />
            <M3TextField
              label="Tanggal Lahir"
              type="date"
              value={formTanggalLahir}
              onChange={(e) => setFormTanggalLahir(e.target.value)}
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-100/70 border border-amber-300 text-[11px] text-amber-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
            <span>
              Perubahan identitas akan disimpan sebagai <strong>Manual Override</strong> dan dilindungi dari penimpaan otomatis pada sinkronisasi Dapodik berikutnya.
            </span>
          </div>

          <div className="pt-3 border-t border-m3-outline-variant/20 flex items-center justify-end gap-2">
            <M3Button variant="text" onClick={() => setIsEditModalOpen(false)}>
              Batal
            </M3Button>
            <M3Button
              type="submit"
              variant="filled"
              disabled={isSubmitting}
              icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              Simpan Perubahan
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* 3. Modal Pindah Rombel */}
      <M3Dialog
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Pindah Rombongan Belajar (Mutasi Kelas)"
        icon={<ArrowRightLeft className="w-5 h-5 text-amber-700" />}
      >
        <form onSubmit={handleTransferStudent} className="space-y-4">
          {actionMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs flex items-center gap-2 bg-m3-error-container text-m3-on-error-container"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionMessage.text}</span>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-m3-surface-container border border-m3-outline-variant/30 text-xs space-y-1">
            <span className="text-[11px] text-m3-on-surface-variant font-medium">Siswa Terpilih:</span>
            <p className="font-bold text-m3-on-surface text-sm">{selectedStudent?.name}</p>
            <p className="font-mono text-m3-on-surface-variant">NISN: {selectedStudent?.nisn || '-'}</p>
            <p className="text-m3-on-surface-variant">
              Kelas Saat Ini: <strong className="text-m3-primary">{activeRombel?.name}</strong>
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-m3-on-surface-variant px-1">
              Pindahkan Ke Rombongan Belajar Baru
            </label>
            <SearchableRombelSelect
              id="modal-transfer-student-rombel"
              rombels={filterableRombels.filter((r) => r.id !== selectedStudent?.rombel_id)}
              selectedRombelId={formRombelId}
              onSelect={(id) => setFormRombelId(id)}
              filterEmpty={true}
              placeholder="Pilih Rombel Tujuan"
              buttonClassName="py-2 px-3 text-xs"
            />
          </div>

          <div className="text-[11px] text-m3-on-surface-variant bg-m3-surface-container p-3 rounded-xl border border-m3-outline-variant/20 flex items-start gap-2">
            <Info className="w-4 h-4 text-m3-primary shrink-0 mt-0.5" />
            <span>
              <strong>Catatan:</strong> Nilai rapor yang sudah diinput pada semester aktif tetap aman dan akan otomatis mengikuti profil siswa di rombel baru.
            </span>
          </div>

          <div className="pt-3 border-t border-m3-outline-variant/20 flex items-center justify-end gap-2">
            <M3Button variant="text" onClick={() => setIsTransferModalOpen(false)}>
              Batal
            </M3Button>
            <M3Button
              type="submit"
              variant="tonal"
              disabled={isSubmitting}
              icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              Pindahkan Kelas
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* 4. Modal Hapus / Nonaktifkan Siswa */}
      <M3Dialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Nonaktifkan / Hapus Siswa"
        icon={<Trash2 className="w-5 h-5 text-m3-error" />}
        actions={
          <>
            <M3Button variant="text" onClick={() => setIsDeleteModalOpen(false)}>
              Batal
            </M3Button>
            <M3Button
              variant="danger"
              disabled={isSubmitting}
              onClick={handleDeleteStudent}
              icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              {forceDelete ? 'Hapus Permanen' : 'Nonaktifkan Siswa'}
            </M3Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs flex items-center gap-2 bg-m3-error-container text-m3-on-error-container"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionMessage.text}</span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-m3-error-container text-m3-on-error-container text-xs space-y-1.5">
            <p className="font-bold text-sm">Konfirmasi Penghapusan Peserta Didik</p>
            <p>
              Apakah Anda yakin ingin memproses siswa <strong>{selectedStudent?.name}</strong> (NISN: {selectedStudent?.nisn || '-'})?
            </p>
          </div>

          <div className="space-y-2 text-xs text-m3-on-surface-variant">
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-m3-outline-variant hover:bg-m3-surface-container cursor-pointer">
              <input
                type="radio"
                name="delete_mode"
                checked={!forceDelete}
                onChange={() => setForceDelete(false)}
                className="mt-0.5 text-m3-primary"
              />
              <div>
                <strong className="text-m3-on-surface block">Nonaktifkan Siswa (Direkomendasikan)</strong>
                <span className="text-[11px] text-m3-on-surface-variant">
                  Siswa disembunyikan dari rombel aktif, namun seluruh nilai rapor masa lalunya tetap utuh dan tersimpan.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-m3-error/40 bg-m3-error-container/20 hover:bg-m3-error-container/30 cursor-pointer">
              <input
                type="radio"
                name="delete_mode"
                checked={forceDelete}
                onChange={() => setForceDelete(true)}
                className="mt-0.5 text-m3-error"
              />
              <div>
                <strong className="text-m3-on-surface block">Hapus Permanen Dari Database</strong>
                <span className="text-[11px] text-m3-error">
                  Hanya diperbolehkan jika siswa belum memiliki riwayat nilai rapor sama sekali.
                </span>
              </div>
            </label>
          </div>
        </div>
      </M3Dialog>
    </div>
  );
};
