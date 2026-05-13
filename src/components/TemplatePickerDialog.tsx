import { Check, Eye, FileStack, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MailPreviewDialog } from './MailPreviewDialog';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/utils';
import type { Professor } from '../types/professor';
import type { UserProfileSettings } from '../types/profile';
import type { MailTemplate } from '../types/template';

interface TemplatePickerDialogProps {
  open: boolean;
  templates: MailTemplate[];
  isLoading: boolean;
  error: string | null;
  activeTemplateId: string | null;
  selectedProfessor: Professor | null;
  profile: UserProfileSettings | null;
  onClose: () => void;
  onApply: (templateId: string) => void;
}

export function TemplatePickerDialog({
  open,
  templates,
  isLoading,
  error,
  activeTemplateId,
  selectedProfessor,
  profile,
  onClose,
  onApply,
}: TemplatePickerDialogProps) {
  const { t } = useI18n();
  const [previewTemplate, setPreviewTemplate] = useState<MailTemplate | null>(null);

  useEffect(() => {
    if (!open) {
      setPreviewTemplate(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-6 py-10 backdrop-blur-sm">
        <div className="w-full max-w-4xl rounded-[2rem] bg-white shadow-2xl shadow-stone-900/15">
          <div className="flex items-start justify-between border-b border-stone-100 px-8 py-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('manualApplyTemplate')}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{t('templates')}</h2>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-8 py-6">
            {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            {isLoading ? (
              <p className="text-sm text-stone-400">{t('loadingTemplates')}</p>
            ) : templates.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-stone-500 shadow-sm">
                  <FileStack className="h-5 w-5" />
                </div>
                <p className="mt-4 text-lg font-semibold text-stone-900">{t('noTemplatesYet')}</p>
                <p className="mt-2 text-sm leading-6 text-stone-500">{t('templateLibraryDesc')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      'rounded-[1.5rem] border px-5 py-5 transition-colors',
                      activeTemplateId === template.id
                        ? 'border-accent bg-accent/5'
                        : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-stone-900">{template.name || t('untitledDraft')}</h3>
                          {activeTemplateId === template.id && <Check className="h-4 w-4 text-accent" />}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-stone-500">{template.description || t('templateLibraryDesc')}</p>
                        <p className="mt-3 max-h-12 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-stone-600">
                          {template.body || t('noBodyYet')}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => setPreviewTemplate(template)}
                          className="rounded-full border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            {t('previewTemplate')}
                          </span>
                        </button>
                        <button
                          onClick={() => onApply(template.id)}
                          className="rounded-full bg-ink px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-stone-800"
                        >
                          {t('applyTemplate')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MailPreviewDialog
        open={Boolean(previewTemplate)}
        title={previewTemplate?.name ?? t('templates')}
        subject={previewTemplate?.subject ?? ''}
        body={previewTemplate?.body ?? ''}
        onClose={() => setPreviewTemplate(null)}
      />
    </>
  );
}
