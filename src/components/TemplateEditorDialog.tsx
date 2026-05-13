import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Eye, Save, X } from 'lucide-react';
import { MailPreviewDialog } from './MailPreviewDialog';
import { getTemplateVariableOptions } from '../lib/templates';
import { useI18n } from '../lib/i18n';
import type { Professor } from '../types/professor';
import type { UserProfileSettings } from '../types/profile';
import type { DraftTemplateInput, MailTemplate } from '../types/template';

interface TemplateEditorDialogProps {
  open: boolean;
  template: MailTemplate | null;
  selectedProfessor: Professor | null;
  profile: UserProfileSettings | null;
  onClose: () => void;
  onSave: (id: string, input: DraftTemplateInput) => Promise<void>;
}

const EMPTY_INPUT: DraftTemplateInput = {
  name: '',
  description: '',
  subject: '',
  body: '',
  variables: [],
};

export function TemplateEditorDialog({
  open,
  template,
  selectedProfessor,
  profile,
  onClose,
  onSave,
}: TemplateEditorDialogProps) {
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState<DraftTemplateInput>(EMPTY_INPUT);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focusField, setFocusField] = useState<'subject' | 'body'>('body');
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const variables = useMemo(() => getTemplateVariableOptions(locale), [locale]);

  useEffect(() => {
    if (!open || !template) {
      return;
    }

    setDraft({
      name: template.name,
      description: template.description,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
    });
    setPreviewOpen(false);
    setFocusField('body');
    setSaveError(null);
  }, [open, template]);

  if (!open || !template) {
    return null;
  }

  const dialogTitle = draft.name.trim() || t('createTemplate');
  const dialogModeLabel =
    template.name || template.description || template.subject || template.body ? t('editTemplate') : t('createTemplate');

  const insertVariable = (variable: string) => {
    const token = `{{${variable}}}`;
    const target = focusField === 'subject' ? subjectRef.current : bodyRef.current;
    if (!target) {
      return;
    }

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const nextValue = `${target.value.slice(0, start)}${token}${target.value.slice(end)}`;

    setDraft((current) => ({
      ...current,
      [focusField]: nextValue,
      variables: Array.from(new Set([...current.variables, variable])),
    }));

    window.setTimeout(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const updateField = <K extends keyof DraftTemplateInput>(key: K, value: DraftTemplateInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(template.id, {
        ...draft,
        variables: Array.from(
          new Set([
            ...draft.variables,
            ...Array.from(`${draft.subject}\n${draft.body}`.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)).map((match) => match[1]),
          ]),
        ),
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('loadTemplatesFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-6 py-10 backdrop-blur-sm">
        <div className="w-full max-w-5xl rounded-[2rem] bg-white shadow-2xl shadow-stone-900/15">
          <div className="flex items-start justify-between border-b border-stone-100 px-8 py-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{dialogModeLabel}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{dialogTitle}</h2>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5 border-b border-stone-100 px-8 py-6 lg:border-b-0 lg:border-r">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-600">{t('templateName')}</span>
                <input
                  value={draft.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-600">{t('templateDescription')}</span>
                <input
                  value={draft.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-600">{t('subject')}</span>
                <input
                  ref={subjectRef}
                  value={draft.subject}
                  onFocus={() => setFocusField('subject')}
                  onChange={(event) => updateField('subject', event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-600">{t('templateBody')}</span>
                <textarea
                  ref={bodyRef}
                  rows={12}
                  value={draft.body}
                  onFocus={() => setFocusField('body')}
                  onChange={(event) => updateField('body', event.target.value)}
                  className="w-full resize-none rounded-3xl border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-accent"
                />
              </label>
            </div>

            <div className="space-y-5 px-8 py-6">
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('templateVariables')}</p>
                <p className="mt-2 text-sm leading-6 text-stone-500">{t('templateVariableHint')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {variables.map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      onClick={() => insertVariable(variable.key)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:border-accent hover:text-accent"
                    >
                      {variable.example}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-2 text-xs text-stone-500">
                  {variables.map((variable) => (
                    <div key={`${variable.key}-label`}>
                      <code>{variable.example}</code> · {variable.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('mailPreview')}</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">{draft.subject || t('noSubjectYet')}</p>
                <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-6 text-stone-600">
                  {draft.body || t('noBodyYet')}
                </pre>
              </div>

              {saveError && (
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {saveError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  <Eye className="h-4 w-4" />
                  <span>{t('previewTemplate')}</span>
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? t('saving') : t('saveTemplate')}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <MailPreviewDialog
        open={previewOpen}
        title={dialogTitle}
        subject={draft.subject}
        body={draft.body}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
