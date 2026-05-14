import {
  CalendarClock,
  ExternalLink,
  Globe,
  PencilLine,
  RefreshCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/utils';
import type { Professor } from '../types/professor';

interface ProfessorCardProps {
  professor: Professor;
  mode: 'active' | 'trash';
  onEdit?: (professor: Professor) => void;
  onViewDetails?: (professor: Professor) => void;
  onTrash?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-stone-100 text-stone-600',
  Drafting: 'bg-amber-50 text-amber-700',
  Contacted: 'bg-sky-50 text-sky-700',
  'Follow-Up Due': 'bg-orange-50 text-orange-700',
  Replied: 'bg-emerald-50 text-emerald-700',
  未读: 'bg-slate-100 text-slate-700',
  已读不回: 'bg-zinc-100 text-zinc-700',
  官回: 'bg-indigo-50 text-indigo-700',
  待面试: 'bg-violet-50 text-violet-700',
  待考核: 'bg-cyan-50 text-cyan-700',
  Rejected: 'bg-rose-50 text-rose-700',
};
const CUSTOM_STATUS_STYLE = 'bg-stone-100 text-stone-700';

export function ProfessorCard({
  professor,
  mode,
  onEdit,
  onViewDetails,
  onTrash,
  onRestore,
  onPurge,
}: ProfessorCardProps) {
  const { getStatusLabel, t } = useI18n();

  return (
    <article className="group rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-stone-200/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{professor.title || t('professorFallback')}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">{professor.name}</h3>
          <p className="mt-1 text-sm text-stone-500">{professor.school || t('schoolNotSet')}</p>
          {professor.college && <p className="mt-1 text-sm text-stone-400">{professor.college}</p>}
        </div>
        <span className={cn('shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]', STATUS_STYLES[professor.status] ?? CUSTOM_STATUS_STYLE)}>
          {getStatusLabel(professor.status)}
        </span>
      </div>

      <div className="mt-5 min-w-0 space-y-2 text-sm text-stone-600">
        <p className="break-words">{professor.researchArea || t('researchAreaNotSet')}</p>
        <p className="truncate">{professor.email || t('emailNotSet')}</p>
        <p>{professor.firstContactDate ? t('firstContactOn', { date: professor.firstContactDate }) : t('noFirstContactDate')}</p>
        <p>{professor.lastContactDate ? t('lastContactOn', { date: professor.lastContactDate }) : t('noLastContactDate')}</p>
        {professor.homepage && (
          <a
            href={professor.homepage}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 max-w-full items-center gap-2 text-accent hover:underline"
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{professor.homepage}</span>
          </a>
        )}
      </div>

      {professor.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {professor.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-stone-100 pt-4">
        {mode === 'active' ? (
          <div className="flex items-center justify-between gap-1.5">
            <button
              onClick={() => onViewDetails?.(professor)}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
            >
              <CalendarClock className="w-4 h-4" />
              <span>{t('compose')}</span>
            </button>
            <div className="flex min-w-0 items-center gap-0.5">
              <button
                onClick={() => onEdit?.(professor)}
                className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                title={t('edit')}
              >
                <PencilLine className="w-4 h-4" />
              </button>
              <button
                onClick={() => onTrash?.(professor.id)}
                className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                title={t('moveToRecycleBin')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewDetails?.(professor)}
                className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                title={t('details')}
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onRestore?.(professor.id)}
              className="flex items-center space-x-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>{t('restore')}</span>
            </button>
            <button
              onClick={() => onPurge?.(professor.id)}
              className="flex items-center space-x-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100"
            >
              <XCircle className="w-4 h-4" />
              <span>{t('delete')}</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
