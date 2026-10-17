import { api } from './api';
import { StudentReportData, GradeProgressItem } from '../types';

export const reportService = {
  // Get progress monitoring
  async getGradeProgress(semesterId?: string): Promise<{ progress: GradeProgressItem[] }> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    return api.get<{ progress: GradeProgressItem[] }>(`/dashboard/grade-progress${query}`);
  },

  // Get single student report preview
  async getStudentReportPreview(
    studentId: string,
    semesterId?: string
  ): Promise<{ report: StudentReportData }> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    return api.get<{ report: StudentReportData }>(`/reports/${studentId}/preview${query}`);
  },

  // Download PDF directly as file blob
  async downloadStudentPDF(
    studentId: string,
    studentName: string,
    nisn: string,
    semesterId?: string
  ): Promise<void> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    const token = localStorage.getItem('rapor_token');

    const response = await fetch(`/api/v1/reports/${studentId}/pdf${query}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Gagal mengunduh file PDF rapor');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapor_Mid_${nisn || 'Siswa'}_${studentName.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Download Batch ZIP
  async downloadRombelZip(
    rombelId: string,
    rombelName: string,
    semesterId?: string
  ): Promise<void> {
    const query = semesterId ? `?semester_id=${semesterId}` : '';
    const token = localStorage.getItem('rapor_token');

    const response = await fetch(`/api/v1/reports/rombel/${rombelId}/zip${query}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Gagal mengunduh file ZIP rapor rombel');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapor_Mid_${rombelName.replace(/\s+/g, '_')}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
