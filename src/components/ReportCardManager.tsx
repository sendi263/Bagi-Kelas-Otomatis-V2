/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Award, 
  Search, 
  Check, 
  TrendingUp, 
  Edit2, 
  AlertCircle,
  HelpCircle,
  Save,
  Users,
  Download,
  Upload,
  X,
  RefreshCw,
  FileSpreadsheet,
  Trash
} from 'lucide-react';
import { Student } from '../types';
import { CryptoService } from '../utils/helpers';
import { read, utils, writeFile } from 'xlsx';

interface ReportCardManagerProps {
  students: Student[];
  onUpdateStudent: (updatedStudent: Student) => void;
  onUpdateStudentsBatch?: (updatedStudents: Student[]) => void;
  onResetAllGrades?: () => void;
  currentUserRole?: string;
}

export default function ReportCardManager({ 
  students, 
  onUpdateStudent,
  onUpdateStudentsBatch,
  onResetAllGrades,
  currentUserRole
}: ReportCardManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [tempGrade, setTempGrade] = useState<number>(80);
  const [filterClass, setFilterClass] = useState<string>('Semua');
  const [successMessage, setSuccessMessage] = useState('');

  // Reset grades modal confirmation state
  const [resetAllModalOpen, setResetAllModalOpen] = useState(false);
  const [confirmResetText, setConfirmResetText] = useState('');

  // Excel importing states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [previewList, setPreviewList] = useState<{ student: Student; oldGrade: number; newGrade: number }[]>([]);

  // Get active students only
  const activeStudents = students.filter(s => s.status === 'Aktif');

  // Filter students
  const filteredStudents = activeStudents.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass === 'Semua' || student.currentClass === filterClass;
    return matchesSearch && matchesClass;
  });

  // Calculate generic stats
  const count = filteredStudents.length;
  const gradeSum = filteredStudents.reduce((sum, s) => sum + s.averageGrade, 0);
  const baseAverage = count > 0 ? parseFloat((gradeSum / count).toFixed(2)) : 0;
  
  // High performers (>= 85)
  const highPerformers = filteredStudents.filter(s => s.averageGrade >= 85).length;
  // Mid performers (75 - 84.9)
  const midPerformers = filteredStudents.filter(s => s.averageGrade >= 75 && s.averageGrade < 85).length;
  // Needs support (< 75)
  const supportNeeded = filteredStudents.filter(s => s.averageGrade < 75).length;

  const handleStartEdit = (student: Student) => {
    setEditingStudentId(student.id);
    setTempGrade(student.averageGrade);
  };

  const handleSaveGrade = (student: Student) => {
    if (isNaN(tempGrade) || tempGrade < 0 || tempGrade > 100) {
      alert('Maaf, nilai harus berkisar dari 0 sampai 100.');
      return;
    }

    const updated = {
      ...student,
      averageGrade: parseFloat(tempGrade.toFixed(2)),
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    onUpdateStudent(updated);
    setEditingStudentId(null);
    setSuccessMessage(`Berhasil memperbarui nilai rapor ${student.name}`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleDownloadTemplate = () => {
    if (currentUserRole === 'Demo') {
      setImportError("Akun Demo dibatasi: Tidak diizinkan mengunduh template Excel nilai rapor.");
      return;
    }
    try {
      const dataToExport = filteredStudents.length > 0 ? filteredStudents : activeStudents;
      if (dataToExport.length === 0) {
        setImportError("Tidak ada siswa aktif terdaftar untuk dibuatkan template.");
        return;
      }

      const templateData = dataToExport.map((student, index) => {
        const decryptedNisn = CryptoService.decrypt(student.nisn);
        const gradeInt = Math.round(student.averageGrade);
        return {
          "NO": index + 1,
          "NISN": decryptedNisn,
          "Nama Siswa": student.name,
          "Rombel": student.currentClass === 'Belum Diatur' ? 'Belum Rombel' : `Kelas ${student.currentClass}`,
          "Nilai Rapor": gradeInt
        };
      });

      const ws = utils.json_to_sheet(templateData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Daftar Nilai Rapor");

      ws['!cols'] = [
        { wch: 8 },   // NO
        { wch: 18 },  // NISN
        { wch: 25 },  // Nama Siswa
        { wch: 15 },  // Rombel
        { wch: 15 }   // Nilai Rapor
      ];

      writeFile(wb, `Template_Nilai_Rapor_Siswa.xlsx`);
      setImportSuccess("Daftar template Excel berhasil diunduh! Silakan isi kolom 'Nilai Rapor' dengan nilai bulat/puluhan, lalu unggah file.");
      setImportError("");
    } catch (err: any) {
      setImportError(`Gagal membuat template: ${err.message || err}`);
    }
  };

  const handleProcessImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (!rawRows || rawRows.length <= 1) {
          setImportError("Berkas Excel kosong atau hanya memiliki baris judul.");
          setPreviewList([]);
          return;
        }

        const headers = rawRows[0];
        let nisnColIndex = -1;
        let gradeColIndex = -1;

        headers.forEach((h: any, idx: number) => {
          const text = String(h || '').toUpperCase().trim();
          if (text.includes("NISN")) {
            nisnColIndex = idx;
          } else if (text.includes("NILAI") || text.includes("RAPOR") || text.includes("SKOR") || text.includes("GRADE")) {
            gradeColIndex = idx;
          }
        });

        if (nisnColIndex === -1) nisnColIndex = 1; 
        if (gradeColIndex === -1) gradeColIndex = 4; 

        // Map active students by decrypted NISN
        const activeStudentsMap = new Map<string, Student>();
        activeStudents.forEach(s => {
          const plain = CryptoService.decrypt(s.nisn);
          activeStudentsMap.set(plain, s);
        });

        const previewUpdates: { student: Student; oldGrade: number; newGrade: number }[] = [];
        let skippedRows = 0;

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const rawNisn = String(row[nisnColIndex] || '').replace(/\D/g, '').trim();
          const rawGrade = parseFloat(String(row[gradeColIndex] || '').trim());

          if (!rawNisn) {
            skippedRows++;
            continue;
          }

          const matchStudent = activeStudentsMap.get(rawNisn);
          if (!matchStudent) {
            skippedRows++;
            continue;
          }

          if (isNaN(rawGrade) || rawGrade < 0 || rawGrade > 100) {
            skippedRows++;
            continue;
          }

          // Force integer score for grade template as requested (bulat/puluhan tanpa koma)
          const newGradeInt = Math.round(rawGrade);

          previewUpdates.push({
            student: matchStudent,
            oldGrade: matchStudent.averageGrade,
            newGrade: newGradeInt
          });
        }

        let isDemoLimited = false;
        let finalUpdates = previewUpdates;
        if (currentUserRole === 'Demo' && previewUpdates.length > 3) {
          finalUpdates = previewUpdates.slice(0, 3);
          isDemoLimited = true;
        }

        if (finalUpdates.length === 0) {
          setImportError("Tidak ada data siswa yang cocok dengan NISN aktif di sistem. Pastikan mengunggah file template yang sesuai.");
          setPreviewList([]);
        } else {
          setPreviewList(finalUpdates);
          if (isDemoLimited) {
            setImportSuccess(`[Akun Demo] Hasil impor dibatasi secara ketat hanya untuk 3 siswa saja. Berhasil memuat 3 data siswa pertamanya dari Excel.`);
          } else {
            setImportSuccess(`Berhasil memuat ${finalUpdates.length} data siswa dari Excel. Silakan periksa kolom sebelum menyimpan.`);
          }
          setImportError("");
        }
      } catch (err: any) {
        setImportError(`Gagal membaca berkas Excel: ${err.message || err}`);
        setPreviewList([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApplyImportedGrades = () => {
    if (previewList.length === 0) return;

    const listToUpdate = previewList.map(item => ({
      ...item.student,
      averageGrade: item.newGrade,
      lastUpdated: new Date().toISOString().split('T')[0]
    }));

    if (onUpdateStudentsBatch) {
      onUpdateStudentsBatch(listToUpdate);
    } else {
      listToUpdate.forEach(s => onUpdateStudent(s));
    }

    setSuccessMessage(`Berhasil memperbarui nilai rapor ${listToUpdate.length} siswa secara massal!`);
    setImportModalOpen(false);
    setPreviewList([]);
    setImportSuccess('');
    setImportError('');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Get list of unique classes for filter
  const classesList = Array.from(new Set(activeStudents.map(s => s.currentClass))).sort();

  return (
    <div className="space-y-6">
      {/* Information Board Header */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-5 items-start">
        <div className="p-3 bg-green-50 rounded-xl text-green-600 shrink-0">
          <Award size={32} />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Manajemen Penginputan Nilai Rapor Siswa</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Sesuai permintaan operator SPENDA, menu nilai rapor ini <b className="text-green-700">dipisahkan secara mandiri</b> dari alat pembagian kelas. Silakan perbarui nilai akademis di sini. Perubahan nilai secara otomatis akan mempengaruhi parameter penyeimbang serpentine saat Anda memproses pembagian rombel heterogen.
          </p>
        </div>
      </div>

      {/* Numerical Curve Dashboard Insights */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Rata-Rata Nilai</span>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-xl font-extrabold text-green-950 font-mono">{baseAverage}</span>
            <span className="text-[10px] text-green-700 bg-green-50 font-bold px-1.5 py-0.2 rounded border border-green-200">
              Skala 100
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Predikat Tinggi (≥ 85)</span>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-xl font-extrabold text-slate-900 font-mono">{highPerformers}</span>
            <span className="text-xs text-slate-400">Siswa aktif</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Predikat Menengah (75-84.9)</span>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-xl font-extrabold text-slate-900 font-mono">{midPerformers}</span>
            <span className="text-xs text-slate-400">Siswa aktif</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Perlu Dukungan (&lt; 75)</span>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-xl font-extrabold text-amber-600 font-mono">{supportNeeded}</span>
            <span className="text-xs text-slate-400">Siswa aktif</span>
          </div>
        </div>
      </div>

      {/* Main Table Interface with Inline Grade Editors */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        
        {/* Controls header */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-green-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
              Daftar Nilai Rapor Akademik Siswa
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa..."
                className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs w-48 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 font-medium"
              />
            </div>

            {/* Class filter dropdown */}
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-green-600"
            >
              <option value="Semua">Semua Rombel Sekarang</option>
              {classesList.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>

            {/* Reset All Grades button */}
            {activeStudents.length > 0 && onResetAllGrades && (
              <button
                type="button"
                onClick={() => {
                  setConfirmResetText('');
                  setResetAllModalOpen(true);
                }}
                className="bg-rose-50 hover:bg-rose-100 text-rose-750 hover:text-rose-900 border border-rose-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Trash size={14} />
                <span>Reset Semua Nilai</span>
              </button>
            )}

            {/* Impor Nilai (Excel) button */}
            <button
              onClick={() => {
                setImportError('');
                setImportSuccess('');
                setPreviewList([]);
                setImportModalOpen(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <FileSpreadsheet size={14} />
              <span>Impor Nilai (Excel)</span>
            </button>
          </div>
        </div>

        {/* Status updates notifications alert */}
        {successMessage && (
          <div className="m-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold rounded-lg flex items-center gap-2 animate-fade-in">
            <Check size={14} className="text-green-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-150/80 text-slate-500 bg-slate-50/40 text-[10px] uppercase font-bold">
                <th className="p-3 w-12">No</th>
                <th className="p-3">Nama Lengkap Siswa</th>
                <th className="p-3">Asal Sekolah / Kelas Asal</th>
                <th className="p-3 text-center">Rombel Sekarang</th>
                <th className="p-3 text-right w-56">Nilai Rata-Rata Rapor</th>
                <th className="p-3 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student, index) => {
                  const isEditing = editingStudentId === student.id;
                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isEditing ? 'bg-green-50/10' : ''
                      }`}
                    >
                      <td className="p-3 text-slate-400 font-mono font-bold">{index + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{student.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-semibold">NISN: {student.id}</div>
                      </td>
                      <td className="p-3 text-slate-500">{student.asalKelas || 'Belum Diatur'}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black tracking-wide ${
                          student.currentClass === 'Belum Diatur'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/50'
                            : 'bg-green-100/60 text-green-850'
                        }`}>
                          {student.currentClass}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={tempGrade}
                              onChange={(e) => setTempGrade(Math.round(parseFloat(e.target.value)))}
                              className="w-24 accent-green-600 cursor-pointer"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={tempGrade}
                              onChange={(e) => setTempGrade(Math.round(parseFloat(e.target.value)) || 0)}
                              className="w-16 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-green-600"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 pr-2">
                            <span className={`font-mono text-sm font-bold ${
                              student.averageGrade >= 85 
                                ? 'text-green-700' 
                                : student.averageGrade < 75 
                                  ? 'text-amber-600' 
                                  : 'text-slate-800'
                            }`}>
                              {student.averageGrade.toFixed(2)}
                            </span>
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  student.averageGrade >= 85 
                                    ? 'bg-green-600' 
                                    : student.averageGrade < 75 
                                      ? 'bg-amber-500' 
                                      : 'bg-slate-400'
                                }`}
                                style={{ width: `${student.averageGrade}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {isEditing ? (
                          <button
                            onClick={() => handleSaveGrade(student)}
                            className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold p-1 px-2 rounded hover:scale-105 active:scale-95 transition-all text-[11px] cursor-pointer"
                          >
                            <Save size={12} />
                            <span>Simpan</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(student)}
                            className="inline-flex items-center gap-1 border border-slate-200 hover:border-green-600 hover:text-green-700 hover:bg-green-50/20 text-slate-500 bg-white font-bold p-1 px-2.5 rounded hover:scale-105 active:scale-95 transition-all text-[11px] cursor-pointer"
                          >
                            <Edit2 size={11} />
                            <span>Ubah</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-400 text-xs">
                    <AlertCircle size={32} className="mx-auto block text-slate-300 stroke-[1.5] mb-2" />
                    Belum ada data siswa aktif yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info counts */}
        <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
          <span>Menampilkan <b>{filteredStudents.length}</b> dari <b>{activeStudents.length}</b> siswa aktif terdaftar.</span>
          <div className="flex gap-4 font-bold">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-600"></span> Tinggi</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Sedang</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Rendang</span>
          </div>
        </div>

      </div>

      {/* BATCH IMPORT GRADES MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b border-green-100 bg-green-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-green-700" size={18} />
                <h3 className="font-bold text-slate-800 text-sm">Impor Nilai Rapor via Excel</h3>
              </div>
              <button 
                onClick={() => {
                  setImportModalOpen(false);
                  setPreviewList([]);
                  setImportSuccess('');
                  setImportError('');
                }} 
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {importError && (
                <div className="bg-rose-50 text-rose-800 border-l-4 border-rose-500 p-3 rounded font-medium text-xs flex gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="bg-green-50 text-green-800 border-l-4 border-green-500 p-3 rounded font-semibold text-xs flex gap-2">
                  <Check size={16} className="shrink-0 text-green-600" />
                  <span>{importSuccess}</span>
                </div>
              )}

              {/* Guidelines Box */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg text-xs space-y-2">
                <span className="font-bold text-slate-700 block">Langkah Penggunaan:</span>
                <ol className="list-decimal pl-4 text-slate-600 space-y-1 text-[11px]">
                  <li><b>Unduh berkas template Excel</b> dengan mengklik tombol di bawah. Template sudah terisi nama siswa dan NISN aktif saat ini.</li>
                  <li>Buka file tersebut di Microsoft Excel / Google Sheets, lalu isi kolom <b>'Nilai Rapor'</b> dengan angka bulat (tanpa koma / puluhan, misal: <span className="font-mono font-bold text-green-700">85</span>, <span className="font-mono font-bold text-green-700">92</span>, atau <span className="font-mono font-bold text-green-700">78</span>).</li>
                  <li>Simpan berkas, lalu pilih/unggah kembali berkas yang telah diperbarui ke panel di bawah ini.</li>
                  <li>Tinjau draf perubahan nilai siswa, lalu klik <b>'Simpan Perubahan'</b> untuk menerapkan secara massal.</li>
                </ol>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={currentUserRole === 'Demo'}
                    onClick={handleDownloadTemplate}
                    className={`border rounded-lg px-3 py-2 font-bold flex items-center gap-1.5 transition-all text-[11px] ${
                      currentUserRole === 'Demo'
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                        : 'bg-green-50 hover:bg-green-100 text-green-750 border-green-200 cursor-pointer'
                    }`}
                  >
                    <Download size={13} className={currentUserRole === 'Demo' ? 'text-slate-400' : 'text-green-700'} />
                    <span>Download Template Excel ({filteredStudents.length > 0 ? "Berdasarkan Filter" : "Semua Siswa"})</span>
                  </button>
                </div>
              </div>

              {/* Upload input */}
              <div className="space-y-1 text-xs">
                <span className="block font-bold text-slate-700">Pilih Berkas Excel Nilai Rapor Terisi (.xlsx / .xls / .csv)</span>
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    handleProcessImportExcel(file);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Real-time Preview Table */}
              {previewList.length > 0 && (
                <div className="space-y-2 border-t border-slate-150 pt-3">
                  <span className="block font-bold text-slate-700 text-xs">Pratinjau Nilai Perubahan ({previewList.length} siswa):</span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                          <th className="p-2 pl-3">No</th>
                          <th className="p-2">Nama Lengkap</th>
                          <th className="p-2">NISN</th>
                          <th className="p-2">Rombel</th>
                          <th className="p-2 text-center">Nilai Lama</th>
                          <th className="p-2 text-center bg-green-50/60">Nilai Baru (Excel)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewList.map((item, idx) => (
                          <tr key={item.student.id} className="hover:bg-slate-50">
                            <td className="p-2 pl-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-bold text-slate-800">{item.student.name}</td>
                            <td className="p-2 font-mono text-slate-500">{CryptoService.decrypt(item.student.nisn)}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                item.student.currentClass === 'Belum Diatur' 
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                  : 'bg-green-50 text-green-700 border border-green-200'
                              }`}>
                                {item.student.currentClass === 'Belum Diatur' ? 'Belum Rombel' : `Kelas ${item.student.currentClass}`}
                              </span>
                            </td>
                            <td className="p-2 text-center font-mono text-slate-400">{item.oldGrade.toFixed(2)}</td>
                            <td className="p-2 text-center font-mono font-bold text-green-700 bg-green-50/30">
                              {item.newGrade}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl text-xs">
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setPreviewList([]);
                  setImportSuccess('');
                  setImportError('');
                }}
                className="p-2 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={previewList.length === 0}
                onClick={handleApplyImportedGrades}
                className={`p-2 px-5 rounded-lg font-bold text-white flex items-center gap-1.5 transition-all ${
                  previewList.length > 0 
                    ? 'bg-green-600 hover:bg-green-700 cursor-pointer scale-100 active:scale-95' 
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <Check size={14} />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DANGER CONFIRM RESET ALL GRADES MODAL */}
      {resetAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-rose-100 text-left">
            <div className="flex items-center justify-between p-4 border-b border-rose-100 bg-rose-50 rounded-t-xl text-rose-900">
              <div className="flex items-center gap-2">
                <Trash className="text-rose-600 shrink-0" size={18} />
                <h3 className="font-extrabold text-sm tracking-tight text-rose-800">Peringatan: Reset Seluruh Nilai Rapor</h3>
              </div>
              <button 
                onClick={() => setResetAllModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-50/50 border border-rose-100 p-3.5 rounded-lg space-y-2">
                <p className="text-xs text-rose-800 leading-relaxed font-semibold">
                  Tindakan ini akan mengatur ulang (reset) rata-rata nilai rapor seluruh <strong className="text-rose-950 font-extrabold">{activeStudents.length} siswa aktif</strong> kembali menjadi nilai <span className="font-bold underline text-rose-900 font-mono">0 (Nol)</span>.
                </p>
                <p className="text-[10.5px] text-slate-500 leading-normal">
                  Rekomendasi: Silakan pastikan Anda telah memiliki salinan atau ekspor data nilai rapor sebelumnya jika sewaktu-waktu data tersebut masih dibutuhkan.
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block font-bold text-slate-700">Ketik konfirmasi kata kunci berikut:</label>
                <input
                  type="text"
                  placeholder="Ketik RESET-NILAI di sini..."
                  value={confirmResetText}
                  onChange={(e) => setConfirmResetText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-center text-sm tracking-wider font-bold uppercase focus:outline-none focus:border-rose-500 focus:bg-white text-rose-700 placeholder-slate-300"
                />
                <span className="block text-[10px] text-slate-400 text-center">
                  Masukkan: <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-bold font-mono">RESET-NILAI</code>
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl text-xs">
              <button
                type="button"
                onClick={() => setResetAllModalOpen(false)}
                className="p-2 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={confirmResetText !== 'RESET-NILAI'}
                onClick={() => {
                  if (onResetAllGrades) {
                    onResetAllGrades();
                  }
                  setSuccessMessage('Berhasil menyetel ulang seluruh nilai rapor siswa menjadi 0!');
                  setResetAllModalOpen(false);
                  setTimeout(() => setSuccessMessage(''), 4000);
                }}
                className={`p-2 px-5 rounded-lg font-extrabold text-white flex items-center gap-1.5 tracking-wide transition-all ${
                  confirmResetText === 'RESET-NILAI'
                    ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer hover:shadow-md active:scale-95'
                    : 'bg-slate-300 cursor-not-allowed text-slate-400'
                }`}
              >
                <Trash size={14} />
                <span>KOSONGKAN SELURUH NILAI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
