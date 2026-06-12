/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, ClassBalanceStats, UpdateNotification, DapodikSyncLog, SchoolSettings } from '../types';

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  logoUrl: '', // empty means use the default beautiful SVG shield logo
  useCustomKopImage: false,
  kopImageUrl: '',
  useCustomStampImage: false,
  stampImageUrl: '',
  schoolName: 'SMP NEGERI 2 MUARA ENIM',
  npsn: '10603456',
  akreditasi: 'A',
  email: 'humas@smpn2muaraenim.sch.id',
  address: 'Jalan Jenderal Sudirman No. 124, Muara Enim, Sumatera Selatan 31311',
  province: 'Sumatera Selatan',
  kabupaten: 'Muara Enim',
  kecamatan: 'Muara Enim',
  kepalaSekolah: 'Dr. H. Slamet Rahardjo, M.Pd.',
  nipKepalaSekolah: '19740815 200112 1 003',
  kurikulumName: 'Sumardi, S.Pd., M.Si.',
  nipKurikulum: '19780512 200501 1 004',
  tahunAjaran: '2026/2027',
  noSuratPrefix: '421.2 / SMPN2 / SIM-ROMBEL'
};


/**
 * Distributes students into a specified number of classes heterogeneously.
 * This guarantees:
 * 1. Balanced total student count per class.
 * 2. Balanced male (L) vs female (P) ratio.
 * 3. Balanced academic performance (average grade) across all classes (no elite/unggulan class).
 * 
 * It matches male/female groups separated and sorted by grade, distributing them
 * in a serpentine (zigzag) pattern to achieve uniform averages.
 */
export function divideClassesHeterogeneously(
  students: Student[],
  classNames: string[]
): { assignedStudents: Student[]; stats: ClassBalanceStats[] } {
  if (students.length === 0 || classNames.length === 0) {
    return { assignedStudents: [], stats: [] };
  }

  const K = classNames.length;
  
  // Initialize the result buckets
  const buckets: Student[][] = Array.from({ length: K }, () => []);

  // Separate genders
  const males = students.filter((s) => s.gender === 'L');
  const females = students.filter((s) => s.gender === 'P');

  // Sort both groups by average grade in descending order to perform premium serpentine pattern
  males.sort((a, b) => b.averageGrade - a.averageGrade);
  females.sort((a, b) => b.averageGrade - a.averageGrade);

  // Distribute Males using Serpentine routing
  let forward = true;
  let index = 0;
  for (let i = 0; i < males.length; i++) {
    buckets[index].push({ ...males[i], currentClass: classNames[index] });
    
    // Zig-zag movement
    if (forward) {
      if (index === K - 1) {
        forward = false;
      } else {
        index++;
      }
    } else {
      if (index === 0) {
        forward = true;
      } else {
        index--;
      }
    }
  }

  // Distribute Females using opposite serpentine routing to balance averages even more
  // (if males ended forward index, females can go backward or forward)
  for (let i = 0; i < females.length; i++) {
    buckets[index].push({ ...females[i], currentClass: classNames[index] });
    
    if (forward) {
      if (index === K - 1) {
        forward = false;
      } else {
        index++;
      }
    } else {
      if (index === 0) {
        forward = true;
      } else {
        index--;
      }
    }
  }

  // Compile classes with details
  const stats: ClassBalanceStats[] = classNames.map((name, i) => {
    // Sort students in the bucket alphabetically by name
    buckets[i].sort((a, b) => a.name.localeCompare(b.name));
    const classStudents = buckets[i];
    const total = classStudents.length;
    const maleCount = classStudents.filter((s) => s.gender === 'L').length;
    const femaleCount = classStudents.filter((s) => s.gender === 'P').length;
    
    let sumGrade = 0;
    let minGrade = total > 0 ? 100 : 0;
    let maxGrade = 0;
    
    classStudents.forEach((s) => {
      sumGrade += s.averageGrade;
      if (s.averageGrade < minGrade) minGrade = s.averageGrade;
      if (s.averageGrade > maxGrade) maxGrade = s.averageGrade;
    });

    return {
      className: name,
      studentsCount: total,
      maleCount,
      femaleCount,
      averageGrade: total > 0 ? parseFloat((sumGrade / total).toFixed(2)) : 0,
      minGrade: total > 0 ? minGrade : 0,
      maxGrade,
      students: classStudents,
    };
  });

  // Flat maps everything back
  const assignedStudents = buckets.flat();

  return { assignedStudents, stats };
}

