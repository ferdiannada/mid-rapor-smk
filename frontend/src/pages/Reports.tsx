import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Download,
  Archive,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Eye,
  FileText,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { masterService } from '../services/master.service';
import { reportService } from '../services/report.service';
import {
  Rombel,
  Student,
  StudentReportData,
  GradeProgressItem,
} from '../types';
import { SearchableRombelSelect } from '../components/common/SearchableRombelSelect';
import { M3Button, M3Card, M3TextField, M3Dialog } from '../components/m3';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isWaliKelas = !!user?.wali_kelas_rombel;

  // Selection states
  const [rombels, setRombels] = useState<Rombel[]>([]);
  const [selectedRombelId, setSelectedRombelId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Report Preview Data
  const [reportData, setReportData] = useState<StudentReportData | null>(null);

  // Grade Progress Data
  const [progressList, setProgressList] = useState<GradeProgressItem[]>([]);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState<string>('');

  // 1. Load Rombels on mount
  useEffect(() => {
    const fetchRombels = async () => {
      try {
        setLoading(true);
        const res = await masterService.getRombels();
        const list = (res.rombels || []).filter(
          (r: Rombel) => (r.student_count || 0) > 0
        );
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

  // 2. Load Students when Rombel changes
  useEffect(() => {
    if (!selectedRombelId) return;

    const fetchStudents = async () => {
      try {
        setLoading(true);
        const res = await masterService.getRombelStudents(selectedRombelId);
        const stList = res.students || [];
        setStudents(stList);

        if (stList.length > 0) {
          setSelectedStudentId(stList[0].id);
        } else {
          setSelectedStudentId('');
          setReportData(null);
        }
      } catch (err: any) {
        setError(err.message || 'Gagal memuat siswa rombel');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [selectedRombelId]);

  // 3. Load Student Report Preview when Student changes
  useEffect(() => {
    if (!selectedStudentId) {
      setReportData(null);
      return;
    }

    const fetchReport = async () => {
      try {
        setLoadingReport(true);
        setError(null);
        const res = await reportService.getStudentReportPreview(selectedStudentId);
        setReportData(res.report);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat preview rapor');
      } finally {
        setLoadingReport(false);
      }
    };

    fetchReport();
  }, [selectedStudentId]);

  // 4. Load Grade Progress for monitoring
  const fetchProgress = async () => {
    try {
      const res = await reportService.getGradeProgress();
      setProgressList(res.progress || []);
    } catch (err) {
      console.error('Failed to load grade progress', err);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [selectedRombelId]);

  // Handle single PDF download
  const handleDownloadPDF = async () => {
    if (!reportData) return;
    try {
      setDownloadingPdf(true);
      setError(null);
      await reportService.downloadStudentPDF(
        reportData.student.id,
        reportData.student.name,
        reportData.student.nisn
      );
      setSuccessMessage('File PDF rapor berhasil diunduh!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Gagal mengunduh file PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Handle batch ZIP download
  const handleDownloadZip = async () => {
    const currentRombel = rombels.find((r) => r.id === selectedRombelId);
    const rombelName = currentRombel?.name || 'Kelas';

    try {
      setDownloadingZip(true);
      setError(null);
      await reportService.downloadRombelZip(selectedRombelId, rombelName);
      setSuccessMessage('Arsip ZIP seluruh rapor siswa berhasil diunduh!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Gagal mengunduh file ZIP');
    } finally {
      setDownloadingZip(false);
    }
  };

  // Direct print via browser
  const handlePrint = () => {
    window.print();
  };

  // Filter students for sidebar
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nisn?.includes(q)
    );
  }, [students, studentSearch]);

  // Current rombel progress stats
  const rombelProgress = useMemo(() => {
    const currentItems = progressList.filter(
      (p) => p.rombel_id === selectedRombelId
    );
    if (currentItems.length === 0)
      return { totalMapel: 0, completedMapel: 0, percent: 0 };

    const totalMapel = currentItems.length;
    const completedMapel = currentItems.filter((p) => p.is_complete).length;
    const percent = Math.round((completedMapel / totalMapel) * 100);

    return { totalMapel, completedMapel, percent };
  }, [progressList, selectedRombelId]);

  // Grouped Grades for Kurikulum Merdeka Report Table
  const groupedGrades = useMemo(() => {
    if (!reportData) return [];
    if (reportData.grouped_grades && reportData.grouped_grades.length > 0) {
      return reportData.grouped_grades;
    }
    if (!reportData.grades || reportData.grades.length === 0) return [];

    const groupOrder = ['A', 'B', 'C', 'Muatan Lokal'];
    const titleMap: Record<string, string> = {
      A: 'A. Kelompok Mata Pelajaran Umum',
      B: 'B. Kelompok Mata Pelajaran Kejuruan',
      C: 'C. Kelompok Konsentrasi Keahlian',
      'Muatan Lokal': 'Muatan Lokal',
    };

    const map = new Map<string, typeof reportData.grades>();
    for (const g of reportData.grades) {
      const k = (g.kelompok || 'A').trim();
      const matchedKey =
        groupOrder.find((item) => item.toLowerCase() === k.toLowerCase()) || k;
      if (!map.has(matchedKey)) {
        map.set(matchedKey, []);
      }
      map.get(matchedKey)!.push(g);
    }

    const result: {
      kode_kelompok: string;
      nama_kelompok: string;
      grades: typeof reportData.grades;
    }[] = [];
    const processedKeys = new Set<string>();

    for (const key of groupOrder) {
      if (map.has(key)) {
        result.push({
          kode_kelompok: key,
          nama_kelompok: titleMap[key] || `Kelompok ${key}`,
          grades: map.get(key)!,
        });
        processedKeys.add(key);
      }
    }

    for (const [key, grades] of map.entries()) {
      if (!processedKeys.has(key)) {
        result.push({
          kode_kelompok: key,
          nama_kelompok:
            key === 'Lainnya' ? 'Mata Pelajaran Lainnya' : `Kelompok ${key}`,
          grades,
        });
      }
    }

    return result;
  }, [reportData]);

  return (
    <div className="space-y-6 max-w-full pb-16 print:p-0 print:m-0">
      {/* Print CSS styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          nav, aside, header, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          .rapor-paper {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Header (Hidden on Print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-m3-on-surface">
              Cetak Rapor Tengah Semester
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-950 border border-emerald-300">
              Kurikulum Merdeka • A4 Print Ready
            </span>
          </div>
          <p className="text-sm text-m3-on-surface-variant mt-1">
            Pratinjau digital, cetak langsung via peramban, atau ekspor dokumen PDF & arsip ZIP.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <M3Button
            variant="tonal"
            size="sm"
            onClick={() => setShowProgressModal(true)}
            icon={<BarChart3 className="w-4 h-4 text-m3-primary" />}
          >
            <span>Progres Nilai ({rombelProgress.percent}%)</span>
          </M3Button>

          <M3Button
            variant="outlined"
            size="sm"
            onClick={handleDownloadZip}
            disabled={downloadingZip || students.length === 0}
            icon={downloadingZip ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
          >
            {downloadingZip ? 'Mengemas ZIP...' : 'Download ZIP Rombel'}
          </M3Button>

          <M3Button
            variant="outlined"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={downloadingPdf || !reportData}
            icon={downloadingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          >
            {downloadingPdf ? 'Merender...' : 'Download PDF'}
          </M3Button>

          <M3Button
            variant="filled"
            size="sm"
            onClick={handlePrint}
            disabled={!reportData}
            icon={<Printer className="w-4 h-4" />}
          >
            Cetak Rapor
          </M3Button>
        </div>
      </div>

      {/* Alerts (Hidden on Print) */}
      {error && (
        <div
          role="alert"
          className="no-print p-4 rounded-2xl bg-m3-error-container text-m3-on-error-container border border-m3-error/20 text-xs flex items-center justify-between animate-fadeIn"
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
          className="no-print p-4 rounded-2xl bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs flex items-center justify-between animate-fadeIn"
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

      {/* Top Filter Bar (Hidden on Print) */}
      <M3Card variant="filled" className="no-print p-5">
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

          {/* Quick Rombel Progress summary */}
          <div className="md:col-span-2 flex items-center justify-between p-3.5 rounded-2xl bg-m3-surface border border-m3-outline-variant/30 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-m3-primary-container flex items-center justify-center text-m3-primary shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-m3-on-surface">
                  Status Pengisian Nilai Kelas: {rombelProgress.completedMapel} dari {rombelProgress.totalMapel} Mapel
                </p>
                <div className="w-48 bg-m3-surface-container-high h-2 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-m3-primary h-full rounded-full transition-all"
                    style={{ width: `${rombelProgress.percent}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                rombelProgress.percent === 100
                  ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                  : 'bg-amber-100 text-amber-950 border border-amber-300'
              }`}
            >
              {rombelProgress.percent === 100
                ? 'Lengkap 100%'
                : `${rombelProgress.percent}% Selesai`}
            </span>
          </div>
        </div>
      </M3Card>

      {/* Main Content Layout: Sidebar Siswa + Paper Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Student Selector List (Hidden on Print) */}
        <div className="no-print lg:col-span-4 space-y-3">
          <M3Card variant="elevated" className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
                Daftar Peserta Didik ({students.length})
              </span>
            </div>

            <M3TextField
              placeholder="Cari siswa..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              leadingIcon={<Search className="w-3.5 h-3.5" />}
            />

            <div className="max-h-[620px] overflow-y-auto space-y-1.5 pr-1">
              {!filteredStudents || filteredStudents.length === 0 ? (
                <p className="text-xs text-m3-outline text-center py-6">
                  Tidak ada siswa ditemukan.
                </p>
              ) : (
                filteredStudents.map((st, idx) => (
                  <button
                    key={st.id}
                    onClick={() => setSelectedStudentId(st.id)}
                    className={`w-full text-left p-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer min-h-[44px] ${
                      selectedStudentId === st.id
                        ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs font-bold'
                        : 'hover:bg-m3-surface-container text-m3-on-surface'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold truncate">
                        {idx + 1}. {st.name}
                      </p>
                      <p className="text-[10px] text-m3-outline font-mono">
                        NISN: {st.nisn || '-'}
                      </p>
                    </div>
                    <Eye className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  </button>
                ))
              )}
            </div>
          </M3Card>
        </div>

        {/* Right: Digital A4 Paper Preview */}
        <div className="lg:col-span-8 flex justify-center w-full min-w-0">
          {loadingReport ? (
            <M3Card variant="elevated" className="w-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-m3-primary mb-3" />
              <p className="text-xs font-semibold text-m3-on-surface-variant">
                Menyiapkan pratinjau rapor siswa...
              </p>
            </M3Card>
          ) : !reportData ? (
            <M3Card variant="elevated" className="w-full min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
              <FileText className="w-12 h-12 text-m3-outline mb-3" />
              <p className="text-sm font-bold text-m3-on-surface">
                Pilih Siswa untuk Melihat Rapor
              </p>
              <p className="text-xs text-m3-on-surface-variant mt-1">
                Silakan pilih salah satu siswa dari daftar di samping kiri untuk memuat pratinjau dokumen rapor.
              </p>
            </M3Card>
          ) : (
            <div className="w-full overflow-x-auto pb-4">
              <div className="rapor-paper min-w-[620px] max-w-[800px] bg-white text-black p-4 sm:p-8 md:p-12 rounded-3xl shadow-m3-elevation-2 border border-slate-200 font-serif leading-relaxed text-sm mx-auto">
                {/* Kop Surat Sekolah */}
                <div className="border-b-4 border-double border-black pb-3 mb-5">
                  <div className="flex items-center justify-between gap-3">
                    {reportData.logo_kiri ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                        <img
                          src={reportData.logo_kiri}
                          alt="Logo Sekolah"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : null}

                    <div className="flex-1 text-center min-w-0">
                      {reportData.kop_baris_1 && (
                        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider m-0 leading-tight">
                          {reportData.kop_baris_1}
                        </h3>
                      )}
                      {reportData.kop_baris_2 && (
                        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider m-0 leading-tight">
                          {reportData.kop_baris_2}
                        </h3>
                      )}
                      {reportData.kop_baris_3 && (
                        <h4 className="text-[11px] font-bold uppercase tracking-wider m-0 text-slate-800 leading-tight">
                          {reportData.kop_baris_3}
                        </h4>
                      )}
                      <h1 className="text-base sm:text-lg font-black uppercase m-0.5 tracking-wide text-black leading-tight">
                        {reportData.sekolah_nama}
                      </h1>
                      <p className="text-[10.5px] italic text-slate-700 m-0 leading-tight">
                        {reportData.sekolah_alamat}
                        {reportData.sekolah_kecamatan ? `, Kec. ${reportData.sekolah_kecamatan}` : ''}
                        {reportData.sekolah_kabupaten ? `, ${reportData.sekolah_kabupaten}` : ''}
                        {reportData.sekolah_kode_pos ? ` ${reportData.sekolah_kode_pos}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-600 m-0 leading-tight">
                        {reportData.sekolah_telepon ? `Telp: ${reportData.sekolah_telepon} ` : ''}
                        {reportData.sekolah_email ? `• Email: ${reportData.sekolah_email} ` : ''}
                        {reportData.sekolah_website ? `• Web: ${reportData.sekolah_website} ` : ''}
                        • NPSN: {reportData.sekolah_npsn}
                        {reportData.sekolah_nss ? ` • NSS: ${reportData.sekolah_nss}` : ''}
                      </p>
                    </div>

                    {reportData.logo_kanan ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                        <img
                          src={reportData.logo_kanan}
                          alt="Logo Pemda"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : reportData.logo_kiri ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 pointer-events-none opacity-0" aria-hidden="true" />
                    ) : null}
                  </div>
                </div>

                {/* Judul Dokumen */}
                <div className="text-center mb-5">
                  <h2 className="text-sm font-bold uppercase underline m-0">
                    {reportData.jenis_rapor}
                  </h2>
                  <p className="text-xs font-bold uppercase text-slate-700 m-0">
                    Kurikulum Merdeka • Tahun Ajaran {reportData.tahun_ajaran}
                  </p>
                </div>

                {/* Identitas Siswa */}
                <table className="w-full text-xs mb-5 border-collapse">
                  <tbody>
                    <tr>
                      <td className="w-[18%] py-0.5">Nama Peserta Didik</td>
                      <td className="w-[2%] py-0.5">:</td>
                      <td className="w-[40%] font-bold py-0.5">
                        {reportData.student.name}
                      </td>
                      <td className="w-[18%] py-0.5">Kelas / Fase</td>
                      <td className="w-[2%] py-0.5">:</td>
                      <td className="w-[20%] font-bold py-0.5">
                        {reportData.kelas} / {reportData.fase}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5">NISN / NIS</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5">
                        {reportData.student.nisn} / {reportData.student.nis || '-'}
                      </td>
                      <td className="py-0.5">Semester</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5">{reportData.semester}</td>
                    </tr>
                  </tbody>
                </table>

                {/* A. Nilai Mata Pelajaran */}
                <div className="font-bold text-xs uppercase mb-1.5">
                  A. Capaian Hasil Belajar Mata Pelajaran
                </div>
                <table className="w-full text-xs border border-black border-collapse mb-5">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-black p-1.5 w-8 text-center">
                        No
                      </th>
                      <th className="border border-black p-1.5 text-left w-56">
                        Mata Pelajaran
                      </th>
                      <th className="border border-black p-1.5 w-16 text-center">
                        Nilai Akhir
                      </th>
                      <th className="border border-black p-1.5 text-left">
                        Capaian Kompetensi Tengah Semester
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedGrades.length > 0 ? (
                      groupedGrades.map((group) => (
                        <React.Fragment key={group.kode_kelompok}>
                          <tr className="bg-slate-100 font-bold print:bg-slate-100">
                            <td
                              colSpan={4}
                              className="border border-black px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-800"
                            >
                              {group.nama_kelompok}
                            </td>
                          </tr>
                          {group.grades.map((g) => (
                            <tr key={g.subject_id}>
                              <td className="border border-black p-1.5 text-center">
                                {g.no}
                              </td>
                              <td className="border border-black p-1.5">
                                <p className="font-bold m-0">
                                  {g.subject_nama}
                                </p>
                                {g.guru_nama && (
                                  <p className="text-[10px] text-slate-600 m-0">
                                    Pengampu: {g.guru_nama}
                                  </p>
                                )}
                              </td>
                              <td className="border border-black p-1.5 text-center font-bold">
                                {g.nilai_akhir > 0 ? g.nilai_akhir : '-'}
                              </td>
                              <td className="border border-black p-1.5 text-justify text-[11px] leading-relaxed">
                                {g.deskripsi_capaian}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="border border-black p-4 text-center text-slate-500 italic"
                        >
                          Belum ada data mata pelajaran atau nilai pada semester ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* B. Ekstrakurikuler */}
                <div className="font-bold text-xs uppercase mb-1.5">
                  B. Kegiatan Ekstrakurikuler
                </div>
                <table className="w-full text-xs border border-black border-collapse mb-5">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-black p-1.5 w-8 text-center">
                        No
                      </th>
                      <th className="border border-black p-1.5 text-left w-56">
                        Kegiatan Ekstrakurikuler
                      </th>
                      <th className="border border-black p-1.5 w-24 text-center">
                        Predikat
                      </th>
                      <th className="border border-black p-1.5 text-left">
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.extracurricular &&
                    reportData.extracurricular.length > 0 ? (
                      reportData.extracurricular.map((ek, i) => (
                        <tr key={ek.id}>
                          <td className="border border-black p-1.5 text-center">
                            {i + 1}
                          </td>
                          <td className="border border-black p-1.5 font-bold">
                            {ek.nama_ekskul}
                          </td>
                          <td className="border border-black p-1.5 text-center font-bold">
                            {ek.predikat}
                          </td>
                          <td className="border border-black p-1.5">
                            {ek.keterangan || '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="border border-black p-1.5 text-center">
                          1
                        </td>
                        <td className="border border-black p-1.5 text-center">
                          -
                        </td>
                        <td className="border border-black p-1.5 text-center">
                          -
                        </td>
                        <td className="border border-black p-1.5 text-center">
                          -
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* C & D: Presensi & Catatan */}
                <div className="grid grid-cols-12 gap-4 mb-8">
                  {/* Presensi */}
                  <div className="col-span-5">
                    <div className="font-bold text-xs uppercase mb-1.5">
                      C. Ketidakhadiran
                    </div>
                    <table className="w-full text-xs border border-black border-collapse">
                      <tbody>
                        <tr>
                          <td className="border border-black p-1.5 w-[65%]">
                            Sakit
                          </td>
                          <td className="border border-black p-1.5 text-center font-bold">
                            {reportData.attendance ? reportData.attendance.sakit : 0} hari
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black p-1.5">Izin</td>
                          <td className="border border-black p-1.5 text-center font-bold">
                            {reportData.attendance ? reportData.attendance.izin : 0} hari
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black p-1.5">
                            Tanpa Keterangan
                          </td>
                          <td className="border border-black p-1.5 text-center font-bold">
                            {reportData.attendance ? reportData.attendance.tanpa_keterangan : 0} hari
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Catatan Wali Kelas */}
                  <div className="col-span-7">
                    <div className="font-bold text-xs uppercase mb-1.5">
                      D. Catatan Wali Kelas
                    </div>
                    <table className="w-full text-xs border border-black border-collapse h-[86px]">
                      <tbody>
                        <tr>
                          <td className="border border-black p-2 italic text-justify text-[11px] align-top">
                            {reportData.wali_note?.catatan
                              ? `"${reportData.wali_note.catatan}"`
                              : '"Tingkatkan kedisiplinan dan semangat belajar dalam mencapai kompetensi yang diharapkan."'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Kolom Tanda Tangan 3 Pihak */}
                <div className="grid grid-cols-3 text-center text-xs pt-4 gap-2">
                  <div>
                    <p className="m-0">Mengetahui,</p>
                    <p className="m-0">Orang Tua / Wali Siswa</p>
                    <div className="h-16"></div>
                    <p className="font-bold underline m-0">
                      ................................................
                    </p>
                  </div>

                  <div>
                    <p className="m-0">&nbsp;</p>
                    <p className="m-0">Kepala Sekolah</p>
                    <div className="h-16"></div>
                    <p className="font-bold underline m-0">
                      {reportData.kepsek_nama}
                    </p>
                    <p className="text-[10px] text-slate-700 m-0">
                      NIP. {reportData.kepsek_nip}
                    </p>
                  </div>

                  <div>
                    <p className="m-0">
                      {reportData.kota_sekolah}, {reportData.tanggal_cetak}
                    </p>
                    <p className="m-0">Wali Kelas</p>
                    <div className="h-16"></div>
                    <p className="font-bold underline m-0">
                      {reportData.wali_kelas_nama}
                    </p>
                    <p className="text-[10px] text-slate-700 m-0">
                      NIP. {reportData.wali_kelas_nip}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Monitoring Dialog */}
      <M3Dialog
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="Monitoring Progres Penilaian Mata Pelajaran"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {!progressList || progressList.length === 0 ? (
              <p className="text-center text-m3-outline py-6 text-xs">
                Belum ada data penugasan mapel.
              </p>
            ) : (
              progressList.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-m3-surface border border-m3-outline-variant/30 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-xs text-m3-on-surface">
                      {item.subject_name} ({item.rombel_name})
                    </p>
                    <p className="text-[11px] text-m3-on-surface-variant">
                      Guru: {item.guru_name}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1 justify-end">
                      <span className="text-xs font-bold text-m3-on-surface">
                        {item.graded_students} / {item.total_students} Siswa
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.is_complete
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : 'bg-amber-100 text-amber-950 border border-amber-300'
                        }`}
                      >
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="w-32 bg-m3-surface-container-high h-2 rounded-full overflow-hidden ml-auto">
                      <div
                        className={`h-full rounded-full ${
                          item.is_complete ? 'bg-emerald-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-m3-outline-variant/30 flex justify-end">
            <M3Button variant="text" onClick={() => setShowProgressModal(false)}>
              Tutup
            </M3Button>
          </div>
        </div>
      </M3Dialog>
    </div>
  );
};
