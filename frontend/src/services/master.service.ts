import { api } from './api';
import {
  Semester,
  Rombel,
  Student,
  Subject,
  SubjectGroupSummary,
  CreateSubjectGroupInput,
  UpdateSubjectGroupInput,
  TeachingAssignment,
  LearningObjective,
  DashboardStats,
  TeacherItem,
} from '../types';

export const masterService = {
  // Dashboard
  async getDashboardStats(): Promise<{ stats: DashboardStats }> {
    return api.get<{ stats: DashboardStats }>('/dashboard/stats');
  },

  // Semesters
  async getSemesters(): Promise<{ semesters: Semester[] }> {
    return api.get<{ semesters: Semester[] }>('/semesters');
  },

  async createSemester(input: {
    tahun_ajaran: string;
    semester: number;
    jenis_rapor?: string;
    is_active?: boolean;
  }): Promise<{ message: string; semester: Semester }> {
    return api.post('/admin/semesters', input);
  },

  async activateSemester(id: string): Promise<{ message: string }> {
    return api.put(`/admin/semesters/${id}/activate`);
  },

  async deleteSemester(id: string): Promise<{ message: string }> {
    return api.delete(`/admin/semesters/${id}`);
  },

  // Rombels & Students
  async getRombels(): Promise<{ rombels: Rombel[] }> {
    return api.get<{ rombels: Rombel[] }>('/rombels');
  },

  async getRombelStudents(
    rombelId: string,
    includeInactive = false
  ): Promise<{
    rombel: Rombel;
    students: Student[];
    count: number;
  }> {
    return api.get(`/rombels/${rombelId}/students${includeInactive ? '?include_inactive=true' : ''}`);
  },

  // Subjects & Assignments
  async getSubjects(): Promise<{ subjects: Subject[] }> {
    return api.get<{ subjects: Subject[] }>('/subjects');
  },

  async getTeachingAssignments(): Promise<{ assignments: TeachingAssignment[] }> {
    return api.get<{ assignments: TeachingAssignment[] }>('/teaching-assignments');
  },

  async getMyTeachingAssignments(): Promise<{ assignments: TeachingAssignment[] }> {
    return api.get<{ assignments: TeachingAssignment[] }>('/teaching-assignments/my');
  },

  // Learning Objectives (TP)
  async getLearningObjectives(subjectId: string): Promise<{
    learning_objectives: LearningObjective[];
    count: number;
  }> {
    return api.get(`/subjects/${subjectId}/learning-objectives`);
  },

  async createLearningObjective(
    subjectId: string,
    input: { kode_tp: string; deskripsi: string; urutan?: number }
  ): Promise<{ message: string; learning_objective: LearningObjective }> {
    return api.post(`/subjects/${subjectId}/learning-objectives`, input);
  },

  async updateLearningObjective(
    id: string,
    input: { kode_tp?: string; deskripsi?: string; urutan?: number }
  ): Promise<{ message: string; learning_objective: LearningObjective }> {
    return api.put(`/learning-objectives/${id}`, input);
  },

  async deleteLearningObjective(id: string): Promise<{ message: string }> {
    return api.delete(`/learning-objectives/${id}`);
  },

  // -------------------------------------------------------------
  // Admin Manual Master Data Management
  // -------------------------------------------------------------

  // Siswa
  async createStudent(input: {
    name: string;
    nisn?: string;
    nis?: string;
    rombel_id: string;
    jenis_kelamin?: string;
    tempat_lahir?: string;
    tanggal_lahir?: string;
  }): Promise<{ message: string; student: Student }> {
    return api.post('/admin/students', input);
  },

  async updateStudent(
    id: string,
    input: {
      name?: string;
      nisn?: string;
      nis?: string;
      jenis_kelamin?: string;
      tempat_lahir?: string;
      tanggal_lahir?: string;
      is_active?: boolean;
    }
  ): Promise<{ message: string; student: Student }> {
    return api.put(`/admin/students/${id}`, input);
  },

  async transferStudent(
    id: string,
    targetRombelId: string
  ): Promise<{ message: string; student: Student; target_rombel: Rombel }> {
    return api.put(`/admin/students/${id}/transfer`, { target_rombel_id: targetRombelId });
  },

  async deleteStudent(id: string, force = false): Promise<{ message: string }> {
    return api.delete(`/admin/students/${id}${force ? '?force=true' : ''}`);
  },

  // Guru & PTK
  async getTeachers(): Promise<{ teachers: TeacherItem[]; count: number }> {
    return api.get('/admin/teachers');
  },

  async createTeacher(input: {
    name: string;
    nip_nik?: string;
    email?: string;
    phone?: string;
    role?: string;
    password?: string;
  }): Promise<{ message: string; teacher: any }> {
    return api.post('/admin/teachers', input);
  },

  async updateTeacher(
    id: string,
    input: {
      name?: string;
      nip_nik?: string;
      email?: string;
      phone?: string;
      role?: string;
      is_active?: boolean;
    }
  ): Promise<{ message: string; teacher: any }> {
    return api.put(`/admin/teachers/${id}`, input);
  },

  async resetTeacherPassword(
    id: string,
    newPassword?: string
  ): Promise<{ message: string; new_password: string }> {
    return api.post(`/admin/teachers/${id}/reset-password`, { new_password: newPassword });
  },

  async deleteTeacher(id: string): Promise<{ message: string }> {
    return api.delete(`/admin/teachers/${id}`);
  },

  // Rombel & Wali Kelas
  async createRombel(input: {
    name: string;
    tingkat: number;
    wali_kelas_id?: string;
  }): Promise<{ message: string; rombel: Rombel }> {
    return api.post('/admin/rombels', input);
  },

  async setWaliKelas(
    rombelId: string,
    waliKelasId: string
  ): Promise<{ message: string; rombel: Rombel }> {
    return api.put(`/admin/rombels/${rombelId}/wali-kelas`, { wali_kelas_id: waliKelasId });
  },

  // Penugasan Mengajar
  async createTeachingAssignment(input: {
    guru_id: string;
    subject_id: string;
    rombel_id: string;
    jam_per_minggu?: number;
  }): Promise<{ message: string; assignment: TeachingAssignment }> {
    return api.post('/admin/teaching-assignments', input);
  },

  async deleteTeachingAssignment(id: string): Promise<{ message: string }> {
    return api.delete(`/admin/teaching-assignments/${id}`);
  },

  // Mata Pelajaran (Manual)
  async createSubject(input: {
    nama: string;
    kelompok?: string;
  }): Promise<{ message: string; subject: Subject }> {
    return api.post('/admin/subjects', input);
  },

  async updateSubject(
    id: string,
    input: { nama: string; kelompok?: string }
  ): Promise<{ message: string; subject: Subject }> {
    return api.put(`/admin/subjects/${id}`, input);
  },

  async deleteSubject(id: string): Promise<{ message: string }> {
    return api.delete(`/admin/subjects/${id}`);
  },

  async bulkUpdateSubjectKelompok(
    subjectIds: string[],
    kelompok: string
  ): Promise<{ message: string; updated_count: number; target_kelompok: string }> {
    return api.put('/admin/subjects/bulk-kelompok', { subject_ids: subjectIds, kelompok });
  },

  async getSubjectGroupsSummary(): Promise<{
    groups: SubjectGroupSummary[];
    total_subjects: number;
  }> {
    return api.get('/subject-groups/summary');
  },

  async createSubjectGroup(
    input: CreateSubjectGroupInput
  ): Promise<{ message: string; group: SubjectGroupSummary }> {
    return api.post('/admin/subject-groups', input);
  },

  async updateSubjectGroup(
    kode: string,
    input: UpdateSubjectGroupInput
  ): Promise<{ message: string; group: SubjectGroupSummary }> {
    return api.put(`/admin/subject-groups/${encodeURIComponent(kode)}`, input);
  },

  async deleteSubjectGroup(
    kode: string,
    targetKelompok?: string
  ): Promise<{ message: string }> {
    const query = targetKelompok ? `?target_kelompok=${encodeURIComponent(targetKelompok)}` : '';
    return api.delete(`/admin/subject-groups/${encodeURIComponent(kode)}${query}`);
  },
};