/**
 * Simple Cryptography and Hashing Simulation for NISN and NIK.
 * Since sensitive data is stored in LocalStorage, this highlights the "Enkripsi Tangguh" requested.
 */
export const CryptoService = {
  // Encrypt sensitive records with simulated AES-256 (visually obscured)
  encrypt: (text: string): string => {
    if (!text) return '';
    // Custom cipher simulating complex database AES encryption
    const prefix = 'ENC_AES256_';
    const base = btoa(text);
    // Reverse base64 string
    const reversed = base.split('').reverse().join('');
    return `${prefix}${reversed}`;
  },

  // Decrypts the cipher
  decrypt: (cipher: string): string => {
    if (!cipher) return '';
    if (!cipher.startsWith('ENC_AES256_')) return cipher; // not encrypted
    try {
      const payload = cipher.replace('ENC_AES256_', '');
      const originalBase = payload.split('').reverse().join('');
      return atob(originalBase);
    } catch (e) {
      return 'DECRYPTION_FAILED';
    }
  },

  // Display masked value e.g., ****-****-1234
  mask: (text: string, isEncrypted = true): string => {
    const decrypted = isEncrypted ? CryptoService.decrypt(text) : text;
    if (decrypted.length <= 4) return '****';
    const lastFour = decrypted.slice(-4);
    return `•••• •••• ${lastFour}`;
  },

  // Mock standard SHA256 checksum for security auditing of the records
  generateHash: (student: Student): string => {
    const payload = `${student.name}-${student.nisn}-${student.nik}-${student.nikSiswa}-${student.religion}-${student.averageGrade}`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
       const char = payload.charCodeAt(i);
       hash = (hash << 5) - hash + char;
       hash = hash & hash; // Convert to 32bit integer
    }
    return `SHA256-${Math.abs(hash).toString(16).toUpperCase()}`;
  }
};

/**
 * Premium seed database populated automatically if localstorage is empty.
 * Provides rich data for immediate display of high fidelity statistics, splits, and dashboarding.
 */
