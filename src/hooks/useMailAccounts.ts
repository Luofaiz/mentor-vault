import { useEffect, useState } from 'react';
import { listMailAccounts, saveMailAccount } from '../lib/mail';
import { useI18n } from '../lib/i18n';
import type { MailAccount, MailAccountInput } from '../types/mail';

export function useMailAccounts() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const records = await listMailAccounts();
      setAccounts(records);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError(t('loadMailAccountsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (id: string | null, input: MailAccountInput) => {
    const account = await saveMailAccount(id, input);
    await refresh();
    return account;
  };

  return {
    accounts,
    isLoading,
    error,
    refresh,
    save,
  };
}
