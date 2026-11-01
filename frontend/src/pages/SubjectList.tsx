import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Database,
  Layers,
  Loader2,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Search,
  RefreshCw,
  X,
  Info,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { masterService } from '../services/master.service';
import { Subject, LearningObjective } from '../types';
import { M3Button, M3Card, M3Chip, M3TextField, M3Dialog } from '../components/m3';

export const SubjectList: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [kelompokFilter, setKelompokFilter] = useState('all');

  // Status banner
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Subject CRUD Dialog States
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isEditSubjectOpen, setIsEditSubjectOpen] = useState(false);
  const [isDeleteSubjectOpen, setIsDeleteSubjectOpen] = useState(false);
  const [targetSubject, setTargetSubject] = useState<Subject | null>(null);
  const [formSubjectNama, setFormSubjectNama] = useState('');
  const [formSubjectKelompok, setFormSubjectKelompok] = useState('B');
  const [isSubmittingSubject, setIsSubmittingSubject] = useState(false);

  // TP Dialog state
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [tps, setTps] = useState<LearningObjective[]>([]);
  const [isLoadingTps, setIsLoadingTps] = useState(false);

  // Add/Edit TP form state
  const [kodeTp, setKodeTp] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [urutan, setUrutan] = useState(1);
  const [editingTpId, setEditingTpId] = useState<string | null>(null);
  const [isSubmittingTp, setIsSubmittingTp] = useState(false);
  const [tpMessage, setTpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete TP Dialog state
  const [tpToDelete, setTpToDelete] = useState<LearningObjective | null>(null);
  const [isDeletingTp, setIsDeletingTp] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    setIsLoading(true);
    try {
      const res = await masterService.getSubjects();
      setSubjects(res.subjects || []);
    } catch (err: any) {
      console.error(err);
      setStatusBanner({
        type: 'error',
        message: err.message || 'Gagal memuat daftar mata pelajaran',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const showBanner = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => {
      setStatusBanner(null);
    }, 6000);
  };

  // -------------------------------------------------------------
  // Subject CRUD Handlers
  // -------------------------------------------------------------

  const handleOpenAddSubject = () => {
    setFormSubjectNama('');
    setFormSubjectKelompok('B');
    setIsAddSubjectOpen(true);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubjectNama.trim()) return;

    setIsSubmittingSubject(true);
    try {
      const res = await masterService.createSubject({
        nama: formSubjectNama.trim(),
        kelompok: formSubjectKelompok,
      });

      setIsAddSubjectOpen(false);
      showBanner('success', res.message || 'Mata pelajaran berhasil ditambahkan secara manual');
      await loadSubjects();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal menambahkan mata pelajaran');
    } finally {
      setIsSubmittingSubject(false);
    }
  };

  const handleOpenEditSubject = (subject: Subject) => {
    setTargetSubject(subject);
    setFormSubjectNama(subject.nama);
    setFormSubjectKelompok(subject.kelompok || 'B');
    setIsEditSubjectOpen(true);
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSubject || !formSubjectNama.trim()) return;

    setIsSubmittingSubject(true);
    try {
      const res = await masterService.updateSubject(targetSubject.id, {
        nama: formSubjectNama.trim(),
        kelompok: formSubjectKelompok,
      });

      setIsEditSubjectOpen(false);
      showBanner('success', res.message || 'Mata pelajaran berhasil diperbarui');
      await loadSubjects();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal memperbarui mata pelajaran');
    } finally {
      setIsSubmittingSubject(false);
    }
  };

  const handleOpenDeleteSubject = (subject: Subject) => {
    setTargetSubject(subject);
    setIsDeleteSubjectOpen(true);
  };

  const handleDeleteSubject = async () => {
    if (!targetSubject) return;

    setIsSubmittingSubject(true);
    try {
      const res = await masterService.deleteSubject(targetSubject.id);
      setIsDeleteSubjectOpen(false);
      showBanner('success', res.message || 'Mata pelajaran berhasil dihapus');
      await loadSubjects();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal menghapus mata pelajaran');
    } finally {
      setIsSubmittingSubject(false);
    }
  };

  // -------------------------------------------------------------
  // TP (Learning Objectives) Handlers
  // -------------------------------------------------------------

  const handleOpenTPModal = async (subject: Subject) => {
    setSelectedSubject(subject);
    setEditingTpId(null);
    setKodeTp(`TP-${(subject.learning_objective_count || 0) + 1}.1`);
    setDeskripsi('');
    setUrutan((subject.learning_objective_count || 0) + 1);
    setTpMessage(null);

    setIsLoadingTps(true);
    try {
      const res = await masterService.getLearningObjectives(subject.id);
      setTps(res.learning_objectives || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingTps(false);
    }
  };

  const handleSaveTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;

    setIsSubmittingTp(true);
    setTpMessage(null);
    try {
      if (editingTpId) {
        await masterService.updateLearningObjective(editingTpId, {
          kode_tp: kodeTp.trim(),
          deskripsi: deskripsi.trim(),
          urutan: Number(urutan),
        });
        setTpMessage({ type: 'success', text: 'Tujuan Pembelajaran berhasil diperbarui' });
      } else {
        await masterService.createLearningObjective(selectedSubject.id, {
          kode_tp: kodeTp.trim(),
          deskripsi: deskripsi.trim(),
          urutan: Number(urutan),
        });
        setTpMessage({ type: 'success', text: 'Tujuan Pembelajaran baru berhasil ditambahkan' });
      }

      // Reset form
      setEditingTpId(null);
      setDeskripsi('');
      setKodeTp(`TP-${tps.length + 2}.1`);
      setUrutan(tps.length + 2);

      // Refresh list
      const res = await masterService.getLearningObjectives(selectedSubject.id);
      setTps(res.learning_objectives || []);
      await loadSubjects();
    } catch (err: any) {
      setTpMessage({ type: 'error', text: err.message || 'Gagal menyimpan Tujuan Pembelajaran' });
    } finally {
      setIsSubmittingTp(false);
    }
  };

  const handleConfirmDeleteTP = async () => {
    if (!tpToDelete || !selectedSubject) return;

    setIsDeletingTp(true);
    try {
      await masterService.deleteLearningObjective(tpToDelete.id);
      const res = await masterService.getLearningObjectives(selectedSubject.id);
      setTps(res.learning_objectives || []);
      setTpToDelete(null);
      await loadSubjects();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus TP');
    } finally {
      setIsDeletingTp(false);
    }
  };

  const handleEditTP = (tp: LearningObjective) => {
    setEditingTpId(tp.id);
    setKodeTp(tp.kode_tp);
    setDeskripsi(tp.deskripsi);
    setUrutan(tp.urutan);
  };

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchName = !q || s.nama.toLowerCase().includes(q);
      const matchKelompok = kelompokFilter === 'all' || s.kelompok === kelompokFilter;
      return matchName && matchKelompok;
    });
  }, [subjects, searchQuery, kelompokFilter]);

  const kelompokOptions = [
    { value: 'all', label: 'Semua Kelompok' },
    { value: 'A', label: 'Kelompok A (Umum)' },
    { value: 'B', label: 'Kelompok B (Kejuruan)' },
    { value: 'C', label: 'Kelompok C (Konsentrasi)' },
    { value: 'Muatan Lokal', label: 'Muatan Lokal' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner - M3 Primary Tonal Container */}
      <div className="rounded-[28px] bg-m3-primary-container text-m3-on-primary-container p-6 sm:p-8 border border-m3-primary/10 shadow-xs">
        <div className="space-y-2.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-surface text-m3-primary text-xs font-bold shadow-xs">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Kurikulum Merdeka SMK</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight">
            Mata Pelajaran & Tujuan Pembelajaran (TP)
          </h1>
          <p className="text-xs sm:text-sm text-m3-on-primary-container/85 leading-relaxed">
            Kelola daftar mata pelajaran (sinkron Dapodik maupun manual lokal) serta Tujuan Pembelajaran yang menjadi indikator capaian nilai rapor siswa.
          </p>
        </div>
      </div>

      {/* Status Banner */}
      {statusBanner && (
        <div
          role="status"
          className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold transition-all ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-m3-error-container text-m3-on-error-container border border-m3-error/20'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-m3-error shrink-0" />
            )}
            <span className="truncate">{statusBanner.message}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="p-1 rounded-full hover:bg-black/5 text-m3-on-surface-variant cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 ml-2"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Bar & Quick Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-m3-primary" />
          <h2 className="text-sm font-bold text-m3-on-surface">Mata Pelajaran Terdaftar</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-m3-surface-container font-semibold text-m3-on-surface-variant">
            {subjects.length} Mapel
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/learning-objectives">
            <M3Button variant="tonal" size="sm" icon={<Target className="w-3.5 h-3.5" />}>
              Tujuan Pembelajaran (TP)
            </M3Button>
          </Link>

          <Link to="/settings/subject-groups">
            <M3Button variant="tonal" size="sm" icon={<Layers className="w-3.5 h-3.5" />}>
              Kelola Kelompok Mapel
            </M3Button>
          </Link>

          <Link to="/settings/teachers">
            <M3Button variant="tonal" size="sm" icon={<GraduationCap className="w-3.5 h-3.5" />}>
              Kelola Penugasan Guru
            </M3Button>
          </Link>

          <M3Button
            variant="filled"
            size="sm"
            onClick={handleOpenAddSubject}
            icon={<Plus className="w-4 h-4" />}
          >
            Tambah Mapel Manual
          </M3Button>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <M3Card variant="filled" className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <M3TextField
              placeholder="Cari mata pelajaran..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leadingIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <M3Button
              variant="outlined"
              size="sm"
              onClick={loadSubjects}
              disabled={isLoading}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Segarkan
            </M3Button>
          </div>
        </div>

        {/* M3 Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {kelompokOptions.map((opt) => (
            <M3Chip
              key={opt.value}
              selected={kelompokFilter === opt.value}
              onClick={() => setKelompokFilter(opt.value)}
            >
              {opt.label}
            </M3Chip>
          ))}
        </div>
      </M3Card>

      {/* Subjects Content Grid */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center text-m3-on-surface-variant gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-m3-primary" />
          <p className="text-xs font-semibold">Memuat daftar mata pelajaran...</p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <M3Card variant="outlined" className="p-12 text-center text-m3-on-surface-variant">
          <BookOpen className="w-10 h-10 mx-auto text-m3-outline mb-2" />
          <p className="text-sm font-semibold text-m3-on-surface">Tidak ada mata pelajaran yang ditemukan</p>
          <p className="text-xs text-m3-on-surface-variant mt-1">Coba sesuaikan kata kunci pencarian atau tambah mapel manual</p>
        </M3Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSubjects.map((sub) => (
            <M3Card
              key={sub.id}
              variant="elevated"
              className="p-5 flex flex-col justify-between group hover:border-m3-primary/40 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      sub.kelompok === 'A'
                        ? 'bg-blue-50 text-blue-900 border-blue-200'
                        : sub.kelompok === 'Muatan Lokal'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-purple-50 text-purple-900 border-purple-200'
                    }`}
                  >
                    Kelompok {sub.kelompok || 'B'} (
                    {sub.kelompok === 'A'
                      ? 'Muatan Umum'
                      : sub.kelompok === 'Muatan Lokal'
                      ? 'Muatan Lokal'
                      : 'Kejuruan / Produktif'}
                    )
                  </span>

                  <span className="text-[11px] font-bold text-m3-primary bg-m3-primary-container px-2.5 py-0.5 rounded-full shrink-0">
                    {sub.learning_objective_count || 0} TP Terdaftar
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-m3-on-surface group-hover:text-m3-primary transition-colors">
                    {sub.nama}
                  </h3>
                  <p className="text-[11px] font-mono text-m3-on-surface-variant mt-1 break-all">
                    {sub.dapodik_mapel_id
                      ? `ID Mapel Dapodik: ${sub.dapodik_mapel_id}`
                      : `ID Mapel: ${sub.id}`}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-m3-outline-variant/30 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  {sub.is_manual_override ? (
                    <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-700" /> Manual
                    </span>
                  ) : (
                    <span className="text-[10px] text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Database className="w-3 h-3 text-blue-700" /> Dapodik
                    </span>
                  )}

                  {/* Edit button */}
                  <button
                    onClick={() => handleOpenEditSubject(sub)}
                    className="p-2 rounded-full text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-primary/8 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Edit Nama / Kelompok Mapel"
                    aria-label="Edit mapel"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleOpenDeleteSubject(sub)}
                    className="p-2 rounded-full text-m3-on-surface-variant hover:text-m3-error hover:bg-m3-error-container/30 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Hapus Mapel"
                    aria-label="Hapus mapel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <M3Button
                  variant="tonal"
                  size="sm"
                  onClick={() => handleOpenTPModal(sub)}
                  icon={<BookOpen className="w-3.5 h-3.5" />}
                >
                  Kelola TP
                </M3Button>
              </div>
            </M3Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOGS */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Dialog Tambah Mapel Manual */}
      <M3Dialog
        isOpen={isAddSubjectOpen}
        onClose={() => setIsAddSubjectOpen(false)}
        title="Tambah Mata Pelajaran Manual"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-m3-secondary-container/40 border border-m3-secondary/20 text-xs text-m3-on-secondary-container flex items-start gap-2">
            <Info className="w-4 h-4 text-m3-secondary shrink-0 mt-0.5" />
            <p>
              Mata pelajaran yang ditambahkan manual dapat digunakan untuk Muatan Lokal, Bahasa Daerah, atau Konsentrasi Keahlian baru.
              Data ini terlindungi dari penimpaan sinkronisasi Dapodik.
            </p>
          </div>

          <M3TextField
            label="Nama Mata Pelajaran"
            required
            value={formSubjectNama}
            onChange={(e) => setFormSubjectNama(e.target.value)}
            placeholder="Contoh: Bahasa Sunda (Mulok) atau Pemrograman Web"
          />

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Kelompok Mata Pelajaran
            </label>
            <select
              value={formSubjectKelompok}
              onChange={(e) => setFormSubjectKelompok(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface text-xs sm:text-sm font-semibold focus:outline-none focus:border-m3-primary min-h-[44px]"
            >
              <option value="A">Kelompok A (Muatan Umum)</option>
              <option value="B">Kelompok B (Kejuruan / Produktif)</option>
              <option value="C">Kelompok C (Konsentrasi Keahlian)</option>
              <option value="Muatan Lokal">Muatan Lokal (Mulok)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2">
            <M3Button variant="text" type="button" onClick={() => setIsAddSubjectOpen(false)}>
              Batal
            </M3Button>
            <M3Button variant="filled" type="submit" disabled={isSubmittingSubject}>
              {isSubmittingSubject ? 'Menyimpan...' : 'Simpan Mapel'}
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* 2. Dialog Edit Mapel */}
      <M3Dialog
        isOpen={isEditSubjectOpen}
        onClose={() => setIsEditSubjectOpen(false)}
        title="Edit Mata Pelajaran"
      >
        <form onSubmit={handleUpdateSubject} className="space-y-4">
          <M3TextField
            label="Nama Mata Pelajaran"
            required
            value={formSubjectNama}
            onChange={(e) => setFormSubjectNama(e.target.value)}
          />

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Kelompok Mata Pelajaran
            </label>
            <select
              value={formSubjectKelompok}
              onChange={(e) => setFormSubjectKelompok(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface text-xs sm:text-sm font-semibold focus:outline-none focus:border-m3-primary min-h-[44px]"
            >
              <option value="A">Kelompok A (Muatan Umum)</option>
              <option value="B">Kelompok B (Kejuruan / Produktif)</option>
              <option value="C">Kelompok C (Konsentrasi Keahlian)</option>
              <option value="Muatan Lokal">Muatan Lokal (Mulok)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2">
            <M3Button variant="text" type="button" onClick={() => setIsEditSubjectOpen(false)}>
              Batal
            </M3Button>
            <M3Button variant="filled" type="submit" disabled={isSubmittingSubject}>
              {isSubmittingSubject ? 'Menyimpan...' : 'Perbarui Mapel'}
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* 3. Dialog Hapus Mapel */}
      <M3Dialog
        isOpen={isDeleteSubjectOpen}
        onClose={() => setIsDeleteSubjectOpen(false)}
        title="Hapus Mata Pelajaran"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-m3-on-surface leading-relaxed">
            Apakah Anda yakin ingin menghapus mata pelajaran <strong>{targetSubject?.nama}</strong>?
          </p>

          <div className="p-3.5 rounded-2xl bg-m3-error-container/40 border border-m3-error/20 text-xs text-m3-on-error-container space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-m3-error" /> Proteksi Keutuhan Rapor:
            </p>
            <p>
              Jika mata pelajaran ini sudah memiliki riwayat nilai rapor yang diinputkan oleh guru, sistem akan menolak
              penghapusan demi mencegah kerusakan riwayat rapor siswa.
            </p>
          </div>

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2">
            <M3Button variant="text" type="button" onClick={() => setIsDeleteSubjectOpen(false)}>
              Batal
            </M3Button>
            <M3Button
              variant="danger"
              type="button"
              onClick={handleDeleteSubject}
              disabled={isSubmittingSubject}
            >
              {isSubmittingSubject ? 'Menghapus...' : 'Ya, Hapus Mapel'}
            </M3Button>
          </div>
        </div>
      </M3Dialog>

      {/* 4. Dialog TP (Learning Objectives) */}
      <M3Dialog
        isOpen={!!selectedSubject}
        onClose={() => setSelectedSubject(null)}
        title={`Tujuan Pembelajaran: ${selectedSubject?.nama || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          {/* Add / Edit TP Form */}
          <form onSubmit={handleSaveTP} className="p-4 rounded-2xl bg-m3-surface-container space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
                {editingTpId ? 'Edit Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran Baru'}
              </span>
              {editingTpId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTpId(null);
                    setKodeTp(`TP-${tps.length + 1}.1`);
                    setDeskripsi('');
                  }}
                  className="text-xs text-m3-primary hover:underline cursor-pointer"
                >
                  Batal Edit
                </button>
              )}
            </div>

            {tpMessage && (
              <div
                className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
                  tpMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-m3-error-container text-m3-on-error-container border border-m3-error/20'
                }`}
              >
                {tpMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-m3-error" />
                )}
                <span>{tpMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <M3TextField
                  label="Kode TP"
                  required
                  value={kodeTp}
                  onChange={(e) => setKodeTp(e.target.value)}
                  placeholder="TP-1.1"
                />
              </div>

              <div>
                <M3TextField
                  label="Urutan"
                  type="number"
                  required
                  value={String(urutan)}
                  onChange={(e) => setUrutan(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
                Deskripsi Capaian / Materi Pembelajaran
              </label>
              <textarea
                required
                rows={2}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Contoh: Memahami konsep dasar pemrograman berorientasi objek (OOP) dan penerapannya dalam aplikasi web..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline text-m3-on-surface text-xs sm:text-sm focus:outline-none focus:border-m3-primary"
              />
            </div>

            <div className="flex justify-end pt-1">
              <M3Button variant="filled" size="sm" type="submit" disabled={isSubmittingTp}>
                {isSubmittingTp ? 'Menyimpan...' : editingTpId ? 'Simpan Perubahan' : 'Tambahkan TP'}
              </M3Button>
            </div>
          </form>

          {/* TP List Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant">
              Daftar TP Terdaftar ({tps.length})
            </h4>

            {isLoadingTps ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-m3-primary" />
              </div>
            ) : tps.length === 0 ? (
              <div className="py-8 text-center text-xs text-m3-on-surface-variant border border-dashed border-m3-outline-variant/60 rounded-2xl">
                Belum ada Tujuan Pembelajaran untuk mata pelajaran ini.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {tps.map((tp) => (
                  <div
                    key={tp.id}
                    className="p-3.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-m3-primary px-2 py-0.5 rounded bg-m3-primary-container text-[10px]">
                          {tp.kode_tp}
                        </span>
                        <span className="text-[10px] text-m3-on-surface-variant">Urutan: #{tp.urutan}</span>
                      </div>
                      <p className="text-m3-on-surface leading-relaxed">{tp.deskripsi}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEditTP(tp)}
                        className="p-2 rounded-full text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-primary/8 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                        title="Edit TP"
                        aria-label="Edit TP"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTpToDelete(tp)}
                        className="p-2 rounded-full text-m3-on-surface-variant hover:text-m3-error hover:bg-m3-error-container/30 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                        title="Hapus TP"
                        aria-label="Hapus TP"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </M3Dialog>

      {/* 5. Dialog Konfirmasi Hapus TP */}
      <M3Dialog
        isOpen={!!tpToDelete}
        onClose={() => setTpToDelete(null)}
        title="Hapus Tujuan Pembelajaran"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-m3-on-surface leading-relaxed">
            Apakah Anda yakin ingin menghapus Tujuan Pembelajaran <strong>{tpToDelete?.kode_tp}</strong>?
          </p>
          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2">
            <M3Button variant="text" type="button" onClick={() => setTpToDelete(null)}>
              Batal
            </M3Button>
            <M3Button
              variant="danger"
              type="button"
              onClick={handleConfirmDeleteTP}
              disabled={isDeletingTp}
            >
              {isDeletingTp ? 'Menghapus...' : 'Ya, Hapus TP'}
            </M3Button>
          </div>
        </div>
      </M3Dialog>
    </div>
  );
};
