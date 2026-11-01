export type OfflineModule = 'grades' | 'attendance' | 'notes';

export interface DraftRecord<T = unknown> {
  key: string; // Composite key: `${module}:${rombelId}:${subjectId || 'all'}`
  module: OfflineModule;
  rombelId: string;
  subjectId?: string;
  teacherId?: string;
  data: T;
  updatedAt: number;
}

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface OutboxItem<T = unknown> {
  id: string; // UUID
  idempotencyKey: string; // UUID v4 for backend deduplication
  action: 'SAVE_GRADES' | 'SAVE_ATTENDANCE' | 'SAVE_WALI_NOTES';
  endpoint: string; // e.g. '/grades/batch'
  method: 'POST' | 'PUT';
  payload: T;
  status: OutboxStatus;
  retryCount: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineSyncEvent {
  type: 'QUEUE_UPDATED' | 'SYNC_STARTED' | 'SYNC_COMPLETED' | 'SYNC_FAILED';
  unsyncedCount: number;
  lastError?: string;
}
