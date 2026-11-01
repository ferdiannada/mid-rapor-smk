import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Search,
  Sparkles,
  HelpCircle,
  Loader2,
  RefreshCw,
  X,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { masterService } from '../services/master.service';
import { Subject, LearningObjective, TeachingAssignment } from '../types';
import { M3Button, M3Card, M3TextField, M3Dialog } from '../components/m3';

export const LearningObjectives: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [tps, setTps] = useState<LearningObjective[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(true);
  const [loadingTps, setLoadingTps] = useState<boolean>(false);
  const [searchSubject, setSearchSubject] = useState<string>('');

  // Status banners
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Form state for Add / Edit TP
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingTp, setEditingTp] = useState<LearningObjective | null>(null);
  const [kodeTp, setKodeTp] = useState<string>('');
  const [deskripsi, setDeskripsi] = useState<string>('');
  const [urutan, setUrutan] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Delete Dialog state
  const [deletingTp, setDeletingTp] = useState<LearningObjective | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const showBanner = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => {
      setStatusBanner(null);
    }, 5000);
  };

  // 1. Fetch available subjects for the current user
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoadingSubjects(true);
        if (isAdmin) {
          const res = await masterService.getSubjects();
          const list = res.subjects || [];
          setSubjects(list);
          initSelectedSubject(list);
        } else {
          const assignRes = await masterService.getMyTeachingAssignments();
          const assignments: TeachingAssignment[] = assignRes.assignments || [];

          // Deduplicate subjects taught by this teacher
          const subjectMap = new Map<string, Subject>();
          assignments.forEach((a) => {
            if (a.subject) {
              subjectMap.set(a.subject.id, a.subject);
            }
          });
          const list = Array.from(subjectMap.values());
          setSubjects(list);
          initSelectedSubject(list);
        }
      } catch (err: any) {
        showBanner('error', err.message || 'Gagal memuat mata pelajaran');
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, [isAdmin]);

  const initSelectedSubject = (list: Subject[]) => {
    const querySubId = searchParams.get('subjectId');
    if (querySubId && list.some((s) => s.id === querySubId)) {
      setSelectedSubjectId(querySubId);
    } else if (list.length > 0) {
      setSelectedSubjectId(list[0].id);
      setSearchParams({ subjectId: list[0].id }, { replace: true });
    }
  };

  // 2. Load TPs when selected subject changes
  const loadTps = useCallback(async (subjectId: string) => {
    if (!subjectId) {
      setTps([]);
      return;
    }
    try {
      setLoadingTps(true);
      const res = await masterService.getLearningObjectives(subjectId);
      setTps(res.learning_objectives || []);
    } catch (err: any) {
      showBanner('error', err.message || 'Gagal memuat Tujuan Pembelajaran');
      setTps([]);
    } finally {
      setLoadingTps(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      loadTps(selectedSubjectId);
    }
  }, [selectedSubjectId, loadTps]);

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSearchParams({ subjectId }, { replace: true });
  };

  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  const filteredSubjects = useMemo(() => {
    if (!searchSubject.trim()) return subjects;
    const q = searchSubject.toLowerCase();
    return subjects.filter((s) => s.nama.toLowerCase().includes(q));
  }, [subjects, searchSubject]);

  // Form Handlers
  const handleOpenAddDialog = () => {
    setEditingTp(null);
    const nextIndex = tps.length + 1;
    setKodeTp(`TP-${nextIndex}.1`);
    setDeskripsi('');
    setUrutan(nextIndex);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (tp: LearningObjective) => {
    setEditingTp(tp);
    setKodeTp(tp.kode_tp);
    setDeskripsi(tp.deskripsi);
    setUrutan(tp.urutan);
    setIsDialogOpen(true);
  };

  const handleSaveTp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !kodeTp.trim() || !deskripsi.trim()) return;

    try {
      setSubmitting(true);
      if (editingTp) {
        await masterService.updateLearningObjective(editingTp.id, {
          kode_tp: kodeTp.trim(),
          deskripsi: deskripsi.trim(),
          urutan: Number(urutan),
        });
        showBanner('success', 'Tujuan Pembelajaran berhasil diperbarui');
      } else {
        await masterService.createLearningObjective(selectedSubjectId, {
          kode_tp: kodeTp.trim(),
          deskripsi: deskripsi.trim(),
          urutan: Number(urutan),
        });
        showBanner('success', 'Tujuan Pembelajaran baru berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      await loadTps(selectedSubjectId);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || err.message || 'Gagal menyimpan Tujuan Pembelajaran');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTp = async () => {
    if (!deletingTp || !selectedSubjectId) return;
    try {
      setIsDeleting(true);
      await masterService.deleteLearningObjective(deletingTp.id);
      showBanner('success', 'Tujuan Pembelajaran berhasil dihapus');
      setDeletingTp(null);
      await loadTps(selectedSubjectId);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || err.message || 'Gagal menghapus Tujuan Pembelajaran');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-full pb-16">
      {/* Header Banner */}
      <div className="rounded-[28px] bg-m3-primary-container text-m3-on-primary-container p-6 sm:p-8 border border-m3-primary/10 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-surface text-m3-primary text-xs font-bold shadow-xs">
              <Target className="w-3.5 h-3.5" />
              <span>Kurikulum Merdeka SMK</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight">
              Tujuan Pembelajaran (CP & TP)
            </h1>
            <p className="text-xs sm:text-sm text-m3-on-primary-container/85 leading-relaxed">
              Rumuskan Tujuan Pembelajaran (TP) mandiri untuk mata pelajaran yang Anda ampu. Setiap guru mengelola TP tersendiri tanpa memengaruhi guru lain, dan menjadi acuan penilaian formatif/sumatif serta deskripsi capaian rapor.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <M3Button
              variant="tonal"
              onClick={() => navigate('/grades/input')}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Lanjut ke Input Nilai
            </M3Button>
          </div>
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

      {/* No Assignment Warning for Teacher */}
      {!loadingSubjects && subjects.length === 0 && (
        <div className="p-6 rounded-3xl bg-amber-50/90 border border-amber-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Belum Ada Mata Pelajaran yang Diampu
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Akun Anda belum terdaftar mengampu mata pelajaran di semester aktif. Silakan hubungi Administrator Kurikulum untuk melakukan penugasan mengajar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Subject Picker & TP Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Subject Selection Card */}
        <div className="lg:col-span-4 space-y-4">
          <M3Card variant="elevated" className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-m3-primary" />
                <h2 className="text-sm font-bold text-m3-on-surface">Pilih Mata Pelajaran</h2>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-m3-surface-container text-m3-on-surface-variant">
                {subjects.length} Mapel
              </span>
            </div>

            {subjects.length > 5 && (
              <M3TextField
                placeholder="Cari mata pelajaran..."
                value={searchSubject}
                onChange={(e) => setSearchSubject(e.target.value)}
                leadingIcon={<Search className="w-4 h-4" />}
              />
            )}

            {loadingSubjects ? (
              <div className="py-8 flex flex-col items-center justify-center text-m3-on-surface-variant gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-m3-primary" />
                <span className="text-xs">Memuat mapel...</span>
              </div>
            ) : filteredSubjects.length === 0 ? (
              <p className="text-xs text-m3-on-surface-variant text-center py-6">
                Tidak ada mata pelajaran ditemukan.
              </p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredSubjects.map((sub) => {
                  const isSelected = sub.id === selectedSubjectId;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSubjectChange(sub.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary/40 shadow-xs'
                          : 'bg-m3-surface text-m3-on-surface border-m3-outline-variant/30 hover:bg-m3-surface-container hover:border-m3-outline-variant'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold leading-snug line-clamp-2">
                          {sub.nama}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                            isSelected
                              ? 'bg-m3-surface text-m3-secondary border-m3-secondary/30'
                              : 'bg-m3-surface-container text-m3-on-surface-variant border-transparent'
                          }`}
                        >
                          Kelompok {sub.kelompok || 'B'}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-75 font-mono truncate">
                        ID: {sub.id}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </M3Card>

          {/* Kurikulum Merdeka Writing Guidance Box */}
          <M3Card variant="filled" className="p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-m3-primary">
              <Sparkles className="w-4 h-4 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Tips Penulisan TP</h3>
            </div>
            <p className="text-xs text-m3-on-surface-variant leading-relaxed">
              Tulis deskripsi diawali huruf kecil dengan kata kerja operasional (misal: <em>memahami konsep OOP dan modularitas</em>).
            </p>
            <p className="text-xs text-m3-on-surface-variant leading-relaxed">
              Sistem akan merangkainya ke dalam narasi rapor secara otomatis:
              <br />
              <span className="font-semibold text-m3-on-surface">
                &ldquo;Menunjukkan penguasaan yang sangat baik dalam [Deskripsi TP]...&rdquo;
              </span>
            </p>
          </M3Card>
        </div>

        {/* Right Column: Learning Objectives List & Action */}
        <div className="lg:col-span-8 space-y-4">
          {selectedSubject ? (
            <>
              {/* Active Subject Bar */}
              <M3Card variant="elevated" className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-m3-primary-container text-m3-primary border border-m3-primary/20">
                      Kelompok {selectedSubject.kelompok || 'B'}
                    </span>
                    <span className="text-[10px] text-m3-on-surface-variant font-mono">
                      {tps.length} TP Terdaftar
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-m3-on-surface">
                    {selectedSubject.nama}
                  </h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <M3Button
                    variant="filled"
                    size="sm"
                    onClick={handleOpenAddDialog}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Tambah TP Baru
                  </M3Button>

                  <Link to={`/grades/input?subjectId=${selectedSubject.id}`}>
                    <M3Button
                      variant="tonal"
                      size="sm"
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Buka Input Nilai
                    </M3Button>
                  </Link>
                </div>
              </M3Card>

              {/* TP Table / List */}
              <M3Card variant="elevated" className="overflow-hidden p-0">
                <div className="p-4 bg-m3-surface-container/60 border-b border-m3-outline-variant/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-m3-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface">
                      Daftar Tujuan Pembelajaran
                    </h3>
                  </div>
                  <M3Button
                    variant="text"
                    size="sm"
                    onClick={() => loadTps(selectedSubject.id)}
                    disabled={loadingTps}
                    icon={<RefreshCw className={`w-3.5 h-3.5 ${loadingTps ? 'animate-spin' : ''}`} />}
                  >
                    Segarkan
                  </M3Button>
                </div>

                {loadingTps ? (
                  <div className="py-16 flex flex-col items-center justify-center text-m3-on-surface-variant gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-m3-primary" />
                    <p className="text-xs font-semibold">Memuat data Tujuan Pembelajaran...</p>
                  </div>
                ) : tps.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-m3-on-surface">
                        Belum Ada Tujuan Pembelajaran
                      </h4>
                      <p className="text-xs text-m3-on-surface-variant mt-1 max-w-md mx-auto">
                        Mata pelajaran ini belum memiliki Tujuan Pembelajaran (TP). Tambahkan TP sekarang agar kolom penilaian nilai formatif & sumatif aktif pada menu Input Nilai.
                      </p>
                    </div>
                    <div className="pt-2">
                      <M3Button
                        variant="filled"
                        size="sm"
                        onClick={handleOpenAddDialog}
                        icon={<Plus className="w-4 h-4" />}
                      >
                        Tambah TP Pertama
                      </M3Button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-m3-outline-variant/20">
                    {tps.map((tp, idx) => (
                      <div
                        key={tp.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-m3-surface-container/30 transition-colors group"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-m3-primary-container text-m3-primary border border-m3-primary/20">
                              {tp.kode_tp}
                            </span>
                            <span className="text-[11px] text-m3-on-surface-variant font-medium">
                              Urutan #{tp.urutan || idx + 1}
                            </span>
                            {isAdmin && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-m3-surface-container-high text-m3-on-surface-variant font-medium">
                                {tp.guru?.name ? `Pengampu: ${tp.guru.name}` : 'Bawaan Kurikulum / Global'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-m3-on-surface leading-relaxed">
                            {tp.deskripsi}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDialog(tp)}
                            className="p-2 rounded-full text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-primary/8 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                            title="Edit Tujuan Pembelajaran"
                            aria-label={`Edit ${tp.kode_tp}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTp(tp)}
                            className="p-2 rounded-full text-m3-on-surface-variant hover:text-m3-error hover:bg-m3-error-container/30 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                            title="Hapus Tujuan Pembelajaran"
                            aria-label={`Hapus ${tp.kode_tp}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </M3Card>
            </>
          ) : (
            <M3Card variant="outlined" className="p-12 text-center text-m3-on-surface-variant">
              <BookOpen className="w-10 h-10 mx-auto text-m3-outline mb-2" />
              <p className="text-sm font-semibold text-m3-on-surface">Pilih Mata Pelajaran</p>
              <p className="text-xs text-m3-on-surface-variant mt-1">
                Silakan pilih mata pelajaran di sebelah kiri untuk melihat dan mengelola Tujuan Pembelajarannya.
              </p>
            </M3Card>
          )}
        </div>
      </div>

      {/* Add / Edit TP Dialog */}
      <M3Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingTp ? 'Edit Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran Baru'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveTp} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-m3-secondary-container/40 border border-m3-secondary/20 text-xs text-m3-on-secondary-container flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-m3-secondary shrink-0 mt-0.5" />
            <p>
              Mata pelajaran: <strong>{selectedSubject?.nama}</strong>. Kode TP harus unik dalam satu mata pelajaran.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <M3TextField
              label="Kode TP"
              required
              value={kodeTp}
              onChange={(e) => setKodeTp(e.target.value)}
              placeholder="Contoh: TP-1.1 atau 1.1"
            />

            <M3TextField
              label="Urutan Tampil"
              type="number"
              required
              value={String(urutan)}
              onChange={(e) => setUrutan(Number(e.target.value))}
              placeholder="1"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Deskripsi Capaian / Materi TP
            </label>
            <textarea
              required
              rows={3}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Contoh: memahami konsep dasar pemrograman berorientasi objek (OOP) dan penerapannya dalam aplikasi web..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline text-m3-on-surface text-xs sm:text-sm focus:outline-none focus:border-m3-primary min-h-[96px]"
            />
            <p className="text-[11px] text-m3-on-surface-variant mt-1">
              Gunakan kata kerja aktif huruf kecil agar selaras saat digenerate ke dalam deskripsi narasi rapor.
            </p>
          </div>

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2">
            <M3Button variant="text" type="button" onClick={() => setIsDialogOpen(false)}>
              Batal
            </M3Button>
            <M3Button variant="filled" type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : editingTp ? 'Perbarui TP' : 'Tambahkan TP'}
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* Delete Confirmation Dialog */}
      <M3Dialog
        isOpen={!!deletingTp}
        onClose={() => setDeletingTp(null)}
        title="Hapus Tujuan Pembelajaran"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-m3-on-surface leading-relaxed">
            Apakah Anda yakin ingin menghapus Tujuan Pembelajaran <strong>{deletingTp?.kode_tp}</strong>?
          </p>
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              Penghapusan TP akan menghapus rincian nilai siswa yang terhubung dengan TP ini. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2">
            <M3Button variant="text" type="button" onClick={() => setDeletingTp(null)}>
              Batal
            </M3Button>
            <M3Button
              variant="danger"
              type="button"
              onClick={handleDeleteTp}
              disabled={isDeleting}
            >
              {isDeleting ? 'Menghapus...' : 'Ya, Hapus TP'}
            </M3Button>
          </div>
        </div>
      </M3Dialog>
    </div>
  );
};
