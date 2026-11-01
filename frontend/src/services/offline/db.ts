import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DraftRecord, OutboxItem, OutboxStatus, OfflineModule } from './types';

export interface RaporOfflineDBSchema extends DBSchema {
  drafts: {
    key: string;
    value: DraftRecord;
    indexes: {
      'by_module': string;
      'by_teacher': string;
    };
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: {
      'by_status': string;
      'by_created': number;
    };
  };
}

const DB_NAME = 'rapor_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RaporOfflineDBSchema>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<RaporOfflineDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<RaporOfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store 1: Drafts untuk input nilai / presensi yang sedang aktif
        if (!db.objectStoreNames.contains('drafts')) {
          const draftStore = db.createObjectStore('drafts', { keyPath: 'key' });
          draftStore.createIndex('by_module', 'module');
          draftStore.createIndex('by_teacher', 'teacherId');
        }

        // Store 2: Outbox antrean mutasi untuk sinkronisasi ke server
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('by_status', 'status');
          outboxStore.createIndex('by_created', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

// Helper UUID generator
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ----------------------------------------------------
// DRAFT STORE HELPERS (Single Composite Document per Form)
// ----------------------------------------------------

export async function getDraft<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = await getOfflineDB();
    const record = await db.get('drafts', key);
    return record ? (record.data as T) : null;
  } catch (err) {
    console.error(`[OfflineDB] Gagal membaca draft ${key}:`, err);
    return null;
  }
}

export async function saveDraft<T = unknown>(
  key: string,
  module: OfflineModule,
  data: T,
  meta?: { rombelId?: string; subjectId?: string; teacherId?: string }
): Promise<void> {
  try {
    const db = await getOfflineDB();
    const record: DraftRecord<T> = {
      key,
      module,
      rombelId: meta?.rombelId || '',
      subjectId: meta?.subjectId,
      teacherId: meta?.teacherId,
      data,
      updatedAt: Date.now(),
    };
    await db.put('drafts', record as unknown as DraftRecord);
  } catch (err) {
    console.error(`[OfflineDB] Gagal menyimpan draft ${key}:`, err);
  }
}

export async function deleteDraft(key: string): Promise<void> {
  try {
    const db = await getOfflineDB();
    await db.delete('drafts', key);
  } catch (err) {
    console.error(`[OfflineDB] Gagal menghapus draft ${key}:`, err);
  }
}

// ----------------------------------------------------
// OUTBOX STORE HELPERS (FIFO Queue for Batch Mutations)
// ----------------------------------------------------

export async function enqueueOutbox<T = unknown>(params: {
  action: OutboxItem['action'];
  endpoint: string;
  method?: 'POST' | 'PUT';
  payload: T;
}): Promise<string> {
  const db = await getOfflineDB();
  const id = generateUUID();
  const idempotencyKey = generateUUID();
  const now = Date.now();

  const item: OutboxItem<T> = {
    id,
    idempotencyKey,
    action: params.action,
    endpoint: params.endpoint,
    method: params.method || 'POST',
    payload: params.payload,
    status: 'PENDING',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.put('outbox', item as unknown as OutboxItem);
  return id;
}

export async function getPendingOutbox(): Promise<OutboxItem[]> {
  try {
    const db = await getOfflineDB();
    // Gunakan index by_status untuk efisiensi O(1) query
    const index = db.transaction('outbox', 'readonly').store.index('by_status');
    const items = await index.getAll('PENDING');
    // Urutkan FIFO berdasarkan createdAt
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch (err) {
    console.error('[OfflineDB] Gagal membaca outbox:', err);
    return [];
  }
}

export async function updateOutboxStatus(
  id: string,
  status: OutboxStatus,
  lastError?: string
): Promise<void> {
  try {
    const db = await getOfflineDB();
    const tx = db.transaction('outbox', 'readwrite');
    const item = await tx.store.get(id);
    if (item) {
      item.status = status;
      item.updatedAt = Date.now();
      if (lastError !== undefined) {
        item.lastError = lastError;
      }
      if (status === 'FAILED') {
        item.retryCount += 1;
      }
      await tx.store.put(item);
    }
    await tx.done;
  } catch (err) {
    console.error(`[OfflineDB] Gagal mengupdate status outbox ${id}:`, err);
  }
}

export async function deleteOutboxItem(id: string): Promise<void> {
  try {
    const db = await getOfflineDB();
    await db.delete('outbox', id);
  } catch (err) {
    console.error(`[OfflineDB] Gagal menghapus outbox ${id}:`, err);
  }
}

export async function getUnsyncedCount(): Promise<number> {
  try {
    const db = await getOfflineDB();
    const index = db.transaction('outbox', 'readonly').store.index('by_status');
    const [pendingCount, syncingCount, failedCount] = await Promise.all([
      index.count('PENDING'),
      index.count('SYNCING'),
      index.count('FAILED'),
    ]);
    return pendingCount + syncingCount + failedCount;
  } catch {
    return 0;
  }
}
