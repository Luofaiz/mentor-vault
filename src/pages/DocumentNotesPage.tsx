import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, FileImage, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useDocumentNotes } from '../hooks/useDocumentNotes';
import { useListOrderPreferences } from '../hooks/useListOrderPreferences';
import { useI18n } from '../lib/i18n';
import { moveKeyToDropPosition, orderItems } from '../lib/listOrdering';
import { cn } from '../lib/utils';
import type { DocumentNote } from '../types/note';

type DropPosition = 'before' | 'after';
type InsertImageStatus = 'idle' | 'loading' | 'error';

function getDropPosition(event: DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

function createFallbackNote(): DocumentNote {
  const now = Date.now();
  return {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `note-${now}`,
    title: '',
    body: '',
    createdAt: now,
    updatedAt: now,
  };
}

function formatUpdatedAt(value: number, locale: string) {
  if (!Number.isFinite(value)) {
    return '';
  }

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getExcerpt(body: string) {
  return body.replace(/\s+/g, ' ').trim();
}

function sanitizeMarkdownFilename(value: string) {
  const fallback = 'document-note';
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}

function triggerMarkdownDownload(title: string, body: string) {
  const normalizedTitle = title.trim() || '未命名笔记';
  const content = body.startsWith('# ') ? body : `# ${normalizedTitle}\n\n${body}`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeMarkdownFilename(normalizedTitle)}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Invalid image data.'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Failed to read image.')));
    reader.readAsDataURL(file);
  });
}

function getImageAltText(file: File) {
  return file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[[\]()]/g, '')
    .trim() || '图片';
}

