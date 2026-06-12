/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sliders, 
  Sparkles, 
  Check, 
  Users, 
  HelpCircle,
  Activity,
  Award,
  Plus,
  Minus,
  Shuffle,
  FileSpreadsheet,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Trash2,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, ClassBalanceStats, SchoolSettings } from '../types';
import { divideClassesHeterogeneously, CryptoService, DEFAULT_SCHOOL_SETTINGS } from '../utils/helpers';

interface ClassSplitterProps {
  students: Student[];
  onApplyClassDivision: (updatedStudents: Student[]) => void;
  schoolSettings?: SchoolSettings;
}

export default function ClassSplitter({
  students,
  onApplyClassDivision,
  schoolSettings = DEFAULT_SCHOOL_SETTINGS,
}: ClassSplitterProps) {
  // Step workflow status and Level Tabs
  const [step, setStep] = useState<'setup' | 'results'>('setup');
  const [activeLevel, setActiveLevel] = useState<'7' | '8' | '9'>('7');

  // Config States per level
  const [maxStudents7, setMaxStudents7] = useState(32);
  const [maxStudents8, setMaxStudents8] = useState(32);
  const [maxStudents9, setMaxStudents9] = useState(32);

  const [customClassCount7, setCustomClassCount7] = useState<number | null>(null);
  const [customClassCount8, setCustomClassCount8] = useState<number | null>(null);
  const [customClassCount9, setCustomClassCount9] = useState<number | null>(null);

  const [sourceMode7, setSourceMode7] = useState<'spmb' | 'all' | 'existing'>('spmb');

  // Separate distribution methods per level
  const [distMethod7, setDistMethod7] = useState<'heterogen' | 'acak'>('heterogen');
  const [distMethod8, setDistMethod8] = useState<'heterogen' | 'acak'>('heterogen');
  const [distMethod9, setDistMethod9] = useState<'heterogen' | 'acak'>('heterogen');

  // Unified Multi-level Split Results
  const [results, setResults] = useState<{
    '7'?: { stats: ClassBalanceStats[]; assignedStudents: Student[] };
    '8'?: { stats: ClassBalanceStats[]; assignedStudents: Student[] };
    '9'?: { stats: ClassBalanceStats[]; assignedStudents: Student[] };
  }>({});

  const [activePreviewClass, setActivePreviewClass] = useState<string>('');
  
  // Persistent Class requests/locks
  const [classRequests, setClassRequests] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem('SPENDA_CLASS_REQUESTS');
    return stored ? JSON.parse(stored) : {};
  });

  const updateClassRequests = (newReqs: Record<string, string>) => {
    setClassRequests(newReqs);
    localStorage.setItem('SPENDA_CLASS_REQUESTS', JSON.stringify(newReqs));
  };

  const [reqSearchTerm, setReqSearchTerm] = useState('');
  const [selectedStudentForReq, setSelectedStudentForReq] = useState<string>('');
  const [selectedClassForReq, setSelectedClassForReq] = useState<string>('');

  const [notificationMsg, setNotificationMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [printTarget, setPrintTarget] = useState<{
    type: 'class' | 'level' | 'all';
    level?: '7' | '8' | '9';
    className?: string;
  } | null>(null);

  // Stable tracking of each student's expected/target level for this promotion cycle.
  // This solves the prefix collision that happens when you promote students in-place to the next grade.
  const studentTargetLevels = useMemo(() => {
    const map: Record<string, '7' | '8' | '9'> = {};
    
    // Check if the database has already been fully updated/promoted
    const hasBelumDiatur = students.some(s => s.status === 'Aktif' && (!s.currentClass || s.currentClass === 'Belum Diatur'));
    const hasGrade9 = students.some(s => s.status === 'Aktif' && s.currentClass && s.currentClass.startsWith('9'));
    const isAlreadyPromoted = !hasBelumDiatur && hasGrade9;

    students.forEach(s => {
      if (s.status !== 'Aktif') return;
      
      if (isAlreadyPromoted) {
        if (s.currentClass && s.currentClass.startsWith('7')) map[s.id] = '7';
        else if (s.currentClass && s.currentClass.startsWith('8')) map[s.id] = '8';
        else if (s.currentClass && s.currentClass.startsWith('9')) map[s.id] = '9';
        else map[s.id] = '7';
      } else {
        const cls = s.currentClass;
        if (!cls || cls === 'Belum Diatur') {
          map[s.id] = '7';
        } else if (cls.startsWith('7')) {
          map[s.id] = '8';
        } else if (cls.startsWith('8')) {
          map[s.id] = '9';
        } else if (cls.startsWith('9')) {
          map[s.id] = '9';
        } else {
          map[s.id] = '7';
        }
      }
    });
    return map;
  }, [students]);

  // Determine a student's level
  const getStudentLevel = (student: Student): '7' | '8' | '9' | 'Unknown' => {
    return studentTargetLevels[student.id] || 'Unknown';
  };

  // Get active student lists depending on school state:
  // - Level 7 counts new admissions (Hasil SPMB / Belum Diatur) or existing Class 7
  // - Level 8 promo: promotes existing Class 7 to Class 8 rombel
  // - Level 9 promo: promotes existing Class 8 to Class 9 rombel
  const getEligibleStudentsForLevel = (lvl: '7' | '8' | '9'): Student[] => {
    return students.filter(s => {
      if (s.status !== 'Aktif') return false;
      const targetLvl = studentTargetLevels[s.id];
      
      if (lvl === '7') {
        if (sourceMode7 === 'spmb') {
          return targetLvl === '7' && (!s.currentClass || s.currentClass === 'Belum Diatur');
        } else if (sourceMode7 === 'existing') {
          return targetLvl === '7' && s.currentClass && s.currentClass.startsWith('7');
        } else {
          // 'all': SPMB (unassigned) and those already in class 7
          return targetLvl === '7';
        }
      }
      return targetLvl === lvl;
    });
  };

  // Get active student lists for all three columns
  const level7Candidates = getEligibleStudentsForLevel('7');
  const level8Candidates = getEligibleStudentsForLevel('8');
  const level9Candidates = getEligibleStudentsForLevel('9');

  // Compute recommended and custom class counts per level
  const computedClassCount7 = Math.ceil(level7Candidates.length / maxStudents7) || 1;
  const classCount7 = customClassCount7 ?? computedClassCount7;

  const computedClassCount8 = Math.ceil(level8Candidates.length / maxStudents8) || 1;
  const classCount8 = customClassCount8 ?? computedClassCount8;

  const computedClassCount9 = Math.ceil(level9Candidates.length / maxStudents9) || 1;
  const classCount9 = customClassCount9 ?? computedClassCount9;

  // Divide method
  const divideClasses = (eligible: Student[], classNames: string[], method: 'heterogen' | 'acak', level?: string) => {
    if (eligible.length === 0 || classNames.length === 0) {
      return { assignedStudents: [], stats: [] };
    }

    const K = classNames.length;
    const buckets: Student[][] = Array.from({ length: K }, () => []);

    // 1. Filter out students with valid matching class requests/locks
    const requestedStudents = eligible.filter(s => classRequests[s.id] && classNames.includes(classRequests[s.id]));
    const remainingStudents = eligible.filter(s => !classRequests[s.id] || !classNames.includes(classRequests[s.id]));

    // 2. Count preassigned boys and girls per class index, and populate initial buckets
    const preassignedBoys = Array(K).fill(0);
    const preassignedGirls = Array(K).fill(0);

    requestedStudents.forEach(student => {
      const requestedClass = classRequests[student.id];
      const classIdx = classNames.indexOf(requestedClass);
      if (classIdx !== -1) {
        buckets[classIdx].push({ ...student, currentClass: requestedClass });
        if (student.gender === 'L') {
          preassignedBoys[classIdx]++;
        } else {
          preassignedGirls[classIdx]++;
        }
      }
    });

    // 3. For the remaining students, split them based on the chosen method
    if (method === 'heterogen') {
      // Separate remaining boys and girls
      const remainingMales = remainingStudents.filter((s) => s.gender === 'L');
      const remainingFemales = remainingStudents.filter((s) => s.gender === 'P');

      // Calculate target quotas dynamically to balance the final counts perfectly
      const boysQuota = [...preassignedBoys];
      for (let i = 0; i < remainingMales.length; i++) {
        let bestClass = 0;
        let minBoys = Infinity;
        for (let c = 0; c < K; c++) {
          if (boysQuota[c] < minBoys) {
            minBoys = boysQuota[c];
            bestClass = c;
          }
        }
        boysQuota[bestClass]++;
      }
      const targetBoysQuota = classNames.map((_, c) => boysQuota[c] - preassignedBoys[c]);

      const girlsQuota = [...preassignedGirls];
      for (let i = 0; i < remainingFemales.length; i++) {
        let bestClass = 0;
        let minGirls = Infinity;
        for (let c = 0; c < K; c++) {
          if (girlsQuota[c] < minGirls) {
            minGirls = girlsQuota[c];
            bestClass = c;
          }
        }
        girlsQuota[bestClass]++;
      }
      const targetGirlsQuota = classNames.map((_, c) => girlsQuota[c] - preassignedGirls[c]);

      const boysInClassCount = Array(K).fill(0);
      const girlsInClassCount = Array(K).fill(0);

      const schoolBoysCountInClass = Array.from({ length: K }, () => ({} as Record<string, number>));
      const schoolGirlsCountInClass = Array.from({ length: K }, () => ({} as Record<string, number>));

      // Group and sort remaining boys/girls for school balance (specifically for Level 7)
      let orderedMales: Student[] = [];
      let orderedFemales: Student[] = [];

      if (level === '7') {
        const malesBySchool: Record<string, Student[]> = {};
        remainingMales.forEach(s => {
          const school = s.asalKelas || 'Belum Diatur';
          if (!malesBySchool[school]) malesBySchool[school] = [];
          malesBySchool[school].push(s);
        });

        const femalesBySchool: Record<string, Student[]> = {};
        remainingFemales.forEach(s => {
          const school = s.asalKelas || 'Belum Diatur';
          if (!femalesBySchool[school]) femalesBySchool[school] = [];
          femalesBySchool[school].push(s);
        });

        Object.keys(malesBySchool).forEach(sch => {
          malesBySchool[sch].sort((a, b) => b.averageGrade - a.averageGrade || a.name.localeCompare(b.name));
        });
        Object.keys(femalesBySchool).forEach(sch => {
          femalesBySchool[sch].sort((a, b) => b.averageGrade - a.averageGrade || a.name.localeCompare(b.name));
        });

        const maleSchools = Object.keys(malesBySchool).sort((a, b) => malesBySchool[b].length - malesBySchool[a].length);
        const femaleSchools = Object.keys(femalesBySchool).sort((a, b) => femalesBySchool[b].length - femalesBySchool[a].length);

        let hasMoreMales = true;
        let maleRound = 0;
        while (hasMoreMales) {
          hasMoreMales = false;
          for (const school of maleSchools) {
            if (malesBySchool[school].length > maleRound) {
              orderedMales.push(malesBySchool[school][maleRound]);
              hasMoreMales = true;
            }
          }
          maleRound++;
        }

        let hasMoreFemales = true;
        let femaleRound = 0;
        while (hasMoreFemales) {
          hasMoreFemales = false;
          for (const school of femaleSchools) {
            if (femalesBySchool[school].length > femaleRound) {
              orderedFemales.push(femalesBySchool[school][femaleRound]);
              hasMoreFemales = true;
            }
          }
          femaleRound++;
        }
      } else {
        // Levels 8 and 9 remaining students are sorted by average grade descending to execute serpentine balanced distribution
        orderedMales = [...remainingMales].sort((a, b) => b.averageGrade - a.averageGrade);
        orderedFemales = [...remainingFemales].sort((a, b) => b.averageGrade - a.averageGrade);
      }

      // Distribute remaining boys using remaining seat limits
      orderedMales.forEach(boy => {
        const sName = boy.asalKelas || 'Belum Diatur';
        
        let bestIdx = -1;
        let minCount = Infinity;
        let minTotalBoys = Infinity;

        for (let c = 0; c < K; c++) {
          if (boysInClassCount[c] < targetBoysQuota[c]) {
            const currentSchoolCount = schoolBoysCountInClass[c][sName] || 0;
            const currentTotalBoys = boysInClassCount[c];

            if (currentSchoolCount < minCount) {
              minCount = currentSchoolCount;
              minTotalBoys = currentTotalBoys;
              bestIdx = c;
            } else if (currentSchoolCount === minCount) {
              if (currentTotalBoys < minTotalBoys) {
                minTotalBoys = currentTotalBoys;
                bestIdx = c;
              }
            }
          }
        }

        // Fallback index if quota constraints didn't yield a match
        if (bestIdx === -1) {
          let minClassBoys = Infinity;
          bestIdx = 0;
          for (let c = 0; c < K; c++) {
            if (boysInClassCount[c] < minClassBoys) {
              minClassBoys = boysInClassCount[c];
              bestIdx = c;
            }
          }
        }

        buckets[bestIdx].push({ ...boy, currentClass: classNames[bestIdx] });
        boysInClassCount[bestIdx]++;
        schoolBoysCountInClass[bestIdx][sName] = (schoolBoysCountInClass[bestIdx][sName] || 0) + 1;
      });

      // Distribute remaining girls using remaining seat limits
      orderedFemales.forEach(girl => {
        const sName = girl.asalKelas || 'Belum Diatur';
        
        let bestIdx = -1;
        let minCount = Infinity;
        let minTotalGirls = Infinity;

        for (let c = 0; c < K; c++) {
          if (girlsInClassCount[c] < targetGirlsQuota[c]) {
            const currentSchoolCount = schoolGirlsCountInClass[c][sName] || 0;
            const currentTotalGirls = girlsInClassCount[c];

            if (currentSchoolCount < minCount) {
              minCount = currentSchoolCount;
              minTotalGirls = currentTotalGirls;
              bestIdx = c;
            } else if (currentSchoolCount === minCount) {
              if (currentTotalGirls < minTotalGirls) {
                minTotalGirls = currentTotalGirls;
                bestIdx = c;
              }
            }
          }
        }

        // Fallback index
        if (bestIdx === -1) {
          let minClassGirls = Infinity;
          bestIdx = 0;
          for (let c = 0; c < K; c++) {
            if (girlsInClassCount[c] < minClassGirls) {
              minClassGirls = girlsInClassCount[c];
              bestIdx = c;
            }
          }
        }

        buckets[bestIdx].push({ ...girl, currentClass: classNames[bestIdx] });
        girlsInClassCount[bestIdx]++;
        schoolGirlsCountInClass[bestIdx][sName] = (schoolGirlsCountInClass[bestIdx][sName] || 0) + 1;
      });

    } else {
      // Choose Acak (Random)
      const randomized = [...remainingStudents].sort(() => Math.random() - 0.5);

      // Determine the ideal count of remaining students to place in each class to keep sizes perfectly balanced
      const classQuota = [...preassignedBoys].map((boysVal, idx) => boysVal + preassignedGirls[idx]);
      for (let i = 0; i < randomized.length; i++) {
        let bestClass = 0;
        let minSize = Infinity;
        for (let c = 0; c < K; c++) {
          if (classQuota[c] < minSize) {
            minSize = classQuota[c];
            bestClass = c;
          }
        }
        classQuota[bestClass]++;
      }
      const targetRemainingQuota = classNames.map((_, c) => classQuota[c] - (preassignedBoys[c] + preassignedGirls[c]));

      const remainingInClassCount = Array(K).fill(0);

      randomized.forEach(student => {
        let bestIdx = -1;
        let minClassCount = Infinity;
        for (let c = 0; c < K; c++) {
          if (remainingInClassCount[c] < targetRemainingQuota[c]) {
            if (remainingInClassCount[c] < minClassCount) {
              minClassCount = remainingInClassCount[c];
              bestIdx = c;
            }
          }
        }

        // Fallback
        if (bestIdx === -1) {
          let minCount = Infinity;
          bestIdx = 0;
          for (let c = 0; c < K; c++) {
            const curSize = buckets[c].length;
            if (curSize < minCount) {
              minCount = curSize;
              bestIdx = c;
            }
          }
        }

        buckets[bestIdx].push({ ...student, currentClass: classNames[bestIdx] });
        remainingInClassCount[bestIdx]++;
      });
    }

    // Compile Stats for display
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

    return { assignedStudents: buckets.flat(), stats };
  };

  // Run all simulations simultaneously based on the individual configurations
  const handleRunAllSimulations = () => {
    const newResults: typeof results = {};

    // 1. Level 7 split
    if (level7Candidates.length > 0) {
      const classNames7: string[] = [];
      for (let i = 0; i < classCount7; i++) {
        classNames7.push(`7.${i + 1}`);
      }
      const { assignedStudents: assigned7, stats: stats7 } = divideClasses(level7Candidates, classNames7, distMethod7, '7');
      newResults['7'] = { stats: stats7, assignedStudents: assigned7 };
    }

    // 2. Level 8 split
    if (level8Candidates.length > 0) {
      const classNames8: string[] = [];
      for (let i = 0; i < classCount8; i++) {
        classNames8.push(`8.${i + 1}`);
      }
      const { assignedStudents: assigned8, stats: stats8 } = divideClasses(level8Candidates, classNames8, distMethod8, '8');
      newResults['8'] = { stats: stats8, assignedStudents: assigned8 };
    }

    // 3. Level 9 split
    if (level9Candidates.length > 0) {
      const classNames9: string[] = [];
      for (let i = 0; i < classCount9; i++) {
        classNames9.push(`9.${i + 1}`);
      }
      const { assignedStudents: assigned9, stats: stats9 } = divideClasses(level9Candidates, classNames9, distMethod9, '9');
      newResults['9'] = { stats: stats9, assignedStudents: assigned9 };
    }

    if (Object.keys(newResults).length === 0) {
      alert("Tidak ada siswa aktif yang memenuhi syarat untuk diproses pembagian rombelnya.");
      return;
    }

    setResults(newResults);

    // Default first view to active level if available, otherwise any level
    const availableLevels = Object.keys(newResults) as ('7' | '8' | '9')[];
    if (newResults[activeLevel]) {
      setActivePreviewClass(newResults[activeLevel]?.stats[0]?.className || '');
    } else if (availableLevels.length > 0) {
      setActiveLevel(availableLevels[0]);
      setActivePreviewClass(newResults[availableLevels[0]]?.stats[0]?.className || '');
    }

    setStep('results');
    setNotificationMsg("Simulasi Berhasil! Seluruh rombel kelas untuk setiap tingkatan dipetakan sesuai konfigurasi Anda.");
    setTimeout(() => setNotificationMsg(''), 5500);
  };

  // Helper to format date in Indonesian style
  const getIndonesianDate = () => {
    const listMonths = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const today = new Date();
    return `${today.getDate()} ${listMonths[today.getMonth()]} ${today.getFullYear()}`;
  };

  const renderKopSurat = () => {
    if (schoolSettings.useCustomKopImage && schoolSettings.kopImageUrl) {
      return (
        <div className="flex items-center justify-center border-b-[3px] border-double border-slate-900 pb-2 mb-4 select-none">
          <img 
            src={schoolSettings.kopImageUrl} 
            alt="Kop Surat Resmi" 
            className="w-full max-h-24 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between border-b-[3px] border-double border-slate-900 pb-4 mb-4 select-none">
        {/* Education Crest on Left */}
        <div className="w-[15%] shrink-0 flex items-center justify-center">
          {schoolSettings.logoUrl ? (
            <img 
              src={schoolSettings.logoUrl} 
              alt="Logo Sekolah" 
              className="w-16 h-16 object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <svg className="w-16 h-16 text-emerald-800" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <path d="M50 12 L82 22 V55 C82 75 50 88 50 88 C50 88 18 75 18 55 V22 Z" fill="#15803d" fillOpacity="0.08" stroke="#15803d" strokeWidth="2.5"/>
              <path d="M32 60 Q50 55 50 48 Q50 55 68 60" stroke="#15803d" strokeWidth="2" strokeLinecap="round"/>
              <path d="M32 50 Q50 45 50 38 Q50 45 68 50" stroke="#15803d" strokeWidth="2" strokeLinecap="round"/>
              <line x1="50" y1="35" x2="50" y2="65" stroke="#15803d" strokeWidth="3" strokeLinecap="round"/>
              <polygon points="50,18 53,24 60,24 55,28 57,34 50,30 43,34 45,28 40,24 47,24" fill="#eab308"/>
            </svg>
          )}
        </div>

        {/* School details in Middle */}
        <div className="w-[85%] text-center font-serif leading-tight">
          <h4 className="text-[13px] tracking-wide font-semibold uppercase text-slate-800">
            PEMERINTAH KABUPATEN {schoolSettings.kabupaten.toUpperCase()}
          </h4>
          <h3 className="text-[15px] font-bold tracking-wide uppercase text-slate-900">
            DINAS PENDIDIKAN DAN KEBUDAYAAN
          </h3>
          <h2 className="text-[20px] font-black tracking-normal uppercase text-slate-955 mt-0.5">
            {schoolSettings.schoolName}
          </h2>
          <p className="text-[10px] italic text-slate-500 font-sans mt-1">
            NPSN: {schoolSettings.npsn} | Akreditasi: {schoolSettings.akreditasi} | Email: {schoolSettings.email}
          </p>
          <p className="text-[10px] font-sans text-slate-600 mt-0.5">
            {schoolSettings.address}
          </p>
        </div>
      </div>
    );
  };

  const renderSignatureBlock = (classCaption?: string) => (
    <div className="mt-8 flex justify-between items-start font-serif page-break-inside-avoid select-none text-slate-850">
      {/* Mengetahui section on left (optional) */}
      <div className="w-1/2 space-y-1">
        <p className="text-[11px]">Mengetahui,</p>
        <p className="text-[11.5px] font-bold">Kepala Urusan Kurikulum</p>
        <div className="h-16"></div>
        <p className="text-[11.5px] font-extrabold underline">{schoolSettings.kurikulumName}</p>
        <p className="text-[10px] text-slate-500">NIP. {schoolSettings.nipKurikulum}</p>
      </div>

      {/* Kabupaten and Signature on right */}
      <div className="w-1/2 text-right relative space-y-1 pr-4">
        <p className="text-[11px]">{schoolSettings.kabupaten}, {getIndonesianDate()}</p>
        <p className="text-[11.5px] font-bold font-serif">Kepala Sekolah {schoolSettings.schoolName.replace('SMP NEGERI ', 'SMPN ')},</p>
        
        {/* Signature + Overlapping Stamp Container */}
        <div className="h-16 relative flex items-center justify-end pr-8">
          {/* Handwritten vector signature */}
          <svg className="w-28 h-12 text-blue-900 absolute z-10" viewBox="0 0 120 60" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 15,35 Q 30,10 40,25 T 60,30 T 75,20 L 95,45 Q 100,50 105,45 T 100,20 Q 80,5 65,35" />
            <path d="M 30,30 L 110,32" strokeWidth="1.5" />
          </svg>

          {/* Stamp / Cap Stempel overlap */}
          <div className="absolute -left-2 top-[-10px] z-20 pointer-events-none transform rotate-[-6deg] mix-blend-multiply opacity-80 select-none">
            {schoolSettings.useCustomStampImage && schoolSettings.stampImageUrl ? (
              <img 
                src={schoolSettings.stampImageUrl} 
                alt="Cap Basah Kustom" 
                className="w-24 h-24 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <svg className="w-24 h-24" viewBox="0 0 120 120">
                <defs>
                  <path id="stampTextPath" d="M 60, 60 m -45, 0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0" />
                </defs>
                <circle cx="60" cy="60" r="54" fill="none" stroke="#251b9e" strokeWidth="2" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#251b9e" strokeWidth="0.75" />
                <circle cx="60" cy="60" r="32" fill="none" stroke="#251b9e" strokeWidth="1.5" />
                
                <text fill="#251b9e" fontSize="6.5" font-weight="bold" letterSpacing="0.1">
                  <textPath href="#stampTextPath" startOffset="0%">
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
        </div>

        <p className="text-[11.5px] font-extrabold underline">{schoolSettings.kepalaSekolah}</p>
        <p className="text-[10px] text-slate-500 font-serif">NIP. {schoolSettings.nipKepalaSekolah}</p>
      </div>
    </div>
  );

  // Convert AOA to beautifully structured Excel sheet per class/level
  const handleExportExcel = (lvl: '7' | '8' | '9') => {
    const levelResult = results[lvl];
    if (!levelResult || levelResult.assignedStudents.length === 0) {
      alert("Tidak ada data simulasi yang tersedia untuk diekspor pada tingkat ini.");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: RINGKASAN ROMBEL
      const summaryRows = [
        ["PEMERINTAH KABUPATEN MUARA ENIM"],
        ["DINAS PENDIDIKAN DAN KEBUDAYAAN"],
        ["SMP NEGERI 2 MUARA ENIM"],
        ["Alamat: Jl. Jenderal Sudirman No. 124, Muara Enim, Sumatera Selatan 31311"],
        ["NPSN: 10603456 | Akreditasi: A | Email: info@smpn2muaraenim.sch.id"],
        ["=========================================================================================="],
        [],
        ["LAPORAN RINGKASAN SIMULASI PEMBAGIAN ROMBEL KELAS " + lvl],
        ["TAHUN AJARAN 2026/2027"],
        [],
        ["No", "Nama Rombel", "Jumlah Siswa", "Siswa Laki-laki", "Siswa Perempuan", "Pola Distribusi"],
      ];

      levelResult.stats.forEach((stat, idx) => {
        summaryRows.push([
          (idx + 1).toString(),
          "Kelas " + stat.className,
          stat.studentsCount.toString(),
          stat.maleCount.toString(),
          stat.femaleCount.toString(),
          "Heterogen Seimbang"
        ]);
      });

      // Add signatures to summary sheet
      summaryRows.push([]);
      summaryRows.push([]);
      summaryRows.push(["", "", "", "", "Muara Enim, " + getIndonesianDate()]);
      summaryRows.push(["Mengetahui,", "", "", "", "Kepala Urusan Kurikulum SMPN 2,"]);
      summaryRows.push(["Kepala SMP Negeri 2 Muara Enim,", "", "", "", ""]);
      summaryRows.push([]);
      summaryRows.push([]);
      summaryRows.push([]);
      summaryRows.push(["Dr. H. Slamet Rahardjo, M.Pd.", "", "", "", "..........................................."]);
      summaryRows.push(["NIP. 19740815 200112 1 003", "", "", "", "NIP. .................................."]);

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Rombel");

      // Sheet 2 onwards: Detail Per Kelas
      levelResult.stats.forEach((stat) => {
        const classRows = [
          ["PEMERINTAH KABUPATEN MUARA ENIM"],
          ["DINAS PENDIDIKAN DAN KEBUDAYAAN"],
          ["SMP NEGERI 2 MUARA ENIM"],
          ["Alamat: Jl. Jenderal Sudirman No. 124, Muara Enim, Sumatera Selatan 31311"],
          ["NPSN: 10603456 | Akreditasi: A | Email: info@smpn2muaraenim.sch.id"],
          ["=========================================================================================="],
          [],
          ["DAFTAR PESERTA DIDIK BARU / ROMBEL KELAS " + stat.className],
          ["TAHUN AJARAN 2026/2027"],
          [],
          ["Rektorat/Rombel:", "Kelas " + stat.className, "Jumlah Siswa:", stat.studentsCount + " Orang", "Laki-laki:", stat.maleCount + " Siswa", "Perempuan:", stat.femaleCount + " Siswa"],
          ["Pola Pembagian:", "Heterogen Seimbang", "Status Penempatan:", "Rombel Terbit Resmi"],
          [],
          ["No", "Nama Lengkap", "L/P", "NISN", "NIPD (NIK)", "Agama", "Tempat Lahir", "Tanggal Lahir", "Asal Kelas / Sekolah Sebelum", "Kelas Tujuan"]
        ];

        stat.students.forEach((s, idx) => {
          const orig = students.find(x => x.id === s.id);
          const origClass = orig?.currentClass;
          classRows.push([
            (idx + 1).toString(),
            s.name,
            s.gender,
            s.nisn ? CryptoService.decrypt(s.nisn) : "-",
            s.nik ? CryptoService.decrypt(s.nik) : "-",
            s.religion || "-",
            s.birthPlace || "-",
            s.birthDate || "-",
            lvl === '7' ? (s.asalKelas || "-") : (origClass && origClass !== "Belum Diatur" ? "Kelas " + origClass : "-"),
            "Kelas " + stat.className
          ]);
        });

        classRows.push([]);
        classRows.push([]);
        classRows.push(["", "", "", "", "", "", "Muara Enim, " + getIndonesianDate()]);
        classRows.push(["Mengetahui,", "", "", "", "", "", "Wali Kelas " + stat.className]);
        classRows.push(["Kepala SMP Negeri 2 Muara Enim,", "", "", "", "", ""]);
        classRows.push([]);
        classRows.push([]);
        classRows.push([]);
        classRows.push(["Dr. H. Slamet Rahardjo, M.Pd.", "", "", "", "", "", "..........................................."]);
        classRows.push(["NIP. 19740815 200112 1 003", "", "", "", "", "", "NIP. .................................."]);

        const wsClass = XLSX.utils.aoa_to_sheet(classRows);
        XLSX.utils.book_append_sheet(wb, wsClass, "Kelas " + stat.className);
      });

      XLSX.writeFile(wb, `Simulasi_Excel_Rombel_Kelas_${lvl}_SMPN_2.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Gagal mengunduh berkas Excel.");
    }
  };

  // Convert AOA to beautifully structured Excel sheet for ALL levels
  const handleExportAllExcel = () => {
    let hasData = false;
    (['7', '8', '9'] as const).forEach((lvl) => {
      if (results[lvl] && results[lvl]!.assignedStudents.length > 0) {
        hasData = true;
      }
    });

    if (!hasData) {
      alert("Belum ada data simulasi yang lengkap. Silakan jalankan simulasi terlebih dahulu.");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: RINGKASAN KOLEKTIF SEKOLAH
      const summaryRows = [
        ["PEMERINTAH KABUPATEN MUARA ENIM"],
        ["DINAS PENDIDIKAN DAN KEBUDAYAAN"],
        ["SMP NEGERI 2 MUARA ENIM"],
        ["Alamat: Jl. Jenderal Sudirman No. 124, Muara Enim, Sumatera Selatan 31311"],
        ["NPSN: 10603456 | Akreditasi: A | Email: info@smpn2muaraenim.sch.id"],
        ["=========================================================================================="],
        [],
        ["LAPORAN EKSPOR KOLEKTIF SIMULASI PEMBAGIAN ROMBEL SEKOLAH (KELAS 7, 8, & 9)"],
        ["TAHUN AJARAN 2026/2027"],
        [],
        ["Tingkat", "No Kelas", "Nama Rombel", "Siswa Laki-laki", "Siswa Perempuan", "Total Siswa", "Pola Distribusi"],
      ];

      (['7', '8', '9'] as const).forEach((lvl) => {
        const levelResult = results[lvl];
        if (!levelResult) return;

        levelResult.stats.forEach((stat, idx) => {
          summaryRows.push([
            "Tingkat " + lvl,
            (idx + 1).toString(),
            "Rombel " + stat.className,
            stat.maleCount.toString(),
            stat.femaleCount.toString(),
            stat.studentsCount.toString(),
            "Heterogen Seimbang"
          ]);
        });
      });

      summaryRows.push([]);
      summaryRows.push([]);
      summaryRows.push(["", "", "", "", "Muara Enim, " + getIndonesianDate()]);
      summaryRows.push(["Mengetahui,", "", "", "", "Kepala Urusan Kurikulum SMPN 2,"]);
      summaryRows.push(["Kepala SMP Negeri 2 Muara Enim,", "", "", "", ""]);
      summaryRows.push([]);
      summaryRows.push([]);
      summaryRows.push([]);
      summaryRows.push(["Dr. H. Slamet Rahardjo, M.Pd.", "", "", "", "..........................................."]);
      summaryRows.push(["NIP. 19740815 200112 1 003", "", "", "", "NIP. .................................."]);

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Kolektif");

      // Sheets for each active grade level
      (['7', '8', '9'] as const).forEach((lvl) => {
        const levelResult = results[lvl];
        if (!levelResult) return;

        const levelDataRows = [
          ["PEMERINTAH KABUPATEN MUARA ENIM"],
          ["DINAS PENDIDIKAN DAN KEBUDAYAAN"],
          ["SMP NEGERI 2 MUARA ENIM"],
          ["Alamat: Jl. Jenderal Sudirman No. 124, Muara Enim, Sumatera Selatan 31311"],
          ["NPSN: 10603456 | Akreditasi: A | Email: info@smpn2muaraenim.sch.id"],
          ["=========================================================================================="],
          [],
          ["DAFTAR RINCIAN PEMBAGIAN ROMBEL SE-TINGKAT KELAS " + lvl],
          ["TAHUN AJARAN 2026/2027"],
          [],
          ["No", "Nama Lengkap", "Gender", "NISN", "NIPD (NIK)", "Agama", "Tempat Lahir", "Tanggal Lahir", "Asal Kelas Sebelum", "Kelas Tujuan"]
        ];

        let idxSiswa = 1;
        levelResult.stats.forEach((classStat) => {
          classStat.students.forEach((student) => {
            const orig = students.find(x => x.id === student.id);
            const origClass = orig?.currentClass;
            levelDataRows.push([
              idxSiswa.toString(),
              student.name,
              student.gender,
              student.nisn ? CryptoService.decrypt(student.nisn) : "-",
              student.nik ? CryptoService.decrypt(student.nik) : "-",
              student.religion || "-",
              student.birthPlace || "-",
              student.birthDate || "-",
              lvl === '7' ? (student.asalKelas || "-") : (origClass && origClass !== "Belum Diatur" ? "Kelas " + origClass : "-"),
              "Kelas " + classStat.className
            ]);
            idxSiswa++;
          });
        });

        levelDataRows.push([]);
        levelDataRows.push([]);
        levelDataRows.push(["", "", "", "", "", "Muara Enim, " + getIndonesianDate()]);
        levelDataRows.push(["Mengetahui,", "", "", "", "", "Kepala SMP Negeri 2 Muara Enim"]);
        levelDataRows.push([]);
        levelDataRows.push([]);
        levelDataRows.push(["Dr. H. Slamet Rahardjo, M.Pd."]);
        levelDataRows.push(["NIP. 19740815 200112 1 003"]);

        const wsLevel = XLSX.utils.aoa_to_sheet(levelDataRows);
        XLSX.utils.book_append_sheet(wb, wsLevel, "Tingkat Kelas " + lvl);
      });

      XLSX.writeFile(wb, "Simulasi_Rombel_Sekolah_Lengkap_SMPN_2.xlsx");
    } catch (err) {
      console.error(err);
      alert("Gagal mengekspor berkas Excel Kolektif.");
    }
  };

  // PDF print trigger helper for a single class
  const handlePrintPDFClass = (className: string, lvl: '7' | '8' | '9') => {
    setPrintTarget({ type: 'class', level: lvl, className });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // PDF print trigger helper for a whole level
  const handlePrintPDFLevel = (lvl: '7' | '8' | '9') => {
    setPrintTarget({ type: 'level', level: lvl });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // PDF print trigger helper for ALL levels combined
  const handlePrintPDFAll = () => {
    setPrintTarget({ type: 'all' });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Export results for a specific level to CSV
  const handleExportCSV = (lvl: '7' | '8' | '9') => {
    const levelResult = results[lvl];
    if (!levelResult || levelResult.assignedStudents.length === 0) {
      alert("Tidak ada data simulasi yang tersedia untuk diekspor pada tingkat ini.");
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "No,Nama Lengkap,Gender,NISN,NIPD (NIPD/NIK),Agama,Tempat Lahir,Tanggal Lahir,Asal Sekolah / Kelas Sebelum,Kelas Tujuan\n";

    let rowIdx = 1;
    levelResult.stats.forEach((classStat) => {
      classStat.students.forEach((student) => {
        const orig = students.find(x => x.id === student.id);
        const origClass = orig?.currentClass;
        const cleanName = student.name.replace(/"/g, '""');
        const cleanReligion = student.religion.replace(/"/g, '""');
        const cleanBirthPlace = student.birthPlace.replace(/"/g, '""');
        const rawAsal = lvl === '7' ? (student.asalKelas || "-") : (origClass && origClass !== "Belum Diatur" ? "Kelas " + origClass : "-");
        const cleanAsal = rawAsal.replace(/"/g, '""');
        const plainNisn = student.nisn ? CryptoService.decrypt(student.nisn) : "-";
        const plainNik = student.nik ? CryptoService.decrypt(student.nik) : "-";

        csvContent += `${rowIdx},"${cleanName}",${student.gender},'${plainNisn},'${plainNik},"${cleanReligion}","${cleanBirthPlace}",${student.birthDate},"${cleanAsal}","Kelas ${classStat.className}"\n`;
        rowIdx++;
      });
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Simulasi_Rombel_Kelas_${lvl}_SMPN_2.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export all processed simulated rosters in a single CSV
  const handleExportAllCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Tingkat,No,Nama Lengkap,Gender,NISN,NIPD (NIPD/NIK),Agama,Tempat Lahir,Tanggal Lahir,Asal Sekolah / Kelas Sebelum,Kelas Tujuan\n";

    let totalRows = 0;
    (['7', '8', '9'] as const).forEach((lvl) => {
      const levelResult = results[lvl];
      if (!levelResult) return;

      let rowIdx = 1;
      levelResult.stats.forEach((classStat) => {
        classStat.students.forEach((student) => {
          const orig = students.find(x => x.id === student.id);
          const origClass = orig?.currentClass;
          const cleanName = student.name.replace(/"/g, '""');
          const cleanReligion = student.religion.replace(/"/g, '""');
          const cleanBirthPlace = student.birthPlace.replace(/"/g, '""');
          const rawAsal = lvl === '7' ? (student.asalKelas || "-") : (origClass && origClass !== "Belum Diatur" ? "Kelas " + origClass : "-");
          const cleanAsal = rawAsal.replace(/"/g, '""');
          const plainNisn = student.nisn ? CryptoService.decrypt(student.nisn) : "-";
          const plainNik = student.nik ? CryptoService.decrypt(student.nik) : "-";
          
          csvContent += `Tingkat ${lvl},${rowIdx},"${cleanName}",${student.gender},'${plainNisn},'${plainNik},"${cleanReligion}","${cleanBirthPlace}",${student.birthDate},"${cleanAsal}","Kelas ${classStat.className}"\n`;
          rowIdx++;
          totalRows++;
        });
      });
    });

    if (totalRows === 0) {
      alert("Belum ada data simulasi yang lengkap. Silakan jalankan simulasi terlebih dahulu.");
      return;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Simulasi_Lengkap_Seluruh_Rombel_SMPN_2.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Terapkan hasil simulasi ke Data Induk
  const handleApplyToMaster = () => {
    const allAssignedStudents: Student[] = [];
    (['7', '8', '9'] as const).forEach(lvl => {
      if (results[lvl]) {
        allAssignedStudents.push(...results[lvl]!.assignedStudents);
      }
    });

    if (allAssignedStudents.length === 0) {
      alert("Tidak ada hasil simulasi yang bisa diterapkan.");
      return;
    }

    const confirmMsg = `Apakah Anda yakin ingin menerapkan draf rombel hasil simulasi ini ke dalam Data Induk Siswa?\n\nTindakan ini akan mengupdate Rombel Kelas untuk ${allAssignedStudents.length} siswa secara permanen di database sekolah kami.`;
    if (window.confirm(confirmMsg)) {
      // Map students over to master list
      const updatedStudents = students.map(s => {
        const assigned = allAssignedStudents.find(a => a.id === s.id);
        if (assigned) {
          return {
            ...s,
            currentClass: assigned.currentClass,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
        }
        return s;
      });

      onApplyClassDivision(updatedStudents);
      setNotificationMsg(`Berhasil! Hasil penempatan rombel untuk ${allAssignedStudents.length} siswa telah sukses diterapkan ke Data Induk Sekolah.`);
      setTimeout(() => setNotificationMsg(''), 6000);
    }
  };

  // Render notifikasi profesional untuk siswa yang belum mendapatkan rombel kelas di Data Induk
  const renderUnassignedNotifications = () => {
    const unplaced7 = students.filter(s => s.status === 'Aktif' && studentTargetLevels[s.id] === '7' && (!s.currentClass || s.currentClass === 'Belum Diatur' || !s.currentClass.startsWith('7')));
    const unplaced8 = students.filter(s => s.status === 'Aktif' && studentTargetLevels[s.id] === '8' && (!s.currentClass || !s.currentClass.startsWith('8')));
    const unplaced9 = students.filter(s => s.status === 'Aktif' && studentTargetLevels[s.id] === '9' && (!s.currentClass || !s.currentClass.startsWith('9')));
    
    const count7 = unplaced7.length;
    const count8 = unplaced8.length;
    const count9 = unplaced9.length;
    const totalCount = count7 + count8 + count9;

    const totalSiswaAktif = students.filter(s => s.status === 'Aktif').length;
    const totalK7 = students.filter(s => s.status === 'Aktif' && studentTargetLevels[s.id] === '7').length;
    const totalK8 = students.filter(s => s.status === 'Aktif' && studentTargetLevels[s.id] === '8').length;
    const totalK9 = students.filter(s => s.status === 'Aktif' && studentTargetLevels[s.id] === '9').length;

    return (
      <div className="space-y-4 animate-fade-in text-xs">
        {/* Ringkasan Total Siswa per Tingkat (Unified & Cleaned Cards Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          
          {/* Card 1: Total Siswa Aktif */}
          <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-3xs flex items-center gap-3.5 relative overflow-hidden transition-all hover:shadow-2xs">
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-green-500"></div>
            <div className="p-2.5 bg-green-50 text-green-700 rounded-xl shrink-0">
              <Users size={18} className="stroke-[2.5]" />
            </div>
            <div className="leading-tight">
              <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Total Siswa Aktif</span>
              <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block leading-none">
                {totalSiswaAktif} <span className="text-[9px] font-sans font-medium text-slate-400">Siswa</span>
              </span>
              <span className="text-[8.5px] text-emerald-600 block mt-1 font-sans flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0"></span>
                Database Utama Terhubung
              </span>
            </div>
          </div>

          {/* Card 2: Tingkat Kelas 7 */}
          <div className={`bg-white border ${count7 > 0 ? 'border-amber-250 shadow-amber-50/5' : 'border-slate-150'} rounded-xl p-4 shadow-3xs flex items-center gap-3.5 relative overflow-hidden transition-all hover:shadow-2xs`}>
            <div className={`absolute top-0 bottom-0 left-0 w-1 ${count7 > 0 ? 'bg-amber-500' : 'bg-green-500'}`}></div>
            <div className={`w-9 h-9 ${count7 > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-800'} rounded-xl shrink-0 flex items-center justify-center font-black text-xs font-mono`}>
              K7
            </div>
            <div className="leading-tight flex-1">
              <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Tingkat Kelas 7</span>
              <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block leading-none">
                {totalK7} <span className="text-[9px] font-sans font-medium text-slate-400">Siswa</span>
              </span>
              <div className="mt-1">
                {count7 > 0 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-100">
                    ⚠️ {count7} Belum Diatur
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-100">
                    ✓ Teratur Rombel
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Tingkat Kelas 8 */}
          <div className={`bg-white border ${count8 > 0 ? 'border-amber-250 shadow-amber-50/5' : 'border-slate-150'} rounded-xl p-4 shadow-3xs flex items-center gap-3.5 relative overflow-hidden transition-all hover:shadow-2xs`}>
            <div className={`absolute top-0 bottom-0 left-0 w-1 ${count8 > 0 ? 'bg-amber-500' : 'bg-green-500'}`}></div>
            <div className={`w-9 h-9 ${count8 > 0 ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-800'} rounded-xl shrink-0 flex items-center justify-center font-black text-xs font-mono`}>
              K8
            </div>
            <div className="leading-tight flex-1">
              <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Tingkat Kelas 8</span>
              <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block leading-none">
                {totalK8} <span className="text-[9px] font-sans font-medium text-slate-400">Siswa</span>
              </span>
              <div className="mt-1">
                {count8 > 0 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-100">
                    ⚠️ {count8} Belum Rombel
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-100">
                    ✓ Teratur Rombel
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Tingkat Kelas 9 */}
          <div className={`bg-white border ${count9 > 0 ? 'border-amber-250 shadow-amber-50/5' : 'border-slate-150'} rounded-xl p-4 shadow-3xs flex items-center gap-3.5 relative overflow-hidden transition-all hover:shadow-2xs`}>
            <div className={`absolute top-0 bottom-0 left-0 w-1 ${count9 > 0 ? 'bg-amber-500' : 'bg-green-500'}`}></div>
            <div className={`w-9 h-9 ${count9 > 0 ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-800'} rounded-xl shrink-0 flex items-center justify-center font-black text-xs font-mono`}>
              K9
            </div>
            <div className="leading-tight flex-1">
              <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Tingkat Kelas 9</span>
              <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block leading-none">
                {totalK9} <span className="text-[9px] font-sans font-medium text-slate-400">Siswa</span>
              </span>
              <div className="mt-1">
                {count9 > 0 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-100">
                    ⚠️ {count9} Belum Rombel
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-100">
                    ✓ Teratur Rombel
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Warning Indicator Strip (Only shows when there are unassigned students) */}
        {totalCount > 0 ? (
          <div className="bg-amber-55/40 border border-amber-200/80 p-3 rounded-xl flex items-start gap-2.5 text-amber-950 shadow-3xs">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px] text-slate-700 flex-1">
              <span className="font-bold text-amber-950">Sistem Deteksi Data Induk:</span> Ditemukan total <strong className="text-amber-950 font-bold font-mono bg-amber-100/80 px-1 py-0.2 rounded">{totalCount} siswa</strong> aktif yang belum mendapatkan alokasi rombel kelas resmi untuk tahun ajaran baru.
              <span className="ml-1 text-slate-550 block sm:inline mt-1 sm:mt-0 font-medium">
                💡 Silakan konfigurasikan rombel di bawah dan klik tombol <strong className="text-slate-800 font-bold">"Jalankan Simulasi"</strong>, lalu terapkan draf ke Data Induk secara aman.
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-55/35 border border-emerald-200/70 p-3 rounded-xl flex items-center gap-2.5 text-emerald-950 shadow-3xs">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <div className="leading-snug text-[11px] text-slate-700">
              <span className="font-bold text-emerald-950">Status Data Induk Sinkron:</span> Seluruh siswa aktif SMPN 2 telah sukses dialokasikan ke dalam rombel kelas masing-masing. Tidak ada penempatan gantung terdeteksi.
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in text-xs print:hidden">
      {/* 2-Step Progress Header */}
      <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-50 text-green-600 rounded-xl shrink-0">
            <Sparkles size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 font-sans tracking-tight">Sistem Simulasi Rombel Sekolah Aman</h2>
            <p className="text-[10.5px] text-slate-500 leading-normal">
              Bagi rombel secara adil heterogen serpentine maupun acak, simulasikan, dan ekspor langsung hasil pembagian tanpa merusak data induk siswa.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150 select-none shrink-0">
          <button
            onClick={() => setStep('setup')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] font-sans transition-all cursor-pointer ${step === 'setup' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'}`}
          >
            1. Atur Parameter
          </button>
          <span className="text-slate-300 font-mono text-[9px] px-1">➔</span>
          <button
            onClick={() => {
              if (Object.keys(results).length > 0) setStep('results');
            }}
            disabled={Object.keys(results).length === 0}
            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] font-sans transition-all ${step === 'results' ? 'bg-green-600 text-white shadow-sm cursor-pointer' : 'text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed'}`}
          >
            2. Lihat Simulasi & Ekspor
          </button>
        </div>
      </div>

      {notificationMsg && (
        <div className="bg-green-600 text-white border border-green-700 rounded-lg p-3 text-[11px] font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <Check size={14} className="shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {renderUnassignedNotifications()}

      {/* STEP 1: CONFIGURATION WORKSPACE */}
      {step === 'setup' && (
        <div className="space-y-6">
          {/* Important safety warning card */}
          <div className="bg-amber-50/50 border border-amber-200/70 p-3.5 rounded-xl flex gap-3 text-amber-900">
            <Sliders className="text-amber-600 h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-normal">
              <span className="block font-bold text-xs text-amber-950">Informasi Keamanan Basis Data (Data Induk Tetap Aman)</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Fitur pembagian kelas ini dioperasikan sepenuhnya dalam model <strong>Simulasi & Ekspor Mandiri</strong>. Algoritma akan menghitung pembagian secara adil berdasarkan nilai rapor siswa baru dan promosi tanpa menulis perubahan kelas ke data induk siswa di sistem utama. Hasil murni berupa draft rombel yang siap Anda <strong className="text-green-700">Unduh ke Excel/CSV</strong> untuk ditinjau lebih lanjut.
              </p>
            </div>
          </div>

          {/* Setup Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* CARD 1: KELAS 7 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4 relative overflow-hidden flex flex-col justify-between">
              <div>
                {/* Accent Top Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-green-500"></div>
                
                <div className="flex justify-between items-start pt-1">
                  <div>
                    <h3 className="text-xs font-black text-green-700 tracking-wider uppercase font-mono bg-green-50 px-2 py-0.5 rounded-full inline-block">
                      Tingkat Kelas 7
                    </h3>
                    <p className="text-slate-800 font-bold text-sm mt-1">Siswa Baru / Hasil SPMB</p>
                  </div>
                  <span className="text-[11px] font-black text-green-700 bg-green-200/45 px-2.5 py-1 rounded-full font-mono">
                    {level7Candidates.length} Murid
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Konfigurasikan pembagian rombel murid baru Kelas 7 lulusan SD di bawah ini.
                </p>

                {/* Filter Source Scope Level 7 */}
                <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700">Siswa Sumber Pembagian (Kelas 7)</label>
                  
                  <label className="flex items-start gap-1.5 p-2 rounded-lg border border-slate-150 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-[10.5px]">
                    <input 
                      type="radio"
                      name="sourceMode7"
                      value="spmb"
                      checked={sourceMode7 === 'spmb'}
                      onChange={() => setSourceMode7('spmb')}
                      className="accent-green-600 mt-0.5 scale-90"
                    />
                    <div>
                      <strong className="block text-slate-800">Hanya Siswa Baru / Hasil SPMB</strong>
                      <span className="text-[9.5px] text-slate-400 block mt-0.5">Siswa baru dengan status kelas "Belum Diatur" ({students.filter(s => s.status === 'Aktif' && (s.currentClass === 'Belum Diatur' || !s.currentClass)).length} siswa).</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-1.5 p-2 rounded-lg border border-slate-150 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-[10.5px]">
                    <input 
                      type="radio"
                      name="sourceMode7"
                      value="all"
                      checked={sourceMode7 === 'all'}
                      onChange={() => setSourceMode7('all')}
                      className="accent-green-600 mt-0.5 scale-90"
                    />
                    <div>
                      <strong className="block text-slate-800">Siswa Baru & Kelas 7 Aktif</strong>
                      <span className="text-[9.5px] text-slate-400 block mt-0.5">Hasil SPMB digabung dengan siswa aktif terdaftar di Kelas 7 ({students.filter(s => s.status === 'Aktif' && (s.currentClass === 'Belum Diatur' || !s.currentClass || s.currentClass.startsWith('7'))).length} siswa).</span>
                    </div>
                  </label>
                </div>

                {/* MAX STUDENTS */}
                <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700">Maks. Siswa Per Rombel</label>
                    <span className="font-mono font-extrabold bg-green-50 text-green-700 px-2 py-0.5 rounded text-[11px]">
                      {maxStudents7} Siswa
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMaxStudents7(Math.max(10, maxStudents7 - 1))}
                      className="bg-slate-100 hover:bg-slate-200 p-1 rounded text-slate-650 cursor-pointer text-xs font-black"
                    >
                      -
                    </button>
                    <input 
                      type="range"
                      min={15}
                      max={45}
                      value={maxStudents7}
                      onChange={(e) => setMaxStudents7(Number(e.target.value))}
                      className="flex-1 accent-green-600 h-1 cursor-pointer bg-slate-100 rounded-lg appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxStudents7(Math.min(50, maxStudents7 + 1))}
                      className="bg-slate-100 hover:bg-slate-200 p-1 rounded text-slate-650 cursor-pointer text-xs font-black"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* CLASS TARGETS COUNT */}
                <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700">Jumlah Rombel Target</label>
                    <div className="flex items-center gap-1.5">
                      {customClassCount7 !== null && (
                        <button
                          type="button"
                          onClick={() => setCustomClassCount7(null)}
                          className="text-[9px] font-medium text-amber-600 hover:underline cursor-pointer"
                        >
                          Atur Otomatis
                        </button>
                      )}
                      <span className="font-mono font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px]">
                        {classCount7} Rombel
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={classCount7 <= 1}
                      onClick={() => setCustomClassCount7(Math.max(1, classCount7 - 1))}
                      className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 p-1 px-2 rounded text-slate-650 cursor-pointer font-bold"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center font-mono py-1 bg-slate-50 border border-slate-150 rounded text-slate-700 text-[10.5px] font-black">
                      {classCount7} Rombel (7.1 s.d 7.{classCount7})
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomClassCount7(classCount7 + 1)}
                      className="bg-slate-100 hover:bg-slate-200 p-1 px-2 rounded text-slate-650 cursor-pointer font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* METHOD */}
                <div className="space-y-1 mt-4 pt-4 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700">Metode Rombel Kelas 7</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDistMethod7('heterogen')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[10px] ${
                        distMethod7 === 'heterogen'
                          ? 'border-green-500 bg-green-50/50 text-green-800 font-extrabold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      Heterogen (Adil)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDistMethod7('acak')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[10px] ${
                        distMethod7 === 'acak'
                          ? 'border-green-500 bg-green-50/50 text-green-800 font-extrabold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      Acak (Random)
                    </button>
                  </div>
                  {distMethod7 === 'heterogen' && (
                    <div className="mt-2 bg-green-50/75 border border-green-250 p-2 rounded-lg text-[9.5px] text-green-800 leading-normal animate-fade-in">
                      <strong>✨ Algoritma EduData:</strong> Siswa baru didistribusikan secara seimbang gender (Laki-laki & Perempuan) dan tersebar secara merata berdasarkan <strong>asal sekolah</strong> agar alumni SD yang sama tidak berkelompok/menumpuk dalam satu rombel.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CARD 2: KELAS 8 RESORT */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4 relative overflow-hidden flex flex-col justify-between">
              <div>
                {/* Accent Top Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500"></div>
                
                <div className="flex justify-between items-start pt-1">
                  <div>
                    <h3 className="text-xs font-black text-blue-700 tracking-wider uppercase font-mono bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                      Tingkat Kelas 8
                    </h3>
                    <p className="text-slate-800 font-bold text-sm mt-1">Kenaikan Tingkat Kelas 7 ➔ 8</p>
                  </div>
                  <span className="text-[11px] font-black text-blue-700 bg-blue-200/45 px-2.5 py-1 rounded-full font-mono">
                    {level8Candidates.length} Calon
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Siswa aktif yang saat ini terdaftar di Tingkat Kelas 7 secara otomatis didata untuk dipromosikan ke Kelas 8 Rombel baru.
                </p>

                {/* MAX STUDENTS */}
                <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700">Maks. Siswa Per Rombel</label>
                    <span className="font-mono font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px]">
                      {maxStudents8} Siswa
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMaxStudents8(Math.max(10, maxStudents8 - 1))}
                      className="bg-slate-100 hover:bg-slate-200 p-1 rounded text-slate-650 cursor-pointer text-xs font-black"
                    >
                      -
                    </button>
                    <input 
                      type="range"
                      min={15}
                      max={45}
                      value={maxStudents8}
                      onChange={(e) => setMaxStudents8(Number(e.target.value))}
                      className="flex-1 accent-blue-600 h-1 cursor-pointer bg-slate-100 rounded-lg appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxStudents8(Math.min(50, maxStudents8 + 1))}
                      className="bg-slate-100 hover:bg-slate-200 p-1 rounded text-slate-650 cursor-pointer text-xs font-black"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* CLASS TARGETS COUNT */}
                <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700">Jumlah Rombel Target</label>
                    <div className="flex items-center gap-1.5">
                      {customClassCount8 !== null && (
                        <button
                          type="button"
                          onClick={() => setCustomClassCount8(null)}
                          className="text-[9px] font-medium text-amber-600 hover:underline cursor-pointer"
                        >
                          Atur Otomatis
                        </button>
                      )}
                      <span className="font-mono font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px]">
                        {classCount8} Rombel
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={classCount8 <= 1}
                      onClick={() => setCustomClassCount8(Math.max(1, classCount8 - 1))}
                      className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 p-1 px-2 rounded text-slate-650 cursor-pointer font-bold"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center font-mono py-1 bg-slate-50 border border-slate-150 rounded text-slate-700 text-[10.5px] font-black">
                      {classCount8} Rombel (8.1 s.d 8.{classCount8})
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomClassCount8(classCount8 + 1)}
                      className="bg-slate-100 hover:bg-slate-200 p-1 px-2 rounded text-slate-650 cursor-pointer font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* METHOD */}
                <div className="space-y-1 mt-4 pt-4 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700">Metode Rombel Kelas 8</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDistMethod8('heterogen')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[10px] ${
                        distMethod8 === 'heterogen'
                          ? 'border-blue-500 bg-blue-50/50 text-blue-800 font-extrabold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      Heterogen (Adil)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDistMethod8('acak')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[10px] ${
                        distMethod8 === 'acak'
                          ? 'border-blue-500 bg-blue-50/50 text-blue-800 font-extrabold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      Acak (Random)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: KELAS 9 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4 relative overflow-hidden flex flex-col justify-between">
              <div>
                {/* Accent Top Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-purple-500"></div>
                
                <div className="flex justify-between items-start pt-1">
                  <div>
                    <h3 className="text-xs font-black text-purple-700 tracking-wider uppercase font-mono bg-purple-50 px-2 py-0.5 rounded-full inline-block">
                      Tingkat Kelas 9
                    </h3>
                    <p className="text-slate-800 font-bold text-sm mt-1">Kenaikan Tingkat Kelas 8 ➔ 9</p>
                  </div>
                  <span className="text-[11px] font-black text-purple-700 bg-purple-200/45 px-2.5 py-1 rounded-full font-mono">
                    {level9Candidates.length} Calon
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Siswa aktif yang saat ini terdaftar di Tingkat Kelas 8 secara otomatis didata untuk dipromosikan ke Kelas 9 Rombel baru.
                </p>

                {/* MAX STUDENTS */}
                <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700">Maks. Siswa Per Rombel</label>
                    <span className="font-mono font-extrabold bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[11px]">
                      {maxStudents9} Siswa
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMaxStudents9(Math.max(10, maxStudents9 - 1))}
                      className="bg-slate-100 hover:bg-slate-200 p-1 rounded text-slate-650 cursor-pointer text-xs font-black"
                    >
                      -
                    </button>
                    <input 
                      type="range"
                      min={15}
                      max={45}
                      value={maxStudents9}
                      onChange={(e) => setMaxStudents9(Number(e.target.value))}
                      className="flex-1 accent-purple-600 h-1 cursor-pointer bg-slate-100 rounded-lg appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxStudents9(Math.min(50, maxStudents9 + 1))}
                      className="bg-slate-100 hover:bg-slate-200 p-1 rounded text-slate-650 cursor-pointer text-xs font-black"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* CLASS TARGETS COUNT */}
                <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700">Jumlah Rombel Target</label>
                    <div className="flex items-center gap-1.5">
                      {customClassCount9 !== null && (
                        <button
                          type="button"
                          onClick={() => setCustomClassCount9(null)}
                          className="text-[9px] font-medium text-amber-600 hover:underline cursor-pointer"
                        >
                          Atur Otomatis
                        </button>
                      )}
                      <span className="font-mono font-extrabold bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[11px]">
                        {classCount9} Rombel
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={classCount9 <= 1}
                      onClick={() => setCustomClassCount9(Math.max(1, classCount9 - 1))}
                      className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 p-1 px-2 rounded text-slate-650 cursor-pointer font-bold"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center font-mono py-1 bg-slate-50 border border-slate-150 rounded text-slate-700 text-[10.5px] font-black">
                      {classCount9} Rombel (9.1 s.d 9.{classCount9})
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomClassCount9(classCount9 + 1)}
                      className="bg-slate-100 hover:bg-slate-200 p-1 px-2 rounded text-slate-650 cursor-pointer font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* METHOD */}
                <div className="space-y-1 mt-4 pt-4 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700">Metode Rombel Kelas 9</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDistMethod9('heterogen')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[10px] ${
                        distMethod9 === 'heterogen'
                          ? 'border-purple-500 bg-purple-50/50 text-purple-800 font-extrabold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      Heterogen (Adil)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDistMethod9('acak')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[10px] ${
                        distMethod9 === 'acak'
                          ? 'border-purple-500 bg-purple-50/50 text-purple-800 font-extrabold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      Acak (Random)
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* REQUEST KELAS & LOCK ROMBEL SISWA PANEL */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Lock size={18} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase font-mono">
                  Daftar Request Kelas / Kunci Rombel (Opsional)
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  Gunakan bagian ini jika ada siswa yang memiliki permintaan atau kondisi khusus (misal: saudara kembar yang harus satu kelas, pertimbangan carpool, atau rekomendasi medis) sehingga wajib ditempatkan langsung di rombel tertentu.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
              {/* SISI KIRI: CARI & TAMBAH REQUEST */}
              <div className="space-y-3">
                <span className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider font-mono">
                  Tambah Kunci Rombel Baru
                </span>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={14} />
                  </div>
                  <input
                    type="text"
                    value={reqSearchTerm}
                    onChange={(e) => {
                      setReqSearchTerm(e.target.value);
                      setSelectedStudentForReq('');
                    }}
                    placeholder="Cari siswa berdasarkan nama atau NISN..."
                    className="w-full text-[11px] pl-8 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all font-medium"
                  />
                </div>

                {/* Hasil pencarian instan */}
                {reqSearchTerm && !selectedStudentForReq && (
                  <div className="border border-slate-200 rounded-lg bg-white overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 shadow-sm animate-fade-in z-10 relative">
                    {students
                      .filter(s => s.status === 'Aktif' && getStudentLevel(s) !== 'Unknown')
                      .filter(s => {
                        const term = reqSearchTerm.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(term) ||
                          (s.nisn && s.nisn.includes(term))
                        );
                      })
                      .slice(0, 5)
                      .map((stu) => {
                        const lvl = getStudentLevel(stu);
                        const currentLock = classRequests[stu.id];
                        return (
                          <div
                            key={stu.id}
                            onClick={() => {
                              setSelectedStudentForReq(stu.id);
                              // Default target class
                              const defaultClass = lvl === '7' ? '7.1' : lvl === '8' ? '8.1' : '9.1';
                              setSelectedClassForReq(currentLock || defaultClass);
                            }}
                            className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-[11px]"
                          >
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-slate-800 block">{stu.name}</span>
                              <span className="text-[9.5px] text-slate-400 font-mono">
                                {stu.gender === 'L' ? 'Laki-laki' : 'Perempuan'} • NISN: {stu.nisn || '-'} • Rapor: {stu.averageGrade}
                              </span>
                            </div>
                            <span className="font-extrabold font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              Tingkat {lvl} {currentLock ? `(Lock: ${currentLock})` : ''}
                            </span>
                          </div>
                        );
                      })}
                    {students
                      .filter(s => s.status === 'Aktif' && getStudentLevel(s) !== 'Unknown')
                      .filter(s => {
                        const term = reqSearchTerm.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(term) ||
                          (s.nisn && s.nisn.includes(term))
                        );
                      }).length === 0 && (
                      <div className="p-3 text-center text-slate-400 font-medium text-[10.5px]">
                        Siswa tidak ditemukan atau non-aktif
                      </div>
                    )}
                  </div>
                )}

                {/* Form detail kunci rombel setelah siswa dipilih */}
                {selectedStudentForReq && (() => {
                  const stu = students.find(s => s.id === selectedStudentForReq);
                  if (!stu) return null;
                  const lvl = getStudentLevel(stu);
                  
                  // Generate list of available target classes
                  const targetCount = lvl === '7' ? classCount7 : lvl === '8' ? classCount8 : classCount9;
                  const opts: string[] = [];
                  for (let i = 1; i <= targetCount; i++) {
                    opts.push(`${lvl}.${i}`);
                  }

                  return (
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2.5 animate-fade-in">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-slate-800 text-[11px] block">{stu.name}</strong>
                          <span className="text-[9.5px] text-slate-650 font-medium block">
                            Calon Tingkat {lvl} • Asal Rerata: {stu.averageGrade}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForReq('')}
                          className="text-[9.5px] text-slate-400 hover:text-slate-600 font-bold"
                        >
                          Batal
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex-1 space-y-1">
                          <label className="text-[9.5px] font-bold text-slate-600 block">Pilih Rombel Target</label>
                          <select
                            value={selectedClassForReq}
                            onChange={(e) => setSelectedClassForReq(e.target.value)}
                            className="w-full text-[10.5px] font-black border border-slate-200 rounded-lg p-1.5 focus:ring-1 focus:ring-green-500 focus:border-green-500 bg-white"
                          >
                            {opts.map(opt => (
                              <option key={opt} value={opt}>Kelas {opt}</option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...classRequests, [stu.id]: selectedClassForReq };
                            updateClassRequests(updated);
                            setSelectedStudentForReq('');
                            setSelectedClassForReq('');
                            setReqSearchTerm('');
                            setNotificationMsg(`Berhasil mengunci ${stu.name} ke kelas ${selectedClassForReq}`);
                            setTimeout(() => setNotificationMsg(''), 4000);
                          }}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10.5px] font-extrabold cursor-pointer self-end flex items-center gap-1.5"
                        >
                          <Lock size={12} className="stroke-[2.5]" />
                          <span>Kunci Rombel</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* SISI KANAN: DAFTAR REQUEST AKTIF */}
              <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-150 pt-4 md:pt-0 md:pl-5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    Request Aktif ({Object.keys(classRequests).length})
                  </span>
                  {Object.keys(classRequests).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Hapus semua request kelas yang sudah terdaftar?")) {
                          updateClassRequests({});
                        }
                      }}
                      className="text-[9.5px] font-extrabold text-red-500 hover:underline cursor-pointer"
                    >
                      Hapus Semua
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Object.entries(classRequests).length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 font-medium text-[10.5px]">
                      Belum ada siswa yang dikunci rombelnya. Semua siswa di tingkat terpilih akan dibagi secara acak / heterogen.
                    </div>
                  ) : (
                    Object.entries(classRequests)
                      .map(([id, clsName]) => {
                        const student = students.find(s => s.id === id);
                        if (!student) return null;
                        const lvl = getStudentLevel(student);
                        return (
                          <div
                            key={id}
                            className="p-2 border border-slate-150 rounded-xl flex items-center justify-between bg-amber-50/20 text-[10.5px] font-medium animate-fade-in"
                          >
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-slate-800 block">{student.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                Tingkat {lvl} • Nilai Rapor: {student.averageGrade}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-amber-100 text-amber-800 border border-amber-250 px-2 py-0.5 rounded-lg font-black font-mono text-[9.5px] flex items-center gap-1 shadow-sm">
                                <Lock size={9} className="stroke-[3]" />
                                {clsName}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const reqs = { ...classRequests };
                                  delete reqs[id];
                                  updateClassRequests(reqs);
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                title="Unlock"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Central Process Button */}
          <div className="bg-slate-100/65 border border-slate-200 rounded-2xl p-6 text-center space-y-3 shadow-inner">
            <button
              onClick={handleRunAllSimulations}
              className="px-8 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-extrabold transition-all hover:scale-[1.01] hover:shadow shadow-green-500/20 cursor-pointer flex items-center gap-2.5 mx-auto"
            >
              <Sparkles size={18} />
              <span>Jalankan Simulasi & Bagi Rombel Kelas</span>
            </button>
            <p className="text-[10px] text-slate-400 font-mono">
              Sistem akan membagi seluruh tingkat sekaligus dalam hitungan detik. Data draft dapat diunduh per tingkatan di langkah selanjutnya.
            </p>
          </div>
        </div>
      )}

      {/* STEP 2: SIMULATION RESULTS, FILTERS, AND EXPORTS */}
      {step === 'results' && (
        <div className="space-y-6">
          {/* Action header card */}
          <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[10px] tracking-wider font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md uppercase">
                  SIMULASI AKTIF
                </span>
                <span className="text-[11px] font-semibold text-slate-600">
                  Data utama (Induk) tidak tersentuh
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Gunakan menu di kanan untuk mengunduh draf atau kembali menyunting parameter di kiri.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplyToMaster}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-green-700/15 hover:scale-[1.01]"
              >
                <Check size={13} className="stroke-[3]" />
                <span>Terapkan Hasil ke Data Induk</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('setup')}
                className="bg-white hover:bg-slate-50 border border-slate-250 py-2 px-3 rounded-lg text-[11px] font-extrabold text-slate-650 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Sliders size={13} className="text-slate-500" />
                <span>Atur Ulang Parameter</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-lg text-[11px] font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-700/10"
              >
                <FileSpreadsheet size={13} />
                <span>Unduh Excel Semua Rombel</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPDFAll}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-lg text-[11px] font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-700/10"
              >
                <Printer size={13} />
                <span>Cetak PDF Semua Rombel</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllCSV}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-2.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                title="Ekspor CSV Mentah (Kolektif)"
              >
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Results grade level tabs */}
          <div className="bg-white rounded-xl border border-slate-150 p-1 flex shadow-sm">
            {(['7', '8', '9'] as const).map((lvl) => {
              const activeResult = results[lvl];
              const countClasses = activeResult?.stats.length || 0;
              const countStudents = activeResult?.assignedStudents.length || 0;
              const isSelected = activeLevel === lvl;
              
              let title = '';
              if (lvl === '7') title = 'Rombel Kelas 7';
              else if (lvl === '8') title = 'Rombel Kelas 8';
              else if (lvl === '9') title = 'Rombel Kelas 9';

              return (
                <button
                  key={lvl}
                  onClick={() => {
                    setActiveLevel(lvl);
                    const levelStats = results[lvl]?.stats || [];
                    if (levelStats.length > 0) {
                      setActivePreviewClass(levelStats[0].className);
                    }
                  }}
                  disabled={!activeResult}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-green-600 text-white shadow shadow-green-500/10 font-bold'
                      : !activeResult
                        ? 'opacity-30 cursor-not-allowed text-slate-300'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>{title}</span>
                  <span className={`px-2 py-0.2 rounded-full text-[9px] font-mono leading-none ${isSelected ? 'bg-green-700 text-green-100' : 'bg-slate-100 text-slate-500'}`}>
                    {countClasses} Kelas ({countStudents} Siswa)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Core Results workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: Class List Overview under selected level */}
            <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2 font-mono">
                <Activity size={13} className="text-green-600" />
                Daftar Rombel Hasil Distribusi
              </h3>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {(results[activeLevel]?.stats || []).map((stat) => {
                  const isClassSelected = activePreviewClass === stat.className;
                  const ratioL = stat.studentsCount > 0 ? Math.round((stat.maleCount / stat.studentsCount) * 100) : 0;
                  const ratioP = stat.studentsCount > 0 ? Math.round((stat.femaleCount / stat.studentsCount) * 100) : 0;
                  
                  return (
                    <button
                      type="button"
                      key={stat.className}
                      onClick={() => {
                        setActivePreviewClass(stat.className);
                        setSearchTerm('');
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex justify-between items-center ${
                        isClassSelected
                          ? 'border-green-500 bg-green-50/40 text-slate-900 ring-2 ring-green-600/10'
                          : 'border-slate-150 hover:bg-slate-50 hover:border-slate-300 text-slate-650'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="font-extrabold text-xs block text-slate-800">
                          Rombel Kelas {stat.className}
                        </span>
                        <span className="text-[10px] text-emerald-600 block leading-none font-sans font-medium">
                          Metode: Heterogen Berimbang
                        </span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="font-extrabold text-[11px] block text-slate-800 font-mono">
                          {stat.studentsCount} Siswa
                        </span>
                        <span className="text-[9px] text-slate-450 block leading-none">
                          {stat.maleCount}L ({ratioL}%) / {stat.femaleCount}P
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 mt-2 space-y-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Ekspor Hasil Tingkat {activeLevel}
                </span>
                
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportExcel(activeLevel)}
                    className="bg-emerald-50 hover:bg-emerald-110 hover:bg-emerald-100 border border-emerald-200 py-2 rounded-lg text-[10.5px] font-black text-emerald-800 flex justify-center items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    title="Unduh Lembar Kerja Excel (.xlsx) dengan kop surat dan tanda tangan"
                  >
                    <FileSpreadsheet size={12} className="text-emerald-700" />
                    <span>Laporan Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintPDFLevel(activeLevel)}
                    className="bg-indigo-50 hover:bg-indigo-110 hover:bg-indigo-100 border border-indigo-200 py-2 rounded-lg text-[10.5px] font-black text-indigo-800 flex justify-center items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    title="Cetak lembaran daftar murid per rombel dalam format standar PDF dinas"
                  >
                    <Printer size={12} className="text-indigo-700" />
                    <span>Cetak PDF</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportCSV(activeLevel)}
                  className="w-full bg-white hover:bg-slate-50 border border-slate-200 py-1.5 rounded-lg text-[10px] font-medium text-slate-500 flex justify-center items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Unduh Format CSV Baku ({activeLevel})</span>
                </button>
              </div>
            </div>

            {/* Right side: Detailed list of chosen class with Search capabilities */}
            <div className="lg:col-span-2 bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
              
              <div className="space-y-4">
                {/* Header detail with simulation indicator */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-green-600 text-white font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">
                      Roster Kelas {activePreviewClass}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {((results[activeLevel]?.stats || []).find((s) => s.className === activePreviewClass)?.studentsCount || 0)} Murid Terpetakan
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePrintPDFClass(activePreviewClass, activeLevel)}
                      className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                      title="Cetak daftar nama siswa untuk kelas ini saja"
                    >
                      <Printer size={11} className="text-indigo-600" />
                      <span>Cetak Surat Rencana Rombel (PDF)</span>
                    </button>
                  </div>

                  {/* Search inside the class roster */}
                  <div className="relative w-full sm:w-56">
                    <input
                      type="text"
                      placeholder="Cari nama siswa di kelas ini..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full border border-slate-250 rounded-lg py-1 px-3.5 text-[10.5px] leading-tight focus:outline-none focus:border-green-500 font-medium"
                    />
                  </div>
                </div>

                {/* Main Class render loop */}
                {(results[activeLevel]?.stats || []).map((stat) => {
                  if (stat.className !== activePreviewClass) return null;

                  // Apply search term filtering to students list
                  const filteredStudents = stat.students.filter((student) =>
                    student.name.toLowerCase().includes(searchTerm.toLowerCase())
                  );

                  return (
                    <div key={stat.className} className="space-y-4 animate-fade-in">
                      {/* Quick statistical summaries */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-[11px] leading-tight text-slate-650 text-slate-700">
                        <div className="space-y-0.5">
                          <span className="text-slate-420 block text-[10px] uppercase font-bold text-slate-400">Rasio Gender Rombel</span>
                          <span className="font-mono text-slate-800 font-bold block">
                            {stat.maleCount} Laki ({Math.round((stat.maleCount / stat.studentsCount) * 100)}%) / {stat.femaleCount} Perempuan
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-420 block text-[10px] uppercase font-bold text-slate-400">Kelas Tujuan Aktual</span>
                          <span className="font-sans text-emerald-700 font-black block text-xs">
                            Kelas {stat.className}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-420 block text-[10px] uppercase font-bold text-slate-400">Status Rombel</span>
                          <span className="font-sans text-slate-800 font-bold block text-[10.5px]">
                            Terpetakan Berimbang
                          </span>
                        </div>
                      </div>

                      {/* Displaying Student rows */}
                      {filteredStudents.length > 0 ? (
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50">
                                <th className="p-2.5 font-bold uppercase text-[9.5px]">No</th>
                                <th className="p-2.5 font-bold uppercase text-[9.5px]">Nama Siswa</th>
                                <th className="p-2.5 font-bold uppercase text-[9.5px] text-center">Gender</th>
                                <th className="p-2.5 font-bold uppercase text-[9.5px]">Tempat / Tgl Lahir</th>
                                <th className="p-2.5 font-bold uppercase text-[9.5px]">Asal Kelas Sebelum</th>
                                <th className="p-2.5 font-bold uppercase text-[9.5px] text-right">Kelas Tujuan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredStudents.map((student, idx) => (
                                <tr key={student.id} className="hover:bg-slate-50/40 transition-colors">
                                  <td className="p-2.5 text-slate-400 font-mono text-[10.5px] font-bold">{idx + 1}</td>
                                  <td className="p-2.5 font-bold text-slate-900 text-[11px]">{student.name}</td>
                                  <td className="p-2.5 text-center">
                                    <span className={`inline-block py-0.5 px-2 rounded-full text-[9px] font-black leading-none ${
                                      student.gender === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                                    }`}>
                                      {student.gender}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-slate-500 text-[10.5px]">{student.birthPlace}, {student.birthDate}</td>
                                  <td className="p-2.5 text-slate-600 text-[10.5px] font-medium">
                                    {(() => {
                                      const orig = students.find(x => x.id === student.id);
                                      const origClass = orig?.currentClass;
                                      return activeLevel === '7' ? (student.asalKelas || '-') : (origClass && origClass !== "Belum Diatur" ? `Kelas ${origClass}` : "-");
                                    })()}
                                  </td>
                                  <td className="p-2.5 text-right font-sans font-bold text-[11px] text-emerald-700">Kelas {stat.className}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                          <HelpCircle size={24} className="mx-auto mb-2 text-slate-300" />
                          <p className="text-[11px] font-bold">Tidak ditemukan siswa</p>
                          <p className="text-[9.5px] mt-0.5">Tidak ada siswa bernama pencarian "{searchTerm}" di rombel ini.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Information footer indicating how to proceed */}
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl mt-4 text-[10px] text-slate-500 leading-normal flex gap-2 items-center">
                <Check size={14} className="text-green-600 shrink-0" />
                <p>
                  Hasil simulasi di atas valid. Anda dapat mengunduh seluruh berkas rombel pendukung ekspor Dapodik melalui tombol <strong className="text-slate-700">"Unduh Seluruh Rombel"</strong> di atas.
                </p>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>

    {/* PRINT WORKSPACE SECTION: Interactive On-Screen Printable Modal */}
    {printTarget && (
      <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex flex-col p-4 md:p-8 overflow-y-auto print:p-0 print:bg-white print:relative print:overflow-visible print:inset-auto print:z-auto print:backdrop-blur-none" id="print-preview-modal">
        
        {/* Print Configuration Controls (Screen-Only) */}
        <div className="bg-white border border-slate-200 rounded-2xl max-w-[8.5in] w-full mx-auto p-5 mb-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden animate-fade-in shrink-0">
          <div className="space-y-1 flex-1">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 font-sans uppercase tracking-wider">
              <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse"></span>
              Pratinjau Cetak Surat Alokasi Rombel (Standar Dinas)
            </h3>
            <p className="text-[10.5px] text-slate-500 leading-normal">
              Dokumen telah disusun rapi sesuai format kedinasan dengan Kop Surat resmi dan bubuhan Tanda Tangan / Stempel Basah.
            </p>
            {/* Warning Alert for iframe print constraints */}
            <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-xl text-[10px] text-indigo-950 leading-relaxed mt-2 flex items-start gap-2.5 max-w-3xl">
              <span className="text-sm">💡</span>
              <div className="font-sans font-medium text-left">
                <strong>Catatan Khusus Penggunaan (Iframe):</strong> Berhubung platform berjalan dalam format sandbox iframe, sistem pengaman browser mungkin memblokir perintah cetak otomatis (window.print). 
                <span className="text-indigo-800 font-semibold"> Jika tombol cetak tidak memberi respon, silakan klik tombol "Buka di Tab Baru" di pojok kanan atas layar Anda</span> untuk membuka lembar kerja utama secara penuh, kemudian pilih menu Cetak PDF kembali.
              </div>
            </div>
          </div>
          
          <div className="flex flex-row items-center gap-2 self-start md:self-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setTimeout(() => {
                  window.print();
                }, 100);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-4 rounded-xl text-[10.5px] flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95 transition-all font-sans"
            >
              <Printer size={14} className="stroke-[2.5]" />
              Cetak Dokumen / PDF
            </button>
            <button
              type="button"
              onClick={() => setPrintTarget(null)}
              className="bg-slate-100 hover:bg-slate-250 text-slate-700 font-extrabold py-2.5 px-4 rounded-xl text-[10.5px] cursor-pointer transition-colors font-sans"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>

        {/* Paper Container Sheets */}
        <div className="max-w-[8.5in] w-full mx-auto space-y-6 print:space-y-0 print:m-0 print:max-w-full print:w-full">
          {/* If printing a single class */}
          {printTarget.type === 'class' && (
            (() => {
              const activeClassStat = (results[printTarget.level!]?.stats || []).find(s => s.className === printTarget.className);
              if (!activeClassStat) return <p className="text-center font-sans text-red-500 py-8 bg-white rounded-2xl">Data Rombel tidak ditemukan untuk dicetak.</p>;
              
              return (
                <div className="bg-white p-8 md:p-12 print:p-0 border border-slate-200 print:border-none shadow-lg print:shadow-none min-h-[11in] flex flex-col justify-between font-serif text-slate-900 rounded-xl print:rounded-none" style={{ pageBreakInside: 'avoid' }}>
                  <div>
                    {renderKopSurat()}
                    <div className="text-center my-4 space-y-1">
                      <h3 className="text-[14px] font-bold tracking-wide uppercase underline">
                        DAFTAR PENEMPATAN PESERTA DIDIK KELAS BARU
                      </h3>
                      <p className="text-[10px] font-sans text-slate-500 font-medium">
                        Nomor: {schoolSettings.noSuratPrefix} / 2026
                      </p>
                    </div>

                    {/* Metadata ringkas */}
                    <div className="mb-4 bg-slate-50 border p-3 rounded-md text-[10px] leading-relaxed font-sans grid grid-cols-2 gap-2 text-slate-700 print:border-slate-300 print:bg-slate-50/50">
                      <div>
                        Rujukan Rombel: <strong className="text-slate-950 font-bold">Kelas {activeClassStat.className}</strong>
                      </div>
                      <div>
                        Tingkat / Tahun Ajaran: <strong className="text-slate-950 font-bold">Tingkat {printTarget.level} / {schoolSettings.tahunAjaran}</strong>
                      </div>
                      <div>
                        Distribusi Gender: <strong className="text-slate-950 font-bold">{activeClassStat.maleCount} L / {activeClassStat.femaleCount} P ({activeClassStat.studentsCount} Murid)</strong>
                      </div>
                      <div>
                        Pola Pembagian: <strong className="text-slate-950 font-bold font-sans">Heterogen Seimbang (Alfabetis)</strong>
                      </div>
                    </div>

                    {/* Table */}
                    <table className="w-full text-left text-[9.5px] border-collapse border border-slate-350">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-350">
                          <th className="p-1 border border-slate-350 font-bold text-center w-[5%]">No</th>
                          <th className="p-1 border border-slate-350 font-bold">Nama Lengkap</th>
                          <th className="p-1 border border-slate-350 font-bold text-center w-[6%]">L/P</th>
                          <th className="p-1 border border-slate-350 font-bold w-[12%]">NISN</th>
                          <th className="p-1 border border-slate-350 font-bold w-[12%]">NIPD (NIK)</th>
                          <th className="p-1 border border-slate-350 font-bold">Tempat, Tanggal Lahir</th>
                          <th className="p-1 border border-slate-350 font-bold w-[16%]">Asal Kelas Sebelum</th>
                          <th className="p-1 border border-slate-350 font-bold text-center w-[12%]">Kelas Tujuan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeClassStat.students.map((student, index) => (
                          <tr key={student.id} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="p-1 border border-slate-300 text-center font-mono">{index + 1}</td>
                            <td className="p-1 border border-slate-300 font-bold uppercase text-[9px]">{student.name}</td>
                            <td className="p-1 border border-slate-300 text-center">{student.gender}</td>
                            <td className="p-1 border border-slate-300 font-mono text-[8.5px]">{student.nisn ? CryptoService.decrypt(student.nisn) : '-'}</td>
                            <td className="p-1 border border-slate-300 font-mono text-[8.5px]">{student.nik ? CryptoService.decrypt(student.nik) : '-'}</td>
                            <td className="p-1 border border-slate-300 font-medium text-[8.5px]">{student.birthPlace}, {student.birthDate}</td>
                            <td className="p-1 border border-slate-300 text-[8.5px]">
                              {(() => {
                                const orig = students.find(x => x.id === student.id);
                                const origClass = orig?.currentClass;
                                return printTarget.level === '7' ? (student.asalKelas || '-') : (origClass && origClass !== "Belum Diatur" ? `Kelas ${origClass}` : "-");
                              })()}
                            </td>
                            <td className="p-1 border border-slate-300 text-center font-bold text-[9px]">Kelas {activeClassStat.className}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures */}
                  {renderSignatureBlock("Kelas " + activeClassStat.className)}
                </div>
              );
            })()
          )}

          {/* If printing all classes of a specific level */}
          {printTarget.type === 'level' && (
            (results[printTarget.level!]?.stats || []).map((classStat, idx) => (
              <div 
                key={classStat.className} 
                className="bg-white p-8 md:p-12 print:p-0 border border-slate-200 print:border-none shadow-lg print:shadow-none min-h-[11in] flex flex-col justify-between font-serif text-slate-900 rounded-xl print:rounded-none my-4 first:mt-0"
                style={{ pageBreakBefore: idx > 0 ? 'always' : 'auto', pageBreakInside: 'avoid' }}
              >
                <div>
                  {renderKopSurat()}
                  <div className="text-center my-4 space-y-1">
                    <h3 className="text-[14px] font-bold tracking-wide uppercase underline">
                      DAFTAR PENEMPATAN PESERTA DIDIK KELAS BARU
                    </h3>
                    <p className="text-[10px] font-sans text-slate-500 font-medium">
                      Nomor: {schoolSettings.noSuratPrefix} / 2026
                    </p>
                  </div>

                  {/* Metadata ringkas */}
                  <div className="mb-4 bg-slate-50 border p-3 rounded-md text-[10px] leading-relaxed font-sans grid grid-cols-2 gap-2 text-slate-700 print:border-slate-300 print:bg-slate-50/50">
                    <div>
                      Rujukan Rombel: <strong className="text-slate-950 font-bold">Kelas {classStat.className}</strong>
                    </div>
                    <div>
                      Tingkat / Tahun Ajaran: <strong className="text-slate-950 font-bold">Tingkat {printTarget.level} / 2026-2027</strong>
                    </div>
                    <div>
                      Distribusi Gender: <strong className="text-slate-950 font-bold">{classStat.maleCount} L / {classStat.femaleCount} P ({classStat.studentsCount} Murid)</strong>
                    </div>
                    <div>
                      Pola Pembagian: <strong className="text-slate-950 font-bold font-sans">Heterogen Seimbang (Alfabetis)</strong>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="w-full text-left text-[9.5px] border-collapse border border-slate-350">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-350">
                        <th className="p-1 border border-slate-350 font-bold text-center w-[5%]">No</th>
                        <th className="p-1 border border-slate-350 font-bold">Nama Lengkap</th>
                        <th className="p-1 border border-slate-350 font-bold text-center w-[6%]">L/P</th>
                        <th className="p-1 border border-slate-350 font-bold w-[12%]">NISN</th>
                        <th className="p-1 border border-slate-350 font-bold w-[12%]">NIPD (NIK)</th>
                        <th className="p-1 border border-slate-350 font-bold">Tempat, Tanggal Lahir</th>
                        <th className="p-1 border border-slate-350 font-bold w-[16%]">Asal Kelas Sebelum</th>
                        <th className="p-1 border border-slate-350 font-bold text-center w-[12%]">Kelas Tujuan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStat.students.map((student, index) => (
                        <tr key={student.id} className="border-b border-slate-200">
                          <td className="p-1 border border-slate-300 text-center font-mono">{index + 1}</td>
                          <td className="p-1 border border-slate-300 font-bold uppercase text-[9px]">{student.name}</td>
                          <td className="p-1 border border-slate-300 text-center">{student.gender}</td>
                          <td className="p-1 border border-slate-300 font-mono text-[8.5px]">{student.nisn ? CryptoService.decrypt(student.nisn) : '-'}</td>
                          <td className="p-1 border border-slate-300 font-mono text-[8.5px]">{student.nik ? CryptoService.decrypt(student.nik) : '-'}</td>
                          <td className="p-1 border border-slate-300 font-medium text-[8.5px]">{student.birthPlace}, {student.birthDate}</td>
                          <td className="p-1 border border-slate-300 text-[8.5px]">
                            {(() => {
                              const orig = students.find(x => x.id === student.id);
                              const origClass = orig?.currentClass;
                              return printTarget.level === '7' ? (student.asalKelas || '-') : (origClass && origClass !== "Belum Diatur" ? `Kelas ${origClass}` : "-");
                            })()}
                          </td>
                          <td className="p-1 border border-slate-300 text-center font-bold text-[9px]">Kelas {classStat.className}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                {renderSignatureBlock("Kelas " + classStat.className)}
              </div>
            ))
          )}

          {/* If printing ALL classes of ALL levels combined */}
          {printTarget.type === 'all' && (
            (['7', '8', '9'] as const).map((lvl) => {
              const lvlRes = results[lvl];
              if (!lvlRes) return null;
              
              return lvlRes.stats.map((classStat, idCls) => (
                <div 
                  key={classStat.className} 
                  className="bg-white p-8 md:p-12 print:p-0 border border-slate-200 print:border-none shadow-lg print:shadow-none min-h-[11in] flex flex-col justify-between font-serif text-slate-900 rounded-xl print:rounded-none my-4 first:mt-0"
                  style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }}
                >
                  <div>
                    {renderKopSurat()}
                    <div className="text-center my-4 space-y-1">
                      <h3 className="text-[14px] font-bold tracking-wide uppercase underline">
                        DAFTAR PENEMPATAN PESERTA DIDIK KELAS BARU (KOLEKTIF)
                      </h3>
                      <p className="text-[10px] font-sans text-slate-500 font-medium">
                        Nomor: {schoolSettings.noSuratPrefix} / 2026
                      </p>
                    </div>

                    {/* Metadata ringkas */}
                    <div className="mb-4 bg-slate-50 border p-3 rounded-md text-[10px] leading-relaxed font-sans grid grid-cols-2 gap-2 text-slate-700 print:border-slate-300 print:bg-slate-50/50">
                      <div>
                        Rujukan Rombel: <strong className="text-slate-950 font-bold">Kelas {classStat.className}</strong>
                      </div>
                      <div>
                        Tingkat / Tahun Ajaran: <strong className="text-slate-950 font-bold">Tingkat {lvl} / {schoolSettings.tahunAjaran}</strong>
                      </div>
                      <div>
                        Distribusi Gender: <strong className="text-slate-950 font-bold">{classStat.maleCount} L / {classStat.femaleCount} P ({classStat.studentsCount} Murid)</strong>
                      </div>
                      <div>
                        Pola Pembagian: <strong className="text-slate-950 font-bold font-sans">Heterogen Seimbang (Alfabetis)</strong>
                      </div>
                    </div>

                    {/* Table */}
                    <table className="w-full text-left text-[9.5px] border-collapse border border-slate-350">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-350">
                          <th className="p-1 border border-slate-350 font-bold text-center w-[5%]">No</th>
                          <th className="p-1 border border-slate-350 font-bold">Nama Lengkap</th>
                          <th className="p-1 border border-slate-350 font-bold text-center w-[6%]">L/P</th>
                          <th className="p-1 border border-slate-350 font-bold w-[12%]">NISN</th>
                          <th className="p-1 border border-slate-350 font-bold w-[12%]">NIPD (NIK)</th>
                          <th className="p-1 border border-slate-350 font-bold">Tempat, Tanggal Lahir</th>
                          <th className="p-1 border border-slate-350 font-bold w-[16%]">Asal Kelas Sebelum</th>
                          <th className="p-1 border border-slate-350 font-bold text-center w-[12%]">Kelas Tujuan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStat.students.map((student, index) => (
                          <tr key={student.id} className="border-b border-slate-200">
                            <td className="p-1 border border-slate-300 text-center font-mono">{index + 1}</td>
                            <td className="p-1 border border-slate-300 font-bold uppercase text-[9px]">{student.name}</td>
                            <td className="p-1 border border-slate-300 text-center">{student.gender}</td>
                            <td className="p-1 border border-slate-300 font-mono text-[8.5px]">{student.nisn ? CryptoService.decrypt(student.nisn) : '-'}</td>
                            <td className="p-1 border border-slate-300 font-mono text-[8.5px]">{student.nik ? CryptoService.decrypt(student.nik) : '-'}</td>
                            <td className="p-1 border border-slate-300 font-medium text-[8.5px]">{student.birthPlace}, {student.birthDate}</td>
                            <td className="p-1 border border-slate-300 text-[8.5px]">
                              {(() => {
                                const orig = students.find(x => x.id === student.id);
                                const origClass = orig?.currentClass;
                                return lvl === '7' ? (student.asalKelas || '-') : (origClass && origClass !== "Belum Diatur" ? `Kelas ${origClass}` : "-");
                              })()}
                            </td>
                            <td className="p-1 border border-slate-300 text-center font-bold text-[9px]">Kelas {classStat.className}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures */}
                  {renderSignatureBlock("Kelas " + classStat.className)}
                </div>
              ))
            })
          )}
        </div>
      </div>
    )}
  </>
);
}
