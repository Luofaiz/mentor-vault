export type AIProvider = 'gemini' | 'openai';

export type AppLocale = 'zh' | 'en';

export interface AIConfig {
  id: string;
  name: string;
  provider: AIProvider;
  baseUrl: string;
  model: string;
  apiKeyHint: string;
  hasApiKey: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AIConfigState {
  configs: AIConfig[];
  activeConfigId: string | null;
}

export interface AISettingsInput {
  id?: string | null;
  name: string;
  provider: AIProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AITestInput extends AISettingsInput {
  locale?: AppLocale;
}

export interface AIContextFile {
  name: string;
  content: string;
}

export interface GenerateDraftInput {
  prompt: string;
  files?: AIContextFile[];
  currentText?: string;
  locale?: AppLocale;
}

export interface IterateSelectionInput {
  selection: string;
  feedback: string;
  fullContext: string;
  locale?: AppLocale;
}

export interface FeedbackInput {
  text: string;
  locale?: AppLocale;
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIChatInput {
  messages: AIChatMessage[];
  locale?: AppLocale;
}

export interface AITestResult {
  ok: true;
  provider: AIProvider;
  model: string;
  preview: string;
}