export function DocumentNotesPage() {
  const { locale, t } = useI18n();
  const { notes, isLoading, error, save, remove } = useDocumentNotes();
  const { preferences, save: saveOrderPreferences } = useListOrderPreferences();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<DocumentNote>(() => createFallbackNote());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [noteDropTarget, setNoteDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const [insertImageStatus, setInsertImageStatus] = useState<InsertImageStatus>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSavedSnapshotRef = useRef('');

  const orderedNotes = useMemo(
    () => orderItems(notes, preferences.noteIds, (note) => note.id),
    [notes, preferences.noteIds],
  );

  const filteredNotes = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return orderedNotes;
    }

    return orderedNotes.filter((note) =>
      [note.title, note.body]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [orderedNotes, search]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  useEffect(() => {
    if (selectedNoteId && notes.some((note) => note.id === selectedNoteId)) {
      return;
    }

      setSelectedNoteId(orderedNotes[0]?.id ?? null);
  }, [notes, orderedNotes, selectedNoteId]);

  useEffect(() => {
    if (!selectedNote) {
      setDraft(createFallbackNote());
      lastSavedSnapshotRef.current = '';
      setSaveState('idle');
      return;
    }

    setDraft(selectedNote);
    lastSavedSnapshotRef.current = JSON.stringify({
      title: selectedNote.title,
      body: selectedNote.body,
    });
    setSaveState('saved');
  }, [selectedNote]);

  useEffect(() => {
    if (!selectedNoteId) {
      return;
    }

    const snapshot = JSON.stringify({
      title: draft.title,
      body: draft.body,
    });
    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    setSaveState('saving');
    const timer = window.setTimeout(() => {
      void save(selectedNoteId, {
        title: draft.title,
        body: draft.body,
      }).then((record) => {
        if (!record) {
          return;
        }
        lastSavedSnapshotRef.current = JSON.stringify({
          title: record.title,
          body: record.body,
        });
        setSaveState('saved');
      });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [draft.body, draft.title, save, selectedNoteId]);

  const handleCreateNote = async () => {
    const record = await save(null, {
      title: '',
      body: '',
    });
    if (record) {
      setSelectedNoteId(record.id);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNoteId) {
      return;
    }

    const title = draft.title.trim() || t('untitledNote');
    if (!window.confirm(t('deleteNoteConfirm', { title }))) {
      return;
    }

    await remove(selectedNoteId);
    setSelectedNoteId(null);
  };

  const handleExportMarkdown = () => {
    triggerMarkdownDownload(draft.title, draft.body);
  };

  const insertMarkdownAtCursor = (markdown: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.body.length;
    const end = textarea?.selectionEnd ?? draft.body.length;
    const prefix = draft.body.slice(0, start);
    const suffix = draft.body.slice(end);
    const needsLeadingBreak = prefix.length > 0 && !prefix.endsWith('\n');
    const needsTrailingBreak = suffix.length > 0 && !suffix.startsWith('\n');
    const insertion = `${needsLeadingBreak ? '\n\n' : ''}${markdown}${needsTrailingBreak ? '\n\n' : ''}`;
    const nextCursor = start + insertion.length;

    setDraft((current) => ({
      ...current,
      body: `${current.body.slice(0, start)}${insertion}${current.body.slice(end)}`,
    }));

    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    setInsertImageStatus('loading');
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      insertMarkdownAtCursor(`![${getImageAltText(file)}](${dataUrl})`);
      setInsertImageStatus('idle');
    } catch {
      setInsertImageStatus('error');
    }
  };

  const handleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      void insertImageFile(file);
    }
  };

  const handlePasteNoteBody = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));
    if (!imageFile) {
      return;
    }

    event.preventDefault();
    void insertImageFile(imageFile);
  };

  const handleDropNote = async (targetNoteId: string, position: DropPosition) => {
    if (!draggedNoteId || draggedNoteId === targetNoteId || search.trim()) {
      setDraggedNoteId(null);
      setNoteDropTarget(null);
      return;
    }

    const currentOrder = orderedNotes.map((note) => note.id);
    const nextNoteIds = moveKeyToDropPosition(currentOrder, draggedNoteId, targetNoteId, position);
    setDraggedNoteId(null);
    setNoteDropTarget(null);
    await saveOrderPreferences({
      ...preferences,
      noteIds: nextNoteIds,
    });
  };

  const hasNotes = notes.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 py-8 md:px-12">
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="shrink-0 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{t('documentNotesEyebrow')}</p>
            <h1 className="mt-3 text-4xl font-serif font-medium tracking-tight text-stone-900">{t('documentNotes')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">{t('documentNotesDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleCreateNote()}
            className="inline-flex items-center justify-center space-x-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            <span>{t('addNote')}</span>
          </button>
        </div>

        {error && <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>}

        {isLoading ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-stone-200 bg-white px-6 py-16 text-center text-sm text-stone-400">
            {t('loadingNotes')}
          </div>
        ) : !hasNotes ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-stone-300" />
            <p className="mt-4 text-lg font-medium text-stone-700">{t('noNotesYet')}</p>
            <button
              type="button"
              onClick={() => void handleCreateNote()}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800"
            >
              <Plus className="h-4 w-4" />
              <span>{t('createFirstNote')}</span>
            </button>
          </div>
        ) : (
          <div className="mt-8 grid min-h-0 flex-1 gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="shrink-0 px-2 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" />
                    <h2 className="text-sm font-semibold text-stone-900">{t('noteIndex')}</h2>
                  </div>
                  <span className="text-xs text-stone-400">{notes.length}</span>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('searchNotes')}
                    className="w-full rounded-full border border-stone-200 bg-stone-50 px-11 py-2.5 text-sm outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-1 pr-1">
                {filteredNotes.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-stone-400">{t('noNotesMatch')}</p>
                ) : (
                  filteredNotes.map((note) => {
                    const selected = note.id === selectedNoteId;
                    const title = note.title.trim() || t('untitledNote');
                    const excerpt = getExcerpt(note.body);
                    return (
                      <button
                        key={note.id}
                        type="button"
                        draggable={!search.trim()}
                        onDragStart={(event) => {
                          setDraggedNoteId(note.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', note.id);
                        }}
                        onDragOver={(event) => {
                          if (!search.trim()) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            setNoteDropTarget({ id: note.id, position: getDropPosition(event) });
                          }
                        }}
                        onDragLeave={() => {
                          setNoteDropTarget((current) => (current?.id === note.id ? null : current));
                        }}
                        onDragEnd={() => {
                          setDraggedNoteId(null);
                          setNoteDropTarget(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          void handleDropNote(note.id, getDropPosition(event));
                        }}
                        onClick={() => setSelectedNoteId(note.id)}
                        className={cn(
                          'relative w-full rounded-[1.25rem] px-4 py-3 text-left transition-colors',
                          selected ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-700 hover:bg-stone-100',
                          draggedNoteId === note.id && 'opacity-50',
                        )}
                      >
                        {noteDropTarget?.id === note.id && draggedNoteId !== note.id && (
                          <span
                            className={cn(
                              'pointer-events-none absolute left-4 right-4 z-10 h-0.5 rounded-full bg-accent shadow-sm shadow-accent/30',
                              noteDropTarget.position === 'before' ? '-top-1' : '-bottom-1',
                            )}
                          />
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold">{title}</span>
                          <span className={cn('shrink-0 text-[11px]', selected ? 'text-stone-300' : 'text-stone-400')}>
                            {formatUpdatedAt(note.updatedAt, locale)}
                          </span>
                        </div>
                        <p className={cn('mt-2 line-clamp-2 text-xs leading-5', selected ? 'text-stone-300' : 'text-stone-500')}>
                          {excerpt || t('emptyNotePreview')}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
              <div className="shrink-0 border-b border-stone-100 px-6 py-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <input
                      value={draft.title}
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder={t('noteTitlePlaceholder')}
                      className="w-full bg-transparent text-2xl font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-300"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-400">
                      <span>{saveState === 'saving' ? t('saving') : saveState === 'saved' ? t('noteSaved') : t('editingNote')}</span>
                      {selectedNote && <span>{t('lastUpdatedAt', { time: formatUpdatedAt(selectedNote.updatedAt, locale) })}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                    >
                      <FileImage className="h-4 w-4" />
                      <span>{insertImageStatus === 'loading' ? t('insertingImage') : t('insertImage')}</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageInputChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleExportMarkdown}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                    >
                      <Download className="h-4 w-4" />
                      <span>{t('exportMarkdown')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteNote()}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{t('delete')}</span>
                    </button>
                  </div>
                </div>
              </div>

              <textarea
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                onPaste={handlePasteNoteBody}
                placeholder={t('noteBodyPlaceholder')}
                ref={textareaRef}
                className="min-h-[12rem] resize-none border-b border-stone-100 bg-white px-6 py-6 font-sans text-base leading-8 text-stone-700 outline-none placeholder:text-stone-300 lg:min-h-0 lg:flex-1"
              />
              <div className="min-h-[12rem] overflow-y-auto bg-stone-50 px-6 py-6 lg:max-h-[42%]">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs text-stone-400">
                  <span>{t('notePreview')}</span>
                  {insertImageStatus === 'error' && <span className="text-rose-500">{t('insertImageFailed')}</span>}
                </div>
                {draft.body.trim() ? (
                  <div className="note-preview rounded-[1.5rem] border border-stone-200 bg-white px-5 py-5 text-sm leading-7 text-stone-700">
                    <ReactMarkdown urlTransform={(url) => url}>{draft.body}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-400">
                    {t('emptyNotePreview')}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
