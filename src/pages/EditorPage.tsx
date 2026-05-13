import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, FileStack, Paperclip, RefreshCcw, Save, Send, X } from 'lucide-react';
import { MailPreviewDialog } from '../components/MailPreviewDialog';
import { PreviewSendDialog } from '../components/PreviewSendDialog';
import { TemplatePickerDialog } from '../components/TemplatePickerDialog';
import { useUserProfile } from '../hooks/useUserProfile';
import { generateDraft } from '../lib/ai';
import { useDrafts } from '../hooks/useDrafts';
import { useTemplates } from '../hooks/useTemplates';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/utils';
import type { Attachment } from '../components/AppSidebar';
import type { MailAttachment } from '../types/mail';
import type { Professor } from '../types/professor';

interface EditorPageProps {
  sessionKey: number;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
  selectedProfessor: Professor | null;
  text: string;
  onChangeText: (value: string) => void;
  draftPrompt: string;
  onChangeDraftPrompt: (value: string) => void;
  attachments: Attachment[];
  onProfessorMailSent: (id: string) => Promise<void>;
}

export function EditorPage({
  sessionKey,
  assistantOpen,
  onToggleAssistant,
  selectedProfessor,
  text,
  onChangeText,
  draftPrompt,
  onChangeDraftPrompt,
  attachments,
  onProfessorMailSent,
}: EditorPageProps) {
  const { locale, t } = useI18n();
  const { profile } = useUserProfile();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.localStorage.getItem('vibe.editor.ai.enabled.v1') !== 'false';
  });
  const [subject, setSubject] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [sendPreviewOpen, setSendPreviewOpen] = useState(false);
  const [mailPreviewOpen, setMailPreviewOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [mailAttachments, setMailAttachments] = useState<MailAttachment[]>([]);
  const { templates, isLoading: templatesLoading, error: templatesError } = useTemplates();
  const { drafts, isLoading: draftsLoading, error: draftsError, save: saveDraftRecord } = useDrafts();
  const autoDraftRef = useRef('');
  const renderedSubject = useMemo(() => subject, [subject]);
  const renderedBody = useMemo(() => text, [text]);

  const buildDefaultDraft = () => {
    const professorName = selectedProfessor?.name || '[目标老师的名字]';
    const userUniversity = profile?.university || '[用户的大学]';
    const userName = profile?.fullName || '[用户本人的名字]';
    const researchArea = selectedProfessor?.researchArea?.trim() || '[研究方向]';

    return [
      `尊敬的${professorName}老师：`,
      '',
      `您好！我是来自${userUniversity}的${userName}，目前正在准备研究生阶段的申请。了解到您在${researchArea}方向开展了深入研究，我非常希望有机会进一步了解并参与您的课题组工作。`,
      '',
      '我已附上个人简历，若您方便，我希望后续能与您进一步沟通。',
      '',
      '此致',
      '敬礼',
      '',
      userName,
    ].join('\n');
  };

  useEffect(() => {
    setActiveDraftId(null);
    setActiveTemplateId(null);
    setSubject(t('defaultOutreachSubject'));
    setMailAttachments([]);
    setSaveState('idle');
  }, [selectedProfessor?.id, sessionKey, t]);

  useEffect(() => {
    const nextDefaultDraft = buildDefaultDraft();
    if (!activeDraftId && (!text.trim() || text === autoDraftRef.current)) {
      autoDraftRef.current = nextDefaultDraft;
      onChangeText(nextDefaultDraft);
    }
  }, [activeDraftId, onChangeText, profile?.fullName, profile?.university, selectedProfessor?.id, sessionKey, text]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('vibe.editor.ai.enabled.v1', aiEnabled ? 'true' : 'false');
  }, [aiEnabled]);

  const handleGenerate = async () => {
    if (!aiEnabled || !draftPrompt) {
      return;
    }

    setAiError(null);
    setIsGenerating(true);
    try {
      const professorContext = selectedProfessor
        ? locale === 'en'
          ? `Write to ${selectedProfessor.name} from ${selectedProfessor.school}. Research area: ${selectedProfessor.researchArea}.`
          : `写信对象是${selectedProfessor.name}，来自${selectedProfessor.school}，研究方向为${selectedProfessor.researchArea}。`
        : '';
      const draft = await generateDraft({
        prompt: `${draftPrompt}\n${professorContext}`.trim(),
        files: attachments,
        locale,
      });
      if (draft) {
        onChangeText(draft);
        if (!subject) {
          setSubject(
            selectedProfessor
              ? t('defaultGeneratedSubject', {
                  researchArea: selectedProfessor.researchArea || t('researchAreaNotSet'),
                })
              : t('newOutreachDraft'),
          );
        }
      }
    } catch (error) {
      console.error('Generation failed', error);
      setAiError(error instanceof Error ? error.message : t('aiDraftFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    const template = templates.find((record) => record.id === templateId);
    if (!template) {
      return;
    }

    setActiveTemplateId(template.id);
    setSubject(template.subject);
    onChangeText(template.body);
    onChangeDraftPrompt(template.description);
    setTemplatePickerOpen(false);
  };

  const handleUploadMailAttachments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const nextAttachments = await Promise.all(
      files.map(
        (file) =>
          new Promise<MailAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = typeof reader.result === 'string' ? reader.result : '';
              const contentBase64 = result.includes(',') ? result.split(',')[1] : result;
              resolve({
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                contentBase64,
                size: file.size,
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );

    setMailAttachments((current) => [...current, ...nextAttachments]);
    event.target.value = '';
  };

  const handleSaveDraft = async () => {
    const trimmedBody = text.trim();
    const trimmedSubject = subject.trim();
    if (!trimmedBody && !trimmedSubject) {
      return;
    }

    const title =
      trimmedSubject ||
      (selectedProfessor ? t('draftTitleForProfessor', { name: selectedProfessor.name }) : t('untitledDraft'));
    const record = await saveDraftRecord(activeDraftId, {
      title,
      professorId: selectedProfessor?.id ?? null,
      templateId: activeTemplateId,
      subject: trimmedSubject,
      body: text,
      status: trimmedSubject && trimmedBody ? 'ready' : 'draft',
    });
    setActiveDraftId(record?.id ?? activeDraftId);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1800);
  };

  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find((record) => record.id === draftId);
    if (!draft) {
      return;
    }

    setActiveDraftId(draft.id);
    setActiveTemplateId(draft.templateId);
    setSubject(draft.subject);
    onChangeText(draft.body);
    onChangeDraftPrompt('');
    setSaveState('idle');
  };

  const clearAppliedTemplate = () => {
    setActiveTemplateId(null);
  };

  return (
    <>
      <header className="h-20 border-b border-stone-200 flex items-center justify-between px-8 bg-white/70 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('composerTitle')}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
            {selectedProfessor ? t('draftingFor', { name: selectedProfessor.name }) : t('newOutreachDraft')}
          </h2>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleAssistant}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            {assistantOpen ? t('closeAssistant') : t('openAssistant')}
          </button>
          <button
            onClick={() => setAiEnabled((current) => !current)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              aiEnabled
                ? 'bg-accent/10 text-accent hover:bg-accent/15'
                : 'border border-stone-200 text-stone-600 hover:bg-stone-50',
            )}
          >
            {aiEnabled ? t('aiMode') : t('manualMode')}
          </button>
          <button
            onClick={() => setTemplatePickerOpen(true)}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            <span className="inline-flex items-center gap-2">
              <FileStack className="h-4 w-4" />
              {t('manualApplyTemplate')}
            </span>
          </button>
          {activeTemplateId && (
            <button
              onClick={clearAppliedTemplate}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
            >
              {t('clearTemplate')}
            </button>
          )}
          <button
            onClick={() => setMailPreviewOpen(true)}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            <span className="inline-flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t('mailPreview')}
            </span>
          </button>
          <button
            onClick={() => void handleSaveDraft()}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            <span className="inline-flex items-center gap-2">
              {saveState === 'saved' ? <Check className="h-4 w-4 text-emerald-600" /> : <Save className="h-4 w-4" />}
              {saveState === 'saved' ? t('saved') : t('saveDraft')}
            </span>
          </button>
          <button
            onClick={() => setSendPreviewOpen(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            {t('previewFlow')}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-10 md:px-14 md:py-14">
        <div className="mx-auto grid w-full max-w-7xl gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <div className={cn('mb-4 rounded-[1.5rem] px-5 py-4 text-sm', aiEnabled ? 'border border-accent/20 bg-accent/5 text-stone-700' : 'border border-stone-200 bg-stone-50 text-stone-600')}>
              {aiEnabled ? t('aiEnabledHint') : t('aiDisabled')}
            </div>

            {aiEnabled && !isGenerating && (
              <section className="rounded-[2rem] border border-stone-200 bg-white/90 p-8 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('prompt')}</p>
                <h1 className="mt-3 text-4xl font-serif font-medium tracking-tight text-stone-900">
                  {t('promptHeading')}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">
                  {t('promptBody')}
                </p>
                <div className="mt-8 rounded-[2rem] border border-stone-200 bg-stone-50 p-2">
                  <textarea
                    value={draftPrompt}
                    onChange={(event) => onChangeDraftPrompt(event.target.value)}
                    placeholder={
                      selectedProfessor
                        ? t('promptPlaceholderSelected', { name: selectedProfessor.name })
                        : t('promptPlaceholderDefault')
                    }
                    rows={5}
                    className="w-full resize-none border-none bg-transparent px-4 py-3 text-lg outline-none"
                  />
                  <div className="flex items-center justify-end border-t border-stone-200 px-3 pt-3">
                    <button
                      onClick={handleGenerate}
                      disabled={!draftPrompt || isGenerating}
                      className="flex items-center space-x-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGenerating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span>{isGenerating ? t('generating') : t('generateDraft')}</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {isGenerating && (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                  <p className="text-sm font-medium text-accent">{t('shapingDraft')}</p>
                </div>
              </div>
            )}

            {aiError && (
              <div className="mb-4 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                {aiError}
              </div>
            )}

            <div className={cn('space-y-4', !text && !isGenerating ? 'mt-8' : '')}>
              <div className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('subject')}</p>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t('emailSubject')}
                  className="mt-3 w-full border-none bg-transparent text-2xl font-semibold tracking-tight text-stone-900 outline-none"
                />
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-400">
                  <span className="rounded-full bg-stone-100 px-3 py-1 uppercase tracking-[0.18em]">
                    {selectedProfessor ? selectedProfessor.name : t('noProfessorSelected')}
                  </span>
                  {activeTemplateId && (
                    <span className="rounded-full bg-accent/10 px-3 py-1 uppercase tracking-[0.18em] text-accent">
                      {t('templateApplied')}
                    </span>
                  )}
                  {activeDraftId && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 uppercase tracking-[0.18em] text-emerald-700">
                      {t('savedDraftBadge')}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={text}
                  onChange={(event) => onChangeText(event.target.value)}
                  placeholder={t('bodyPlaceholder')}
                  className={cn(
                    'writing-area min-h-[70vh] w-full resize-none rounded-[2rem] border border-stone-200 bg-white px-8 py-8 shadow-sm outline-none transition-opacity',
                    isGenerating ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100',
                  )}
                />
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100">
                  <FileStack className="h-4 w-4 text-stone-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('recentDrafts')}</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-stone-900">{t('pickUpDrafts')}</h3>
                </div>
              </div>
              {draftsError && <p className="mt-4 text-sm text-rose-700">{draftsError}</p>}
              {draftsLoading ? (
                <p className="mt-4 text-sm text-stone-400">{t('loadingDrafts')}</p>
              ) : drafts.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-stone-400">{t('noDrafts')}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {drafts.slice(0, 6).map((draft) => (
                    <button
                      key={draft.id}
                      onClick={() => handleLoadDraft(draft.id)}
                      className={cn(
                        'w-full rounded-[1.5rem] border px-4 py-4 text-left transition-colors',
                        activeDraftId === draft.id
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50',
                      )}
                      >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-stone-900">{draft.title}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                          {draft.status === 'ready' ? t('draftStatusReady') : t('draftStatusDraft')}
                        </span>
                      </div>
                      <p className="mt-2 max-h-12 overflow-hidden text-sm leading-6 text-stone-500">{draft.subject || draft.body}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100">
                  <Paperclip className="h-4 w-4 text-stone-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('emailAttachments')}</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-stone-900">
                    {t('attachmentCount', {
                      count: mailAttachments.length,
                      suffix: locale === 'en' && mailAttachments.length === 1 ? '' : 's',
                    })}
                  </h3>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {mailAttachments.length === 0 ? (
                  <p className="text-sm leading-6 text-stone-400">{t('noEmailAttachments')}</p>
                ) : (
                  mailAttachments.map((attachment, index) => (
                    <div key={`${attachment.name}-${index}`} className="flex items-center justify-between rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-stone-700">{attachment.name}</div>
                        <div className="mt-1 text-xs text-stone-500">{Math.max(1, Math.round(attachment.size / 1024))} KB</div>
                      </div>
                      <button
                        onClick={() => setMailAttachments((current) => current.filter((_, attachmentIndex) => attachmentIndex !== index))}
                        className="rounded-full p-2 text-stone-400 transition-colors hover:bg-white hover:text-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-stone-500 transition-colors hover:border-accent hover:text-accent">
                  <Paperclip className="h-4 w-4" />
                  <span>{t('addEmailAttachment')}</span>
                  <input type="file" multiple className="hidden" onChange={(event) => void handleUploadMailAttachments(event)} />
                </label>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <MailPreviewDialog
        open={mailPreviewOpen}
        title={selectedProfessor ? t('draftingFor', { name: selectedProfessor.name }) : t('newOutreachDraft')}
        subject={renderedSubject}
        body={renderedBody}
        onClose={() => setMailPreviewOpen(false)}
      />

      <PreviewSendDialog
        open={sendPreviewOpen}
        professor={selectedProfessor}
        subject={renderedSubject}
        body={renderedBody}
        attachments={mailAttachments}
        onClose={() => setSendPreviewOpen(false)}
        onProfessorMailSent={onProfessorMailSent}
      />

      <TemplatePickerDialog
        open={templatePickerOpen}
        templates={templates}
        isLoading={templatesLoading}
        error={templatesError}
        activeTemplateId={activeTemplateId}
        selectedProfessor={selectedProfessor}
        profile={profile}
        onClose={() => setTemplatePickerOpen(false)}
        onApply={handleApplyTemplate}
      />
    </>
  );
}
