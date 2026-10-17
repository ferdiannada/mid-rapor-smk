import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { masterService } from '../services/master.service';
import { Semester } from '../types';
import { M3Card, M3Button, M3TextField, M3Dialog } from '../components/m3';
import { Skeleton } from '../components/common/Skeleton';

export const SemesterManagement: React.FC = () => {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [semesterToDelete, setSemesterToDelete] = useState<Semester | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal create state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tahunAjaran, setTahunAjaran] = useState('2024/2025');
  const [semesterNum, setSemesterNum] = useState(1);
  const [jenisRapor, setJenisRapor] = useState('mid');
  const [isActive, setIsActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSemesters();
  }, []);

  const loadSemesters = async () => {
    setIsLoading(true);
    try {
      const res = await masterService.getSemesters();
      setSemesters(res.semesters || []);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Gagal memuat daftar semester.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    setIsActivating(id);
    setMessage(null);
    try {
      const res = await masterService.activateSemester(id);
      setMessage({ type: 'success', text: res.message });
      await loadSemesters();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal mengaktifkan semester' });
    } finally {
      setIsActivating(null);
    }
  };

  const confirmDelete = async () => {
    if (!semesterToDelete) return;
    setIsDeleting(semesterToDelete.id);
    setMessage(null);
    try {
      const res = await masterService.deleteSemester(semesterToDelete.id);
      setMessage({ type: 'success', text: res.message });
      setSemesterToDelete(null);
      await loadSemesters();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menghapus semester' });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await masterService.createSemester({
        tahun_ajaran: tahunAjaran.trim(),
        semester: Number(semesterNum),
        jenis_rapor: jenisRapor,
        is_active: isActive,
      });
      setShowCreateModal(false);
      setMessage({ type: 'success', text: res.message });
      await loadSemesters();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal membuat semester' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* M3 Header Banner */}
      <div className="rounded-[28px] bg-m3-primary-container text-m3-on-primary-container p-6 sm:p-8 shadow-m3-elevation-1 border border-m3-primary/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-surface/70 text-m3-on-surface text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-m3-primary" />
              <span>Kalender Akademik</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight">
              Manajemen Semester & Tahun Ajaran
            </h1>
            <p className="text-xs sm:text-sm text-m3-on-primary-container/85 leading-relaxed">
              Tentukan periode semester aktif yang digunakan sebagai rujukan seluruh pengisian nilai tengah semester (STS) dan pencetakan rapor.
            </p>
          </div>

          <div className="shrink-0">
            <M3Button
              variant="filled"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              Tambah Semester
            </M3Button>
          </div>
        </div>
      </div>

      {message && (
        <div
          role="alert"
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in ${
            message.type === 'success'
              ? 'bg-m3-secondary-container text-m3-on-secondary-container'
              : 'bg-m3-error-container text-m3-on-error-container'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs font-bold hover:underline shrink-0 ml-2 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Semesters Table */}
      <M3Card variant="outlined" className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-m3-outline-variant/20 flex items-center justify-between bg-m3-surface">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-m3-primary" />
            <h2 className="text-sm font-bold text-m3-on-surface">Daftar Periode Semester</h2>
          </div>
          <span className="text-xs text-m3-on-surface-variant font-medium">
            Total {semesters.length} periode
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : semesters.length === 0 ? (
          <div className="p-12 text-center text-m3-on-surface-variant space-y-3">
            <Calendar className="w-12 h-12 mx-auto text-m3-outline" />
            <p className="text-sm font-semibold text-m3-on-surface">Belum ada periode semester dibuat</p>
            <p className="text-xs max-w-sm mx-auto">
              Silakan klik tombol Tambah Semester di atas untuk membuat semester aktif.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[580px]">
              <thead>
                <tr className="border-b border-m3-outline-variant/20 bg-m3-surface-container text-m3-on-surface-variant text-left">
                  <th className="py-3 px-5 font-bold">Tahun Ajaran</th>
                  <th className="py-3 px-5 font-bold">Semester</th>
                  <th className="py-3 px-5 font-bold">Jenis Rapor</th>
                  <th className="py-3 px-5 font-bold">Status</th>
                  <th className="py-3 px-5 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m3-outline-variant/10 text-m3-on-surface">
                {semesters.map((s) => (
                  <tr key={s.id} className="hover:bg-m3-surface-container/40 transition-colors">
                    <td className="py-3.5 px-5 font-bold font-mono text-sm">{s.tahun_ajaran}</td>
                    <td className="py-3.5 px-5">
                      <span className="font-semibold">
                        Semester {s.semester} ({s.semester === 1 ? 'Ganjil' : 'Genap'})
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-m3-surface-container text-m3-on-surface-variant">
                        {s.jenis_rapor === 'mid' ? 'Tengah Semester (STS)' : 'Akhir Semester (SAS)'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      {s.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Aktif Digunakan</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-m3-outline font-medium">Nonaktif</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!s.is_active && (
                          <M3Button
                            variant="tonal"
                            size="sm"
                            disabled={isActivating === s.id}
                            onClick={() => handleActivate(s.id)}
                            icon={isActivating === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : undefined}
                          >
                            Aktifkan
                          </M3Button>
                        )}
                        {!s.is_active && (
                          <button
                            type="button"
                            onClick={() => setSemesterToDelete(s)}
                            disabled={isDeleting === s.id}
                            aria-label={`Hapus semester ${s.tahun_ajaran}`}
                            className="p-2 text-m3-error hover:bg-m3-error-container/40 rounded-full transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </M3Card>

      {/* Modal Create Semester */}
      <M3Dialog
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tambah Periode Semester Baru"
        icon={<Calendar className="w-5 h-5 text-m3-primary" />}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <M3TextField
            label="Tahun Ajaran"
            value={tahunAjaran}
            onChange={(e) => setTahunAjaran(e.target.value)}
            required
            placeholder="Contoh: 2024/2025"
            helperText="Gunakan format YYYY/YYYY"
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-m3-on-surface-variant px-1">
              Pilihan Semester
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSemesterNum(1)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  semesterNum === 1
                    ? 'border-m3-primary bg-m3-primary-container text-m3-on-primary-container'
                    : 'border-m3-outline-variant hover:bg-m3-surface-container'
                }`}
              >
                Semester 1 (Ganjil)
              </button>
              <button
                type="button"
                onClick={() => setSemesterNum(2)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  semesterNum === 2
                    ? 'border-m3-primary bg-m3-primary-container text-m3-on-primary-container'
                    : 'border-m3-outline-variant hover:bg-m3-surface-container'
                }`}
              >
                Semester 2 (Genap)
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-m3-on-surface-variant px-1">
              Jenis Asesmen Rapor
            </label>
            <select
              value={jenisRapor}
              onChange={(e) => setJenisRapor(e.target.value)}
              className="w-full bg-m3-surface text-m3-on-surface border border-m3-outline-variant rounded-xl py-2.5 px-3 text-xs outline-none focus:border-2 focus:border-m3-primary"
            >
              <option value="mid">Tengah Semester (STS)</option>
              <option value="final">Akhir Semester (SAS)</option>
            </select>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-m3-primary focus:ring-m3-primary"
            />
            <label htmlFor="isActiveCheck" className="text-xs text-m3-on-surface font-medium cursor-pointer">
              Langsung aktifkan periode ini sebagai rujukan aktif
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-m3-outline-variant/20">
            <M3Button variant="text" onClick={() => setShowCreateModal(false)}>
              Batal
            </M3Button>
            <M3Button
              type="submit"
              variant="filled"
              disabled={isSubmitting || !tahunAjaran.trim()}
              icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Semester'}
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* Delete Confirmation M3 Dialog */}
      <M3Dialog
        isOpen={Boolean(semesterToDelete)}
        onClose={() => setSemesterToDelete(null)}
        title="Hapus Periode Semester"
        icon={<AlertTriangle className="w-5 h-5 text-m3-error" />}
        actions={
          <>
            <M3Button variant="text" onClick={() => setSemesterToDelete(null)}>
              Batal
            </M3Button>
            <M3Button
              variant="danger"
              disabled={Boolean(isDeleting)}
              onClick={confirmDelete}
              icon={isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
            </M3Button>
          </>
        }
      >
        <p className="text-xs sm:text-sm text-m3-on-surface-variant leading-relaxed">
          Apakah Anda yakin ingin menghapus semester{' '}
          <strong className="text-m3-on-surface">{semesterToDelete?.tahun_ajaran} (Semester {semesterToDelete?.semester})</strong>?
          Tindakan ini tidak dapat dibatalkan.
        </p>
      </M3Dialog>
    </div>
  );
};
