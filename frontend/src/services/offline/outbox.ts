import {
  getPendingOutbox,
  updateOutboxStatus,
  deleteOutboxItem,
  getUnsyncedCount,
  deleteDraft,
} from './db';
import { connectionManager } from './connection';
import type { OutboxItem, OfflineSyncEvent } from './types';

const SYNC_LOCK_NAME = 'rapor_outbox_sync_lock';
const BROADCAST_CHANNEL_NAME = 'rapor_sync_channel';

class OutboxSyncWorker {
  private isProcessing = false;
  private channel: BroadcastChannel | null = null;
  private syncListeners: Set<(event: OfflineSyncEvent) => void> = new Set();
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Inisialisasi BroadcastChannel untuk koordinasi multi-tab
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'QUEUE_CHANGED') {
            this.notifyQueueChanged();
          }
        };
      }

      // Pasang listener status koneksi: jika pulih, jadwalkan sinkronisasi otomatis dengan jitter
      connectionManager.subscribe((isOnline) => {
        if (isOnline) {
          this.scheduleJitteredFlush();
        }
      });

      // Pasang pengaman beforeunload
      this.setupBeforeUnloadProtection();
    }
  }

  public subscribe(callback: (event: OfflineSyncEvent) => void): () => void {
    this.syncListeners.add(callback);
    return () => {
      this.syncListeners.delete(callback);
    };
  }

  private emit(event: OfflineSyncEvent) {
    this.syncListeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('[OutboxWorker] Listener error:', err);
      }
    });
  }

  public async notifyQueueChanged(): Promise<void> {
    const count = await getUnsyncedCount();
    this.emit({ type: 'QUEUE_UPDATED', unsyncedCount: count });
  }

  private broadcastChange(): void {
    if (this.channel) {
      this.channel.postMessage({ type: 'QUEUE_CHANGED' });
    }
    this.notifyQueueChanged();
  }

  private scheduleJitteredFlush(): void {
    // Jitter 0 - 2500ms mencegah thundering herd serentak dari seluruh client guru
    const jitter = Math.floor(Math.random() * 2500);
    setTimeout(() => {
      this.flushQueue();
    }, jitter);
  }

  public async flushQueue(): Promise<void> {
    if (!connectionManager.isOnline) return;

    // Gunakan Web Locks API untuk memastikan hanya 1 tab peramban yang memproses queue secara bersamaan
    if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
      try {
        await navigator.locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
          if (!lock) {
            // Tab lain sedang memproses antrean
            return;
          }
          await this.executeSequentialFlush();
        });
      } catch {
        // Fallback jika Web Locks gagal
        await this.executeSequentialFlush();
      }
    } else {
      await this.executeSequentialFlush();
    }
  }

  private async executeSequentialFlush(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const items = await getPendingOutbox();
      if (items.length === 0) return;

      const initialCount = await getUnsyncedCount();
      this.emit({ type: 'SYNC_STARTED', unsyncedCount: initialCount });

      for (const item of items) {
        // Pastikan koneksi masih hidup sebelum memproses tiap item
        if (!connectionManager.isOnline) break;

        await this.processSingleItem(item);
      }

      const finalCount = await getUnsyncedCount();
      this.emit({
        type: finalCount === 0 ? 'SYNC_COMPLETED' : 'QUEUE_UPDATED',
        unsyncedCount: finalCount,
      });
      this.broadcastChange();
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleItem(item: OutboxItem): Promise<boolean> {
    await updateOutboxStatus(item.id, 'SYNCING');

    const token = localStorage.getItem('rapor_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Idempotency-Key': item.idempotencyKey,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const url = item.endpoint.startsWith('/api/v1')
        ? item.endpoint
        : `/api/v1${item.endpoint.startsWith('/') ? item.endpoint : `/${item.endpoint}`}`;

      const response = await fetch(url, {
        method: item.method || 'POST',
        headers,
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        // Sukses disinkronkan ke server: hapus dari outbox
        await deleteOutboxItem(item.id);

        // Jika item ini memiliki referensi draft (misal grades), bersihkan draft terkait
        if (item.action === 'SAVE_GRADES' && (item.payload as any)?.rombel_id && (item.payload as any)?.subject_id) {
          const draftKey = `grades:${(item.payload as any).rombel_id}:${(item.payload as any).subject_id}`;
          await deleteDraft(draftKey);
        } else if (item.action === 'SAVE_ATTENDANCE' && (item.payload as any)?.rombel_id) {
          const draftKey = `attendance:${(item.payload as any).rombel_id}:all`;
          await deleteDraft(draftKey);
        } else if (item.action === 'SAVE_WALI_NOTES' && (item.payload as any)?.rombel_id) {
          const draftKey = `notes:${(item.payload as any).rombel_id}:all`;
          await deleteDraft(draftKey);
        }

        return true;
      }

      if (response.status === 401) {
        // Token kedaluwarsa: jangan hapus antrean, tandai failed dan picu modal re-auth di tempat
        await updateOutboxStatus(item.id, 'FAILED', 'Sesi kedaluwarsa. Silakan verifikasi kata sandi.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('rapor:session-expired', {
              detail: { message: 'Sesi kedaluwarsa saat sinkronisasi offline.' },
            })
          );
        }
        return false;
      }

      const errText = await response.text();
      await updateOutboxStatus(item.id, 'FAILED', `Server menolak (${response.status}): ${errText}`);
      return false;
    } catch (err: any) {
      // Kesalahan jaringan / putus di tengah jalan
      await updateOutboxStatus(item.id, 'PENDING', err.message || 'Jaringan terputus saat mengirim.');
      connectionManager.checkServerHealth();
      return false;
    }
  }

  private setupBeforeUnloadProtection(): void {
    if (this.beforeUnloadHandler) return;

    this.beforeUnloadHandler = async (e: BeforeUnloadEvent) => {
      const unsynced = await getUnsyncedCount();
      if (unsynced > 0) {
        e.preventDefault();
        e.returnValue = ''; // Standard trigger dialog konfirmasi peramban
      }
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler as any);
  }
}

export const outboxWorker = new OutboxSyncWorker();
