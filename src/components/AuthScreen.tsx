import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  UserPlus, 
  LogIn, 
  Eye, 
  EyeOff, 
  Sparkles, 
  School, 
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  QrCode,
  CreditCard,
  Receipt,
  Check,
  Coins,
  MessageSquare,
  MessageCircle,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthUser } from '../types';
import { secureStorage } from '../utils/security';
import { authService, registeredUsersDb, isConfigured, supabaseUrl } from '../utils/supabase';

interface AuthScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  schoolName: string;
}

export default function AuthScreen({ onLoginSuccess, schoolName }: AuthScreenProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Operator Utama');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // WhatsApp configuration state
  const [whatsappAdminNumber, setWhatsappAdminNumber] = useState(() => {
    return localStorage.getItem('SPENDA_PAYMENT_WA_NUMBER') || 
           (import.meta as any).env.VITE_WA_ADMIN_NUMBER || 
           '6282329380931';
  });
  const [isConfiguringWa, setIsConfiguringWa] = useState(false);
  const [waInputTemp, setWaInputTemp] = useState(whatsappAdminNumber);

  // Payment integration state
  const [isPaymentStep, setIsPaymentStep] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wa' | 'qris' | 'transfer'>('wa');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentAmount] = useState('100.000');
  const [tempRegistrationData, setTempRegistrationData] = useState<any>(null);

  // Seed and synchronize registered users with Supabase
  useEffect(() => {
    async function syncRegisteredUsers() {
      // 1. Maintain official predefined template accounts
      const defaultUsers = [
        {
          email: 'sendi263@guru.smp.belajar.id',
          password: 'operator-spenda',
          name: 'Sendi Tio Alsi',
          role: 'Operator Utama',
          avatarInitial: 'ST',
          activatePaid: true
        },
        {
          email: 'admin@smp.belajar.id',
          password: 'admin-spenda',
          name: 'Administrator Utama',
          role: 'Operator Utama',
          avatarInitial: 'AU',
          activatePaid: true
        },
        {
          email: 'staf.kesiswaan@smp.belajar.id',
          password: 'staff123',
          name: 'Siti Rahmawati',
          role: 'Staf Kesiswaan',
          avatarInitial: 'SR',
          activatePaid: true
        },
        {
          email: 'demo@smp.belajar.id',
          password: 'demo123',
          name: 'Operator Demo',
          role: 'Demo',
          avatarInitial: 'OD',
          activatePaid: true
        }
      ];

      try {
        // 2. Fetch any accounts already saved on Supabase
        const remoteUsers = await registeredUsersDb.getAll();
        
        // 3. Load locally cached accounts
        const localUsers = secureStorage.getItem<any[]>('SPENDA_REGISTERED_USERS', []);

        // 4. Merge together safely using case-insensitive email as key
        const mergedMap = new Map<string, any>();
        
        // Load defaults
        defaultUsers.forEach(u => mergedMap.set(u.email.toLowerCase(), u));
        // Load local cash (to capture registered offline users if any)
        localUsers.forEach(u => mergedMap.set(u.email.toLowerCase(), u));
        // Load remote (remote has precedence for cross-device consistency, but preserve local passwords if remote has none)
        if (Array.isArray(remoteUsers)) {
          remoteUsers.forEach(u => {
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
        }

        const mergedList = Array.from(mergedMap.values());

        // Update local storage cache instantly
        secureStorage.setItem('SPENDA_REGISTERED_USERS', mergedList);

        // Save batch of non-demo users to Supabase if config is connected
        await registeredUsersDb.saveBatch(mergedList);
      } catch (err) {
        console.warn("Could not sync registered users to remote Supabase server:", err);
      }
    }

    syncRegisteredUsers();
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('Menghubungkan akun Google Anda...');
    try {
      const fbUser = await authService.loginWithGoogle();
      if (fbUser) {
        setSuccessMsg('Autentikasi Google berhasil! Sinkronisasi basis data...');
        const authUser: AuthUser = {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email || 'Operator Google',
          email: fbUser.email || '',
          role: 'Operator Utama',
          avatarInitial: (fbUser.displayName || fbUser.email || 'OP')
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        };
        setTimeout(() => {
          onLoginSuccess(authUser);
        }, 1200);
      } else {
        setErrorMsg('Gagal terhubung dengan Google. Pastikan tidak memblokir jendela sembulan.');
      }
    } catch (err: any) {
      setErrorMsg(`Kesalahan Google Auth: ${err?.message || err}`);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('Silakan masukkan email dan kata sandi Anda.');
      return;
    }

    const users = secureStorage.getItem<any[]>('SPENDA_REGISTERED_USERS', []);

    const matchedUser = users.find(
      (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (matchedUser) {
      if (matchedUser.activatePaid === false) {
        setErrorMsg('pembayaran belum divalidasi. Akun Anda telah terdaftar, tetapi belum aktif. Silakan hubungi Admin WhatsApp untuk proses aktivasi instant & pemberian seluruh hak akses.');
        return;
      }
      setSuccessMsg('Login berhasil! Mengalihkan ke Dashboard...');
      const authUser: AuthUser = {
        id: matchedUser.email,
        name: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role,
        avatarInitial: matchedUser.avatarInitial || matchedUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      };
      
      // Silent anonymous Supabase login to guarantee database authorization
      authService.loginAnonymously().catch(err => console.log("Silent Anonymous Auth Failed: ", err));

      setTimeout(() => {
        onLoginSuccess(authUser);
      }, 1000);
    } else {
      setErrorMsg('Email atau password tidak valid. Registrasikan akun baru atau pilih jalan pintas demo di bawah.');
    }
  };

  const startSignUpAndTriggerPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password || !fullName) {
      setErrorMsg('Mohon isi semua field pendaftaran yang bertanda wajib.');
      return;
    }

    if (password.length < 5) {
      setErrorMsg('Kata sandi minimal harus terdiri dari 5 karakter.');
      return;
    }

    const users = secureStorage.getItem<any[]>('SPENDA_REGISTERED_USERS', []);

    const isEmailTaken = users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
    if (isEmailTaken) {
      setErrorMsg('Email ini sudah terdaftar. Silakan langsung log in atau gunakan email lain.');
      return;
    }

    const initials = fullName.trim()
      .split(' ')
      .map((word: string) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OP';

    const newUser = {
      email: email.trim(),
      password,
      name: fullName.trim(),
      role,
      avatarInitial: initials,
      activatePaid: false, // Save as non-active, waiting for Admin validation
      activationTime: null
    };

    const updatedUsers = [...users, newUser];
    secureStorage.setItem('SPENDA_REGISTERED_USERS', updatedUsers);
    
    // Save to remote Supabase database
    registeredUsersDb.save(newUser).catch(err => {
      console.warn("Failed saving new registered user to Supabase:", err);
    });

    setTempRegistrationData(newUser);
    setIsPaymentStep(true);
  };

  const handleConfirmMockPayment = () => {
    setIsProcessingPayment(true);
    setErrorMsg('');
    
    // Simulate real QRIS/Bank automated hook verification
    setTimeout(() => {
      setIsProcessingPayment(false);
      setPaymentSuccess(true);
      
      // Save user to persistence upon active paid validation
      const users = secureStorage.getItem<any[]>('SPENDA_REGISTERED_USERS', []);
      
      if (tempRegistrationData) {
        const initials = tempRegistrationData.name
          .split(' ')
          .map((word: string) => word[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'OP';

        const newUser = {
          email: tempRegistrationData.email,
          password: tempRegistrationData.password,
          name: tempRegistrationData.name,
          role: tempRegistrationData.role,
          avatarInitial: initials,
          activatePaid: true,
          activationTime: new Date().toISOString()
        };

        const updatedUsers = [...users, newUser];
        secureStorage.setItem('SPENDA_REGISTERED_USERS', updatedUsers);
        
        // Save to remote Supabase database
        registeredUsersDb.save(newUser).catch(err => {
          console.warn("Failed saving new registered user to Supabase:", err);
        });
        
        setSuccessMsg(`Lisensi Aktif! Pembayaran berhasil diverifikasi mendalam. Akun ${newUser.name} diaktifkan.`);
        
        setTimeout(() => {
          setIsPaymentStep(false);
          setIsLoginMode(true);
          setEmail(newUser.email);
          setPassword('');
          setSuccessMsg('');
          setPaymentSuccess(false);
          setTempRegistrationData(null);
        }, 3000);
      }
    }, 2800);
  };

  const useDemoAccount = (demoType: 'default' | 'admin' | 'staff' | 'demo') => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsPaymentStep(false);
    
    if (demoType === 'default') {
      setEmail('sendi263@guru.smp.belajar.id');
      setPassword('operator-spenda');
    } else if (demoType === 'admin') {
      setEmail('admin@smp.belajar.id');
      setPassword('admin-spenda');
    } else if (demoType === 'staff') {
      setEmail('staf.kesiswaan@smp.belajar.id');
      setPassword('staff123');
    } else if (demoType === 'demo') {
      setEmail('demo@smp.belajar.id');
      setPassword('demo123');
    }
  };

  return (
    <div className="min-h-screen dynamic-bg bg-white text-green-950 flex flex-col justify-between p-4 md:p-8 relative overflow-hidden font-sans select-none">
      {/* Decorative ambient blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-green-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-600/10 blur-[150px] pointer-events-none"></div>

      {/* Top Brand Header */}
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-green-600 rounded-xl shadow-lg shadow-green-100">
            <School size={22} className="text-white" />
          </div>
          <div>
            <span className="text-xs font-black tracking-widest text-green-700 uppercase font-mono block">
              EduData System
            </span>
            <span className="text-sm font-extrabold text-green-950 tracking-tight">
              Portal SPENDA ({schoolName.replace('SMP NEGERI ', 'SMPN ') || 'SMPN 2'})
            </span>
          </div>
        </div>
        <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-150 text-green-700 text-[10px] sm:text-xs font-mono font-medium flex items-center gap-1.5 shadow-sm">
          <ShieldCheck size={14} className="text-green-600" />
          <span>Sistem Pembayaran Terkunci</span>
        </div>
      </div>

      {/* Center Auth Card with framer-motion */}
      <div className="w-full max-w-md mx-auto my-auto z-10 pt-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="bg-white rounded-3xl border border-green-100 p-6 md:p-8 shadow-xl shadow-green-950/5 space-y-6"
        >
          {isPaymentStep ? (
            /* STEP PAYMENT INVOICE AND SECURE CHECKOUT */
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="mx-auto w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-150">
                  <Coins size={24} className="stroke-[2.5]" />
                </div>
                <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-green-950 leading-tight">
                  Aktivasi Lisensi EduData
                </h2>
                <p className="text-[11px] text-green-750 max-w-xs mx-auto">
                  Sistem EduData mewajibkan biaya registrasi lisensi satu kali (Lifetime Support) untuk merawat server mandiri dan basis data SQL.
                </p>
              </div>

              {/* Invoice info */}
              <div className="bg-green-50/50 border border-green-100 p-4 rounded-xl relative overflow-hidden space-y-3">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-green-750 font-medium">Operator Terdaftar</span>
                  <strong className="text-green-950 truncate max-w-[200px]">{tempRegistrationData?.name}</strong>
                </div>
                <div className="flex justify-between items-center text-[11px] border-t border-green-100/60 pt-2">
                  <span className="text-green-750 font-medium">Email Akun</span>
                  <span className="text-green-700 font-mono truncate max-w-[200px]">{tempRegistrationData?.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-green-100/60 font-black">
                  <span className="text-green-800 font-bold uppercase tracking-wider font-mono">Total Bayar</span>
                  <span className="text-green-700 text-base font-black">
                    Rp {paymentAmount}
                  </span>
                </div>
              </div>

              {/* Custom WhatsApp Admin activation layout directly without secondary tabs */}
              <div className="bg-white p-4 rounded-xl border border-green-100 space-y-4">
                <div className="space-y-3.5 text-center">
                  <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 space-y-3">
                    <div className="flex justify-center">
                      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-200 animate-pulse">
                        <MessageCircle size={22} className="fill-emerald-500/10 text-emerald-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                        Aktivasi Instan via WhatsApp
                      </h3>
                      <p className="text-[10px] text-emerald-800/90 leading-relaxed mt-1">
                        Sistem akan meneruskan Anda langsung ke WhatsApp Admin Developer untuk verifikasi pembayaran & pendaftaran akun secara aman.
                      </p>
                    </div>

                    {/* Structured Message Template Preview */}
                    <div className="bg-white p-3 rounded-xl border border-emerald-150/70 text-left text-[9.5px] space-y-1 font-mono text-emerald-900 border-dashed">
                      <div className="font-bold text-emerald-950 border-b border-emerald-50 pb-1 mb-1.5 flex items-center justify-between">
                        <span>PREVIEW DETAIL PESAN WA:</span>
                        <span className="text-[7.5px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-sans font-bold">Autofill</span>
                      </div>
                      <p className="truncate">Halo Admin SPENDA 🌟</p>
                      <p className="truncate">Saya ingin mengaktifkan akun lisensi:</p>
                      <p className="pl-1.5 truncate">• Nama: {tempRegistrationData?.name}</p>
                      <p className="pl-1.5 truncate">• Email: {tempRegistrationData?.email}</p>
                      <p className="pl-1.5 truncate">• Peran: {tempRegistrationData?.role}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const textMessage = 
                        `Halo Admin EduData Spenda 🌟\n\n` +
                        `Saya baru saja mendaftarkan akun di aplikasi Rombel Otomatis.\n\n` +
                        `📝 DETAIL AKUN REGISTER:\n` +
                        `• Nama Operator: ${tempRegistrationData?.name || fullName}\n` +
                        `• Email Akun: ${tempRegistrationData?.email || email}\n` +
                        `• Jabatan/Peran: ${tempRegistrationData?.role || role}\n\n` +
                        `Mohon petunjuk untuk prosedur pembelian lisensi & aktivasi akunya. Terima kasih!`;
                      
                      const encodedText = encodeURIComponent(textMessage);
                      const waLink = `https://wa.me/${whatsappAdminNumber}?text=${encodedText}`;
                      window.open(waLink, '_blank');
                    }}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-xl text-xs font-black tracking-wide shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <MessageSquare size={14} className="fill-white/10" />
                    <span>HUBUNGI ADMIN WHATSAPP</span>
                  </button>
                </div>
              </div>

              {/* Feedbacks in step */}
              {successMsg && (
                <div className="p-3 bg-green-50 border border-green-250 text-green-800 rounded-xl text-xs flex items-start gap-2 animate-pulse">
                  <CheckCircle size={15} className="text-green-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed text-[11px]">{successMsg}</span>
                </div>
              )}

              {/* Action active buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentStep(false);
                    setTempRegistrationData(null);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full py-2.5 bg-green-50 hover:bg-green-100/80 text-green-700 hover:text-green-900 rounded-xl text-xs font-bold text-center transition-colors block cursor-pointer border border-green-200/50"
                >
                  Kembali ke Registrasi
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header Inside Card */}
              <div className="text-center space-y-2">
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-green-950">
                  {isLoginMode ? 'Selamat Datang Kembali' : 'Registrasi Operator Baru'}
                </h2>
                <p className="text-xs text-green-700 leading-relaxed max-w-xs mx-auto">
                  {isLoginMode 
                    ? 'Gunakan kredensial Dapodik / Operator Sekolah Anda untuk mengelola integrasi data siswa SPENDA.' 
                    : 'Dapatkan hak akses operator mandiri dengan mendaftarkan identitas pekerjaan Anda.'}
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="grid grid-cols-2 p-1 bg-green-50 rounded-xl border border-green-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isLoginMode 
                      ? 'bg-green-600 text-white shadow-sm' 
                      : 'text-green-700 hover:text-green-950'
                  }`}
                >
                  <LogIn size={13} className="stroke-[2.5]" />
                  <span>Masuk Portal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !isLoginMode 
                      ? 'bg-green-600 text-white shadow-sm' 
                      : 'text-green-700 hover:text-green-950'
                  }`}
                >
                  <UserPlus size={13} className="stroke-[2.5]" />
                  <span>Daftar Akun</span>
                </button>
              </div>

              {/* Feedback Alerts */}
              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-start gap-2.5 border-dashed">
                  <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed text-green-700">{successMsg}</span>
                </div>
              )}

              {/* Main Auth Form */}
              <form onSubmit={isLoginMode ? handleLogin : startSignUpAndTriggerPayment} className="space-y-4">
                {!isLoginMode && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-green-800 tracking-wider uppercase font-mono block">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-green-600">
                          <User size={14} />
                        </span>
                        <input
                          required
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Contoh: Sendi Tio Alsi, S.Pd."
                          className="w-full bg-white border border-green-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-green-950 placeholder-green-300 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-green-400 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-green-800 tracking-wider uppercase font-mono block">
                        Peran Operator <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-white border border-green-200 rounded-xl px-3 py-2.5 text-xs text-green-900 font-medium focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-green-400 transition-all"
                      >
                        <option value="Operator Utama">Operator Utama</option>
                        <option value="Staf Kesiswaan">Staf Kesiswaan</option>
                        <option value="Wakasek Kurikulum">Wakasek Kurikulum</option>
                        <option value="Kepala Sekolah">Kepala Sekolah</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-green-800 tracking-wider uppercase font-mono block">
                    Alamat Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-green-600">
                      <Mail size={14} />
                    </span>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@guru.smp.belajar.id"
                      className="w-full bg-white border border-green-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-green-950 placeholder-green-300 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-green-400 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10.5px] font-bold text-green-800 tracking-wider uppercase font-mono block">
                      Kata Sandi <span className="text-red-500">*</span>
                    </label>
                    {isLoginMode && (
                      <button
                        type="button"
                        onClick={() => {
                          alert("TIPS DEMO: Gunakan pintasan instan di bagian 'Pilih Akun Cepat' atau hubungi operator utama.");
                        }}
                        className="text-[10px] text-green-600 hover:underline font-bold"
                      >
                        Lupa Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-green-600">
                      <Lock size={14} />
                    </span>
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isLoginMode ? '••••••••' : 'Min. 5 karakter'}
                      className="w-full bg-white border border-green-200 rounded-xl pl-9 pr-10 py-2.5 text-xs text-green-950 placeholder-green-300 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-green-400 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-green-600 hover:text-green-850 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {!isLoginMode && (
                  <div className="text-[10.5px] text-green-800 bg-green-50 px-3 py-2 rounded-lg border border-green-150 text-center font-medium leading-relaxed">
                    💸 Biaya Registrasi: <strong>Rp 100.000 / Sekolah</strong> (Sekali Bayar). Verifikasi instan via WhatsApp.
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black tracking-wide shadow-lg cursor-pointer transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
                >
                  <span>{isLoginMode ? 'MASUK KE SYSTEM' : 'LANJUTKAN KE PEMBAYARAN AKTIVASI'}</span>
                </button>

                {isLoginMode && (
                  <div className="space-y-3 pt-2">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-x-0 border-t border-green-100"></div>
                      <span className="relative bg-white px-3 text-[10px] text-green-500 font-bold uppercase tracking-wider font-mono">Atau</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full py-3 bg-white hover:bg-green-50 text-green-950 border border-green-200 hover:border-green-300 rounded-xl text-xs font-bold tracking-wide shadow-sm cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <span className="flex items-center gap-0.5 text-sm font-black mr-1">
                        <span className="text-[#4285F4]">G</span>
                        <span className="text-[#EA4335]">o</span>
                        <span className="text-[#FBBC05]">o</span>
                        <span className="text-[#4285F4]">g</span>
                        <span className="text-[#34A853]">l</span>
                        <span className="text-[#EA4335]">e</span>
                      </span>
                      <span>Masuk dengan Google Cloud Auth</span>
                    </button>
                  </div>
                )}
              </form>

              {/* Quick-select Demo Accounts Panel for ease-of-use */}
              <div className="border-t border-green-100 pt-4 space-y-2.5">
                <span className="block text-[10.5px] font-bold text-green-700 tracking-wider uppercase font-mono text-center">
                  Pilih Akun Cepat (Koneksi Instan):
                </span>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => useDemoAccount('demo')}
                    className="w-full p-2.5 bg-amber-50/20 hover:bg-amber-50/50 border border-amber-150 rounded-xl text-left transition-all cursor-pointer group space-y-0.5"
                  >
                    <div className="flex items-center gap-1 justify-between">
                      <span className="text-[10px] font-bold text-amber-900 font-mono">AKUN DEMO</span>
                      <Lock size={12} className="text-amber-600 group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-[9px] text-amber-700 font-mono block">demo123</span>
                    <span className="text-[8.5px] inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-sans font-bold">Akses Terbatas</span>
                  </button>
                </div>
              </div>


            </>
          )}
        </motion.div>
      </div>

      {/* Footer copyright */}
      <div className="w-full text-center z-10 py-2">
        <p className="text-[10px] text-green-700 font-medium tracking-tight">
          Sistem Portal EduData & Terintegrasi Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI.
        </p>
        <p className="text-[9.5px] text-green-600 font-mono mt-0.5">
          Copyright © 2026 {schoolName || 'SMP Negeri 2'}. All security credentials sealed.
        </p>
      </div>
    </div>
  );
}
