/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Student {
  id: string;
  nisn: string; // Stored encrypted
  nik: string;  // Stored encrypted (holds NIPD)
  nikSiswa: string; // Stored encrypted (holds NIK Siswa)
  religion: string; // religion of the student
  name: string;
  gender: 'L' | 'P'; // Laki-laki / Perempuan
  birthPlace: string;
  birthDate: string;
  averageGrade: number; // For heterogeneous class distribution
  asalKelas: string;    // e.g., 'SDN 1 Sidoarjo', '7.1', 'Belum Diatur'
  currentClass: string; // e.g., '7.1', '7.2', 'Belum Diatur'
  email: string;
  address: string;
  guardianName: string;
  status: 'Aktif' | 'Lulus' | 'Mutasi' | 'Non-Aktif';
  lastUpdated: string;
}

export interface DapodikSyncLog {
  id: string;
  timestamp: string;
  type: 'Inbound' | 'Outbound';
  status: 'Sukses' | 'Gagal' | 'Proses';
  recordsCount: number;
  operator: string;
  details: string;
}

export interface UpdateNotification {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'info' | 'warning' | 'success';
  completed: boolean;
  cycle: 'Harian' | 'Mingguan' | 'Bulanan' | 'Semester';
}

export interface ClassBalanceStats {
  className: string;
  studentsCount: number;
  maleCount: number;
  femaleCount: number;
  averageGrade: number;
  minGrade: number;
  maxGrade: number;
  students: Student[];
}

export interface EncryptionKeys {
  salt: string;
  pin: string; // Default '1234' for admin actions
  isConfigured: boolean;
}

export interface SchoolSettings {
  logoUrl?: string; // base64 or url
  useCustomKopImage?: boolean;
  kopImageUrl?: string;
  useCustomStampImage?: boolean;
  stampImageUrl?: string;
  schoolName: string;
  npsn: string;
  akreditasi: string;
  email: string;
  address: string;
  province: string;
  kabupaten: string;
  kecamatan: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  kurikulumName: string;
  nipKurikulum: string;
  tahunAjaran: string;
  noSuratPrefix: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarInitial: string;
}


