import { api } from './api';
import { DapodikConfig, TestConnectionResult, SyncSummary, SyncOptions } from '../types';

export const dapodikService = {
  async getConfig(): Promise<{ config: DapodikConfig }> {
    return api.get<{ config: DapodikConfig }>('/admin/dapodik/config');
  },

  async getAllConfigs(): Promise<{ configs: DapodikConfig[] }> {
    return api.get<{ configs: DapodikConfig[] }>('/admin/dapodik/configs');
  },

  async saveConfig(input: {
    name?: string;
    dapodik_host: string;
    dapodik_port: number;
    dapodik_token?: string;
    npsn: string;
    timeout_seconds?: number;
  }): Promise<{ message: string }> {
    return api.post('/admin/dapodik/config', input);
  },

  async activateConfig(id: string): Promise<{ message: string; config: DapodikConfig }> {
    return api.post<{ message: string; config: DapodikConfig }>(`/admin/dapodik/configs/${id}/activate`, {});
  },

  async deleteConfig(id: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/admin/dapodik/configs/${id}`);
  },

  async testConnection(input: {
    dapodik_host?: string;
    dapodik_port?: number;
    dapodik_token?: string;
    npsn?: string;
    timeout_seconds?: number;
  }): Promise<TestConnectionResult> {
    return api.post<TestConnectionResult>('/admin/dapodik/test-connection', input);
  },

  async sync(options: SyncOptions): Promise<SyncSummary> {
    return api.post<SyncSummary>('/admin/dapodik/sync', options);
  },
};
