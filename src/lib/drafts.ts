import { getDesktopApi } from './desktop';
import type { MailDraft, MailDraftInput } from '../types/draft';

const STORAGE_KEY = 'vibe.drafts.v1';

interface DraftStore {
  version: 1;
  drafts: MailDraft[];
}

function normalizeInput(input: MailDraftInput): MailDraftInput {
  return {
    ...input,
    title: input.title.trim(),
    subject: input.subject.trim(),
    body: input.body,
  };
}

function readBrowserStore(): DraftStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = { version: 1 as const, drafts: [] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as DraftStore;
    if (parsed.version !== 1 || !Array.isArray(parsed.drafts)) {
      throw new Error('Invalid draft store.');
    }
    return parsed;
  } catch {
    const seeded = { version: 1 as const, drafts: [] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeBrowserStore(drafts: MailDraft[]) {
  const next: DraftStore = {
    version: 1,
    drafts,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function listDrafts() {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.drafts.list();
  }

  return readBrowserStore().drafts.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function saveDraft(id: string | null, input: MailDraftInput) {
  const normalized = normalizeInput(input);
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.drafts.save(id, normalized);
  }

  const current = readBrowserStore();
  const now = Date.now();

  if (id) {
    const nextDrafts = current.drafts.map((draft) =>
      draft.id === id
        ? {
            ...draft,
            ...normalized,
            updatedAt: now,
          }
        : draft,
    );
    writeBrowserStore(nextDrafts);
    return nextDrafts.find((draft) => draft.id === id) ?? null;
  }

  const nextDraft: MailDraft = {
    id: crypto.randomUUID(),
    ...normalized,
    createdAt: now,
    updatedAt: now,
  };
  writeBrowserStore([nextDraft, ...current.drafts]);
  return nextDraft;
}
