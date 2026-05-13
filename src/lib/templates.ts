import { INITIAL_TEMPLATES } from '../data/seedTemplates';
import { getDesktopApi } from './desktop';
import { resolveLocalePreference, type Locale } from './i18n';
import type { Professor } from '../types/professor';
import type { UserProfileSettings } from '../types/profile';
import type { DraftTemplateInput, MailTemplate, TemplateVariableOption } from '../types/template';

const STORAGE_KEY = 'vibe.templates.v1';
const TEMPLATE_STORE_VERSION = 3;
const REMOVED_PRESET_TEMPLATE_IDS = new Set(['template-first-outreach', 'template-follow-up']);

interface TemplateStore {
  version: number;
  templates: MailTemplate[];
}

export interface TemplateRenderContext {
  professor: Professor | null;
  profile: UserProfileSettings | null;
  locale?: Locale;
}

const TEMPLATE_VARIABLES: Record<Locale, TemplateVariableOption[]> = {
  zh: [
    { key: 'user_name', label: '自己的名字', example: '{{user_name}}' },
    { key: 'user_university', label: '自己的学校', example: '{{user_university}}' },
    { key: 'prof_name', label: '老师姓名', example: '{{prof_name}}' },
    { key: 'prof_school', label: '老师学校', example: '{{prof_school}}' },
    { key: 'prof_title', label: '老师职称', example: '{{prof_title}}' },
    { key: 'prof_email', label: '老师邮箱', example: '{{prof_email}}' },
    { key: 'research_area', label: '老师研究方向', example: '{{research_area}}' },
  ],
  en: [
    { key: 'user_name', label: 'Your name', example: '{{user_name}}' },
    { key: 'user_university', label: 'Your university', example: '{{user_university}}' },
    { key: 'prof_name', label: 'Professor name', example: '{{prof_name}}' },
    { key: 'prof_school', label: 'Professor school', example: '{{prof_school}}' },
    { key: 'prof_title', label: 'Professor title', example: '{{prof_title}}' },
    { key: 'prof_email', label: 'Professor email', example: '{{prof_email}}' },
    { key: 'research_area', label: 'Research area', example: '{{research_area}}' },
  ],
};

function getSeededStore(): TemplateStore {
  return {
    version: TEMPLATE_STORE_VERSION,
    templates: INITIAL_TEMPLATES,
  };
}

function shouldDropTemplate(template: MailTemplate) {
  return REMOVED_PRESET_TEMPLATE_IDS.has(template.id);
}

function sanitizeTemplates(templates: MailTemplate[]) {
  return templates.map((template) => normalizeTemplate(template)).filter((template) => !shouldDropTemplate(template));
}

function normalizeTemplateInput(input: DraftTemplateInput): DraftTemplateInput {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    subject: input.subject,
    body: input.body,
    variables: Array.from(new Set(input.variables.map((variable) => variable.trim()).filter(Boolean))),
  };
}

function migrateLegacyPlaceholders(text: string) {
  return text
    .replaceAll('{{school}}', '{{prof_school}}')
    .replaceAll('[你的姓名]', '{{user_name}}')
    .replaceAll('[Your Name]', '{{user_name}}');
}

function normalizeTemplate(template: MailTemplate): MailTemplate {
  const normalizedSubject = migrateLegacyPlaceholders(String(template.subject ?? ''));
  const normalizedBody = migrateLegacyPlaceholders(String(template.body ?? ''));
  const variables = Array.from(
    new Set(
      [
        ...Array.from(normalizedSubject.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)).map((match) => match[1]),
        ...Array.from(normalizedBody.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)).map((match) => match[1]),
        ...(Array.isArray(template.variables) ? template.variables : []),
      ]
        .map((variable) => variable.trim())
        .filter(Boolean),
    ),
  );

  return {
    id: String(template.id),
    name: String(template.name ?? '').trim(),
    description: String(template.description ?? '').trim(),
    subject: normalizedSubject,
    body: normalizedBody,
    variables,
    createdAt: typeof template.createdAt === 'number' ? template.createdAt : Date.now(),
    updatedAt: typeof template.updatedAt === 'number' ? template.updatedAt : Date.now(),
  };
}

