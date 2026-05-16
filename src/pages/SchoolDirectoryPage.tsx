import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { Building2, Check, PencilLine, Plus, Search, X } from 'lucide-react';
import { ProfessorCard } from '../components/ProfessorCard';
import { ProfessorFormDialog } from '../components/ProfessorFormDialog';
import { ProfessorTimelineDrawer } from '../components/ProfessorTimelineDrawer';
import { useListOrderPreferences } from '../hooks/useListOrderPreferences';
import { useTimeline } from '../hooks/useTimeline';
import { useI18n } from '../lib/i18n';
import { moveKeyToDropPosition, orderItems } from '../lib/listOrdering';
import { cn } from '../lib/utils';
import { PROFESSOR_STATUSES, type Professor, type ProfessorDraft, type ProfessorStatus } from '../types/professor';
import type { TimelineEventDraft } from '../types/timeline';

interface SchoolDirectoryPageProps {
  professors: Professor[];
  isLoading: boolean;
  error: string | null;
  onCreateProfessor: (draft: ProfessorDraft) => Promise<void>;
  onUpdateProfessor: (id: string, draft: ProfessorDraft) => Promise<void>;
  onTrashProfessor: (id: string) => Promise<void>;
  onCreateTimelineEvent: (draft: TimelineEventDraft) => Promise<void>;
}

const ALL_COLLEGES_ID = 'all-colleges';
const COLLEGE_NOT_SET_ID = 'college-not-set';
type DropPosition = 'before' | 'after';