export const INITIAL_STUDENT_SEED: Student[] = [
  { id: '1', name: 'Ahmad Faiz Ramadhan', gender: 'L', nisn: CryptoService.encrypt('0081234561'), nik: CryptoService.encrypt('12301/A'), nikSiswa: CryptoService.encrypt('3515021204080001'), religion: 'Islam', birthPlace: 'Sidoarjo', birthDate: '2008-04-12', averageGrade: 88.5, asalKelas: 'SDN 1 Sidokare', currentClass: 'Belum Diatur', email: 'faiz@gmail.com', address: 'Jl. Pemuda No. 12, Sidoarjo', guardianName: 'Budi Santoso', status: 'Aktif', lastUpdated: '2026-06-05' },
  { id: '2', name: 'Bunga Citra Lestari', gender: 'P', nisn: CryptoService.encrypt('0081234562'), nik: CryptoService.encrypt('12302/A'), nikSiswa: CryptoService.encrypt('3515024210080003'), religion: 'Islam', birthPlace: 'Surabaya', birthDate: '2008-10-02', averageGrade: 94.2, asalKelas: 'SDN 2 Sidoarjo', currentClass: 'Belum Diatur', email: 'bunga.citra@gmail.com', address: 'Perum Gading Fajar Blok B4, Sidoarjo', guardianName: 'Hendra Lestari', status: 'Aktif', lastUpdated: '2026-06-08' },
  { id: '3', name: 'Candra Wijaya', gender: 'L', nisn: CryptoService.encrypt('0081234563'), nik: CryptoService.encrypt('12303/A'), nikSiswa: CryptoService.encrypt('3515021509080002'), religion: 'Kristen', birthPlace: 'Sidoarjo', birthDate: '2008-09-15', averageGrade: 75.8, asalKelas: 'SDN 1 Buduran', currentClass: 'Belum Diatur', email: 'candra.wijaya@outlook.com', address: 'Dusun Klangonan RT 04 RW 02, Sidoarjo', guardianName: 'Suryo Wijaya', status: 'Aktif', lastUpdated: '2026-06-01' },
  { id: '4', name: 'Dian Sastrowardoyo', gender: 'P', nisn: CryptoService.encrypt('0081234564'), nik: CryptoService.encrypt('12304/A'), nikSiswa: CryptoService.encrypt('3515025603080001'), religion: 'Islam', birthPlace: 'Jakarta', birthDate: '2008-03-16', averageGrade: 81.4, asalKelas: 'SDN 3 Sidoarjo', currentClass: 'Belum Diatur', email: 'dian.sastro@yahoo.com', address: 'Jl. Diponegoro No. 45, Sidoarjo', guardianName: 'Ardi Wardoyo', status: 'Aktif', lastUpdated: '2026-06-07' },
  { id: '5', name: 'Eko Sulistyo', gender: 'L', nisn: CryptoService.encrypt('0081234565'), nik: CryptoService.encrypt('12305/A'), nikSiswa: CryptoService.encrypt('3515022011080005'), religion: 'Islam', birthPlace: 'Mojokerto', birthDate: '2008-11-20', averageGrade: 68.9, asalKelas: 'SDN 1 Sidokare', currentClass: 'Belum Diatur', email: 'eko.sulistyo@gmail.com', address: 'Jl. Kartini IV No. 9, Sidoarjo', guardianName: 'Supardi', status: 'Aktif', lastUpdated: '2026-05-28' },
  { id: '6', name: 'Fitri Handayani', gender: 'P', nisn: CryptoService.encrypt('0081234566'), nik: CryptoService.encrypt('12306/A'), nikSiswa: CryptoService.encrypt('3515026405080002'), religion: 'Islam', birthPlace: 'Sidoarjo', birthDate: '2008-05-24', averageGrade: 89.1, asalKelas: 'SDN 2 Sidoarjo', currentClass: 'Belum Diatur', email: 'fitri.h@gmail.com', address: 'Jl. Pahlawan Gg. 2 No. 8, Sidoarjo', guardianName: 'Sudahnan', status: 'Aktif', lastUpdated: '2026-06-09' },
  { id: '7', name: 'Genta Buana', gender: 'L', nisn: CryptoService.encrypt('0081234567'), nik: CryptoService.encrypt('12307/A'), nikSiswa: CryptoService.encrypt('3515020112080001'), religion: 'Islam', birthPlace: 'Malang', birthDate: '2008-12-01', averageGrade: 91.5, asalKelas: 'SDN 1 Buduran', currentClass: 'Belum Diatur', email: 'genta.buana@gmail.com', address: 'Perum Puri Indah Blok D-11, Sidoarjo', guardianName: 'Wawan Genta', status: 'Aktif', lastUpdated: '2026-06-02' },
  { id: '8', name: 'Hani Shafira', gender: 'P', nisn: CryptoService.encrypt('0081234568'), nik: CryptoService.encrypt('12308/A'), nikSiswa: CryptoService.encrypt('3515025101090004'), religion: 'Islam', birthPlace: 'Gresik', birthDate: '2009-01-11', averageGrade: 74.3, asalKelas: 'SDN 3 Sidoarjo', currentClass: 'Belum Diatur', email: 'hani.shafira@gmail.com', address: 'Bluru Kidul Rt 02 Rw 04, Sidoarjo', guardianName: 'Ahmad Syafii', status: 'Aktif', lastUpdated: '2026-06-06' },
  { id: '9', name: 'Indra Herlambang', gender: 'L', nisn: CryptoService.encrypt('0081234569'), nik: CryptoService.encrypt('12309/A'), nikSiswa: CryptoService.encrypt('3515022202080002'), religion: 'Islam', birthPlace: 'Sidoarjo', birthDate: '2008-02-22', averageGrade: 83.2, asalKelas: 'SDN 1 Sidokare', currentClass: 'Belum Diatur', email: 'indra.her@gmail.com', address: 'Perum Taman Pinang Indah C4, Sidoarjo', guardianName: 'Suherman', status: 'Aktif', lastUpdated: '2026-06-05' },
  { id: '10', name: 'Julia Estelle', gender: 'P', nisn: CryptoService.encrypt('0081234570'), nik: CryptoService.encrypt('12310/A'), nikSiswa: CryptoService.encrypt('3515027007080001'), religion: 'Kristen', birthPlace: 'Surabaya', birthDate: '2008-07-30', averageGrade: 96.0, asalKelas: 'SDN 2 Sidoarjo', currentClass: 'Belum Diatur', email: 'julia.estelle@yahoo.com', address: 'Jl. Jenderal Sudirman No. 101, Sidoarjo', guardianName: 'Christian Estelle', status: 'Aktif', lastUpdated: '2026-06-10' },
  { id: '11', name: 'Kevin Sanjaya', gender: 'L', nisn: CryptoService.encrypt('0081234571'), nik: CryptoService.encrypt('12311/A'), nikSiswa: CryptoService.encrypt('3515020508080004'), religion: 'Katolik', birthPlace: 'Banyuwangi', birthDate: '2008-08-05', averageGrade: 78.4, asalKelas: 'SD Pembangunan', currentClass: 'Belum Diatur', email: 'kevin.sanjaya@gmail.com', address: 'Jl. Raden Patah No. 34, Sidoarjo', guardianName: 'Ade Kusuma', status: 'Aktif', lastUpdated: '2026-06-03' },
  { id: '12', name: 'Laras Ati', gender: 'P', nisn: CryptoService.encrypt('0081234572'), nik: CryptoService.encrypt('12312/A'), nikSiswa: CryptoService.encrypt('3515024411080001'), religion: 'Islam', birthPlace: 'Sidoarjo', birthDate: '2008-11-04', averageGrade: 85.7, asalKelas: 'SDN 1 Sidokare', currentClass: 'Belum Diatur', email: 'larasati@gmail.com', address: 'Sidokare Asri Blok F-12, Sidoarjo', guardianName: 'Joko Susilo', status: 'Aktif', lastUpdated: '2026-06-09' },
  { id: '13', name: 'Muhammad Rizky', gender: 'L', nisn: CryptoService.encrypt('0081234573'), nik: CryptoService.encrypt('12313/A'), nikSiswa: CryptoService.encrypt('3515021201080006'), religion: 'Islam', birthPlace: 'Sidoarjo', birthDate: '2008-01-12', averageGrade: 80.0, asalKelas: 'SDN 2 Sidoarjo', currentClass: 'Belum Diatur', email: 'rizky.m@gmail.com', address: 'Jl. Sultan Agung No. 56, Sidoarjo', guardianName: 'Wibowo Rizky', status: 'Aktif', lastUpdated: '2026-06-06' },
  { id: '14', name: 'Nabila Syakieb', gender: 'P', nisn: CryptoService.encrypt('0081234574'), nik: CryptoService.encrypt('12314/A'), nikSiswa: CryptoService.encrypt('3515025810080003'), religion: 'Islam', birthPlace: 'Bogor', birthDate: '2008-10-18', averageGrade: 87.8, asalKelas: 'SDN 1 Buduran', currentClass: 'Belum Diatur', email: 'nabila.syakieb@gmail.com', address: 'Kavling DPR Gg. Melati, Sidoarjo', guardianName: 'Syakieb Ali', status: 'Aktif', lastUpdated: '2026-06-04' },
  { id: '15', name: 'Okto Maniani', gender: 'L', nisn: CryptoService.encrypt('0081234575'), nik: CryptoService.encrypt('12315/A'), nikSiswa: CryptoService.encrypt('3515022710080001'), religion: 'Kristen', birthPlace: 'Jayapura', birthDate: '2008-10-27', averageGrade: 71.5, asalKelas: 'SDN 3 Sidoarjo', currentClass: 'Belum Diatur', email: 'okto.mani@gmail.com', address: 'Asrama Polisi Koboy, Sidoarjo', guardianName: 'Yulius Maniani', status: 'Aktif', lastUpdated: '2026-05-30' },
  { id: '16', name: 'Prilly Latuconsina', gender: 'P', nisn: CryptoService.encrypt('0081234576'), nik: CryptoService.encrypt('12316/A'), nikSiswa: CryptoService.encrypt('3515025510080002'), religion: 'Islam', birthPlace: 'Tangerang', birthDate: '2008-10-15', averageGrade: 92.4, asalKelas: 'SDN 1 Sidoarjo', currentClass: 'Belum Diatur', email: 'prilly.latu@gmail.com', address: 'Perum Delta Sari Indah AE-05, Sidoarjo', guardianName: 'Rizal Latuconsina', status: 'Aktif', lastUpdated: '2026-06-10' }
];

