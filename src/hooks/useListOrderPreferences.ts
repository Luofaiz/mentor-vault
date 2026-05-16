import { useEffect, useState } from 'react';
import { getListOrderPreferences, saveListOrderPreferences } from '../lib/listOrderPreferences';
import type { ListOrderPreferences } from '../types/listOrderPreferences';

const DEFAULT_PREFERENCES: ListOrderPreferences = {
  noteIds: [],
  schools: [],
  collegesBySchool: {},
};

export function useListOrderPreferences() {
  const [preferences, setPreferences] = useState<ListOrderPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      setPreferences(await getListOrderPreferences());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (nextPreferences: ListOrderPreferences) => {
    setPreferences(nextPreferences);
    const saved = await saveListOrderPreferences(nextPreferences);
    setPreferences(saved);
    return saved;
  };

  return {
    preferences,
    isLoading,
    refresh,
    save,
  };
}
