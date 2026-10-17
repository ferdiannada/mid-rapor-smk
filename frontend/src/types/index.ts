export type UserRole = 'admin' | 'guru';

export interface RombelInfo {
  id: string;
  name: string;
  tingkat: number;
  wali_kelas_id?: string;
  student_count?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  nip_nik?: string;
  phone?: string;
  dapodik_id?: string;
  is_initial_password: boolean;
  avatar_url?: string;
  wali_kelas_rombel?: RombelInfo | null;
  is_manual_override?: boolean;
  is_active?: boolean;
}

export interface TeacherItem extends User {
  assignment_count: number;
  wali_rombel?: Rombel | null;
  wali_rombels?: Rombel[];
}

export interface Rombel {
  id: string;
  name: string;
  tingkat: number;
  wali_kelas_id?: string;
  wali_kelas?: User;
  student_count?: number;
  is_manual_override?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  name: string;
  nisn: string;
  nis?: string;
  rombel_id: string;
  rombel?: Rombel;
  jenis_kelamin: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  dapodik_id?: string;
  is_manual_override?: boolean;
  is_active?: boolean;
  created_at?: string;
}

export interface Subject {
  id: string;
  dapodik_mapel_id?: number;
  nama: string;
  kelompok: string;
  learning_objective_count?: number;
  is_manual_override?: boolean;
  created_at?: string;
}

export interface TeachingAssignment {
  id: string;
  guru_id: string;
  guru?: User;
  subject_id: string;
  subject?: Subject;
  rombel_id: string;
  rombel?: Rombel;
  semester_id?: string;
  jam_per_minggu: number;
  is_manual_override?: boolean;
  created_at?: string;
}

export interface LearningObjective {
  id: string;
  subject_id: string;
  subject?: Subject;
  kode_tp: string;
  deskripsi: string;
  urutan: number;
  created_at?: string;
  updated_at?: string;
}

export interface Semester {
  id: string;
  tahun_ajaran: string;
  semester: number; // 1 = Ganjil, 2 = Genap
  jenis_rapor: string; // 'mid' | 'akhir'
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardStats {
  total_teachers: number;
  total_students: number;
  total_rombels: number;
  total_subjects: number;
  active_semester?: Semester | null;
  my_assignments: number;
  my_student_reach: number;
}

export interface DapodikConfig {
  id: string;
  name: string;
  dapodik_host: string;
  dapodik_port: number;
  masked_token?: string;
  has_token?: boolean;
  npsn: string;
  timeout_seconds: number;
  is_active: boolean;
  updated_at?: string;
  updated_by?: string;
}

export interface TestConnectionResult {
  status: 'success' | 'failed';
  server: string;
  latency_ms: number;
  message: string;
  error?: string;
}

export interface SyncCategoryStat {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface SyncSummary {
  status: 'success' | 'error';
  duration_ms: number;
  mock_data_detected: boolean;
  summary: {
    gtk: SyncCategoryStat;
    rombel: SyncCategoryStat;
    siswa: SyncCategoryStat;
    mapel: SyncCategoryStat;
    penugasan: SyncCategoryStat;
  };
  details: string[];
  message?: string;
}

export interface SyncOptions {
  sync_gtk: boolean;
  sync_rombel: boolean;
  sync_siswa: boolean;
  sync_pembelajaran: boolean;
  dry_run: boolean;
}

// ==================== Phase 3 Types ====================

export interface TPScore {
  learning_objective_id: string;
  kode_tp: string;
  nilai: number;
}

export interface StudentGrade {
  student_id: string;
  student_name: string;
  nisn: string;
  nis?: string;
  grade_id?: string;
  nilai_akhir: number;
  deskripsi_capaian: string;
  tp_scores: TPScore[];
}

export interface GradeSheetResponse {
  status: string;
  semester: Semester;
  rombel: Rombel;
  subject: Subject;
  learning_objectives: LearningObjective[];
  students: StudentGrade[];
}

export interface BatchSaveGradesPayload {
  rombel_id: string;
  subject_id: string;
  semester_id?: string;
  grades: {
    student_id: string;
    tp_scores: { learning_objective_id: string; nilai: number }[];
    nilai_akhir?: number;
    deskripsi_capaian?: string;
  }[];
}

export interface SubjectRecapItem {
  id: string;
  nama: string;
  kelompok: string;
  guru_name: string;
  rata_kelas: number;
}

export interface StudentSubjectGrade {
  nilai_akhir: number;
  deskripsi_capaian: string;
}

export interface StudentRecapRow {
  student_id: string;
  student_name: string;
  nisn: string;
  nis?: string;
  grades: Record<string, StudentSubjectGrade>;
  rata_rata: number;
  peringkat: number;
}

export interface RecapMatrixResponse {
  status: string;
  semester: Semester;
  rombel: Rombel;
  subjects: SubjectRecapItem[];
  students: StudentRecapRow[];
}

export interface AttendanceItem {
  student_id: string;
  student_name: string;
  nisn: string;
  nis?: string;
  attendance_id?: string;
  sakit: number;
  izin: number;
  tanpa_keterangan: number;
  total: number;
}

export interface ExtracurricularItem {
  id: string;
  student_id: string;
  student?: Student;
  rombel_id: string;
  semester_id: string;
  nama_ekskul: string;
  predikat: string; // 'Sangat Baik' | 'Baik' | 'Cukup'
  keterangan: string;
  created_at?: string;
}

export interface WaliNoteItem {
  student_id: string;
  student_name: string;
  nisn: string;
  nis?: string;
  note_id?: string;
  catatan: string;
}

// ==================== Phase 4 Types ====================

export interface ReportSubjectGrade {
  no: number;
  subject_id: string;
  subject_nama: string;
  kelompok: string;
  guru_nama: string;
  nilai_akhir: number;
  deskripsi_capaian: string;
}

export interface ReportGradeGroup {
  kode_kelompok: string;
  nama_kelompok: string;
  grades: ReportSubjectGrade[];
}

export interface SubjectGroupSummary {
  kode: string;
  nama: string;
  deskripsi: string;
  urutan?: number;
  count: number;
  subjects: Subject[];
}

export interface CreateSubjectGroupInput {
  kode: string;
  nama: string;
  deskripsi?: string;
  urutan?: number;
  subject_ids?: string[];
}

export interface UpdateSubjectGroupInput {
  kode?: string;
  nama: string;
  deskripsi?: string;
  urutan?: number;
}

export interface StudentReportData {
  sekolah_nama: string;
  sekolah_npsn: string;
  sekolah_alamat: string;
  tahun_ajaran: string;
  semester: string;
  jenis_rapor: string;
  fase: string;
  kelas: string;
  student: Student;
  wali_kelas_nama: string;
  wali_kelas_nip: string;
  kepsek_nama: string;
  kepsek_nip: string;
  tanggal_cetak: string;
  kota_sekolah: string;
  grades?: ReportSubjectGrade[] | null;
  grouped_grades?: ReportGradeGroup[] | null;
  attendance: AttendanceItem | null;
  extracurricular?: ExtracurricularItem[] | null;
  wali_note: WaliNoteItem | null;
}

export interface GradeProgressItem {
  rombel_id: string;
  rombel_name: string;
  subject_id: string;
  subject_name: string;
  guru_name: string;
  total_students: number;
  graded_students: number;
  percentage: number;
  is_complete: boolean;
}
