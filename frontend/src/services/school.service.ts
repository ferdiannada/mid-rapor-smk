import { api } from './api';
import { SchoolProfile } from '../types';

export const schoolService = {
  async getProfile(): Promise<{ profile: SchoolProfile }> {
    return api.get<{ status: string; profile: SchoolProfile }>('/school-profile');
  },

  async updateProfile(
    input: Partial<SchoolProfile>
  ): Promise<{ status: string; message: string; profile: SchoolProfile }> {
    return api.put<{ status: string; message: string; profile: SchoolProfile }>(
      '/admin/school-profile',
      input
    );
  },

  async uploadLogo(file: File): Promise<{ status: string; message: string; data_url: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    return api.postFormData<{ status: string; message: string; data_url: string }>(
      '/admin/school-profile/logo',
      formData
    );
  },
};
