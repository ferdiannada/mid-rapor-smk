import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Save,
  Wand2,
  BookOpen,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { masterService } from '../services/master.service';
import { gradeService } from '../services/grade.service';
import {
  Rombel,
  Subject,
  TeachingAssignment,
  LearningObjective,
  GradeSheetResponse,
} from '../types';
import { SearchableRombelSelect } from '../components/common/SearchableRombelSelect';
import { M3Button, M3Card, M3TextField } from '../components/m3';

interface LocalStudentGrade {
  student_id: string;
  student_name: string;
  nisn: string;
  nis?: string;
  grade_id?: string;
  tp_scores: Record<string, number>; // tp_id -> score
  nilai_akhir: number;
  deskripsi_capaian: string;
}

export const GradeInput: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Selection state
  const [rombels, setRombels] = useState<Rombel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);

  const [selectedRombelId, setSelectedRombelId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Data state
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [tps, setTps] = useState<LearningObjective[]>([]);
  const [studentsGrades, setStudentsGrades] = useState<LocalStudentGrade[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Load initial selections (Rombels, Subjects, Assignments)
  useEffect(() => {
    const fetchPrerequisites = async () => {
      try {
        setLoading(true);
        const [rombelRes, subRes] = await Promise.all([
          masterService.getRombels(),
          masterService.getSubjects(),
        ]);
        const activeRombels = (rombelRes.rombels || []).filter((r: Rombel) => (r.student_count || 0) > 0);
        setRombels(activeRombels);
        setSubjects(subRes.subjects || []);

        if (!isAdmin) {
          const assignRes = await masterService.getMyTeachingAssignments();
          const activeRombelIds = new Set(activeRombels.map((r: Rombel) => r.id));
          const myAssignments = (assignRes.assignments || []).filter((a: TeachingAssignment) =>
            activeRombelIds.has(a.rombel_id)
          );
          setAssignments(myAssignments);

          if (myAssignments.length > 0) {
            setSelectedRombelId(myAssignments[0].rombel_id);
            setSelectedSubjectId(myAssignments[0].subject_id);
          } else if (activeRombels.length > 0) {
            setSelectedRombelId(activeRombels[0].id);
          }
        } else {
          if (activeRombels.length > 0) {
            setSelectedRombelId(activeRombels[0].id);
          }
          if (subRes.subjects?.length > 0) {
            setSelectedSubjectId(subRes.subjects[0].id);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data rombel dan mata pelajaran');
      } finally {
        setLoading(false);
      }
    };

    fetchPrerequisites();
  }, [isAdmin]);

  // Available subjects filtered by rombel if teacher
  const availableSubjects = useMemo(() => {
    if (isAdmin) return subjects;
    if (!selectedRombelId) return [];
    const validSubjectIds = new Set(
      assignments.filter((a) => a.rombel_id === selectedRombelId).map((a) => a.subject_id)
    );
    return subjects.filter((s) => validSubjectIds.has(s.id));
  }, [isAdmin, assignments, subjects, selectedRombelId]);

  // Load Grade Sheet when rombel and subject change
  const fetchGradeSheet = async () => {
    if (!selectedRombelId || !selectedSubjectId) return;

    try {
      setLoading(true);
      setError(null);

      const res: GradeSheetResponse = await gradeService.getGradeSheet(
        selectedRombelId,
        selectedSubjectId
      );

      setTps(res.learning_objectives || []);

      const mapped: LocalStudentGrade[] = (res.students || []).map((st) => {
        const tpMap: Record<string, number> = {};
        st.tp_scores.forEach((item) => {
          tpMap[item.learning_objective_id] = item.nilai;
        });

        return {
          student_id: st.student_id,
          student_name: st.student_name,
          nisn: st.nisn,
          nis: st.nis,
          grade_id: st.grade_id,
          tp_scores: tpMap,
          nilai_akhir: st.nilai_akhir || 0,
          deskripsi_capaian: st.deskripsi_capaian || '',
        };
      });

      setStudentsGrades(mapped);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data penilaian');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGradeSheet();
  }, [selectedRombelId, selectedSubjectId]);

  // Helper to calculate student's final score in real-time
  const calculateStudentFinalScore = (scores: Record<string, number>): number => {
    const values = Object.values(scores).filter((v) => v > 0);
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    return Math.round((sum / values.length) * 100) / 100;
  };

  // Handle TP score input change
  const handleScoreChange = (studentId: string, tpId: string, valueStr: string) => {
    let val = parseFloat(valueStr);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 100) val = 100;

    setStudentsGrades((prev) =>
      prev.map((student) => {
        if (student.student_id !== studentId) return student;

        const newScores = {
          ...student.tp_scores,
          [tpId]: val,
        };

        const newFinal = calculateStudentFinalScore(newScores);

        return {
          ...student,
          tp_scores: newScores,
          nilai_akhir: newFinal,
        };
      })
    );
  };

  // Handle manual edit of description
  const handleDescriptionChange = (studentId: string, desc: string) => {
    setStudentsGrades((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, deskripsi_capaian: desc } : s))
    );
  };

  // Generate automated Kurikulum Merdeka descriptions
  const handleGenerateDescriptions = async () => {
    if (!selectedSubjectId || studentsGrades.length === 0 || tps.length === 0) return;

    try {
      setGenerating(true);
      setError(null);

      const payload = studentsGrades.map((s) => ({
        student_id: s.student_id,
        tp_scores: Object.entries(s.tp_scores).map(([tpId, score]) => ({
          learning_objective_id: tpId,
          nilai: score,
        })),
      }));

      const res = await gradeService.generateAutoDescriptions(selectedSubjectId, payload);

      const resultMap = new Map<string, { nilai_akhir: number; deskripsi_capaian: string }>();
      res.results.forEach((r) => resultMap.set(r.student_id, r));

      setStudentsGrades((prev) =>
        prev.map((student) => {
          const item = resultMap.get(student.student_id);
          if (item) {
            return {
              ...student,
              nilai_akhir: item.nilai_akhir,
              deskripsi_capaian: item.deskripsi_capaian,
            };
          }
          return student;
        })
      );

      setSuccessMessage('Deskripsi capaian kompetensi berhasil dibuat secara otomatis!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Gagal membuat deskripsi capaian otomatis');
    } finally {
      setGenerating(false);
    }
  };

  // Save all grades
  const handleSaveGrades = async () => {
    if (!selectedRombelId || !selectedSubjectId || studentsGrades.length === 0) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload = {
        rombel_id: selectedRombelId,
        subject_id: selectedSubjectId,
        grades: studentsGrades.map((s) => ({
          student_id: s.student_id,
          nilai_akhir: s.nilai_akhir,
          deskripsi_capaian: s.deskripsi_capaian,
          tp_scores: Object.entries(s.tp_scores).map(([tpId, score]) => ({
            learning_objective_id: tpId,
            nilai: score,
          })),
        })),
      };

      const res = await gradeService.batchSaveGrades(payload);
      setSuccessMessage(`Berhasil menyimpan nilai ${res.saved_count} siswa!`);
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchGradeSheet();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan nilai');
    } finally {
      setSaving(false);
    }
  };

  // Class KPI calculations
  const classStats = useMemo(() => {
    const validAverages = studentsGrades
      .map((s) => s.nilai_akhir)
      .filter((v) => v > 0);

    if (validAverages.length === 0) {
      return { avg: 0, max: 0, min: 0, completedCount: 0 };
    }

    const sum = validAverages.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round((sum / validAverages.length) * 100) / 100,
      max: Math.max(...validAverages),
      min: Math.min(...validAverages),
      completedCount: validAverages.length,
    };
  }, [studentsGrades]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentsGrades;
    const q = searchQuery.toLowerCase();
    return studentsGrades.filter(
      (s) => s.student_name.toLowerCase().includes(q) || s.nisn?.includes(q)
    );
  }, [studentsGrades, searchQuery]);

  if (isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-m3-surface rounded-3xl border border-m3-outline-variant/30 mt-8">
        <div className="w-12 h-12 rounded-2xl bg-m3-primary-container text-m3-primary flex items-center justify-center mx-auto">
          <Award className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-m3-on-surface">Fitur Khusus Guru Pengampu</h2>
        <p className="text-xs text-m3-on-surface-variant leading-relaxed">
          Input nilai formatif dan sumatif per Tujuan Pembelajaran dilakukan langsung oleh Guru mata pelajaran terkait. Administrator dapat memantau hasil pengisian nilai melalui menu Rekap Nilai Siswa atau Cetak Rapor.
        </p>
        <div className="pt-2">
          <Link to="/grades/recap">
            <M3Button variant="filled">Buka Rekap Nilai Siswa</M3Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-m3-on-surface">
              Input Nilai Mata Pelajaran
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-m3-secondary-container text-m3-on-secondary-container border border-m3-secondary/20">
              Kurikulum Merdeka • Asesmen STS/SAS
            </span>
          </div>
          <p className="text-sm text-m3-on-surface-variant mt-1">
            Penilaian formatif & sumatif per Tujuan Pembelajaran (TP) serta deskripsi capaian kompetensi rapor.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <M3Button
            variant="tonal"
            onClick={handleGenerateDescriptions}
            disabled={generating || loading || tps.length === 0}
            icon={<Wand2 className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />}
            title="Generate deskripsi otomatis berdasarkan nilai TP tertinggi dan terendah"
          >
            {generating ? 'Menghasilkan...' : 'Auto Deskripsi Capaian'}
          </M3Button>

          <M3Button
            variant="filled"
            onClick={handleSaveGrades}
            disabled={saving || loading || studentsGrades.length === 0}
            icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {saving ? 'Menyimpan...' : 'Simpan Semua Nilai'}
          </M3Button>
        </div>
      </div>

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

      {/* Control Selection Card */}
      <M3Card variant="filled" className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* Searchable Rombel Selector */}
          <div>
            <SearchableRombelSelect
              label="Rombongan Belajar (Kelas)"
              rombels={rombels}
              selectedRombelId={selectedRombelId}
              onSelect={(id) => setSelectedRombelId(id)}
              filterEmpty={true}
            />
          </div>

          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline text-xs sm:text-sm font-semibold text-m3-on-surface focus:outline-none focus:border-m3-primary min-h-[44px]"
            >
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama} ({s.kelompok})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search */}
          <div className="lg:col-span-2">
            <M3TextField
              label="Cari Nama / NISN Siswa"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik nama siswa untuk menyaring..."
              leadingIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </M3Card>

      {/* Warning if no TPs exist */}
      {!loading && tps.length === 0 && (
        <div className="p-6 rounded-3xl bg-amber-50/80 border border-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Tujuan Pembelajaran (TP) Belum Dikonfigurasi
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Mata pelajaran ini belum memiliki Tujuan Pembelajaran. Tambahkan TP terlebih dahulu untuk menginput nilai formatif/sumatif.
              </p>
            </div>
          </div>
          {isAdmin && (
            <Link to="/settings/subjects">
              <M3Button variant="tonal" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                Kelola TP Sekarang
              </M3Button>
            </Link>
          )}
        </div>
      )}

      {/* KPI Stats Bar */}
      {tps.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <M3Card variant="elevated" className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">Siswa Dinilai</p>
              <p className="text-sm font-black text-m3-on-surface">
                {classStats.completedCount} / {studentsGrades.length}
              </p>
            </div>
          </M3Card>

          <M3Card variant="elevated" className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">Rata-rata Kelas</p>
              <p className="text-sm font-black text-emerald-700">
                {classStats.avg > 0 ? classStats.avg : '-'}
              </p>
            </div>
          </M3Card>

          <M3Card variant="elevated" className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-m3-primary-container flex items-center justify-center text-m3-primary shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">Nilai Tertinggi</p>
              <p className="text-sm font-black text-m3-primary">
                {classStats.max > 0 ? classStats.max : '-'}
              </p>
            </div>
          </M3Card>

          <M3Card variant="elevated" className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">Jumlah TP</p>
              <p className="text-sm font-black text-m3-on-surface">{tps.length} TP</p>
            </div>
          </M3Card>
        </div>
      )}

      {/* Main Grade Input Table */}
      <M3Card variant="elevated" className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-m3-surface-container/60 border-b border-m3-outline-variant/30 text-m3-on-surface font-bold">
                <th className="py-3.5 px-3 w-12 text-center">No</th>
                <th className="py-3.5 px-4 min-w-[200px]">Nama Peserta Didik</th>
                {tps.map((tp) => (
                  <th
                    key={tp.id}
                    className="py-3.5 px-2 min-w-[90px] text-center border-l border-m3-outline-variant/30 relative group cursor-pointer"
                    onMouseEnter={() => setActiveTooltip(tp.id)}
                    onMouseLeave={() => setActiveTooltip(null)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{tp.kode_tp}</span>
                      <HelpCircle className="w-3.5 h-3.5 text-m3-outline group-hover:text-m3-primary" />
                    </div>

                    {/* Tooltip */}
                    {activeTooltip === tp.id && (
                      <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-64 p-3 rounded-2xl bg-m3-inverse-surface text-m3-inverse-on-surface text-[11px] leading-relaxed shadow-m3-elevation-3 text-left pointer-events-none">
                        <p className="font-bold text-amber-300">{tp.kode_tp}</p>
                        <p className="mt-0.5">{tp.deskripsi}</p>
                      </div>
                    )}
                  </th>
                ))}
                <th className="py-3.5 px-3 w-24 text-center border-l border-m3-outline-variant/30">Nilai Akhir</th>
                <th className="py-3.5 px-4 min-w-[320px] border-l border-m3-outline-variant/30">
                  Deskripsi Capaian Kompetensi (Kurikulum Merdeka)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant/20 bg-m3-surface">
              {loading ? (
                <tr>
                  <td colSpan={4 + tps.length} className="py-12 text-center text-m3-on-surface-variant font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-m3-primary" />
                      <span>Memuat data penilaian rombel...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4 + tps.length} className="py-10 text-center text-m3-on-surface-variant">
                    Tidak ada siswa ditemukan di rombel ini.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => (
                  <tr
                    key={st.student_id}
                    className="hover:bg-m3-surface-container/30 transition-colors group"
                  >
                    <td className="py-3.5 px-3 text-center text-m3-outline font-medium">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-m3-on-surface truncate">{st.student_name}</p>
                      <p className="text-[10px] text-m3-outline font-mono">NISN: {st.nisn || '-'}</p>
                    </td>

                    {/* TP Score Inputs */}
                    {tps.map((tp) => (
                      <td key={tp.id} className="py-2 px-2 text-center border-l border-m3-outline-variant/20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={st.tp_scores[tp.id] > 0 ? st.tp_scores[tp.id] : ''}
                          onChange={(e) => handleScoreChange(st.student_id, tp.id, e.target.value)}
                          placeholder="0"
                          className="w-16 px-2 py-2 text-center font-bold text-xs rounded-xl border border-m3-outline bg-m3-surface focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary transition-all text-m3-on-surface min-h-[36px]"
                        />
                      </td>
                    ))}

                    {/* Auto Nilai Akhir */}
                    <td className="py-3.5 px-3 text-center border-l border-m3-outline-variant/20">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                          st.nilai_akhir >= 85
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : st.nilai_akhir >= 75
                            ? 'bg-m3-primary-container text-m3-on-primary-container border border-m3-primary/20'
                            : st.nilai_akhir > 0
                            ? 'bg-amber-100 text-amber-950 border border-amber-300'
                            : 'bg-m3-surface-container text-m3-outline'
                        }`}
                      >
                        {st.nilai_akhir > 0 ? st.nilai_akhir : '-'}
                      </span>
                    </td>

                    {/* Deskripsi Capaian Textarea */}
                    <td className="py-2 px-3 border-l border-m3-outline-variant/20">
                      <textarea
                        rows={2}
                        value={st.deskripsi_capaian}
                        onChange={(e) => handleDescriptionChange(st.student_id, e.target.value)}
                        placeholder="Deskripsi capaian kompetensi siswa (isi manual atau gunakan tombol Auto Deskripsi)..."
                        className="w-full px-3 py-2 text-xs leading-relaxed rounded-xl border border-m3-outline bg-m3-surface focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary text-m3-on-surface"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </M3Card>
    </div>
  );
};
