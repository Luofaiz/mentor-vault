import { useEffect, useState } from 'react';
import { createTimelineEvent, listTimelineEvents } from '../lib/timeline';
import { useI18n } from '../lib/i18n';
import type { TimelineEvent, TimelineEventDraft } from '../types/timeline';

export function useTimeline(professorId: string | null) {
  const { t } = useI18n();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!professorId) {
      setEvents([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const records = await listTimelineEvents(professorId);
      setEvents(records);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError(t('loadTimelineFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [professorId]);

  const create = async (draft: TimelineEventDraft) => {
    await createTimelineEvent(draft);
    await refresh();
  };

  return {
    events,
    isLoading,
    error,
    refresh,
    create,
  };
}
