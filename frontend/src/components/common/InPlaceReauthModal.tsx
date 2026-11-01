import React, { useState, useEffect } from 'react';
import { Lock, LogOut, RefreshCw, KeyRound, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { outboxWorker } from '../../services/offline';
import { M3Button, M3TextField, M3Dialog } from '../m3';

export const InPlaceReauthModal: React.FC = () => {
  const { user, login, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleSessionExpired = () => {
      // Hanya buka jika pengguna sedang terotentikasi dan tidak di halaman login
      if (window.location.pathname !== '/login') {
        setIsOpen(true);
      }
    };

    window.addEventListener('rapor:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('rapor:session-expired', handleSessionExpired);
    };
  }, []);

  if (!isOpen) return null;

  const identifier = user?.nip_nik || user?.email || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Masukkan kata sandi Anda');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await login(identifier, password);
      setIsOpen(false);
      setPassword('');

      // Lanjutkan proses sinkronisasi antrean yang tertunda
      setTimeout(() => {
        outboxWorker.flushQueue();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Kata sandi salah. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  return (
    <M3Dialog
      isOpen={isOpen}
      onClose={() => {}} // Non-dismissible by backdrop click to protect state
      maxWidth="max-w-sm"
    >
      <div className="space-y-5 pt-1">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-m3-on-surface">
            Sesi Anda Telah Kedaluwarsa
          </h3>
          <p className="text-xs text-m3-on-surface-variant max-w-xs leading-relaxed">
            Masukkan kata sandi akun Anda untuk memperbarui sesi login tanpa kehilangan data atau memuat ulang halaman.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-m3-error-container text-m3-on-error-container text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-m3-error" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-m3-on-surface-variant mb-1">
              Pengguna
            </label>
            <div className="px-3.5 py-2.5 rounded-xl bg-m3-surface-container text-xs font-semibold text-m3-on-surface border border-m3-outline-variant/30 truncate">
              {user?.name || identifier} ({identifier})
            </div>
          </div>

          <div>
            <M3TextField
              type="password"
              label="Kata Sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi Anda..."
              leadingIcon={<KeyRound className="w-4 h-4" />}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <M3Button
              type="submit"
              variant="filled"
              disabled={submitting}
              className="w-full justify-center"
              icon={submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
            >
              {submitting ? 'Memverifikasi...' : 'Perbarui Sesi & Lanjutkan'}
            </M3Button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 text-center text-xs font-semibold text-m3-error hover:bg-m3-error/10 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar ke Halaman Login</span>
            </button>
          </div>
        </form>
      </div>
    </M3Dialog>
  );
};
