import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CalendarCheck,
  MessageSquare,
  Trophy,
  Save,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Wifi,
  WifiOff,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { masterService } from '../services/master.service';
import { gradeService } from '../services/grade.service';
import { useOfflineSync } from '../hooks/useOfflineSync';
import {
  saveDraft,
  getDraft,
  deleteDraft,
  enqueueOutbox,
  outboxWorker,
} from '../services/offline';
import {
  Rombel,
  AttendanceItem,
  ExtracurricularItem,
  WaliNoteItem,
} from '../types';
import { SearchableRombelSelect } from '../components/common/SearchableRombelSelect';
import { M3Button, M3Card, M3TextField, M3Dialog } from '../components/m3';

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const isWaliKelas = !!user?.wali_kelas_rombel;

  // Offline sync hook
  const { isOnline, unsyncedCount, isSyncing, triggerSync } = useOfflineSync();

  // Active Tab: 'attendance' | 'notes' | 'extracurricular'
  const [activeTab, setActiveTab] = useState<'attendance' | 'notes' | 'extracurricular'>('attendance');

  // Rombel selection
  const [rombels, setRombels] = useState<Rombel[]>([]);
  const [selectedRombelId, setSelectedRombelId] = useState<string>('');

  // Status & Alerts
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tab 1: Attendance state & offline drafts
  const [attendances, setAttendances] = useState<AttendanceItem[]>([]);
  const [hasUnsavedAttendanceDraft, setHasUnsavedAttendanceDraft] = useState<boolean>(false);
  const [lastAttendanceDraftSavedAt, setLastAttendanceDraftSavedAt] = useState<Date | null>(null);
  const [attendanceDraftFound, setAttendanceDraftFound] = useState<{
    attendances: AttendanceItem[];
    savedAt: number;
  } | null>(null);
  const isEditingAttendanceRef = useRef<boolean>(false);

  // Tab 2: Wali notes state & offline drafts
  const [notes, setNotes] = useState<WaliNoteItem[]>([]);
  const [hasUnsavedNotesDraft, setHasUnsavedNotesDraft] = useState<boolean>(false);
  const [lastNotesDraftSavedAt, setLastNotesDraftSavedAt] = useState<Date | null>(null);
  const [notesDraftFound, setNotesDraftFound] = useState<{
    notes: WaliNoteItem[];
    savedAt: number;
  } | null>(null);
  const isEditingNotesRef = useRef<boolean>(false);

  // Tab 3: Extracurricular state
  const [extracurriculars, setExtracurriculars] = useState<ExtracurricularItem[]>([]);
  const [showAddEkskulModal, setShowAddEkskulModal] = useState<boolean>(false);
  const [ekskulToDelete, setEkskulToDelete] = useState<ExtracurricularItem | null>(null);
  const [newEkskul, setNewEkskul] = useState({
    student_id: '',
    nama_ekskul: '',
    predikat: 'Sangat Baik',
    keterangan: '',
  });

  // Debounced auto-save presensi ke IndexedDB (500ms)
  useEffect(() => {
    if (!isEditingAttendanceRef.current || !selectedRombelId || attendances.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      const draftKey = `attendance:${selectedRombelId}:all`;
      await saveDraft(
        draftKey,
        'attendance',
        {
          attendances,
          savedAt: Date.now(),
        },
        {
          rombelId: selectedRombelId,
          teacherId: user?.id,
        }
      );
      setLastAttendanceDraftSavedAt(new Date());
      setHasUnsavedAttendanceDraft(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [attendances, selectedRombelId, user?.id]);

  // Debounced auto-save catatan wali ke IndexedDB (500ms)
  useEffect(() => {
    if (!isEditingNotesRef.current || !selectedRombelId || notes.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      const draftKey = `notes:${selectedRombelId}:all`;
      await saveDraft(
        draftKey,
        'notes',
        {
          notes,
          savedAt: Date.now(),
        },
        {
          rombelId: selectedRombelId,
          teacherId: user?.id,
        }
      );
      setLastNotesDraftSavedAt(new Date());
      setHasUnsavedNotesDraft(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [notes, selectedRombelId, user?.id]);

  // Fetch rombels on mount with offline cache fallback
  useEffect(() => {
    const fetchRombels = async () => {
      try {
        setLoading(true);
        let list: Rombel[] = [];
        try {
          const res = await masterService.getRombels();
          list = (res.rombels || []).filter((r: Rombel) => (r.student_count || 0) > 0);
          saveDraft('cache:rombels', 'attendance', list);
        } catch (fetchErr) {
          const cached = await getDraft<Rombel[]>('cache:rombels');
          if (cached && cached.length > 0) {
            list = cached;
          } else {
            throw fetchErr;
          }
        }

        setRombels(list);

        if (isWaliKelas && user?.wali_kelas_rombel?.id) {
          setSelectedRombelId(user.wali_kelas_rombel.id);
        } else if (list.length > 0) {
          setSelectedRombelId(list[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Gagal memuat rombongan belajar');
      } finally {
        setLoading(false);
      }
    };

    fetchRombels();
  }, [isWaliKelas, user]);

  // Fetch data depending on active tab & selected rombel with offline draft detection
  const fetchTabData = useCallback(async () => {
    if (!selectedRombelId) return;

    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'attendance') {
        const draftKey = `attendance:${selectedRombelId}:all`;
        isEditingAttendanceRef.current = false;
        const localDraft = await getDraft<{
          attendances: AttendanceItem[];
          savedAt: number;
        }>(draftKey);

        try {
          const res = await gradeService.getAttendance(selectedRombelId);
          setAttendances(res.attendances || []);

          if (localDraft && localDraft.attendances && localDraft.attendances.length > 0) {
            setAttendanceDraftFound(localDraft);
          } else {
            setAttendanceDraftFound(null);
          }
          setHasUnsavedAttendanceDraft(false);
        } catch (fetchErr: any) {
          if (localDraft && localDraft.attendances && localDraft.attendances.length > 0) {
            setAttendances(localDraft.attendances);
            setHasUnsavedAttendanceDraft(true);
            setLastAttendanceDraftSavedAt(new Date(localDraft.savedAt));
            setAttendanceDraftFound(null);
            setSuccessMessage(
              `Mode Offline: Menampilkan draf presensi lokal komputer Anda (tersimpan ${new Date(localDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`
            );
            return;
          }
          throw fetchErr;
        }
      } else if (activeTab === 'notes') {
        const draftKey = `notes:${selectedRombelId}:all`;
        isEditingNotesRef.current = false;
        const localDraft = await getDraft<{
          notes: WaliNoteItem[];
          savedAt: number;
        }>(draftKey);

        try {
          const res = await gradeService.getWaliNotes(selectedRombelId);
          setNotes(res.notes || []);

          if (localDraft && localDraft.notes && localDraft.notes.length > 0) {
            setNotesDraftFound(localDraft);
          } else {
            setNotesDraftFound(null);
          }
          setHasUnsavedNotesDraft(false);
        } catch (fetchErr: any) {
          if (localDraft && localDraft.notes && localDraft.notes.length > 0) {
            setNotes(localDraft.notes);
            setHasUnsavedNotesDraft(true);
            setLastNotesDraftSavedAt(new Date(localDraft.savedAt));
            setNotesDraftFound(null);
            setSuccessMessage(
              `Mode Offline: Menampilkan draf catatan wali kelas lokal komputer Anda (tersimpan ${new Date(localDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`
            );
            return;
          }
          throw fetchErr;
        }
      } else if (activeTab === 'extracurricular') {
        const res = await gradeService.getExtracurriculars(selectedRombelId);
        setExtracurriculars(res.extracurriculars || []);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [selectedRombelId, activeTab]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  // Attendance handlers
  const handleAttendanceChange = (studentId: string, field: 'sakit' | 'izin' | 'tanpa_keterangan', valStr: string) => {
    isEditingAttendanceRef.current = true;
    let val = parseInt(valStr, 10);
    if (isNaN(val) || val < 0) val = 0;

    setAttendances((prev) =>
      prev.map((item) => {
        if (item.student_id !== studentId) return item;
        const updated = { ...item, [field]: val };
        updated.total = updated.sakit + updated.izin + updated.tanpa_keterangan;
        return updated;
      })
    );
  };

  const handleIncrementAttendance = (studentId: string, field: 'sakit' | 'izin' | 'tanpa_keterangan') => {
    isEditingAttendanceRef.current = true;
    setAttendances((prev) =>
      prev.map((item) => {
        if (item.student_id !== studentId) return item;
        const updated = { ...item, [field]: item[field] + 1 };
        updated.total = updated.sakit + updated.izin + updated.tanpa_keterangan;
        return updated;
      })
    );
  };

  const handleSaveAttendance = async () => {
    if (!selectedRombelId || attendances.length === 0) return;

    const draftKey = `attendance:${selectedRombelId}:all`;
    const payload = {
      rombel_id: selectedRombelId,
      attendances: attendances.map((a) => ({
        student_id: a.student_id,
        sakit: a.sakit,
        izin: a.izin,
        tanpa_keterangan: a.tanpa_keterangan,
      })),
    };

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      if (!isOnline) {
        // Mode Offline: Simpan langsung ke Outbox
        await enqueueOutbox({
          action: 'SAVE_ATTENDANCE',
          endpoint: '/attendance/batch',
          method: 'POST',
          payload,
        });

        await saveDraft(
          draftKey,
          'attendance',
          {
            attendances,
            savedAt: Date.now(),
          },
          {
            rombelId: selectedRombelId,
            teacherId: user?.id,
          }
        );

        setHasUnsavedAttendanceDraft(false);
        setAttendanceDraftFound(null);
        isEditingAttendanceRef.current = false;
        setSuccessMessage(`Data presensi ${attendances.length} siswa berhasil disimpan ke komputer lokal (Offline). Nilai akan otomatis dikirim saat terhubung kembali.`);
        outboxWorker.notifyQueueChanged();
        return;
      }

      // Mode Online: Coba simpan ke server
      try {
        await gradeService.batchSaveAttendance(
          selectedRombelId,
          payload.attendances
        );
        setSuccessMessage('Presensi kehadiran siswa berhasil disimpan!');
        setTimeout(() => setSuccessMessage(null), 4000);

        await deleteDraft(draftKey);
        setHasUnsavedAttendanceDraft(false);
        setAttendanceDraftFound(null);
        isEditingAttendanceRef.current = false;
        fetchTabData();
      } catch (serverErr: any) {
        console.warn('Gagal simpan presensi ke server, beralih ke antrean offline:', serverErr);

        await enqueueOutbox({
          action: 'SAVE_ATTENDANCE',
          endpoint: '/attendance/batch',
          method: 'POST',
          payload,
        });

        await saveDraft(
          draftKey,
          'attendance',
          {
            attendances,
            savedAt: Date.now(),
          },
          {
            rombelId: selectedRombelId,
            teacherId: user?.id,
          }
        );

        setHasUnsavedAttendanceDraft(false);
        setAttendanceDraftFound(null);
        isEditingAttendanceRef.current = false;
        setSuccessMessage('Koneksi server terganggu saat mengirim. Data presensi telah diamankan ke antrean offline komputer Anda dan akan otomatis disinkronkan.');
        outboxWorker.notifyQueueChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan presensi');
    } finally {
      setSaving(false);
    }
  };

  // Notes handlers
  const handleNoteChange = (studentId: string, text: string) => {
    isEditingNotesRef.current = true;
    setNotes((prev) =>
      prev.map((n) => (n.student_id === studentId ? { ...n, catatan: text } : n))
    );
  };

  const handleApplyNoteTemplate = (studentId: string, template: string) => {
    isEditingNotesRef.current = true;
    setNotes((prev) =>
      prev.map((n) => (n.student_id === studentId ? { ...n, catatan: template } : n))
    );
  };

  const handleSaveNotes = async () => {
    if (!selectedRombelId || notes.length === 0) return;

    const draftKey = `notes:${selectedRombelId}:all`;
    const payload = {
      rombel_id: selectedRombelId,
      notes: notes.map((n) => ({
        student_id: n.student_id,
        catatan: n.catatan,
      })),
    };

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      if (!isOnline) {
        // Mode Offline: Simpan langsung ke Outbox
        await enqueueOutbox({
          action: 'SAVE_WALI_NOTES',
          endpoint: '/wali-notes/batch',
          method: 'POST',
          payload,
        });

        await saveDraft(
          draftKey,
          'notes',
          {
            notes,
            savedAt: Date.now(),
          },
          {
            rombelId: selectedRombelId,
            teacherId: user?.id,
          }
        );

        setHasUnsavedNotesDraft(false);
        setNotesDraftFound(null);
        isEditingNotesRef.current = false;
        setSuccessMessage(`Catatan wali kelas ${notes.length} siswa berhasil disimpan ke komputer lokal (Offline). Nilai akan otomatis dikirim saat terhubung kembali.`);
        outboxWorker.notifyQueueChanged();
        return;
      }

      // Mode Online: Coba simpan ke server
      try {
        await gradeService.batchSaveWaliNotes(
          selectedRombelId,
          payload.notes
        );
        setSuccessMessage('Catatan perkembangan siswa berhasil disimpan!');
        setTimeout(() => setSuccessMessage(null), 4000);

        await deleteDraft(draftKey);
        setHasUnsavedNotesDraft(false);
        setNotesDraftFound(null);
        isEditingNotesRef.current = false;
        fetchTabData();
      } catch (serverErr: any) {
        console.warn('Gagal simpan catatan ke server, beralih ke antrean offline:', serverErr);

        await enqueueOutbox({
          action: 'SAVE_WALI_NOTES',
          endpoint: '/wali-notes/batch',
          method: 'POST',
          payload,
        });

        await saveDraft(
          draftKey,
          'notes',
          {
            notes,
            savedAt: Date.now(),
          },
          {
            rombelId: selectedRombelId,
            teacherId: user?.id,
          }
        );

        setHasUnsavedNotesDraft(false);
        setNotesDraftFound(null);
        isEditingNotesRef.current = false;
        setSuccessMessage('Koneksi server terganggu saat mengirim. Catatan wali telah diamankan ke antrean offline komputer Anda dan akan otomatis disinkronkan.');
        outboxWorker.notifyQueueChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan catatan');
    } finally {
      setSaving(false);
    }
  };

  // Extracurricular handlers
  const handleAddEkskul = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEkskul.student_id || !newEkskul.nama_ekskul) return;

    try {
      setSaving(true);
      setError(null);
      await gradeService.saveExtracurricular({
        student_id: newEkskul.student_id,
        rombel_id: selectedRombelId,
        nama_ekskul: newEkskul.nama_ekskul,
        predikat: newEkskul.predikat,
        keterangan: newEkskul.keterangan,
      });

      setShowAddEkskulModal(false);
      setNewEkskul({
        student_id: '',
        nama_ekskul: '',
        predikat: 'Sangat Baik',
        keterangan: '',
      });
      setSuccessMessage('Ekstrakurikuler berhasil ditambahkan!');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchTabData();
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan ekstrakurikuler');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEkskul = async () => {
    if (!ekskulToDelete) return;

    try {
      setSaving(true);
      await gradeService.deleteExtracurricular(ekskulToDelete.id);
      setEkskulToDelete(null);
      setSuccessMessage('Ekstrakurikuler berhasil dihapus');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchTabData();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus ekstrakurikuler');
    } finally {
      setSaving(false);
    }
  };

  // Filtered students for quick search
  const filteredAttendances = useMemo(() => {
    if (!searchQuery.trim()) return attendances;
    const q = searchQuery.toLowerCase();
    return attendances.filter(
      (a) => a.student_name.toLowerCase().includes(q) || a.nisn?.includes(q)
    );
  }, [attendances, searchQuery]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.student_name.toLowerCase().includes(q) || n.nisn?.includes(q)
    );
  }, [notes, searchQuery]);

  if (!isWaliKelas) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-m3-surface rounded-3xl border border-m3-outline-variant/30 mt-8">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
          <CalendarCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-m3-on-surface">Fitur Khusus Wali Kelas</h2>
        <p className="text-xs text-m3-on-surface-variant leading-relaxed">
          Pengelolaan presensi ketidakhadiran, catatan motivasi, dan kegiatan ekstrakurikuler siswa khusus diperuntukkan bagi Guru yang bertugas sebagai Wali Kelas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-m3-on-surface">
              Kehadiran & Catatan Siswa
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-m3-secondary-container text-m3-on-secondary-container border border-m3-secondary/20">
              Pengelolaan Wali Kelas
            </span>

            {/* Offline & Connection Status Indicator */}
            {!isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Mode Offline (Penyimpanan Lokal Aktif)</span>
              </span>
            ) : unsyncedCount > 0 ? (
              <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30">
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{unsyncedCount} data antrean offline</span>
                <button
                  type="button"
                  onClick={() => triggerSync()}
                  disabled={isSyncing}
                  className="underline hover:text-blue-950 dark:hover:text-blue-200 font-bold cursor-pointer"
                >
                  {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Server Terhubung</span>
              </span>
            )}

            {activeTab === 'attendance' && hasUnsavedAttendanceDraft && lastAttendanceDraftSavedAt && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs text-m3-on-surface-variant bg-m3-surface-container border border-m3-outline-variant/40">
                <Database className="w-3.5 h-3.5 text-m3-primary" />
                <span>Draf presensi tersimpan ({lastAttendanceDraftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})</span>
              </span>
            )}

            {activeTab === 'notes' && hasUnsavedNotesDraft && lastNotesDraftSavedAt && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs text-m3-on-surface-variant bg-m3-surface-container border border-m3-outline-variant/40">
                <Database className="w-3.5 h-3.5 text-m3-primary" />
                <span>Draf catatan tersimpan ({lastNotesDraftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})</span>
              </span>
            )}
          </div>
          <p className="text-sm text-m3-on-surface-variant mt-1">
            Rekap presensi kehadiran, catatan perkembangan siswa, dan penilaian kegiatan ekstrakurikuler.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'attendance' && (
            <M3Button
              variant="filled"
              onClick={handleSaveAttendance}
              disabled={saving || loading || attendances.length === 0}
              icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            >
              {saving ? 'Menyimpan...' : 'Simpan Presensi'}
            </M3Button>
          )}

          {activeTab === 'notes' && (
            <M3Button
              variant="filled"
              onClick={handleSaveNotes}
              disabled={saving || loading || notes.length === 0}
              icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            >
              {saving ? 'Menyimpan...' : 'Simpan Semua Catatan'}
            </M3Button>
          )}

          {activeTab === 'extracurricular' && (
            <M3Button
              variant="filled"
              onClick={() => setShowAddEkskulModal(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Tambah Ekskul
            </M3Button>
          )}
        </div>
      </div>

      {/* Draft Recovery Banner for Attendance */}
      {activeTab === 'attendance' && attendanceDraftFound && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start sm:items-center gap-2.5">
            <Database className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-200">
                Ditemukan draf presensi lokal yang belum disimpan ke server
              </p>
              <p className="text-amber-900/90 dark:text-amber-300/90 mt-0.5">
                Tersimpan di komputer ini pada {new Date(attendanceDraftFound.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. Pulihkan draf untuk melanjutkan perubahan presensi yang belum sempat terkirim.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                isEditingAttendanceRef.current = true;
                setAttendances(attendanceDraftFound.attendances);
                setHasUnsavedAttendanceDraft(true);
                setLastAttendanceDraftSavedAt(new Date(attendanceDraftFound.savedAt));
                setAttendanceDraftFound(null);
                setSuccessMessage('Draf presensi lokal berhasil dipulihkan!');
                setTimeout(() => setSuccessMessage(null), 4000);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-sm"
            >
              Pulihkan Draf
            </button>
            <button
              type="button"
              onClick={async () => {
                const draftKey = `attendance:${selectedRombelId}:all`;
                await deleteDraft(draftKey);
                setAttendanceDraftFound(null);
                setHasUnsavedAttendanceDraft(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 font-semibold text-xs transition cursor-pointer"
            >
              Abaikan & Hapus
            </button>
          </div>
        </div>
      )}

      {/* Draft Recovery Banner for Notes */}
      {activeTab === 'notes' && notesDraftFound && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start sm:items-center gap-2.5">
            <Database className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-200">
                Ditemukan draf catatan wali kelas yang belum disimpan ke server
              </p>
              <p className="text-amber-900/90 dark:text-amber-300/90 mt-0.5">
                Tersimpan di komputer ini pada {new Date(notesDraftFound.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. Pulihkan draf untuk melanjutkan perubahan catatan yang belum sempat terkirim.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                isEditingNotesRef.current = true;
                setNotes(notesDraftFound.notes);
                setHasUnsavedNotesDraft(true);
                setLastNotesDraftSavedAt(new Date(notesDraftFound.savedAt));
                setNotesDraftFound(null);
                setSuccessMessage('Draf catatan wali kelas berhasil dipulihkan!');
                setTimeout(() => setSuccessMessage(null), 4000);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-sm"
            >
              Pulihkan Draf
            </button>
            <button
              type="button"
              onClick={async () => {
                const draftKey = `notes:${selectedRombelId}:all`;
                await deleteDraft(draftKey);
                setNotesDraftFound(null);
                setHasUnsavedNotesDraft(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 font-semibold text-xs transition cursor-pointer"
            >
              Abaikan & Hapus
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-m3-error-container text-m3-on-error-container border border-m3-error/20 text-xs flex items-center justify-between animate-fadeIn"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-m3-error shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold hover:underline cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs flex items-center justify-between animate-fadeIn"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold hover:underline cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Control Filter Bar */}
      <M3Card variant="filled" className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Searchable Rombel Selector */}
          <div>
            <SearchableRombelSelect
              label="Rombongan Belajar (Kelas)"
              rombels={user?.wali_kelas_rombel ? rombels.filter((r) => r.id === user.wali_kelas_rombel?.id) : rombels}
              selectedRombelId={selectedRombelId}
              onSelect={(id) => {
                isEditingAttendanceRef.current = false;
                isEditingNotesRef.current = false;
                setAttendanceDraftFound(null);
                setNotesDraftFound(null);
                setHasUnsavedAttendanceDraft(false);
                setHasUnsavedNotesDraft(false);
                setSelectedRombelId(id);
              }}
              filterEmpty={true}
            />
          </div>

          {/* Search */}
          <div className="md:col-span-2">
            <M3TextField
              label="Cari Nama Siswa"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik nama siswa..."
              leadingIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </M3Card>

      {/* M3 Primary Tabs */}
      <div className="bg-m3-surface-container rounded-full p-1.5 border border-m3-outline-variant/30 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
            activeTab === 'attendance'
              ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs'
              : 'text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface/60'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Presensi Kehadiran</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'attendance' ? 'bg-m3-surface text-m3-on-surface' : 'bg-m3-surface-variant text-m3-on-surface-variant'
            }`}
          >
            {attendances.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
            activeTab === 'notes'
              ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs'
              : 'text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Catatan Wali Kelas</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'notes' ? 'bg-m3-surface text-m3-on-surface' : 'bg-m3-surface-variant text-m3-on-surface-variant'
            }`}
          >
            {notes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('extracurricular')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
            activeTab === 'extracurricular'
              ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs'
              : 'text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface/60'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Ekstrakurikuler</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'extracurricular' ? 'bg-m3-surface text-m3-on-surface' : 'bg-m3-surface-variant text-m3-on-surface-variant'
            }`}
          >
            {extracurriculars.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Presensi Kehadiran */}
      {activeTab === 'attendance' && (
        <M3Card variant="elevated" className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-m3-surface-container/60 border-b border-m3-outline-variant/30 text-m3-on-surface font-bold">
                  <th className="py-3.5 px-3 w-12 text-center">No</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Nama Peserta Didik</th>
                  <th className="py-3.5 px-3 min-w-[100px]">NISN</th>
                  <th className="py-3.5 px-3 w-36 text-center border-l border-m3-outline-variant/30">Sakit (S)</th>
                  <th className="py-3.5 px-3 w-36 text-center border-l border-m3-outline-variant/30">Izin (I)</th>
                  <th className="py-3.5 px-3 w-36 text-center border-l border-m3-outline-variant/30">Tanpa Ket. (A)</th>
                  <th className="py-3.5 px-3 w-28 text-center border-l border-m3-outline-variant/30 bg-m3-surface-container/30">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m3-outline-variant/20 bg-m3-surface">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-m3-on-surface-variant">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-m3-primary" />
                        <span>Memuat data presensi...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAttendances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-m3-on-surface-variant">
                      Tidak ada siswa ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredAttendances.map((st, idx) => (
                    <tr key={st.student_id} className="hover:bg-m3-surface-container/30 transition-colors">
                      <td className="py-3.5 px-3 text-center text-m3-outline font-medium">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-m3-on-surface truncate">
                        {st.student_name}
                      </td>
                      <td className="py-3.5 px-3 text-m3-on-surface-variant font-mono text-[11px]">{st.nisn || '-'}</td>

                      {/* Sakit */}
                      <td className="py-2.5 px-3 text-center border-l border-m3-outline-variant/20">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={st.sakit}
                            onChange={(e) => handleAttendanceChange(st.student_id, 'sakit', e.target.value)}
                            className="w-14 px-2 py-1.5 text-center font-bold text-xs rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary min-h-[36px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleIncrementAttendance(st.student_id, 'sakit')}
                            className="w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-xs flex items-center justify-center cursor-pointer"
                            title="Tambah 1"
                            aria-label={`Tambah sakit ${st.student_name}`}
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Izin */}
                      <td className="py-2.5 px-3 text-center border-l border-m3-outline-variant/20">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={st.izin}
                            onChange={(e) => handleAttendanceChange(st.student_id, 'izin', e.target.value)}
                            className="w-14 px-2 py-1.5 text-center font-bold text-xs rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary min-h-[36px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleIncrementAttendance(st.student_id, 'izin')}
                            className="w-8 h-8 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center cursor-pointer"
                            title="Tambah 1"
                            aria-label={`Tambah izin ${st.student_name}`}
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Tanpa Keterangan */}
                      <td className="py-2.5 px-3 text-center border-l border-m3-outline-variant/20">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={st.tanpa_keterangan}
                            onChange={(e) => handleAttendanceChange(st.student_id, 'tanpa_keterangan', e.target.value)}
                            className="w-14 px-2 py-1.5 text-center font-bold text-xs rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary min-h-[36px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleIncrementAttendance(st.student_id, 'tanpa_keterangan')}
                            className="w-8 h-8 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-xs flex items-center justify-center cursor-pointer"
                            title="Tambah 1"
                            aria-label={`Tambah alpa ${st.student_name}`}
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-3 text-center border-l border-m3-outline-variant/20 bg-m3-surface-container/20 font-bold">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs ${
                            st.total > 5
                              ? 'bg-rose-100 text-rose-950 font-black border border-rose-300'
                              : st.total > 0
                              ? 'bg-m3-surface-variant text-m3-on-surface-variant'
                              : 'text-m3-outline'
                          }`}
                        >
                          {st.total} hari
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </M3Card>
      )}

      {/* Tab 2: Catatan Wali Kelas */}
      {activeTab === 'notes' && (
        <M3Card variant="elevated" className="overflow-hidden p-0">
          <div className="p-4 border-b border-m3-outline-variant/30 bg-m3-surface-container/40 flex items-center justify-between">
            <span className="text-xs text-m3-on-surface-variant font-medium">
              Gunakan tombol template cepat di samping textarea untuk mengisi catatan rekomendasi secara terarah.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-m3-surface-container/60 border-b border-m3-outline-variant/30 text-m3-on-surface font-bold">
                  <th className="py-3.5 px-3 w-12 text-center">No</th>
                  <th className="py-3.5 px-4 w-64">Nama Peserta Didik</th>
                  <th className="py-3.5 px-4 border-l border-m3-outline-variant/30">
                    Catatan Perkembangan & Motivasi Wali Kelas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m3-outline-variant/20 bg-m3-surface">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-m3-on-surface-variant">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-m3-primary" />
                        <span>Memuat data catatan...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredNotes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-m3-on-surface-variant">
                      Tidak ada siswa ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredNotes.map((st, idx) => (
                    <tr key={st.student_id} className="hover:bg-m3-surface-container/30 transition-colors">
                      <td className="py-3.5 px-3 text-center text-m3-outline font-medium">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-m3-on-surface truncate">{st.student_name}</p>
                        <p className="text-[10px] text-m3-outline font-mono">NISN: {st.nisn || '-'}</p>
                      </td>

                      <td className="py-3.5 px-4 border-l border-m3-outline-variant/20 space-y-2">
                        <textarea
                          rows={2}
                          value={st.catatan}
                          onChange={(e) => handleNoteChange(st.student_id, e.target.value)}
                          placeholder="Tuliskan catatan perkembangan belajar siswa selama tengah semester..."
                          className="w-full px-3.5 py-2 text-xs leading-relaxed rounded-xl border border-m3-outline bg-m3-surface focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary text-m3-on-surface"
                        />

                        {/* Quick Templates */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-m3-outline font-semibold flex items-center gap-1">
                            <FileText className="w-3 h-3 text-amber-600" /> Template:
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyNoteTemplate(
                                st.student_id,
                                'Pertahankan prestasi belajarmu, tetap rajin dan terus tingkatkan keaktifan serta rasa ingin tahu di kelas.'
                              )
                            }
                            className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-[10px] font-semibold border border-emerald-300 transition-colors cursor-pointer"
                          >
                            Prestasi Baik
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyNoteTemplate(
                                st.student_id,
                                'Tingkatkan kedisiplinan, ketertiban dalam kehadiran, serta keaktifan menyelesaikan tugas praktikum kejuruan.'
                              )
                            }
                            className="px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-950 text-[10px] font-semibold border border-blue-300 transition-colors cursor-pointer"
                          >
                            Tingkatkan Disiplin
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyNoteTemplate(
                                st.student_id,
                                'Perlu pendampingan lebih lanjut dalam memahami materi kejuruan dan lebih proaktif berdiskusi dengan guru maupun teman.'
                              )
                            }
                            className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-950 text-[10px] font-semibold border border-amber-300 transition-colors cursor-pointer"
                          >
                            Perlu Bimbingan
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </M3Card>
      )}

      {/* Tab 3: Ekstrakurikuler */}
      {activeTab === 'extracurricular' && (
        <div className="space-y-4">
          <M3Card variant="elevated" className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-m3-surface-container/60 border-b border-m3-outline-variant/30 text-m3-on-surface font-bold">
                    <th className="py-3.5 px-3 w-12 text-center">No</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Nama Peserta Didik</th>
                    <th className="py-3.5 px-4 min-w-[160px] border-l border-m3-outline-variant/30">Kegiatan Ekstrakurikuler</th>
                    <th className="py-3.5 px-3 w-32 text-center border-l border-m3-outline-variant/30">Predikat</th>
                    <th className="py-3.5 px-4 border-l border-m3-outline-variant/30">Keterangan</th>
                    <th className="py-3.5 px-3 w-16 text-center border-l border-m3-outline-variant/30">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-outline-variant/20 bg-m3-surface">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-m3-on-surface-variant">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-m3-primary" />
                          <span>Memuat kegiatan ekstrakurikuler...</span>
                        </div>
                      </td>
                    </tr>
                  ) : extracurriculars.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-m3-on-surface-variant">
                        <Trophy className="w-8 h-8 text-m3-outline mx-auto mb-2" />
                        <p className="font-semibold text-m3-on-surface">Belum ada kegiatan ekstrakurikuler terdaftar.</p>
                        <p className="text-[11px] text-m3-outline mt-0.5">
                          Klik tombol "Tambah Ekskul" di atas untuk menambahkan partisipasi ekstrakurikuler siswa.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    extracurriculars.map((ek, idx) => (
                      <tr key={ek.id} className="hover:bg-m3-surface-container/30 transition-colors">
                        <td className="py-3.5 px-3 text-center text-m3-outline font-medium">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-m3-on-surface">
                          {ek.student?.name || '-'}
                        </td>
                        <td className="py-3.5 px-4 border-l border-m3-outline-variant/20 font-semibold text-m3-on-surface">
                          {ek.nama_ekskul}
                        </td>
                        <td className="py-3.5 px-3 text-center border-l border-m3-outline-variant/20">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              ek.predikat === 'Sangat Baik'
                                ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                : ek.predikat === 'Baik'
                                ? 'bg-blue-100 text-blue-950 border border-blue-300'
                                : 'bg-amber-100 text-amber-950 border border-amber-300'
                            }`}
                          >
                            {ek.predikat}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 border-l border-m3-outline-variant/20 text-m3-on-surface-variant">
                          {ek.keterangan || '-'}
                        </td>
                        <td className="py-3.5 px-3 text-center border-l border-m3-outline-variant/20">
                          <button
                            type="button"
                            onClick={() => setEkskulToDelete(ek)}
                            className="p-2 rounded-full hover:bg-m3-error-container/40 text-m3-error transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center mx-auto"
                            title="Hapus Ekstrakurikuler"
                            aria-label={`Hapus ekskul ${ek.nama_ekskul}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </M3Card>
        </div>
      )}

      {/* Dialog Tambah Ekskul */}
      <M3Dialog
        isOpen={showAddEkskulModal}
        onClose={() => setShowAddEkskulModal(false)}
        title="Tambah Kegiatan Ekstrakurikuler Siswa"
      >
        <form onSubmit={handleAddEkskul} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Pilih Siswa <span className="text-m3-error">*</span>
            </label>
            <select
              required
              value={newEkskul.student_id}
              onChange={(e) => setNewEkskul({ ...newEkskul, student_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline text-xs sm:text-sm font-semibold text-m3-on-surface focus:outline-none focus:border-m3-primary min-h-[44px]"
            >
              <option value="">-- Pilih Siswa --</option>
              {attendances.map((s) => (
                <option key={s.student_id} value={s.student_id}>
                  {s.student_name} ({s.nisn || '-'})
                </option>
              ))}
            </select>
          </div>

          <M3TextField
            label="Nama Ekstrakurikuler"
            required
            placeholder="Misal: Pramuka, PMR, Rohis, Basket, Futsal, dsb."
            value={newEkskul.nama_ekskul}
            onChange={(e) => setNewEkskul({ ...newEkskul, nama_ekskul: e.target.value })}
          />

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Predikat
            </label>
            <select
              value={newEkskul.predikat}
              onChange={(e) => setNewEkskul({ ...newEkskul, predikat: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline text-xs sm:text-sm font-semibold text-m3-on-surface focus:outline-none focus:border-m3-primary min-h-[44px]"
            >
              <option value="Sangat Baik">Sangat Baik</option>
              <option value="Baik">Baik</option>
              <option value="Cukup">Cukup</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Keterangan / Catatan Kegiatan
            </label>
            <textarea
              rows={2}
              placeholder="Misal: Sangat aktif dalam kegiatan kepramukaan dan latihan rutin mingguan..."
              value={newEkskul.keterangan}
              onChange={(e) => setNewEkskul({ ...newEkskul, keterangan: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline text-xs sm:text-sm font-medium text-m3-on-surface focus:outline-none focus:border-m3-primary"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-m3-outline-variant/30">
            <M3Button variant="text" type="button" onClick={() => setShowAddEkskulModal(false)}>
              Batal
            </M3Button>
            <M3Button variant="filled" type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Ekskul'}
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* Dialog Konfirmasi Hapus Ekskul */}
      <M3Dialog
        isOpen={!!ekskulToDelete}
        onClose={() => setEkskulToDelete(null)}
        title="Hapus Ekstrakurikuler"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-m3-on-surface leading-relaxed">
            Apakah Anda yakin ingin menghapus kegiatan ekstrakurikuler <strong>{ekskulToDelete?.nama_ekskul}</strong> untuk siswa <strong>{ekskulToDelete?.student?.name}</strong>?
          </p>
          <div className="pt-3 border-t border-m3-outline-variant/30 flex justify-end gap-2.5">
            <M3Button variant="text" onClick={() => setEkskulToDelete(null)}>
              Batal
            </M3Button>
            <M3Button variant="danger" onClick={handleDeleteEkskul} disabled={saving}>
              {saving ? 'Menghapus...' : 'Ya, Hapus'}
            </M3Button>
          </div>
        </div>
      </M3Dialog>
    </div>
  );
};
