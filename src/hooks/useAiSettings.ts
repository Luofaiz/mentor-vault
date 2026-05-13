import { useEffect, useState } from 'react';
import { deleteAIConfig, getAISettings, saveAISettings, setActiveAIConfig } from '../lib/ai';
import { useI18n } from '../lib/i18n';
import type { AIConfigState, AISettingsInput } from '../types/ai';

export function useAiSettings() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AIConfigState>({ configs: [], activeConfigId: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const record = await getAISettings();
      setSettings(record);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError(t('loadAiSettingsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (input: AISettingsInput) => {
    const record = await saveAISettings(input);
    setSettings(record);
    setError(null);
    return record;
  };

  const setActive = async (id: string) => {
    const record = await setActiveAIConfig(id);
    setSettings(record);
    setError(null);
    return record;
  };

  const remove = async (id: string) => {
    const record = await deleteAIConfig(id);
    setSettings(record);
    setError(null);
    return record;
  };

  return {
    settings,
    isLoading,
    error,
    refresh,
    save,
    setActive,
    remove,
  };
}