function readBrowserStore(): TemplateStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = getSeededStore();
    writeBrowserStore(seeded.templates);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TemplateStore>;
    if (!Array.isArray(parsed.templates)) {
      throw new Error('Invalid template store.');
    }

    const templates = sanitizeTemplates(parsed.templates as MailTemplate[]);
    if (parsed.version !== TEMPLATE_STORE_VERSION || JSON.stringify(parsed.templates) !== JSON.stringify(templates)) {
      writeBrowserStore(templates);
    }

    return {
      version: TEMPLATE_STORE_VERSION,
      templates,
    };
  } catch {
    const seeded = getSeededStore();
    writeBrowserStore(seeded.templates);
    return seeded;
  }
}

function writeBrowserStore(templates: MailTemplate[]) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: TEMPLATE_STORE_VERSION,
      templates,
    }),
  );
}

export async function listTemplates() {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.templates.list().then((templates) => sanitizeTemplates(templates));
  }

  return readBrowserStore().templates.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function saveTemplate(id: string, input: DraftTemplateInput) {
  const normalized = normalizeTemplateInput(input);
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.templates.save(id, normalized);
  }

  const current = readBrowserStore();
  const now = Date.now();
  const existing = current.templates.find((template) => template.id === id) ?? null;
  const record = normalizeTemplate({
    ...existing,
    id,
    ...normalized,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  const nextTemplates = existing
    ? current.templates.map((template) => (template.id === id ? record : template))
    : [record, ...current.templates];
  writeBrowserStore(nextTemplates);
  return record;
}

export async function deleteTemplate(id: string) {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    await desktopApi.templates.delete(id);
    return;
  }

  const current = readBrowserStore();
  writeBrowserStore(current.templates.filter((template) => template.id !== id));
}

export function getLocalizedTemplate(template: MailTemplate, _locale: Locale) {
  return template;
}

export function getTemplateVariableOptions(locale: Locale = resolveLocalePreference()) {
  return TEMPLATE_VARIABLES[locale];
}

export function buildTemplateVariables(
  context: TemplateRenderContext,
  locale: Locale = context.locale ?? resolveLocalePreference(),
) {
  const isZh = locale === 'zh';
  return {
    user_name: context.profile?.fullName?.trim() || (isZh ? '[自己的名字]' : '[Your Name]'),
    user_university: context.profile?.university?.trim() || (isZh ? '[自己的学校]' : '[Your University]'),
    prof_name: context.professor?.name || (isZh ? '[目标老师姓名]' : '[Professor Name]'),
    prof_school: context.professor?.school || (isZh ? '[老师学校]' : '[Professor School]'),
    prof_title: context.professor?.title || (isZh ? '老师' : 'Professor'),
    prof_email: context.professor?.email || (isZh ? '[老师邮箱]' : '[Professor Email]'),
    research_area: context.professor?.researchArea || (isZh ? '[研究方向]' : '[Research Area]'),
    user_school: context.profile?.university?.trim() || (isZh ? '[自己的学校]' : '[Your University]'),
    school: context.profile?.university?.trim() || (isZh ? '[自己的学校]' : '[Your University]'),
    title: context.professor?.title || (isZh ? '老师' : 'Professor'),
    email: context.professor?.email || (isZh ? '[老师邮箱]' : '[Professor Email]'),
  };
}

export function renderTemplateText(
  input: string,
  context: TemplateRenderContext,
  locale: Locale = context.locale ?? resolveLocalePreference(),
) {
  const variables = buildTemplateVariables(context, locale);

  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (fullMatch, variableName: string) => {
    const value = variables[variableName as keyof typeof variables];
    return value ?? fullMatch;
  });
}
