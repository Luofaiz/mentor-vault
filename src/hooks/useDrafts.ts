import { useEffect, useState } from 'react';
import { listDrafts, saveDraft } from '../lib/drafts';
import { useI18n } from '../lib/i18n';
import type { MailDraft, MailDraftInput } from '../types/draft';

export function useDrafts() {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<MailDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const records = await listDrafts();
      setDrafts(records);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError(t('loadDraftsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (id: string | null, input: MailDraftInput) => {
    const record = await saveDraft(id, input);
    await refresh();
    return record;
  };

  return {
    drafts,
    isLoading,
    error,
    refresh,
    save,
  };
}
