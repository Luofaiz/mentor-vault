import { getDesktopApi } from './desktop';
import type { DocumentNote, DocumentNoteInput } from '../types/note';

const STORAGE_KEY = 'mentor.documentNotes.v1';

interface NoteStore {
  version: 1;
  notes: DocumentNote[];
}

function normalizeInput(input: DocumentNoteInput): DocumentNoteInput {
  return {
    title: input.title.trim(),
    body: input.body,
  };
}

function readBrowserStore(): NoteStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = { version: 1 as const, notes: [] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as NoteStore;
    if (parsed.version !== 1 || !Array.isArray(parsed.notes)) {
      throw new Error('Invalid note store.');
    }
    return parsed;
  } catch {
    const seeded = { version: 1 as const, notes: [] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeBrowserStore(notes: DocumentNote[]) {
  const next: NoteStore = {
    version: 1,
    notes,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function listNotes() {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.notes.list();
  }

  return readBrowserStore().notes.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function saveNote(id: string | null, input: DocumentNoteInput) {
  const normalized = normalizeInput(input);
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.notes.save(id, normalized);
  }

  const current = readBrowserStore();
  const now = Date.now();

  if (id) {
    const nextNotes = current.notes.map((note) =>
      note.id === id
        ? {
            ...note,
            ...normalized,
            updatedAt: now,
          }
        : note,
    );
    writeBrowserStore(nextNotes);
    return nextNotes.find((note) => note.id === id) ?? null;
  }

  const nextNote: DocumentNote = {
    id: crypto.randomUUID(),
    ...normalized,
    createdAt: now,
    updatedAt: now,
  };
  writeBrowserStore([nextNote, ...current.notes]);
  return nextNote;
}

export async function deleteNote(id: string) {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    await desktopApi.notes.delete(id);
    return;
  }

  const current = readBrowserStore();
  writeBrowserStore(current.notes.filter((note) => note.id !== id));
}
