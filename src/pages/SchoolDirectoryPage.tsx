import { useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { ProfessorCard } from '../components/ProfessorCard';
import { ProfessorFormDialog } from '../components/ProfessorFormDialog';
import { ProfessorTimelineDrawer } from '../components/ProfessorTimelineDrawer';
import { useTimeline } from '../hooks/useTimeline';
import { useI18n } from '../lib/i18n';
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

    return Array.from(groups.entries())
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
  }, [activeProfessors, availableStatuses, locale, t]);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProfessorStatus>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [detailProfessor, setDetailProfessor] = useState<Professor | null>(null);
  const timeline = useTimeline(detailProfessor?.id ?? null);

  const selectedGroup = schoolGroups.find((group) => group.school === selectedSchool) ?? schoolGroups[0] ?? null;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleProfessors = (selectedGroup?.professors ?? [])
    .filter((professor) => (statusFilter === 'all' ? true : professor.status === statusFilter))
    .filter((professor) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        professor.name,
        professor.title,
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

  const handleSubmit = async (draft: ProfessorDraft, professorId?: string) => {
    const nextDraft = professorId || !selectedGroup
      ? draft
      : {
          ...draft,
          school: draft.school.trim() || selectedGroup.school,
        };

    if (professorId) {
      await onUpdateProfessor(professorId, nextDraft);
      return;
    }

    await onCreateProfessor(nextDraft);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 py-8 md:px-12">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
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
          <div className="mt-8 grid min-h-0 flex-1 gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="shrink-0 flex items-center gap-2 px-2 pb-3">
                <Building2 className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-stone-900">{t('schoolIndex')}</h2>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {schoolGroups.map((group) => {
                  const selected = selectedGroup?.school === group.school;
                  return (
                    <button
                      key={group.school}
                      type="button"
                      onClick={() => setSelectedSchool(group.school)}
                      className={`w-full rounded-[1.25rem] px-4 py-3 text-left transition-colors ${selected ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'}`}
                    >
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

            <div className="min-h-0 overflow-y-auto pr-1">
              <div className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('school')}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{selectedGroup?.school}</h2>
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
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
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
