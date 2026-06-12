/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Building2, 
  Upload, 
  Image as ImageIcon,
  CheckCircle, 
  MapPin, 
  User, 
  FileText, 
  RefreshCw,
  HelpCircle,
  Hash
} from 'lucide-react';
import { SchoolSettings } from '../types';

interface SchoolSettingsPanelProps {
  settings: SchoolSettings;
  onUpdateSettings: (newSettings: SchoolSettings) => void;
  onResetSettings: () => void;
}

export default function SchoolSettingsPanel({
  settings,
  onUpdateSettings,
  onResetSettings
}: SchoolSettingsPanelProps) {
  const [formData, setFormData] = useState<SchoolSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kopFileInputRef = useRef<HTMLInputElement>(null);
  const stampFileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setIsSaved(false);
  };

  const handleToggleBoolean = (name: 'useCustomKopImage' | 'useCustomStampImage', val: boolean) => {
    setFormData(prev => ({
      ...prev,
      [name]: val
    }));
    setIsSaved(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 2) { // 2MB Limit
      setErrorMsg('Ukuran logo sekolah tidak boleh melebihi 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData(prev => ({
          ...prev,
          logoUrl: reader.result as string
        }));
        setIsSaved(false);
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleKopUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 3) { // 3MB Limit
      setErrorMsg('Ukuran gambar kop surat tidak boleh melebihi 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData(prev => ({
          ...prev,
          kopImageUrl: reader.result as string,
          useCustomKopImage: true
        }));
        setIsSaved(false);
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 2) { // 2MB Limit
      setErrorMsg('Ukuran gambar stempel tidak boleh melebihi 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData(prev => ({
          ...prev,
          stampImageUrl: reader.result as string,
          useCustomStampImage: true
        }));
        setIsSaved(false);
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({
      ...prev,
      logoUrl: ''
    }));
    setIsSaved(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveKop = () => {
    setFormData(prev => ({
      ...prev,
      kopImageUrl: '',
      useCustomKopImage: false
    }));
    setIsSaved(false);
    if (kopFileInputRef.current) {
      kopFileInputRef.current.value = '';
    }
  };

  const handleRemoveStamp = () => {
    setFormData(prev => ({
      ...prev,
      stampImageUrl: '',
      useCustomStampImage: false
    }));
    setIsSaved(false);
    if (stampFileInputRef.current) {
      stampFileInputRef.current.value = '';
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.schoolName.trim()) {
      setErrorMsg('Nama sekolah wajib diisi.');
      return;
    }
    if (!formData.kabupaten.trim()) {
      setErrorMsg('Nama Kabupaten/Kota wajib diisi.');
      return;
    }

    onUpdateSettings(formData);
    setIsSaved(true);
    setErrorMsg('');
    setTimeout(() => setIsSaved(false), 4000);
  };

  const handleReset = () => {
    if (window.confirm('Apakah Anda yakin ingin mengembalikan seluruh parameter sekolah ke pengaturan awal?')) {
      onResetSettings();
      // We will let the parent trigger the state reset, but we also update local form
      setTimeout(() => {
        setFormData({ ...settings });
        setIsSaved(false);
      }, 50);
    }
  };

  return (
    <div className="space-y-6" id="school-settings-panel">
      {/* Overview Info Header Banner */}
      <div className="bg-gradient-to-r from-green-800 to-emerald-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10">
          <Building2 size={240} className="stroke-[1]" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="bg-green-600 border border-green-500/30 text-[10px] font-mono font-extrabold tracking-widest px-2.5 py-0.5 rounded-full uppercase">
              Konfigurasi Instansi
            </span>
            <h1 className="text-xl md:text-2xl font-black tracking-tight font-sans">
              Identitas & Kop Surat Sekolah
            </h1>
            <p className="text-[12px] text-green-100 max-w-2xl leading-relaxed">
              Atur logo resmi, nama dinas, kabupaten, serta detail personil penandatangan untuk disesuaikan secara dinamis pada formulir, surat rencana rombel (PDF/Cetak), dan berkas ekspor excel.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="self-start md:self-center bg-green-900/30 hover:bg-green-900/50 text-green-100 border border-green-600/30 font-semibold text-[11px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={13} />
            <span>Reset Pengaturan Awal</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Visual Preview (Live Mockup) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Box 1: Kop Surat Live Preview */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-green-600 rounded-full"></span>
              Pratinjau Kop Surat Resmi
            </h3>
            
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 shadow-inner select-none pointer-events-none scale-[0.98] origin-top transition-all min-h-[140px] flex flex-col justify-center">
              {formData.useCustomKopImage ? (
                formData.kopImageUrl ? (
                  <div className="w-full flex items-center justify-center">
                    <img 
                      src={formData.kopImageUrl} 
                      alt="Kop Surat Kustom" 
                      className="w-full max-h-24 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="text-center p-6 border-2 border-dashed border-slate-300 rounded-lg text-slate-400">
                    <ImageIcon size={28} className="mx-auto mb-1.5 text-slate-300" />
                    <span className="text-[10px] font-bold block">BELUM ADA GAMBAR KOP</span>
                    <span className="text-[9px] block">Silakan unggah gambar di form kanan</span>
                  </div>
                )
              ) : (
                <>
                  {/* Kop Surat Header Inside */}
                  <div className="flex items-center justify-between border-b-[2px] border-double border-slate-900 pb-2 mb-2">
                    <div className="w-[18%] shrink-0 flex items-center justify-center">
                      {formData.logoUrl ? (
                        <img 
                          src={formData.logoUrl} 
                          alt="Logo Sekolah" 
                          className="w-10 h-10 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <svg className="w-9 h-9 text-emerald-800" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                          <path d="M50 12 L82 22 V55 C82 75 50 88 50 88 C50 88 18 75 18 55 V22 Z" fill="#15803d" fillOpacity="0.08" stroke="#15803d" strokeWidth="2.5"/>
                          <polygon points="50,18 53,24 60,24 55,28 57,34 50,30 43,34 45,28 40,24 47,24" fill="#eab308"/>
                        </svg>
                      )}
                    </div>
                    <div className="w-[82%] text-center font-serif leading-none">
                      <h4 className="text-[7.5px] uppercase font-bold text-slate-800">
                        PEMERINTAH KABUPATEN {formData.kabupaten || 'MUARA ENIM'}
                      </h4>
                      <h3 className="text-[8.5px] font-black uppercase text-slate-900 mt-0.5">
                        DINAS PENDIDIKAN DAN KEBUDAYAAN
                      </h3>
                      <h2 className="text-[10.5px] font-extrabold uppercase text-slate-950 mt-1">
                        {formData.schoolName || 'SMP NEGERI'}
                      </h2>
                      <p className="text-[5.5px] text-slate-500 font-sans mt-0.5">
                        NPSN: {formData.npsn} | Akreditasi: {formData.akreditasi} | {formData.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-center font-serif text-[7px] text-slate-800 leading-tight">
                    <p className="font-bold underline uppercase">Rencana Rombongan Belajar (Rombel) Baru</p>
                    <p>{formData.noSuratPrefix} / 2026</p>
                  </div>
                </>
              )}
            </div>
            
            <p className="text-[10.5px] text-slate-400 leading-relaxed text-center italic">
              {formData.useCustomKopImage 
                ? 'Gambar kop surat kustom di atas akan diletakkan di lembar cetak hasil rombel.'
                : 'Kop di atas akan digenerasi secara dinamis pada cetak surat PDF penempatan rombel siswa.'}
            </p>
          </div>

          {/* Box 2: Visual Stempel Resmi Preview */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
              Stempel Cap Basah {formData.useCustomStampImage ? 'Kustom' : 'Otomatis'}
            </h3>

            <div className="flex flex-col items-center justify-center p-3 bg-indigo-50/20 border border-indigo-100 rounded-xl min-h-[160px]">
              {formData.useCustomStampImage ? (
                formData.stampImageUrl ? (
                  <div className="relative w-28 h-28 transform rotate-[-4deg] mix-blend-multiply opacity-95 flex items-center justify-center">
                    <img 
                      src={formData.stampImageUrl} 
                      alt="Stempel Kustom" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="text-center p-6 border-2 border-dashed border-indigo-200 rounded-lg text-slate-400 w-full">
                    <ImageIcon size={28} className="mx-auto mb-1.5 text-indigo-300" />
                    <span className="text-[10px] font-bold block text-indigo-700">BELUM ADA STEMPEL STEMPEL</span>
                    <span className="text-[9px] block">Silakan unggah gambar di form kanan</span>
                  </div>
                )
              ) : (
                <div className="relative w-28 h-28 transform rotate-[-4deg] mix-blend-multiply opacity-90">
                  <svg className="w-28 h-28" viewBox="0 0 120 120">
                    <defs>
                      <path id="previewStampPath" d="M 60,60 m -45,0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0" />
                    </defs>
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#251b9e" strokeWidth="2.2" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#251b9e" strokeWidth="0.8" />
                    <circle cx="60" cy="60" r="32" fill="none" stroke="#251b9e" strokeWidth="1.5" />
                    
                    <text fill="#251b9e" fontSize="6.2" fontWeight="extrabold" letterSpacing="0.05">
                      <textPath href="#previewStampPath" startOffset="0%">
                        PEMERINTAH KABUPATEN {formData.kabupaten.toUpperCase() || 'SIDOARJO'} * DINAS PENDIDIKAN *
                      </textPath>
                    </text>
                    
                    <polygon points="60,40 63,46 70,46 65,50 67,56 60,52 53,56 55,50 50,46 57,46" fill="#251b9e" />
                    <text x="60" y="65" fill="#251b9e" fontSize="8" fontWeight="black" textAnchor="middle" letterSpacing="0.5">
                      {formData.schoolName.replace('SMP NEGERI', 'SMPN').split(' ').slice(0, 2).join(' ')}
                    </text>
                    <text x="60" y="73" fill="#251b9e" fontSize="5.5" fontWeight="black" textAnchor="middle">
                      {formData.kecamatan.toUpperCase() || 'MUARA ENIM'}
                    </text>
                    <path d="M 40,77 Q 60,82 80,77" fill="none" stroke="#251b9e" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              <p className="text-[10px] text-slate-400 text-center mt-2 px-3">
                {formData.useCustomStampImage 
                  ? 'Gunakan gambar stempel kustom berformat PNG dengan background transparan agar terlihat autentik.'
                  : 'Stempel melingkar otomatis di atas menyesuaikan nama kabupaten dan kecamatan yang Anda pilih di form.'}
              </p>
            </div>
          </div>
          
        </div>

        {/* RIGHT COLUMN: Edit Form (Responsive Grid) */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm space-y-6">
            
            {/* Save Confirmation Toast Row */}
            {isSaved && (
              <div id="settings-toast-success" className="bg-green-50 border border-green-200 text-green-800 p-3.5 rounded-xl flex items-center gap-2.5 transition-all animate-bounce">
                <CheckCircle size={17} className="text-green-600 shrink-0" />
                <span className="text-[11.5px] font-semibold">
                  Telah Disimpan! Profil dan Kop Surat Sekolah sudah diperbarui di sistem.
                </span>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div id="settings-toast-error" className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-[11.5px] font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Section 1: Logo & Profil Utama */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                <Building2 size={14} className="text-green-600" />
                Profil Umum Sekolah
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                {/* Logo uploader */}
                <div className="md:col-span-1 flex flex-col items-center justify-center p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Logo Sekolah</span>
                  
                  <div className="w-16 h-16 bg-white border border-slate-150 rounded-lg flex items-center justify-center overflow-hidden shadow-sm">
                    {formData.logoUrl ? (
                      <img 
                        src={formData.logoUrl} 
                        alt="Logo Preview" 
                        className="w-full h-full object-contain p-1"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-slate-300">
                        <ImageIcon size={30} />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full text-[9px] bg-white border border-slate-250 text-slate-700 py-1 px-1 rounded hover:bg-slate-100 font-bold"
                    >
                      Unggah
                    </button>
                    {formData.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-[9px] bg-red-50 hover:bg-red-100 border border-red-250 text-red-600 py-1 px-1 rounded font-bold"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Main fields */}
                <div className="md:col-span-3 space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Instansi Sekolah <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="schoolName"
                      value={formData.schoolName}
                      onChange={handleChange}
                      placeholder="Contoh: SMP NEGERI 2 MUARA ENIM"
                      className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        NPSN
                      </label>
                      <input
                        type="text"
                        name="npsn"
                        value={formData.npsn}
                        onChange={handleChange}
                        className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Peringkat Akreditasi
                      </label>
                      <select
                        name="akreditasi"
                        value={formData.akreditasi}
                        onChange={handleChange}
                        className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                      >
                        <option value="A">Terakreditasi A</option>
                        <option value="B">Terakreditasi B</option>
                        <option value="C">Terakreditasi C</option>
                        <option value="Belum Terakreditasi">Belum Terakreditasi</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1B: Opsi Kop & Stempel Gambar Kustom */}
            <div className="space-y-4 bg-slate-50/50 border border-slate-200/60 p-4 rounded-xl">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <ImageIcon size={14} className="text-green-600" />
                Kop & Stempel Gambar Kustom
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. Kop Surat Upload Block */}
                <div className="space-y-3">
                  <span className="text-[10.5px] font-bold text-slate-700 block">Mode Tampilan Kop Surat</span>
                  <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleBoolean('useCustomKopImage', false)}
                      className={`flex-1 text-[10.5px] py-1.5 rounded-md font-bold text-center transition-all ${
                        !formData.useCustomKopImage
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Teks Dinas Otomatis
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBoolean('useCustomKopImage', true)}
                      className={`flex-1 text-[10.5px] py-1.5 rounded-md font-bold text-center transition-all ${
                        formData.useCustomKopImage
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Unggah Kop Gambar
                    </button>
                  </div>

                  {formData.useCustomKopImage && (
                    <div className="bg-white border border-slate-200 p-3 rounded-lg flex flex-col items-center justify-center space-y-2">
                      <div className="w-full max-h-16 flex items-center justify-center p-1 bg-slate-50 rounded-lg border border-slate-150 overflow-hidden">
                        {formData.kopImageUrl ? (
                          <img 
                            src={formData.kopImageUrl} 
                            alt="Kop Preview" 
                            className="max-h-14 object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-[9px] text-slate-400">Belum ada gambar kop terpilih</span>
                        )}
                      </div>

                      <div className="flex gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => kopFileInputRef.current?.click()}
                          className="w-full text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 px-2 rounded-lg font-bold border border-slate-250 flex items-center justify-center gap-1.5"
                        >
                          <Upload size={12} />
                          <span>Pilih Gambar Kop</span>
                        </button>
                        {formData.kopImageUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveKop}
                            className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 py-1.5 px-2 rounded-lg font-bold border border-red-250"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      
                      <input
                        type="file"
                        ref={kopFileInputRef}
                        onChange={handleKopUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <span className="text-[9.5px] text-slate-400 block text-center leading-normal">
                        Rekomendasi: Format JPEG/PNG horisontal lebar (rasio kop surat).
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Stempel Upload Block */}
                <div className="space-y-3">
                  <span className="text-[10.5px] font-bold text-slate-700 block">Mode Stempel Tanda Tangan</span>
                  <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleBoolean('useCustomStampImage', false)}
                      className={`flex-1 text-[10.5px] py-1.5 rounded-md font-bold text-center transition-all ${
                        !formData.useCustomStampImage
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Bulat Grafis Otomatis
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBoolean('useCustomStampImage', true)}
                      className={`flex-1 text-[10.5px] py-1.5 rounded-md font-bold text-center transition-all ${
                        formData.useCustomStampImage
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Unggah Stempel PNG
                    </button>
                  </div>

                  {formData.useCustomStampImage && (
                    <div className="bg-white border border-slate-200 p-3 rounded-lg flex flex-col items-center justify-center space-y-2">
                      <div className="w-16 h-16 flex items-center justify-center p-1 bg-slate-50 rounded-lg border border-slate-150 overflow-hidden">
                        {formData.stampImageUrl ? (
                          <img 
                            src={formData.stampImageUrl} 
                            alt="Stempel Preview" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-[9px] text-slate-400">Belum ada stempel</span>
                        )}
                      </div>

                      <div className="flex gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => stampFileInputRef.current?.click()}
                          className="w-full text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 px-2 rounded-lg font-bold border border-slate-250 flex items-center justify-center gap-1.5"
                        >
                          <Upload size={12} />
                          <span>Pilih Gambar Stempel</span>
                        </button>
                        {formData.stampImageUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveStamp}
                            className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 py-1.5 px-2 rounded-lg font-bold border border-red-250"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      
                      <input
                        type="file"
                        ref={stampFileInputRef}
                        onChange={handleStampUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <span className="text-[9.5px] text-slate-400 block text-center leading-normal">
                        Rekomendasi: Gambar PNG dengan background transparan (bentuk lingkaran/oval warna biru/ungu).
                      </span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Section 2: Domisili & Kontak */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                <MapPin size={14} className="text-green-600" />
                Domisili & Kontak Sekolah
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kabupaten / Kota <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="kabupaten"
                    value={formData.kabupaten}
                    onChange={handleChange}
                    placeholder="Contoh: Sidoarjo"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kecamatan
                  </label>
                  <input
                    type="text"
                    name="kecamatan"
                    value={formData.kecamatan}
                    onChange={handleChange}
                    placeholder="Contoh: Buduran"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Provinsi
                  </label>
                  <input
                    type="text"
                    name="province"
                    value={formData.province}
                    onChange={handleChange}
                    placeholder="Contoh: Jawa Timur"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    E-mail Resmi Sekolah
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Contoh: humas@sekolah.sch.id"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Alamat Lengkap Surat-Menyurat
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Tuliskan nama jalan, nomor, RT/RW, kode pos..."
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Personil & Tanda Tangan */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                <User size={14} className="text-green-600" />
                Pejabat / Penandatangan Dokumen
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1. Kepala Sekolah</span>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      name="kepalaSekolah"
                      value={formData.kepalaSekolah}
                      onChange={handleChange}
                      className="w-full border border-slate-250 bg-white rounded-lg px-2.5 py-1.2 text-xs text-slate-800 focus:outline-none focus:border-green-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">NIP Kepala Sekolah</label>
                    <input
                      type="text"
                      name="nipKepalaSekolah"
                      value={formData.nipKepalaSekolah}
                      onChange={handleChange}
                      placeholder="Tulis NIP atau tanda minus (-) jika belum ada"
                      className="w-full border border-slate-250 bg-white rounded-lg px-2.5 py-1.2 text-xs text-slate-800 focus:outline-none focus:border-green-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">2. Kepala Urusan Kurikulum</span>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      name="kurikulumName"
                      value={formData.kurikulumName}
                      onChange={handleChange}
                      className="w-full border border-slate-250 bg-white rounded-lg px-2.5 py-1.2 text-xs text-slate-800 focus:outline-none focus:border-green-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">NIP Kaur Kurikulum</label>
                    <input
                      type="text"
                      name="nipKurikulum"
                      value={formData.nipKurikulum}
                      onChange={handleChange}
                      placeholder="Tulis NIP atau tanda minus (-) jika belum ada"
                      className="w-full border border-slate-250 bg-white rounded-lg px-2.5 py-1.2 text-xs text-slate-800 focus:outline-none focus:border-green-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Parameter Tambahan */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                <FileText size={14} className="text-green-600" />
                Parameter Laporan & Tahun Ajaran
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tahun Ajaran <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="tahunAjaran"
                    value={formData.tahunAjaran}
                    onChange={handleChange}
                    placeholder="Contoh: 2026/2027"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nomor Surat SK / Rencana Rombel
                  </label>
                  <input
                    type="text"
                    name="noSuratPrefix"
                    value={formData.noSuratPrefix}
                    onChange={handleChange}
                    placeholder="Contoh: 421.2 / SMPN2 / SIM-ROMBEL"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-650"
                  />
                </div>
              </div>
            </div>

            {/* Form Action Buttons */}
            <div className="border-t border-slate-150 pt-5 flex items-center justify-end gap-3">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all cursor-pointer hover:scale-[1.01]"
              >
                Simpan Seluruh Perubahan
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
