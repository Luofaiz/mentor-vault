import { useEffect, useState } from 'react';
import { deleteTemplate, listTemplates, saveTemplate } from '../lib/templates';
import { useI18n } from '../lib/i18n';
import type { DraftTemplateInput, MailTemplate } from '../types/template';

export function useTemplates() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const records = await listTemplates();
      setTemplates(records);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError(t('loadTemplatesFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (id: string, input: DraftTemplateInput) => {
    const record = await saveTemplate(id, input);
    await refresh();
    return record;
  };

  const remove = async (id: string) => {
    await deleteTemplate(id);
    await refresh();
  };

  return {
    templates,
    isLoading,
    error,
    refresh,
    save,
    remove,
  };
}
