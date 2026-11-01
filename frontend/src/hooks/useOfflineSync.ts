import { useState, useEffect, useCallback } from 'react';
import {
  connectionManager,
  outboxWorker,
  getUnsyncedCount,
  type OfflineSyncEvent,
} from '../services/offline';

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  unsyncedCount: number;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState<boolean>(connectionManager.isOnline);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    // 1. Initial count
    getUnsyncedCount().then(setUnsyncedCount);

    // 2. Subscribe to network status
    const unsubConnection = connectionManager.subscribe((online) => {
      setIsOnline(online);
    });

    // 3. Subscribe to outbox sync worker events
    const unsubOutbox = outboxWorker.subscribe((event: OfflineSyncEvent) => {
      setUnsyncedCount(event.unsyncedCount);
      if (event.type === 'SYNC_STARTED') {
        setIsSyncing(true);
      } else if (event.type === 'SYNC_COMPLETED' || event.type === 'QUEUE_UPDATED') {
        setIsSyncing(false);
      }
    });

    return () => {
      unsubConnection();
      unsubOutbox();
    };
  }, []);

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await outboxWorker.flushQueue();
    } finally {
      setIsSyncing(false);
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    return connectionManager.checkServerHealth();
  }, []);

  return {
    isOnline,
    unsyncedCount,
    isSyncing,
    triggerSync,
    checkConnection,
  };
}
