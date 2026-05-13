import { useEffect, useState } from 'react';
import { listSendLogs } from '../lib/mail';
import { useI18n } from '../lib/i18n';
import type { SendLog } from '../types/mail';

export function useSendLogs() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const records = await listSendLogs();
      setLogs(records);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError(t('loadSendLogsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    logs,
    isLoading,
    error,
    refresh,
  };
}
