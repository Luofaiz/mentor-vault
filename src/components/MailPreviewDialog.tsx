import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface MailPreviewDialogProps {
  open: boolean;
  title: string;
  subject: string;
  body: string;
  onClose: () => void;
}

export function MailPreviewDialog({ open, title, subject, body, onClose }: MailPreviewDialogProps) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-6 py-10 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-[2rem] bg-white shadow-2xl shadow-stone-900/15">
        <div className="flex items-start justify-between border-b border-stone-100 px-8 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('mailPreview')}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-8 py-6">
          <div className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('subject')}</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-stone-900">{subject || t('noSubjectYet')}</p>
            </div>
            <div className="max-h-[520px] overflow-y-auto px-6 py-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-stone-700">{body || t('noBodyYet')}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
