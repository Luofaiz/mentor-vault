import { BellRing, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { Professor } from '../types/professor';

interface FollowUpReminderProps {
  professors: Professor[];
  onClose: () => void;
}

export function FollowUpReminder({ professors, onClose }: FollowUpReminderProps) {
  const { locale, t } = useI18n();
  const dueToday = professors.filter((professor) => professor.status === 'Follow-Up Due');
  const overdue: Professor[] = [];

  if (dueToday.length === 0 && overdue.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-6 top-6 z-50 w-full max-w-md rounded-[2rem] border border-amber-200 bg-white/95 p-5 shadow-2xl shadow-stone-300/40 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">{t('followUpReminder')}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
              {dueToday.length > 0
                ? t('followUpToday', {
                    count: dueToday.length,
                    suffix: locale === 'en' && dueToday.length === 1 ? '' : 's',
                  })
                : t('overdueOutreach', { count: overdue.length })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {dueToday.length > 0 && overdue.length > 0
                ? t('dueAndOverdue', { due: dueToday.length, overdue: overdue.length })
                : dueToday.length > 0
                  ? t('dueOnly', { count: dueToday.length })
                  : t('overdueOnly', { count: overdue.length })}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {dueToday.slice(0, 3).map((professor) => (
          <div key={professor.id} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">{professor.name}</span>
            <span className="text-amber-700"> · {professor.school || t('schoolNotSet')} · {professor.lastContactDate || t('noLastContactDate')}</span>
          </div>
        ))}
        {overdue.slice(0, Math.max(0, 3 - dueToday.length)).map((professor) => (
          <div key={professor.id} className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <span className="font-semibold">{professor.name}</span>
            <span className="text-rose-700"> · {professor.lastContactDate || t('noLastContactDate')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
