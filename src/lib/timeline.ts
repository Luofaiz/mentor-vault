import { INITIAL_TIMELINE_EVENTS } from '../data/seedTimeline';
import { getDesktopApi } from './desktop';
import type { TimelineEvent, TimelineEventDraft } from '../types/timeline';

const STORAGE_KEY = 'vibe.timeline.v1';

interface TimelineStore {
  version: 1;
  events: TimelineEvent[];
}

function normalizeDraft(draft: TimelineEventDraft): TimelineEventDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    eventDate: draft.eventDate,
  };
}

function readBrowserStore(): TimelineStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = { version: 1 as const, events: INITIAL_TIMELINE_EVENTS };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as TimelineStore;
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) {
      throw new Error('Invalid timeline store.');
    }
    return parsed;
  } catch {
    const seeded = { version: 1 as const, events: INITIAL_TIMELINE_EVENTS };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeBrowserStore(events: TimelineEvent[]) {
  const next: TimelineStore = {
    version: 1,
    events,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function listTimelineEvents(professorId: string) {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.timeline.list(professorId);
  }

  return readBrowserStore()
    .events
    .filter((event) => event.professorId === professorId)
    .sort((left, right) => {
      const dateCompare = right.eventDate.localeCompare(left.eventDate);
      return dateCompare !== 0 ? dateCompare : right.createdAt - left.createdAt;
    });
}

export async function createTimelineEvent(draft: TimelineEventDraft) {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.timeline.create(normalizeDraft(draft));
  }

  const current = readBrowserStore();
  const now = Date.now();
  const record: TimelineEvent = {
    id: crypto.randomUUID(),
    ...normalizeDraft(draft),
    createdAt: now,
  };
  writeBrowserStore([record, ...current.events]);
  return record;
}