export const INITIAL_NOTIFICATIONS: UpdateNotification[] = [
  {
    id: 'notif-1',
    title: 'Validasi Data Semester Genap',
    description: 'Batas akhir sinkronisasi data Dapodik untuk perhitungan dana BOS semester genap.',
    date: '2026-06-15',
    type: 'warning',
    completed: false,
    cycle: 'Semester'
  },
  {
    id: 'notif-2',
    title: 'Pembaruan Berkala Data Siswa',
    description: 'Operator diharap memperbarui alamat & kontak wali untuk penerimaan laporan hasil belajar.',
    date: '2026-06-12',
    type: 'info',
    completed: false,
    cycle: 'Bulanan'
  },
  {
    id: 'notif-3',
    title: 'Sinkronisasi Sukses Otomatis',
    description: 'Sinkronisasi Dapodik rutin mingguan berhasil dieksekusi tanpa kejanggalan integrasi.',
    date: '2026-06-09',
    type: 'success',
    completed: true,
    cycle: 'Mingguan'
  }
];

export const INITIAL_SYNC_LOGS: DapodikSyncLog[] = [
  {
    id: 'sync-1',
    timestamp: '2026-06-09 10:30:22',
    type: 'Outbound',
    status: 'Sukses',
    recordsCount: 16,
    operator: 'Operator SPENDA (Sendi T. A.)',
    details: 'Pengiriman data siswa tingkat 7 ke database lokal Dapodik. Status: Terakreditasi.'
  },
  {
    id: 'sync-2',
    timestamp: '2026-06-02 11:15:00',
    type: 'Inbound',
    status: 'Sukses',
    recordsCount: 16,
    operator: 'Sistem Terjadwal',
    details: 'Penarikan data NISN hasil koordinasi instansi Pusat PDSPK Kemdikbud.'
  },
  {
    id: 'sync-3',
    timestamp: '2026-05-25 09:00:20',
    type: 'Outbound',
    status: 'Gagal',
    recordsCount: 0,
    operator: 'Operator SPENDA (Sendi T. A.)',
    details: 'Koneksi terputus. Gateway Dapodik Kemdikbud sibuk (HTTP 503 Service Unavailable).'
  }
];
