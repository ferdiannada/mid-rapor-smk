import React, { useState, useEffect } from "react";
import {
  Database,
  Server,
  PlugZap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Save,
  Clock,
  CheckSquare,
  Square,
  Loader2,
  ChevronDown,
  ChevronUp,
  Network,
  Plus,
  Trash2,
  Radio,
} from "lucide-react";
import { dapodikService } from "../services/dapodik.service";
import {
  DapodikConfig,
  TestConnectionResult,
  SyncSummary,
  SyncOptions,
} from "../types";
import { M3Card, M3Button, M3TextField, M3Dialog } from "../components/m3";
import { Skeleton } from "../components/common/Skeleton";

export const DapodikSettings: React.FC = () => {
  // Config state
  const [configsList, setConfigsList] = useState<DapodikConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<DapodikConfig | null>(null);

  // Form fields
  const [connectionName, setConnectionName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(5774);
  const [npsn, setNpsn] = useState("20500123");
  const [timeoutSec, setTimeoutSec] = useState(10);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isNewConnectionMode, setIsNewConnectionMode] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<DapodikConfig | null>(null);

  // Loading & Feedback states
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSwitchingConfig, setIsSwitchingConfig] = useState(false);
  const [isDeletingConfig, setIsDeletingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(
    null,
  );

  // Sync state
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    sync_gtk: true,
    sync_rombel: true,
    sync_siswa: true,
    sync_pembelajaran: true,
    dry_run: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  // Load configs on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoadingConfig(true);
    try {
      const [listRes, activeRes] = await Promise.all([
        dapodikService.getAllConfigs().catch(() => ({ configs: [] })),
        dapodikService
          .getConfig()
          .catch(() => ({ config: null as unknown as DapodikConfig })),
      ]);

      const configs = listRes.configs || [];
      setConfigsList(configs);

      const currentActive =
        activeRes.config ||
        configs.find((c) => c.is_active) ||
        configs[0] ||
        null;
      setActiveConfig(currentActive);

      if (currentActive) {
        setConnectionName(currentActive.name || "Koneksi Dapodik");
        setHost(currentActive.dapodik_host || "localhost");
        setPort(currentActive.dapodik_port || 5774);
        setNpsn(currentActive.npsn || "");
        setTimeoutSec(currentActive.timeout_seconds || 10);
      }
      setIsNewConnectionMode(false);
    } catch (err: any) {
      console.error("Failed to load Dapodik configurations", err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleSwitchConnection = async (selectedId: string) => {
    if (!selectedId) return;

    if (selectedId === "new") {
      handleAddNewConnectionMode();
      return;
    }

    if (activeConfig?.id === selectedId) {
      return;
    }

    setIsSwitchingConfig(true);
    setConfigMsg(null);
    try {
      const res = await dapodikService.activateConfig(selectedId);
      setConfigMsg({
        type: "success",
        text: res.message || "Koneksi berhasil diaktifkan.",
      });

      const listRes = await dapodikService.getAllConfigs();
      setConfigsList(listRes.configs || []);

      const found = (listRes.configs || []).find((c) => c.id === selectedId);
      if (found) {
        setActiveConfig(found);
        setConnectionName(found.name || "");
        setHost(found.dapodik_host || "");
        setPort(found.dapodik_port || 5774);
        setNpsn(found.npsn || "");
        setTimeoutSec(found.timeout_seconds || 10);
        setToken("");
      }
      setIsNewConnectionMode(false);
      setTestResult(null);
    } catch (err: any) {
      setConfigMsg({
        type: "error",
        text: err.message || "Gagal mengaktifkan koneksi.",
      });
    } finally {
      setIsSwitchingConfig(false);
    }
  };

  const handleAddNewConnectionMode = () => {
    setIsNewConnectionMode(true);
    setConnectionName("");
    setHost("");
    setPort(5774);
    setToken("");
    setConfigMsg(null);
    setTestResult(null);
  };

  const handleCancelNewConnection = () => {
    setIsNewConnectionMode(false);
    if (activeConfig) {
      setConnectionName(activeConfig.name || "");
      setHost(activeConfig.dapodik_host || "");
      setPort(activeConfig.dapodik_port || 5774);
      setNpsn(activeConfig.npsn || "");
      setTimeoutSec(activeConfig.timeout_seconds || 10);
      setToken("");
    }
    setConfigMsg(null);
  };

  const confirmDeleteConnection = async () => {
    if (!configToDelete) return;
    setIsDeletingConfig(true);
    setConfigMsg(null);
    try {
      const res = await dapodikService.deleteConfig(configToDelete.id);
      setConfigMsg({
        type: "success",
        text: res.message || "Koneksi berhasil dihapus.",
      });
      setConfigToDelete(null);
      await loadAllData();
    } catch (err: any) {
      setConfigMsg({
        type: "error",
        text: err.message || "Gagal menghapus koneksi.",
      });
    } finally {
      setIsDeletingConfig(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigMsg(null);
    try {
      const res = await dapodikService.saveConfig({
        name: connectionName.trim() || undefined,
        dapodik_host: host.trim(),
        dapodik_port: Number(port),
        dapodik_token: token.trim() || undefined,
        npsn: npsn.trim(),
        timeout_seconds: Number(timeoutSec),
      });

      setConfigMsg({
        type: "success",
        text: res.message || "Konfigurasi berhasil disimpan dan diaktifkan.",
      });
      setToken("");
      setIsNewConnectionMode(false);
      await loadAllData();
    } catch (err: any) {
      setConfigMsg({
        type: "error",
        text: err.message || "Gagal menyimpan konfigurasi.",
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await dapodikService.testConnection({
        dapodik_host: host.trim(),
        dapodik_port: Number(port),
        dapodik_token: token.trim() || undefined,
        npsn: npsn.trim(),
        timeout_seconds: Number(timeoutSec),
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        status: "failed",
        server: `${host}:${port}`,
        latency_ms: 0,
        message: err.message || "Gagal mengirim permintaan pengujian koneksi",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await dapodikService.sync(syncOptions);
      setSyncResult(res);
    } catch (err: any) {
      setSyncError(
        err.message || "Terjadi kesalahan saat melakukan sinkronisasi Dapodik",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* M3 Header Banner */}
      <div className="rounded-[28px] bg-m3-primary-container text-m3-on-primary-container p-6 sm:p-8 shadow-m3-elevation-1 border border-m3-primary/10">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-surface/70 text-m3-on-surface text-xs font-semibold">
            <Database className="w-3.5 h-3.5 text-m3-primary" />
            <span>Integrasi Web Service Kemendikbudristek</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Koneksi & Sinkronisasi Dapodik
          </h1>
          <p className="text-xs sm:text-sm text-m3-on-primary-container/85 leading-relaxed">
            Kelola profil koneksi Web Service Dapodik untuk komputer server atau IP client sekolah. Setiap komputer client diizinkan dengan token unik oleh aplikasi Dapodik sekolah.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Connection Selector & Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Connection Switcher Card */}
          <M3Card variant="outlined" className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-m3-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center font-bold">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-m3-on-surface">
                    Pilih Koneksi Cepat
                  </h2>
                  <p className="text-xs text-m3-on-surface-variant">
                    Beralih antar komputer/IP server Dapodik tersimpan
                  </p>
                </div>
              </div>

              {!isNewConnectionMode && (
                <M3Button
                  variant="tonal"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleAddNewConnectionMode}
                >
                  Tambah Koneksi Baru
                </M3Button>
              )}
            </div>

            {/* Quick Switch Dropdown */}
            <div className="space-y-2">
              <label
                htmlFor="quick-connection-select"
                className="block text-xs font-bold text-m3-on-surface-variant uppercase"
              >
                Profil Koneksi Tersimpan
              </label>

              <div className="relative">
                <select
                  id="quick-connection-select"
                  value={isNewConnectionMode ? "new" : activeConfig?.id || ""}
                  onChange={(e) => handleSwitchConnection(e.target.value)}
                  disabled={isSwitchingConfig || isLoadingConfig}
                  className="w-full bg-m3-surface border border-m3-outline-variant focus:border-2 focus:border-m3-primary rounded-xl py-3 pl-3.5 pr-10 text-xs font-medium text-m3-on-surface outline-none cursor-pointer appearance-none disabled:opacity-50"
                >
                  {configsList.length === 0 && (
                    <option value="">Belum ada konfigurasi tersimpan</option>
                  )}
                  {configsList.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.is_active ? "[AKTIF] " : ""}
                      {cfg.name} • {cfg.dapodik_host}:{cfg.dapodik_port} (Token:{" "}
                      {cfg.masked_token || "ada"})
                    </option>
                  ))}
                  <option value="new">
                    + Daftarkan Komputer / Token Baru...
                  </option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-m3-outline">
                  {isSwitchingConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin text-m3-primary" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-m3-on-surface-variant">
                    Status saat ini:
                  </span>
                  {activeConfig ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                      <span>
                        {activeConfig.name} ({activeConfig.dapodik_host})
                      </span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      Belum ada koneksi aktif
                    </span>
                  )}
                </div>

                {/* Delete button for inactive connections */}
                {!isNewConnectionMode &&
                  activeConfig &&
                  configsList.length > 1 &&
                  !activeConfig.is_active && (
                    <button
                      type="button"
                      onClick={() => setConfigToDelete(activeConfig)}
                      disabled={isDeletingConfig}
                      className="inline-flex items-center gap-1 text-[11px] text-m3-error hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus profil ini</span>
                    </button>
                  )}
              </div>
            </div>
          </M3Card>

          {/* Config Form Card */}
          <M3Card variant="outlined" className="p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-m3-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center font-bold">
                  <Server className="w-5 h-5 text-m3-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-m3-on-surface">
                    {isNewConnectionMode
                      ? "Tambah Profil Koneksi Baru"
                      : "Form Konfigurasi Server Dapodik"}
                  </h2>
                  <p className="text-xs text-m3-on-surface-variant">
                    {isNewConnectionMode
                      ? "Daftarkan nama koneksi dan token komputer/IP client baru"
                      : "Perbarui rincian koneksi aktif atau simpan perubahan"}
                  </p>
                </div>
              </div>

              {activeConfig?.updated_at && !isNewConnectionMode && (
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-m3-on-surface-variant bg-m3-surface-container px-3 py-1 rounded-full">
                  <Clock className="w-3 h-3 text-m3-outline" />
                  <span>
                    Diperbarui{" "}
                    {new Date(activeConfig.updated_at).toLocaleDateString(
                      "id-ID",
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Notification Alert */}
            {configMsg && (
              <div
                role="status"
                className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-in fade-in ${
                  configMsg.type === "success"
                    ? "bg-m3-secondary-container text-m3-on-secondary-container"
                    : "bg-m3-error-container text-m3-on-error-container"
                }`}
              >
                {configMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-m3-error shrink-0 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">{configMsg.text}</div>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <M3TextField
                label="Nama / Label Koneksi"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                required
                placeholder="Contoh: Server Lab RPL / PC TU 1 / Laptop Operator"
                helperText="Beri nama yang jelas untuk membedakan komputer atau lokasi jaringan Dapodik."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <M3TextField
                  label="Host / IP Server Dapodik"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                  placeholder="Contoh: 192.168.10.50 atau localhost"
                  helperText="IP komputer yang menjalankan aplikasi Dapodik"
                />

                <M3TextField
                  label="Port Web Service"
                  type="number"
                  value={String(port)}
                  onChange={(e) => setPort(Number(e.target.value))}
                  required
                  placeholder="5774"
                  helperText="Port default Dapodik: 5774"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <M3TextField
                  label="NPSN Sekolah"
                  value={npsn}
                  onChange={(e) => setNpsn(e.target.value)}
                  required
                  placeholder="Contoh: 20525607"
                  helperText="8 digit Nomor Pokok Sekolah Nasional resmi"
                />

                <M3TextField
                  label="Batas Waktu Timeout (detik)"
                  type="number"
                  value={String(timeoutSec)}
                  onChange={(e) => setTimeoutSec(Number(e.target.value))}
                  min={1}
                  max={60}
                  required
                  helperText="Waktu maksimal tunggu respon (rekomendasi: 10 detik)"
                />
              </div>

              {/* Web Service Token */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-m3-on-surface-variant uppercase">
                    Secret Token Web Service Dapodik
                  </span>
                  {!isNewConnectionMode && activeConfig?.masked_token && (
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                      Tersimpan: {activeConfig.masked_token}
                    </span>
                  )}
                </div>

                <M3TextField
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required={isNewConnectionMode || !activeConfig?.has_token}
                  placeholder={
                    !isNewConnectionMode && activeConfig?.has_token
                      ? "Kosongkan jika tidak ingin mengubah token yang tersimpan"
                      : "Tempel token Web Service dari Dapodik komputer ini..."
                  }
                  helperText="Dapodik hanya menerima token yang dihasilkan khusus untuk IP/komputer ini."
                  trailingIcon={
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      aria-label={showToken ? "Sembunyikan Token" : "Lihat Token"}
                      className="p-1 text-m3-outline hover:text-m3-on-surface rounded-full cursor-pointer"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                {isNewConnectionMode && (
                  <M3Button variant="text" onClick={handleCancelNewConnection}>
                    Batal
                  </M3Button>
                )}

                <M3Button
                  type="submit"
                  variant="filled"
                  disabled={isSavingConfig || isLoadingConfig}
                  icon={
                    isSavingConfig ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )
                  }
                >
                  {isSavingConfig
                    ? "Menyimpan..."
                    : isNewConnectionMode
                    ? "Simpan & Aktifkan Koneksi Baru"
                    : "Simpan Perubahan"}
                </M3Button>
              </div>
            </form>
          </M3Card>

          {/* Test Connection Card */}
          <M3Card variant="outlined" className="p-5 sm:p-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <PlugZap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-m3-on-surface">
                    Uji Koneksi Real-Time
                  </h2>
                  <p className="text-xs text-m3-on-surface-variant">
                    Ping langsung ke Web Service Dapodik sebelum sinkronisasi
                  </p>
                </div>
              </div>

              <M3Button
                variant="tonal"
                onClick={handleTestConnection}
                disabled={isTesting}
                icon={
                  isTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlugZap className="w-3.5 h-3.5" />
                  )
                }
              >
                {isTesting ? "Menguji..." : "Test Koneksi"}
              </M3Button>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-2xl text-xs space-y-2 animate-in fade-in ${
                  testResult.status === "success"
                    ? "bg-emerald-100 text-emerald-950 border border-emerald-200"
                    : "bg-m3-error-container text-m3-on-error-container"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    {testResult.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-m3-error" />
                    )}
                    {testResult.status === "success"
                      ? "Koneksi Berhasil"
                      : "Koneksi Gagal"}
                  </span>
                  <span className="font-mono text-[10px] bg-white/60 px-2 py-0.5 rounded-full font-bold">
                    Latensi: {testResult.latency_ms} ms
                  </span>
                </div>
                <p className="leading-relaxed">{testResult.message}</p>
                {testResult.server && (
                  <p className="text-[10px] font-mono text-m3-on-surface-variant">
                    Target: {testResult.server}
                  </p>
                )}
              </div>
            )}
          </M3Card>
        </div>

        {/* Right Column: Sync Panel & Results (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <M3Card variant="outlined" className="p-6 sm:p-7 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-m3-outline-variant/20">
              <div className="w-10 h-10 rounded-2xl bg-m3-secondary-container text-m3-on-secondary-container flex items-center justify-center font-bold">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-m3-on-surface">
                  Sinkronisasi Data
                </h2>
                <p className="text-xs text-m3-on-surface-variant">
                  Pilih komponen yang akan ditarik
                </p>
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() =>
                  setSyncOptions({
                    ...syncOptions,
                    sync_gtk: !syncOptions.sync_gtk,
                  })
                }
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-m3-surface-container cursor-pointer transition border border-transparent hover:border-m3-outline-variant/30 text-left"
              >
                {syncOptions.sync_gtk ? (
                  <CheckSquare className="w-5 h-5 text-m3-primary shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-m3-outline shrink-0" />
                )}
                <div className="text-xs">
                  <p className="font-bold text-m3-on-surface">
                    Guru & Tenaga Kependidikan
                  </p>
                  <p className="text-[10px] text-m3-on-surface-variant">
                    Tarik data guru pengajar dari getGtk
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSyncOptions({
                    ...syncOptions,
                    sync_rombel: !syncOptions.sync_rombel,
                  })
                }
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-m3-surface-container cursor-pointer transition border border-transparent hover:border-m3-outline-variant/30 text-left"
              >
                {syncOptions.sync_rombel ? (
                  <CheckSquare className="w-5 h-5 text-m3-primary shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-m3-outline shrink-0" />
                )}
                <div className="text-xs">
                  <p className="font-bold text-m3-on-surface">
                    Rombel & Wali Kelas
                  </p>
                  <p className="text-[10px] text-m3-on-surface-variant">
                    Tingkat kelas & penetapan wali kelas otomatis
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSyncOptions({
                    ...syncOptions,
                    sync_siswa: !syncOptions.sync_siswa,
                  })
                }
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-m3-surface-container cursor-pointer transition border border-transparent hover:border-m3-outline-variant/30 text-left"
              >
                {syncOptions.sync_siswa ? (
                  <CheckSquare className="w-5 h-5 text-m3-primary shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-m3-outline shrink-0" />
                )}
                <div className="text-xs">
                  <p className="font-bold text-m3-on-surface">
                    Peserta Didik (Siswa)
                  </p>
                  <p className="text-[10px] text-m3-on-surface-variant">
                    NISN, NIS, nama, tanggal lahir, rombel
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSyncOptions({
                    ...syncOptions,
                    sync_pembelajaran: !syncOptions.sync_pembelajaran,
                  })
                }
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-m3-surface-container cursor-pointer transition border border-transparent hover:border-m3-outline-variant/30 text-left"
              >
                {syncOptions.sync_pembelajaran ? (
                  <CheckSquare className="w-5 h-5 text-m3-primary shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-m3-outline shrink-0" />
                )}
                <div className="text-xs">
                  <p className="font-bold text-m3-on-surface">
                    Mata Pelajaran & Penugasan
                  </p>
                  <p className="text-[10px] text-m3-on-surface-variant">
                    Ekstrak mapel & mapping guru pengampu kelas
                  </p>
                </div>
              </button>

              {/* Dry-run Toggle */}
              <div className="pt-2 border-t border-m3-outline-variant/20">
                <button
                  type="button"
                  onClick={() =>
                    setSyncOptions({
                      ...syncOptions,
                      dry_run: !syncOptions.dry_run,
                    })
                  }
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 cursor-pointer text-left"
                >
                  <div className="text-xs">
                    <p className="font-bold text-amber-900">
                      Mode Simulasi (Dry Run)
                    </p>
                    <p className="text-[10px] text-amber-700">
                      Hitung perubahan tanpa menulis ke database
                    </p>
                  </div>
                  {syncOptions.dry_run ? (
                    <CheckSquare className="w-5 h-5 text-amber-600 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-m3-outline shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* Sync Trigger Button */}
            <M3Button
              variant="filled"
              size="lg"
              className="w-full"
              onClick={handleSync}
              disabled={isSyncing}
              icon={
                isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )
              }
            >
              {isSyncing ? "Sedang Menyelaraskan Data..." : "Mulai Sinkronisasi Sekarang"}
            </M3Button>
          </M3Card>

          {/* Sync Error Alert */}
          {syncError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-m3-error-container text-m3-on-error-container text-xs font-semibold flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-bold mb-0.5">Gagal Sinkronisasi</p>
                <p>{syncError}</p>
              </div>
            </div>
          )}

          {/* Sync Result Summary Table */}
          {syncResult && (
            <M3Card variant="elevated" className="p-6 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-m3-outline-variant/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-m3-on-surface">
                    Ringkasan Hasil
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {syncResult.mock_data_detected && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Mock Data (Dev)
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-bold bg-m3-surface-container text-m3-on-surface-variant px-2 py-0.5 rounded-full">
                    {syncResult.duration_ms} ms
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-m3-outline-variant/20 text-m3-on-surface-variant text-left">
                      <th className="pb-2 font-bold">Kategori</th>
                      <th className="pb-2 text-center text-emerald-600 font-bold">
                        Baru
                      </th>
                      <th className="pb-2 text-center text-amber-600 font-bold">
                        Update
                      </th>
                      <th className="pb-2 text-center text-m3-outline font-bold">
                        Skip
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-m3-outline-variant/10 text-m3-on-surface">
                    <tr>
                      <td className="py-2 font-medium">Guru (GTK)</td>
                      <td className="py-2 text-center font-bold text-emerald-600">
                        {syncResult.summary.gtk?.created || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-amber-600">
                        {syncResult.summary.gtk?.updated || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-m3-outline">
                        {syncResult.summary.gtk?.skipped || 0}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">Rombel</td>
                      <td className="py-2 text-center font-bold text-emerald-600">
                        {syncResult.summary.rombel?.created || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-amber-600">
                        {syncResult.summary.rombel?.updated || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-m3-outline">
                        {syncResult.summary.rombel?.skipped || 0}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">Peserta Didik</td>
                      <td className="py-2 text-center font-bold text-emerald-600">
                        {syncResult.summary.siswa?.created || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-amber-600">
                        {syncResult.summary.siswa?.updated || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-m3-outline">
                        {syncResult.summary.siswa?.skipped || 0}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">Mata Pelajaran</td>
                      <td className="py-2 text-center font-bold text-emerald-600">
                        {syncResult.summary.mapel?.created || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-amber-600">
                        {syncResult.summary.mapel?.updated || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-m3-outline">
                        {syncResult.summary.mapel?.skipped || 0}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">Penugasan Guru</td>
                      <td className="py-2 text-center font-bold text-emerald-600">
                        {syncResult.summary.penugasan?.created || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-amber-600">
                        {syncResult.summary.penugasan?.updated || 0}
                      </td>
                      <td className="py-2 text-center font-bold text-m3-outline">
                        {syncResult.summary.penugasan?.skipped || 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Change Details Log */}
              {syncResult.details && syncResult.details.length > 0 && (
                <div className="pt-2 border-t border-m3-outline-variant/20 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between text-xs font-bold text-m3-on-surface-variant hover:text-m3-on-surface cursor-pointer"
                  >
                    <span>Detail Perubahan ({syncResult.details.length})</span>
                    {showDetails ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showDetails && (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-m3-surface-container text-[11px] text-m3-on-surface-variant">
                      {syncResult.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-m3-primary font-bold">•</span>
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </M3Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation M3 Dialog */}
      <M3Dialog
        isOpen={Boolean(configToDelete)}
        onClose={() => setConfigToDelete(null)}
        title="Hapus Profil Koneksi"
        icon={<AlertTriangle className="w-5 h-5 text-m3-error" />}
        actions={
          <>
            <M3Button variant="text" onClick={() => setConfigToDelete(null)}>
              Batal
            </M3Button>
            <M3Button
              variant="danger"
              disabled={isDeletingConfig}
              onClick={confirmDeleteConnection}
              icon={isDeletingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isDeletingConfig ? "Menghapus..." : "Ya, Hapus"}
            </M3Button>
          </>
        }
      >
        <p className="text-xs sm:text-sm text-m3-on-surface-variant leading-relaxed">
          Apakah Anda yakin ingin menghapus profil koneksi{" "}
          <strong className="text-m3-on-surface">{configToDelete?.name}</strong>?
          Tindakan ini tidak dapat dibatalkan.
        </p>
      </M3Dialog>
    </div>
  );
};