function getDropPosition(event: DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

export function SchoolDirectoryPage({
  professors,
  isLoading,
  error,
  onCreateProfessor,
  onUpdateProfessor,
  onTrashProfessor,
  onCreateTimelineEvent,
}: SchoolDirectoryPageProps) {
  const { getStatusLabel, locale, t } = useI18n();
  const { preferences, save: saveOrderPreferences } = useListOrderPreferences();
  const activeProfessors = useMemo(() => professors.filter((professor) => !professor.deletedAt), [professors]);
  const availableStatuses = useMemo(
    () =>
      Array.from(
        new Set([
          ...PROFESSOR_STATUSES,
          ...activeProfessors
            .map((professor) => professor.status)
            .filter((status) => status.trim()),
        ]),
      ),
    [activeProfessors],
  );
  const schoolGroups = useMemo(() => {
    const groups = new Map<string, Professor[]>();

    activeProfessors.forEach((professor) => {
      const school = professor.school.trim() || t('schoolNotSet');
      groups.set(school, [...(groups.get(school) ?? []), professor]);
    });

    const sortedGroups = Array.from(groups.entries())
      .map(([school, records]) => ({
        school,
        professors: records,
        statusCounts: availableStatuses
          .map((status) => ({
            status,
            count: records.filter((professor) => professor.status === status).length,
          }))
          .filter((item) => item.count > 0),
      }))
      .sort((left, right) => right.professors.length - left.professors.length || left.school.localeCompare(right.school, locale === 'zh' ? 'zh-CN' : 'en-US'));

    return orderItems(sortedGroups, preferences.schools, (group) => group.school);
  }, [activeProfessors, availableStatuses, locale, preferences.schools, t]);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [selectedCollegeId, setSelectedCollegeId] = useState(ALL_COLLEGES_ID);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProfessorStatus>('all');
  const [draggedSchool, setDraggedSchool] = useState<string | null>(null);
  const [draggedCollegeId, setDraggedCollegeId] = useState<string | null>(null);
  const [schoolDropTarget, setSchoolDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const [collegeDropTarget, setCollegeDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [detailProfessor, setDetailProfessor] = useState<Professor | null>(null);
  const [isRenamingSchool, setIsRenamingSchool] = useState(false);
  const [schoolNameDraft, setSchoolNameDraft] = useState('');
  const [isSavingSchoolName, setIsSavingSchoolName] = useState(false);
  const timeline = useTimeline(detailProfessor?.id ?? null);

  const selectedGroup = schoolGroups.find((group) => group.school === selectedSchool) ?? schoolGroups[0] ?? null;
  const collegeGroups = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    const groups = new Map<string, { college: string; professors: Professor[] }>();

    selectedGroup.professors.forEach((professor) => {
      const college = professor.college.trim();
      const id = college ? `college:${college}` : COLLEGE_NOT_SET_ID;
      const label = college || t('collegeNotSet');
      const group = groups.get(id);

      if (group) {
        group.professors.push(professor);
        return;
      }

      groups.set(id, { college: label, professors: [professor] });
    });

    const collegeRecords = Array.from(groups.entries())
      .map(([id, group]) => ({
        id,
        college: group.college,
        professors: group.professors,
        statusCounts: availableStatuses
          .map((status) => ({
            status,
            count: group.professors.filter((professor) => professor.status === status).length,
          }))
          .filter((item) => item.count > 0),
      }))
      .sort((left, right) => right.professors.length - left.professors.length || left.college.localeCompare(right.college, locale === 'zh' ? 'zh-CN' : 'en-US'));
    const orderedCollegeRecords = orderItems(
      collegeRecords,
      preferences.collegesBySchool[selectedGroup.school] ?? [],
      (group) => group.id,
    );

    return [
      {
        id: ALL_COLLEGES_ID,
        college: t('allColleges'),
        professors: selectedGroup.professors,
        statusCounts: selectedGroup.statusCounts,
      },
      ...orderedCollegeRecords,
    ];
  }, [availableStatuses, locale, preferences.collegesBySchool, selectedGroup, t]);
  const actualCollegeGroups = collegeGroups.filter((group) => group.id !== ALL_COLLEGES_ID);
  const shouldShowCollegeIndex = actualCollegeGroups.length > 1;
  const selectedCollegeGroup = shouldShowCollegeIndex
    ? collegeGroups.find((group) => group.id === selectedCollegeId) ?? collegeGroups[0] ?? null
    : collegeGroups[0] ?? null;
  const defaultSchoolForCreate = selectedGroup?.school === t('schoolNotSet') ? '' : (selectedGroup?.school ?? '');
  const defaultCollegeForCreate =
    shouldShowCollegeIndex && selectedCollegeGroup && selectedCollegeGroup.id !== ALL_COLLEGES_ID && selectedCollegeGroup.id !== COLLEGE_NOT_SET_ID
      ? selectedCollegeGroup.college
      : !shouldShowCollegeIndex && actualCollegeGroups.length === 1 && actualCollegeGroups[0].id !== COLLEGE_NOT_SET_ID
      ? actualCollegeGroups[0].college
      : '';
  const collegeTitle = shouldShowCollegeIndex ? selectedCollegeGroup?.college : actualCollegeGroups[0]?.college;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleProfessors = (selectedCollegeGroup?.professors ?? [])
    .filter((professor) => (statusFilter === 'all' ? true : professor.status === statusFilter))
    .filter((professor) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        professor.name,
        professor.title,
        professor.college,
        professor.email,
        professor.homepage,
        professor.researchArea,
        professor.status,
        professor.notes,
        professor.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);

  const groupedByStatus = availableStatuses
    .map((status) => ({
      status,
      professors: visibleProfessors.filter((professor) => professor.status === status),
    }))
    .filter((group) => group.professors.length > 0);

  const openCreateDialog = () => {
    setEditingProfessor(null);
    setDialogOpen(true);
  };

  const openEditDialog = (professor: Professor) => {
    setEditingProfessor(professor);
    setDialogOpen(true);
  };

  const openRenameSchool = () => {
    if (!selectedGroup) {
      return;
    }

    setSchoolNameDraft(selectedGroup.school === t('schoolNotSet') ? '' : selectedGroup.school);
    setIsRenamingSchool(true);
  };

  const cancelRenameSchool = () => {
    setIsRenamingSchool(false);
    setSchoolNameDraft('');
  };

  const handleRenameSchool = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGroup) {
      return;
    }

    const nextSchool = schoolNameDraft.trim();
    if (!nextSchool || nextSchool === defaultSchoolForCreate) {
      cancelRenameSchool();
      return;
    }

    setIsSavingSchoolName(true);
    try {
      for (const professor of selectedGroup.professors) {
        await onUpdateProfessor(professor.id, {
          name: professor.name,
          title: professor.title,
          school: nextSchool,
          college: professor.college,
          email: professor.email,
          homepage: professor.homepage,
          researchArea: professor.researchArea,
          status: professor.status,
          tags: professor.tags,
          firstContactDate: professor.firstContactDate,
          lastContactDate: professor.lastContactDate,
          notes: professor.notes,
        });
      }
      setSelectedSchool(nextSchool);
      setSelectedCollegeId(ALL_COLLEGES_ID);
      cancelRenameSchool();
    } finally {
      setIsSavingSchoolName(false);
    }
  };

  const handleDropSchool = async (targetSchool: string, position: DropPosition) => {
    if (!draggedSchool || draggedSchool === targetSchool) {
      setDraggedSchool(null);
      setSchoolDropTarget(null);
      return;
    }

    const currentOrder = schoolGroups.map((group) => group.school);
    const nextSchools = moveKeyToDropPosition(currentOrder, draggedSchool, targetSchool, position);
    setDraggedSchool(null);
    setSchoolDropTarget(null);
    await saveOrderPreferences({
      ...preferences,
      schools: nextSchools,
    });
  };

  const handleDropCollege = async (targetCollegeId: string, position: DropPosition) => {
    if (!draggedCollegeId || draggedCollegeId === targetCollegeId || targetCollegeId === ALL_COLLEGES_ID) {
      setDraggedCollegeId(null);
      setCollegeDropTarget(null);
      return;
    }

    const school = selectedGroup?.school;
    if (!school) {
      setDraggedCollegeId(null);
      setCollegeDropTarget(null);
      return;
    }

    const currentOrder = actualCollegeGroups.map((group) => group.id);
    const nextCollegeIds = moveKeyToDropPosition(currentOrder, draggedCollegeId, targetCollegeId, position);
    setDraggedCollegeId(null);
    setCollegeDropTarget(null);
    await saveOrderPreferences({
      ...preferences,
      collegesBySchool: {
        ...preferences.collegesBySchool,
        [school]: nextCollegeIds,
      },
    });
  };

  const handleSubmit = async (draft: ProfessorDraft, professorId?: string) => {
    const nextDraft = professorId || !selectedGroup
      ? draft
      : {
          ...draft,
          school: draft.school.trim() || defaultSchoolForCreate,
          college: draft.college.trim() || defaultCollegeForCreate,
        };

    if (professorId) {
      await onUpdateProfessor(professorId, nextDraft);
      return;
    }

    await onCreateProfessor(nextDraft);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 py-8 md:px-12">
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="shrink-0 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('schoolViewEyebrow')}</p>
            <h1 className="mt-3 text-4xl font-serif font-medium tracking-tight text-stone-900">{t('schoolDirectory')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">{t('schoolDirectoryDesc')}</p>
          </div>
          <button
            onClick={openCreateDialog}
            className="inline-flex items-center justify-center space-x-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addProfessor')}</span>
          </button>
        </div>

        {error && <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>}

        {isLoading ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-stone-200 bg-white px-6 py-16 text-center text-sm text-stone-400">
            {t('loadingProfessorRecords')}
          </div>
        ) : schoolGroups.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
            <p className="text-lg font-medium text-stone-700">{t('noProfessorsMatch')}</p>
            <p className="mt-2 text-sm text-stone-400">{t('createFirstProfessor')}</p>
          </div>
        ) : (
          <div className={`mt-8 grid min-h-0 flex-1 gap-6 xl:grid-rows-[minmax(0,1fr)] ${shouldShowCollegeIndex ? 'xl:grid-cols-[18rem_16rem_minmax(0,1fr)]' : 'xl:grid-cols-[18rem_minmax(0,1fr)]'}`}>
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="shrink-0 flex items-center gap-2 px-2 pb-3">
                <Building2 className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-stone-900">{t('schoolIndex')}</h2>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-1 pr-1">
                {schoolGroups.map((group) => {
                  const selected = selectedGroup?.school === group.school;
                  return (
                    <button
                      key={group.school}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        setDraggedSchool(group.school);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', group.school);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setSchoolDropTarget({ id: group.school, position: getDropPosition(event) });
                      }}
                      onDragLeave={() => {
                        setSchoolDropTarget((current) => (current?.id === group.school ? null : current));
                      }}
                      onDragEnd={() => {
                        setDraggedSchool(null);
                        setSchoolDropTarget(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        void handleDropSchool(group.school, getDropPosition(event));
                      }}
                      onClick={() => {
                        setSelectedSchool(group.school);
                        setSelectedCollegeId(ALL_COLLEGES_ID);
                      }}
                      className={`relative w-full rounded-[1.25rem] px-4 py-3 text-left transition-colors ${selected ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'} ${draggedSchool === group.school ? 'opacity-50' : ''}`}
                    >
                      {schoolDropTarget?.id === group.school && draggedSchool !== group.school && (
                        <span
                          className={cn(
                            'pointer-events-none absolute left-4 right-4 z-10 h-0.5 rounded-full bg-accent shadow-sm shadow-accent/30',
                            schoolDropTarget.position === 'before' ? '-top-1' : '-bottom-1',
                          )}
                        />
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{group.school}</span>
                        <span className={`text-xs ${selected ? 'text-stone-300' : 'text-stone-400'}`}>{group.professors.length}</span>
                      </div>
                      <p className={`mt-2 line-clamp-2 text-xs leading-5 ${selected ? 'text-stone-300' : 'text-stone-500'}`}>
                        {group.statusCounts.map((item) => `${getStatusLabel(item.status)} ${item.count}`).join(' / ')}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            {shouldShowCollegeIndex && (
              <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm">
                <div className="shrink-0 flex items-center gap-2 px-2 pb-3">
                  <Building2 className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-stone-900">{t('collegeIndex')}</h2>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-1 pr-1">
                  {collegeGroups.map((group) => {
                    const selected = selectedCollegeGroup?.id === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        draggable={group.id !== ALL_COLLEGES_ID}
                        onDragStart={(event) => {
                          if (group.id === ALL_COLLEGES_ID) {
                            return;
                          }
                          setDraggedCollegeId(group.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', group.id);
                        }}
                        onDragOver={(event) => {
                          if (group.id !== ALL_COLLEGES_ID) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            setCollegeDropTarget({ id: group.id, position: getDropPosition(event) });
                          }
                        }}
                        onDragLeave={() => {
                          setCollegeDropTarget((current) => (current?.id === group.id ? null : current));
                        }}
                        onDragEnd={() => {
                          setDraggedCollegeId(null);
                          setCollegeDropTarget(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          void handleDropCollege(group.id, getDropPosition(event));
                        }}
                        onClick={() => setSelectedCollegeId(group.id)}
                        className={`relative w-full rounded-[1.25rem] px-4 py-3 text-left transition-colors ${selected ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'} ${draggedCollegeId === group.id ? 'opacity-50' : ''}`}
                      >
                        {collegeDropTarget?.id === group.id && draggedCollegeId !== group.id && group.id !== ALL_COLLEGES_ID && (
                          <span
                            className={cn(
                              'pointer-events-none absolute left-4 right-4 z-10 h-0.5 rounded-full bg-accent shadow-sm shadow-accent/30',
                              collegeDropTarget.position === 'before' ? '-top-1' : '-bottom-1',
                            )}
                          />
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold">{group.college}</span>
                          <span className={`text-xs ${selected ? 'text-stone-300' : 'text-stone-400'}`}>{group.professors.length}</span>
                        </div>
                        <p className={`mt-2 line-clamp-2 text-xs leading-5 ${selected ? 'text-stone-300' : 'text-stone-500'}`}>
                          {group.statusCounts.map((item) => `${getStatusLabel(item.status)} ${item.count}`).join(' / ')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            <div className="min-h-0 min-w-0 overflow-y-auto pr-1">
              <div className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('school')} / {t('college')}</p>
                    {isRenamingSchool ? (
                      <form onSubmit={(event) => void handleRenameSchool(event)} className="mt-2 flex max-w-xl items-center gap-2">
                        <input
                          autoFocus
                          required
                          value={schoolNameDraft}
                          onChange={(event) => setSchoolNameDraft(event.target.value)}
                          placeholder={t('schoolNamePlaceholder')}
                          className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xl font-semibold tracking-tight text-stone-900 outline-none transition-colors focus:border-accent"
                        />
                        <button
                          type="submit"
                          disabled={isSavingSchoolName}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                          title={t('saveChanges')}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRenameSchool}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition-colors hover:bg-stone-50"
                          title={t('cancel')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="mt-2 flex min-w-0 items-center gap-2">
                        <h2 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-stone-900">{selectedGroup?.school}</h2>
                        {selectedGroup && (
                          <button
                            type="button"
                            onClick={openRenameSchool}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                            title={t('renameSchool')}
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                    {collegeTitle && <p className="mt-1 text-sm text-stone-500">{collegeTitle}</p>}
                  </div>
                  <div className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-500">
                    {t('recordCount', {
                      count: visibleProfessors.length,
                      suffix: locale === 'en' && visibleProfessors.length === 1 ? '' : 's',
                    })}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t('searchProfessors')}
                      className="w-full rounded-full border border-stone-200 bg-stone-50 px-11 py-3 text-sm outline-none transition-colors focus:border-accent"
                    />
                  </div>
                  <label className="flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-600">
                    <span>{t('statusFilter')}</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as 'all' | ProfessorStatus)}
                      className="bg-transparent outline-none"
                    >
                      <option value="all">{t('allStatuses')}</option>
                      {availableStatuses.map((status) => (
                        <option key={status} value={status}>
                          {getStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {visibleProfessors.length === 0 ? (
                <div className="mt-6 rounded-[2rem] border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
                  <p className="text-lg font-medium text-stone-700">{t('noProfessorsMatch')}</p>
                </div>
              ) : (
                <div className="mt-6 space-y-8">
                  {groupedByStatus.map((group) => (
                    <section key={group.status}>
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-stone-900">{t('status')}: {getStatusLabel(group.status)}</h3>
                        <span className="text-sm text-stone-400">{group.professors.length}</span>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] gap-5">
                        {group.professors.map((professor) => (
                          <ProfessorCard
                            key={professor.id}
                            professor={professor}
                            mode="active"
                            onEdit={openEditDialog}
                            onViewDetails={setDetailProfessor}
                            onTrash={(id) => void onTrashProfessor(id)}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ProfessorFormDialog
        open={dialogOpen}
        professor={editingProfessor}
        defaultSchool={defaultSchoolForCreate}
        defaultCollege={defaultCollegeForCreate}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />

      <ProfessorTimelineDrawer
        professor={detailProfessor}
        open={Boolean(detailProfessor)}
        events={timeline.events}
        isLoading={timeline.isLoading}
        error={timeline.error}
        onClose={() => setDetailProfessor(null)}
        onCreateEvent={async (draft) => {
          await onCreateTimelineEvent(draft);
          await timeline.refresh();
        }}
      />
    </div>
  );
}
