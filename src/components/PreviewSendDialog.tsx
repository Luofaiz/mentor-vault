import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, MailCheck, Paperclip, Send, X } from 'lucide-react';
import { useMailAccounts } from '../hooks/useMailAccounts';
import { useI18n } from '../lib/i18n';
import { getDefaultMailAccount, sendEmail } from '../lib/mail';
import { isDesktopRuntime } from '../lib/desktop';
import type { MailAttachment } from '../types/mail';
import type { Professor } from '../types/professor';

interface PreviewSendDialogProps {
  open: boolean;
  professor: Professor | null;
  subject: string;
  body: string;
  attachments: MailAttachment[];
  onClose: () => void;
  onProfessorMailSent: (id: string) => Promise<void>;
}

export function PreviewSendDialog({
  open,
  professor,
  subject,
  body,
  attachments,
  onClose,
  onProfessorMailSent,
}: PreviewSendDialogProps) {
  const { locale, t } = useI18n();
  const { accounts, isLoading, error } = useMailAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<'success' | 'failed' | null>(null);
  const desktopReady = isDesktopRuntime();

  const defaultAccount = useMemo(() => getDefaultMailAccount(accounts), [accounts]);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? defaultAccount ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedAccountId(defaultAccount?.id ?? '');
    setResult(null);
    setResultTone(null);
  }, [defaultAccount?.id, open]);

  if (!open) {
    return null;
  }

  const missingRecipient = !professor?.email;
  const missingSubject = !subject.trim();
  const missingBody = !body.trim();
  const missingAccount = !selectedAccount;
  const sendDisabled = !desktopReady || missingRecipient || missingSubject || missingBody || missingAccount || isSending;

  const handleSend = async () => {
    if (!selectedAccount || !professor?.email) {
      return;
    }

    setIsSending(true);
    setResult(null);
    setResultTone(null);
    try {
      await sendEmail({
        accountId: selectedAccount.id,
        to: professor.email,
        subject: subject.trim(),
        body,
        attachments,
      });
      await onProfessorMailSent(professor.id);
      setResult(t('emailSentSuccessfully'));
      setResultTone('success');
    } catch (sendError) {
      setResult(sendError instanceof Error ? sendError.message : t('failedToSendEmail'));
      setResultTone('failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-6 py-10 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-[2rem] bg-white shadow-2xl shadow-stone-900/15">
        <div className="flex items-start justify-between border-b border-stone-100 px-8 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('previewAndSend')}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
              {professor ? t('sendTo', { name: professor.name }) : t('selectProfessorFirst')}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-stone-100 px-8 py-6 lg:border-b-0 lg:border-r">
            <div className="space-y-4 rounded-[2rem] border border-stone-200 bg-stone-50 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('fromAccount')}</p>
                {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
                {isLoading ? (
                  <p className="mt-3 text-sm text-stone-400">{t('loadingAccounts')}</p>
                ) : accounts.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-stone-500">
                    {t('noSmtpAccount')}
                  </p>
                ) : (
                  <select
                    value={selectedAccountId || selectedAccount?.id || ''}
                    onChange={(event) => setSelectedAccountId(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none transition-colors focus:border-accent"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.email}{account.isDefault ? ` (${t('defaultBadge')})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('recipient')}</p>
                <p className="mt-3 text-sm text-stone-700">{professor?.email || t('noProfessorEmail')}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('attachmentsForSend')}</p>
                {attachments.length === 0 ? (
                  <p className="mt-3 text-sm text-stone-500">{t('noEmailAttachments')}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {attachments.map((attachment, index) => (
                      <div key={`${attachment.name}-${index}`} className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                        <Paperclip className="h-4 w-4 text-stone-400" />
                        <span className="truncate">{attachment.name}</span>
                      </div>
                    ))}
                    <p className="text-xs text-stone-400">
                      {t('attachmentCount', {
                        count: attachments.length,
                        suffix: locale === 'en' && attachments.length === 1 ? '' : 's',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {!desktopReady && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {t('desktopRequired')}
                </div>
              )}

              {(missingRecipient || missingSubject || missingBody || missingAccount) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <div>
                      {missingRecipient && <p>{t('professorEmailRequired')}</p>}
                      {missingAccount && <p>{t('configuredAccountRequired')}</p>}
                      {missingSubject && <p>{t('subjectRequired')}</p>}
                      {missingBody && <p>{t('bodyRequired')}</p>}
                    </div>
                  </div>
                </div>
              )}

              {result && (
                <div className={`rounded-2xl px-4 py-3 text-sm ${resultTone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {result}
                </div>
              )}

              <button
                onClick={() => void handleSend()}
                disabled={sendDisabled}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? <MailCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                <span>{isSending ? t('sendingNow') : t('sendNow')}</span>
              </button>
            </div>
          </div>

          <div className="px-8 py-6">
            <div className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-100 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('subject')}</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-stone-900">{subject || t('noSubjectYet')}</p>
              </div>
              <div className="max-h-[420px] overflow-y-auto px-6 py-5">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-stone-700">{body || t('noBodyYet')}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
