import {
  BookOpenCheck,
  Building2,
  FileText,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/utils';
import type { UpdateDownloadProgress } from '../lib/desktop';

type View = 'contacts' | 'schools' | 'notes' | 'trash';

export interface Attachment {
  name: string;
  content: string;
}

interface AppSidebarProps {
  view: View;
  contactedProfessorCount: number;
  activeProfessorCount: number;
  onChangeView: (view: View) => void;
  updateMessage: string | null;
  updateDownloadProgress: UpdateDownloadProgress | null;
  isCheckingUpdates: boolean;
  onCheckUpdates: () => void;
  onPauseUpdateDownload: () => void;
  onResumeUpdateDownload: () => void;
  onCancelUpdateDownload: () => void;
}

export function AppSidebar({
  view,
  contactedProfessorCount,
  activeProfessorCount,
  onChangeView,
  updateMessage,
  updateDownloadProgress,
  isCheckingUpdates,
  onCheckUpdates,
  onPauseUpdateDownload,
  onResumeUpdateDownload,
  onCancelUpdateDownload,
}: AppSidebarProps) {
  const { t } = useI18n();
  const isUpdateDownloadPaused = updateDownloadProgress?.status === 'paused';
  const progressPercent = updateDownloadProgress?.percent ?? null;
  const progressLabel = isUpdateDownloadPaused ? '已暂停' : progressPercent === null ? '正在下载' : `${progressPercent}%`;
  const progressWidth = progressPercent === null ? 100 : Math.max(0, Math.min(100, progressPercent));

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
          onClick={() => onChangeView('notes')}
          className={cn(
            'w-full flex items-center space-x-3 rounded-2xl px-4 py-3 text-left transition-colors',
            view === 'notes' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
          )}
        >
          <FileText className="w-4 h-4" />
          <span className="font-medium">{t('documentNotes')}</span>
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
          <div className="rounded-2xl bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">
            <p>{updateMessage}</p>
            {updateDownloadProgress && (
              <div className="mt-3 space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={cn(
                      'h-full rounded-full bg-stone-900 transition-all',
                      progressPercent === null && 'animate-pulse',
                    )}
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-stone-600">
                  <span>{progressLabel}</span>
                  <span>{formatBytes(updateDownloadProgress.transferredBytes)} / {formatBytes(updateDownloadProgress.totalBytes)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] text-stone-400">
                  <span>{formatBytes(updateDownloadProgress.bytesPerSecond)}/s</span>
                  <span>剩余 {formatDuration(updateDownloadProgress.remainingSeconds)}</span>
                </div>
                {updateDownloadProgress.status !== 'completed' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={isUpdateDownloadPaused ? onResumeUpdateDownload : onPauseUpdateDownload}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] font-medium text-stone-600 transition-colors hover:bg-stone-100"
                    >
                      {isUpdateDownloadPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      <span>{isUpdateDownloadPaused ? '继续' : '暂停'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onCancelUpdateDownload}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>取消</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-stone-900 p-4 text-white">
        <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
          <BookOpenCheck className="w-4 h-4" />
          <span>{t('phase1')}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/10 px-3 py-3">
            <p className="text-[11px] font-medium text-stone-400">{t('contactedProfessors')}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{contactedProfessorCount}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-3">
            <p className="text-[11px] font-medium text-stone-400">{t('activeProfessors')}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{activeProfessorCount}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-stone-200">
          {t('phase1Desc')}
        </p>
      </div>
    </aside>
  );
}

function formatBytes(bytes?: number) {
  if (!Number.isFinite(bytes) || !bytes) {
    return '--';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

function formatDuration(seconds?: number) {
  if (!Number.isFinite(seconds) || seconds === undefined) {
    return '--';
  }

  const roundedSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds} 秒`;
  }

  return `${minutes} 分 ${remainingSeconds} 秒`;
}
