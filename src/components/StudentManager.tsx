/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Trash, 
  Edit3, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  X, 
  Check, 
  AlertCircle,
  ShieldAlert,
  GraduationCap,
  RefreshCw,
  Download
} from 'lucide-react';
import { Student } from '../types';
import { CryptoService } from '../utils/helpers';
import { read, utils, writeFile } from 'xlsx';

interface StudentManagerProps {
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id' | 'lastUpdated'>) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onAddStudentsBatch?: (newStudentsData: Omit<Student, 'id' | 'lastUpdated'>[]) => void;
  onDeleteAllStudents?: () => void;
}

export default function StudentManager({
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onAddStudentsBatch,
  onDeleteAllStudents,
}: StudentManagerProps) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('Semua');
  const [classFilter, setClassFilter] = useState('Semua');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'Semua'>(10);

  // Cryptography View States
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Modals Open
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [confirmDeleteAllText, setConfirmDeleteAllText] = useState('');

  // Form states (Add / Edit) No-complex libraries to avoid bundle issues
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'L' | 'P'>('L');
  const [formNisn, setFormNisn] = useState('');
  const [formNik, setFormNik] = useState('');
  const [formNikSiswa, setFormNikSiswa] = useState('');
  const [formReligion, setFormReligion] = useState('Islam');
  const [formBirthPlace, setFormBirthPlace] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formAverageGrade, setFormAverageGrade] = useState(80);
  const [formAsalKelas, setFormAsalKelas] = useState('Belum Diatur');
  const [formCurrentClass, setFormCurrentClass] = useState('Belum Diatur');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formGuardianName, setFormGuardianName] = useState('');
  const [formStatus, setFormStatus] = useState<'Aktif' | 'Lulus' | 'Mutasi' | 'Non-Aktif'>('Aktif');
  const [formError, setFormError] = useState('');

  // Batch Import States
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Retrieve unique class values for dropdown filter and sort naturally
  const uniqueClasses = Array.from(new Set(students.map((s) => s.currentClass)))
    .filter(Boolean)
    .sort((a, b) => {
      if (a === 'Belum Diatur') return 1;
      if (b === 'Belum Diatur') return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

  // Pin validation
  const handleValidatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setIsDecrypted(true);
      setPinPromptOpen(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('PIN Operator salah! Kode bawaan adalah "1234"');
    }
  };

  const handleToggleDecryption = () => {
    if (isDecrypted) {
      setIsDecrypted(false);
    } else {
      setPinPromptOpen(true);
    }
  };

  // Open add modal
  const openAddModal = () => {
    setFormName('');
    setFormGender('L');
    setFormNisn('');
    setFormNik('');
    setFormNikSiswa('');
    setFormReligion('Islam');
    setFormBirthPlace('');
    setFormBirthDate('');
    setFormAverageGrade(80.5);
    setFormAsalKelas('Belum Diatur');
    setFormCurrentClass('Belum Diatur');
    setFormEmail('');
    setFormAddress('');
    setFormGuardianName('');
    setFormStatus('Aktif');
    setFormError('');
    setAddModalOpen(true);
  };

  // Handle addition
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formNisn || !formNik || !formNikSiswa || !formReligion || !formBirthPlace || !formBirthDate || !formGuardianName) {
      setFormError('Harap lengkapi semua field berlabel wajib.');
      return;
    }
    if (formNisn.length !== 10) {
      setFormError('NISN harus 10 digit angka.');
      return;
    }
    if (formNik.length < 3) {
      setFormError('NIPD harus minimal 3 karakter.');
      return;
    }
    if (formNikSiswa.length !== 16) {
      setFormError('NIK Siswa harus 16 digit angka.');
      return;
    }
    if (formAverageGrade < 0 || formAverageGrade > 100) {
      setFormError('Rata-rata Nilai Rapor harus di rentang 0 - 100.');
      return;
    }

    onAddStudent({
      name: formName,
      gender: formGender,
      nisn: CryptoService.encrypt(formNisn),
      nik: CryptoService.encrypt(formNik),
      nikSiswa: CryptoService.encrypt(formNikSiswa),
      religion: formReligion,
      birthPlace: formBirthPlace,
      birthDate: formBirthDate,
      averageGrade: Number(formAverageGrade),
      asalKelas: formAsalKelas,
      currentClass: formCurrentClass,
      email: formEmail || `${formName.toLowerCase().replace(/\s+/g, '')}@spenda.sch.id`,
      address: formAddress,
      guardianName: formGuardianName,
      status: formStatus,
    });

    setAddModalOpen(false);
  };

  // Open edit modal
  const openEditModal = (student: Student) => {
    setEditStudent(student);
    setFormName(student.name);
    setFormGender(student.gender);
    // decrypt sensitive values for editing
    setFormNisn(CryptoService.decrypt(student.nisn));
    setFormNik(CryptoService.decrypt(student.nik));
    setFormNikSiswa(CryptoService.decrypt(student.nikSiswa || ''));
    setFormReligion(student.religion || 'Islam');
    setFormBirthPlace(student.birthPlace);
    setFormBirthDate(student.birthDate);
    setFormAverageGrade(student.averageGrade);
    setFormAsalKelas(student.asalKelas || 'Belum Diatur');
    setFormCurrentClass(student.currentClass);
    setFormEmail(student.email);
    setFormAddress(student.address);
    setFormGuardianName(student.guardianName);
    setFormStatus(student.status);
    setFormError('');
  };

  // Handle edit saving
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;

    if (!formName || !formNisn || !formNik || !formNikSiswa || !formReligion || !formBirthPlace || !formBirthDate || !formGuardianName) {
      setFormError('Harap lengkapi semua field berlabel wajib.');
      return;
    }
    if (formNisn.length !== 10) {
      setFormError('NISN harus 10 digit angka.');
      return;
    }
    if (formNik.length < 3) {
      setFormError('NIPD harus minimal 3 karakter.');
      return;
    }
    if (formNikSiswa.length !== 16) {
      setFormError('NIK Siswa harus 16 digit angka.');
      return;
    }
    if (formAverageGrade < 0 || formAverageGrade > 100) {
      setFormError('Rata-rata Nilai Rapor harus di rentang 0 - 100.');
      return;
    }

    onUpdateStudent({
      ...editStudent,
      name: formName,
      gender: formGender,
      nisn: CryptoService.encrypt(formNisn),
      nik: CryptoService.encrypt(formNik),
      nikSiswa: CryptoService.encrypt(formNikSiswa),
      religion: formReligion,
      birthPlace: formBirthPlace,
      birthDate: formBirthDate,
      averageGrade: Number(formAverageGrade),
      asalKelas: formAsalKelas,
      currentClass: formCurrentClass,
      email: formEmail,
      address: formAddress,
      guardianName: formGuardianName,
      status: formStatus,
      lastUpdated: new Date().toISOString().split('T')[0],
    });

    setEditStudent(null);
  };

  // Client Filter logic
  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      CryptoService.decrypt(student.nisn).includes(searchTerm) ||
      CryptoService.decrypt(student.nik).includes(searchTerm);
    
    const matchesGender = genderFilter === 'Semua' || student.gender === genderFilter;
    const matchesClass = classFilter === 'Semua' || student.currentClass === classFilter;
    const matchesStatus = statusFilter === 'Semua' || student.status === statusFilter;

    return matchesSearch && matchesGender && matchesClass && matchesStatus;
  });

  // Pagination calculation
  const limit = itemsPerPage === 'Semua' ? filteredStudents.length : itemsPerPage;
  const indexOfLastItem = itemsPerPage === 'Semua' ? filteredStudents.length : currentPage * limit;
  const indexOfFirstItem = itemsPerPage === 'Semua' ? 0 : indexOfLastItem - limit;
  const currentItems = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = itemsPerPage === 'Semua' ? 1 : Math.ceil(filteredStudents.length / limit) || 1;

  const paginate = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show page 1
      pageNumbers.push(1);

      let startIdx = Math.max(2, currentPage - 1);
      let endIdx = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 2) {
        endIdx = 4;
      } else if (currentPage >= totalPages - 1) {
        startIdx = totalPages - 3;
      }

      if (startIdx > 2) {
        pageNumbers.push('...');
      }

      for (let i = startIdx; i <= endIdx; i++) {
        pageNumbers.push(i);
      }

      if (endIdx < totalPages - 1) {
        pageNumbers.push('...');
      }

      // Always show last page
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm space-y-4">
        
        {/* Row 1: Search and Action Buttons */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search size={18} />
            </span>
            <input 
              type="text"
              placeholder="Cari Nama Siswa, NISN, atau NIPD..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-green-500 focus:bg-white transition-colors"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Decrypt toggle firewall */}
            <button
              onClick={handleToggleDecryption}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isDecrypted 
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {isDecrypted ? <Unlock size={16} /> : <Lock size={16} />}
              <span>{isDecrypted ? 'Sembunyikan Data' : 'Tampilkan Data (PIN)'}</span>
              {isDecrypted ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            {/* Delete All action */}
            {students.length > 0 && onDeleteAllStudents && (
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteAllText('');
                  setDeleteAllModalOpen(true);
                }}
                className="bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-900 border border-rose-200 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <Trash size={16} />
                <span>Hapus Semua Siswa</span>
              </button>
            )}

            {/* Import action */}
            <button
              onClick={() => {
                setImportText('');
                setImportError('');
                setImportSuccess('');
                setImportModalOpen(true);
              }}
              className="bg-slate-100 text-slate-800 hover:bg-slate-250 hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <RefreshCw size={16} className="text-green-600" />
              <span>Import Data Siswa</span>
            </button>

            {/* Addition action */}
            <button
              onClick={openAddModal}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Plus size={18} />
              <span>Tambah Siswa</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filtering Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filter Jenis Kelamin</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-750 focus:outline-none focus:border-green-500 cursor-pointer"
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="Semua">Semua Jenis Kelamin</option>
              <option value="L">Laki-Laki (L)</option>
              <option value="P">Perempuan (P)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filter Rombel (Kelas)</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-755 focus:outline-none focus:border-green-500 cursor-pointer"
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="Semua">Semua Kelas</option>
              <option value="Belum Diatur">Belum Diatur</option>
              {uniqueClasses.filter(c => c !== 'Belum Diatur').map(c => (
                <option key={c} value={c}>Kelas {c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filter Status Siswa</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-755 focus:outline-none focus:border-green-500 cursor-pointer"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="Semua">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Lulus">Lulus</option>
              <option value="Mutasi">Mutasi</option>
              <option value="Non-Aktif">Non-Aktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Database Student List Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                <th className="p-4 uppercase tracking-wider text-[10px]">Nama Lengkap</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">NIPD</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">NISN</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">NIK Siswa</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Agama</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-center">Jenis Kelamin</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Rombel</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Asal Sekolah</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Nama Ibu</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-center">Status</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {currentItems.length > 0 ? (
                currentItems.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Name */}
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-900 block">{student.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {student.birthPlace}, {student.birthDate}
                        </span>
                      </div>
                    </td>
                    
                    {/* NIPD */}
                    <td className="p-4 font-mono">
                      {isDecrypted ? (
                        <span className="bg-green-50 text-green-850 px-1.5 py-0.5 rounded font-bold border border-green-150">
                          {CryptoService.decrypt(student.nik)}
                        </span>
                      ) : (
                        <span className="text-slate-400 select-none">
                          {CryptoService.mask(student.nik, true)}
                        </span>
                      )}
                    </td>

                    {/* NISN */}
                    <td className="p-4 font-mono">
                      {isDecrypted ? (
                        <span className="bg-green-50 text-green-800 px-1.5 py-0.5 rounded font-bold border border-green-150">
                          {CryptoService.decrypt(student.nisn)}
                        </span>
                      ) : (
                        <span className="text-slate-400 select-none">
                          {CryptoService.mask(student.nisn, true)}
                        </span>
                      )}
                    </td>

                    {/* NIK Siswa */}
                    <td className="p-4 font-mono">
                      {isDecrypted ? (
                        <span className="bg-green-50 text-emerald-850 px-1.5 py-0.5 rounded font-bold border border-green-150">
                          {CryptoService.decrypt(student.nikSiswa || '')}
                        </span>
                      ) : (
                        <span className="text-slate-400 select-none">
                          {CryptoService.mask(student.nikSiswa || '', true)}
                        </span>
                      )}
                    </td>

                    {/* Agama */}
                    <td className="p-4">
                      <span className="text-[11.5px] font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
                        {student.religion || 'Islam'}
                      </span>
                    </td>

                    {/* Gender (Jenis Kelamin) */}
                    <td className="p-4 text-center">
                      <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        student.gender === 'L' 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-pink-50 text-pink-700'
                      }`}>
                        {student.gender === 'L' ? 'L' : 'P'}
                      </span>
                    </td>

                    {/* Class/Rombel */}
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                        student.currentClass === 'Belum Diatur'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-slate-100 text-slate-800 font-bold'
                      }`}>
                        {student.currentClass === 'Belum Diatur' ? 'Belum Rombel' : `Kelas ${student.currentClass}`}
                      </span>
                    </td>

                    {/* Asal Sekolah */}
                    <td className="p-4">
                      <span className="text-[11.5px] font-bold text-slate-700">
                        {student.asalKelas || 'Belum Diatur'}
                      </span>
                    </td>

                    {/* Nama Ibu */}
                    <td className="p-4 text-slate-600 text-xs truncate max-w-[124px]" title={student.guardianName}>
                      {student.guardianName}
                    </td>

                    {/* Status */}
                    <td className="p-4 text-center">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        student.status === 'Aktif'
                          ? 'bg-green-500 text-white'
                          : student.status === 'Lulus'
                          ? 'bg-sky-500 text-white'
                          : student.status === 'Mutasi'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-400 text-white'
                      }`}>
                        {student.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(student)}
                          className="p-1 px-2 rounded hover:bg-slate-100 hover:text-green-600 text-slate-500 transition-colors"
                          title="Ubah"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${student.name}? Tindakan ini permanen.`)) {
                              onDeleteStudent(student.id);
                            }
                          }}
                          className="p-1 px-2 rounded hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors"
                          title="Hapus"
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    Tidak ditemukan data siswa yang cocok dengan kriteria filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginated footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span>Menampilkan <b className="text-slate-700">{filteredStudents.length === 0 ? 0 : indexOfFirstItem + 1}</b> sampai <b className="text-slate-700">{Math.min(filteredStudents.length, indexOfLastItem)}</b> dari total <b className="text-slate-700">{filteredStudents.length}</b> siswa</span>
            
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
              <span className="text-slate-400">Tampilkan:</span>
              <select
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 font-semibold focus:outline-none focus:border-green-500 hover:border-slate-300 cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemsPerPage(val === 'Semua' ? 'Semua' : Number(val));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10 siswa</option>
                <option value={25}>25 siswa</option>
                <option value={50}>50 siswa</option>
                <option value={100}>100 siswa</option>
                <option value="Semua">Semua</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 font-medium transition-colors"
            >
              Sebelumnya
            </button>
            {getPageNumbers().map((no, idx) => {
              if (no === '...') {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="px-2 py-1 text-slate-400 select-none font-medium text-center min-w-[32px]"
                  >
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={no}
                  onClick={() => paginate(Number(no))}
                  className={`px-3 py-1 rounded border font-semibold transition-colors ${
                    currentPage === no
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {no}
                </button>
              );
            })}
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 font-medium transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* FIREWALL SECURITY PIN POPUP */}
      {pinPromptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-green-600 border-b border-green-100 pb-3">
              <ShieldAlert size={24} className="animate-pulse" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Otorisasi Kode Pengaman</h3>
                <p className="text-[10px] text-slate-400">Verifikasi operator EduData SPENDA</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Data NISN & NIPD dienkripsi secara penuh. Untuk melihat plaintext (data asli), masukkan <b className="text-green-700">PIN Sandi Operator</b>.
              <br />
              <span className="text-[10px] text-slate-400 bg-slate-50 p-1 rounded font-mono mt-1 block">Petunjuk AI: PIN default adalah <b className="text-slate-600">1234</b></span>
            </p>

            <form onSubmit={handleValidatePin} className="space-y-3">
              <input 
                type="password"
                placeholder="4 Digit PIN Operator (e.g. 1234)"
                maxLength={4}
                className="w-full text-center bg-slate-100 border border-slate-200 rounded-lg p-2.5 font-mono text-lg tracking-widest focus:outline-none focus:border-green-600"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                autoFocus
              />
              {pinError && <p className="text-[10px] font-bold text-rose-600">{pinError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinPromptOpen(false);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="w-1/2 p-2 rounded-lg text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="w-1/2 p-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700"
                >
                  Verifikasi PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SISWA MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b border-green-100 bg-green-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Plus className="text-green-700" size={18} />
                <h3 className="font-bold text-slate-800 text-sm">Registrasi Siswa Baru SPENDA</h3>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="bg-rose-50 text-rose-800 border-l-4 border-rose-500 p-3 rounded font-medium text-xs flex gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Name */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Nama Lengkap Siswa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Muhammad Fajrul"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Jenis Kelamin *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as 'L' | 'P')}
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                {/* NISN */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">NISN (10 Digit Angka) *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="Contoh: 0089851025"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500"
                    value={formNisn}
                    onChange={(e) => setFormNisn(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                {/* NIPD */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">NIPD (Nomor Induk Peserta Didik) *</label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    placeholder="Contoh: 12345/A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                  />
                </div>

                {/* NIK Siswa */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">NIK Siswa (16 Digit Angka) *</label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    placeholder="Contoh: 3515082104080004"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500"
                    value={formNikSiswa}
                    onChange={(e) => setFormNikSiswa(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                {/* Agama */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Agama Siswa *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formReligion}
                    onChange={(e) => setFormReligion(e.target.value)}
                  >
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Khonghucu">Khonghucu</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {/* Tempat Lahir */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Tempat Lahir *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Sidoarjo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formBirthPlace}
                    onChange={(e) => setFormBirthPlace(e.target.value)}
                  />
                </div>

                {/* Tanggal Lahir */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Tanggal Lahir *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formBirthDate}
                    onChange={(e) => setFormBirthDate(e.target.value)}
                  />
                </div>

                {/* Rata-Rata Nilai */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Rata-Rata Nilai Rapor / Ujian *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500 animate-pulse-once"
                    value={formAverageGrade}
                    onChange={(e) => setFormAverageGrade(parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-slate-400">Rata-rata akademis digunakan dalam pemisahan kelas heterogen.</p>
                </div>

                {/* Guardian Name */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Nama Orang Tua / Wali *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Sugeng Slamet"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formGuardianName}
                    onChange={(e) => setFormGuardianName(e.target.value)}
                  />
                </div>

                {/* Email (Optional) */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Alamat Email (opsional)</label>
                  <input
                    type="email"
                    placeholder="Contoh: m.fajrul@spenda.sch.id"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Status Keaktifan *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Mutasi">Mutasi</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>

                {/* Asal Kelas / SD Asal */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Asal Kelas / SD Asal *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SDN 1 Sidokare atau 7.1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formAsalKelas}
                    onChange={(e) => setFormAsalKelas(e.target.value)}
                  />
                </div>
              </div>

              {/* Alamat */}
              <div className="space-y-1 text-xs">
                <label className="block text-slate-700 font-semibold mb-0.5">Alamat Lengkap Rumah</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Sidokare Indah Blok G-23, Kec. Sidoarjo, Kab. Sidoarjo"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-4 text-xs">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="p-2 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="p-2 px-5 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700"
                >
                  Simpan Registrasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SISWA MODAL */}
      {editStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b border-green-100 bg-green-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Edit3 className="text-green-700" size={18} />
                <h3 className="font-bold text-slate-800 text-sm">Ubah Rincian Siswa: {editStudent.name}</h3>
              </div>
              <button onClick={() => setEditStudent(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="bg-rose-50 text-rose-800 border-l-4 border-rose-500 p-3 rounded font-medium text-xs flex gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Name */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Nama Lengkap Siswa *</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Jenis Kelamin *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as 'L' | 'P')}
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                {/* NISN */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">NISN (10 Digit Angka) *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500"
                    value={formNisn}
                    onChange={(e) => setFormNisn(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                {/* NIPD */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">NIPD (Nomor Induk Peserta Didik) *</label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                  />
                </div>

                {/* NIK Siswa */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">NIK Siswa (16 Digit Angka) *</label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    placeholder="Contoh: 3515082104080004"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500"
                    value={formNikSiswa}
                    onChange={(e) => setFormNikSiswa(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                {/* Agama */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Agama Siswa *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formReligion}
                    onChange={(e) => setFormReligion(e.target.value)}
                  >
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Khonghucu">Khonghucu</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {/* Tempat Lahir */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Tempat Lahir *</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formBirthPlace}
                    onChange={(e) => setFormBirthPlace(e.target.value)}
                  />
                </div>

                {/* Tanggal Lahir */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Tanggal Lahir *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formBirthDate}
                    onChange={(e) => setFormBirthDate(e.target.value)}
                  />
                </div>

                {/* Rata-Rata Nilai */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Rata-Rata Nilai Rapor / Ujian *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500"
                    value={formAverageGrade}
                    onChange={(e) => setFormAverageGrade(parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* Guardian Name */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Nama Orang Tua / Wali *</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formGuardianName}
                    onChange={(e) => setFormGuardianName(e.target.value)}
                  />
                </div>

                {/* Asal Kelas / SD Asal */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Asal Kelas / SD Asal *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SDN 1 Sidokare atau 7.1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formAsalKelas}
                    onChange={(e) => setFormAsalKelas(e.target.value)}
                  />
                </div>

                {/* Rombel manually (can be changed manually or via automatic filter) */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Rombel Sekarang (Opsi Kelas) *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formCurrentClass}
                    onChange={(e) => setFormCurrentClass(e.target.value)}
                  >
                    <option value="Belum Diatur">Belum Diatur</option>
                    <optgroup label="Tingkat Kelas 7 (7.1 - 7.9)">
                      <option value="7.1">Kelas 7.1</option>
                      <option value="7.2">Kelas 7.2</option>
                      <option value="7.3">Kelas 7.3</option>
                      <option value="7.4">Kelas 7.4</option>
                      <option value="7.5">Kelas 7.5</option>
                      <option value="7.6">Kelas 7.6</option>
                      <option value="7.7">Kelas 7.7</option>
                      <option value="7.8">Kelas 7.8</option>
                      <option value="7.9">Kelas 7.9</option>
                    </optgroup>
                    <optgroup label="Tingkat Kelas 8 (8.1 - 8.9)">
                      <option value="8.1">Kelas 8.1</option>
                      <option value="8.2">Kelas 8.2</option>
                      <option value="8.3">Kelas 8.3</option>
                      <option value="8.4">Kelas 8.4</option>
                      <option value="8.5">Kelas 8.5</option>
                      <option value="8.6">Kelas 8.6</option>
                      <option value="8.7">Kelas 8.7</option>
                      <option value="8.8">Kelas 8.8</option>
                      <option value="8.9">Kelas 8.9</option>
                    </optgroup>
                    <optgroup label="Tingkat Kelas 9 (9.1 - 9.9)">
                      <option value="9.1">Kelas 9.1</option>
                      <option value="9.2">Kelas 9.2</option>
                      <option value="9.3">Kelas 9.3</option>
                      <option value="9.4">Kelas 9.4</option>
                      <option value="9.5">Kelas 9.5</option>
                      <option value="9.6">Kelas 9.6</option>
                      <option value="9.7">Kelas 9.7</option>
                      <option value="9.8">Kelas 9.8</option>
                      <option value="9.9">Kelas 9.9</option>
                    </optgroup>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-semibold mb-0.5">Status Keaktifan *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Mutasi">Mutasi</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>
              </div>

              {/* Alamat */}
              <div className="space-y-1 text-xs">
                <label className="block text-slate-700 font-semibold mb-0.5">Alamat Lengkap Rumah</label>
                <textarea
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-green-500"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-4 text-xs">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="p-2 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="p-2 px-5 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* BATCH IMPORT MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b border-green-100 bg-green-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <RefreshCw className="text-green-700 animate-spin-once" size={18} />
                <h3 className="font-bold text-slate-800 text-sm">Impor Bulk Data Siswa (Excel/CSV/Text)</h3>
              </div>
              <button 
                onClick={() => setImportModalOpen(false)} 
                className="text-slate-400 hover:text-slate-650 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!importText.trim()) {
                setImportError('Harap tempel data terlebih dahulu.');
                return;
              }

              const lines = importText.split('\n');
              const parsedStudents: Omit<Student, 'id' | 'lastUpdated'>[] = [];
              let ignoredCount = 0;
              let successCount = 0;

              for (let rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;

                // Determine cols by splitting. Favor tabs if present (e.g. pasted/imported from Excel/Google Sheets), to prevent splitting on commas inside addresses/birthplaces.
                const cols = line.includes('\t')
                  ? line.split('\t').map(c => c.replace(/^["']|["']$/g, '').trim())
                  : line.split(/;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^["']|["']$/g, '').trim());

                if (cols.length === 0 || !cols[0]) {
                  continue;
                }

                // Skip headers using specific column check to avoid matching student name/address substrings (e.g. "nik", "nisn" in Niken, Anis, etc.)
                const isHeader = 
                  cols[0].toLowerCase().includes('nama lengkap') ||
                  cols[0].toLowerCase().trim() === 'nama' ||
                  cols[0].toLowerCase().includes('nomor induk') ||
                  (cols[1] && cols[1].toLowerCase().includes('nipd')) ||
                  (cols[3] && cols[3].toLowerCase().includes('nisn'));

                if (isHeader) {
                  continue;
                }

                // Name is required
                const name = cols[0];
                if (!name || name.trim() === '') {
                  ignoredCount++;
                  continue;
                }

                const nikRaw = cols[1] ? cols[1].trim() : ''; // holds NIPD
                const gender = (cols[2] || 'L').toUpperCase().startsWith('P') ? 'P' : 'L';
                const nisnRaw = cols[3] ? cols[3].replace(/\D/g, '').trim() : '';
                const nikSiswaRaw = cols[4] ? cols[4].replace(/\D/g, '').trim() : '';
                const religion = cols[5] || 'Islam';

                const birthPlace = cols[6] || 'Sidoarjo';
                const birthDate = cols[7] || '2012-01-01';
                const address = cols[8] || '-';
                const guardianName = cols[9] || '-';

                let rClassRaw = cols[10] || 'Belum Diatur';
                if (rClassRaw.toLowerCase().includes('belum') || rClassRaw.toLowerCase().includes('tidak')) {
                  rClassRaw = 'Belum Diatur';
                } else {
                  const upperClass = rClassRaw.toUpperCase();
                  if (upperClass.startsWith("KELAS ")) {
                    rClassRaw = rClassRaw.substring(6).trim();
                  }
                }

                const asalKelas = cols[11] || 'Belum Diatur';
                const averageGrade = 0.0;

                parsedStudents.push({
                   name,
                   gender,
                   nisn: CryptoService.encrypt(nisnRaw),
                   nik: CryptoService.encrypt(nikRaw),
                   nikSiswa: CryptoService.encrypt(nikSiswaRaw),
                   religion,
                   birthPlace,
                   birthDate,
                   averageGrade,
                   asalKelas,
                   currentClass: rClassRaw,
                   email: `${name.toLowerCase().replace(/\s+/g, '')}@spenda.sch.id`,
                   address,
                   guardianName,
                   status: 'Aktif'
                 });
                 successCount++;
              }

              if (parsedStudents.length === 0) {
                setImportError('Tidak ada baris data yang cocok dengan format wajib.');
                return;
              }

              if (onAddStudentsBatch) {
                onAddStudentsBatch(parsedStudents);
                setImportSuccess(`Berhasil mengimpor ${successCount} siswa! (Diabaikan: ${ignoredCount} baris)`);
                setImportText('');
                setImportError('');
                setTimeout(() => {
                  setImportModalOpen(false);
                }, 2000);
              } else {
                setImportError('Metode impor tidak terdeteksi.');
              }
            }} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {importError && (
                <div className="bg-rose-50 text-rose-800 border-l-4 border-rose-500 p-3 rounded font-medium text-xs flex gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="bg-green-50 text-green-800 border-l-4 border-green-500 p-3 rounded font-medium text-xs">
                  <span>{importSuccess}</span>
                </div>
              )}

              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="block font-bold text-slate-700">Pilih File (Excel .xlsx / .xls atau CSV / TXT)</span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const templateData = [
                          [
                            "Nama Lengkap",
                            "Nomor Induk Peserta Didik Sekolah",
                            "Jenis Kelamin",
                            "NISN",
                            "NIK Siswa (16 Digit)",
                            "Agama",
                            "Tempat Lahir",
                            "Tanggal Lahir (YYYY-MM-DD)",
                            "Alamat Siswa",
                            "Nama Ibu",
                            "Rombel Kelas",
                            "Asal Sekolah"
                          ],
                          [
                            "Bagus Triyono",
                            "12345",
                            "L",
                            "0082345678",
                            "3515081204080001",
                            "Islam",
                            "Sidoarjo",
                            "2012-05-30",
                            "Jl. Pahlawan Gg 3 No 15, Sidoarjo",
                            "Siti Aminah",
                            "7-A",
                            "SDN 1 Buduran"
                          ],
                          [
                            "Kusuma Wardani",
                            "12346",
                            "P",
                            "0089876543",
                            "3515085408080002",
                            "Kristen",
                            "Sidoarjo",
                            "2012-10-18",
                            "Perum Delta Sari Indah Blok F-12, Sidoarjo",
                            "Kartini",
                            "Belum Diatur",
                            "SDN 2 Sidokare"
                          ]
                        ];
                        const ws = utils.aoa_to_sheet(templateData);
                        const wb = utils.book_new();
                        utils.book_append_sheet(wb, ws, "Template Siswa");
                        
                        // Set column widths for better readability
                        ws['!cols'] = [
                          { wch: 25 }, // Nama Lengkap
                          { wch: 32 }, // Nomor Induk Peserta Didik Sekolah
                          { wch: 15 }, // Jenis Kelamin (L/P)
                          { wch: 15 }, // NISN
                          { wch: 22 }, // NIK Siswa
                          { wch: 15 }, // Agama
                          { wch: 18 }, // Tempat Lahir
                          { wch: 25 }, // Tanggal Lahir (YYYY-MM-DD)
                          { wch: 35 }, // Alamat Siswa
                          { wch: 20 }, // Nama Ibu
                          { wch: 18 }, // Rombel Kelas
                          { wch: 25 }  // Asal Sekolah
                        ];

                        writeFile(wb, "template_import_siswa_spenda.xlsx");
                        setImportSuccess("Berhasil mengunduh berkas template Excel! Silakan edit data lalu unggah kembali.");
                        setImportError("");
                      } catch (err: any) {
                        setImportError(`Gagal membuat template: ${err.message || err}`);
                      }
                    }}
                    className="text-green-700 hover:text-green-950 font-bold bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-md border border-green-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Download size={13} />
                    <span>Unduh Template Excel (.xlsx)</span>
                  </button>
                </div>
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const fileName = file.name.toLowerCase();
                    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

                    if (isExcel) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const data = new Uint8Array(event.target?.result as ArrayBuffer);
                          const workbook = read(data, { type: 'array' });
                          const firstSheetName = workbook.SheetNames[0];
                          const worksheet = workbook.Sheets[firstSheetName];
                          
                          // Convert worksheet to raw rows
                          const rawRows = utils.sheet_to_json<any[]>(worksheet, { header: 1 });
                          if (!rawRows || rawRows.length === 0) {
                            setImportError('Berkas Excel kosong atau tidak terbaca.');
                            setImportSuccess('');
                            return;
                          }

                          // Build tab-separated values (TSV)
                          const tsvLines = rawRows.map(row => {
                            if (!row || !Array.isArray(row)) return '';
                            return row.map(cell => {
                              if (cell === null || cell === undefined) return '';
                              // Sanitize sheet values matching standard TSV formatting
                              return String(cell).replace(/[\t\r\n]/g, ' ').trim();
                            }).join('\t');
                          }).filter(line => line.trim().length > 0);

                          if (tsvLines.length > 0) {
                            setImportText(tsvLines.join('\n'));
                            setImportSuccess('Berhasil membaca berkas Excel (.xlsx/.xls)! Silakan tinjau data di bawah lalu klik "Proses Impor".');
                            setImportError('');
                          } else {
                            setImportError('Gagal membaca baris data dari berkas Excel.');
                            setImportSuccess('');
                          }
                        } catch (err: any) {
                          setImportError(`Gagal memuat berkas Excel: ${err.message || err}`);
                          setImportSuccess('');
                        }
                      };
                      reader.readAsArrayBuffer(file);
                    } else {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        if (text) {
                          setImportText(text);
                          setImportSuccess('Berhasil memuat berkas CSV/TXT! Silakan tinjau data di bawah lalu klik "Proses Impor".');
                          setImportError('');
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="space-y-1 text-xs text-slate-500">
                <span className="block font-bold text-slate-700">Atau Tempel / Paste Langsung dari Excel di sini:</span>
                <div className="bg-green-50/50 p-2 border border-green-150 rounded text-[10px] space-y-1 mb-2">
                  <span className="font-bold text-green-800">Format Kolom Berurutan (Pemisah TAB/Koma):</span>
                  <p className="font-mono text-green-700 bg-white p-1 rounded overflow-x-auto leading-none">
                    Nama Lengkap [TAB] Nomor Induk Peserta Didik Sekolah [TAB] Jenis Kelamin [TAB] NISN [TAB] NIK Siswa (16) [TAB] Agama [TAB] Tempat Lahir [TAB] Tanggal Lahir [TAB] Alamat Siswa [TAB] Nama Ibu [TAB] Rombel Kelas [TAB] Asal Sekolah
                  </p>
                  <span className="block text-[9px] text-green-600 font-medium">
                    * Tip: Cukup copy cell dari Microsoft Excel / Google Sheets lalu tempel di text area di bawah ini.
                  </span>
                </div>

                <textarea
                  rows={6}
                  placeholder={`Contoh tempel:\nBagus Triyono\t12345\tL\t0082345678\t3515081204080001\tIslam\tSidoarjo\t2012-05-30\tJl. Pahlawan Gg 3 No 15, Sidoarjo\tSiti Aminah\t7-A\tSDN 1 Buduran\nKusuma Wardani\t12346\tP\t0089876543\t3515085408080002\tKristen\tSidoarjo\t2012-10-18\tPerum Delta Sari Indah Blok F-12, Sidoarjo\tKartini\tBelum Diatur\tSDN 2 Sidokare`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-green-500 text-[11px]"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-4 text-xs">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="p-2 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="p-2 px-5 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  <span>Proses Impor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DANGER CONFIRM DELETE ALL STUDENTS MODAL */}
      {deleteAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-rose-100">
            <div className="flex items-center justify-between p-4 border-b border-rose-100 bg-rose-50 rounded-t-xl text-rose-900">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-rose-600 shrink-0" size={20} />
                <h3 className="font-extrabold text-sm tracking-tight text-rose-800">Peringatan: Hapus Semua Registrasi Siswa</h3>
              </div>
              <button 
                onClick={() => setDeleteAllModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-50/50 border border-rose-100 p-3.5 rounded-lg space-y-2">
                <p className="text-xs text-rose-800 leading-relaxed font-semibold">
                  Anda akan menghapus secara permanen seluruh <strong className="text-rose-900 text-sm font-extrabold underline">{students.length} data siswa</strong> yang terdaftar di database lokal aplikasi ini beserta seluruh data rapor, kelas, dan status terkait.
                </p>
                <div className="text-[10px] text-rose-600 leading-normal bg-white p-2 rounded border border-rose-200">
                  <span className="font-bold uppercase tracking-wider block mb-0.5">Konsekuensi:</span>
                  • Seluruh NISN & NIK terenkripsi akan dihapus.<br/>
                  • Data tidak dapat dikembalikan lagi setelah dihapus (Non-reversible).
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block font-bold text-slate-700">Ketik konfirmasi kata kunci berikut:</label>
                <input
                  type="text"
                  placeholder="Ketik HAPUS-SEMUA di sini..."
                  value={confirmDeleteAllText}
                  onChange={(e) => setConfirmDeleteAllText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-center text-sm tracking-wider font-bold uppercase focus:outline-none focus:border-rose-500 focus:bg-white text-rose-700 placeholder-slate-300"
                />
                <span className="block text-[10px] text-slate-400 text-center">
                  Masukkan: <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-bold font-mono">HAPUS-SEMUA</code>
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl text-xs">
              <button
                type="button"
                onClick={() => setDeleteAllModalOpen(false)}
                className="p-2 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={confirmDeleteAllText !== 'HAPUS-SEMUA'}
                onClick={() => {
                  if (onDeleteAllStudents) {
                    onDeleteAllStudents();
                  }
                  setDeleteAllModalOpen(false);
                }}
                className={`p-2 px-5 rounded-lg font-extrabold text-white flex items-center gap-1.5 tracking-wide transition-all ${
                  confirmDeleteAllText === 'HAPUS-SEMUA'
                    ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer hover:shadow-md active:scale-95'
                    : 'bg-slate-300 cursor-not-allowed text-slate-400'
                }`}
              >
                <Trash size={14} />
                <span>HENTIKAN & HAPUS SEMUA</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
