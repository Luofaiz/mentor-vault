import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { getUserProfileSettings, saveUserProfileSettings } from '../lib/profile';
import type { UserProfileSettings, UserProfileSettingsInput } from '../types/profile';

export function useUserProfile() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const record = await getUserProfileSettings();
      setProfile(record);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError(t('loadProfileFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (input: UserProfileSettingsInput) => {
    const record = await saveUserProfileSettings(input);
    setProfile(record);
    setError(null);
    return record;
  };

  return {
    profile,
    isLoading,
    error,
    refresh,
    save,
  };
}
