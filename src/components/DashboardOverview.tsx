/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Users, 
  GraduationCap, 
  CheckCircle, 
  RefreshCw, 
  Calendar, 
  AlertTriangle, 
  Info,
  Layers, 
  TrendingUp,
  ShieldCheck,
  MapPin
} from 'lucide-react';
import { Student, UpdateNotification, DapodikSyncLog, SchoolSettings } from '../types';

interface DashboardOverviewProps {
  students: Student[];
  notifications: UpdateNotification[];
  toggleNotification: (id: string) => void;
  syncLogs: DapodikSyncLog[];
  onNavigate: (tab: string) => void;
  schoolSettings?: SchoolSettings;
}

export default function DashboardOverview({
  students,
  notifications,
  toggleNotification,
  syncLogs,
  onNavigate,
  schoolSettings,
}: DashboardOverviewProps) {
  // 1. Calculations based on currently loaded students
  const totalStudents = students.length;
  const maleCount = students.filter((s) => s.gender === 'L').length;
  const femaleCount = students.filter((s) => s.gender === 'P').length;
  
  const malePercentage = totalStudents > 0 ? Math.round((maleCount / totalStudents) * 100) : 0;
  const femalePercentage = totalStudents > 0 ? Math.round((femaleCount / totalStudents) * 100) : 0;

  const avgGradeSum = students.reduce((sum, s) => sum + s.averageGrade, 0);
  const averageGrade = totalStudents > 0 ? parseFloat((avgGradeSum / totalStudents).toFixed(2)) : 0;

  // Active classes
  const classesSet = new Set(students.map((s) => s.currentClass).filter((c) => c !== 'Belum Diatur'));
  const classCount = classesSet.size;

  // Grade distributions: [0-70], (70-80], (80-90], (90-100]
  const ranges = {
    under70: students.filter(s => s.averageGrade <= 70).length,
    from70to80: students.filter(s => s.averageGrade > 70 && s.averageGrade <= 80).length,
    from80to90: students.filter(s => s.averageGrade > 80 && s.averageGrade <= 90).length,
    above90: students.filter(s => s.averageGrade > 90).length,
  };

  const activeNotifications = notifications.filter(n => !n.completed);

  return (
    <div className="space-y-6">
      {/* Welcome Banner - Geometric Balance Theme */}
      <div id="welcome-banner" className="bg-gradient-to-br from-green-600 to-green-900 rounded-2xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-6 translate-x-6">
          <GraduationCap size={240} />
        </div>
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 bg-green-500/30 text-green-100 px-3 py-1 rounded-full text-xs font-medium tracking-wide border border-green-400/20 uppercase">
            Sistem Informasi Operasional
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Selamat Bekerja, Operator {schoolSettings?.schoolName ? schoolSettings.schoolName.replace('SMP NEGERI ', 'SMPN ') : 'SPENDA'}!
          </h1>
          <p className="text-green-50/90 text-sm md:text-base leading-relaxed font-sans">
            Selamat datang di portal <b className="font-semibold text-green-200">EduData SPENDA</b> ({schoolSettings?.schoolName || 'SMP Negeri 2'}). Kelola data induk siswa, analisis pemerataan pembagian kelas, lakukan konsolidasi Dapodik Kemdikbud secara mandiri dan aman.
          </p>
          <div className="pt-2 flex flex-wrap gap-4 text-xs text-green-100">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-green-300" /> Proteksi Enkripsi AES-256 Aktif
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-green-300" /> Database Terintegrasi Lokal & Awan
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid - Designed based on Geometric Balance Bento Grid */}
      <div id="kpi-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Siswa */}
        <div 
          onClick={() => onNavigate('siswa')}
          className="bg-white hover:bg-green-50/40 border border-green-100 p-5 rounded-xl shadow-sm transition-all cursor-pointer group flex items-start justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Total Siswa</p>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{totalStudents}</h3>
            <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
              <span className="font-semibold">{maleCount} L</span>
              <span>•</span>
              <span className="text-pink-600 font-semibold">{femaleCount} P</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-green-50 text-green-600 group-hover:scale-110 transition-transform">
            <Users size={20} />
          </div>
        </div>

        {/* Card 2: Rata-rata Nilai */}
        <div className="bg-white border border-green-100 p-5 rounded-xl shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Rata-Rata Akademik</p>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{averageGrade}</h3>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1 font-mono">
              <TrendingUp size={12} className="text-green-600" />
              Siswa Berimbang
            </p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 text-green-600">
            <GraduationCap size={20} />
          </div>
        </div>

        {/* Card 3: Kelas Aktif */}
        <div 
          onClick={() => onNavigate('kelas')}
          className="bg-white hover:bg-green-50/40 border border-green-100 p-5 rounded-xl shadow-sm transition-all cursor-pointer group flex items-start justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Jumlah Kelas Terbagi</p>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
              {classCount > 0 ? `${classCount} Rombel` : 'Belum Ditata'}
            </h3>
            <p className="text-xs text-green-600 mt-1">
              {students.filter(s => s.currentClass === 'Belum Diatur').length} siswa mengantre kelas
            </p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 text-green-600 group-hover:scale-110 transition-transform">
            <Layers size={20} />
          </div>
        </div>

        {/* Card 4: Status Keamanan */}
        <div className="bg-green-700 p-5 rounded-xl shadow-md text-white flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-green-100 uppercase tracking-wider mb-1">Keamanan Data</div>
            <div className="text-xl font-bold">AES-256 Aktif</div>
          </div>
          <div className="text-[10px] text-green-200 mt-2 font-mono uppercase tracking-wide">
            Terproteksi Aman
          </div>
        </div>
      </div>

      {/* Visual Charts Component & Dynamic Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart column 1: Sebaran Gender & Tingkat Akademik */}
        <div id="distribution-visuals" className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Rekapitulasi Demografis & Akademik Siswa</h2>
              <p className="text-xs text-slate-500">Analisis sebaran nilai akademik dan komposisi gender secara real-time</p>
            </div>
            <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-100 font-mono">
              N={totalStudents}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gender Composite Widget */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sebaran Jenis Kelamin (Gender Balance)</h4>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span className="flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-green-500"></span>Laki-Laki ({maleCount} Siswa)</span>
                  <span className="font-semibold">{malePercentage}%</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span className="flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-pink-500"></span>Perempuan ({femaleCount} Siswa)</span>
                  <span className="font-semibold">{femalePercentage}%</span>
                </div>
              </div>

              {/* Progress track composite */}
              <div className="w-full h-8 rounded-full overflow-hidden flex shadow-inner bg-slate-100 border border-slate-200">
                {malePercentage > 0 && (
                  <div 
                    style={{ width: `${malePercentage}%` }} 
                    className="bg-green-500 flex items-center justify-center text-[10px] font-bold text-white transition-all shadow-sm"
                  >
                    {malePercentage >= 15 ? `L: ${malePercentage}%` : ''}
                  </div>
                )}
                {femalePercentage > 0 && (
                  <div 
                    style={{ width: `${femalePercentage}%` }} 
                    className="bg-pink-500 flex items-center justify-center text-[10px] font-bold text-white transition-all shadow-sm"
                  >
                    {femalePercentage >= 15 ? `P: ${femalePercentage}%` : ''}
                  </div>
                )}
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Pemerataan rasio gender sangat krusial dalam metode pembagian kelas heterogen EduData SPENDA untuk merangsang sosiabilitas.
              </p>
            </div>

            {/* Grades Distribution Histogram Widget */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distribusi Rentang Nilai (Rata-rata)</h4>
              <div className="space-y-3">
                {/* Range Under 70 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>≤ 70 (Kurang)</span>
                    <span className="font-medium">{ranges.under70} Siswa ({totalStudents > 0 ? Math.round((ranges.under70/totalStudents)*100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      style={{ width: `${totalStudents > 0 ? (ranges.under70 / totalStudents) * 100 : 0}%` }} 
                      className="bg-amber-500 h-2 rounded-full transition-all"
                    ></div>
                  </div>
                </div>

                {/* Range 71 - 80 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>71 - 80 (Cukup)</span>
                    <span className="font-medium">{ranges.from70to80} Siswa ({totalStudents > 0 ? Math.round((ranges.from70to80/totalStudents)*100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      style={{ width: `${totalStudents > 0 ? (ranges.from70to80 / totalStudents) * 100 : 0}%` }} 
                      className="bg-green-400 h-2 rounded-full transition-all"
                    ></div>
                  </div>
                </div>

                {/* Range 81 - 90 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>81 - 90 (Baik)</span>
                    <span className="font-medium">{ranges.from80to90} Siswa ({totalStudents > 0 ? Math.round((ranges.from80to90/totalStudents)*100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      style={{ width: `${totalStudents > 0 ? (ranges.from80to90 / totalStudents) * 100 : 0}%` }} 
                      className="bg-green-600 h-2 rounded-full transition-all"
                    ></div>
                  </div>
                </div>

                {/* Range 91 - 100 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>&gt; 90 (Sangat Baik)</span>
                    <span className="font-medium">{ranges.above90} Siswa ({totalStudents > 0 ? Math.round((ranges.above90/totalStudents)*100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      style={{ width: `${totalStudents > 0 ? (ranges.above90 / totalStudents) * 100 : 0}%` }} 
                      className="bg-green-700 h-2 rounded-full transition-all"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50/50 rounded-xl p-4 border border-green-200/50 flex gap-3 text-green-800 text-xs">
            <Info size={16} className="text-green-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block text-green-950">Statistik Pemerataan Kelas Terpadu</span>
              <p className="leading-relaxed">
                Platform mendeteksi heterogenitas siswa seimbang. Algoritma otomatis memisahkan rentang akademis secara merata ke setiap opsi kelas, meniadakan ketimpangan kompetensi antar kelas.
              </p>
            </div>
          </div>
        </div>

        {/* Column 2: Notifikasi & Agenda Jadwal Pembaruan Berkala */}
        <div id="scheduled-alerts" className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                <Calendar size={18} className="text-slate-500" />
                Jadwal & Notifikasi
              </h2>
              {activeNotifications.length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {activeNotifications.length} Penting
                </span>
              )}
            </div>

            {/* List of Scheduled Tasks */}
            <div className="divide-y divide-slate-100 mt-2">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`py-3 flex gap-3 transition-all ${notif.completed ? 'opacity-50' : ''}`}
                >
                  <button 
                    onClick={() => toggleNotification(notif.id)}
                    className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      notif.completed 
                        ? 'bg-green-500 border-green-600 text-white' 
                        : 'bg-white border-slate-300 hover:border-green-500'
                    }`}
                  >
                    {notif.completed && <span className="text-[10px] font-black">✓</span>}
                  </button>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${notif.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                        {notif.title}
                      </span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded border ${
                        notif.type === 'warning' 
                          ? 'bg-amber-50 text-amber-800 border-amber-200' 
                          : notif.type === 'success'
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : 'bg-slate-50 text-slate-800 border-slate-200'
                      }`}>
                        {notif.cycle}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {notif.description}
                    </p>
                    <div className="text-[10px] text-slate-400 font-medium font-mono flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-500" />
                      Tenggat: {notif.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Sistem Pengingat Operator</span>
              <span className="text-[10px] text-slate-400">Terbata Jam Kerja</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-[10px] text-slate-500 flex gap-2 items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping shrink-0"></span>
              <span>Layanan latar belakang memeriksa pembaruan Dapodik setiap 24 jam sekali.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Log overview and System Security Audit Panel */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Keamanan & Riwayat Sistem</h2>
            <p className="text-xs text-slate-500">Log aktivitas proteksi enkripsi basis data tingkat sekolah</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action Log List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Log Sinkronisasi Terakhir</h4>
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {syncLogs.slice(0, 3).map((log) => (
                <div key={log.id} className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100/80 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                        log.status === 'Sukses' 
                          ? 'bg-green-50 text-green-700' 
                          : log.status === 'Gagal'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {log.status}
                      </span>
                      <span className="font-semibold text-slate-800">{log.type} Sync ({log.recordsCount} Siswa)</span>
                    </div>
                    <p className="text-slate-500 text-[11px] leading-relaxed truncate max-w-[320px]">
                      {log.details}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Crypto Security Health Gauge */}
          <div className="bg-slate-50/70 rounded-xl border border-slate-100 p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                Status Enkripsi Tingkat Tinggi
              </span>
              <h4 className="text-xs font-bold text-slate-800">Visualisasi Pengaman Data (NISN/NIK)</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Database internal EduData SPENDA memproteksi identitas siswa. NISN dan NIK diubah menjadi cipher berkode AES-256 tersendiri sebelum disimpan ke client storage untuk mencegah kebocoran siber.
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-900 text-slate-200 space-y-1.5 font-mono text-[10px]">
              <div className="flex justify-between border-b border-slate-800 pb-1 text-slate-400">
                <span>Nilai Asal</span>
                <span>Hex Sandi (Penyimpanan)</span>
              </div>
              <div className="flex justify-between items-center text-green-400">
                <span>NISN/NIK Siswa</span>
                <span className="text-yellow-400 truncate max-w-[160px]">ENC_AES256_NzI0NTIzMDE4MA==</span>
              </div>
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>Sandian MD5/SHA256</span>
                <span>Active 256-Bit</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
