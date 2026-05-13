import { getDesktopApi } from './desktop';
import type {
  AIChatInput,
  AIConfigState,
  AITestInput,
  AITestResult,
  AIProvider,
  AISettingsInput,
  AppLocale,
  GenerateDraftInput,
} from '../types/ai';

export const DEFAULT_AI_CONFIG = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
} satisfies Record<AIProvider, { baseUrl: string; model: string }>;

export function getDefaultAISettingsInput(provider: AIProvider = 'gemini'): AISettingsInput {
  return {
    id: null,
    name: provider === 'gemini' ? '配置 1' : '配置 2',
    provider,
    baseUrl: DEFAULT_AI_CONFIG[provider].baseUrl,
    model: DEFAULT_AI_CONFIG[provider].model,
    apiKey: '',
  };
}

export async function getAISettings(): Promise<AIConfigState> {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    return {
      configs: [],
      activeConfigId: null,
    };
  }

  return desktopApi.ai.getSettings();
}

export async function saveAISettings(input: AISettingsInput) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for AI settings.');
  }

  return desktopApi.ai.saveSettings(input);
}

export async function setActiveAIConfig(id: string) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for AI settings.');
  }

  return desktopApi.ai.setActiveConfig(id);
}

export async function deleteAIConfig(id: string) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for AI settings.');
  }

  return desktopApi.ai.deleteConfig(id);
}

export async function testAISettings(input: AITestInput): Promise<AITestResult> {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for AI settings.');
  }

  return desktopApi.ai.testSettings(input);
}

function buildDraftPrompt(context: GenerateDraftInput) {
  const fileContext = context.files?.map((file) => `File: ${file.name}\nContent: ${file.content}`).join('\n\n') || '';

  if (context.locale === 'en') {
    return `
      You are a world-class writing collaborator.
      Based on the following context and files, write a draft for: ${context.prompt}

      ${fileContext ? `Context Files:\n${fileContext}` : ''}

      Follow the user's requested language. If the user did not specify a language, default to a polished English outreach email.
      Focus on being concise, natural, and research-aware.
    `;
  }

  return `
    你是一名高水平邮件写作助手。
    请根据以下需求和上下文起草邮件：${context.prompt}

    ${fileContext ? `参考文件：\n${fileContext}` : ''}

    请优先遵循用户在提示词中要求的语言；如果用户没有明确指定语言，默认输出适合联系老师的正式英文邮件。
    内容要简洁、自然，并体现研究方向匹配度。
  `;
}

export async function generateDraft(context: GenerateDraftInput) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for AI features.');
  }

  return desktopApi.ai.generateDraft({
    ...context,
    locale: context.locale ?? 'zh',
    prompt: buildDraftPrompt(context),
  });
}

export async function iterateSelection(
  selection: string,
  feedback: string,
  fullContext: string,
  locale: AppLocale = 'zh',
) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for AI features.');
  }

  return desktopApi.ai.iterateSelection({
    selection,
    feedback,
    fullContext,
    locale,
  });
}

export async function* streamProactiveFeedback(text: string, locale: AppLocale = 'zh') {
  if (text.length < 50) {
    return;
  }

  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for AI features.');
  }

  const response = await desktopApi.ai.getFeedback({
    text,
    locale,
  });
  yield response;
}

export async function sendAiChat(input: AIChatInput) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for AI features.');
  }

  return desktopApi.ai.chat(input);
}
