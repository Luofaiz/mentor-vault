import type { Professor, ProfessorDraft, ProfessorFilters } from '../types/professor';
import type { TimelineEvent, TimelineEventDraft } from '../types/timeline';
import type { DraftTemplateInput, MailTemplate } from '../types/template';
import type { MailDraft, MailDraftInput } from '../types/draft';
import type { MailAccount, MailAccountInput, SendEmailPayload, SendLog } from '../types/mail';
import type { UserProfileSettings, UserProfileSettingsInput } from '../types/profile';
import type {
  AIChatInput,
  AIConfigState,
  AITestInput,
  AITestResult,
  AISettingsInput,
  FeedbackInput,
  GenerateDraftInput,
  IterateSelectionInput,
} from '../types/ai';

export interface VibeDesktopApi {
  system: {
    getRuntimeInfo: () => Promise<{
      platform: string;
      storageMode: 'desktop-json';
      version: string;
    }>;
    checkForUpdates: () => Promise<{
      configured: boolean;
      currentVersion: string;
      latestVersion?: string;
      updateAvailable: boolean;
      downloadUrl?: string;
      releaseUrl?: string;
      notes?: string;
    }>;
    openExternalUrl: (url: string) => Promise<void>;
    installUpdate: (downloadUrl: string) => Promise<{ ok: true }>;
  };
  professors: {
    list: (filters?: ProfessorFilters) => Promise<Professor[]>;
    create: (draft: ProfessorDraft) => Promise<Professor>;
    update: (id: string, draft: ProfessorDraft) => Promise<Professor>;
    trash: (id: string) => Promise<Professor>;
    restore: (id: string) => Promise<Professor>;
    purge: (id: string) => Promise<void>;
  };
  profile: {
    get: () => Promise<UserProfileSettings | null>;
    save: (input: UserProfileSettingsInput) => Promise<UserProfileSettings>;
  };
  timeline: {
    list: (professorId: string) => Promise<TimelineEvent[]>;
    create: (draft: TimelineEventDraft) => Promise<TimelineEvent>;
  };
  templates: {
    list: () => Promise<MailTemplate[]>;
    save: (id: string, input: DraftTemplateInput) => Promise<MailTemplate>;
    delete: (id: string) => Promise<void>;
  };
  drafts: {
    list: () => Promise<MailDraft[]>;
    save: (id: string | null, input: MailDraftInput) => Promise<MailDraft | null>;
  };
  mailAccounts: {
    list: () => Promise<MailAccount[]>;
    save: (id: string | null, input: MailAccountInput) => Promise<MailAccount>;
  };
  mail: {
    send: (payload: SendEmailPayload) => Promise<{ ok: true }>;
    listLogs: () => Promise<SendLog[]>;
  };
  ai: {
    getSettings: () => Promise<AIConfigState>;
    saveSettings: (input: AISettingsInput) => Promise<AIConfigState>;
    setActiveConfig: (id: string) => Promise<AIConfigState>;
    deleteConfig: (id: string) => Promise<AIConfigState>;
    testSettings: (input: AITestInput) => Promise<AITestResult>;
    generateDraft: (input: GenerateDraftInput) => Promise<string>;
    iterateSelection: (input: IterateSelectionInput) => Promise<string>;
    getFeedback: (input: FeedbackInput) => Promise<string>;
    chat: (input: AIChatInput) => Promise<string>;
  };
}

export function getDesktopApi(): VibeDesktopApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.vibe ?? null;
}

export function isDesktopRuntime() {
  return getDesktopApi() !== null;
}
