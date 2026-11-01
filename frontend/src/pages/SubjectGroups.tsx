import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  MoveRight,
  ShieldCheck,
  Database,
  Info,
  ListOrdered,
  Table as TableIcon,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Save,
  RotateCcw,
  ArrowDownAZ,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { masterService } from '../services/master.service';
import { Subject, SubjectGroupSummary } from '../types';
import { M3Button, M3Card, M3TextField, M3Dialog } from '../components/m3';

export const SubjectGroups: React.FC = () => {
  const [groups, setGroups] = useState<SubjectGroupSummary[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active view tab: 'reorder' (Urutan Cetak Rapor) vs 'table' (Daftar & Pengelompokan)
  const [activeTab, setActiveTab] = useState<'reorder' | 'table'>('reorder');

  // Reorder State
  const [orderedGroups, setOrderedGroups] = useState<SubjectGroupSummary[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Drag and Drop State
  const [draggingItem, setDraggingItem] = useState<{
    groupIndex: number;
    subjectIndex: number;
    subjectId: string;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    groupIndex: number;
    subjectIndex?: number;
  } | null>(null);

  // Collapsible groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Filter & Search in Table view
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');

  // Multi-selection in Table view
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [bulkTargetKelompok, setBulkTargetKelompok] = useState('A');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Status Notification
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Create Dialog
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createGroupCode, setCreateGroupCode] = useState('');
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupDeskripsi, setCreateGroupDeskripsi] = useState('');
  const [createGroupUrutan, setCreateGroupUrutan] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Dialog
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SubjectGroupSummary | null>(null);
  const [editGroupCode, setEditGroupCode] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDeskripsi, setEditGroupDeskripsi] = useState('');
  const [editGroupUrutan, setEditGroupUrutan] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTargetKelompok, setDeleteTargetKelompok] = useState('B');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [summaryRes, subjectsRes] = await Promise.all([
        masterService.getSubjectGroupsSummary(),
        masterService.getSubjects(),
      ]);

      const loadedGroups = summaryRes.groups || [];
      // Urutkan kelompok berdasarkan urutan ASC
      loadedGroups.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

      // Pastikan mata pelajaran di dalam masing-masing kelompok terurut sesuai urutan
      loadedGroups.forEach((g) => {
        if (g.subjects) {
          g.subjects.sort((a, b) => (a.urutan || 0) - (b.urutan || 0) || a.nama.localeCompare(b.nama));
        }
      });

      setGroups(loadedGroups);
      setOrderedGroups(JSON.parse(JSON.stringify(loadedGroups)));
      setHasUnsavedChanges(false);

      setAllSubjects(subjectsRes.subjects || []);
      setSelectedSubjectIds([]);
      if (loadedGroups.length > 0 && !loadedGroups.some((g) => g.kode === bulkTargetKelompok)) {
        setBulkTargetKelompok(loadedGroups[0].kode);
      }
    } catch (err: any) {
      console.error(err);
      showBanner('error', err.message || 'Gagal memuat data kelompok mata pelajaran');
    } finally {
      setIsLoading(false);
    }
  };

  const showBanner = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => {
      setStatusBanner(null);
    }, 5000);
  };

  const filteredSubjects = useMemo(() => {
    return allSubjects.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.nama.toLowerCase().includes(q) ||
        (s.kelompok || '').toLowerCase().includes(q);
      const matchGroup =
        selectedGroupFilter === 'all' || s.kelompok === selectedGroupFilter;
      return matchSearch && matchGroup;
    });
  }, [allSubjects, searchQuery, selectedGroupFilter]);

  // --- REORDER LOGIC ---

  const moveSubject = (groupIndex: number, subjectIndex: number, direction: 'up' | 'down') => {
    const newGroups = JSON.parse(JSON.stringify(orderedGroups)) as SubjectGroupSummary[];
    const targetGroup = newGroups[groupIndex];
    if (!targetGroup || !targetGroup.subjects) return;

    const targetIndex = direction === 'up' ? subjectIndex - 1 : subjectIndex + 1;
    if (targetIndex < 0 || targetIndex >= targetGroup.subjects.length) return;

    const [moved] = targetGroup.subjects.splice(subjectIndex, 1);
    targetGroup.subjects.splice(targetIndex, 0, moved);

    targetGroup.subjects.forEach((s, idx) => {
      s.urutan = idx + 1;
    });

    setOrderedGroups(newGroups);
    setHasUnsavedChanges(true);
  };

  const moveGroup = (groupIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedGroups.length) return;

    const newGroups = JSON.parse(JSON.stringify(orderedGroups)) as SubjectGroupSummary[];
    const [moved] = newGroups.splice(groupIndex, 1);
    newGroups.splice(targetIndex, 0, moved);

    newGroups.forEach((g, idx) => {
      g.urutan = idx + 1;
    });

    setOrderedGroups(newGroups);
    setHasUnsavedChanges(true);
  };

  const sortGroupAlphabetically = (groupIndex: number) => {
    const newGroups = JSON.parse(JSON.stringify(orderedGroups)) as SubjectGroupSummary[];
    const targetGroup = newGroups[groupIndex];
    if (!targetGroup || !targetGroup.subjects) return;

    targetGroup.subjects.sort((a, b) => a.nama.localeCompare(b.nama));
    targetGroup.subjects.forEach((s, idx) => {
      s.urutan = idx + 1;
    });

    setOrderedGroups(newGroups);
    setHasUnsavedChanges(true);
  };

  const handleInlineMoveToGroup = (
    currentGroupIndex: number,
    subjectIndex: number,
    targetGroupKode: string
  ) => {
    if (orderedGroups[currentGroupIndex].kode === targetGroupKode) return;

    const newGroups = JSON.parse(JSON.stringify(orderedGroups)) as SubjectGroupSummary[];
    const sourceGroup = newGroups[currentGroupIndex];
    const targetGroup = newGroups.find((g) => g.kode === targetGroupKode);
    if (!sourceGroup || !targetGroup || !sourceGroup.subjects) return;

    const [moved] = sourceGroup.subjects.splice(subjectIndex, 1);
    moved.kelompok = targetGroupKode;

    if (!targetGroup.subjects) targetGroup.subjects = [];
    targetGroup.subjects.push(moved);

    sourceGroup.subjects.forEach((s, idx) => {
      s.urutan = idx + 1;
    });
    targetGroup.subjects.forEach((s, idx) => {
      s.urutan = idx + 1;
    });
    sourceGroup.count = sourceGroup.subjects.length;
    targetGroup.count = targetGroup.subjects.length;

    setOrderedGroups(newGroups);
    setHasUnsavedChanges(true);
  };

  // Drag and Drop Event Handlers
  const handleDragStart = (
    e: React.DragEvent,
    groupIndex: number,
    subjectIndex: number,
    subjectId: string
  ) => {
    setDraggingItem({ groupIndex, subjectIndex, subjectId });
    e.dataTransfer.setData('text/plain', subjectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverSubject = (
    e: React.DragEvent,
    groupIndex: number,
    subjectIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (
      dragOverTarget?.groupIndex !== groupIndex ||
      dragOverTarget?.subjectIndex !== subjectIndex
    ) {
      setDragOverTarget({ groupIndex, subjectIndex });
    }
  };

  const handleDragOverGroup = (e: React.DragEvent, groupIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (
      dragOverTarget?.groupIndex !== groupIndex ||
      dragOverTarget?.subjectIndex !== undefined
    ) {
      setDragOverTarget({ groupIndex });
    }
  };

  const handleDropSubject = (
    e: React.DragEvent,
    targetGroupIndex: number,
    targetSubjectIndex?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggingItem) return;

    const { groupIndex: sourceGroupIndex, subjectIndex: sourceSubjectIndex } = draggingItem;
    const newGroups = JSON.parse(JSON.stringify(orderedGroups)) as SubjectGroupSummary[];

    const sourceGroup = newGroups[sourceGroupIndex];
    const targetGroup = newGroups[targetGroupIndex];
    if (!sourceGroup || !targetGroup || !sourceGroup.subjects) return;

    const [moved] = sourceGroup.subjects.splice(sourceSubjectIndex, 1);
    moved.kelompok = targetGroup.kode;

    if (!targetGroup.subjects) targetGroup.subjects = [];

    let insertAt =
      typeof targetSubjectIndex === 'number'
        ? targetSubjectIndex
        : targetGroup.subjects.length;

    targetGroup.subjects.splice(insertAt, 0, moved);

    sourceGroup.subjects.forEach((s, idx) => {
      s.urutan = idx + 1;
    });
    targetGroup.subjects.forEach((s, idx) => {
      s.urutan = idx + 1;
    });
    sourceGroup.count = sourceGroup.subjects.length;
    targetGroup.count = targetGroup.subjects.length;

    setOrderedGroups(newGroups);
    setHasUnsavedChanges(true);
    setDraggingItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
    setDragOverTarget(null);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const subjectOrders: { id: string; urutan: number; kelompok?: string }[] = [];
      const groupOrders: { kode: string; urutan: number }[] = [];

      orderedGroups.forEach((group, gIdx) => {
        groupOrders.push({
          kode: group.kode,
          urutan: gIdx + 1,
        });

        if (group.subjects) {
          group.subjects.forEach((sub, sIdx) => {
            subjectOrders.push({
              id: sub.id,
              urutan: sIdx + 1,
              kelompok: group.kode,
            });
          });
        }
      });

      await Promise.all([
        masterService.reorderSubjects(subjectOrders),
        masterService.reorderSubjectGroups(groupOrders),
      ]);

      showBanner('success', 'Urutan kelompok dan mata pelajaran rapor berhasil disimpan!');
      setHasUnsavedChanges(false);
      await loadData();
    } catch (err: any) {
      showBanner(
        'error',
        err.response?.data?.message || err.message || 'Gagal menyimpan urutan'
      );
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleResetOrder = () => {
    setOrderedGroups(JSON.parse(JSON.stringify(groups)));
    setHasUnsavedChanges(false);
  };

  const toggleGroupCollapse = (kode: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [kode]: !prev[kode],
    }));
  };

  // --- BULK & TABLE ACTIONS ---

  const handleToggleSelectAll = () => {
    if (
      selectedSubjectIds.length === filteredSubjects.length &&
      filteredSubjects.length > 0
    ) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(filteredSubjects.map((s) => s.id));
    }
  };

  const handleToggleSelectSubject = (id: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyBulkKelompok = async () => {
    if (selectedSubjectIds.length === 0) return;
    setIsSubmittingBulk(true);
    try {
      const res = await masterService.bulkUpdateSubjectKelompok(
        selectedSubjectIds,
        bulkTargetKelompok
      );
      showBanner(
        'success',
        res.message || `${selectedSubjectIds.length} mata pelajaran berhasil dipindahkan.`
      );
      setSelectedSubjectIds([]);
      await loadData();
    } catch (err: any) {
      showBanner(
        'error',
        err.response?.data?.message || err.message || 'Gagal memindahkan mata pelajaran'
      );
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const handleInlineChangeKelompok = async (subjectId: string, newKelompok: string) => {
    try {
      const res = await masterService.bulkUpdateSubjectKelompok([subjectId], newKelompok);
      showBanner('success', res.message || 'Kelompok mata pelajaran diperbarui.');
      await loadData();
    } catch (err: any) {
      showBanner(
        'error',
        err.response?.data?.message || err.message || 'Gagal memperbarui kelompok'
      );
    }
  };

  const handleOpenCreateModal = () => {
    setCreateGroupCode('');
    setCreateGroupName('');
    setCreateGroupDeskripsi('');
    setCreateGroupUrutan(String(groups.length + 1));
    setIsCreateModalOpen(true);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = createGroupCode.trim();
    const name = createGroupName.trim();
    if (!code || !name) return;

    setIsSubmittingCreate(true);
    try {
      await masterService.createSubjectGroup({
        kode: code,
        nama: name,
        deskripsi: createGroupDeskripsi.trim(),
        urutan: createGroupUrutan ? Number(createGroupUrutan) : undefined,
        subject_ids: selectedSubjectIds.length > 0 ? selectedSubjectIds : undefined,
      });

      showBanner(
        'success',
        selectedSubjectIds.length > 0
          ? `Kelompok '${name}' dibuat dan diterapkan ke ${selectedSubjectIds.length} mapel.`
          : `Kelompok '${name}' berhasil ditambahkan.`
      );
      setIsCreateModalOpen(false);
      setCreateGroupCode('');
      setCreateGroupName('');
      setCreateGroupDeskripsi('');
      setCreateGroupUrutan('');
      setSelectedSubjectIds([]);
      await loadData();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || err.message || 'Gagal membuat kelompok');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenEditModal = (group: SubjectGroupSummary) => {
    setEditingGroup(group);
    setEditGroupCode(group.kode);
    setEditGroupName(group.nama);
    setEditGroupDeskripsi(group.deskripsi || '');
    setEditGroupUrutan(group.urutan ? String(group.urutan) : '1');
    setIsEditModalOpen(true);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    const code = editGroupCode.trim();
    const name = editGroupName.trim();
    if (!code || !name) return;

    setIsSubmittingEdit(true);
    try {
      await masterService.updateSubjectGroup(editingGroup.kode, {
        kode: code,
        nama: name,
        deskripsi: editGroupDeskripsi.trim(),
        urutan: editGroupUrutan ? Number(editGroupUrutan) : undefined,
      });

      showBanner('success', `Kelompok '${name}' berhasil diperbarui.`);
      setIsEditModalOpen(false);
      if (selectedGroupFilter === editingGroup.kode) {
        setSelectedGroupFilter(code);
      }
      setEditingGroup(null);
      await loadData();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || err.message || 'Gagal memperbarui kelompok');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenDeleteDialog = (group: SubjectGroupSummary) => {
    setEditingGroup(group);
    const fallbackGroup = groups.find((g) => g.kode !== group.kode);
    if (fallbackGroup) {
      setDeleteTargetKelompok(fallbackGroup.kode);
    }
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!editingGroup) return;

    setIsSubmittingDelete(true);
    try {
      await masterService.deleteSubjectGroup(
        editingGroup.kode,
        editingGroup.count > 0 ? deleteTargetKelompok : undefined
      );

      showBanner('success', `Kelompok '${editingGroup.nama}' berhasil dihapus.`);
      setIsDeleteDialogOpen(false);
      setIsEditModalOpen(false);
      if (selectedGroupFilter === editingGroup.kode) {
        setSelectedGroupFilter('all');
      }
      setEditingGroup(null);
      await loadData();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || err.message || 'Gagal menghapus kelompok');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // M3 Badge Styling
  const getGroupBadgeColor = (kode: string) => {
    switch (kode) {
      case 'A':
        return 'bg-m3-primary-container text-m3-on-primary-container border-m3-primary/20';
      case 'B':
        return 'bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary/20';
      case 'C':
        return 'bg-m3-tertiary-container text-m3-on-tertiary-container border-m3-tertiary/20';
      case 'Muatan Lokal':
      case 'MULOK':
        return 'bg-amber-100 text-amber-950 border-amber-300';
      default:
        return 'bg-m3-surface-variant text-m3-on-surface-variant border-m3-outline-variant';
    }
  };

  const isCoreGroup = (kode: string) => kode === 'A' || kode === 'B';

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-m3-outline-variant/30">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-m3-surface-container text-m3-on-surface-variant text-xs font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-m3-primary"></span>
            <span>Kurikulum Merdeka SMK</span>
            <span>•</span>
            <span>Struktur Rapor</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-m3-on-surface tracking-tight">
            Kelompok Mata Pelajaran & Urutan Rapor
          </h1>
          <p className="text-xs sm:text-sm text-m3-on-surface-variant mt-1.5 max-w-2xl leading-relaxed">
            Atur kelompok mata pelajaran dan urutan hierarki untuk pembagian tabel pada cetakan rapor PTS/STS.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link to="/settings/subjects">
            <M3Button variant="outlined" size="sm" icon={<Layers className="w-4 h-4" />}>
              Mata Pelajaran & TP
            </M3Button>
          </Link>

          <M3Button
            variant="filled"
            size="sm"
            onClick={handleOpenCreateModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Tambah Kelompok
          </M3Button>
        </div>
      </div>

      {/* Status Notification */}
      {statusBanner && (
        <div
          role="status"
          className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold transition-all ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
              : 'bg-m3-error-container text-m3-on-error-container border border-m3-error/20'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-m3-error shrink-0" />
            )}
            <span className="truncate">{statusBanner.message}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="p-1.5 rounded-full hover:bg-black/8 text-m3-on-surface-variant cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 ml-2"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating / Sticky Unsaved Changes Bar */}
      {hasUnsavedChanges && (
        <div className="sticky top-4 z-30 p-4 rounded-2xl bg-amber-500 text-slate-950 shadow-xl border border-amber-600/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0" />
            <div>
              <span className="text-xs sm:text-sm font-bold block">
                Perubahan Urutan Belum Disimpan
              </span>
              <span className="text-[11px] sm:text-xs text-slate-900">
                Klik 'Simpan Urutan Cetak' agar dokumen rapor dan file PDF dicetak sesuai urutan terbaru ini.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={handleResetOrder}
              disabled={isSavingOrder}
              className="px-3.5 py-1.5 rounded-xl border border-slate-950/30 text-xs font-bold hover:bg-black/10 transition-colors min-h-[38px] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSaveOrder}
              disabled={isSavingOrder}
              className="px-4 py-1.5 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-900 transition-colors shadow-md min-h-[38px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className={`w-3.5 h-3.5 ${isSavingOrder ? 'animate-spin' : ''}`} />
              {isSavingOrder ? 'Menyimpan...' : 'Simpan Urutan Cetak'}
            </button>
          </div>
        </div>
      )}

      {/* Mode View Tabs (Segmented Navigation) */}
      <div className="flex items-center gap-1 p-1 bg-m3-surface-container/70 rounded-2xl border border-m3-outline-variant/30 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('reorder')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[40px] ${
            activeTab === 'reorder'
              ? 'bg-m3-surface text-m3-primary shadow-m3-elevation-1 border border-m3-outline-variant/30'
              : 'text-m3-on-surface-variant hover:text-m3-on-surface'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Atur Urutan Cetak Rapor</span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[40px] ${
            activeTab === 'table'
              ? 'bg-m3-surface text-m3-primary shadow-m3-elevation-1 border border-m3-outline-variant/30'
              : 'text-m3-on-surface-variant hover:text-m3-on-surface'
          }`}
        >
          <TableIcon className="w-4 h-4" />
          <span>Tabel & Pengelompokan Mapel</span>
        </button>
      </div>

      {/* TAB 1: REORDER VIEW (DRAG & DROP + UP/DOWN BUTTONS) */}
      {activeTab === 'reorder' && (
        <div className="space-y-6">
          {/* Informational Guidance */}
          <div className="bg-m3-surface-container/60 border border-m3-outline-variant/40 rounded-2xl p-4.5 text-xs text-m3-on-surface-variant flex items-start gap-3">
            <Info className="w-5 h-5 text-m3-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-m3-on-surface text-xs sm:text-sm">
                Aturan & Panduan Urutan Cetak Rapor:
              </span>
              <p className="leading-relaxed">
                Pada halaman Rapor dan dokumen PDF, nilai siswa dicetak terbagi menurut sub-tabel kelompok.
                Urutan cetak dicetak dari <strong>Kelompok pertama ke terakhir</strong>, dan di dalam tiap kelompok dicetak sesuai <strong>urutan mata pelajaran (No. 1, 2, 3...)</strong>.
              </p>
              <div className="pt-1 flex items-center gap-3 text-[11px] text-m3-outline flex-wrap font-medium">
                <span>💡 Geser (drag & drop) mapel untuk memindahkan posisi</span>
                <span>•</span>
                <span>Gunakan tombol Naik/Turun untuk akses cepat</span>
                <span>•</span>
                <span>Dapat dipindahkan antar-kelompok</span>
              </div>
            </div>
          </div>

          {/* Group Hierarchy Container */}
          <div className="space-y-5">
            {isLoading ? (
              <div className="p-12 text-center text-m3-outline bg-m3-surface rounded-3xl border border-m3-outline-variant/30">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-m3-primary" />
                <span>Memuat struktur kelompok dan mata pelajaran...</span>
              </div>
            ) : orderedGroups.length === 0 ? (
              <div className="p-12 text-center text-m3-outline bg-m3-surface rounded-3xl border border-m3-outline-variant/30">
                Belum ada kelompok mata pelajaran terdaftar.
              </div>
            ) : (
              orderedGroups.map((group, groupIndex) => {
                const isCollapsed = !!collapsedGroups[group.kode];
                const subjects = group.subjects || [];
                const isGroupDropTarget =
                  dragOverTarget?.groupIndex === groupIndex &&
                  dragOverTarget?.subjectIndex === undefined;

                return (
                  <div
                    key={group.kode}
                    onDragOver={(e) => handleDragOverGroup(e, groupIndex)}
                    onDrop={(e) => handleDropSubject(e, groupIndex)}
                    className={`rounded-[24px] border transition-all ${
                      isGroupDropTarget
                        ? 'border-2 border-m3-primary bg-m3-primary-container/10 shadow-md'
                        : 'border-m3-outline-variant/40 bg-m3-surface shadow-xs'
                    }`}
                  >
                    {/* Group Header Card */}
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-m3-outline-variant/20 bg-m3-surface-container/30 rounded-t-[24px]">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Group Sequence Badge */}
                        <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-m3-primary text-m3-on-primary font-black text-sm shrink-0 shadow-xs">
                          <span className="text-[10px] uppercase font-bold opacity-80 leading-none">Sub</span>
                          <span>{groupIndex + 1}</span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getGroupBadgeColor(
                                group.kode
                              )}`}
                            >
                              Kelompok {group.kode}
                            </span>
                            <span className="text-sm sm:text-base font-bold text-m3-on-surface truncate">
                              {group.nama}
                            </span>
                          </div>
                          <div className="text-[11px] text-m3-on-surface-variant line-clamp-1 mt-0.5">
                            {group.deskripsi || 'Kelompok mata pelajaran'}
                          </div>
                        </div>
                      </div>

                      {/* Group Header Actions */}
                      <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-m3-surface text-m3-on-surface-variant border border-m3-outline-variant/40 mr-1">
                          {subjects.length} Mapel
                        </span>

                        {/* Move Group Up */}
                        <button
                          type="button"
                          onClick={() => moveGroup(groupIndex, 'up')}
                          disabled={groupIndex === 0}
                          className="p-2 rounded-xl text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container disabled:opacity-30 disabled:pointer-events-none cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center border border-m3-outline-variant/30"
                          title="Pindahkan Kelompok ke Atas"
                          aria-label={`Pindahkan kelompok ${group.nama} ke atas`}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>

                        {/* Move Group Down */}
                        <button
                          type="button"
                          onClick={() => moveGroup(groupIndex, 'down')}
                          disabled={groupIndex === orderedGroups.length - 1}
                          className="p-2 rounded-xl text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container disabled:opacity-30 disabled:pointer-events-none cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center border border-m3-outline-variant/30"
                          title="Pindahkan Kelompok ke Bawah"
                          aria-label={`Pindahkan kelompok ${group.nama} ke bawah`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {/* Sort A-Z Inside Group */}
                        {subjects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => sortGroupAlphabetically(groupIndex)}
                            className="p-2 rounded-xl text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-primary-container/20 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center border border-m3-outline-variant/30"
                            title="Urutkan Abjad A-Z di Kelompok Ini"
                            aria-label={`Urutkan abjad mapel di kelompok ${group.nama}`}
                          >
                            <ArrowDownAZ className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Group */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(group)}
                          className="p-2 rounded-xl text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center border border-m3-outline-variant/30"
                          title="Edit Info Kelompok"
                          aria-label={`Edit info kelompok ${group.nama}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Collapse/Expand */}
                        <button
                          type="button"
                          onClick={() => toggleGroupCollapse(group.kode)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-m3-on-surface-variant hover:bg-m3-surface-container cursor-pointer border border-m3-outline-variant/30 min-h-[38px]"
                        >
                          {isCollapsed ? 'Buka' : 'Tutup'}
                        </button>
                      </div>
                    </div>

                    {/* Group Subject List */}
                    {!isCollapsed && (
                      <div className="p-3 sm:p-4 space-y-2.5 min-h-[80px]">
                        {subjects.length === 0 ? (
                          <div className="p-8 text-center text-m3-outline border border-dashed border-m3-outline-variant/60 rounded-2xl bg-m3-surface-container/20 text-xs">
                            Belum ada mata pelajaran pada kelompok ini.
                            <div className="mt-1 text-[11px] text-m3-outline-variant">
                              Tarik mapel ke sini atau gunakan opsi ubah kelompok untuk memindahkannya.
                            </div>
                          </div>
                        ) : (
                          subjects.map((sub, subjectIndex) => {
                            const isBeingDragged =
                              draggingItem?.subjectId === sub.id;
                            const isDropTarget =
                              dragOverTarget?.groupIndex === groupIndex &&
                              dragOverTarget?.subjectIndex === subjectIndex;

                            return (
                              <div
                                key={sub.id}
                                draggable
                                onDragStart={(e) =>
                                  handleDragStart(e, groupIndex, subjectIndex, sub.id)
                                }
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) =>
                                  handleDragOverSubject(e, groupIndex, subjectIndex)
                                }
                                onDrop={(e) =>
                                  handleDropSubject(e, groupIndex, subjectIndex)
                                }
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all ${
                                  isBeingDragged
                                    ? 'opacity-40 border-2 border-dashed border-m3-primary bg-m3-primary-container/20 scale-[0.98]'
                                    : isDropTarget
                                    ? 'border-2 border-m3-primary bg-m3-primary-container/20 shadow-sm'
                                    : 'bg-m3-surface border-m3-outline-variant/30 hover:border-m3-outline hover:shadow-xs'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Drag Handle */}
                                  <div
                                    className="p-1 text-m3-outline hover:text-m3-on-surface cursor-grab active:cursor-grabbing shrink-0 touch-none"
                                    title="Tahan dan geser untuk memindahkan urutan"
                                    aria-hidden="true"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>

                                  {/* Nomor Urut Mapel */}
                                  <span className="w-7 h-7 rounded-lg bg-m3-surface-container text-m3-on-surface font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-m3-outline-variant/40">
                                    {subjectIndex + 1}
                                  </span>

                                  {/* Subject Information */}
                                  <div className="min-w-0">
                                    <div className="text-xs sm:text-sm font-bold text-m3-on-surface truncate">
                                      {sub.nama}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-m3-outline font-mono flex-wrap">
                                      {sub.dapodik_mapel_id && (
                                        <span>Dapodik ID: {sub.dapodik_mapel_id}</span>
                                      )}
                                      <span>•</span>
                                      <span>{sub.learning_objective_count || 0} TP</span>
                                      {sub.is_manual_override && (
                                        <>
                                          <span>•</span>
                                          <span className="text-amber-800 font-sans font-semibold">
                                            Kustom
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Subject Control Actions */}
                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                  {/* Move to another group selector */}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-m3-outline hidden lg:inline">
                                      Kelompok:
                                    </span>
                                    <select
                                      value={group.kode}
                                      onChange={(e) =>
                                        handleInlineMoveToGroup(
                                          groupIndex,
                                          subjectIndex,
                                          e.target.value
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-xl border border-m3-outline-variant/60 text-xs font-semibold bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary cursor-pointer min-h-[34px]"
                                      aria-label={`Ubah kelompok untuk ${sub.nama}`}
                                    >
                                      {orderedGroups.map((g) => (
                                        <option key={g.kode} value={g.kode}>
                                          Kelompok {g.kode}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Up / Down Buttons for Easy One-Click Reorder */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => moveSubject(groupIndex, subjectIndex, 'up')}
                                      disabled={subjectIndex === 0}
                                      className="p-1.5 rounded-lg text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container disabled:opacity-20 disabled:pointer-events-none cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center border border-m3-outline-variant/30"
                                      title="Pindah ke Atas"
                                      aria-label={`Pindahkan ${sub.nama} ke atas`}
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveSubject(groupIndex, subjectIndex, 'down')
                                      }
                                      disabled={subjectIndex === subjects.length - 1}
                                      className="p-1.5 rounded-lg text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container disabled:opacity-20 disabled:pointer-events-none cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center border border-m3-outline-variant/30"
                                      title="Pindah ke Bawah"
                                      aria-label={`Pindahkan ${sub.nama} ke bawah`}
                                    >
                                      <ChevronDown className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TABLE & GROUP MANAGEMENT VIEW */}
      {activeTab === 'table' && (
        <div className="space-y-6">
          {/* M3 Cards Overview & Interactive Filter Deck */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-m3-on-surface-variant uppercase tracking-wider">
                  Kelompok Terdaftar ({groups.length})
                </h2>
                <span className="text-[11px] text-m3-outline">• Klik kartu untuk filter tabel</span>
              </div>
              {selectedGroupFilter !== 'all' && (
                <button
                  onClick={() => setSelectedGroupFilter('all')}
                  className="text-xs font-bold text-m3-primary hover:underline cursor-pointer"
                >
                  Reset Filter ({allSubjects.length} Mapel)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {groups.map((group) => {
                const isSelected = selectedGroupFilter === group.kode;
                return (
                  <div
                    key={group.kode}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedGroupFilter(isSelected ? 'all' : group.kode)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedGroupFilter(isSelected ? 'all' : group.kode);
                      }
                    }}
                    className={`p-5 rounded-[24px] transition-all cursor-pointer flex flex-col justify-between group relative focus:outline-none focus:ring-2 focus:ring-m3-primary/30 ${
                      isSelected
                        ? 'bg-m3-primary-container/30 border-2 border-m3-primary text-m3-on-primary-container shadow-m3-elevation-1'
                        : 'bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary/40 hover:shadow-m3-elevation-1'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-2.5">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getGroupBadgeColor(
                            group.kode
                          )}`}
                        >
                          Kelompok {group.kode}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(group);
                            }}
                            className="p-1.5 rounded-full text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-on-surface/8 transition-colors cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                            title={`Edit Kelompok ${group.kode}`}
                            aria-label={`Edit kelompok ${group.kode}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {!isCoreGroup(group.kode) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDeleteDialog(group);
                              }}
                              className="p-1.5 rounded-full text-m3-on-surface-variant hover:text-m3-error hover:bg-m3-error-container/40 transition-colors cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                              title={`Hapus Kelompok ${group.kode}`}
                              aria-label={`Hapus kelompok ${group.kode}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-m3-on-surface leading-snug">
                        {group.nama}
                      </h3>
                      <p className="text-[11px] text-m3-on-surface-variant line-clamp-2 mt-1.5 leading-relaxed">
                        {group.deskripsi || 'Tidak ada deskripsi kelompok.'}
                      </p>
                    </div>

                    <div className="pt-3.5 mt-3.5 border-t border-m3-outline-variant/20 flex items-center justify-between text-xs">
                      <span className="font-bold text-m3-on-surface">
                        {group.count}{' '}
                        <span className="text-[11px] font-normal text-m3-on-surface-variant">
                          Mapel
                        </span>
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          isSelected ? 'text-m3-primary' : 'text-m3-outline'
                        }`}
                      >
                        {isSelected ? 'Sedang difilter' : 'Filter tabel'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Table Container */}
          <M3Card variant="elevated" className="p-5 sm:p-6 space-y-4">
            {/* Table Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-m3-on-surface">
                  Daftar Mata Pelajaran
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-m3-surface-container text-m3-on-surface-variant">
                  {filteredSubjects.length} dari {allSubjects.length} Mapel
                </span>
                {selectedGroupFilter !== 'all' && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-m3-primary-container text-m3-on-primary-container">
                    Filter: Kelompok {selectedGroupFilter}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="w-full sm:w-72">
                  <M3TextField
                    placeholder="Cari mata pelajaran..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leadingIcon={<Search className="w-4 h-4" />}
                  />
                </div>

                <M3Button
                  variant="outlined"
                  size="sm"
                  onClick={loadData}
                  disabled={isLoading}
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
                >
                  Segarkan
                </M3Button>
              </div>
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedSubjectIds.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-m3-on-surface text-m3-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-m3-elevation-3">
                <div className="flex items-center gap-2.5 pl-1 sm:pl-2">
                  <span className="w-6 h-6 rounded-full bg-m3-primary text-m3-on-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {selectedSubjectIds.length}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold">
                    Mata pelajaran terpilih
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap pr-1 sm:pr-2">
                  <span className="text-xs text-m3-outline-variant shrink-0">Pindahkan ke:</span>
                  <select
                    value={bulkTargetKelompok}
                    onChange={(e) => setBulkTargetKelompok(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-white border border-slate-700 text-xs font-semibold focus:outline-none min-h-[36px] cursor-pointer"
                  >
                    {groups.map((g) => (
                      <option key={g.kode} value={g.kode}>
                        {g.nama}
                      </option>
                    ))}
                  </select>

                  <M3Button
                    variant="filled"
                    size="sm"
                    onClick={handleApplyBulkKelompok}
                    disabled={isSubmittingBulk}
                    icon={<MoveRight className="w-3.5 h-3.5" />}
                  >
                    {isSubmittingBulk ? 'Menyimpan...' : 'Terapkan'}
                  </M3Button>

                  <M3Button
                    variant="text"
                    size="sm"
                    onClick={() => setSelectedSubjectIds([])}
                    className="text-white hover:bg-white/10"
                  >
                    Batal
                  </M3Button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-[20px] border border-m3-outline-variant/30">
              <table className="w-full text-left text-xs text-m3-on-surface min-w-[720px]">
                <thead className="bg-m3-surface-container/60 border-b border-m3-outline-variant/30 font-bold text-m3-on-surface">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedSubjectIds.length === filteredSubjects.length &&
                          filteredSubjects.length > 0
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded border-m3-outline text-m3-primary focus:ring-m3-primary cursor-pointer w-4 h-4"
                        aria-label="Pilih semua mata pelajaran"
                      />
                    </th>
                    <th className="p-3.5 w-16 text-center">Urutan</th>
                    <th className="p-3.5">Mata Pelajaran</th>
                    <th className="p-3.5 w-40">Kelompok Saat Ini</th>
                    <th className="p-3.5 w-60">Ubah Cepat Kelompok</th>
                    <th className="p-3.5 w-24 text-center">TP</th>
                    <th className="p-3.5 w-28 text-center">Sumber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-outline-variant/20 bg-m3-surface">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-m3-outline">
                        Memuat data mata pelajaran...
                      </td>
                    </tr>
                  ) : filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-m3-outline">
                        Tidak ada mata pelajaran yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((sub) => {
                      const isSelected = selectedSubjectIds.includes(sub.id);
                      return (
                        <tr
                          key={sub.id}
                          className={`hover:bg-m3-surface-container/30 transition-colors ${
                            isSelected ? 'bg-m3-primary-container/20' : ''
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectSubject(sub.id)}
                              className="rounded border-m3-outline text-m3-primary focus:ring-m3-primary cursor-pointer w-4 h-4"
                              aria-label={`Pilih ${sub.nama}`}
                            />
                          </td>
                          <td className="p-3.5 text-center font-mono text-m3-outline font-bold">
                            #{sub.urutan || '-'}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-m3-on-surface">{sub.nama}</div>
                            <div className="text-[11px] font-mono text-m3-outline mt-0.5">
                              {sub.dapodik_mapel_id
                                ? `ID Dapodik: ${sub.dapodik_mapel_id}`
                                : sub.id}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getGroupBadgeColor(
                                sub.kelompok
                              )}`}
                            >
                              Kelompok {sub.kelompok || 'B'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <select
                              value={sub.kelompok || 'B'}
                              onChange={(e) =>
                                handleInlineChangeKelompok(sub.id, e.target.value)
                              }
                              className="w-full px-3 py-1.5 rounded-xl border border-m3-outline-variant/60 text-xs font-semibold bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary cursor-pointer min-h-[36px]"
                            >
                              {groups.map((g) => (
                                <option key={g.kode} value={g.kode}>
                                  {g.nama}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="font-semibold text-m3-on-surface-variant px-2.5 py-0.5 bg-m3-surface-container rounded-full">
                              {sub.learning_objective_count || 0}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {sub.is_manual_override ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                                <ShieldCheck className="w-3 h-3 text-amber-700" />
                                Kustom
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-300">
                                <Database className="w-3 h-3 text-blue-700" />
                                Dapodik
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </M3Card>
        </div>
      )}

      {/* Dialog: Tambah Kelompok Baru */}
      <M3Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tambah Kelompok Mata Pelajaran"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <M3TextField
            label="Kode Kelompok"
            required
            value={createGroupCode}
            onChange={(e) => setCreateGroupCode(e.target.value)}
            placeholder="Contoh: D, MULOK, PILIHAN"
            helperText="Kode unik singkat tanpa spasi."
          />

          <M3TextField
            label="Nama Lengkap Kelompok"
            required
            value={createGroupName}
            onChange={(e) => setCreateGroupName(e.target.value)}
            placeholder="Contoh: Kelompok D (Mata Pelajaran Pilihan)"
            helperText="Nama resmi yang dicetak sebagai sub-judul nilai pada rapor."
          />

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Deskripsi Kelompok
            </label>
            <textarea
              rows={2}
              value={createGroupDeskripsi}
              onChange={(e) => setCreateGroupDeskripsi(e.target.value)}
              placeholder="Keterangan cakupan mata pelajaran..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface text-xs sm:text-sm focus:outline-none focus:border-m3-primary resize-none"
            />
          </div>

          <M3TextField
            label="Urutan di Dokumen Rapor"
            type="number"
            value={createGroupUrutan}
            onChange={(e) => setCreateGroupUrutan(e.target.value)}
            placeholder="Contoh: 4"
          />

          {selectedSubjectIds.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-m3-primary-container text-m3-on-primary-container text-xs">
              {selectedSubjectIds.length} mata pelajaran yang dicentang akan otomatis dipindahkan ke kelompok baru ini.
            </div>
          )}

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2.5">
            <M3Button variant="text" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Batal
            </M3Button>
            <M3Button variant="filled" type="submit" disabled={isSubmittingCreate}>
              {isSubmittingCreate ? 'Menyimpan...' : 'Simpan Kelompok'}
            </M3Button>
          </div>
        </form>
      </M3Dialog>

      {/* Dialog: Edit Kelompok */}
      <M3Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Kelompok: ${editingGroup?.nama || ''}`}
      >
        <form onSubmit={handleUpdateGroup} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-m3-surface-container text-xs text-m3-on-surface flex items-center justify-between">
            <span className="font-semibold text-m3-on-surface-variant">Mata Pelajaran Terdaftar:</span>
            <span className="font-bold text-m3-primary font-mono">
              {editingGroup?.count || 0} Mapel
            </span>
          </div>

          <M3TextField
            label="Kode Kelompok"
            required
            value={editGroupCode}
            onChange={(e) => setEditGroupCode(e.target.value)}
            helperText={
              editingGroup && editGroupCode !== editingGroup.kode
                ? `Catatan: ${editingGroup.count} mapel di kelompok ini akan otomatis dipindahkan ke kode '${editGroupCode}'.`
                : undefined
            }
          />

          <M3TextField
            label="Nama Lengkap Kelompok"
            required
            value={editGroupName}
            onChange={(e) => setEditGroupName(e.target.value)}
          />

          <div>
            <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
              Deskripsi Kelompok
            </label>
            <textarea
              rows={2}
              value={editGroupDeskripsi}
              onChange={(e) => setEditGroupDeskripsi(e.target.value)}
              placeholder="Keterangan cakupan mata pelajaran..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline bg-m3-surface text-m3-on-surface text-xs sm:text-sm focus:outline-none focus:border-m3-primary resize-none"
            />
          </div>

          <M3TextField
            label="Urutan di Dokumen Rapor"
            type="number"
            value={editGroupUrutan}
            onChange={(e) => setEditGroupUrutan(e.target.value)}
          />

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-between gap-2.5">
            <div>
              {editingGroup && !isCoreGroup(editingGroup.kode) && (
                <M3Button
                  variant="danger"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    handleOpenDeleteDialog(editingGroup);
                  }}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Hapus
                </M3Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <M3Button variant="text" type="button" onClick={() => setIsEditModalOpen(false)}>
                Batal
              </M3Button>
              <M3Button variant="filled" type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </M3Button>
            </div>
          </div>
        </form>
      </M3Dialog>

      {/* Dialog: Hapus Kelompok */}
      <M3Dialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Hapus Kelompok"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-m3-error-container text-m3-on-error-container text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-m3-error shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Hapus kelompok '{editingGroup?.nama}'?
              </p>
              <p className="mt-1 text-m3-on-error-container/90">
                Tindakan ini permanen dan tidak dapat dibatalkan.
              </p>
            </div>
          </div>

          {editingGroup && editingGroup.count > 0 && (
            <div>
              <label className="block text-xs font-bold text-m3-on-surface-variant mb-1.5">
                Alihkan {editingGroup.count} mata pelajaran yang ada ke:
              </label>
              <select
                value={deleteTargetKelompok}
                onChange={(e) => setDeleteTargetKelompok(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-m3-outline text-xs sm:text-sm font-semibold bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary cursor-pointer min-h-[44px]"
              >
                {groups
                  .filter((g) => g.kode !== editingGroup?.kode)
                  .map((g) => (
                    <option key={g.kode} value={g.kode}>
                      {g.nama}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="pt-4 border-t border-m3-outline-variant/30 flex items-center justify-end gap-2.5">
            <M3Button variant="text" type="button" onClick={() => setIsDeleteDialogOpen(false)}>
              Batal
            </M3Button>
            <M3Button
              variant="danger"
              type="button"
              disabled={isSubmittingDelete}
              onClick={handleDeleteGroup}
            >
              {isSubmittingDelete ? 'Menghapus...' : 'Hapus Kelompok'}
            </M3Button>
          </div>
        </div>
      </M3Dialog>
    </div>
  );
};
