import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  Users,
  UserCheck,
  UserPlus,
  KeyRound,
  Shield,
  Search,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Layers,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Info,
  X,
  Clock,
  Phone,
} from 'lucide-react';
import { masterService } from '../services/master.service';
import { TeacherItem, Rombel, Subject, TeachingAssignment } from '../types';
import { Modal } from '../components/Modal';
import { M3Button, M3Card, M3Chip, M3TextField, M3Dialog } from '../components/m3';
import { PaginationBar } from '../components/common/PaginationBar';
import { SearchableRombelSelect } from '../components/common/SearchableRombelSelect';
import { SearchableTeacherSelect } from '../components/common/SearchableTeacherSelect';
import { SearchableSubjectSelect } from '../components/common/SearchableSubjectSelect';

type ActiveTab = 'teachers' | 'assignments' | 'rombels';

export const TeacherManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('teachers');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Core Data
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [rombels, setRombels] = useState<Rombel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);

  // Hanya rombel yang memiliki siswa (> 0) untuk filter dan penugasan
  const activeRombels = useMemo(() => {
    return rombels.filter((r) => (r.student_count || 0) > 0);
  }, [rombels]);

  // Rombel binaan valid: jika guru mengampu >= 2 rombel, prioritaskan rombel dengan siswa
  const getTeacherWaliRombels = useCallback(
    (teacher: TeacherItem): Rombel[] => {
      if (teacher.wali_rombels && teacher.wali_rombels.length > 0) {
        return teacher.wali_rombels;
      }
      if (teacher.wali_rombel) {
        return [teacher.wali_rombel];
      }
      const matched = rombels.filter((r) => r.wali_kelas_id === teacher.id);
      if (matched.length > 1) {
        const withStudents = matched.filter((r) => (r.student_count || 0) > 0);
        if (withStudents.length > 0) return withStudents;
      }
      return matched;
    },
    [rombels]
  );

  // Search & Filters for Teachers Tab
  const [teacherSearch, setTeacherSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'guru' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [waliFilter, setWaliFilter] = useState<'all' | 'wali' | 'non_wali'>('all');
  const [teacherPage, setTeacherPage] = useState(1);
  const [teacherPageSize, setTeacherPageSize] = useState(10);

  // Filters for Assignments Tab
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentRombelFilter, setAssignmentRombelFilter] = useState<string>('all');
  const [assignmentTeacherFilter, setAssignmentTeacherFilter] = useState<string>('all');
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentPageSize, setAssignmentPageSize] = useState(10);

  // Filters for Rombels Tab
  const [rombelSearch, setRombelSearch] = useState('');
  const [rombelTingkatFilter, setRombelTingkatFilter] = useState<string>('all');
  const [rombelWaliFilter, setRombelWaliFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [rombelPage, setRombelPage] = useState(1);
  const [rombelPageSize, setRombelPageSize] = useState(12);

  // Status message / toast banner
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Copy indicator for password modal
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Modals state
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isEditTeacherOpen, setIsEditTeacherOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isAssignWaliOpen, setIsAssignWaliOpen] = useState(false);
  const [isDeleteTeacherOpen, setIsDeleteTeacherOpen] = useState(false);
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false);
  const [isDeleteAssignmentOpen, setIsDeleteAssignmentOpen] = useState(false);
  const [isAddRombelOpen, setIsAddRombelOpen] = useState(false);

  // Target object state for modals
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherItem | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<TeachingAssignment | null>(null);

  // Form states: Add Teacher
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherNip, setNewTeacherNip] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPhone, setNewTeacherPhone] = useState('');
  const [newTeacherRole, setNewTeacherRole] = useState<'guru' | 'admin'>('guru');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');

  // Form states: Edit Teacher
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherNip, setEditTeacherNip] = useState('');
  const [editTeacherEmail, setEditTeacherEmail] = useState('');
  const [editTeacherPhone, setEditTeacherPhone] = useState('');
  const [editTeacherRole, setEditTeacherRole] = useState<'guru' | 'admin'>('guru');
  const [editTeacherIsActive, setEditTeacherIsActive] = useState(true);

  // Form states: Reset Password
  const [resetUseCustom, setResetUseCustom] = useState(false);
  const [customNewPassword, setCustomNewPassword] = useState('');
  const [resetResultPassword, setResetResultPassword] = useState<string | null>(null);

  // Form states: Assign Wali Kelas
  const [assignRombelId, setAssignRombelId] = useState('');
  const [assignGuruId, setAssignGuruId] = useState('');

  // Form states: Add Assignment
  const [assignFormGuruId, setAssignFormGuruId] = useState('');
  const [assignFormSubjectId, setAssignFormSubjectId] = useState('');
  const [assignFormRombelId, setAssignFormRombelId] = useState('');
  const [assignFormJam, setAssignFormJam] = useState<number | string>('');

  // Form states: Add Rombel
  const [newRombelName, setNewRombelName] = useState('');
  const [newRombelTingkat, setNewRombelTingkat] = useState<number>(10);
  const [newRombelWaliId, setNewRombelWaliId] = useState('');

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAllData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [tRes, rRes, sRes, aRes] = await Promise.all([
        masterService.getTeachers(),
        masterService.getRombels(),
        masterService.getSubjects(),
        masterService.getTeachingAssignments(),
      ]);

      setTeachers(tRes.teachers || []);
      setRombels(rRes.rombels || []);
      setSubjects(sRes.subjects || []);
      setAssignments(aRes.assignments || []);
    } catch (err: any) {
      console.error(err);
      setStatusBanner({
        type: 'error',
        message: err.response?.data?.message || 'Gagal memuat data master guru dan penugasan.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showBanner = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => {
      setStatusBanner(null);
    }, 6000);
  };

  // -------------------------------------------------------------
  // Teachers Tab Handlers
  // -------------------------------------------------------------

  const handleOpenAddTeacher = () => {
    setNewTeacherName('');
    setNewTeacherNip('');
    setNewTeacherEmail('');
    setNewTeacherPhone('');
    setNewTeacherRole('guru');
    setNewTeacherPassword('');
    setIsAddTeacherOpen(true);
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await masterService.createTeacher({
        name: newTeacherName.trim(),
        nip_nik: newTeacherNip.trim() || undefined,
        email: newTeacherEmail.trim() || undefined,
        phone: newTeacherPhone.trim() || undefined,
        role: newTeacherRole,
        password: newTeacherPassword.trim() || undefined,
      });

      setIsAddTeacherOpen(false);
      showBanner('success', res.message || 'Guru baru berhasil ditambahkan.');
      await loadAllData(true);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal menambahkan guru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditTeacher = (teacher: TeacherItem) => {
    setSelectedTeacher(teacher);
    setEditTeacherName(teacher.name);
    setEditTeacherNip(teacher.nip_nik || '');
    setEditTeacherEmail(teacher.email || '');
    setEditTeacherPhone(teacher.phone || '');
    setEditTeacherRole(teacher.role as 'guru' | 'admin');
    setEditTeacherIsActive(teacher.is_active !== false);
    setIsEditTeacherOpen(true);
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !editTeacherName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await masterService.updateTeacher(selectedTeacher.id, {
        name: editTeacherName.trim(),
        nip_nik: editTeacherNip.trim() || undefined,
        email: editTeacherEmail.trim() || undefined,
        phone: editTeacherPhone.trim() || undefined,
        role: editTeacherRole,
        is_active: editTeacherIsActive,
      });

      setIsEditTeacherOpen(false);
      showBanner('success', res.message || 'Data guru berhasil diperbarui.');
      await loadAllData(true);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal memperbarui data guru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenResetPassword = (teacher: TeacherItem) => {
    setSelectedTeacher(teacher);
    setResetUseCustom(false);
    setCustomNewPassword('');
    setResetResultPassword(null);
    setCopiedPassword(false);
    setIsResetPasswordOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    setIsSubmitting(true);
    try {
      const res = await masterService.resetTeacherPassword(
        selectedTeacher.id,
        resetUseCustom && customNewPassword.trim() ? customNewPassword.trim() : undefined
      );

      setResetResultPassword(res.new_password);
      showBanner('success', 'Kata sandi berhasil direset.');
      await loadAllData(true);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal mereset kata sandi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeactivateTeacher = (teacher: TeacherItem) => {
    setSelectedTeacher(teacher);
    setIsDeleteTeacherOpen(true);
  };

  const handleConfirmDeactivateTeacher = async () => {
    if (!selectedTeacher) return;

    setIsSubmitting(true);
    try {
      const res = await masterService.deleteTeacher(selectedTeacher.id);
      setIsDeleteTeacherOpen(false);
      showBanner('success', res.message || 'Status guru berhasil dinonaktifkan.');
      await loadAllData(true);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal menonaktifkan guru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Wali Kelas Assignment Handlers
  // -------------------------------------------------------------

  const handleOpenAssignWali = (rombel?: Rombel, teacher?: TeacherItem) => {
    const defaultRombelId = activeRombels[0]?.id || rombels[0]?.id || '';
    if (rombel) {
      setAssignRombelId(rombel.id);
      setAssignGuruId(rombel.wali_kelas_id || '');
    } else if (teacher) {
      setSelectedTeacher(teacher);
      setAssignGuruId(teacher.id);
      const wList = getTeacherWaliRombels(teacher);
      setAssignRombelId(wList[0]?.id || teacher.wali_rombel?.id || defaultRombelId);
    } else {
      setAssignRombelId(defaultRombelId);
      setAssignGuruId(teachers[0]?.id ?? '');
    }
    setIsAssignWaliOpen(true);
  };

  const handleSaveWaliAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignRombelId) return;

    setIsSubmitting(true);
    try {
      const res = await masterService.setWaliKelas(assignRombelId, assignGuruId);
      setIsAssignWaliOpen(false);
      showBanner('success', res.message || 'Wali kelas berhasil diperbarui.');
      await loadAllData(true);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal menetapkan wali kelas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Teaching Assignment Handlers
  // -------------------------------------------------------------

  const handleOpenAddAssignment = () => {
    const defaultRombelId = activeRombels[0]?.id || rombels[0]?.id || '';
    const activeTeacherList = teachers.filter((t) => t.is_active !== false);
    setAssignFormGuruId(activeTeacherList[0]?.id || '');
    setAssignFormSubjectId(subjects[0]?.id || '');
    setAssignFormRombelId(defaultRombelId);
    setAssignFormJam('');
    setIsAddAssignmentOpen(true);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFormGuruId || !assignFormSubjectId || !assignFormRombelId) return;

    setIsSubmitting(true);
    try {
      const jamVal = assignFormJam !== '' ? Number(assignFormJam) : 0;
      const res = await masterService.createTeachingAssignment({
        guru_id: assignFormGuruId,
        subject_id: assignFormSubjectId,
        rombel_id: assignFormRombelId,
        ...(jamVal > 0 ? { jam_per_minggu: jamVal } : {}),
      });

      setIsAddAssignmentOpen(false);
      showBanner('success', res.message || 'Penugasan mengajar berhasil ditambahkan.');
      await loadAllData(true);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal menambahkan penugasan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteAssignment = (assignment: TeachingAssignment) => {
    setSelectedAssignment(assignment);
    setIsDeleteAssignmentOpen(true);
  };

  const handleConfirmDeleteAssignment = async () => {
    if (!selectedAssignment) return;

    setIsSubmitting(true);
    try {
      const res = await masterService.deleteTeachingAssignment(selectedAssignment.id);
      setIsDeleteAssignmentOpen(false);
      showBanner('success', res.message || 'Penugasan mengajar berhasil dihapus.');
      await loadAllData(true);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal menghapus penugasan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Rombel Handlers
  // -------------------------------------------------------------

  const handleOpenAddRombel = () => {
    setNewRombelName('');
    setNewRombelTingkat(10);
    setNewRombelWaliId('');
    setIsAddRombelOpen(true);
  };

  const handleCreateRombel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRombelName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await masterService.createRombel({
        name: newRombelName.trim(),
        tingkat: Number(newRombelTingkat),
        wali_kelas_id: newRombelWaliId || undefined,
      });

      setIsAddRombelOpen(false);
      showBanner('success', res.message || 'Rombongan belajar berhasil ditambahkan.');
      await loadAllData(true);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Gagal menambahkan rombel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Computed Data / Filtering
  // -------------------------------------------------------------

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const search = teacherSearch.toLowerCase();
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search) ||
        (t.nip_nik && t.nip_nik.toLowerCase().includes(search)) ||
        (t.email && t.email.toLowerCase().includes(search));

      const matchRole = roleFilter === 'all' || t.role === roleFilter;

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && t.is_active !== false) ||
        (statusFilter === 'inactive' && t.is_active === false);

      const wList = getTeacherWaliRombels(t);
      const matchWali =
        waliFilter === 'all' ||
        (waliFilter === 'wali' && wList.length > 0) ||
        (waliFilter === 'non_wali' && wList.length === 0);

      return matchSearch && matchRole && matchStatus && matchWali;
    });
  }, [teachers, teacherSearch, roleFilter, statusFilter, waliFilter, getTeacherWaliRombels]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const search = assignmentSearch.toLowerCase();
      const subjectName = a.subject?.nama?.toLowerCase() || '';
      const teacherName = a.guru?.name?.toLowerCase() || '';
      const rombelName = a.rombel?.name?.toLowerCase() || '';

      const matchSearch =
        !search ||
        subjectName.includes(search) ||
        teacherName.includes(search) ||
        rombelName.includes(search);

      const matchRombel =
        assignmentRombelFilter === 'all' || a.rombel_id === assignmentRombelFilter;

      const matchTeacher =
        assignmentTeacherFilter === 'all' || a.guru_id === assignmentTeacherFilter;

      return matchSearch && matchRombel && matchTeacher;
    });
  }, [assignments, assignmentSearch, assignmentRombelFilter, assignmentTeacherFilter]);

  const filteredRombels = useMemo(() => {
    return rombels.filter((r) => {
      const search = rombelSearch.toLowerCase();
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search) ||
        (r.wali_kelas?.name && r.wali_kelas.name.toLowerCase().includes(search));

      const matchTingkat =
        rombelTingkatFilter === 'all' || String(r.tingkat) === rombelTingkatFilter;

      const hasWali = !!r.wali_kelas_id;
      const matchWali =
        rombelWaliFilter === 'all' ||
        (rombelWaliFilter === 'assigned' && hasWali) ||
        (rombelWaliFilter === 'unassigned' && !hasWali);

      return matchSearch && matchTingkat && matchWali;
    });
  }, [rombels, rombelSearch, rombelTingkatFilter, rombelWaliFilter]);

  // Paginated Data
  const paginatedTeachers = useMemo(() => {
    if (teacherPageSize <= 0) return filteredTeachers;
    const start = (teacherPage - 1) * teacherPageSize;
    return filteredTeachers.slice(start, start + teacherPageSize);
  }, [filteredTeachers, teacherPage, teacherPageSize]);

  const teacherTotalPages = useMemo(() => {
    if (teacherPageSize <= 0) return 1;
    return Math.max(1, Math.ceil(filteredTeachers.length / teacherPageSize));
  }, [filteredTeachers.length, teacherPageSize]);

  const paginatedAssignments = useMemo(() => {
    if (assignmentPageSize <= 0) return filteredAssignments;
    const start = (assignmentPage - 1) * assignmentPageSize;
    return filteredAssignments.slice(start, start + assignmentPageSize);
  }, [filteredAssignments, assignmentPage, assignmentPageSize]);

  const assignmentTotalPages = useMemo(() => {
    if (assignmentPageSize <= 0) return 1;
    return Math.max(1, Math.ceil(filteredAssignments.length / assignmentPageSize));
  }, [filteredAssignments.length, assignmentPageSize]);

  const paginatedRombels = useMemo(() => {
    if (rombelPageSize <= 0) return filteredRombels;
    const start = (rombelPage - 1) * rombelPageSize;
    return filteredRombels.slice(start, start + rombelPageSize);
  }, [filteredRombels, rombelPage, rombelPageSize]);

  const rombelTotalPages = useMemo(() => {
    if (rombelPageSize <= 0) return 1;
    return Math.max(1, Math.ceil(filteredRombels.length / rombelPageSize));
  }, [filteredRombels.length, rombelPageSize]);

  // Statistics
  const stats = useMemo(() => {
    const totalTeachers = teachers.length;
    const activeTeachers = teachers.filter((t) => t.is_active !== false).length;
    const manualTeachers = teachers.filter((t) => t.is_manual_override).length;
    const totalRombels = rombels.length;
    const rombelsWithWali = rombels.filter((r) => !!r.wali_kelas_id).length;
    const totalAssignments = assignments.length;
    const totalHours = assignments.reduce((acc, a) => acc + (a.jam_per_minggu || 0), 0);

    return {
      totalTeachers,
      activeTeachers,
      manualTeachers,
      totalRombels,
      rombelsWithWali,
      totalAssignments,
      totalHours,
    };
  }, [teachers, rombels, assignments]);

  const getInitials = (name?: string) => {
    if (!name) return 'GT';
    return name
      .replace(/^(Dra\.|Drs\.|Dr\.|Hj\.|H\.|Prof\.)\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'GT';
  };

  // Filter Active Check & Reset Helpers
  const isTeacherFiltered =
    teacherSearch !== '' || roleFilter !== 'all' || statusFilter !== 'all' || waliFilter !== 'all';
  const handleResetTeacherFilters = () => {
    setTeacherSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
    setWaliFilter('all');
    setTeacherPage(1);
  };

  const isAssignmentFiltered =
    assignmentSearch !== '' ||
    assignmentRombelFilter !== 'all' ||
    assignmentTeacherFilter !== 'all';
  const handleResetAssignmentFilters = () => {
    setAssignmentSearch('');
    setAssignmentRombelFilter('all');
    setAssignmentTeacherFilter('all');
    setAssignmentPage(1);
  };

  const isRombelFiltered =
    rombelSearch !== '' || rombelTingkatFilter !== 'all' || rombelWaliFilter !== 'all';
  const handleResetRombelFilters = () => {
    setRombelSearch('');
    setRombelTingkatFilter('all');
    setRombelWaliFilter('all');
    setRombelPage(1);
  };

  // Quick navigation: jump from teacher to assignments tab filtered for that teacher
  const handleViewTeacherAssignments = (teacherId: string) => {
    setAssignmentTeacherFilter(teacherId);
    setAssignmentSearch('');
    setAssignmentRombelFilter('all');
    setAssignmentPage(1);
    setActiveTab('assignments');
  };

  return (
    <div className="space-y-6">
      {/* Page Header - M3 Style Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-m3-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-m3-primary-container text-m3-on-primary-container border border-m3-primary/10">
              Admin Master Data
            </span>
            <span className="text-m3-outline-variant">•</span>
            <span className="text-xs text-m3-on-surface-variant font-medium">Sinkronisasi Dapodik & Manual Override</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-m3-on-surface tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-m3-primary-container text-m3-primary flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            Manajemen Guru & PTK
          </h1>
          <p className="text-xs sm:text-sm text-m3-on-surface-variant mt-1.5 max-w-2xl leading-relaxed">
            Kelola data pendidik, hak akses akun, penugasan mata pelajaran, serta penetapan wali kelas untuk setiap rombongan belajar.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:self-center md:self-start">
          <M3Button
            variant="outlined"
            size="sm"
            onClick={() => loadAllData(true)}
            disabled={isRefreshing}
            icon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Segarkan
          </M3Button>

          {activeTab === 'teachers' && (
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleOpenAddTeacher}
              icon={<UserPlus className="w-4 h-4" />}
            >
              Tambah Guru Manual
            </M3Button>
          )}

          {activeTab === 'assignments' && (
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleOpenAddAssignment}
              icon={<Plus className="w-4 h-4" />}
            >
              Tambah Penugasan Mengajar
            </M3Button>
          )}

          {activeTab === 'rombels' && (
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleOpenAddRombel}
              icon={<Plus className="w-4 h-4" />}
            >
              Tambah Rombel Baru
            </M3Button>
          )}
        </div>
      </div>

      {/* Alert / Status Banner */}
      {statusBanner && (
        <div
          role="status"
          className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold transition-all ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-m3-error-container text-m3-on-error-container border border-m3-error/20'
          }`}
        >
          <div className="flex items-center gap-3">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-m3-error shrink-0" />
            )}
            <span>{statusBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1.5 rounded-full hover:bg-black/5 text-m3-on-surface-variant cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Overview Cards - M3 Elevated Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Stat 1: Total Guru */}
        <M3Card variant="elevated" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant">Total Guru & PTK</span>
            <div className="w-8 h-8 rounded-xl bg-m3-primary-container text-m3-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-3xl font-extrabold text-m3-on-surface tracking-tight">{stats.totalTeachers}</p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-m3-on-surface-variant font-medium">
              <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                {stats.activeTeachers} Aktif
              </span>
              <span className="text-m3-outline-variant">•</span>
              <span className="inline-flex items-center gap-1 text-m3-outline">
                <span className="w-2 h-2 rounded-full bg-m3-outline" />
                {stats.totalTeachers - stats.activeTeachers} Nonaktif
              </span>
            </div>
          </div>
        </M3Card>

        {/* Stat 2: Wali Kelas Terisi */}
        <M3Card
          variant="elevated"
          onClick={() => {
            setActiveTab('rombels');
            if (stats.rombelsWithWali < stats.totalRombels) {
              setRombelWaliFilter('unassigned');
            }
          }}
          className="p-4 flex flex-col justify-between cursor-pointer hover:border-m3-primary/30 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant">Penetapan Wali Kelas</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <p className="text-3xl font-extrabold text-m3-on-surface tracking-tight">{stats.rombelsWithWali}</p>
              <span className="text-xs font-bold text-m3-on-surface-variant">/ {stats.totalRombels} Rombel</span>
            </div>
            <div className="mt-1.5">
              {stats.rombelsWithWali === stats.totalRombels && stats.totalRombels > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Semua Rombel Terisi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> {stats.totalRombels - stats.rombelsWithWali} Belum Ada Wali
                </span>
              )}
            </div>
          </div>
        </M3Card>

        {/* Stat 3: Penugasan Mengajar */}
        <M3Card
          variant="elevated"
          onClick={() => setActiveTab('assignments')}
          className="p-4 flex flex-col justify-between cursor-pointer hover:border-m3-primary/30 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant">Beban Pembelajaran</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-3xl font-extrabold text-m3-on-surface tracking-tight">{stats.totalAssignments}</p>
            <p className="text-xs text-m3-on-surface-variant font-medium mt-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-m3-outline" />
              Total <strong className="text-m3-on-surface font-bold">{stats.totalHours} JP</strong> per minggu
            </p>
          </div>
        </M3Card>

        {/* Stat 4: Data Manual / Override */}
        <M3Card variant="elevated" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant">Akun Manual Override</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-3xl font-extrabold text-m3-on-surface tracking-tight">{stats.manualTeachers}</p>
            <p className="text-xs text-m3-on-surface-variant font-medium mt-1.5">
              Diproteksi dari penimpaan sinkron Dapodik
            </p>
          </div>
        </M3Card>
      </div>

      {/* Tabs Navigation - M3 Primary Tabs */}
      <div className="bg-m3-surface-container rounded-full p-1.5 border border-m3-outline-variant/30 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setActiveTab('teachers')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
            activeTab === 'teachers'
              ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs'
              : 'text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Guru & Tenaga Pendidik</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'teachers' ? 'bg-m3-surface text-m3-on-surface' : 'bg-m3-surface-variant text-m3-on-surface-variant'
            }`}
          >
            {teachers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
            activeTab === 'assignments'
              ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs'
              : 'text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Penugasan Mengajar</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'assignments' ? 'bg-m3-surface text-m3-on-surface' : 'bg-m3-surface-variant text-m3-on-surface-variant'
            }`}
          >
            {assignments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rombels')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
            activeTab === 'rombels'
              ? 'bg-m3-secondary-container text-m3-on-secondary-container shadow-xs'
              : 'text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Rombel & Wali Kelas</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'rombels' ? 'bg-m3-surface text-m3-on-surface' : 'bg-m3-surface-variant text-m3-on-surface-variant'
            }`}
          >
            {rombels.length}
          </span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: GURU & PTK */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={teacherSearch}
                onChange={(e) => {
                  setTeacherSearch(e.target.value);
                  setTeacherPage(1);
                }}
                placeholder="Cari nama guru, NIP/NIK, atau alamat email..."
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
              {teacherSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setTeacherSearch('');
                    setTeacherPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                  title="Bersihkan kata kunci"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as any);
                  setTeacherPage(1);
                }}
                aria-label="Filter berdasarkan hak akses"
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-m3-primary cursor-pointer min-h-[44px]"
              >
                <option value="all">Semua Peran</option>
                <option value="guru">Guru Mapel</option>
                <option value="admin">Administrator</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setTeacherPage(1);
                }}
                aria-label="Filter berdasarkan status keaktifan"
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-m3-primary cursor-pointer min-h-[44px]"
              >
                <option value="all">Semua Status</option>
                <option value="active">Status Aktif</option>
                <option value="inactive">Status Nonaktif</option>
              </select>

              <select
                value={waliFilter}
                onChange={(e) => {
                  setWaliFilter(e.target.value as any);
                  setTeacherPage(1);
                }}
                aria-label="Filter berdasarkan status wali kelas"
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-m3-primary cursor-pointer min-h-[44px]"
              >
                <option value="all">Semua Penugasan Wali</option>
                <option value="wali">Wali Kelas</option>
                <option value="non_wali">Bukan Wali Kelas</option>
              </select>

              {isTeacherFiltered && (
                <button
                  type="button"
                  onClick={handleResetTeacherFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
                  title="Bersihkan seluruh filter guru"
                >
                  <X className="w-4 h-4" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-m3-primary mb-3" />
                <p className="text-sm font-bold text-slate-700">Memuat data guru dan tenaga pendidik...</p>
                <p className="text-xs text-slate-400 mt-1">Mengambil data dari server lokal dan sinkronisasi Dapodik</p>
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="py-16 text-center text-slate-500 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-base font-bold text-slate-800">Data guru tidak ditemukan</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Tidak ada data yang cocok dengan kriteria pencarian atau filter yang Anda terapkan.
                </p>
                {isTeacherFiltered ? (
                  <button
                    type="button"
                    onClick={handleResetTeacherFilters}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Bersihkan Filter</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenAddTeacher}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-m3-primary text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer min-h-[40px]"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Tambah Guru Baru</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th scope="col" className="py-3 px-4">Guru / Tenaga Pendidik</th>
                        <th scope="col" className="py-3 px-4">NIP / NIK & Kontak</th>
                        <th scope="col" className="py-3 px-4">Hak Akses</th>
                        <th scope="col" className="py-3 px-4">Wali Kelas</th>
                        <th scope="col" className="py-3 px-4">Beban Mapel</th>
                        <th scope="col" className="py-3 px-4">Status & Sumber</th>
                        <th scope="col" className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {paginatedTeachers.map((teacher) => {
                        const isTeacherActive = teacher.is_active !== false;
                        const teacherWaliList = getTeacherWaliRombels(teacher);
                        const hasWali = teacherWaliList.length > 0;

                        return (
                          <tr
                            key={teacher.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              !isTeacherActive ? 'bg-slate-50/50 opacity-70' : ''
                            }`}
                          >
                            {/* Nama & Avatar */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                                    teacher.role === 'admin'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-blue-50 text-m3-primary border-blue-200'
                                  }`}
                                >
                                  {getInitials(teacher.name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{teacher.name}</p>
                                  <p className="text-[11px] text-slate-500 truncate">{teacher.email || 'Tanpa alamat email'}</p>
                                </div>
                              </div>
                            </td>

                            {/* NIP / NIK & Kontak */}
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                <p className="font-mono text-xs font-semibold text-slate-800">
                                  {teacher.nip_nik || '-'}
                                </p>
                                {teacher.phone ? (
                                  <a
                                    href={`https://wa.me/${teacher.phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-slate-500 hover:text-emerald-700 hover:underline flex items-center gap-1"
                                    title="Hubungi via WhatsApp"
                                  >
                                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>{teacher.phone}</span>
                                  </a>
                                ) : (
                                  <p className="text-[11px] text-slate-400">-</p>
                                )}
                              </div>
                            </td>

                            {/* Hak Akses */}
                            <td className="py-3 px-4">
                              {teacher.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  <Shield className="w-3 h-3" /> Administrator
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-m3-primary border border-blue-200">
                                  <GraduationCap className="w-3.5 h-3.5" /> Guru Mapel
                                </span>
                              )}
                            </td>

                            {/* Wali Kelas */}
                            <td className="py-3 px-4">
                              {hasWali ? (
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {teacherWaliList.map((rombel) => (
                                    <button
                                      key={rombel.id}
                                      type="button"
                                      onClick={() => handleOpenAssignWali(rombel, teacher)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                                      title={`Wali Kelas ${rombel.name}. Klik untuk ubah rombel.`}
                                    >
                                      <UserCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>{rombel.name}</span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssignWali(undefined, teacher)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-m3-primary transition-colors cursor-pointer py-1 px-2.5 rounded-lg border border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Tetapkan Wali</span>
                                </button>
                              )}
                            </td>

                            {/* Beban Mapel */}
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => handleViewTeacherAssignments(teacher.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                title="Lihat rincian penugasan mengajar guru ini"
                              >
                                <span>{teacher.assignment_count} Mapel</span>
                              </button>
                            </td>

                            {/* Status & Sumber */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                {isTeacherActive ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Aktif
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Nonaktif
                                  </span>
                                )}

                                {teacher.is_manual_override ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Manual
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-m3-primary border border-blue-200">
                                    Dapodik
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Aksi */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTeacher(teacher)}
                                  className="p-2 rounded-lg text-slate-500 hover:text-m3-primary hover:bg-blue-50 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                                  title="Edit Profil Guru"
                                  aria-label={`Edit ${teacher.name}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenResetPassword(teacher)}
                                  className="p-2 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                                  title="Reset Kata Sandi"
                                  aria-label={`Reset kata sandi ${teacher.name}`}
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenDeactivateTeacher(teacher)}
                                  className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                                  title="Nonaktifkan Guru"
                                  aria-label={`Nonaktifkan ${teacher.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <PaginationBar
                  currentPage={teacherPage}
                  totalPages={teacherTotalPages}
                  totalItems={filteredTeachers.length}
                  pageSize={teacherPageSize}
                  pageSizeOptions={[10, 20, 50, 0]}
                  itemLabel="guru"
                  onPageChange={setTeacherPage}
                  onPageSizeChange={(size) => {
                    setTeacherPageSize(size);
                    setTeacherPage(1);
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: PENUGASAN MENGAJAR */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={assignmentSearch}
                onChange={(e) => {
                  setAssignmentSearch(e.target.value);
                  setAssignmentPage(1);
                }}
                placeholder="Cari mata pelajaran, guru pengampu, atau kelas..."
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
              {assignmentSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentSearch('');
                    setAssignmentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                  title="Bersihkan kata kunci"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <SearchableRombelSelect
                id="filter-assignment-rombel"
                rombels={activeRombels}
                selectedRombelId={assignmentRombelFilter}
                onSelect={(id) => {
                  setAssignmentRombelFilter(id);
                  setAssignmentPage(1);
                }}
                showAllOption={true}
                allOptionLabel="Semua Rombel"
                filterEmpty={false}
                className="w-48 sm:w-56"
                buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-200 min-h-[44px]"
              />

              <select
                value={assignmentTeacherFilter}
                onChange={(e) => {
                  setAssignmentTeacherFilter(e.target.value);
                  setAssignmentPage(1);
                }}
                aria-label="Filter berdasarkan guru pengampu"
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-m3-primary cursor-pointer min-h-[44px] max-w-[220px] truncate"
              >
                <option value="all">Semua Guru Pengampu</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {isAssignmentFiltered && (
                <button
                  type="button"
                  onClick={handleResetAssignmentFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
                  title="Bersihkan filter penugasan"
                >
                  <X className="w-4 h-4" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Assignments Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-m3-primary mb-3" />
                <p className="text-sm font-bold text-slate-700">Memuat penugasan mengajar...</p>
                <p className="text-xs text-slate-400 mt-1">Mengambil data alokasi pembelajaran dan beban jam guru</p>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="py-16 text-center text-slate-500 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <p className="text-base font-bold text-slate-800">Tidak ada penugasan mengajar yang sesuai</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {isAssignmentFiltered
                    ? 'Tidak ada data penugasan yang cocok dengan kata kunci atau filter terpilih.'
                    : 'Belum ada data penugasan. Klik "Tambah Penugasan Mengajar" untuk menghubungkan guru, mata pelajaran, dan rombongan belajar.'}
                </p>
                {isAssignmentFiltered ? (
                  <button
                    type="button"
                    onClick={handleResetAssignmentFilters}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Bersihkan Filter</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenAddAssignment}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-m3-primary text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer min-h-[40px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Penugasan Mengajar</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th scope="col" className="py-3 px-4">Mata Pelajaran</th>
                        <th scope="col" className="py-3 px-4">Kelas / Rombel</th>
                        <th scope="col" className="py-3 px-4">Guru Pengampu</th>
                        <th scope="col" className="py-3 px-4">Beban Jam</th>
                        <th scope="col" className="py-3 px-4">Sumber Data</th>
                        <th scope="col" className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {paginatedAssignments.map((assign) => (
                        <tr key={assign.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-900">{assign.subject?.nama || 'Mata Pelajaran Tidak Diketahui'}</p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                {assign.subject?.kelompok ? `Kelompok ${assign.subject.kelompok}` : 'Umum'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-blue-50 text-m3-primary flex items-center justify-center font-bold text-xs border border-blue-100">
                                {assign.rombel?.tingkat || '-'}
                              </span>
                              <span className="font-bold text-slate-900">{assign.rombel?.name || '-'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-900">{assign.guru?.name || '-'}</p>
                              <p className="text-[11px] font-mono text-slate-500">{assign.guru?.nip_nik || 'Tanpa NIP'}</p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {assign.jam_per_minggu || 0} JP / minggu
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {assign.is_manual_override ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Manual Override
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-m3-primary border border-blue-200">
                                Dapodik
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteAssignment(assign)}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
                              title="Hapus Penugasan Ini"
                              aria-label="Hapus penugasan mengajar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationBar
                  currentPage={assignmentPage}
                  totalPages={assignmentTotalPages}
                  totalItems={filteredAssignments.length}
                  pageSize={assignmentPageSize}
                  pageSizeOptions={[10, 20, 50, 0]}
                  itemLabel="penugasan"
                  onPageChange={setAssignmentPage}
                  onPageSizeChange={(size) => {
                    setAssignmentPageSize(size);
                    setAssignmentPage(1);
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: ROMBEL & WALI KELAS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'rombels' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={rombelSearch}
                onChange={(e) => {
                  setRombelSearch(e.target.value);
                  setRombelPage(1);
                }}
                placeholder="Cari nama rombongan belajar atau nama wali kelas..."
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
              {rombelSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setRombelSearch('');
                    setRombelPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                  title="Bersihkan kata kunci"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={rombelTingkatFilter}
                onChange={(e) => {
                  setRombelTingkatFilter(e.target.value);
                  setRombelPage(1);
                }}
                aria-label="Filter berdasarkan tingkat kelas"
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-m3-primary cursor-pointer min-h-[44px]"
              >
                <option value="all">Semua Tingkat</option>
                <option value="10">Kelas 10 (Fase E)</option>
                <option value="11">Kelas 11 (Fase F)</option>
                <option value="12">Kelas 12 (Fase F)</option>
              </select>

              <select
                value={rombelWaliFilter}
                onChange={(e) => {
                  setRombelWaliFilter(e.target.value as any);
                  setRombelPage(1);
                }}
                aria-label="Filter berdasarkan status penetapan wali"
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-m3-primary cursor-pointer min-h-[44px]"
              >
                <option value="all">Semua Status Wali</option>
                <option value="assigned">Sudah Ada Wali</option>
                <option value="unassigned">Belum Ada Wali</option>
              </select>

              {isRombelFiltered && (
                <button
                  type="button"
                  onClick={handleResetRombelFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
                  title="Bersihkan filter rombel"
                >
                  <X className="w-4 h-4" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Rombels Cards Grid */}
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500 shadow-xs">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-m3-primary mb-3" />
              <p className="text-sm font-bold text-slate-700">Memuat daftar rombongan belajar...</p>
              <p className="text-xs text-slate-400 mt-1">Mengambil data kelas dan wali binaan dari server</p>
            </div>
          ) : filteredRombels.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500 shadow-xs px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Layers className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-slate-800">Rombongan belajar tidak ditemukan</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Tidak ada rombel yang sesuai dengan kata kunci atau filter tingkat yang Anda pilih.
              </p>
              {isRombelFiltered && (
                <button
                  type="button"
                  onClick={handleResetRombelFilters}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Bersihkan Filter</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedRombels.map((rombel) => {
                  const wali = teachers.find((t) => t.id === rombel.wali_kelas_id) || rombel.wali_kelas;
                  const hasWali = !!wali;

                  return (
                    <div
                      key={rombel.id}
                      className={`bg-white p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                        hasWali
                          ? 'border-slate-200/90 shadow-xs hover:border-slate-300'
                          : 'border-amber-200/80 bg-amber-50/20 shadow-xs hover:border-amber-300'
                      }`}
                    >
                      <div>
                        {/* Header Card */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-m3-primary border border-blue-200">
                                Tingkat {rombel.tingkat}
                              </span>
                              {rombel.is_manual_override ? (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Manual
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-m3-primary border border-blue-200">
                                  Dapodik
                                </span>
                              )}
                            </div>
                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-2 truncate">
                              {rombel.name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {rombel.student_count !== undefined ? `${rombel.student_count} Peserta Didik` : 'Jumlah siswa belum tercatat'}
                            </p>
                          </div>

                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-m3-primary flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                            {rombel.tingkat}
                          </div>
                        </div>

                        {/* Wali Kelas Section */}
                        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Wali Kelas
                          </p>
                          {hasWali ? (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-m3-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {getInitials(wali.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-xs text-slate-900 truncate">{wali.name}</p>
                                <p className="text-[11px] font-mono text-slate-500 truncate">
                                  NIP: {wali.nip_nik || '-'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 py-1 text-amber-800 text-xs font-semibold">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Belum ada wali kelas yang ditugaskan</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 font-mono truncate max-w-[120px]" title={rombel.id}>
                          {rombel.id.slice(0, 10)}...
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignWali(rombel)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border min-h-[38px] ${
                            hasWali
                              ? 'bg-blue-50 hover:bg-blue-100 text-m3-primary border-blue-200'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                          }`}
                        >
                          {hasWali ? 'Ganti Wali Kelas' : 'Tetapkan Wali'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rombels Pagination */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <PaginationBar
                  currentPage={rombelPage}
                  totalPages={rombelTotalPages}
                  totalItems={filteredRombels.length}
                  pageSize={rombelPageSize}
                  pageSizeOptions={[12, 24, 48, 0]}
                  itemLabel="rombel"
                  onPageChange={setRombelPage}
                  onPageSizeChange={(size) => {
                    setRombelPageSize(size);
                    setRombelPage(1);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Modal Tambah Guru Manual */}
      <Modal
        isOpen={isAddTeacherOpen}
        onClose={() => setIsAddTeacherOpen(false)}
        title="Tambah Guru / PTK Manual"
      >
        <form onSubmit={handleCreateTeacher} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-m3-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Guru yang ditambahkan secara mandiri akan diproteksi dengan flag <strong>Manual Override</strong> agar tidak tertimpa saat sinkronisasi Dapodik dilakukan kembali.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Lengkap & Gelar <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newTeacherName}
              onChange={(e) => setNewTeacherName(e.target.value)}
              placeholder="Contoh: Dra. Hj. Siti Aminah, M.Pd"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                NIP / NIK (Opsional)
              </label>
              <input
                type="text"
                value={newTeacherNip}
                onChange={(e) => setNewTeacherNip(e.target.value)}
                placeholder="198001012005011001"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hak Akses Sistem
              </label>
              <select
                value={newTeacherRole}
                onChange={(e) => setNewTeacherRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              >
                <option value="guru">Guru Mata Pelajaran</option>
                <option value="admin">Administrator Sekolah</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Email</label>
              <input
                type="email"
                value={newTeacherEmail}
                onChange={(e) => setNewTeacherEmail(e.target.value)}
                placeholder="nama.guru@smk.sch.id"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
              <input
                type="text"
                value={newTeacherPhone}
                onChange={(e) => setNewTeacherPhone(e.target.value)}
                placeholder="08123456789"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kata Sandi Awal (Opsional)
            </label>
            <input
              type="password"
              value={newTeacherPassword}
              onChange={(e) => setNewTeacherPassword(e.target.value)}
              placeholder="Kosongkan jika ingin default ke NIP atau guru123"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Bila dikosongkan, sandi otomatis diatur ke nomor NIP/NIK atau "guru123" (guru wajib mengganti saat login perdana).
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsAddTeacherOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-m3-primary hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Guru Baru'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal Edit Guru */}
      <Modal
        isOpen={isEditTeacherOpen}
        onClose={() => setIsEditTeacherOpen(false)}
        title="Edit Profil Guru & Hak Akses"
      >
        <form onSubmit={handleUpdateTeacher} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Lengkap & Gelar <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editTeacherName}
              onChange={(e) => setEditTeacherName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">NIP / NIK</label>
              <input
                type="text"
                value={editTeacherNip}
                onChange={(e) => setEditTeacherNip(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hak Akses</label>
              <select
                value={editTeacherRole}
                onChange={(e) => setEditTeacherRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              >
                <option value="guru">Guru Mata Pelajaran</option>
                <option value="admin">Administrator Sekolah</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Email</label>
              <input
                type="email"
                value={editTeacherEmail}
                onChange={(e) => setEditTeacherEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
              <input
                type="text"
                value={editTeacherPhone}
                onChange={(e) => setEditTeacherPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              />
            </div>
          </div>

          {/* Status Aktif Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-800">Status Akun Aktif</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Jika dinonaktifkan, akun guru tidak dapat masuk ke sistem, tetapi seluruh riwayat penilaian lampau tetap tersimpan utuh.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={editTeacherIsActive}
                onChange={(e) => setEditTeacherIsActive(e.target.checked)}
                className="sr-only peer"
                aria-label="Toggle status aktif guru"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-m3-primary"></div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditTeacherOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-m3-primary hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Perbarui Data'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Modal Reset Kata Sandi */}
      <Modal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        title="Reset Kata Sandi Akun Guru"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-600">
            Anda akan mereset kata sandi akun untuk <strong>{selectedTeacher?.name}</strong> (
            <span className="font-mono font-bold text-slate-800">{selectedTeacher?.nip_nik || selectedTeacher?.email || 'Tanpa NIP'}</span>).
          </p>

          {!resetResultPassword ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2.5">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="resetType"
                    checked={!resetUseCustom}
                    onChange={() => setResetUseCustom(false)}
                    className="text-m3-primary focus:ring-m3-primary mt-1"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Gunakan NIP / NIK sebagai Sandi Default</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sandi akan diatur ulang ke nomor NIP/NIK (atau "guru123" bila NIP belum terdaftar).
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="resetType"
                    checked={resetUseCustom}
                    onChange={() => setResetUseCustom(true)}
                    className="text-m3-primary focus:ring-m3-primary mt-1"
                  />
                  <div className="w-full">
                    <p className="text-xs font-bold text-slate-800">Tentukan Kata Sandi Baru</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ketikkan kata sandi kustom minimal 6 karakter.
                    </p>
                    {resetUseCustom && (
                      <input
                        type="text"
                        value={customNewPassword}
                        onChange={(e) => setCustomNewPassword(e.target.value)}
                        placeholder="Masukkan sandi baru (minimal 6 karakter)"
                        className="mt-2.5 w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[40px]"
                      />
                    )}
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (resetUseCustom && customNewPassword.length < 4)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
                >
                  {isSubmitting ? 'Mereset...' : 'Konfirmasi Reset Sandi'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-emerald-900 font-bold">Kata sandi berhasil diatur ulang!</p>
                <div className="mt-3 p-3 rounded-xl bg-white border border-emerald-300 flex items-center justify-between gap-2">
                  <span className="font-mono text-base font-extrabold text-slate-900 tracking-wider">
                    {resetResultPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetResultPassword);
                      setCopiedPassword(true);
                      setTimeout(() => setCopiedPassword(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold hover:bg-emerald-200 transition-colors cursor-pointer min-h-[36px]"
                  >
                    {copiedPassword ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4 text-emerald-700" />}
                    <span>{copiedPassword ? 'Tersalin' : 'Salin Sandi'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800 mt-2.5">
                  Berikan kata sandi baru ini kepada guru yang bersangkutan. Guru disarankan untuk memperbarui sandi saat masuk pertama kali.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer min-h-[44px]"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 4. Modal Penetapan Wali Kelas */}
      <Modal
        isOpen={isAssignWaliOpen}
        onClose={() => setIsAssignWaliOpen(false)}
        title="Tetapkan / Ganti Wali Kelas"
      >
        <form onSubmit={handleSaveWaliAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Rombongan Belajar (Kelas) <span className="text-rose-500">*</span>
            </label>
            <SearchableRombelSelect
              id="assign-wali-rombel"
              rombels={activeRombels}
              selectedRombelId={assignRombelId}
              onSelect={(id) => setAssignRombelId(id)}
              filterEmpty={false}
              placeholder="Pilih Rombongan Belajar"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Guru sebagai Wali Kelas
            </label>
            <SearchableTeacherSelect
              id="assign-wali-guru"
              teachers={teachers}
              selectedTeacherId={assignGuruId}
              onSelect={(id) => setAssignGuruId(id)}
              allowClear={true}
              emptyLabel="-- Kosongkan (Tanpa Wali Kelas) --"
              placeholder="Pilih Guru sebagai Wali Kelas"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              Penetapan wali kelas langsung memperbarui hak akses presensi kehadiran, catatan kepribadian, dan nama yang tercantum pada cetak rapor.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsAssignWaliOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-m3-primary hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Wali Kelas'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Modal Nonaktifkan Guru */}
      <Modal
        isOpen={isDeleteTeacherOpen}
        onClose={() => setIsDeleteTeacherOpen(false)}
        title="Konfirmasi Nonaktifkan Guru"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600" /> Perhatian:
            </p>
            <p className="leading-relaxed">
              Akun guru <strong>{selectedTeacher?.name}</strong> akan <strong>dinonaktifkan (soft delete)</strong>. Guru tidak dapat masuk ke aplikasi rapor lagi, namun riwayat penginputan nilai dan arsip rapor semester sebelumnya tetap aman tersimpan.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsDeleteTeacherOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmDeactivateTeacher}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses...' : 'Ya, Nonaktifkan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 6. Modal Tambah Penugasan Mengajar */}
      <Modal
        isOpen={isAddAssignmentOpen}
        onClose={() => setIsAddAssignmentOpen(false)}
        title="Tambah Penugasan Mengajar"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Guru Pengampu <span className="text-rose-500">*</span>
            </label>
            <SearchableTeacherSelect
              id="assign-teaching-teacher"
              teachers={teachers}
              selectedTeacherId={assignFormGuruId}
              onSelect={(id) => setAssignFormGuruId(id)}
              placeholder="Pilih Guru Pengampu"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mata Pelajaran <span className="text-rose-500">*</span>
            </label>
            <SearchableSubjectSelect
              id="assign-teaching-subject"
              subjects={subjects}
              selectedSubjectId={assignFormSubjectId}
              onSelect={(id) => setAssignFormSubjectId(id)}
              placeholder="Pilih Mata Pelajaran"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rombongan Belajar (Kelas) <span className="text-rose-500">*</span>
              </label>
              <SearchableRombelSelect
                id="assign-teaching-rombel"
                rombels={activeRombels}
                selectedRombelId={assignFormRombelId}
                onSelect={(id) => setAssignFormRombelId(id)}
                filterEmpty={false}
                placeholder="Pilih Rombongan Belajar"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jam Per Minggu <span className="text-slate-400 font-normal text-[11px] ml-1">(Opsional)</span>
              </label>
              <input
                type="number"
                min={0}
                max={40}
                value={assignFormJam}
                onChange={(e) => setAssignFormJam(e.target.value)}
                placeholder="Contoh: 4"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/20 min-h-[44px]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsAddAssignmentOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-m3-primary hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Tambahkan Penugasan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. Modal Hapus Penugasan Mengajar */}
      <Modal
        isOpen={isDeleteAssignmentOpen}
        onClose={() => setIsDeleteAssignmentOpen(false)}
        title="Hapus Penugasan Mengajar"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin menghapus penugasan mengajar mata pelajaran{' '}
            <strong className="text-slate-900">{selectedAssignment?.subject?.nama}</strong> untuk kelas{' '}
            <strong className="text-slate-900">{selectedAssignment?.rombel?.name}</strong> oleh guru{' '}
            <strong className="text-slate-900">{selectedAssignment?.guru?.name}</strong>?
          </p>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsDeleteAssignmentOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteAssignment}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Penugasan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 8. Modal Tambah Rombel Baru */}
      <Modal
        isOpen={isAddRombelOpen}
        onClose={() => setIsAddRombelOpen(false)}
        title="Tambah Rombongan Belajar Baru"
      >
        <form onSubmit={handleCreateRombel} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Rombel / Kelas <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newRombelName}
              onChange={(e) => setNewRombelName(e.target.value)}
              placeholder="Contoh: XI TKJ 2 atau XII RPL 3"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tingkat Kelas <span className="text-rose-500">*</span>
              </label>
              <select
                value={newRombelTingkat}
                onChange={(e) => setNewRombelTingkat(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              >
                <option value={10}>Tingkat 10 (Fase E)</option>
                <option value={11}>Tingkat 11 (Fase F)</option>
                <option value={12}>Tingkat 12 (Fase F)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Wali Kelas (Opsional)
              </label>
              <select
                value={newRombelWaliId}
                onChange={(e) => setNewRombelWaliId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-m3-primary/20 focus:border-m3-primary min-h-[44px]"
              >
                <option value="">-- Tetapkan Nanti --</option>
                {teachers
                  .filter((t) => t.is_active !== false)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsAddRombelOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-m3-primary hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              {isSubmitting ? 'Membuat...' : 'Buat Rombel'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
