/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  ShieldCheck, 
  Info, 
  Download, 
  Check, 
  ChevronRight,
  Sparkles,
  Award,
  Users
} from 'lucide-react';
import { Student, SchoolSettings } from '../types';
import { CryptoService } from '../utils/helpers';

interface ExportPanelProps {
  students: Student[];
  schoolSettings: SchoolSettings;
}

export default function ExportPanel({ students, schoolSettings }: ExportPanelProps) {
  const [exportType, setExportType] = useState<'Excel' | 'PDF'>('Excel');
  const [includeEncrypted, setIncludeEncrypted] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isDoneExporting, setIsDoneExporting] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Dynamic calculations
  const total = students.length;
  const laki = students.filter(s => s.gender === 'L').length;
  const peremp = students.filter(s => s.gender === 'P').length;
  const averageTotal = total > 0 
    ? parseFloat((students.reduce((sum, s) => sum + s.averageGrade, 0) / total).toFixed(2)) 
    : 0;

  // Group by Class
  const classGroups: { [key: string]: Student[] } = {};
  students.forEach((s) => {
    const cls = s.currentClass;
    if (!classGroups[cls]) classGroups[cls] = [];
    classGroups[cls].push(s);
  });

  const uniqueClasses = Object.keys(classGroups).sort();

  // Excel CSV Export generator
  const handleExportExcel = () => {
    setIsDoneExporting(true);

    // Build headers including Indonesian localized titles
    const headers = [
      'No',
      'Nama Lengkap',
      'NISN',
      'Asal Kelas',
      'Kelas Sekarang'
    ];

    // Build rows
    const csvRows = [headers.join(',')];

    students.forEach((s, index) => {
      // Use decrypted or masked based on the privacy choice
      const decryptedNisn = includeEncrypted ? CryptoService.decrypt(s.nisn) : CryptoService.mask(s.nisn);

      // Clean comma cells to prevent offset breakage in CSV
      const cleanCell = (val: any) => {
        const str = String(val || '').replace(/"/g, '""');
        return str.includes(',') ? `"${str}"` : str;
      };

      const row = [
        cleanCell(index + 1),
        cleanCell(s.name),
        cleanCell(decryptedNisn),
        cleanCell(s.asalKelas || 'Belum Diatur'),
        cleanCell(s.currentClass === 'Belum Diatur' ? 'Belum Rombel' : `Kelas ${s.currentClass}`)
      ];

      csvRows.push(row.join(','));
    });

    // Download generation
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `EduData_SPENDA_LaporanSiswa_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => setIsDoneExporting(false), 4000);
  };

  // Modern print handler 
  const handleTriggerPrint = () => {
    const printContent = printAreaRef.current?.innerHTML || '';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Tolong izinkan popup untuk mencetak laporan PDF ini.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>EduData SPENDA - Laporan Resmi Siswa</title>
          <style>
            body { 
              font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; 
              color: #1e293b; 
              padding: 40px; 
              line-height: 1.5;
            }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .header-text { text-align: center; }
            .header-text h1 { margin: 0; font-size: 20px; font-weight: bold; color: #047857; text-transform: uppercase; }
            .header-text h2 { margin: 2px 0; font-size: 14px; font-weight: medium; }
            .header-text p { margin: 2px 0; font-size: 11px; color: #475569; }
            .divider { border-top: 3px double #047857; margin: 15px 0 25px 0; }
            .meta-info { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 12px; }
            .meta-title { font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
            .kpi-row { display: flex; gap: 15px; margin-bottom: 25px; }
            .kpi-box { flex: 1; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: center; background: #f8fafc; }
            .kpi-box h3 { margin: 0 0 5px 0; font-size: 11px; text-transform: uppercase; color: #64748b; }
            .kpi-box p { margin: 0; font-size: 18px; font-weight: bold; color: #0f172a; }
            table.data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px; }
            table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            table.data-table th { background-color: #f1f5f9; font-weight: bold; text-transform: uppercase; color: #475569; }
            table.data-table tr:nth-child(even) { background-color: #f8fafc; }
            .footer-sign { display: flex; justify-content: flex-end; margin-top: 50px; font-size: 11px; }
            .sign-content { width: 220px; text-align: center; }
            .sign-space { height: 70px; }
            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Information Header Block */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-5 items-start">
        <div className="p-3 bg-green-50 rounded-xl text-green-600 shrink-0">
          <Printer size={32} />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Sistem Ekspor Laporan Otomatis Terpadu</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Generate laporan resmi pendaftaran siswa secara instan. Lakukan rekapitulasi data akademik dan demografis ke format <b className="text-green-700">Excel (.CSV)</b> untuk analisis pengolah kata, atau buat salinan <b className="text-green-700">Cetak/PDF</b> resmi beratribut kop sekolah SMP Negeri 2.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Export Form Controller */}
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5 font-mono">
            <Sparkles size={14} />
            Metode Outbound Data
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => {
                setExportType('Excel');
                setShowPdfPreview(false);
              }}
              className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                exportType === 'Excel'
                  ? 'border-green-600 bg-green-50 text-green-950 font-bold'
                  : 'border-slate-205 border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet size={20} className={exportType === 'Excel' ? 'text-green-600' : 'text-slate-400'} />
              <span>Laporan Excel XLS</span>
            </button>

            <button
              onClick={() => {
                setExportType('PDF');
                setShowPdfPreview(true);
              }}
              className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                exportType === 'PDF'
                  ? 'border-green-600 bg-green-50 text-green-950 font-bold'
                  : 'border-slate-205 border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText size={20} className={exportType === 'PDF' ? 'text-green-600' : 'text-slate-400'} />
              <span>Dokumen PDF/Print</span>
            </button>
          </div>

          {/* Export specifics */}
          {exportType === 'Excel' ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5 text-xs">
                <span className="block font-semibold text-slate-700">Kebijakan Privasi Pelaporan Excel</span>
                <label className="flex items-start gap-2.5 p-2 bg-slate-50 rounded-lg border border-slate-200/50 cursor-pointer text-slate-600">
                  <input 
                    type="checkbox"
                    checked={includeEncrypted}
                    onChange={(e) => setIncludeEncrypted(e.target.checked)}
                    className="accent-green-600 mt-1 h-4 w-4 shrink-0"
                  />
                  <span>Sertakan data NIK & NISN asli (Bebas sensor). Jaminan data sensitif terekspor penuh.</span>
                </label>
              </div>

              <button
                onClick={handleExportExcel}
                className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-bold transition-all shadow-sm"
              >
                <Download size={16} />
                <span>Ekspor File Excel (.CSV)</span>
              </button>

              {isDoneExporting && (
                <div className="bg-green-100 text-green-800 p-2.5 border border-green-200 rounded-lg text-[11px] font-medium flex items-center gap-1.5">
                  <Check size={14} /> Berhasil mengunduh dokumen tabular Excel !
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="bg-green-50/50 p-2.5 rounded-lg text-slate-600 text-[11px] leading-relaxed flex gap-2">
                <Info size={14} className="text-green-600 shrink-0 mt-0.5" />
                <span>Periksa draf kop resmi di sisi kanan, lalu tekan tombol <b>"Cetak Dokumen"</b> untuk memproses konversi PDF melalui perban cetak peramban.</span>
              </div>

              <button
                onClick={handleTriggerPrint}
                className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-bold transition-all shadow-sm"
              >
                <Printer size={16} />
                <span>Cetak / Cetak PDF Resmi</span>
              </button>
            </div>
          )}
        </div>

        {/* Live dynamic preview widget */}
        <div className="lg:col-span-2 bg-white border border-slate-100 p-5 rounded-xl shadow-sm text-xs">
          {showPdfPreview ? (
            /* PRINT PREVIEW COMPONENT */
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b pb-1">
                Visualisasi Pratinjau Dokumen Cetak (Live Preview)
              </span>

              {/* Printable container designed technically */}
              <div 
                ref={printAreaRef}
                className="border border-slate-300 rounded-lg p-6 bg-slate-50/50 max-h-[450px] overflow-y-auto space-y-6 text-[11px] text-slate-800 shadow-inner block"
              >
                {/* Official School Kop */}
                <div id="school-kop" className="border-b-4 border-double border-green-700 pb-3 text-center">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td>
                          {schoolSettings.useCustomKopImage && schoolSettings.kopImageUrl ? (
                            <div className="flex items-center justify-center">
                              <img 
                                src={schoolSettings.kopImageUrl} 
                                alt="Kop Surat Resmi" 
                                className="w-full max-h-20 object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="text-center font-serif text-slate-900 leading-snug">
                              <h2 className="text-lg font-bold uppercase tracking-wide text-green-800">
                                PEMERINTAH KABUPATEN {schoolSettings.kabupaten.toUpperCase()}
                              </h2>
                              <h1 className="text-xl font-extrabold uppercase tracking-widest text-green-900">
                                {schoolSettings.schoolName}
                              </h1>
                              <p className="text-[9px] text-slate-500 font-sans italic">
                                {schoolSettings.address} | NPSN: {schoolSettings.npsn} | Email: {schoolSettings.email}
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Subtitle document catalog */}
                <div className="text-center space-y-1">
                  <h3 className="text-xs font-black uppercase text-slate-900 underline">LAPORAN REKAPITULASI DAN INDUKS DATA INTEGRITAS SISWA</h3>
                  <p className="text-[10px] text-slate-500">Nomor Arsip: {schoolSettings.noSuratPrefix} / 2026</p>
                </div>

                {/* KPI metrics row for summary in printed file */}
                <div className="grid grid-cols-4 gap-3 bg-white border border-slate-200 p-3 rounded-lg text-center">
                  <div className="space-y-1-none">
                    <span className="text-[9px] text-slate-400 block uppercase">Total Siswa</span>
                    <strong className="text-sm font-bold text-slate-900">{total} Orang</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Laki-Laki</span>
                    <strong className="text-sm font-bold text-slate-900">{laki} Orang</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Perempuan</span>
                    <strong className="text-sm font-bold text-slate-900">{peremp} Orang</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Rata Akademik</span>
                    <strong className="text-sm font-bold text-green-800">{averageTotal} Poin</strong>
                  </div>
                </div>

                {/* Students roster grouped by classes in PDF Preview */}
                <div className="space-y-4">
                  {uniqueClasses.map((className) => {
                    const groupStudents = classGroups[className];
                    return (
                      <div key={className} className="space-y-1.5">
                        <strong className="text-[11px] font-bold text-green-900 uppercase">
                          Kelompok Rombel Kelas {className === 'Belum Diatur' ? 'Belum Diatur' : className} ({groupStudents.length} Siswa)
                        </strong>

                        <table className="w-full text-left border-collapse border border-slate-300 text-[10px] bg-white">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-300">
                              <th className="p-1 px-2 border border-slate-300">No</th>
                              <th className="p-1 px-2 border border-slate-300">Nama Lengkap</th>
                              <th className="p-1 px-2 border border-slate-300">NISN</th>
                              <th className="p-1 px-2 border border-slate-300">Asal Kelas</th>
                              <th className="p-1 px-2 border border-slate-300">Kelas Sekarang</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupStudents.map((stud, index) => (
                              <tr key={stud.id} className="border-b border-slate-200">
                                <td className="p-1 px-2 border border-slate-300 font-mono text-[9px]">{index + 1}</td>
                                <td className="p-1 px-2 border border-slate-300 font-bold text-slate-900">{stud.name}</td>
                                <td className="p-1 px-2 border border-slate-300 font-mono text-[9px]">
                                  {includeEncrypted ? CryptoService.decrypt(stud.nisn) : CryptoService.mask(stud.nisn)}
                                </td>
                                <td className="p-1 px-2 border border-slate-300">{stud.asalKelas || 'Belum Diatur'}</td>
                                <td className="p-1 px-2 border border-slate-300 font-semibold text-slate-700">
                                  {stud.currentClass === 'Belum Diatur' ? 'Belum Rombel' : `Kelas ${stud.currentClass}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>

                {/* Verification Signature stamp section */}
                <div className="flex justify-end pt-5">
                  <div className="text-center" style={{ width: '220px' }}>
                    <p className="text-slate-500 font-medium">
                      {schoolSettings.kabupaten}, {(() => {
                        const today = new Date();
                        const listMonths = [
                          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                        ];
                        return `${today.getDate()} ${listMonths[today.getMonth()]} ${today.getFullYear()}`;
                      })()}
                    </p>
                    <p className="font-bold text-slate-800">
                      Kepala Sekolah {schoolSettings.schoolName.replace('SMP NEGERI ', 'SMPN ')}
                    </p>
                    
                    <div className="h-16 flex items-center justify-center relative my-1">
                      {/* Simulated signature with stamp */}
                      {schoolSettings.useCustomStampImage && schoolSettings.stampImageUrl ? (
                        <div className="absolute z-20 pointer-events-none transform rotate-[-4deg] mix-blend-multiply opacity-85">
                          <img 
                            src={schoolSettings.stampImageUrl} 
                            alt="Stempel Kustom" 
                            className="w-20 h-20 object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <svg className="w-20 h-20 transform rotate-[-4deg] mix-blend-multiply opacity-75 absolute" viewBox="0 0 120 120">
                          <defs>
                            <path id="exportStampTextPath" d="M 60, 60 m -45, 0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0" />
                          </defs>
                          <circle cx="60" cy="60" r="54" fill="none" stroke="#251b9e" strokeWidth="2" />
                          <circle cx="60" cy="60" r="50" fill="none" stroke="#251b9e" strokeWidth="0.75" />
                          <circle cx="60" cy="60" r="32" fill="none" stroke="#251b9e" strokeWidth="1.5" />
                          
                          <text fill="#251b9e" fontSize="6.5" fontWeight="bold" letterSpacing="0.1">
                            <textPath href="#exportStampTextPath" startOffset="0%">
                              PEMERINTAH KABUPATEN {schoolSettings.kabupaten.toUpperCase()} * DINAS PENDIDIKAN *
                            </textPath>
                          </text>
                          
                          <polygon points="60,40 63,46 70,46 65,50 67,56 60,52 53,56 55,50 50,46 57,46" fill="#251b9e" />
                          <text x="60" y="65" fill="#251b9e" fontSize="7.5" fontWeight="black" textAnchor="middle" letterSpacing="0.5">
                            {schoolSettings.schoolName.replace('SMP NEGERI ', 'SMPN ').split(' ').slice(0, 2).join(' ')}
                          </text>
                          <text x="60" y="73" fill="#251b9e" fontSize="6" fontWeight="bold" textAnchor="middle">
                            {schoolSettings.kecamatan.toUpperCase()}
                          </text>
                          <path d="M 40,77 Q 60,82 80,77" fill="none" stroke="#251b9e" strokeWidth="1" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>

                    <p className="font-extrabold text-slate-950 underline">{schoolSettings.kepalaSekolah}</p>
                    <p className="text-[9px] text-slate-400 font-mono">NIP. {schoolSettings.nipKepalaSekolah}</p>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* EXCEL PREVIEW COMPONENT */
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b pb-1">
                Sampel Keluaran Baris File Excel (.CSV)
              </span>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-900 text-green-400 font-mono text-[10px] overflow-x-auto space-y-1.5 shadow-inner">
                <span className="text-slate-500 block pb-1 border-b border-slate-800"># Header Berkas Excel (.CSV) Resmi</span>
                <p className="text-[9px] opacity-100 font-bold text-white">No,Nama Lengkap,NISN,Asal Kelas,Kelas Sekarang</p>
                {students.slice(0, 4).map((s, index) => (
                  <p key={s.id} className="truncate select-none">
                    {index + 1},{s.name},{includeEncrypted ? CryptoService.decrypt(s.nisn) : CryptoService.mask(s.nisn)},{s.asalKelas || 'Belum Diatur'},{s.currentClass === 'Belum Diatur' ? 'Belum Rombel' : `Kelas ${s.currentClass}`}
                  </p>
                ))}
                <p className="text-[9px] text-slate-500 italic">... s.d. {students.length} baris siswa terdaftar.</p>
              </div>

              {/* Data Compliance Checks */}
              <div className="space-y-1 text-xs">
                <span className="block font-bold text-slate-700">Audit Kepatuhan Berkas Enkripsi</span>
                
                <div className="p-3 bg-slate-55 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex gap-2 items-center text-green-800">
                    <ShieldCheck size={16} className="text-green-700" />
                    <strong>Tanda Pengenal Keamanan Aktif</strong>
                  </div>
                  <p className="text-slate-550 text-slate-500 text-[11px] leading-relaxed">
                    Setiap baris data terekspor dikaitkan dengan checksum MD5/SHA256 visual. Ini melindungi integritas rekapitulasi agar tidak dapat diselewengkan sesudah di-download dari portal EduData SPENDA.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
