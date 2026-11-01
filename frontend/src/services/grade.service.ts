import { api } from './api';
import {
  GradeSheetResponse,
  BatchSaveGradesPayload,
  RecapMatrixResponse,
  AttendanceItem,
  ExtracurricularItem,
  WaliNoteItem,
  Semester,
} from '../types';

export const gradeService = {
  // 1. Penilaian Mata Pelajaran per TP
  async getGradeSheet(
    rombelId: string,
    subjectId: string,
    semesterId?: string
  ): Promise<GradeSheetResponse> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    return api.get<GradeSheetResponse>(`/grades/${rombelId}/${subjectId}${query}`);
  },

  async batchSaveGrades(payload: BatchSaveGradesPayload): Promise<{ message: string; saved_count: number }> {
    return api.post('/grades/batch', payload);
  },

  async generateAutoDescriptions(
    subjectId: string,
    students: {
      student_id: string;
      nilai_akhir?: number;
      tp_scores: { learning_objective_id: string; nilai: number }[];
    }[]
  ): Promise<{
    results: {
      student_id: string;
      nilai_akhir: number;
      deskripsi_capaian: string;
    }[];
  }> {
    return api.post('/grades/generate-descriptions', {
      subject_id: subjectId,
      students,
    });
  },

  // 2. Rekap Matriks Nilai (Wali Kelas)
  async getRecapMatrix(rombelId: string, semesterId?: string): Promise<RecapMatrixResponse> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    return api.get<RecapMatrixResponse>(`/wali-kelas/${rombelId}/recap${query}`);
  },

  // 3. Presensi & Kehadiran
  async getAttendance(
    rombelId: string,
    semesterId?: string
  ): Promise<{ attendances: AttendanceItem[]; semester: Semester }> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    return api.get(`/attendance/${rombelId}${query}`);
  },

  async batchSaveAttendance(
    rombelId: string,
    attendances: { student_id: string; sakit: number; izin: number; tanpa_keterangan: number }[],
    semesterId?: string
  ): Promise<{ message: string }> {
    return api.post('/attendance/batch', {
      rombel_id: rombelId,
      semester_id: semesterId,
      attendances,
    });
  },

  // 4. Ekstrakurikuler
  async getExtracurriculars(
    rombelId: string,
    semesterId?: string
  ): Promise<{ extracurriculars: ExtracurricularItem[]; semester: Semester }> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    return api.get(`/extracurriculars/${rombelId}${query}`);
  },

  async saveExtracurricular(payload: {
    id?: string;
    student_id: string;
    rombel_id: string;
    semester_id?: string;
    nama_ekskul: string;
    predikat: string;
    keterangan: string;
  }): Promise<{ message: string; extracurricular: ExtracurricularItem }> {
    return api.post('/extracurriculars', payload);
  },

  async deleteExtracurricular(id: string): Promise<{ message: string }> {
    return api.delete(`/extracurriculars/${id}`);
  },

  // 5. Catatan Wali Kelas
  async getWaliNotes(
    rombelId: string,
    semesterId?: string
  ): Promise<{ notes: WaliNoteItem[]; semester: Semester }> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    return api.get(`/wali-notes/${rombelId}${query}`);
  },

  async batchSaveWaliNotes(
    rombelId: string,
    notes: { student_id: string; catatan: string }[],
    semesterId?: string
  ): Promise<{ message: string }> {
    return api.post('/wali-notes/batch', {
      rombel_id: rombelId,
      semester_id: semesterId,
      notes,
    });
  },
};
