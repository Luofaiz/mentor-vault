import {
  BookOpenCheck,
  Building2,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/utils';

type View = 'contacts' | 'schools' | 'trash';

export interface Attachment {
  name: string;
  content: string;
}

interface AppSidebarProps {
  view: View;
  onChangeView: (view: View) => void;
  updateMessage: string | null;
  isCheckingUpdates: boolean;
  onCheckUpdates: () => void;
}

export function AppSidebar({
  view,
  onChangeView,
  updateMessage,
  isCheckingUpdates,
  onCheckUpdates,
}: AppSidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="h-screen w-72 shrink-0 overflow-hidden border-r border-stone-200 bg-white/70 flex flex-col p-5 space-y-6 backdrop-blur-md">
      <div className="flex items-center space-x-3 px-2">
        <div className="w-10 h-10 rounded-2xl bg-ink text-white flex items-center justify-center shadow-lg shadow-stone-900/15">
          <BookOpenCheck className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('appName')}</p>
          <p className="text-lg font-semibold tracking-tight">{t('appSubtitle')}</p>
        </div>
      </div>
      <nav className="space-y-1">
        <button
          onClick={() => onChangeView('contacts')}
          className={cn(
            'w-full flex items-center space-x-3 rounded-2xl px-4 py-3 text-left transition-colors',
            view === 'contacts' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
          )}
        >
          <Users className="w-4 h-4" />
          <span className="font-medium">{t('professors')}</span>
        </button>
        <button
          onClick={() => onChangeView('schools')}
          className={cn(
            'w-full flex items-center space-x-3 rounded-2xl px-4 py-3 text-left transition-colors',
            view === 'schools' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
          )}
        >
          <Building2 className="w-4 h-4" />
          <span className="font-medium">{t('schoolDirectory')}</span>
        </button>
        <button
          onClick={() => onChangeView('trash')}
          className={cn(
            'w-full flex items-center space-x-3 rounded-2xl px-4 py-3 text-left transition-colors',
            view === 'trash' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
          )}
        >
          <Trash2 className="w-4 h-4" />
          <span className="font-medium">{t('recycleBin')}</span>
        </button>
      </nav>

      <div className="mt-auto space-y-3">
        <button
          type="button"
          onClick={onCheckUpdates}
          disabled={isCheckingUpdates}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
          <span>{isCheckingUpdates ? t('checkingUpdates') : t('checkUpdates')}</span>
        </button>
        {updateMessage && (
          <p className="rounded-2xl bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">{updateMessage}</p>
        )}
      </div>

      <div className="rounded-3xl bg-stone-900 p-4 text-white">
        <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
          <BookOpenCheck className="w-4 h-4" />
          <span>{t('phase1')}</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-stone-200">
          {t('phase1Desc')}
        </p>
      </div>
    </aside>
  );
}
