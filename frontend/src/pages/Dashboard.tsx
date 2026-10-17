import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Users,
  Award,
  Layers,
  Database,
  Calendar,
  BookOpen,
  GraduationCap,
  BarChart3,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { masterService } from '../services/master.service';
import { reportService } from '../services/report.service';
import { DashboardStats, TeachingAssignment, GradeProgressItem } from '../types';
import { M3Card, M3Button } from '../components/m3';
import { Skeleton } from '../components/common/Skeleton';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isWaliKelas = Boolean(user?.wali_kelas_rombel);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myAssignments, setMyAssignments] = useState<TeachingAssignment[]>([]);
  const [progressList, setProgressList] = useState<GradeProgressItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, progRes] = await Promise.all([
        masterService.getDashboardStats(),
        reportService.getGradeProgress().catch(() => ({ progress: [] })),
      ]);
      setStats(statsRes.stats);
      setProgressList(progRes.progress || []);

      if (user?.role === 'guru') {
        const assignRes = await masterService.getMyTeachingAssignments();
        setMyAssignments(assignRes.assignments || []);
      }
    } catch (err: any) {
      console.error(err);
      setError('Gagal memuat data dashboard. Silakan periksa koneksi atau coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-44 w-full rounded-[28px]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <M3Card variant="outlined" className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-m3-error-container text-m3-on-error-container flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-m3-on-surface">Terjadi Kendala</h2>
          <p className="text-xs text-m3-on-surface-variant mt-1">{error}</p>
        </div>
        <M3Button variant="tonal" onClick={loadDashboardData}>
          Muat Ulang Dashboard
        </M3Button>
      </M3Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Welcome Surface (M3 Academic Primary Container, No Gradients/Orbs) */}
      <div className="rounded-[28px] bg-m3-primary-container text-m3-on-primary-container p-6 sm:p-8 shadow-m3-elevation-1 border border-m3-primary/10 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-surface/70 text-m3-on-surface text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-m3-primary" />
              <span>
                {stats?.active_semester
                  ? `Tahun Ajaran ${stats.active_semester.tahun_ajaran} • Semester ${stats.active_semester.semester === 1 ? 'Ganjil' : 'Genap'} (STS)`
                  : 'Periode Semester Belum Diaktifkan'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight">
              Selamat Datang, {user?.name || 'Bapak/Ibu Guru'}!
            </h1>
            <p className="text-xs sm:text-sm text-m3-on-primary-container/85 leading-relaxed">
              {isAdmin
                ? 'Kelola data akademik, sinkronisasi Dapodik, dan pantau pengisian nilai tengah semester Kurikulum Merdeka.'
                : isWaliKelas
                ? `Anda ditugaskan sebagai Guru Mata Pelajaran sekaligus Wali Kelas ${user?.wali_kelas_rombel?.name}.`
                : 'Silakan isi nilai capaian tujuan pembelajaran untuk mata pelajaran dan rombongan belajar yang Anda ampu.'}
            </p>
          </div>

          <div className="shrink-0">
            {isAdmin ? (
              <Link to="/settings/dapodik">
                <M3Button variant="filled" icon={<Database className="w-4 h-4" />}>
                  Sinkronisasi Dapodik
                </M3Button>
              </Link>
            ) : (
              <Link to="/grades/input">
                <M3Button variant="filled" icon={<Award className="w-4 h-4" />}>
                  Mulai Input Nilai
                </M3Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Cards (M3 Elevated Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Teachers / Assignments */}
        <M3Card variant="elevated" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-m3-on-surface-variant">
              {isAdmin ? 'Total Guru (GTK)' : 'Kelas Diampu'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-m3-on-surface">
              {isAdmin ? stats?.total_teachers || 0 : stats?.my_assignments || 0}
            </p>
            <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
              {isAdmin ? 'Akun Guru Terdaftar' : 'Penugasan Mengajar'}
            </p>
          </div>
        </M3Card>

        {/* Card 2: Students */}
        <M3Card variant="elevated" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-m3-on-surface-variant">
              {isAdmin ? 'Total Peserta Didik' : 'Jumlah Siswa Diajar'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-m3-secondary-container text-m3-on-secondary-container flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-m3-on-surface">
              {isAdmin ? stats?.total_students || 0 : stats?.my_student_reach || 0}
            </p>
            <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
              {isAdmin ? 'Siswa Aktif Sekolah' : 'Siswa Dalam Penugasan'}
            </p>
          </div>
        </M3Card>

        {/* Card 3: Rombels */}
        <M3Card variant="elevated" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-m3-on-surface-variant">
              {isWaliKelas ? 'Rombel Perwalian' : 'Rombongan Belajar'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-m3-tertiary-container text-m3-on-tertiary-container flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-m3-on-surface">
              {isWaliKelas ? user?.wali_kelas_rombel?.name : stats?.total_rombels || 0}
            </p>
            <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
              {isWaliKelas ? 'Kelas Perwalian Anda' : 'Rombel Terdaftar'}
            </p>
          </div>
        </M3Card>

        {/* Card 4: Subjects */}
        <M3Card variant="elevated" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-m3-on-surface-variant">Mata Pelajaran</span>
            <div className="w-9 h-9 rounded-xl bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-m3-on-surface">
              {stats?.total_subjects || 0}
            </p>
            <p className="text-[11px] text-m3-on-surface-variant mt-0.5">Muatan Kurikulum</p>
          </div>
        </M3Card>
      </div>

      {/* Guru Section: My Teaching Assignments */}
      {!isAdmin && (
        <M3Card variant="outlined" className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-m3-outline-variant/20">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-m3-primary" />
              <h2 className="text-sm font-bold text-m3-on-surface">
                Mata Pelajaran & Kelas yang Anda Ampu
              </h2>
            </div>
            <span className="text-xs text-m3-on-surface-variant font-medium">
              {myAssignments.length} Penugasan
            </span>
          </div>

          {myAssignments.length === 0 ? (
            <div className="p-8 text-center text-xs text-m3-on-surface-variant space-y-1">
              <p className="font-semibold text-m3-on-surface">Belum ada penugasan mengajar terdaftar dari Dapodik</p>
              <p>Pastikan operator sekolah sudah menetapkan pembelajaran di aplikasi Dapodik.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {myAssignments.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-2xl bg-m3-surface-container border border-m3-outline-variant/20 hover:border-m3-primary transition-all flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] font-bold bg-m3-surface text-m3-primary px-2 py-0.5 rounded border border-m3-outline-variant/30">
                      {a.rombel?.name}
                    </span>
                    <h4 className="text-xs font-bold text-m3-on-surface">{a.subject?.nama}</h4>
                    <p className="text-[10px] text-m3-on-surface-variant">{a.jam_per_minggu} jam/minggu</p>
                  </div>

                  <Link to="/grades/input">
                    <M3Button variant="tonal" size="sm">
                      Input Nilai
                    </M3Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </M3Card>
      )}

      {/* Quick Action Navigation Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-m3-on-surface-variant uppercase tracking-wider px-1">
          Aksi Cepat & Navigasi
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          <Link
            to="/students"
            className="p-5 rounded-2xl bg-m3-surface border border-m3-outline-variant/30 hover:border-m3-primary hover:shadow-m3-elevation-1 transition-all flex items-start gap-4 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-m3-on-surface group-hover:text-m3-primary transition-colors">
                Data Peserta Didik
              </h3>
              <p className="text-xs text-m3-on-surface-variant mt-1 leading-relaxed">
                Lihat daftar nama siswa, NISN, dan rombongan belajar hasil sinkronisasi Dapodik.
              </p>
            </div>
          </Link>

          {isAdmin && (
            <Link
              to="/settings/subjects"
              className="p-5 rounded-2xl bg-m3-surface border border-m3-outline-variant/30 hover:border-m3-primary hover:shadow-m3-elevation-1 transition-all flex items-start gap-4 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-2xl bg-m3-secondary-container text-m3-on-secondary-container flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-m3-on-surface group-hover:text-m3-primary transition-colors">
                  Tujuan Pembelajaran (TP)
                </h3>
                <p className="text-xs text-m3-on-surface-variant mt-1 leading-relaxed">
                  Kelola kode dan narasi capaian Tujuan Pembelajaran per mata pelajaran.
                </p>
              </div>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/settings/semester"
              className="p-5 rounded-2xl bg-m3-surface border border-m3-outline-variant/30 hover:border-m3-primary hover:shadow-m3-elevation-1 transition-all flex items-start gap-4 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-2xl bg-m3-tertiary-container text-m3-on-tertiary-container flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-m3-on-surface group-hover:text-m3-primary transition-colors">
                  Manajemen Semester
                </h3>
                <p className="text-xs text-m3-on-surface-variant mt-1 leading-relaxed">
                  Atur tahun ajaran aktif dan rujukan periode nilai rapor tengah semester.
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Grade Input Progress Monitoring Widget */}
      {progressList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-m3-on-surface-variant uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-m3-primary" />
              <span>Monitoring Pengisian Nilai Mapel</span>
            </h2>
            <Link
              to="/reports"
              className="text-xs font-bold text-m3-primary hover:underline"
            >
              Lihat Halaman Rapor
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {progressList.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-m3-surface border border-m3-outline-variant/30 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] font-bold bg-m3-surface-container text-m3-primary px-2 py-0.5 rounded border border-m3-outline-variant/20">
                      {item.rombel_name}
                    </span>
                    <h4 className="text-xs font-bold text-m3-on-surface mt-1 truncate">
                      {item.subject_name}
                    </h4>
                    <p className="text-[10px] text-m3-on-surface-variant truncate">Guru: {item.guru_name}</p>
                  </div>

                  <span
                    className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      item.is_complete
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.percentage}%
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-m3-on-surface-variant mb-1.5 font-medium">
                    <span>Progres: {item.graded_students} / {item.total_students} Siswa</span>
                    <span className="font-semibold">{item.is_complete ? 'Lengkap' : 'Belum Selesai'}</span>
                  </div>
                  {/* M3 Linear Progress Bar */}
                  <div className="w-full bg-m3-surface-container-highest h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.is_complete ? 'bg-emerald-600' : 'bg-m3-primary'
                      }`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
