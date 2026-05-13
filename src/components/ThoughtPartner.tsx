import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, SendHorizonal, Sparkles } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAiSettings } from '../hooks/useAiSettings';
import { sendAiChat } from '../lib/ai';
import type { AIChatMessage } from '../types/ai';
import type { Professor } from '../types/professor';

interface ThoughtPartnerProps {
  draftText: string;
  draftPrompt: string;
  selectedProfessor: Professor | null;
}

export function ThoughtPartner({ draftText, draftPrompt, selectedProfessor }: ThoughtPartnerProps) {
  const { locale, t } = useI18n();
  const { settings } = useAiSettings();
  const activeConfig = settings.configs.find((config) => config.isActive) ?? null;
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: t('assistantWelcome'),
      },
    ]);
    setInput('');
    setError(null);
  }, [selectedProfessor?.id, t]);

  const contextMessage = useMemo(() => {
    const professorLine = selectedProfessor
      ? `${selectedProfessor.name} / ${selectedProfessor.school} / ${selectedProfessor.researchArea || t('researchAreaNotSet')}`
      : t('noProfessorSelected');
    const promptLine = draftPrompt.trim() || '-';
    const bodyLine = draftText.trim() || '-';
    return `${t('assistantContextLabel')}\nProfessor: ${professorLine}\nPrompt: ${promptLine}\nDraft:\n${bodyLine}`;
  }, [draftPrompt, draftText, selectedProfessor, t]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    const nextMessages: AIChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setError(null);

    if (!activeConfig) {
      setError(t('assistantUnavailable'));
      return;
    }

    setIsSending(true);
    try {
      const reply = await sendAiChat({
        locale,
        messages: [
          { role: 'system', content: contextMessage },
          ...nextMessages,
        ],
      });
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : t('assistantUnavailable'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside className="w-[22rem] border-l border-stone-200 bg-stone-50/80 flex flex-col p-6">
      <div className="flex items-center space-x-2 mb-8">
        <Sparkles className="text-accent w-5 h-5" />
        <h3 className="font-semibold text-sm uppercase tracking-[0.24em] text-stone-500">{t('writingAssistant')}</h3>
      </div>

      <div className="mb-4 rounded-[1.5rem] border border-dashed border-stone-200 bg-white px-4 py-4 text-xs leading-6 text-stone-500 whitespace-pre-wrap">
        {contextMessage}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-stone-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
              <MessageSquare className="w-6 h-6 text-stone-300" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-stone-400">{t('startDraftingHint')}</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
              className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[85%] rounded-[1.5rem] bg-ink px-4 py-3 text-sm leading-7 text-white'
                    : 'max-w-[85%] rounded-[1.5rem] border border-stone-200 bg-white px-4 py-3 text-sm leading-7 text-stone-600'
                }
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {isSending && (
          <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
            {t('assistantTyping')}
          </div>
        )}
        {error && (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-[2rem] bg-white p-4 shadow-sm">
        <textarea
          rows={4}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t('assistantInputPlaceholder')}
          className="w-full resize-none rounded-[1.5rem] border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || isSending}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <SendHorizonal className="h-4 w-4" />
          <span>{t('sendMessage')}</span>
        </button>
      </div>
    </aside>
  );
}
