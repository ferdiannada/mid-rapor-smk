export type ConnectionChangeCallback = (isOnline: boolean) => void;

class ConnectionManager {
  private isOnlineState: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<ConnectionChangeCallback> = new Set();
  private intervalId: number | null = null;
  private isChecking: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkEvent(true));
      window.addEventListener('offline', () => this.handleNetworkEvent(false));

      // Jalankan active health check berkala
      this.startHeartbeat();
    }
  }

  public get isOnline(): boolean {
    return this.isOnlineState;
  }

  public subscribe(callback: ConnectionChangeCallback): () => void {
    this.listeners.add(callback);
    // Panggil langsung dengan state terkini
    callback(this.isOnlineState);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public async checkServerHealth(): Promise<boolean> {
    if (this.isChecking) return this.isOnlineState;
    this.isChecking = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

      const response = await fetch('/api/v1/ping', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      // Respon 204 No Content atau 200 OK berarti server sehat
      const isHealthy = response.status === 204 || response.status === 200;
      this.notifyStatus(isHealthy);
      return isHealthy;
    } catch {
      // Jaringan putus / timeout / server unreachable
      this.notifyStatus(false);
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  private handleNetworkEvent(online: boolean) {
    if (!online) {
      this.notifyStatus(false);
    } else {
      // Jika browser mendeteksi Wi-Fi nyambung, lakukan verifikasi aktif ke server
      this.checkServerHealth();
    }
  }

  private notifyStatus(online: boolean) {
    if (this.isOnlineState !== online) {
      this.isOnlineState = online;
      this.listeners.forEach((cb) => {
        try {
          cb(online);
        } catch (err) {
          console.error('[ConnectionManager] Listener error:', err);
        }
      });
    }
  }

  public startHeartbeat(intervalMs: number = 15000): void {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => {
      // Hanya lakukan ping jika tab aktif dan terlihat oleh pengguna
      if (document.visibilityState === 'visible') {
        this.checkServerHealth();
      }
    }, intervalMs);
  }

  public stopHeartbeat(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const connectionManager = new ConnectionManager();
