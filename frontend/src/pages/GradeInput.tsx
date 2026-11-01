import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Award,
  Save,
  Wand2,
  BookOpen,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  RefreshCw,
  Target,
  Check,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Database,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { masterService } from '../services/master.service';
import { gradeService } from '../services/grade.service';
import { useOfflineSync } from '../hooks/useOfflineSync';
import {
  saveDraft,
  getDraft,
  deleteDraft,
  enqueueOutbox,
  outboxWorker,
} from '../services/offline';
import {
  Rombel,
  Subject,
  TeachingAssignment,
  LearningObjective,
  GradeSheetResponse,
} from '../types';
import { SearchableRombelSelect } from '../components/common/SearchableRombelSelect';
import { M3Button, M3Card, M3TextField, M3Dialog } from '../components/m3';

interface LocalStudentGrade {
  student_id: string;
  student_name: string;
  nisn: string;
  nis?: string;
  grade_id?: string;
  tp_scores: Record<string, number>; // tp_id -> score
  nilai_akhir: number;
  deskripsi_capaian: string;
}

// Clean redundant teacher assessment prefixes for natural sentence formulation
function cleanTpDescription(raw: string): string {
  let desc = (raw || '').trim().replace(/\.+$/, '');
  const lower = desc.toLowerCase();

  const prefixes = [
    'menunjukkan penguasaan yang sangat baik dalam ',
    'menunjukkan penguasaan yang baik dalam ',
    'menunjukkan penguasaan dalam ',
    'peserta didik mampu ',
    'siswa mampu ',
    'dapat ',
    'mampu ',
  ];

  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      desc = desc.substring(prefix.length).trim();
      break;
    }
  }

  if (!desc) return '';

  const words = desc.split(/\s+/);
  if (words.length > 0) {
    const firstWord = words[0];
    const isAllUpper =
      firstWord.length >= 2 &&
      firstWord.split('').every((char) => (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9'));
    if (!isAllUpper && desc.length > 1) {
      desc = desc[0].toLowerCase() + desc.slice(1);
    }
  }

  return desc;
}

// Client-side Kurikulum Merdeka description generator
function generateLocalDeskripsiCapaian(
  student: LocalStudentGrade,
  tps: LearningObjective[]
): string {
  if (tps.length === 0) {
    return 'Belum ada tujuan pembelajaran yang ditentukan untuk mata pelajaran ini.';
  }

  const achieved: { kode: string; deskripsi: string }[] = [];
  const unachieved: { kode: string; deskripsi: string }[] = [];

  tps.forEach((tp) => {
    const isChecked = (student.tp_scores[tp.id] || 0) >= 1;
    const cleanDesc = cleanTpDescription(tp.deskripsi);
    const item = { kode: tp.kode_tp, deskripsi: cleanDesc };
    if (isChecked) {
      achieved.push(item);
    } else {
      unachieved.push(item);
    }
  });

  // All achieved
  if (unachieved.length === 0) {
    if (achieved.length === 1) {
      return `Menunjukkan penguasaan yang sangat baik dalam ${achieved[0].deskripsi}.`;
    } else if (achieved.length === 2) {
      return `Menunjukkan penguasaan yang sangat baik dalam ${achieved[0].deskripsi} dan ${achieved[1].deskripsi}.`;
    } else if (achieved.length === 3) {
      return `Menunjukkan penguasaan yang sangat baik dalam ${achieved[0].deskripsi}, ${achieved[1].deskripsi}, dan ${achieved[2].deskripsi}.`;
    }
    return `Menunjukkan penguasaan yang sangat baik dalam seluruh tujuan pembelajaran, terutama dalam ${achieved[0].deskripsi} dan ${achieved[1].deskripsi}.`;
  }

  // None achieved (all unchecked)
  if (achieved.length === 0) {
    if (unachieved.length === 1) {
      return `Perlu bimbingan dan peningkatan dalam ${unachieved[0].deskripsi}.`;
    } else if (unachieved.length === 2) {
      return `Perlu bimbingan dan peningkatan dalam ${unachieved[0].deskripsi} serta ${unachieved[1].deskripsi}.`;
    } else if (unachieved.length === 3) {
      return `Perlu bimbingan dan peningkatan dalam ${unachieved[0].deskripsi}, ${unachieved[1].deskripsi}, serta ${unachieved[2].deskripsi}.`;
    }
    return `Perlu bimbingan dan peningkatan dalam ${unachieved[0].deskripsi}, ${unachieved[1].deskripsi}, serta tujuan pembelajaran lainnya.`;
  }

  // Mixed: Some achieved, some need guidance
  let highPart = '';
  if (achieved.length === 1) {
    highPart = `Menunjukkan penguasaan yang baik dalam ${achieved[0].deskripsi}`;
  } else if (achieved.length === 2) {
    highPart = `Menunjukkan penguasaan yang baik dalam ${achieved[0].deskripsi} dan ${achieved[1].deskripsi}`;
  } else {
    highPart = `Menunjukkan penguasaan yang baik dalam ${achieved[0].deskripsi} serta ${achieved[1].deskripsi}`;
  }

  let lowPart = '';
  if (unachieved.length === 1) {
    lowPart = `perlu peningkatan dan bimbingan dalam ${unachieved[0].deskripsi}`;
  } else if (unachieved.length === 2) {
    lowPart = `perlu bimbingan dan peningkatan dalam ${unachieved[0].deskripsi} serta ${unachieved[1].deskripsi}`;
  } else {
    lowPart = `perlu bimbingan dan peningkatan dalam ${unachieved[0].deskripsi}, ${unachieved[1].deskripsi}, serta kompetensi lainnya`;
  }

  return `${highPart}, serta ${lowPart}.`;
}

export const GradeInput: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Selection state
  const [rombels, setRombels] = useState<Rombel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);

  const [selectedRombelId, setSelectedRombelId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Offline sync & draft states
  const { isOnline, unsyncedCount, isSyncing, triggerSync } = useOfflineSync();
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState<boolean>(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [draftFound, setDraftFound] = useState<{
    studentsGrades: LocalStudentGrade[];
    tps: LearningObjective[];
    savedAt: number;
  } | null>(null);
  const isUserEditingRef = useRef<boolean>(false);

  // Data state
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [tps, setTps] = useState<LearningObjective[]>([]);
  const [studentsGrades, setStudentsGrades] = useState<LocalStudentGrade[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Bulk Nilai Akhir Dialog State
  const [isBulkOpen, setIsBulkOpen] = useState<boolean>(false);
  const [bulkScore, setBulkScore] = useState<string>('80');
  const [bulkTarget, setBulkTarget] = useState<'all' | 'empty'>('all');

  // Debounced auto-save draft to IndexedDB (500ms) - Single Composite Document per form
  useEffect(() => {
    if (
      !isUserEditingRef.current ||
      !selectedRombelId ||
      !selectedSubjectId ||
      studentsGrades.length === 0
    ) {
      return;
    }

    const timer = setTimeout(async () => {
      const draftKey = `grades:${selectedRombelId}:${selectedSubjectId}`;
      await saveDraft(
        draftKey,
        'grades',
        {
          studentsGrades,
          tps,
          savedAt: Date.now(),
        },
        {
          rombelId: selectedRombelId,
          subjectId: selectedSubjectId,
          teacherId: user?.id,
        }
      );
      setLastDraftSavedAt(new Date());
      setHasUnsavedDraft(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [studentsGrades, selectedRombelId, selectedSubjectId, tps, user?.id]);

  // Load initial selections (Rombels, Subjects, Assignments) with offline cache support
  useEffect(() => {
    const fetchPrerequisites = async () => {
      try {
        setLoading(true);
        let activeRombels: Rombel[] = [];
        let subs: Subject[] = [];
        let myAssignments: TeachingAssignment[] = [];

        try {
          const [rombelRes, subRes] = await Promise.all([
            masterService.getRombels(),
            masterService.getSubjects(),
          ]);
          activeRombels = (rombelRes.rombels || []).filter((r: Rombel) => (r.student_count || 0) > 0);
          subs = subRes.subjects || [];

          // Simpan ke cache lokal untuk antisipasi saat offline
          saveDraft('cache:rombels', 'grades', activeRombels);
          saveDraft('cache:subjects', 'grades', subs);

          if (!isAdmin) {
            const assignRes = await masterService.getMyTeachingAssignments();
            const activeRombelIds = new Set(activeRombels.map((r: Rombel) => r.id));
            myAssignments = (assignRes.assignments || []).filter((a: TeachingAssignment) =>
              activeRombelIds.has(a.rombel_id)
            );
            saveDraft('cache:assignments', 'grades', myAssignments);
          }
        } catch (fetchErr) {
          // Fallback ke cache lokal jika server tidak dapat dijangkau
          const cachedRombels = await getDraft<Rombel[]>('cache:rombels');
          const cachedSubjects = await getDraft<Subject[]>('cache:subjects');
          const cachedAssignments = await getDraft<TeachingAssignment[]>('cache:assignments');

          if (cachedRombels && cachedRombels.length > 0) {
            activeRombels = cachedRombels;
            subs = cachedSubjects || [];
            myAssignments = cachedAssignments || [];
          } else {
            throw fetchErr;
          }
        }

        setRombels(activeRombels);
        setSubjects(subs);

        if (!isAdmin) {
          setAssignments(myAssignments);

          if (myAssignments.length > 0) {
            setSelectedRombelId(myAssignments[0].rombel_id);
            setSelectedSubjectId(myAssignments[0].subject_id);
          } else {
            setSelectedRombelId('');
            setSelectedSubjectId('');
          }
        } else {
          if (activeRombels.length > 0) {
            setSelectedRombelId(activeRombels[0].id);
          }
          if (subs.length > 0) {
            setSelectedSubjectId(subs[0].id);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data rombel dan mata pelajaran');
      } finally {
        setLoading(false);
      }
    };

    fetchPrerequisites();
  }, [isAdmin]);

  // Available rombels: filtered to only classes taught by the teacher (or all for admin)
  const availableRombels = useMemo(() => {
    if (isAdmin) return rombels;
    const myRombelIds = new Set(assignments.map((a) => a.rombel_id));
    return rombels.filter((r) => myRombelIds.has(r.id));
  }, [isAdmin, rombels, assignments]);

  // Available subjects filtered by rombel if teacher
  const availableSubjects = useMemo(() => {
    if (isAdmin) return subjects;
    if (!selectedRombelId) return [];
    const validSubjectIds = new Set(
      assignments.filter((a) => a.rombel_id === selectedRombelId).map((a) => a.subject_id)
    );
    return subjects.filter((s) => validSubjectIds.has(s.id));
  }, [isAdmin, assignments, subjects, selectedRombelId]);

  // Handler when user selects a different rombel (class)
  const handleRombelChange = (newRombelId: string) => {
    isUserEditingRef.current = false;
    setDraftFound(null);
    setHasUnsavedDraft(false);
    setError(null);
    setSelectedRombelId(newRombelId);

    if (!isAdmin) {
      const rombelAssignments = assignments.filter((a) => a.rombel_id === newRombelId);
      if (rombelAssignments.length > 0) {
        // If current subject is also taught in the new rombel, keep it; otherwise switch to the new rombel's first subject
        const hasCurrentSubject = rombelAssignments.some((a) => a.subject_id === selectedSubjectId);
        if (!hasCurrentSubject) {
          setSelectedSubjectId(rombelAssignments[0].subject_id);
        }
      } else {
        setSelectedSubjectId('');
      }
    } else {
      if (subjects.length > 0 && !subjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(subjects[0].id);
      }
    }
  };

  const handleSubjectChange = (newSubjectId: string) => {
    isUserEditingRef.current = false;
    setDraftFound(null);
    setHasUnsavedDraft(false);
    setError(null);
    setSelectedSubjectId(newSubjectId);
  };

  // Synchronize selectedSubjectId whenever availableSubjects changes (safety fallback)
  useEffect(() => {
    if (availableSubjects.length > 0) {
      const isValid = availableSubjects.some((s) => s.id === selectedSubjectId);
      if (!isValid) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [availableSubjects, selectedSubjectId]);

  // Track active request to prevent race conditions when switching classes quickly
  const activeFetchIdRef = useRef<number>(0);

  // Load Grade Sheet when rombel and subject change
  const fetchGradeSheet = useCallback(async () => {
    if (!selectedRombelId || !selectedSubjectId) {
      setStudentsGrades([]);
      setTps([]);
      setDraftFound(null);
      setHasUnsavedDraft(false);
      return;
    }

    // Safety guard: If teacher, ensure they are actually assigned to (selectedRombelId, selectedSubjectId)
    // This prevents any transient mismatched (rombel, subject) from calling the backend and triggering 403 Forbidden.
    if (!isAdmin) {
      const isAssigned = assignments.some(
        (a) => a.rombel_id === selectedRombelId && a.subject_id === selectedSubjectId
      );
      if (!isAssigned) {
        return;
      }
    }

    const currentFetchId = ++activeFetchIdRef.current;
    const draftKey = `grades:${selectedRombelId}:${selectedSubjectId}`;
    isUserEditingRef.current = false;

    try {
      setLoading(true);
      setError(null);

      // Periksa draf lokal di IndexedDB terlebih dahulu
      const localDraft = await getDraft<{
        studentsGrades: LocalStudentGrade[];
        tps: LearningObjective[];
        savedAt: number;
      }>(draftKey);

      let res: GradeSheetResponse | null = null;
      try {
        res = await gradeService.getGradeSheet(
          selectedRombelId,
          selectedSubjectId
        );
      } catch (fetchErr: any) {
        // Jika fetch ke server gagal (offline atau gangguan jaringan)
        if (localDraft && localDraft.studentsGrades && localDraft.studentsGrades.length > 0) {
          if (currentFetchId !== activeFetchIdRef.current) return;
          setTps(localDraft.tps || []);
          setStudentsGrades(localDraft.studentsGrades);
          setHasUnsavedDraft(true);
          setLastDraftSavedAt(new Date(localDraft.savedAt));
          setDraftFound(null);
          setSuccessMessage(
            `Mode Offline: Menampilkan draf nilai lokal komputer Anda (tersimpan ${new Date(localDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`
          );
          setLoading(false);
          return;
        }
        throw fetchErr;
      }

      // Discard response if a newer request has already been initiated
      if (currentFetchId !== activeFetchIdRef.current) {
        return;
      }

      setTps(res.learning_objectives || []);

      const mapped: LocalStudentGrade[] = (res.students || []).map((st) => {
        const tpMap: Record<string, number> = {};
        // Initialize all defined subject TPs as 0 (unchecked)
        (res.learning_objectives || []).forEach((tp) => {
          tpMap[tp.id] = 0;
        });
        // Override with any existing saved scores
        st.tp_scores.forEach((item) => {
          tpMap[item.learning_objective_id] = item.nilai;
        });

        return {
          student_id: st.student_id,
          student_name: st.student_name,
          nisn: st.nisn,
          nis: st.nis,
          grade_id: st.grade_id,
          tp_scores: tpMap,
          nilai_akhir: st.nilai_akhir || 0,
          deskripsi_capaian: st.deskripsi_capaian || '',
        };
      });

      // Jika ada local draft yang tersimpan dari sesi sebelumnya yang belum disinkronkan ke server:
      if (localDraft && localDraft.studentsGrades && localDraft.studentsGrades.length > 0) {
        setDraftFound(localDraft);
      } else {
        setDraftFound(null);
      }

      setStudentsGrades(mapped);
      setHasUnsavedDraft(false);
    } catch (err: any) {
      if (currentFetchId !== activeFetchIdRef.current) {
        return;
      }
      setError(err.message || 'Gagal mengambil data penilaian');
    } finally {
      if (currentFetchId === activeFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedRombelId, selectedSubjectId, isAdmin, assignments]);

  useEffect(() => {
    fetchGradeSheet();
  }, [fetchGradeSheet]);

  // Handle toggling TP achievement (1 = Tercapai, 0 = Belum)
  const handleToggleTp = (studentId: string, tpId: string) => {
    isUserEditingRef.current = true;
    setStudentsGrades((prev) =>
      prev.map((student) => {
        if (student.student_id !== studentId) return student;
        const currentVal = student.tp_scores[tpId] || 0;
        const newVal = currentVal >= 1 ? 0 : 1;
        return {
          ...student,
          tp_scores: {
            ...student.tp_scores,
            [tpId]: newVal,
          },
        };
      })
    );
  };

  // Toggle all students for a specific TP column
  const handleToggleAllForTp = (tpId: string) => {
    isUserEditingRef.current = true;
    setStudentsGrades((prev) => {
      const allChecked = prev.length > 0 && prev.every((s) => (s.tp_scores[tpId] || 0) >= 1);
      const targetVal = allChecked ? 0 : 1;
      return prev.map((s) => ({
        ...s,
        tp_scores: {
          ...s.tp_scores,
          [tpId]: targetVal,
        },
      }));
    });
  };

  // Toggle all TPs for a specific student row
  const handleToggleAllForStudent = (studentId: string) => {
    isUserEditingRef.current = true;
    setStudentsGrades((prev) =>
      prev.map((s) => {
        if (s.student_id !== studentId) return s;
        const allChecked = tps.length > 0 && tps.every((tp) => (s.tp_scores[tp.id] || 0) >= 1);
        const targetVal = allChecked ? 0 : 1;
        const newScores: Record<string, number> = { ...s.tp_scores };
        tps.forEach((tp) => {
          newScores[tp.id] = targetVal;
        });
        return {
          ...s,
          tp_scores: newScores,
        };
      })
    );
  };

  // Handle Nilai Akhir input change (0-100)
  const handleNilaiAkhirChange = (studentId: string, valueStr: string) => {
    isUserEditingRef.current = true;
    let val = parseFloat(valueStr);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 100) val = 100;

    setStudentsGrades((prev) =>
      prev.map((student) => (student.student_id === studentId ? { ...student, nilai_akhir: val } : student))
    );
  };

  // Handle manual edit of description
  const handleDescriptionChange = (studentId: string, desc: string) => {
    isUserEditingRef.current = true;
    setStudentsGrades((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, deskripsi_capaian: desc } : s))
    );
  };

  // Generate automated Kurikulum Merdeka descriptions (Offline & Online capable)
  const handleGenerateDescriptions = async () => {
    if (!selectedSubjectId || studentsGrades.length === 0 || tps.length === 0) return;

    try {
      setGenerating(true);
      setError(null);
      isUserEditingRef.current = true;

      if (!isOnline) {
        // Mode Offline: gunakan local description generator bawaan
        setStudentsGrades((prev) =>
          prev.map((student) => ({
            ...student,
            deskripsi_capaian: generateLocalDeskripsiCapaian(student, tps),
          }))
        );
        setSuccessMessage('Deskripsi capaian kompetensi dibuat otomatis (Engine Lokal Offline).');
        setTimeout(() => setSuccessMessage(null), 4000);
        return;
      }

      try {
        const payload = studentsGrades.map((s) => ({
          student_id: s.student_id,
          nilai_akhir: s.nilai_akhir,
          tp_scores: tps.map((tp) => ({
            learning_objective_id: tp.id,
            nilai: s.tp_scores[tp.id] ?? 0,
          })),
        }));

        const res = await gradeService.generateAutoDescriptions(selectedSubjectId, payload);

        const resultMap = new Map<string, { nilai_akhir: number; deskripsi_capaian: string }>();
        res.results.forEach((r) => resultMap.set(r.student_id, r));

        setStudentsGrades((prev) =>
          prev.map((student) => {
            const item = resultMap.get(student.student_id);
            let desc = item?.deskripsi_capaian;
            if (!desc || desc.includes('Belum ada penilaian tujuan pembelajaran')) {
              desc = generateLocalDeskripsiCapaian(student, tps);
            }
            return {
              ...student,
              deskripsi_capaian: desc,
            };
          })
        );

        setSuccessMessage('Deskripsi capaian kompetensi berhasil dibuat secara otomatis!');
        setTimeout(() => setSuccessMessage(null), 4000);
      } catch {
        // Fallback ke generator lokal jika server gagal merespons
        setStudentsGrades((prev) =>
          prev.map((student) => ({
            ...student,
            deskripsi_capaian: generateLocalDeskripsiCapaian(student, tps),
          }))
        );
        setSuccessMessage('Deskripsi capaian dibuat otomatis menggunakan format lokal.');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal membuat deskripsi capaian otomatis');
    } finally {
      setGenerating(false);
    }
  };

  // Apply Bulk Nilai Akhir to all or empty students
  const handleApplyBulkScore = (e: React.FormEvent) => {
    e.preventDefault();
    isUserEditingRef.current = true;
    let val = parseFloat(bulkScore);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 100) val = 100;

    let updatedCount = 0;
    setStudentsGrades((prev) =>
      prev.map((student) => {
        if (bulkTarget === 'empty' && student.nilai_akhir > 0) {
          return student;
        }
        updatedCount++;
        return {
          ...student,
          nilai_akhir: val,
        };
      })
    );

    setIsBulkOpen(false);
    setSuccessMessage(`Berhasil mengisi Nilai Akhir (${val}) untuk ${updatedCount} siswa!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Save all grades (with zero data loss & offline outbox fallback)
  const handleSaveGrades = async () => {
    if (!selectedRombelId || !selectedSubjectId || studentsGrades.length === 0) return;

    const draftKey = `grades:${selectedRombelId}:${selectedSubjectId}`;
    const payload = {
      rombel_id: selectedRombelId,
      subject_id: selectedSubjectId,
      grades: studentsGrades.map((s) => ({
        student_id: s.student_id,
        nilai_akhir: s.nilai_akhir,
        deskripsi_capaian: s.deskripsi_capaian,
        tp_scores: tps.map((tp) => ({
          learning_objective_id: tp.id,
          nilai: s.tp_scores[tp.id] ?? 0,
        })),
      })),
    };

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      if (!isOnline) {
        // Mode Offline: Enqueue langsung ke Outbox
        await enqueueOutbox({
          action: 'SAVE_GRADES',
          endpoint: '/grades/batch',
          method: 'POST',
          payload,
        });

        await saveDraft(
          draftKey,
          'grades',
          {
            studentsGrades,
            tps,
            savedAt: Date.now(),
          },
          {
            rombelId: selectedRombelId,
            subjectId: selectedSubjectId,
            teacherId: user?.id,
          }
        );

        setHasUnsavedDraft(false);
        setDraftFound(null);
        isUserEditingRef.current = false;
        setSuccessMessage(
          `Data nilai ${studentsGrades.length} siswa berhasil disimpan ke komputer lokal (Offline). Nilai akan otomatis dikirim saat terhubung kembali.`
        );
        outboxWorker.notifyQueueChanged();
        return;
      }

      // Mode Online: Coba simpan ke server
      try {
        const res = await gradeService.batchSaveGrades(payload);
        setSuccessMessage(`Berhasil menyimpan nilai ${res.saved_count} siswa!`);
        setTimeout(() => setSuccessMessage(null), 5000);

        // Hapus draf karena data sudah permanen di server
        await deleteDraft(draftKey);
        setHasUnsavedDraft(false);
        setDraftFound(null);
        isUserEditingRef.current = false;

        fetchGradeSheet();
      } catch (serverErr: any) {
        // Jika server mati mendadak / timeout saat submit:
        console.warn('Gagal simpan ke server, beralih ke antrean offline:', serverErr);

        await enqueueOutbox({
          action: 'SAVE_GRADES',
          endpoint: '/grades/batch',
          method: 'POST',
          payload,
        });

        await saveDraft(
          draftKey,
          'grades',
          {
            studentsGrades,
            tps,
            savedAt: Date.now(),
          },
          {
            rombelId: selectedRombelId,
            subjectId: selectedSubjectId,
            teacherId: user?.id,
          }
        );

        setHasUnsavedDraft(false);
        setDraftFound(null);
        isUserEditingRef.current = false;
        setSuccessMessage(
          'Koneksi server terganggu saat mengirim. Data nilai telah diamankan ke antrean offline komputer Anda dan akan otomatis disinkronkan.'
        );
        outboxWorker.notifyQueueChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan nilai');
    } finally {
      setSaving(false);
    }
  };

  // Class KPI calculations
  const classStats = useMemo(() => {
    const validAverages = studentsGrades
      .map((s) => s.nilai_akhir)
      .filter((v) => v > 0);

    if (validAverages.length === 0) {
      return { avg: 0, max: 0, min: 0, completedCount: 0 };
    }

    const sum = validAverages.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round((sum / validAverages.length) * 100) / 100,
      max: Math.max(...validAverages),
      min: Math.min(...validAverages),
      completedCount: validAverages.length,
    };
  }, [studentsGrades]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentsGrades;
    const q = searchQuery.toLowerCase();
    return studentsGrades.filter(
      (s) => s.student_name.toLowerCase().includes(q) || s.nisn?.includes(q)
    );
  }, [studentsGrades, searchQuery]);

  if (isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-m3-surface rounded-3xl border border-m3-outline-variant/30 mt-8">
        <div className="w-12 h-12 rounded-2xl bg-m3-primary-container text-m3-primary flex items-center justify-center mx-auto">
          <Award className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-m3-on-surface">Fitur Khusus Guru Pengampu</h2>
        <p className="text-xs text-m3-on-surface-variant leading-relaxed">
          Input nilai formatif dan sumatif per Tujuan Pembelajaran dilakukan langsung oleh Guru mata pelajaran terkait. Administrator dapat memantau hasil pengisian nilai melalui menu Rekap Nilai Siswa atau Cetak Rapor.
        </p>
        <div className="pt-2">
          <Link to="/grades/recap">
            <M3Button variant="filled">Buka Rekap Nilai Siswa</M3Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-m3-on-surface">
              Input Nilai Mata Pelajaran
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-m3-secondary-container text-m3-on-secondary-container border border-m3-secondary/20">
              Kurikulum Merdeka • Centang TP & Nilai Akhir
            </span>

            {/* Offline & Connection Status Indicator */}
            {!isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Mode Offline (Penyimpanan Lokal Aktif)</span>
              </span>
            ) : unsyncedCount > 0 ? (
              <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30">
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{unsyncedCount} data antrean offline</span>
                <button
                  type="button"
                  onClick={() => triggerSync()}
                  disabled={isSyncing}
                  className="underline hover:text-blue-950 dark:hover:text-blue-200 font-bold cursor-pointer"
                >
                  {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Server Terhubung</span>
              </span>
            )}

            {hasUnsavedDraft && lastDraftSavedAt && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs text-m3-on-surface-variant bg-m3-surface-container border border-m3-outline-variant/40">
                <Database className="w-3.5 h-3.5 text-m3-primary" />
                <span>Draf tersimpan ({lastDraftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})</span>
              </span>
            )}
          </div>
          <p className="text-sm text-m3-on-surface-variant mt-1">
            Tandai ketercapaian Tujuan Pembelajaran (TP: Tercapai / Belum) per peserta didik dan input Nilai Akhir untuk menyusun deskripsi capaian rapor.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link to={selectedSubjectId ? `/learning-objectives?subjectId=${selectedSubjectId}` : '/learning-objectives'}>
            <M3Button
              variant="outlined"
              icon={<Target className="w-4 h-4" />}
              title="Atur Capaian & Tujuan Pembelajaran (TP) mata pelajaran ini"
            >
              Kelola TP ({tps.length})
            </M3Button>
          </Link>

          <M3Button
            variant="tonal"
            onClick={() => setIsBulkOpen(true)}
            disabled={loading || studentsGrades.length === 0}
            icon={<SlidersHorizontal className="w-4 h-4" />}
            title="Isi Nilai Akhir serentak untuk siswa di kelas ini"
          >
            Isi Nilai Massal
          </M3Button>

          <M3Button
            variant="tonal"
            onClick={handleGenerateDescriptions}
            disabled={generating || loading || tps.length === 0}
            icon={<Wand2 className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />}
            title="Generate deskripsi otomatis berdasarkan ketercapaian TP"
          >
            {generating ? 'Menghasilkan...' : 'Auto Deskripsi Capaian'}
          </M3Button>

          <M3Button
            variant="filled"
            onClick={handleSaveGrades}
            disabled={saving || loading || studentsGrades.length === 0}
            icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {saving ? 'Menyimpan...' : 'Simpan Semua Nilai'}
          </M3Button>
        </div>
      </div>

      {/* Draft Recovery Banner */}
      {draftFound && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start sm:items-center gap-2.5">
            <Database className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-200">
                Ditemukan draf nilai lokal yang belum disimpan ke server
              </p>
              <p className="text-amber-900/90 dark:text-amber-300/90 mt-0.5">
                Tersimpan di komputer ini pada {new Date(draftFound.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. Pulihkan draf untuk melanjutkan perubahan yang belum sempat terkirim.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                isUserEditingRef.current = true;
                setStudentsGrades(draftFound.studentsGrades);
                if (draftFound.tps && draftFound.tps.length > 0) {
                  setTps(draftFound.tps);
                }
                setHasUnsavedDraft(true);
                setLastDraftSavedAt(new Date(draftFound.savedAt));
                setDraftFound(null);
                setSuccessMessage('Draf nilai lokal berhasil dipulihkan!');
                setTimeout(() => setSuccessMessage(null), 4000);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-sm"
            >
              Pulihkan Draf
            </button>
            <button
              type="button"
              onClick={async () => {
                const draftKey = `grades:${selectedRombelId}:${selectedSubjectId}`;
                await deleteDraft(draftKey);
                setDraftFound(null);
                setHasUnsavedDraft(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 font-semibold text-xs transition cursor-pointer"
            >
              Abaikan & Hapus
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-m3-error-container text-m3-on-error-container border border-m3-error/20 text-xs flex items-center justify-between animate-fadeIn"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-m3-error shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold hover:underline cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs flex items-center justify-between animate-fadeIn"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold hover:underline cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Alert if teacher has no assigned classes */}
      {!loading && availableRombels.length === 0 && (
        <div className="p-5 rounded-3xl bg-amber-50/90 border border-amber-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Belum Ada Penugasan Mengajar
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Akun Anda belum memiliki rombongan belajar (kelas) yang diampu. Silakan hubungi Administrator Kurikulum untuk menambahkan penugasan mengajar Anda.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Control Selection Card */}
      <M3Card variant="filled" className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* Searchable Rombel Selector */}
          <div>
            <SearchableRombelSelect
              label="Rombongan Belajar (Kelas)"
              rombels={availableRombels}
              selectedRombelId={selectedRombelId}
              onSelect={handleRombelChange}
              filterEmpty={true}
              disabled={availableRombels.length === 0}
              placeholder={availableRombels.length === 0 ? 'Belum ada kelas diampu' : 'Pilih Rombongan Belajar'}
            />
          </div>

          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              disabled={availableSubjects.length === 0}
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline text-xs sm:text-sm font-semibold text-m3-on-surface focus:outline-none focus:border-m3-primary min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {availableSubjects.length === 0 ? (
                <option value="">Tidak ada mata pelajaran</option>
              ) : (
                availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.kelompok})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Quick Search */}
          <div className="lg:col-span-2">
            <M3TextField
              label="Cari Nama / NISN Siswa"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik nama siswa untuk menyaring..."
              leadingIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </M3Card>

      {/* Warning if no TPs exist */}
      {!loading && availableRombels.length > 0 && selectedRombelId && selectedSubjectId && tps.length === 0 && (
        <div className="p-6 rounded-3xl bg-amber-50/80 border border-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Tujuan Pembelajaran (TP) Belum Dikonfigurasi
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Mata pelajaran ini belum memiliki Tujuan Pembelajaran. Input TP terlebih dahulu agar kolom asesmen nilai formatif & sumatif aktif.
              </p>
            </div>
          </div>
          <Link to={`/learning-objectives?subjectId=${selectedSubjectId}`}>
            <M3Button variant="filled" size="sm" icon={<Target className="w-3.5 h-3.5" />}>
              Input CP & TP Sekarang
            </M3Button>
          </Link>
        </div>
      )}

      {/* KPI Stats Bar */}
      {tps.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <M3Card variant="elevated" className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">Siswa Dinilai</p>
              <p className="text-sm font-black text-m3-on-surface">
                {classStats.completedCount} / {studentsGrades.length}
              </p>
            </div>
          </M3Card>

          <M3Card variant="elevated" className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">Rata-rata Kelas</p>
              <p className="text-sm font-black text-emerald-700">
                {classStats.avg > 0 ? classStats.avg : '-'}
              </p>
            </div>
          </M3Card>

          <M3Card variant="elevated" className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-m3-primary-container flex items-center justify-center text-m3-primary shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">Nilai Tertinggi</p>
              <p className="text-sm font-black text-m3-primary">
                {classStats.max > 0 ? classStats.max : '-'}
              </p>
            </div>
          </M3Card>

          <M3Card variant="elevated" className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">Jumlah TP</p>
              <p className="text-sm font-black text-m3-on-surface">{tps.length} TP</p>
            </div>
          </M3Card>
        </div>
      )}

      {/* Main Grade Input Table */}
      <M3Card variant="elevated" className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-m3-surface-container/60 border-b border-m3-outline-variant/30 text-m3-on-surface font-bold">
                <th className="py-3.5 px-3 w-12 text-center">No</th>
                <th className="py-3.5 px-4 min-w-[200px]">Nama Peserta Didik</th>
                {tps.map((tp) => {
                  const allChecked =
                    filteredStudents.length > 0 &&
                    filteredStudents.every((s) => (s.tp_scores[tp.id] || 0) >= 1);
                  return (
                    <th
                      key={tp.id}
                      className="py-3 px-2 min-w-[105px] text-center border-l border-m3-outline-variant/30 relative group select-none"
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div
                          className="flex items-center gap-1 cursor-pointer"
                          onMouseEnter={() => setActiveTooltip(tp.id)}
                          onMouseLeave={() => setActiveTooltip(null)}
                        >
                          <span className="font-bold text-xs">{tp.kode_tp}</span>
                          <HelpCircle className="w-3.5 h-3.5 text-m3-outline group-hover:text-m3-primary" />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleAllForTp(tp.id)}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer border ${
                            allChecked
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                              : 'bg-m3-surface text-m3-on-surface-variant border-m3-outline-variant/50 hover:bg-m3-surface-container hover:text-m3-primary'
                          }`}
                          title={allChecked ? 'Batalkan semua centang untuk TP ini' : 'Centang semua siswa untuk TP ini'}
                        >
                          {allChecked ? 'Semua ✓' : 'Centang Semua'}
                        </button>
                      </div>

                      {/* Tooltip */}
                      {activeTooltip === tp.id && (
                        <div
                          className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3.5 rounded-xl text-left pointer-events-none shadow-2xl border"
                          style={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            color: '#f8fafc',
                            opacity: 1,
                          }}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                            <span>{tp.kode_tp}</span>
                          </div>
                          <p className="text-slate-200 text-[11px] leading-relaxed font-normal">{tp.deskripsi}</p>
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="py-3 px-2 w-32 text-center border-l border-m3-outline-variant/30 select-none">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="font-bold text-xs">Nilai Akhir (NA)</span>
                    <button
                      type="button"
                      onClick={() => setIsBulkOpen(true)}
                      disabled={filteredStudents.length === 0}
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-m3-surface text-m3-primary border border-m3-outline-variant/50 hover:bg-m3-surface-container transition-all cursor-pointer"
                      title="Isi nilai akhir serentak untuk siswa"
                    >
                      Isi Massal
                    </button>
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[320px] border-l border-m3-outline-variant/30">
                  Deskripsi Capaian Kompetensi (Kurikulum Merdeka)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant/20 bg-m3-surface">
              {loading ? (
                <tr>
                  <td colSpan={4 + tps.length} className="py-12 text-center text-m3-on-surface-variant font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-m3-primary" />
                      <span>Memuat data penilaian rombel...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4 + tps.length} className="py-10 text-center text-m3-on-surface-variant font-medium">
                    {availableRombels.length === 0
                      ? 'Belum ada kelas yang diampu. Silakan hubungi admin kurikulum.'
                      : 'Tidak ada siswa ditemukan di rombel ini.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => (
                  <tr
                    key={st.student_id}
                    className="hover:bg-m3-surface-container/30 transition-colors group"
                  >
                    <td className="py-3.5 px-3 text-center text-m3-outline font-medium">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-m3-on-surface truncate">{st.student_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-m3-outline font-mono">NISN: {st.nisn || '-'}</span>
                        {tps.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleToggleAllForStudent(st.student_id)}
                            className="text-[10px] text-m3-primary hover:underline font-semibold cursor-pointer"
                            title="Centang / batalkan semua TP untuk siswa ini"
                          >
                            Tandai Semua
                          </button>
                        )}
                      </div>
                    </td>

                    {/* TP Checkmarks */}
                    {tps.map((tp) => {
                      const isChecked = (st.tp_scores[tp.id] || 0) >= 1;
                      return (
                        <td key={tp.id} className="py-2 px-2 text-center border-l border-m3-outline-variant/20">
                          <button
                            type="button"
                            onClick={() => handleToggleTp(st.student_id, tp.id)}
                            aria-label={`${st.student_name}: ${tp.kode_tp} ${isChecked ? 'Tercapai' : 'Belum Tercapai'}`}
                            title={`${tp.kode_tp}: ${isChecked ? 'Sudah Tercapai (Klik untuk batalkan)' : 'Belum Tercapai (Klik untuk centang)'}`}
                            className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[40px] min-w-[76px] cursor-pointer border ${
                              isChecked
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs ring-1 ring-emerald-400/30'
                                : 'bg-m3-surface text-m3-on-surface-variant/70 border-m3-outline-variant/60 hover:bg-m3-surface-container hover:text-m3-on-surface'
                            }`}
                          >
                            {isChecked ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                                <span className="text-[11px]">Tercapai</span>
                              </>
                            ) : (
                              <>
                                <span className="w-3.5 h-3.5 rounded border border-m3-outline/40 flex items-center justify-center shrink-0" />
                                <span className="text-[11px] text-m3-on-surface-variant/80">Belum</span>
                              </>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Nilai Akhir (Input Angka 0 - 100) */}
                    <td className="py-2.5 px-3 text-center border-l border-m3-outline-variant/20">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={st.nilai_akhir > 0 ? st.nilai_akhir : ''}
                          onChange={(e) => handleNilaiAkhirChange(st.student_id, e.target.value)}
                          placeholder="0"
                          title="Input Nilai Akhir Rapor (0-100)"
                          className="w-16 px-2.5 py-2 text-center font-black text-xs rounded-xl border border-m3-outline bg-m3-surface focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary text-m3-on-surface min-h-[40px]"
                        />
                        {st.nilai_akhir > 0 && (
                          <span
                            className={`hidden xl:inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                              st.nilai_akhir >= 85
                                ? 'bg-emerald-100 text-emerald-950'
                                : st.nilai_akhir >= 75
                                ? 'bg-blue-100 text-blue-950'
                                : 'bg-amber-100 text-amber-950'
                            }`}
                          >
                            {st.nilai_akhir >= 85 ? 'A' : st.nilai_akhir >= 75 ? 'B' : 'C'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Deskripsi Capaian Textarea */}
                    <td className="py-2 px-3 border-l border-m3-outline-variant/20">
                      <textarea
                        rows={2}
                        value={st.deskripsi_capaian}
                        onChange={(e) => handleDescriptionChange(st.student_id, e.target.value)}
                        placeholder="Deskripsi capaian kompetensi siswa (isi manual atau gunakan tombol Auto Deskripsi)..."
                        className="w-full px-3 py-2 text-xs leading-relaxed rounded-xl border border-m3-outline bg-m3-surface focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary text-m3-on-surface"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </M3Card>

      {/* Dialog Isi Nilai Akhir Massal */}
      <M3Dialog
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        title="Isi Nilai Akhir Massal"
        icon={<SlidersHorizontal className="w-5 h-5 text-m3-primary" />}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleApplyBulkScore} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-m3-surface-container border border-m3-outline-variant/30 text-xs text-m3-on-surface-variant leading-relaxed">
            Isi angka Nilai Akhir (0–100) serentak untuk rombel ini. Anda tetap dapat mengedit nilai siswa secara individual setelahnya.
          </div>

          <div>
            <label className="block text-xs font-bold text-m3-on-surface mb-1.5">
              Nilai Akhir (0–100)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              required
              autoFocus
              value={bulkScore}
              onChange={(e) => setBulkScore(e.target.value)}
              placeholder="Contoh: 85"
              className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface text-sm font-bold focus:outline-none focus:border-m3-primary min-h-[44px]"
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[11px] text-m3-on-surface-variant mr-1">Nilai Cepat:</span>
              {['75', '80', '85', '90'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBulkScore(preset)}
                  className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all border cursor-pointer ${
                    bulkScore === preset
                      ? 'bg-m3-primary text-m3-on-primary border-m3-primary shadow-xs'
                      : 'bg-m3-surface text-m3-on-surface-variant border-m3-outline-variant hover:bg-m3-surface-container'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-m3-outline-variant/30">
            <label className="block text-xs font-bold text-m3-on-surface">
              Target Pengisian
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-m3-outline-variant/40 hover:bg-m3-surface-container/50 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="bulkTarget"
                  value="all"
                  checked={bulkTarget === 'all'}
                  onChange={() => setBulkTarget('all')}
                  className="accent-m3-primary"
                />
                <div>
                  <span className="font-bold text-m3-on-surface block">
                    Semua Siswa ({studentsGrades.length} siswa)
                  </span>
                  <span className="text-[10px] text-m3-on-surface-variant">
                    Mengisi dan menimpa nilai seluruh siswa di kelas ini
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-m3-outline-variant/40 hover:bg-m3-surface-container/50 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="bulkTarget"
                  value="empty"
                  checked={bulkTarget === 'empty'}
                  onChange={() => setBulkTarget('empty')}
                  className="accent-m3-primary"
                />
                <div>
                  <span className="font-bold text-m3-on-surface block">
                    Hanya Siswa yang Masih Kosong ({studentsGrades.filter((s) => s.nilai_akhir === 0).length} siswa)
                  </span>
                  <span className="text-[10px] text-m3-on-surface-variant">
                    Hanya mengisi siswa yang nilai akhirnya masih 0
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2">
            <M3Button variant="text" type="button" onClick={() => setIsBulkOpen(false)}>
              Batal
            </M3Button>
            <M3Button variant="filled" type="submit">
              Terapkan Nilai
            </M3Button>
          </div>
        </form>
      </M3Dialog>
    </div>
  );
};
