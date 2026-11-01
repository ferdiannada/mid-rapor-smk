import React, { useState, useEffect, useId, useRef } from 'react';
import {
  Building2,
  Save,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
  HelpCircle,
  ImageIcon,
  MapPin,
  Phone,
  Mail,
  Globe,
  UserCheck,
  Calendar,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { schoolService } from '../services/school.service';
import { SchoolProfile } from '../types';
import { M3Card, M3Button, M3TextField, M3Chip } from '../components/m3';
import { Skeleton } from '../components/common/Skeleton';

export const SchoolSettings: React.FC = () => {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogoKiri, setIsUploadingLogoKiri] = useState(false);
  const [isUploadingLogoKanan, setIsUploadingLogoKanan] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const fileInputKiriRef = useRef<HTMLInputElement>(null);
  const fileInputKananRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [namaSekolah, setNamaSekolah] = useState('');
  const [npsn, setNpsn] = useState('');
  const [nss, setNss] = useState('');
  const [bentukPendidikan, setBentukPendidikan] = useState('SMK');
  const [statusSekolah, setStatusSekolah] = useState('Negeri');
  const [alamat, setAlamat] = useState('');
  const [desaKelurahan, setDesaKelurahan] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [kabupatenKota, setKabupatenKota] = useState('');
  const [provinsi, setProvinsi] = useState('');
  const [kodePos, setKodePos] = useState('');
  const [telepon, setTelepon] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [kopBaris1, setKopBaris1] = useState('');
  const [kopBaris2, setKopBaris2] = useState('');
  const [kopBaris3, setKopBaris3] = useState('');
  const [logoKiri, setLogoKiri] = useState('');
  const [logoKanan, setLogoKanan] = useState('');
  const [kepalaSekolahNama, setKepalaSekolahNama] = useState('');
  const [kepalaSekolahNIP, setKepalaSekolahNIP] = useState('');
  const [titimangsaTempat, setTitimangsaTempat] = useState('');
  const [tanggalRaporPTS, setTanggalRaporPTS] = useState('');
  const [tanggalRaporPAS, setTanggalRaporPAS] = useState('');

  const bentukPendidikanId = useId();
  const statusSekolahId = useId();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await schoolService.getProfile();
      const p = res.profile;
      setProfile(p);

      setNamaSekolah(p.nama_sekolah || '');
      setNpsn(p.npsn || '');
      setNss(p.nss || '');
      setBentukPendidikan(p.bentuk_pendidikan || 'SMK');
      setStatusSekolah(p.status_sekolah || 'Negeri');
      setAlamat(p.alamat || '');
      setDesaKelurahan(p.desa_kelurahan || '');
      setKecamatan(p.kecamatan || '');
      setKabupatenKota(p.kabupaten_kota || '');
      setProvinsi(p.provinsi || '');
      setKodePos(p.kode_pos || '');
      setTelepon(p.telepon || '');
      setEmail(p.email || '');
      setWebsite(p.website || '');
      setKopBaris1(p.kop_baris_1 || '');
      setKopBaris2(p.kop_baris_2 || '');
      setKopBaris3(p.kop_baris_3 || '');
      setLogoKiri(p.logo_kiri || '');
      setLogoKanan(p.logo_kanan || '');
      setKepalaSekolahNama(p.kepala_sekolah_nama || '');
      setKepalaSekolahNIP(p.kepala_sekolah_nip || '');
      setTitimangsaTempat(p.titimangsa_tempat || '');
      setTanggalRaporPTS(p.tanggal_rapor_pts || '');
      setTanggalRaporPAS(p.tanggal_rapor_pas || '');
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat profil identitas sekolah');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    setter(val);
    setHasUnsavedChanges(true);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    position: 'kiri' | 'kanan'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Ukuran file logo tidak boleh melebihi 2 MB');
      return;
    }

    if (position === 'kiri') {
      setIsUploadingLogoKiri(true);
    } else {
      setIsUploadingLogoKanan(true);
    }
    setErrorMsg(null);

    try {
      const res = await schoolService.uploadLogo(file);
      if (position === 'kiri') {
        setLogoKiri(res.data_url);
      } else {
        setLogoKanan(res.data_url);
      }
      setHasUnsavedChanges(true);
      setSuccessMsg(`Logo ${position === 'kiri' ? 'sekolah (kiri)' : 'instansi (kanan)'} berhasil dimuat.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunggah logo');
    } finally {
      if (position === 'kiri') {
        setIsUploadingLogoKiri(false);
        if (fileInputKiriRef.current) fileInputKiriRef.current.value = '';
      } else {
        setIsUploadingLogoKanan(false);
        if (fileInputKananRef.current) fileInputKananRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = (position: 'kiri' | 'kanan') => {
    if (position === 'kiri') {
      setLogoKiri('');
    } else {
      setLogoKanan('');
    }
    setHasUnsavedChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaSekolah.trim()) {
      setErrorMsg('Nama sekolah wajib diisi.');
      return;
    }
    if (!npsn.trim()) {
      setErrorMsg('NPSN wajib diisi.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: Partial<SchoolProfile> = {
        nama_sekolah: namaSekolah.trim(),
        npsn: npsn.trim(),
        nss: nss.trim(),
        bentuk_pendidikan: bentukPendidikan,
        status_sekolah: statusSekolah,
        alamat: alamat.trim(),
        desa_kelurahan: desaKelurahan.trim(),
        kecamatan: kecamatan.trim(),
        kabupaten_kota: kabupatenKota.trim(),
        provinsi: provinsi.trim(),
        kode_pos: kodePos.trim(),
        telepon: telepon.trim(),
        email: email.trim(),
        website: website.trim(),
        kop_baris_1: kopBaris1.trim(),
        kop_baris_2: kopBaris2.trim(),
        kop_baris_3: kopBaris3.trim(),
        logo_kiri: logoKiri,
        logo_kanan: logoKanan,
        kepala_sekolah_nama: kepalaSekolahNama.trim(),
        kepala_sekolah_nip: kepalaSekolahNIP.trim(),
        titimangsa_tempat: titimangsaTempat.trim(),
        tanggal_rapor_pts: tanggalRaporPTS.trim(),
        tanggal_rapor_pas: tanggalRaporPAS.trim(),
      };

      const res = await schoolService.updateProfile(payload);
      setProfile(res.profile);
      setHasUnsavedChanges(false);
      setSuccessMsg('Identitas sekolah berhasil disimpan dan akan langsung digunakan pada cetak rapor.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan identitas sekolah');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-m3-on-surface tracking-tight">
                Identitas Sekolah
              </h1>
              <p className="text-xs text-m3-on-surface-variant">
                Pengelolaan data identitas sekolah, logo, kop surat, dan informasi penandatanganan untuk cetak rapor.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <M3Chip
              className="border-amber-300 bg-amber-50 text-amber-950 font-medium text-xs cursor-default"
            >
              Perubahan belum disimpan
            </M3Chip>
          )}
          <M3Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            icon={isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </M3Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-m3-error-container text-m3-on-error-container border border-m3-error/20 text-xs flex items-center justify-between animate-fadeIn"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-m3-error shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="font-bold hover:underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs flex items-center justify-between animate-fadeIn"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="font-bold hover:underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Live Kop Surat Preview */}
      <M3Card variant="elevated" className="p-4 sm:p-6 space-y-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-m3-outline-variant/30 pb-2.5">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-m3-primary" />
            <h2 className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
              Pratinjau Kop Dokumen Rapor
            </h2>
          </div>
          <span className="text-[11px] text-m3-on-surface-variant italic">
            Tampilan live kop surat pada lembar rapor A4
          </span>
        </div>

        <div className="bg-slate-50 p-3 sm:p-6 rounded-2xl border border-slate-200 overflow-x-auto">
          <div className="min-w-[580px] bg-white p-4 sm:p-6 rounded-xl border border-slate-300 font-serif shadow-xs">
            <div className="border-b-4 border-double border-black pb-3">
              <div className="flex items-center justify-between gap-3">
                {/* Logo Kiri */}
                {logoKiri ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                    <img
                      src={logoKiri}
                      alt="Logo Sekolah"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-[10px] text-slate-400 p-1 text-center font-sans">
                    <ImageIcon className="w-4 h-4 mb-0.5 opacity-40" />
                    <span>Logo Kiri</span>
                  </div>
                )}

                {/* Text Kop Surat */}
                <div className="flex-1 text-center min-w-0">
                  {kopBaris1 ? (
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider m-0 leading-tight">
                      {kopBaris1}
                    </h3>
                  ) : (
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider m-0 text-slate-300 italic">
                      [Kop Baris 1: Pemerintah Provinsi / Yayasan]
                    </h3>
                  )}

                  {kopBaris2 && (
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider m-0 leading-tight">
                      {kopBaris2}
                    </h3>
                  )}

                  {kopBaris3 && (
                    <h4 className="text-[11px] font-bold uppercase tracking-wider m-0 text-slate-800 leading-tight">
                      {kopBaris3}
                    </h4>
                  )}

                  <h1 className="text-base sm:text-lg font-black uppercase m-0.5 tracking-wide text-black leading-tight">
                    {namaSekolah || '[NAMA SEKOLAH]'}
                  </h1>

                  <p className="text-[10.5px] italic text-slate-700 m-0 leading-tight">
                    {alamat || '[Alamat Sekolah]'}
                    {kecamatan ? `, Kec. ${kecamatan}` : ''}
                    {kabupatenKota ? `, ${kabupatenKota}` : ''}
                    {kodePos ? ` ${kodePos}` : ''}
                  </p>

                  <p className="text-[10px] text-slate-600 m-0 leading-tight">
                    {telepon ? `Telp: ${telepon} ` : ''}
                    {email ? `• Email: ${email} ` : ''}
                    {website ? `• Web: ${website} ` : ''}
                    • NPSN: {npsn || '-'}
                    {nss ? ` • NSS: ${nss}` : ''}
                  </p>
                </div>

                {/* Logo Kanan */}
                {logoKanan ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                    <img
                      src={logoKanan}
                      alt="Logo Pemda"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : logoKiri ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 pointer-events-none opacity-0" aria-hidden="true" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-[10px] text-slate-400 p-1 text-center font-sans">
                    <ImageIcon className="w-4 h-4 mb-0.5 opacity-40" />
                    <span>Logo Kanan</span>
                  </div>
                )}
              </div>
            </div>

            {/* Titimangsa preview snippet */}
            <div className="mt-3 text-right text-[11px] text-slate-600">
              <span className="italic">
                Titimangsa Rapor:{' '}
                <strong>
                  {titimangsaTempat || kabupatenKota || 'Kota Sekolah'},{' '}
                  {tanggalRaporPTS || 'Tanggal Otomatis'}
                </strong>{' '}
                • Kepala Sekolah: <strong>{kepalaSekolahNama || '-'}</strong>
              </span>
            </div>
          </div>
        </div>
      </M3Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Logo Sekolah & Logo Instansi */}
        <M3Card variant="filled" className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-m3-outline-variant/30 pb-2.5">
            <ImageIcon className="w-4 h-4 text-m3-primary" />
            <h2 className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
              Logo Sekolah & Lembaga
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Kiri (Logo Sekolah Utama) */}
            <div className="p-4 rounded-2xl bg-m3-surface border border-m3-outline-variant/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-m3-on-surface block">
                    Logo Utama (Kiri)
                  </label>
                  <span className="text-[11px] text-m3-on-surface-variant">
                    Logo resmi sekolah (posisi kiri kop surat)
                  </span>
                </div>
                {logoKiri && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLogo('kiri')}
                    className="text-m3-error hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-m3-surface-container-high border border-m3-outline-variant flex items-center justify-center overflow-hidden shrink-0">
                  {logoKiri ? (
                    <img
                      src={logoKiri}
                      alt="Logo Kiri"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-m3-outline opacity-40" />
                  )}
                </div>

                <div className="space-y-2 flex-1 min-w-0">
                  <input
                    ref={fileInputKiriRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => handleFileUpload(e, 'kiri')}
                    className="hidden"
                    id="upload-logo-kiri"
                  />
                  <label
                    htmlFor="upload-logo-kiri"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-m3-primary/10 hover:bg-m3-primary/20 text-m3-primary text-xs font-semibold cursor-pointer transition-colors min-h-[40px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isUploadingLogoKiri ? 'Memproses...' : logoKiri ? 'Ganti Logo Kiri' : 'Unggah Logo Kiri'}
                  </label>
                  <p className="text-[10.5px] text-m3-on-surface-variant">
                    Format PNG transparan, JPG, SVG, atau WEBP. Maks. 2 MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Logo Kanan (Logo Pemda / Tut Wuri Handayani - Opsional) */}
            <div className="p-4 rounded-2xl bg-m3-surface border border-m3-outline-variant/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-m3-on-surface block">
                    Logo Sekunder (Kanan - Opsional)
                  </label>
                  <span className="text-[11px] text-m3-on-surface-variant">
                    Logo Pemprov / Tut Wuri Handayani / Yayasan
                  </span>
                </div>
                {logoKanan && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLogo('kanan')}
                    className="text-m3-error hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-m3-surface-container-high border border-m3-outline-variant flex items-center justify-center overflow-hidden shrink-0">
                  {logoKanan ? (
                    <img
                      src={logoKanan}
                      alt="Logo Kanan"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-m3-outline opacity-40" />
                  )}
                </div>

                <div className="space-y-2 flex-1 min-w-0">
                  <input
                    ref={fileInputKananRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => handleFileUpload(e, 'kanan')}
                    className="hidden"
                    id="upload-logo-kanan"
                  />
                  <label
                    htmlFor="upload-logo-kanan"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-m3-primary/10 hover:bg-m3-primary/20 text-m3-primary text-xs font-semibold cursor-pointer transition-colors min-h-[40px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isUploadingLogoKanan ? 'Memproses...' : logoKanan ? 'Ganti Logo Kanan' : 'Unggah Logo Kanan'}
                  </label>
                  <p className="text-[10.5px] text-m3-on-surface-variant">
                    Opsional. Ditempatkan di sisi kanan kop surat rapor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </M3Card>

        {/* Section 2: Data Legalitas & Format Kop Surat */}
        <M3Card variant="filled" className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-m3-outline-variant/30 pb-2.5">
            <Layers className="w-4 h-4 text-m3-primary" />
            <h2 className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
              Format Teks Kop Surat Rapor
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <M3TextField
              label="Kop Baris 1 (Instansi / Pemda)"
              placeholder="Contoh: PEMERINTAH PROVINSI JAWA TIMUR"
              value={kopBaris1}
              onChange={(e) => handleFieldChange(setKopBaris1, e.target.value)}
              helperText="Baris teratas pada kop (huruf kapital)"
            />

            <M3TextField
              label="Kop Baris 2 (Dinas / Badan)"
              placeholder="Contoh: DINAS PENDIDIKAN"
              value={kopBaris2}
              onChange={(e) => handleFieldChange(setKopBaris2, e.target.value)}
              helperText="Baris kedua pada kop surat"
            />

            <M3TextField
              label="Kop Baris 3 (Cabang Dinas / UPTD - Opsional)"
              placeholder="Contoh: CABANG DINAS PENDIDIKAN WILAYAH BANYUWANGI"
              value={kopBaris3}
              onChange={(e) => handleFieldChange(setKopBaris3, e.target.value)}
              helperText="Opsional, baris ketiga sebelum nama sekolah"
            />
          </div>
        </M3Card>

        {/* Section 3: Data Utama & Legalitas Sekolah */}
        <M3Card variant="filled" className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-m3-outline-variant/30 pb-2.5">
            <Building2 className="w-4 h-4 text-m3-primary" />
            <h2 className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
              Identitas Utama Sekolah
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <M3TextField
                label="Nama Resmi Sekolah *"
                placeholder="Contoh: SMK Negeri 1 Banyuwangi"
                value={namaSekolah}
                onChange={(e) => handleFieldChange(setNamaSekolah, e.target.value)}
                required
                helperText="Nama lengkap satuan pendidikan"
              />
            </div>

            <M3TextField
              label="NPSN *"
              placeholder="Contoh: 20525633"
              value={npsn}
              onChange={(e) => handleFieldChange(setNpsn, e.target.value)}
              required
              helperText="Nomor Pokok Sekolah Nasional"
            />

            <M3TextField
              label="NSS / NDS (Nomor Statistik Sekolah)"
              placeholder="Contoh: 401052501001"
              value={nss}
              onChange={(e) => handleFieldChange(setNss, e.target.value)}
              helperText="Opsional, ditampilkan di samping NPSN"
            />

            {/* Bentuk Pendidikan Select */}
            <div className="flex flex-col gap-1 w-full">
              <label
                htmlFor={bentukPendidikanId}
                className="text-xs font-semibold px-1 tracking-wide text-m3-on-surface-variant"
              >
                Bentuk Pendidikan
              </label>
              <select
                id={bentukPendidikanId}
                value={bentukPendidikan}
                onChange={(e) => handleFieldChange(setBentukPendidikan, e.target.value)}
                className="w-full bg-m3-surface text-m3-on-surface text-xs sm:text-sm rounded-xl py-2.5 px-3.5 border border-m3-outline-variant hover:border-m3-outline focus:border-2 focus:border-m3-primary outline-none transition-all"
              >
                <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
                <option value="MAK">MAK (Madrasah Aliyah Kejuruan)</option>
              </select>
            </div>

            {/* Status Sekolah Select */}
            <div className="flex flex-col gap-1 w-full">
              <label
                htmlFor={statusSekolahId}
                className="text-xs font-semibold px-1 tracking-wide text-m3-on-surface-variant"
              >
                Status Sekolah
              </label>
              <select
                id={statusSekolahId}
                value={statusSekolah}
                onChange={(e) => handleFieldChange(setStatusSekolah, e.target.value)}
                className="w-full bg-m3-surface text-m3-on-surface text-xs sm:text-sm rounded-xl py-2.5 px-3.5 border border-m3-outline-variant hover:border-m3-outline focus:border-2 focus:border-m3-primary outline-none transition-all"
              >
                <option value="Negeri">Negeri</option>
                <option value="Swasta">Swasta</option>
              </select>
            </div>
          </div>
        </M3Card>

        {/* Section 4: Alamat & Kontak Resmi */}
        <M3Card variant="filled" className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-m3-outline-variant/30 pb-2.5">
            <MapPin className="w-4 h-4 text-m3-primary" />
            <h2 className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
              Alamat & Kontak Sekolah
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <M3TextField
                label="Alamat Jalan / Gedung"
                placeholder="Contoh: Jl. Wijaya Kusuma No. 46"
                value={alamat}
                onChange={(e) => handleFieldChange(setAlamat, e.target.value)}
                helperText="Nama jalan, nomor, RT/RW"
              />
            </div>

            <M3TextField
              label="Kode Pos"
              placeholder="Contoh: 68425"
              value={kodePos}
              onChange={(e) => handleFieldChange(setKodePos, e.target.value)}
            />

            <M3TextField
              label="Desa / Kelurahan"
              placeholder="Contoh: Mojopanggung"
              value={desaKelurahan}
              onChange={(e) => handleFieldChange(setDesaKelurahan, e.target.value)}
            />

            <M3TextField
              label="Kecamatan"
              placeholder="Contoh: Giri"
              value={kecamatan}
              onChange={(e) => handleFieldChange(setKecamatan, e.target.value)}
            />

            <M3TextField
              label="Kabupaten / Kota"
              placeholder="Contoh: Kabupaten Banyuwangi"
              value={kabupatenKota}
              onChange={(e) => handleFieldChange(setKabupatenKota, e.target.value)}
            />

            <M3TextField
              label="Provinsi"
              placeholder="Contoh: Jawa Timur"
              value={provinsi}
              onChange={(e) => handleFieldChange(setProvinsi, e.target.value)}
            />

            <M3TextField
              label="Nomor Telepon"
              placeholder="Contoh: 0333-424541"
              value={telepon}
              onChange={(e) => handleFieldChange(setTelepon, e.target.value)}
              leadingIcon={<Phone className="w-3.5 h-3.5" />}
            />

            <M3TextField
              label="Email Resmi"
              placeholder="Contoh: info@smkn1bwi.sch.id"
              value={email}
              onChange={(e) => handleFieldChange(setEmail, e.target.value)}
              leadingIcon={<Mail className="w-3.5 h-3.5" />}
            />

            <div className="md:col-span-3">
              <M3TextField
                label="Website Resmi"
                placeholder="Contoh: https://smkn1bwi.sch.id"
                value={website}
                onChange={(e) => handleFieldChange(setWebsite, e.target.value)}
                leadingIcon={<Globe className="w-3.5 h-3.5" />}
              />
            </div>
          </div>
        </M3Card>

        {/* Section 5: Kepala Sekolah & Titimangsa Rapor */}
        <M3Card variant="filled" className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-m3-outline-variant/30 pb-2.5">
            <UserCheck className="w-4 h-4 text-m3-primary" />
            <h2 className="text-xs font-bold text-m3-on-surface uppercase tracking-wider">
              Kepala Sekolah & Titimangsa Rapor
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <M3TextField
              label="Nama Lengkap Kepala Sekolah"
              placeholder="Contoh: Drs. H. Mulyadi, M.Pd."
              value={kepalaSekolahNama}
              onChange={(e) => handleFieldChange(setKepalaSekolahNama, e.target.value)}
              helperText="Lengkap dengan gelar akademik"
            />

            <M3TextField
              label="NIP / NIK Kepala Sekolah"
              placeholder="Contoh: 196805121994031004 atau '-'"
              value={kepalaSekolahNIP}
              onChange={(e) => handleFieldChange(setKepalaSekolahNIP, e.target.value)}
              helperText="Isi tanda '-' jika swasta atau non-NIP"
            />

            <M3TextField
              label="Tempat Titimangsa Rapor (Kota/Kabupaten)"
              placeholder="Contoh: Banyuwangi"
              value={titimangsaTempat}
              onChange={(e) => handleFieldChange(setTitimangsaTempat, e.target.value)}
              helperText="Dicantumkan di atas tanggal wali kelas: [Tempat], [Tanggal]"
            />

            <M3TextField
              label="Tanggal Cetak Rapor Tengah Semester (PTS/STS)"
              placeholder="Contoh: 20 Oktober 2026 (Kosongkan jika otomatis)"
              value={tanggalRaporPTS}
              onChange={(e) => handleFieldChange(setTanggalRaporPTS, e.target.value)}
              helperText="Jika dikosongkan, menggunakan tanggal saat ini secara otomatis"
            />

            <M3TextField
              label="Tanggal Cetak Rapor Akhir Semester (PAS/SAS)"
              placeholder="Contoh: 20 Desember 2026 (Kosongkan jika otomatis)"
              value={tanggalRaporPAS}
              onChange={(e) => handleFieldChange(setTanggalRaporPAS, e.target.value)}
              helperText="Digunakan saat semester berjenis akhir semester"
            />
          </div>
        </M3Card>

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-m3-surface border border-m3-outline-variant/30">
          <div className="text-xs text-m3-on-surface-variant flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-m3-primary shrink-0" />
            <span>Perubahan data identitas sekolah akan otomatis diperbarui pada seluruh dokumen cetak rapor.</span>
          </div>

          <M3Button
            type="submit"
            disabled={isSaving}
            icon={isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Identitas Sekolah'}
          </M3Button>
        </div>
      </form>
    </div>
  );
};
