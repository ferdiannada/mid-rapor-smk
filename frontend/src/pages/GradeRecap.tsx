import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Award,
  Users,
  TrendingUp,
  Search,
  Printer,
  RefreshCw,
  BookOpen,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { masterService } from '../services/master.service';
import { gradeService } from '../services/grade.service';
import {
  Rombel,
  SubjectRecapItem,
  StudentRecapRow,
  RecapMatrixResponse,
} from '../types';
import { SearchableRombelSelect } from '../components/common/SearchableRombelSelect';
import { M3Button, M3Card, M3TextField, M3Dialog } from '../components/m3';

export const GradeRecap: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isWaliKelas = !!user?.wali_kelas_rombel;

  const [rombels, setRombels] = useState<Rombel[]>([]);
  const [selectedRombelId, setSelectedRombelId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<SubjectRecapItem[]>([]);
  const [students, setStudents] = useState<StudentRecapRow[]>([]);
  const [rombelDetail, setRombelDetail] = useState<Rombel | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected student for detail dialog
  const [selectedStudent, setSelectedStudent] = useState<StudentRecapRow | null>(null);

  // Load rombels on mount
  useEffect(() => {
    const fetchRombels = async () => {
      try {
        setLoading(true);
        const res = await masterService.getRombels();
        const list = (res.rombels || []).filter((r: Rombel) => (r.student_count || 0) > 0);
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
  }, [isAdmin, isWaliKelas, user]);

  // Load recap matrix when rombel changes
  const fetchRecap = async () => {
    if (!selectedRombelId) return;

    try {
      setLoading(true);
      setError(null);
      const res: RecapMatrixResponse = await gradeService.getRecapMatrix(selectedRombelId);
      setSubjects(res.subjects || []);
      setStudents(res.students || []);
      setRombelDetail(res.rombel || null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat rekap nilai siswa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecap();
  }, [selectedRombelId]);

  // Overall class statistics
  const classStats = useMemo(() => {
    const validAvgs = students.map((s) => s.rata_rata).filter((v) => v > 0);
    if (validAvgs.length === 0) {
      return { overallAvg: 0, topStudent: null, completedCount: 0 };
    }

    const sum = validAvgs.reduce((a, b) => a + b, 0);
    const overallAvg = Math.round((sum / validAvgs.length) * 100) / 100;
    const top = students.find((s) => s.peringkat === 1) || null;

    return {
      overallAvg,
      topStudent: top,
      completedCount: validAvgs.length,
    };
  }, [students]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) => s.student_name.toLowerCase().includes(q) || s.nisn?.includes(q)
    );
  }, [students, searchQuery]);

  return (
    <div className="space-y-6 max-w-full pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-m3-on-surface">
              Rekapitulasi Nilai Siswa
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-950 border border-emerald-300">
              Matriks Rapor Asesmen
            </span>
          </div>
          <p className="text-sm text-m3-on-surface-variant mt-1">
            Matriks nilai seluruh mata pelajaran, rata-rata nilai, dan pemeringkatan kelas rombongan belajar.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <M3Button
            variant="outlined"
            size="sm"
            onClick={fetchRecap}
            disabled={loading}
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Segarkan
          </M3Button>

          <Link to="/reports">
            <M3Button variant="filled" size="sm" icon={<Printer className="w-4 h-4" />}>
              Cetak Rapor Siswa
            </M3Button>
          </Link>
        </div>
      </div>

      {/* Control Filter Bar */}
      <M3Card variant="filled" className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Searchable Rombel Selector */}
          <div>
            <SearchableRombelSelect
              label="Pilih Rombongan Belajar (Kelas)"
              rombels={rombels}
              selectedRombelId={selectedRombelId}
              onSelect={(id) => setSelectedRombelId(id)}
              filterEmpty={true}
            />
          </div>

          {/* Quick Search */}
          <div className="md:col-span-2">
            <M3TextField
              label="Cari Nama / NISN Siswa"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik nama atau NISN siswa..."
              leadingIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </M3Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <M3Card variant="elevated" className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-m3-on-surface-variant font-medium">Total Siswa</p>
            <p className="text-sm font-black text-m3-on-surface">{students.length} Siswa</p>
          </div>
        </M3Card>

        <M3Card variant="elevated" className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-800 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-m3-on-surface-variant font-medium">Mata Pelajaran</p>
            <p className="text-sm font-black text-m3-on-surface">{subjects.length} Mapel</p>
          </div>
        </M3Card>

        <M3Card variant="elevated" className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-m3-on-surface-variant font-medium">Rata-rata Kelas</p>
            <p className="text-sm font-black text-emerald-700">
              {classStats.overallAvg > 0 ? classStats.overallAvg : '-'}
            </p>
          </div>
        </M3Card>

        <M3Card variant="elevated" className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-m3-on-surface-variant font-medium">Peringkat 1</p>
            <p className="text-xs font-bold text-amber-900 truncate">
              {classStats.topStudent ? classStats.topStudent.student_name : '-'}
            </p>
          </div>
        </M3Card>
      </div>

      {/* Matrix Table Card */}
      <M3Card variant="elevated" className="overflow-hidden p-0">
        <div className="p-4 border-b border-m3-outline-variant/30 flex items-center justify-between bg-m3-surface-container/40">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-m3-primary" />
            <h3 className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
              Tabel Matriks Nilai Akhir Siswa
            </h3>
          </div>
          <span className="text-xs text-m3-on-surface-variant font-medium">
            Wali Kelas: <span className="font-bold text-m3-on-surface">{rombelDetail?.wali_kelas?.name || '-'}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-m3-surface-container/60 border-b border-m3-outline-variant/30 text-m3-on-surface font-bold">
                <th className="py-3.5 px-3 w-12 text-center">Rank</th>
                <th className="py-3.5 px-3 w-10 text-center">No</th>
                <th className="py-3.5 px-4 min-w-[200px]">Nama Peserta Didik</th>
                <th className="py-3.5 px-3 min-w-[100px]">NISN</th>
                {subjects.map((sub) => (
                  <th
                    key={sub.id}
                    className="py-3.5 px-2 min-w-[100px] text-center border-l border-m3-outline-variant/30"
                    title={`${sub.nama} (${sub.kelompok}) - Guru: ${sub.guru_name}`}
                  >
                    <div className="font-bold truncate max-w-[120px] mx-auto">{sub.nama}</div>
                    <div className="text-[10px] text-m3-on-surface-variant font-normal">
                      Avg: {sub.rata_kelas > 0 ? sub.rata_kelas : '-'}
                    </div>
                  </th>
                ))}
                <th className="py-3.5 px-3 w-24 text-center border-l border-m3-outline-variant/30 bg-emerald-50/60 text-emerald-950 font-black">
                  Rata-rata
                </th>
                <th className="py-3.5 px-3 w-16 text-center border-l border-m3-outline-variant/30">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant/20 bg-m3-surface">
              {loading ? (
                <tr>
                  <td colSpan={6 + subjects.length} className="py-12 text-center text-m3-on-surface-variant font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-m3-primary" />
                      <span>Memuat matriks rekap nilai rombel...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6 + subjects.length} className="py-10 text-center text-m3-on-surface-variant">
                    Tidak ada siswa ditemukan dalam rombel ini.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => (
                  <tr
                    key={st.student_id}
                    className="hover:bg-m3-surface-container/30 transition-colors group"
                  >
                    {/* Rank Badge */}
                    <td className="py-3.5 px-3 text-center">
                      {st.peringkat === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs shadow-xs">
                          🥇
                        </span>
                      ) : st.peringkat === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black text-xs">
                          🥈
                        </span>
                      ) : st.peringkat === 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-950 font-black text-xs">
                          🥉
                        </span>
                      ) : st.peringkat > 0 ? (
                        <span className="text-m3-on-surface-variant font-semibold text-xs">{st.peringkat}</span>
                      ) : (
                        <span className="text-m3-outline">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-center text-m3-outline font-medium">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-m3-on-surface truncate">
                      {st.student_name}
                    </td>
                    <td className="py-3.5 px-3 text-m3-on-surface-variant font-mono text-[11px]">{st.nisn || '-'}</td>

                    {/* Subject Grades */}
                    {subjects.map((sub) => {
                      const g = st.grades[sub.id];
                      const score = g?.nilai_akhir || 0;
                      return (
                        <td
                          key={sub.id}
                          className="py-2 px-2 text-center border-l border-m3-outline-variant/20 font-semibold"
                        >
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              score >= 85
                                ? 'text-emerald-900 bg-emerald-50 border border-emerald-200'
                                : score >= 75
                                ? 'text-blue-900 bg-blue-50 border border-blue-200'
                                : score > 0
                                ? 'text-amber-900 bg-amber-50 border border-amber-200'
                                : 'text-m3-outline'
                            }`}
                          >
                            {score > 0 ? score : '-'}
                          </span>
                        </td>
                      );
                    })}

                    {/* Rata-Rata Siswa */}
                    <td className="py-3.5 px-3 text-center border-l border-m3-outline-variant/30 bg-emerald-50/40">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                          st.rata_rata >= 85
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : st.rata_rata >= 75
                            ? 'bg-m3-primary-container text-m3-on-primary-container border border-m3-primary/20'
                            : st.rata_rata > 0
                            ? 'bg-amber-100 text-amber-950 border border-amber-300'
                            : 'bg-m3-surface-container text-m3-outline'
                        }`}
                      >
                        {st.rata_rata > 0 ? st.rata_rata : '-'}
                      </span>
                    </td>

                    {/* Action button */}
                    <td className="py-3.5 px-3 text-center border-l border-m3-outline-variant/20">
                      <button
                        onClick={() => setSelectedStudent(st)}
                        className="p-2 rounded-full hover:bg-m3-primary/10 text-m3-primary transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center mx-auto"
                        title="Lihat Rincian & Deskripsi Capaian"
                        aria-label={`Rincian capaian ${st.student_name}`}
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </M3Card>

      {/* Student Detail Dialog */}
      <M3Dialog
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={`Rincian Capaian: ${selectedStudent?.student_name || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-m3-surface-container text-xs text-m3-on-surface-variant flex items-center justify-between">
            <span>NISN: <strong className="text-m3-on-surface font-mono">{selectedStudent?.nisn || '-'}</strong></span>
            <span>Peringkat: <strong className="text-m3-on-surface">{selectedStudent?.peringkat || '-'}</strong></span>
            <span>Rata-rata: <strong className="text-emerald-700 font-bold">{selectedStudent?.rata_rata}</strong></span>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {selectedStudent &&
              subjects.map((sub) => {
                const g = selectedStudent.grades[sub.id];
                return (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-2xl bg-m3-surface border border-m3-outline-variant/30"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-m3-on-surface">{sub.nama}</span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-m3-primary-container text-m3-on-primary-container">
                        Nilai: {g?.nilai_akhir || '-'}
                      </span>
                    </div>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed italic">
                      "{g?.deskripsi_capaian || 'Belum ada deskripsi capaian kompetensi.'}"
                    </p>
                  </div>
                );
              })}
          </div>

          <div className="pt-3 border-t border-m3-outline-variant/30 flex justify-end">
            <M3Button variant="text" onClick={() => setSelectedStudent(null)}>
              Tutup
            </M3Button>
          </div>
        </div>
      </M3Dialog>
    </div>
  );
};
