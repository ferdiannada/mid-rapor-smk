import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  MoveRight,
  ShieldCheck,
  Database,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { masterService } from '../services/master.service';
import { Subject, SubjectGroupSummary } from '../types';
import { M3Button, M3Card, M3TextField, M3Dialog } from '../components/m3';

export const SubjectGroups: React.FC = () => {
  const [groups, setGroups] = useState<SubjectGroupSummary[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');

  // Multi-selection
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [bulkTargetKelompok, setBulkTargetKelompok] = useState('A');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Status Notification
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Create Dialog
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createGroupCode, setCreateGroupCode] = useState('');
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupDeskripsi, setCreateGroupDeskripsi] = useState('');
  const [createGroupUrutan, setCreateGroupUrutan] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Dialog
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SubjectGroupSummary | null>(null);
  const [editGroupCode, setEditGroupCode] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDeskripsi, setEditGroupDeskripsi] = useState('');
  const [editGroupUrutan, setEditGroupUrutan] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTargetKelompok, setDeleteTargetKelompok] = useState('B');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [summaryRes, subjectsRes] = await Promise.all([
        masterService.getSubjectGroupsSummary(),
        masterService.getSubjects(),
      ]);
      const loadedGroups = summaryRes.groups || [];
      setGroups(loadedGroups);
      setAllSubjects(subjectsRes.subjects || []);
      setSelectedSubjectIds([]);
      if (loadedGroups.length > 0 && !loadedGroups.some((g) => g.kode === bulkTargetKelompok)) {
        setBulkTargetKelompok(loadedGroups[0].kode);
      }
    } catch (err: any) {
      console.error(err);
      showBanner('error', err.message || 'Gagal memuat data kelompok mata pelajaran');
    } finally {
      setIsLoading(false);
    }
  };

  const showBanner = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => {
      setStatusBanner(null);
    }, 5000);
  };

  const filteredSubjects = useMemo(() => {
    return allSubjects.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.nama.toLowerCase().includes(q) ||
        (s.kelompok || '').toLowerCase().includes(q);
      const matchGroup =
        selectedGroupFilter === 'all' || s.kelompok === selectedGroupFilter;
      return matchSearch && matchGroup;
    });
  }, [allSubjects, searchQuery, selectedGroupFilter]);

  const handleToggleSelectAll = () => {
    if (
      selectedSubjectIds.length === filteredSubjects.length &&
      filteredSubjects.length > 0
    ) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(filteredSubjects.map((s) => s.id));
    }
  };

  const handleToggleSelectSubject = (id: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyBulkKelompok = async () => {
    if (selectedSubjectIds.length === 0) return;
    setIsSubmittingBulk(true);
    try {
      const res = await masterService.bulkUpdateSubjectKelompok(
        selectedSubjectIds,
        bulkTargetKelompok
      );
      showBanner(
        'success',
        res.message || `${selectedSubjectIds.length} mata pelajaran berhasil dipindahkan.`
      );
      setSelectedSubjectIds([]);
      await loadData();
    } catch (err: any) {
      showBanner(
        'error',
        err.response?.data?.message || err.message || 'Gagal memindahkan mata pelajaran'
      );
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const handleInlineChangeKelompok = async (subjectId: string, newKelompok: string) => {
    try {
      const res = await masterService.bulkUpdateSubjectKelompok([subjectId], newKelompok);
      showBanner('success', res.message || 'Kelompok mata pelajaran diperbarui.');
      await loadData();
    } catch (err: any) {
      showBanner(
        'error',
        err.response?.data?.message || err.message || 'Gagal memperbarui kelompok'
      );
    }
  };

  const handleOpenCreateModal = () => {
    setCreateGroupCode('');
    setCreateGroupName('');
    setCreateGroupDeskripsi('');
    setCreateGroupUrutan(String(groups.length + 1));
    setIsCreateModalOpen(true);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = createGroupCode.trim();
    const name = createGroupName.trim();
    if (!code || !name) return;

    setIsSubmittingCreate(true);
    try {
      await masterService.createSubjectGroup({
        kode: code,
        nama: name,
        deskripsi: createGroupDeskripsi.trim(),
        urutan: createGroupUrutan ? Number(createGroupUrutan) : undefined,
        subject_ids: selectedSubjectIds.length > 0 ? selectedSubjectIds : undefined,
      });

      showBanner(
        'success',
        selectedSubjectIds.length > 0
          ? `Kelompok '${name}' dibuat dan diterapkan ke ${selectedSubjectIds.length} mapel.`
          : `Kelompok '${name}' berhasil ditambahkan.`
      );
      setIsCreateModalOpen(false);
      setCreateGroupCode('');
      setCreateGroupName('');
      setCreateGroupDeskripsi('');
      setCreateGroupUrutan('');
      setSelectedSubjectIds([]);
      await loadData();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || err.message || 'Gagal membuat kelompok');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenEditModal = (group: SubjectGroupSummary) => {
    setEditingGroup(group);
    setEditGroupCode(group.kode);
    setEditGroupName(group.nama);
    setEditGroupDeskripsi(group.deskripsi || '');
    setEditGroupUrutan(group.urutan ? String(group.urutan) : '1');
    setIsEditModalOpen(true);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    const code = editGroupCode.trim();
    const name = editGroupName.trim();
    if (!code || !name) return;

    setIsSubmittingEdit(true);
    try {
      await masterService.updateSubjectGroup(editingGroup.kode, {
        kode: code,
        nama: name,
        deskripsi: editGroupDeskripsi.trim(),
        urutan: editGroupUrutan ? Number(editGroupUrutan) : undefined,
      });

      showBanner('success', `Kelompok '${name}' berhasil diperbarui.`);
      setIsEditModalOpen(false);
      if (selectedGroupFilter === editingGroup.kode) {
        setSelectedGroupFilter(code);
      }
      setEditingGroup(null);
      await loadData();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || err.message || 'Gagal memperbarui kelompok');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenDeleteDialog = (group: SubjectGroupSummary) => {
    setEditingGroup(group);
    const fallbackGroup = groups.find((g) => g.kode !== group.kode);
    if (fallbackGroup) {
      setDeleteTargetKelompok(fallbackGroup.kode);
    }
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!editingGroup) return;

    setIsSubmittingDelete(true);
    try {
      await masterService.deleteSubjectGroup(
        editingGroup.kode,
        editingGroup.count > 0 ? deleteTargetKelompok : undefined
      );

      showBanner('success', `Kelompok '${editingGroup.nama}' berhasil dihapus.`);
      setIsDeleteDialogOpen(false);
      setIsEditModalOpen(false);
      if (selectedGroupFilter === editingGroup.kode) {
        setSelectedGroupFilter('all');
      }
      setEditingGroup(null);
      await loadData();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || err.message || 'Gagal menghapus kelompok');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // M3 Tonal Badge Styling
  const getGroupBadgeColor = (kode: string) => {
    switch (kode) {
      case 'A':
        return 'bg-m3-primary-container text-m3-on-primary-container border-m3-primary/20';
      case 'B':
        return 'bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary/20';
      case 'C':
        return 'bg-m3-tertiary-container text-m3-on-tertiary-container border-m3-tertiary/20';
      case 'Muatan Lokal':
      case 'MULOK':
        return 'bg-amber-100 text-amber-950 border-amber-300';
      default:
        return 'bg-m3-surface-variant text-m3-on-surface-variant border-m3-outline-variant';
    }
  };

  const isCoreGroup = (kode: string) => kode === 'A' || kode === 'B';

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header - M3 Surface Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-m3-outline-variant/30">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-surface-container text-m3-on-surface-variant text-xs font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-m3-primary"></span>
            <span>Kurikulum Merdeka SMK</span>
            <span>•</span>
            <span>Struktur Rapor</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-m3-on-surface tracking-tight">
            Kelompok Mata Pelajaran
          </h1>
          <p className="text-xs sm:text-sm text-m3-on-surface-variant mt-1.5 max-w-2xl leading-relaxed">
            Atur kelompok mata pelajaran dan urutan hierarki untuk pembagian sub-tabel pada dokumen rapor.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link to="/settings/subjects">
            <M3Button variant="outlined" size="sm" icon={<Layers className="w-4 h-4" />}>
              Mata Pelajaran & TP
            </M3Button>
          </Link>

          <M3Button
            variant="filled"
            size="sm"
            onClick={handleOpenCreateModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Tambah Kelompok
          </M3Button>
        </div>
      </div>

      {/* Status Feedback - M3 Tonal Notification */}
      {statusBanner && (
        <div
          role="status"
          className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold transition-all ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
              : 'bg-m3-error-container text-m3-on-error-container border border-m3-error/20'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-m3-error shrink-0" />
            )}
            <span className="truncate">{statusBanner.message}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="p-1.5 rounded-full hover:bg-black/8 text-m3-on-surface-variant cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 ml-2"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* M3 Cards Overview & Interactive Filter Deck */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-m3-on-surface-variant uppercase tracking-wider">
              Kelompok Terdaftar ({groups.length})
            </h2>
            <span className="text-[11px] text-m3-outline">• Klik kartu untuk filter tabel</span>
          </div>
          {selectedGroupFilter !== 'all' && (
            <button
              onClick={() => setSelectedGroupFilter('all')}
              className="text-xs font-bold text-m3-primary hover:underline cursor-pointer"
            >
              Reset Filter ({allSubjects.length} Mapel)
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {groups.map((group) => {
            const isSelected = selectedGroupFilter === group.kode;
            return (
              <div
                key={group.kode}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGroupFilter(isSelected ? 'all' : group.kode)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedGroupFilter(isSelected ? 'all' : group.kode);
                  }
                }}
                className={`p-5 rounded-[24px] transition-all cursor-pointer flex flex-col justify-between group relative focus:outline-none focus:ring-2 focus:ring-m3-primary/30 ${
                  isSelected
                    ? 'bg-m3-primary-container/30 border-2 border-m3-primary text-m3-on-primary-container shadow-m3-elevation-1'
                    : 'bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary/40 hover:shadow-m3-elevation-1'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-2.5">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getGroupBadgeColor(
                        group.kode
                      )}`}
                    >
                      Kelompok {group.kode}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(group);
                        }}
                        className="p-1.5 rounded-full text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-on-surface/8 transition-colors cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                        title={`Edit Kelompok ${group.kode}`}
                        aria-label={`Edit kelompok ${group.kode}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {!isCoreGroup(group.kode) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDeleteDialog(group);
                          }}
                          className="p-1.5 rounded-full text-m3-on-surface-variant hover:text-m3-error hover:bg-m3-error-container/40 transition-colors cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                          title={`Hapus Kelompok ${group.kode}`}
                          aria-label={`Hapus kelompok ${group.kode}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-m3-on-surface leading-snug">
                    {group.nama}
                  </h3>
                  <p className="text-[11px] text-m3-on-surface-variant line-clamp-2 mt-1.5 leading-relaxed">
                    {group.deskripsi || 'Tidak ada deskripsi kelompok.'}
                  </p>
                </div>

                <div className="pt-3.5 mt-3.5 border-t border-m3-outline-variant/20 flex items-center justify-between text-xs">
                  <span className="font-bold text-m3-on-surface">
                    {group.count}{' '}
                    <span className="text-[11px] font-normal text-m3-on-surface-variant">
                      Mapel
                    </span>
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      isSelected ? 'text-m3-primary' : 'text-m3-outline'
                    }`}
                  >
                    {isSelected ? 'Sedang difilter' : 'Filter tabel'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Table Container - M3 Surface Card */}
      <M3Card variant="elevated" className="p-5 sm:p-6 space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-m3-on-surface">
              Daftar Mata Pelajaran
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-m3-surface-container text-m3-on-surface-variant">
              {filteredSubjects.length} dari {allSubjects.length} Mapel
            </span>
            {selectedGroupFilter !== 'all' && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-m3-primary-container text-m3-on-primary-container">
                Filter: Kelompok {selectedGroupFilter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-72">
              <M3TextField
                placeholder="Cari mata pelajaran..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leadingIcon={<Search className="w-4 h-4" />}
              />
            </div>

            <M3Button
              variant="outlined"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Segarkan
            </M3Button>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedSubjectIds.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-m3-on-surface text-m3-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-m3-elevation-3">
            <div className="flex items-center gap-2.5 pl-1 sm:pl-2">
              <span className="w-6 h-6 rounded-full bg-m3-primary text-m3-on-primary flex items-center justify-center font-bold text-xs shrink-0">
                {selectedSubjectIds.length}
              </span>
              <span className="text-xs sm:text-sm font-semibold">
                Mata pelajaran terpilih
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap pr-1 sm:pr-2">
              <span className="text-xs text-m3-outline-variant shrink-0">Pindahkan ke:</span>
              <select
                value={bulkTargetKelompok}
                onChange={(e) => setBulkTargetKelompok(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-white border border-slate-700 text-xs font-semibold focus:outline-none min-h-[36px] cursor-pointer"
              >
                {groups.map((g) => (
                  <option key={g.kode} value={g.kode}>
                    {g.nama}
                  </option>
                ))}
              </select>

              <M3Button
                variant="filled"
                size="sm"
                onClick={handleApplyBulkKelompok}
                disabled={isSubmittingBulk}
                icon={<MoveRight className="w-3.5 h-3.5" />}
              >
                {isSubmittingBulk ? 'Menyimpan...' : 'Terapkan'}
              </M3Button>

              <M3Button
                variant="text"
                size="sm"
                onClick={() => setSelectedSubjectIds([])}
                className="text-white hover:bg-white/10"
              >
                Batal
              </M3Button>
            </div>
          </div>
        )}

        {/* Table with M3 Border & Header Styling */}
        <div className="overflow-x-auto rounded-[20px] border border-m3-outline-variant/30">
          <table className="w-full text-left text-xs text-m3-on-surface min-w-[720px]">
            <thead className="bg-m3-surface-container/60 border-b border-m3-outline-variant/30 font-bold text-m3-on-surface">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      selectedSubjectIds.length === filteredSubjects.length &&
                      filteredSubjects.length > 0
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded border-m3-outline text-m3-primary focus:ring-m3-primary cursor-pointer w-4 h-4"
                    aria-label="Pilih semua mata pelajaran"
                  />
                </th>
                <th className="p-3.5 w-12 text-center">No</th>
                <th className="p-3.5">Mata Pelajaran</th>
                <th className="p-3.5 w-40">Kelompok Saat Ini</th>
                <th className="p-3.5 w-60">Ubah Cepat Kelompok</th>
                <th className="p-3.5 w-24 text-center">TP</th>
                <th className="p-3.5 w-28 text-center">Sumber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant/20 bg-m3-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-m3-outline">
                    Memuat data mata pelajaran...
                  </td>
                </tr>
              ) : filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-m3-outline">
                    Tidak ada mata pelajaran yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub, index) => {
                  const isSelected = selectedSubjectIds.includes(sub.id);
                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-m3-surface-container/30 transition-colors ${
                        isSelected ? 'bg-m3-primary-container/20' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectSubject(sub.id)}
                          className="rounded border-m3-outline text-m3-primary focus:ring-m3-primary cursor-pointer w-4 h-4"
                          aria-label={`Pilih ${sub.nama}`}
                        />
                      </td>
                      <td className="p-3.5 text-center font-mono text-m3-outline">
                        {index + 1}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-m3-on-surface">{sub.nama}</div>
                        <div className="text-[11px] font-mono text-m3-outline mt-0.5">
                          {sub.dapodik_mapel_id
                            ? `ID Dapodik: ${sub.dapodik_mapel_id}`
                            : sub.id}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getGroupBadgeColor(
                            sub.kelompok
                          )}`}
                        >
                          Kelompok {sub.kelompok || 'B'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={sub.kelompok || 'B'}
                          onChange={(e) =>
                            handleInlineChangeKelompok(sub.id, e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-m3-outline-variant/60 text-xs font-semibold bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary cursor-pointer min-h-[36px]"
                        >
                          {groups.map((g) => (
                            <option key={g.kode} value={g.kode}>
                              {g.nama}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="font-semibold text-m3-on-surface-variant px-2.5 py-0.5 bg-m3-surface-container rounded-full">
                          {sub.learning_objective_count || 0}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {sub.is_manual_override ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                            <ShieldCheck className="w-3 h-3 text-amber-700" />
                            Kustom
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-300">
                            <Database className="w-3 h-3 text-blue-700" />
                            Dapodik
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </M3Card>

      {/* M3 Information Card */}
      <div className="bg-m3-surface-container/60 border border-m3-outline-variant/40 rounded-[20px] p-4 text-xs text-m3-on-surface-variant flex items-start gap-3">
        <Info className="w-4 h-4 text-m3-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-m3-on-surface">
            Panduan Kelompok Kurikulum Merdeka SMK:
          </span>
          <p className="leading-relaxed">
            Kelompok A menaungi mata pelajaran muatan umum, Kelompok B untuk muatan kejuruan, sedangkan Kelompok C dan Muatan Lokal diperuntukkan bagi konsentrasi keahlian dan bahasa daerah.
          </p>
        </div>
      </div>

      {/* Dialog: Tambah Kelompok Baru */}
      <M3Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tambah Kelompok Mata Pelajaran"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <M3TextField
            label="Kode Kelompok"
            required
            value={createGroupCode}
            onChange={(e) => setCreateGroupCode(e.target.value)}
            placeholder="Contoh: D, MULOK, PILIHAN"
            helperText="Kode unik singkat tanpa spasi."
          />

          <M3TextField
            label="Nama Lengkap Kelompok"
            required
            value={createGroupName}
            onChange={(e) => setCreateGroupName(e.target.value)}
            placeholder="Contoh: Kelompok D (Mata Pelajaran Pilihan)"
            helperText="Nama resmi yang dicetak sebagai sub-judul nilai pada rapor."
          />

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Deskripsi Kelompok
            </label>
            <textarea
              rows={2}
              value={createGroupDeskripsi}
              onChange={(e) => setCreateGroupDeskripsi(e.target.value)}
              placeholder="Keterangan cakupan mata pelajaran..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface text-xs sm:text-sm focus:outline-none focus:border-m3-primary resize-none"
            />
          </div>

          <M3TextField
            label="Urutan di Dokumen Rapor"
            type="number"
            value={createGroupUrutan}
            onChange={(e) => setCreateGroupUrutan(e.target.value)}
            placeholder="Contoh: 4"
          />

          {selectedSubjectIds.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-m3-primary-container text-m3-on-primary-container text-xs">
              {selectedSubjectIds.length} mata pelajaran yang dicentang akan otomatis dipindahkan ke kelompok baru ini.
            </div>
          )}

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2.5">
            <M3Button variant="text" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Batal
            </M3Button>
            <M3Button variant="filled" type="submit" disabled={isSubmittingCreate}>
              {isSubmittingCreate ? 'Menyimpan...' : 'Simpan Kelompok'}
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* Dialog: Edit Kelompok */}
      <M3Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Kelompok: ${editingGroup?.nama || ''}`}
      >
        <form onSubmit={handleUpdateGroup} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-m3-surface-container text-xs text-m3-on-surface flex items-center justify-between">
            <span className="font-semibold text-m3-on-surface-variant">Mata Pelajaran Terdaftar:</span>
            <span className="font-bold text-m3-primary font-mono">
              {editingGroup?.count || 0} Mapel
            </span>
          </div>

          <M3TextField
            label="Kode Kelompok"
            required
            value={editGroupCode}
            onChange={(e) => setEditGroupCode(e.target.value)}
            helperText={
              editingGroup && editGroupCode !== editingGroup.kode
                ? `Catatan: ${editingGroup.count} mapel di kelompok ini akan otomatis dipindahkan ke kode '${editGroupCode}'.`
                : undefined
            }
          />

          <M3TextField
            label="Nama Lengkap Kelompok"
            required
            value={editGroupName}
            onChange={(e) => setEditGroupName(e.target.value)}
          />

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Deskripsi Kelompok
            </label>
            <textarea
              rows={2}
              value={editGroupDeskripsi}
              onChange={(e) => setEditGroupDeskripsi(e.target.value)}
              placeholder="Keterangan cakupan mata pelajaran..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface text-xs sm:text-sm focus:outline-none focus:border-m3-primary resize-none"
            />
          </div>

          <M3TextField
            label="Urutan di Dokumen Rapor"
            type="number"
            value={editGroupUrutan}
            onChange={(e) => setEditGroupUrutan(e.target.value)}
          />

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-between gap-2.5">
            <div>
              {editingGroup && !isCoreGroup(editingGroup.kode) && (
                <M3Button
                  variant="danger"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    handleOpenDeleteDialog(editingGroup);
                  }}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Hapus
                </M3Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <M3Button variant="text" type="button" onClick={() => setIsEditModalOpen(false)}>
                Batal
              </M3Button>
              <M3Button variant="filled" type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </M3Button>
            </div>
          </div>
        </form>
      </M3Dialog>

      {/* Dialog: Hapus Kelompok */}
      <M3Dialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Hapus Kelompok"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-m3-error-container text-m3-on-error-container text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-m3-error shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Hapus kelompok '{editingGroup?.nama}'?
              </p>
              <p className="mt-1 text-m3-on-error-container/90">
                Tindakan ini permanen dan tidak dapat dibatalkan.
              </p>
            </div>
          </div>

          {editingGroup && editingGroup.count > 0 && (
            <div>
              <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
                Alihkan {editingGroup.count} mata pelajaran yang ada ke:
              </label>
              <select
                value={deleteTargetKelompok}
                onChange={(e) => setDeleteTargetKelompok(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline text-xs sm:text-sm font-semibold bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary cursor-pointer min-h-[44px]"
              >
                {groups
                  .filter((g) => g.kode !== editingGroup?.kode)
                  .map((g) => (
                    <option key={g.kode} value={g.kode}>
                      {g.nama}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2.5">
            <M3Button variant="text" type="button" onClick={() => setIsDeleteDialogOpen(false)}>
              Batal
            </M3Button>
            <M3Button
              variant="danger"
              type="button"
              disabled={isSubmittingDelete}
              onClick={handleDeleteGroup}
            >
              {isSubmittingDelete ? 'Menghapus...' : 'Hapus Kelompok'}
            </M3Button>
          </div>
        </div>
      </M3Dialog>
    </div>
  );
};
