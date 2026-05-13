import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { PROFESSOR_STATUSES, type Professor, type ProfessorDraft, type ProfessorStatus } from '../types/professor';

interface ProfessorFormDialogProps {
  open: boolean;
  professor: Professor | null;
  onClose: () => void;
  onSubmit: (draft: ProfessorDraft, professorId?: string) => Promise<void>;
}

const EMPTY_DRAFT: ProfessorDraft = {
  name: '',
  title: '',
  school: '',
  email: '',
  homepage: '',
  researchArea: '',
  status: 'Pending',
  tags: [],
  firstContactDate: '',
  lastContactDate: '',
  notes: '',
};
const CUSTOM_STATUS_VALUE = '__custom__';

export function ProfessorFormDialog({ open, professor, onClose, onSubmit }: ProfessorFormDialogProps) {
  const { getStatusLabel, t } = useI18n();
  const [draft, setDraft] = useState<ProfessorDraft>(EMPTY_DRAFT);
  const [tagInput, setTagInput] = useState('');
  const [customStatus, setCustomStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (professor) {
      setDraft({
        name: professor.name,
        title: professor.title,
        school: professor.school,
        email: professor.email,
        homepage: professor.homepage,
        researchArea: professor.researchArea,
        status: professor.status,
        tags: professor.tags,
        firstContactDate: professor.firstContactDate,
        lastContactDate: professor.lastContactDate,
        notes: professor.notes,
      });
      setTagInput(professor.tags.join(', '));
      setCustomStatus(PROFESSOR_STATUSES.includes(professor.status as never) ? '' : professor.status);
    } else {
      setDraft(EMPTY_DRAFT);
      setTagInput('');
      setCustomStatus('');
    }
  }, [open, professor]);

  if (!open) {
    return null;
  }

  const updateField = <K extends keyof ProfessorDraft>(key: K, value: ProfessorDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const statusSelectValue = PROFESSOR_STATUSES.includes(draft.status as never) ? draft.status : CUSTOM_STATUS_VALUE;

  const updateStatusSelect = (value: string) => {
    if (value === CUSTOM_STATUS_VALUE) {
      const nextStatus = customStatus.trim() || '';
      setDraft((current) => ({ ...current, status: nextStatus as ProfessorStatus }));
      return;
    }

    setCustomStatus('');
    updateField('status', value as ProfessorDraft['status']);
  };

  const updateCustomStatus = (value: string) => {
    setCustomStatus(value);
    updateField('status', (value.trim() || 'Pending') as ProfessorDraft['status']);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit(
        {
          ...draft,
          status: (customStatus.trim() || draft.status || 'Pending') as ProfessorDraft['status'],
          tags: tagInput
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        professor?.id,
      );
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/40 px-6 py-10 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-[2rem] bg-white shadow-2xl shadow-stone-900/10">
        <div className="flex items-center justify-between border-b border-stone-100 px-8 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
              {professor ? t('editProfessor') : t('addProfessorTitle')}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
              {professor ? professor.name : t('newOutreachTarget')}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 px-8 py-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('name')} <span className="text-rose-500">{t('requiredField')}</span></span>
            <input
              required
              value={draft.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('title')}</span>
            <input
              value={draft.title}
              onChange={(event) => updateField('title', event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('school')} <span className="text-rose-500">{t('requiredField')}</span></span>
            <input
              required
              value={draft.school}
              onChange={(event) => updateField('school', event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('email')}</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => updateField('email', event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('homepage')}</span>
            <input
              type="url"
              value={draft.homepage}
              onChange={(event) => updateField('homepage', event.target.value)}
              placeholder="https://"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('researchArea')}</span>
            <input
              value={draft.researchArea}
              onChange={(event) => updateField('researchArea', event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('status')}</span>
            <select
              value={statusSelectValue}
              onChange={(event) => updateStatusSelect(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            >
              {PROFESSOR_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
              <option value={CUSTOM_STATUS_VALUE}>{t('customStatus')}</option>
            </select>
          </label>

          {statusSelectValue === CUSTOM_STATUS_VALUE && (
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-600">{t('customStatus')}</span>
              <input
                value={customStatus}
                onChange={(event) => updateCustomStatus(event.target.value)}
                placeholder={t('customStatusPlaceholder')}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
              />
            </label>
          )}

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('tags')}</span>
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder={t('tagsPlaceholder')}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('firstContactDate')}</span>
            <input
              type="date"
              value={draft.firstContactDate}
              onChange={(event) => updateField('firstContactDate', event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-600">{t('lastContactDate')}</span>
            <input
              type="date"
              value={draft.lastContactDate}
              onChange={(event) => updateField('lastContactDate', event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-stone-600">{t('notes')}</span>
            <textarea
              value={draft.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              rows={5}
              className="w-full resize-none rounded-3xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>

          <div className="md:col-span-2 flex items-center justify-end gap-3 border-t border-stone-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? t('saving') : professor ? t('saveChanges') : t('createProfessor')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
