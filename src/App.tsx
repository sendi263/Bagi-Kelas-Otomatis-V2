/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  GraduationCap, 
  Layers, 
  RefreshCw, 
  Printer, 
  LayoutDashboard, 
  Menu, 
  X, 
  Clock, 
  ShieldAlert, 
  UserCheck,
  Settings,
  Award,
  Building2,
  LogOut
} from 'lucide-react';
import { Student, UpdateNotification, DapodikSyncLog, SchoolSettings, AuthUser } from './types';
import { 
  INITIAL_STUDENT_SEED, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_SYNC_LOGS,
  DEFAULT_SCHOOL_SETTINGS
} from './utils/helpers';
import DashboardOverview from './components/DashboardOverview';
import StudentManager from './components/StudentManager';
import ReportCardManager from './components/ReportCardManager';
import ClassSplitter from './components/ClassSplitter';
import ExportPanel from './components/ExportPanel';
import SchoolSettingsPanel from './components/SchoolSettingsPanel';
import AuthScreen from './components/AuthScreen';
import { secureStorage, preventDevToolsCloning } from './utils/security';
import { auth, studentDb, syncLogDb, notificationDb, schoolSettingsDb, authService, onAuthStateChanged } from './utils/supabase';

export default function App() {
  // Sidebar states (mobile responsive)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'siswa' | 'nilai' | 'kelas' | 'ekspor' | 'pengaturan'>('dashboard');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return secureStorage.getItem<AuthUser | null>('SPENDA_ACTIVE_SESSION', null);
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Operational states
  const [students, setStudents] = useState<Student[]>([]);
  const [notifications, setNotifications] = useState<UpdateNotification[]>([]);
  const [syncLogs, setSyncLogs] = useState<DapodikSyncLog[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  // Current Server UTC Time simulated
  const [currentTime, setCurrentTime] = useState<string>('2026-06-10 03:46:07');

  // Load and Seed records with migration
  useEffect(() => {
    // Prevent dev tools cloning & inspections
    preventDevToolsCloning();

    // Migrate any raw JSON data to encrypted storage format automatically
    secureStorage.migrateLegacyToSecure();

    // 1. Students
    const storedStudents = secureStorage.getItem<Student[] | null>('SPENDA_STUDENTS', null);
    if (storedStudents && storedStudents.length > 0) {
      setStudents(storedStudents);
    } else {
      secureStorage.setItem('SPENDA_STUDENTS', INITIAL_STUDENT_SEED);
      setStudents(INITIAL_STUDENT_SEED);
    }

    // 2. Notifications
    const storedNotifs = secureStorage.getItem<UpdateNotification[] | null>('SPENDA_NOTIFICATIONS', null);
    if (storedNotifs && storedNotifs.length > 0) {
      setNotifications(storedNotifs);
    } else {
      secureStorage.setItem('SPENDA_NOTIFICATIONS', INITIAL_NOTIFICATIONS);
      setNotifications(INITIAL_NOTIFICATIONS);
    }

    // 3. Sync Logs
    const storedLogs = secureStorage.getItem<DapodikSyncLog[] | null>('SPENDA_SYNC_LOGS', null);
    if (storedLogs && storedLogs.length > 0) {
      setSyncLogs(storedLogs);
    } else {
      secureStorage.setItem('SPENDA_SYNC_LOGS', INITIAL_SYNC_LOGS);
      setSyncLogs(INITIAL_SYNC_LOGS);
    }

    // 4. School Settings
    const storedSettings = secureStorage.getItem<SchoolSettings | null>('SPENDA_SCHOOL_SETTINGS', null);
    if (storedSettings) {
      // Auto-migrate if the user has outdated settings
      if (storedSettings.schoolName && (storedSettings.schoolName.toUpperCase().includes('SIDOARJO') || storedSettings.npsn === '20501234')) {
        setSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
        secureStorage.setItem('SPENDA_SCHOOL_SETTINGS', DEFAULT_SCHOOL_SETTINGS);
      } else {
        setSchoolSettings(storedSettings);
      }
    } else {
      secureStorage.setItem('SPENDA_SCHOOL_SETTINGS', DEFAULT_SCHOOL_SETTINGS);
      setSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
    }

    // Clock update ticker
    const timer = setInterval(() => {
      const now = new Date();
      // Format to WIB WIB/UTC format elegantly
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Synchronize with Supabase on active authentication session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        console.log("Supabase Session Connected:", fbUser.uid);
        try {
          // 1. School Settings
          let settings = await schoolSettingsDb.get('default_settings');
          if (!settings) {
            settings = DEFAULT_SCHOOL_SETTINGS;
            await schoolSettingsDb.save(DEFAULT_SCHOOL_SETTINGS, 'default_settings');
          }
          setSchoolSettings(settings);
          secureStorage.setItem('SPENDA_SCHOOL_SETTINGS', settings);

          // 2. Students List
          let fbStudents = await studentDb.getAll();
          if (!fbStudents || fbStudents.length === 0) {
            const cached = secureStorage.getItem<Student[] | null>('SPENDA_STUDENTS', null);
            const initialList = (cached && cached.length > 0) ? cached : INITIAL_STUDENT_SEED;
            await studentDb.saveBatch(initialList);
            fbStudents = initialList;
          }
          setStudents(fbStudents);
          secureStorage.setItem('SPENDA_STUDENTS', fbStudents);

          // 3. System Alerts and Notifications
          let fbNotifs = await notificationDb.getAll();
          if (!fbNotifs || fbNotifs.length === 0) {
            const cachedNotifs = secureStorage.getItem<UpdateNotification[] | null>('SPENDA_NOTIFICATIONS', null);
            const initialNotifs = (cachedNotifs && cachedNotifs.length > 0) ? cachedNotifs : INITIAL_NOTIFICATIONS;
            for (const n of initialNotifs) {
              await notificationDb.save(n);
            }
            fbNotifs = initialNotifs;
          }
          fbNotifs.sort((a, b) => b.date.localeCompare(a.date));
          setNotifications(fbNotifs);
          secureStorage.setItem('SPENDA_NOTIFICATIONS', fbNotifs);

          // 4. Dapodik Sync Chronological Logs
          let fbLogs = await syncLogDb.getAll();
          if (!fbLogs || fbLogs.length === 0) {
            const cachedLogs = secureStorage.getItem<DapodikSyncLog[] | null>('SPENDA_SYNC_LOGS', null);
            const initialLogs = (cachedLogs && cachedLogs.length > 0) ? cachedLogs : INITIAL_SYNC_LOGS;
            for (const l of initialLogs) {
              await syncLogDb.save(l);
            }
            fbLogs = initialLogs;
          }
          fbLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          setSyncLogs(fbLogs);
          secureStorage.setItem('SPENDA_SYNC_LOGS', fbLogs);

        } catch (error) {
          console.warn("Could not sync with Firestore initially (offline mode or rules restriction):", error);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Save actions to secureStorage on change
  const saveStudents = (newStudents: Student[]) => {
    setStudents(newStudents);
    secureStorage.setItem('SPENDA_STUDENTS', newStudents);
  };

  const saveNotifications = (newNotifs: UpdateNotification[]) => {
    setNotifications(newNotifs);
    secureStorage.setItem('SPENDA_NOTIFICATIONS', newNotifs);
  };

  const saveLogs = (newLogs: DapodikSyncLog[]) => {
    setSyncLogs(newLogs);
    secureStorage.setItem('SPENDA_SYNC_LOGS', newLogs);
  };

  const handleUpdateSchoolSettings = (newSettings: SchoolSettings) => {
    setSchoolSettings(newSettings);
    secureStorage.setItem('SPENDA_SCHOOL_SETTINGS', newSettings);
    schoolSettingsDb.save(newSettings).catch(err => console.error("Firestore settings save failed", err));
  };

  const handleResetSchoolSettings = () => {
    setSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
    secureStorage.setItem('SPENDA_SCHOOL_SETTINGS', DEFAULT_SCHOOL_SETTINGS);
    schoolSettingsDb.save(DEFAULT_SCHOOL_SETTINGS).catch(err => console.error("Firestore settings reset failed", err));
  };

  const handleConfirmLogout = () => {
    authService.logout().then(() => {
      setCurrentUser(null);
      secureStorage.removeItem('SPENDA_ACTIVE_SESSION');
      setShowLogoutConfirm(false);
    }).catch(err => {
      console.error("Logout error", err);
      setCurrentUser(null);
      secureStorage.removeItem('SPENDA_ACTIVE_SESSION');
      setShowLogoutConfirm(false);
    });
  };

  // State manipulation handlers
  const handleAddStudent = (studentData: Omit<Student, 'id' | 'lastUpdated'>) => {
    const newStudent: Student = {
      ...studentData,
      id: `sid-${Date.now()}`,
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    const updated = [newStudent, ...students];
    saveStudents(updated);
    studentDb.save(newStudent).catch(err => console.error("Firestore add student failed", err));
  };

  const handleAddStudentsBatch = (newStudentsData: Omit<Student, 'id' | 'lastUpdated'>[]) => {
    const newStudents: Student[] = newStudentsData.map((data, index) => ({
      ...data,
      id: `sid-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
      lastUpdated: new Date().toISOString().split('T')[0],
    }));
    const updated = [...newStudents, ...students];
    saveStudents(updated);
    studentDb.saveBatch(newStudents).catch(err => console.error("Firestore batch add students failed", err));
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    const updated = students.map((s) => s.id === updatedStudent.id ? updatedStudent : s);
    saveStudents(updated);
    studentDb.save(updatedStudent).catch(err => console.error("Firestore update student failed", err));
  };

  const handleUpdateStudentsBatch = (updatedStudents: Student[]) => {
    const updatedMap = new Map(updatedStudents.map(s => [s.id, s]));
    const updated = students.map((s) => {
      const match = updatedMap.get(s.id);
      return match ? match : s;
    });
    saveStudents(updated);
    studentDb.saveBatch(updatedStudents).catch(err => console.error("Firestore batch update students failed", err));
  };

  const handleDeleteStudent = (id: string) => {
    const updated = students.filter((s) => s.id !== id);
    saveStudents(updated);
    studentDb.remove(id).catch(err => console.error("Firestore delete student failed", err));
  };

  const handleDeleteAllStudents = () => {
    const oldStudents = [...students];
    saveStudents([]);
    Promise.all(oldStudents.map(s => studentDb.remove(s.id)))
      .catch(err => console.error("Firestore delete all students failed", err));
  };

  const handleResetAllGrades = () => {
    const updated = students.map(s => ({
      ...s,
      averageGrade: 0,
      lastUpdated: new Date().toISOString().split('T')[0]
    }));
    saveStudents(updated);
    studentDb.saveBatch(updated).catch(err => console.error("Firestore reset all grades failed", err));
  };

  const handleToggleNotification = (id: string) => {
    const updated = notifications.map((n) => {
      if (n.id === id) {
        const item = { ...n, completed: !n.completed };
        notificationDb.save(item).catch(err => console.error("Firestore toggle notification failed", err));
        return item;
      }
      return n;
    });
    saveNotifications(updated);
  };

  const handleAddSyncLog = (newLog: DapodikSyncLog) => {
    const updated = [newLog, ...syncLogs];
    saveLogs(updated);
    syncLogDb.save(newLog).catch(err => console.error("Firestore add sync log failed", err));
  };

  const handleApplyClassDivision = (updatedStudents: Student[]) => {
    saveStudents(updatedStudents);
    studentDb.saveBatch(updatedStudents).catch(err => console.error("Firestore apply class division failed", err));
  };

  if (!currentUser) {
    return (
      <AuthScreen 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          secureStorage.setItem('SPENDA_ACTIVE_SESSION', user);
        }} 
        schoolName={schoolSettings.schoolName} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-green-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-green-200">
      
      {/* 1. Header Topbar - Geometric Balance white / green border style */}
      <header className="bg-white text-green-950 border-b border-green-200 sticky top-0 z-40 shadow-sm transition-all">
        <div className="px-4 md:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-green-50 md:hidden transition-all text-green-700"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="bg-green-600 p-2 rounded-xl text-white shadow-inner flex items-center justify-center">
                <GraduationCap size={22} className="stroke-[2.5]" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight block text-green-950">EduData <span className="text-green-600">SPENDA</span></span>
                <span className="text-[10px] text-green-550 block uppercase tracking-wider font-semibold">{schoolSettings.schoolName}</span>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-4 text-xs">
            {/* Live Clock Widget */}
            <div className="hidden sm:flex items-center gap-1.5 bg-green-50 text-green-800 px-3 py-1.5 rounded-full font-mono border border-green-150">
              <Clock size={13} className="text-green-600" />
              <span>{currentTime}</span>
              <span className="text-[10px] bg-green-600 px-1 py-0.2 rounded font-sans font-bold uppercase select-none tracking-wide text-white">WIB</span>
            </div>

            {/* Account Operator */}
            {currentUser && (
              <div className="flex items-center gap-2 border-l border-green-100 pl-4">
                <div className="h-8 w-8 rounded-full bg-green-100 border border-green-200 text-green-900 flex items-center justify-center font-bold text-sm">
                  {currentUser.avatarInitial}
                </div>
                <div className="hidden md:block text-left text-[11px]">
                  <span className="font-bold text-green-950 block">{currentUser.name}</span>
                  <span className="text-green-600 text-[10px] block font-medium">{currentUser.role}</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      <div className="flex-1 flex relative">
        
        {/* 2. Left Menu Navigation (Sidebar) */}
        {/* Mobile drawer background overlay */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-green-950/40 backdrop-blur-xs z-40 md:hidden transition-all"
          ></div>
        )}

        <aside className={`
          fixed md:sticky top-16 md:top-auto bottom-0 md:bottom-auto left-0 h-[calc(100vh-64px)] w-64 bg-green-900 text-green-300 border-r border-green-950 z-50 md:z-10
          transition-transform duration-300 ease-in-out select-none flex flex-col justify-between
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-4 space-y-6">
            <div className="flex items-center justify-between md:hidden border-b border-green-800 pb-3">
              <span className="font-bold text-sm text-green-400">Navigasi Operator</span>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded hover:bg-green-850 text-green-400"
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu Nav Links */}
            <nav className="space-y-1 text-xs">
              <div className="text-[10px] text-green-400 font-extrabold uppercase tracking-widest pl-3 pb-2">Menu Utama</div>
              
              {/* Tab: Dashboard */}
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'dashboard' 
                    ? 'bg-green-800 text-white font-extrabold shadow-sm' 
                    : 'hover:bg-green-800/50 text-green-300 hover:text-white'
                }`}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard Rekap</span>
              </button>

              {/* Tab: School Settings */}
              <button
                onClick={() => {
                  setActiveTab('pengaturan');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'pengaturan' 
                    ? 'bg-green-800 text-white font-extrabold shadow-sm' 
                    : 'hover:bg-green-800/50 text-green-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings size={16} />
                  <span>Identitas & Kop Sekolah</span>
                </div>
                {currentUser?.role === 'Demo' && (
                  <span className="bg-amber-500/25 border border-amber-500/40 text-amber-350 text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">
                     Locked
                  </span>
                )}
              </button>

              {/* Tab: Student database */}
              <button
                onClick={() => {
                  setActiveTab('siswa');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'siswa' 
                    ? 'bg-green-800 text-white font-extrabold shadow-sm' 
                    : 'hover:bg-green-800/50 text-green-300 hover:text-white'
                }`}
              >
                <Users size={16} />
                <span>Data Induk Siswa</span>
              </button>

              {/* Tab: Report Card Grades */}
              <button
                onClick={() => {
                  setActiveTab('nilai');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'nilai' 
                    ? 'bg-green-800 text-white font-extrabold shadow-sm' 
                    : 'hover:bg-green-800/50 text-green-300 hover:text-white'
                }`}
              >
                <Award size={16} />
                <span>Input Nilai Rapor</span>
                <span className="bg-amber-500/30 text-amber-100 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full leading-none">Nilai</span>
              </button>

              {/* Tab: Class automated splitting */}
              <button
                onClick={() => {
                  setActiveTab('kelas');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'kelas' 
                    ? 'bg-green-800 text-white font-extrabold shadow-sm' 
                    : 'hover:bg-green-800/50 text-green-300 hover:text-white'
                }`}
              >
                <Layers size={16} />
                <span>Bagi Kelas Otomatis</span>
                <span className="bg-green-500/30 text-green-100 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full leading-none">Heterogen</span>
              </button>

              {/* Tab: Export PDF/Excel */}
              <button
                onClick={() => {
                  setActiveTab('ekspor');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'ekspor' 
                    ? 'bg-green-800 text-white font-extrabold shadow-sm' 
                    : 'hover:bg-green-800/50 text-green-300 hover:text-white'
                }`}
              >
                <Printer size={16} />
                <span>Ekspor File & Cetak</span>
              </button>

              {/* Separator line */}
              <div className="border-t border-green-850 my-2"></div>

              {/* Action: Logout */}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold transition-all cursor-pointer hover:bg-red-800/30 text-amber-200 hover:text-red-100"
              >
                <LogOut size={16} className="text-amber-400" />
                <span>Keluar Aplikasi</span>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer Details */}
          <div className="p-4 border-t border-green-950 space-y-3 bg-green-950/40 text-[10px]">
            <div className="flex gap-2 items-start text-green-300">
              <UserCheck size={14} className="text-green-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">Kredensial Otoritas</span>
                <p className="leading-relaxed">NPSN: <b>{schoolSettings.npsn}</b><br />Wilayah: {schoolSettings.kabupaten}, {schoolSettings.province}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-green-850 text-[10px] text-green-400 space-y-1">
              <span>Keamanan Server SPENDA</span>
              <div className="flex items-center gap-1 text-[9px] text-green-450 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]"></span>
                <span>SECURED AES-256</span>
              </div>
            </div>
          </div>
        </aside>

        {/* 3. Main Body Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden space-y-6">
          
          {/* Section Breadcrumbs */}
          <div className="flex items-center justify-between text-xs text-green-700 border-b border-green-200 pb-3 select-none">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="font-semibold text-green-800">EduData SPENDA</span>
              <span className="text-green-300">/</span>
              <span className="text-green-600 uppercase tracking-wider">
                {activeTab === 'dashboard' && 'Dashboard Rekapitulasi'}
                {activeTab === 'siswa' && 'Database Peserta Didik'}
                {activeTab === 'nilai' && 'Input Nilai Rapor Siswa'}
                {activeTab === 'kelas' && 'Smart Rombel Heterogen'}
                {activeTab === 'ekspor' && 'Ekspor Excel & PDF'}
                {activeTab === 'pengaturan' && 'Identitas & Kop Sekolah'}
              </span>
            </div>
            
            <span className="text-[10px] font-mono select-none text-green-500">Aplikasi Versi 1.4.0</span>
          </div>

          {/* Main conditional tab routing */}
          <div className="animate-fade-in">
            {activeTab === 'dashboard' && (
              <DashboardOverview 
                students={students} 
                notifications={notifications}
                toggleNotification={handleToggleNotification}
                syncLogs={syncLogs}
                schoolSettings={schoolSettings}
                onNavigate={(tab) => {
                  if (tab === 'siswa') setActiveTab('siswa');
                  if (tab === 'kelas') setActiveTab('kelas');
                }}
              />
            )}

            {activeTab === 'siswa' && (
              <StudentManager 
                students={students}
                onAddStudent={handleAddStudent}
                onUpdateStudent={handleUpdateStudent}
                onDeleteStudent={handleDeleteStudent}
                onAddStudentsBatch={handleAddStudentsBatch}
                onDeleteAllStudents={handleDeleteAllStudents}
              />
            )}

            {activeTab === 'nilai' && (
              <ReportCardManager
                students={students}
                onUpdateStudent={handleUpdateStudent}
                onUpdateStudentsBatch={handleUpdateStudentsBatch}
                onResetAllGrades={handleResetAllGrades}
                currentUserRole={currentUser?.role}
              />
            )}

            {activeTab === 'kelas' && (
              <ClassSplitter 
                students={students}
                onApplyClassDivision={handleApplyClassDivision}
                schoolSettings={schoolSettings}
                currentUserRole={currentUser?.role}
              />
            )}

            {activeTab === 'ekspor' && (
              <ExportPanel 
                students={students}
                schoolSettings={schoolSettings}
              />
            )}

            {activeTab === 'pengaturan' && (
              currentUser?.role === 'Demo' ? (
                <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-xl mx-auto my-12 shadow-sm text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center">
                    <ShieldAlert size={24} />
                  </div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight uppercase font-mono">Akses Terbaca-Saja Dibatasi</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Maaf, profil <strong className="text-red-700">Operator Demo</strong> tidak diizinkan untuk melihat atau melakukan modifikasi pada Identitas dan Kop Surat Resmi Sekolah. Silakan beralih ke akun Admin atau Operator Utama untuk hak akses penuh.
                  </p>
                </div>
              ) : (
                <SchoolSettingsPanel 
                  settings={schoolSettings}
                  onUpdateSettings={handleUpdateSchoolSettings}
                  onResetSettings={handleResetSchoolSettings}
                />
              )
            )}
          </div>
        </main>
      </div>

      {/* 4. Footer bar description */}
      <footer className="bg-white text-green-600 border-t border-green-100 py-4 px-8 flex flex-col md:flex-row justify-between items-center text-[11px] mt-auto select-none">
        <div>© 2026 EduData SPENDA - {schoolSettings.schoolName} Digital Infrastructure</div>
        <div className="flex gap-4 mt-2 md:mt-0">
          <span>System Status: <strong className="text-green-700">Operational</strong></span>
          <span>Server Load: <strong className="text-green-700">12%</strong></span>
        </div>
      </footer>

      {/* 5. Custom Professional Logout Dialog Modal Pop-up */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              id="logout-modal-backdrop"
            />

            {/* Modal Card content wrapper */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-6 text-center space-y-4 z-10"
              id="logout-modal-card"
            >
              {/* Decorative Warning glow background banner */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-red-500 to-amber-500 animate-gradient-x" />

              {/* Header Icon Indicator */}
              <div className="mx-auto w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center shadow-inner mt-2">
                <LogOut size={22} className="stroke-[2.5] text-red-600 rotate-180" />
              </div>

              {/* Title Header */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-black text-slate-900 tracking-tight font-mono uppercase">
                  Konfirmasi Keluar Sesi
                </h3>
                <p className="text-xs text-slate-550 leading-relaxed font-semibold">
                  Apakah Anda yakin ingin keluar dari portal <span className="text-green-700 font-bold">EduData SPENDA</span>?
                </p>
              </div>

              {/* Quick warning message details card */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-left space-y-2 text-[10.5px] leading-relaxed text-slate-650 font-medium">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold select-none shrink-0">⚠️</span>
                  <span>Sesi operator aktif Anda akan diakhiri secara aman dan aman dari peretasan.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold select-none shrink-0 font-mono">⚠️</span>
                  <span>Pastikan seluruh proses sinkronisasi manual atau pengaturan data kesiswaan telah selesai disimpan sebelum Anda keluar.</span>
                </div>
              </div>

              {/* Interaction buttons */}
              <div className="flex items-center gap-3 pt-1.5">
                <button
                  type="button"
                  id="btn-cancel-logout"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-black select-none tracking-wide border border-slate-200/50 cursor-pointer transition-all active:scale-[0.98]"
                >
                  Batal / Tetap Masuk
                </button>
                <button
                  type="button"
                  id="btn-confirm-logout"
                  onClick={handleConfirmLogout}
                  className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-[11px] font-black shadow-md shadow-red-250 cursor-pointer transition-all active:scale-[0.98]"
                >
                  Ya, Keluar Aplikasi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
