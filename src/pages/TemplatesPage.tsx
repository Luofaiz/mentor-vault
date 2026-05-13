import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MailPreviewDialog } from '../components/MailPreviewDialog';
import { TemplateEditorDialog } from '../components/TemplateEditorDialog';
import { useTemplates } from '../hooks/useTemplates';
import { useUserProfile } from '../hooks/useUserProfile';
import { useI18n } from '../lib/i18n';
import type { Professor } from '../types/professor';
import type { DraftTemplateInput, MailTemplate } from '../types/template';

interface TemplatesPageProps {
  selectedProfessor: Professor | null;
}

function createEmptyTemplate(): MailTemplate {
  const now = Date.now();
  return {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `template-${now}`,
    name: '',
    description: '',
    subject: '',
    body: '',
    variables: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function TemplatesPage({ selectedProfessor }: TemplatesPageProps) {
  const { t } = useI18n();
  const { profile } = useUserProfile();
  const { templates, isLoading, error, save, remove } = useTemplates();
  const [editingTemplate, setEditingTemplate] = useState<MailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MailTemplate | null>(null);

  const handleSaveTemplate = async (id: string, input: DraftTemplateInput) => {
    await save(id, input);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (template: MailTemplate) => {
    const name = template.name.trim() || t('untitledDraft');
    if (!window.confirm(t('templateDeleteConfirm', { name }))) {
      return;
    }

    await remove(template.id);
    if (editingTemplate?.id === template.id) {
      setEditingTemplate(null);
    }
    if (previewTemplate?.id === template.id) {
      setPreviewTemplate(null);
    }
  };

  return (
    <>
      <header className="h-20 border-b border-stone-200 flex items-center justify-between px-8 bg-white/70 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('templates')}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">{t('templateLibraryTitle')}</h2>
        </div>
        <button
          onClick={() => setEditingTemplate(createEmptyTemplate())}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" />
          <span>{t('createTemplate')}</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-10 md:px-14 md:py-14">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-[2rem] border border-stone-200 bg-white/90 p-8 shadow-sm">
            <p className="text-sm leading-7 text-stone-500">{t('templateLibraryDesc')}</p>
            {selectedProfessor && (
              <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
                {t('draftingFor', { name: selectedProfessor.name })}
              </p>
            )}
          </section>

          {error && <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          {isLoading ? (
            <p className="mt-6 text-sm text-stone-400">{t('loadingTemplates')}</p>
          ) : templates.length === 0 ? (
            <section className="mt-6 rounded-[2rem] border border-dashed border-stone-300 bg-stone-50 px-8 py-16 text-center">
              <p className="text-xl font-semibold text-stone-900">{t('noTemplatesYet')}</p>
              <p className="mt-3 text-sm leading-6 text-stone-500">{t('templateLibraryDesc')}</p>
            </section>
          ) : (
            <section className="mt-6 grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <article key={template.id} className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm transition-colors hover:border-stone-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-stone-900">{template.name || t('untitledDraft')}</h3>
                      <p className="mt-2 text-sm leading-6 text-stone-500">{template.description || t('templateLibraryDesc')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewTemplate(template)}
                        className="rounded-full border border-stone-200 p-2 text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
                        aria-label={t('previewTemplate')}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingTemplate(template)}
                        className="rounded-full border border-stone-200 p-2 text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
                        aria-label={t('editTemplate')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleDeleteTemplate(template)}
                        className="rounded-full border border-stone-200 p-2 text-stone-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        aria-label={t('delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.5rem] bg-stone-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('subject')}</p>
                    <p className="mt-2 text-sm font-semibold text-stone-900">{template.subject || t('noSubjectYet')}</p>
                    <pre className="mt-4 max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-6 text-stone-600">
                      {template.body || t('noBodyYet')}
                    </pre>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </div>

      <TemplateEditorDialog
        open={Boolean(editingTemplate)}
        template={editingTemplate}
        selectedProfessor={selectedProfessor}
        profile={profile}
        onClose={() => setEditingTemplate(null)}
        onSave={handleSaveTemplate}
      />

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
