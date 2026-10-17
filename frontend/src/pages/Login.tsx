import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  X,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { M3Button, M3TextField } from '../components/m3';
import { Modal } from '../components/Modal';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setIsLoading(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login gagal. Periksa kembali NIP/NIK/Email dan kata sandi Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-m3-surface-container-low flex flex-col justify-center items-center p-4 sm:p-8 relative text-m3-on-surface">
      {/* Main Login Card - M3 Elevated / 28px radius */}
      <div className="w-full max-w-[420px] bg-m3-surface-container-lowest rounded-[28px] shadow-m3-elevation-2 p-6 sm:p-8 space-y-6 relative z-10 animate-m3-enter border border-m3-outline-variant/30">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-m3-primary flex items-center justify-center text-m3-on-primary font-black text-2xl shadow-xs">
            R
          </div>
          <div>
            <h1 className="text-2xl font-black text-m3-on-surface tracking-tight">
              RAPOR <span className="text-m3-primary">SMK</span>
            </h1>
            <p className="text-xs text-m3-on-surface-variant font-medium mt-1">
              Sistem Rapor Tengah Semester Kurikulum Merdeka
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-m3-error-container text-m3-on-error-container text-xs font-medium flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p>{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-m3-on-error-container hover:bg-black/10 p-1 rounded-full cursor-pointer"
              aria-label="Tutup notifikasi error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <M3TextField
            label="NIP / NIK / Email"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus
            placeholder="Masukkan NIP, NIK, atau Email..."
            leadingIcon={<Mail className="w-4 h-4" />}
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-m3-on-surface-variant">Kata Sandi</span>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="text-[11px] font-semibold text-m3-primary hover:bg-m3-primary-container/40 px-2 py-0.5 rounded-full transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                Bantuan Akun
              </button>
            </div>
            <M3TextField
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Masukkan kata sandi..."
              leadingIcon={<KeyRound className="w-4 h-4" />}
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="p-1 text-m3-outline hover:text-m3-on-surface rounded-full cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>

          <div className="pt-2">
            <M3Button
              type="submit"
              variant="filled"
              size="lg"
              className="w-full"
              disabled={isLoading || !identifier.trim() || !password}
              icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isLoading ? 'Memverifikasi Akun...' : 'Masuk ke Sistem'}
            </M3Button>
          </div>
        </form>

        {/* Footer info */}
        <div className="pt-2 text-center text-xs text-m3-on-surface-variant/80 border-t border-m3-outline-variant/20">
          <p>© 2026 Rapor SMK • Terintegrasi Dapodik</p>
        </div>
      </div>

      {/* Help Modal */}
      <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="Format Akun Masuk">
        <div className="space-y-4 text-xs sm:text-sm text-m3-on-surface">
          <div className="p-4 rounded-2xl bg-m3-primary-container text-m3-on-primary-container space-y-2">
            <h4 className="font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-m3-primary" /> Akun Administrator
            </h4>
            <p className="text-xs leading-relaxed">
              Username: <code className="bg-white/60 text-m3-on-primary-container px-1 py-0.5 rounded font-mono font-bold">admin</code>
              <br />
              Kata Sandi Default: <code className="bg-white/60 text-m3-on-primary-container px-1 py-0.5 rounded font-mono font-bold">admin123</code>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-m3-surface-container space-y-2">
            <h4 className="font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-m3-secondary" /> Akun Guru & Wali Kelas
            </h4>
            <p className="text-xs text-m3-on-surface-variant leading-relaxed">
              Akun guru otomatis dibuat setelah sinkronisasi Dapodik. Gunakan <strong>NIP</strong> atau <strong>NIK</strong> Anda sebagai username dan kata sandi awal.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <M3Button variant="filled" size="sm" onClick={() => setShowHelpModal(false)}>
              Mengerti
            </M3Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
