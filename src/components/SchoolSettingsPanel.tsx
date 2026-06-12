/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Hash,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  UserCog,
  Unlock,
  Lock,
  Clock
} from 'lucide-react';
import { SchoolSettings } from '../types';
import { secureStorage } from '../utils/security';
import { registeredUsersDb } from '../utils/supabase';

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

  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const local = secureStorage.getItem<any[]>('SPENDA_REGISTERED_USERS', []);
        setRegisteredUsers(local);

        const remote = await registeredUsersDb.getAll();
        if (remote && remote.length > 0) {
          const mergedMap = new Map();
          local.forEach(u => mergedMap.set(u.email.toLowerCase(), u));
          remote.forEach(u => {
            if (u && u.email) {
              const emailKey = u.email.toLowerCase();
              const existing = mergedMap.get(emailKey);
              if (existing) {
                mergedMap.set(emailKey, {
                  ...existing,
                  ...u,
                  password: u.password || existing.password || '',
                  activatePaid: u.activatePaid !== undefined ? u.activatePaid : existing.activatePaid
                });
              } else {
                mergedMap.set(emailKey, u);
              }
            }
          });
          const list = Array.from(mergedMap.values());
          setRegisteredUsers(list);
          secureStorage.setItem('SPENDA_REGISTERED_USERS', list);
        }
      } catch (err) {
        console.warn('Failed loading registered users:', err);
      }
    };
    loadUsers();
  }, []);

  const handleActivateUser = async (email: string) => {
    const updated = registeredUsers.map(u => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u, activatePaid: true, activationTime: new Date().toISOString() };
      }
      return u;
    });
    setRegisteredUsers(updated);
    secureStorage.setItem('SPENDA_REGISTERED_USERS', updated);

    const userToSave = updated.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (userToSave) {
      try {
        await registeredUsersDb.save(userToSave);
      } catch (err) {
        console.warn('Could not sync user activation to Supabase:', err);
      }
    }
  };

  const handleDeactivateUser = async (email: string) => {
    const protectedEmails = ['admin@smp.belajar.id', 'sendi263@guru.smp.belajar.id'];
    if (protectedEmails.includes(email.toLowerCase())) {
      alert('Akun admin utama sistem bawaan tidak dapat dinonaktifkan.');
      return;
    }

    const updated = registeredUsers.map(u => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u, activatePaid: false, activationTime: null };
      }
      return u;
    });
    setRegisteredUsers(updated);
    secureStorage.setItem('SPENDA_REGISTERED_USERS', updated);

    const userToSave = updated.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (userToSave) {
      try {
        await registeredUsersDb.save(userToSave);
      } catch (err) {
        console.warn('Could not sync user deactivation to Supabase:', err);
      }
    }
  };

  const handleDeleteUser = async (email: string) => {
    const protectedEmails = ['admin@smp.belajar.id', 'sendi263@guru.smp.belajar.id', 'demo@smp.belajar.id'];
    if (protectedEmails.includes(email.toLowerCase())) {
      alert('Akun bawaan sistem tidak dapat dihapus.');
      return;
    }

    if (window.confirm(`Apakah Anda yakin ingin menghapus permanen operator dengan email ${email}?`)) {
      const updated = registeredUsers.filter(u => u.email.toLowerCase() !== email.toLowerCase());
      setRegisteredUsers(updated);
      secureStorage.setItem('SPENDA_REGISTERED_USERS', updated);
      
      try {
        // Find in remote to verify delete, or rewrite batch:
        await registeredUsersDb.saveBatch(updated);
      } catch (err) {
        console.warn('Could not sync user removal to Supabase:', err);
      }
    }
  };

  const handleChangeUserRole = async (email: string, newRole: string) => {
    const updated = registeredUsers.map(u => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u, role: newRole };
      }
      return u;
    });
    setRegisteredUsers(updated);
    secureStorage.setItem('SPENDA_REGISTERED_USERS', updated);

    const userToSave = updated.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (userToSave) {
      try {
        await registeredUsersDb.save(userToSave);
      } catch (err) {
        console.warn('Could not sync user role change to Supabase:', err);
      }
    }
  };

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newOpEmail, setNewOpEmail] = useState('');
  const [newOpPassword, setNewOpPassword] = useState('');
  const [newOpName, setNewOpName] = useState('');
  const [newOpRole, setNewOpRole] = useState('Operator Utama');
  const [newOpError, setNewOpError] = useState('');

  const handleManualAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewOpError('');

    if (!newOpEmail || !newOpPassword || !newOpName) {
      setNewOpError('Semua kolom bertanda wajib harus diisi.');
      return;
    }

    if (newOpPassword.length < 5) {
      setNewOpError('Karakter kata sandi minimal harus terdiri dari 5 karakter.');
      return;
    }

    const emailLower = newOpEmail.trim().toLowerCase();
    const isTaken = registeredUsers.some(u => u.email.toLowerCase() === emailLower);
    if (isTaken) {
      setNewOpError('Email operator ini sudah terdaftar.');
      return;
    }

    const initials = newOpName.trim()
      .split(' ')
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OP';

    const newUser = {
      email: emailLower,
      password: newOpPassword,
      name: newOpName.trim(),
      role: newOpRole,
      avatarInitial: initials,
      activatePaid: true, // Manually added by admin is instantly activated
      activationTime: new Date().toISOString()
    };

    const updated = [...registeredUsers, newUser];
    setRegisteredUsers(updated);
    secureStorage.setItem('SPENDA_REGISTERED_USERS', updated);

    try {
      await registeredUsersDb.save(newUser);
    } catch (err) {
      console.warn('Could not sync manually added user to Supabase:', err);
    }

    // Reset fields
    setNewOpEmail('');
    setNewOpPassword('');
    setNewOpName('');
    setNewOpRole('Operator Utama');
    setIsAddingUser(false);
  };

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

      {/* SECTION B: KELOLA OPERATOR & AKTIVASI LISENSI */}
      <div className="bg-white border border-slate-150 rounded-2xl p-5 md:p-6 shadow-sm space-y-5 mt-6" id="operator-management-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-emerald-600 w-5 h-5" />
              Kelola Akun & Aktivasi Operator WhatsApp
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Daftar seluruh operator sekolah yang telah mendaftar. Sebagai Admin Utama, Anda dapat memvalidasi pembayaran mereka secara manual, mengaktifkan akun, serta memberikan seluruh hak akses pekerjaan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={() => setIsAddingUser(!isAddingUser)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white rounded-lg text-xs font-black shadow-sm flex items-center gap-1.5 select-none transition-all cursor-pointer hover:scale-[1.01]"
            >
              <UserCog size={14} className="stroke-[2.5]" />
              <span>+ Tambah Operator Manual</span>
            </button>
            <div className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-150 text-emerald-700 text-xs font-mono font-medium flex items-center gap-1.5 select-none">
              <Unlock size={14} className="text-emerald-600" />
              <span>Mekanisme WhatsApp Terhubung</span>
            </div>
          </div>
        </div>

        {isAddingUser && (
          <form onSubmit={handleManualAddUser} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 md:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <UserCog className="text-emerald-600 w-4 h-4" />
                Tambah Operator Baru [Instant Aktif]
              </span>
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>

            {newOpError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2 text-xs rounded-lg font-medium leading-relaxed">
                ⚠️ {newOpError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  placeholder="Contoh: Muhammad Akhyar"
                  className="w-full bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">E-mail Login *</label>
                <input
                  type="email"
                  required
                  value={newOpEmail}
                  onChange={(e) => setNewOpEmail(e.target.value)}
                  placeholder="Contoh: akhi@smp.belajar.id"
                  className="w-full bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Kata Sandi *</label>
                <input
                  type="text"
                  required
                  value={newOpPassword}
                  onChange={(e) => setNewOpPassword(e.target.value)}
                  placeholder="Min. 5 karakter"
                  className="w-full bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Peran / Jabatan *</label>
                <select
                  value={newOpRole}
                  onChange={(e) => setNewOpRole(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-green-600"
                >
                  <option value="Operator Utama">Operator Utama</option>
                  <option value="Staf Kesiswaan">Staf Kesiswaan</option>
                  <option value="Wakasek Kurikulum">Wakasek Kurikulum</option>
                  <option value="Kepala Sekolah">Kepala Sekolah</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] rounded-lg shadow-sm hover:shadow active:scale-[0.98] transition-all cursor-pointer"
              >
                ✓ Simpan & Aktifkan Operator
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3.5 pl-4">Operator</th>
                <th className="p-3.5">E-mail</th>
                <th className="p-3.5">Peran / Jabatan</th>
                <th className="p-3.5 text-center">Status Akses</th>
                <th className="p-3.5 text-center">Tanggal Aktivasi</th>
                <th className="p-3.5 text-right pr-4">Aksi Validasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {registeredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic font-medium">
                    Belum ada operator lain yang mendaftar.
                  </td>
                </tr>
              ) : (
                registeredUsers.map((user) => {
                  const isSystemDefault = ['admin@smp.belajar.id', 'sendi263@guru.smp.belajar.id', 'demo@smp.belajar.id'].includes(user.email.toLowerCase());
                  return (
                    <tr key={user.email} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5 pl-4 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 text-[11px] font-black flex items-center justify-center shadow-sm shrink-0 uppercase">
                          {user.avatarInitial || 'OP'}
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 block leading-tight">{user.name}</span>
                          <span className="text-[10px] text-slate-450 block font-mono">ID: {user.email}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-600">{user.email}</td>
                      <td className="p-3.5">
                        {isSystemDefault ? (
                          <span className="inline-block bg-slate-100 border border-slate-150 text-slate-700 px-2 py-0.5 rounded-md text-[10.5px] font-bold">
                            {user.role}
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => handleChangeUserRole(user.email, e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-green-600"
                          >
                            <option value="Operator Utama">Operator Utama</option>
                            <option value="Staf Kesiswaan">Staf Kesiswaan</option>
                            <option value="Wakasek Kurikulum">Wakasek Kurikulum</option>
                            <option value="Kepala Sekolah">Kepala Sekolah</option>
                          </select>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {user.activatePaid ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">
                            <UserCheck size={11} className="stroke-[2.5]" />
                            <span>Aktif (Full Akses)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide animate-pulse">
                            <Clock size={11} className="stroke-[2.5]" />
                            <span>Menunggu Validasi</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center font-mono text-[10px] text-slate-500">
                        {user.activatePaid && user.activationTime ? (
                          new Date(user.activationTime).toLocaleString('id-ID', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-2.5">
                          {user.activatePaid ? (
                            !isSystemDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeactivateUser(user.email)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 rounded-lg text-[10px] font-extrabold flex items-center gap-1 border border-amber-200/50 transition-colors cursor-pointer"
                                title="Nonaktifkan Hak Akses"
                              >
                                <Lock size={11} />
                                <span>Tarik Akses</span>
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivateUser(user.email)}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-sm hover:shadow active:scale-[0.98] transition-all cursor-pointer"
                              title="Aktifkan & Berikan Seluruh Hak Akses"
                            >
                              <UserCheck size={11} className="stroke-[2.5]" />
                              <span>Validasi & Aktifkan</span>
                            </button>
                          )}
                          {!isSystemDefault && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.email)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Operator"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          {isSystemDefault && (
                            <span className="text-[10px] text-slate-400 font-bold italic mr-1">Bawaan</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
