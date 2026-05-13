import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_VERSION = 7;
const DESKTOP_DATA_DIRNAME = 'Mentor Vault';
const LEGACY_DATA_DIRNAMES = ['Professor Tracker', 'Vibe Sender', 'vibe-sender'];
const UPDATE_MANIFEST_ENV_KEYS = ['PROFESSOR_TRACKER_UPDATE_URL', 'UPDATE_MANIFEST_URL'];
const DEFAULT_UPDATE_MANIFEST_URL =
  'https://gcore.jsdelivr.net/gh/Luofaiz/mentor-vault-releases@main/latest.json';
const DEFAULT_UPDATE_MANIFEST_FALLBACK_URLS = [
  'https://api.github.com/repos/Luofaiz/mentor-vault-releases/releases/latest',
  'https://raw.githubusercontent.com/Luofaiz/mentor-vault-releases/main/latest.json',
  'https://github.com/Luofaiz/mentor-vault-releases/releases/latest/download/latest.json',
];
const UPDATE_CHECK_TIMEOUT_MS = 30000;
const UPDATE_DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const UPDATE_INSTALLER_FILE_NAME = 'MentorVaultSetup.exe';
const UPDATE_DOWNLOAD_PROGRESS_CHANNEL = 'system:update-download-progress';

const DEFAULT_PROFESSORS = [];

const DEFAULT_TIMELINE_EVENTS = [];

const DEFAULT_TEMPLATES = [];
const REMOVED_PRESET_TEMPLATE_IDS = new Set(['template-first-outreach', 'template-follow-up']);

const SEND_GUARD = {
  recipientFailureWindowMs: 30 * 60 * 1000,
  globalFailureWindowMs: 15 * 60 * 1000,
  globalFailureThreshold: 3,
  globalCooldownMs: 30 * 60 * 1000,
};

const AI_DEFAULTS = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
};

function getPreferredDataDir() {
  return path.join(app.getPath('appData'), DESKTOP_DATA_DIRNAME);
}

function getLegacyDataDirs() {
  const preferred = getPreferredDataDir();
  return Array.from(
    new Set([
      app.getPath('userData'),
      ...LEGACY_DATA_DIRNAMES.map((directoryName) => path.join(app.getPath('appData'), directoryName)),
    ]),
  ).filter((candidate) => candidate !== preferred);
}

function compareVersions(left, right) {
  const leftParts = String(left ?? '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
  const rightParts = String(right ?? '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }

  return 0;
}

async function readRuntimePackageJson() {
  try {
    const text = await readFile(path.join(app.getAppPath(), 'package.json'), 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function appendUpdateManifestUrl(urls, value) {
  const url = String(value ?? '').trim();
  if (url && !urls.includes(url)) {
    urls.push(url);
  }
}

async function getUpdateManifestUrls() {
  const urls = [];

  for (const key of UPDATE_MANIFEST_ENV_KEYS) {
    appendUpdateManifestUrl(urls, process.env[key]);
  }

  const runtimePackage = await readRuntimePackageJson();
  appendUpdateManifestUrl(urls, runtimePackage?.updateManifestUrl);
  if (Array.isArray(runtimePackage?.updateManifestFallbackUrls)) {
    for (const url of runtimePackage.updateManifestFallbackUrls) {
      appendUpdateManifestUrl(urls, url);
    }
  }
  appendUpdateManifestUrl(urls, DEFAULT_UPDATE_MANIFEST_URL);
  for (const url of DEFAULT_UPDATE_MANIFEST_FALLBACK_URLS) {
    appendUpdateManifestUrl(urls, url);
  }

  return urls;
}

async function fetchUpdateManifest(manifestUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(manifestUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('检查更新超时，请稍后重试，或直接打开 GitHub Release 下载新版。');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBestUpdateManifest(manifestUrls, currentVersion) {
  let bestManifest = null;
  let lastError = null;

  for (const manifestUrl of manifestUrls) {
    try {
      const manifest = normalizeUpdateManifest(await fetchUpdateManifest(manifestUrl));
      if (!bestManifest || compareVersions(manifest.latestVersion, bestManifest.latestVersion) > 0) {
        bestManifest = manifest;
      }
      if (compareVersions(manifest.latestVersion, currentVersion) > 0) {
        return manifest;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (bestManifest) {
    return bestManifest;
  }

  throw new Error(
    `所有更新地址都无法访问。最后一个错误：${
      lastError instanceof Error ? lastError.message : String(lastError ?? '未知错误')
    }`,
  );
}

function normalizeUpdateManifest(manifest) {
  const latestVersion = String(manifest?.version ?? manifest?.tag_name ?? '')
    .trim()
    .replace(/^v(?=\d)/i, '');
  const releaseAssets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const releaseAsset =
    releaseAssets.find((asset) => asset?.name === UPDATE_INSTALLER_FILE_NAME) ??
    releaseAssets.find((asset) => String(asset?.name ?? '').toLowerCase().endsWith('.exe')) ??
    releaseAssets.find((asset) => asset?.name === 'MentorVaultPortable.zip') ??
    releaseAssets.find((asset) => String(asset?.name ?? '').toLowerCase().endsWith('.zip')) ??
    null;
  const downloadUrl = String(
    manifest?.downloadUrl ?? releaseAsset?.browser_download_url ?? '',
  ).trim();
  const notes = String(manifest?.notes ?? manifest?.body ?? '').trim();
  const releaseUrl = String(manifest?.releaseUrl ?? manifest?.html_url ?? '').trim();

  if (!latestVersion) {
    throw new Error('Update manifest is missing "version".');
  }

  if (downloadUrl) {
    const parsed = new URL(downloadUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Update download URL must use http or https.');
    }
  }

  return {
    latestVersion,
    downloadUrl,
    releaseUrl,
    notes,
  };
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();
  const manifestUrls = await getUpdateManifestUrls();

  if (manifestUrls.length === 0) {
    return {
      configured: false,
      currentVersion,
      updateAvailable: false,
    };
  }

  const manifest = await fetchBestUpdateManifest(manifestUrls, currentVersion);
  const updateAvailable = compareVersions(manifest.latestVersion, currentVersion) > 0;

  return {
    configured: true,
    currentVersion,
    latestVersion: manifest.latestVersion,
    updateAvailable,
    downloadUrl: manifest.downloadUrl,
    releaseUrl: manifest.releaseUrl,
    notes: manifest.notes,
  };
}

async function openExternalUrl(url) {
  const parsed = new URL(String(url ?? '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs can be opened.');
  }

  await shell.openExternal(parsed.toString());
}

function quoteWindowsCommandArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function sendUpdateDownloadProgress(webContents, progress) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  webContents.send(UPDATE_DOWNLOAD_PROGRESS_CHANNEL, progress);
}

function createUpdateDownloadProgressStream(totalBytes, notifyProgress) {
  let transferredBytes = 0;
  let lastSentAt = 0;
  const startedAt = Date.now();

  const emitProgress = (force = false) => {
    const now = Date.now();
    if (!force && now - lastSentAt < 200) {
      return;
    }

    const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.001);
    const bytesPerSecond = transferredBytes / elapsedSeconds;
    const remainingBytes = totalBytes ? Math.max(totalBytes - transferredBytes, 0) : undefined;

    lastSentAt = now;
    notifyProgress({
      transferredBytes,
      totalBytes,
      bytesPerSecond,
      remainingSeconds: remainingBytes === undefined || bytesPerSecond <= 0 ? undefined : remainingBytes / bytesPerSecond,
      percent: totalBytes ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : undefined,
    });
  };

  notifyProgress({
    transferredBytes: 0,
    totalBytes,
    bytesPerSecond: 0,
    remainingSeconds: undefined,
    percent: totalBytes ? 0 : undefined,
  });

  return new Transform({
    transform(chunk, _encoding, callback) {
      transferredBytes += chunk.length;
      emitProgress(transferredBytes === totalBytes);
      callback(null, chunk);
    },
    flush(callback) {
      emitProgress(true);
      callback();
    },
  });
}

async function downloadUpdateInstaller(downloadUrl, webContents) {
  const parsed = new URL(String(downloadUrl ?? '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('更新安装包地址必须使用 http 或 https。');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_DOWNLOAD_TIMEOUT_MS);
  const installerPath = path.join(app.getPath('temp'), `MentorVaultSetup-${Date.now()}.exe`);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/octet-stream,application/x-msdownload,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
    const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : undefined;
    const notifyProgress = (progress) => sendUpdateDownloadProgress(webContents, progress);

    if (response.body) {
      await pipeline(
        Readable.fromWeb(response.body),
        createUpdateDownloadProgressStream(totalBytes, notifyProgress),
        createWriteStream(installerPath),
      );
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      notifyProgress({
        transferredBytes: 0,
        totalBytes: buffer.length,
        bytesPerSecond: 0,
        remainingSeconds: undefined,
        percent: 0,
      });
      await writeFile(installerPath, buffer);
      notifyProgress({
        transferredBytes: buffer.length,
        totalBytes: buffer.length,
        bytesPerSecond: 0,
        remainingSeconds: 0,
        percent: 100,
      });
    }

    return installerPath;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('下载安装包超时，请稍后重试，或直接打开 GitHub Release 下载新版安装包。');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function installUpdate(downloadUrl, webContents) {
  if (process.platform !== 'win32') {
    throw new Error('当前自动安装更新只支持 Windows。');
  }

  const installerPath = await downloadUpdateInstaller(downloadUrl, webContents);
  const command = `timeout /t 2 /nobreak > nul & start "" ${quoteWindowsCommandArg(installerPath)}`;
  const child = spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  app.quit();
  return { ok: true };
}

async function readExistingDataFile(fileName) {
  const candidatePaths = [
    path.join(getPreferredDataDir(), fileName),
    ...getLegacyDataDirs().map((dir) => path.join(dir, fileName)),
  ];
  const existingFiles = [];

  for (const candidatePath of candidatePaths) {
    try {
      const [text, metadata] = await Promise.all([readFile(candidatePath, 'utf8'), stat(candidatePath)]);
      existingFiles.push({
        path: candidatePath,
        text,
        mtimeMs: metadata.mtimeMs,
      });
    } catch {
    }
  }

  if (existingFiles.length === 0) {
    return null;
  }

  existingFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return existingFiles[0];
}

async function writePreferredDataFile(fileName, text) {
  const preferredDir = getPreferredDataDir();
  await mkdir(preferredDir, { recursive: true });
  const filePath = path.join(preferredDir, fileName);
  await writeFile(filePath, text, 'utf8');
  return filePath;
}

function normalizeDateValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }

  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeProfessorStatus(value) {
  const status = String(value ?? '').trim();
  if (!status) {
    return 'Pending';
  }

  if (status === '不读' || status === '未读？') {
    return '未读';
  }

  return status;
}

function normalizeProfessorRecord(record) {
  const status = normalizeProfessorStatus(record?.status);
  const lastContactDate = normalizeDateValue(record?.lastContactDate);
  const firstContactDate =
    normalizeDateValue(record?.firstContactDate) ||
    (lastContactDate && status !== 'Pending' && status !== 'Drafting' ? lastContactDate : '');

  const legacyParts = [
    record?.country ? `原国家/地区：${String(record.country).trim()}` : '',
    record?.applicationSeason ? `原申请季：${String(record.applicationSeason).trim()}` : '',
    record?.followUpDate ? `原计划跟进日期：${normalizeDateValue(record.followUpDate)}` : '',
  ].filter(Boolean);
  const legacyNote = legacyParts.length > 0 ? `[迁移保留] ${legacyParts.join('；')}` : '';
  const currentNotes = String(record?.notes ?? '').trim();
  const notes = legacyNote && currentNotes.includes(legacyNote)
    ? currentNotes
    : [currentNotes, legacyNote].filter(Boolean).join('\n');

  return {
    id: String(record?.id ?? crypto.randomUUID()),
    name: String(record?.name ?? '').trim(),
    title: String(record?.title ?? '').trim(),
    school: String(record?.school ?? '').trim(),
    college: String(record?.college ?? record?.department ?? '').trim(),
    email: String(record?.email ?? '').trim(),
    homepage: String(record?.homepage ?? record?.website ?? '').trim(),
    researchArea: String(record?.researchArea ?? '').trim(),
    status,
    tags: Array.isArray(record?.tags) ? record.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    firstContactDate,
    lastContactDate,
    notes,
    createdAt: typeof record?.createdAt === 'number' ? record.createdAt : Date.now(),
    updatedAt: typeof record?.updatedAt === 'number' ? record.updatedAt : Date.now(),
    deletedAt: typeof record?.deletedAt === 'number' ? record.deletedAt : undefined,
  };
}

function normalizeTimelineEventRecord(event) {
  return {
    id: String(event?.id ?? crypto.randomUUID()),
    professorId: String(event?.professorId ?? ''),
    type: String(event?.type ?? 'Note'),
    title: String(event?.title ?? '').trim(),
    description: String(event?.description ?? '').trim(),
    eventDate: normalizeDateValue(event?.eventDate),
    createdAt: typeof event?.createdAt === 'number' ? event.createdAt : Date.now(),
  };
}

function migrateTemplatePlaceholders(text) {
  return String(text ?? '')
    .replaceAll('{{school}}', '{{prof_school}}')
    .replaceAll('[你的姓名]', '{{user_name}}')
    .replaceAll('[Your Name]', '{{user_name}}');
}

function normalizeTemplateRecord(template) {
  const subject = migrateTemplatePlaceholders(template?.subject);
  const body = migrateTemplatePlaceholders(template?.body);
  const variables = Array.from(
    new Set(
      [
        ...Array.from(subject.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)).map((match) => match[1]),
        ...Array.from(body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)).map((match) => match[1]),
        ...(Array.isArray(template?.variables) ? template.variables : []),
      ]
        .map((variable) => String(variable).trim())
        .filter(Boolean),
    ),
  );

  return {
    id: String(template?.id ?? crypto.randomUUID()),
    name: String(template?.name ?? '').trim(),
    description: String(template?.description ?? '').trim(),
    subject,
    body,
    variables,
    createdAt: typeof template?.createdAt === 'number' ? template.createdAt : Date.now(),
    updatedAt: typeof template?.updatedAt === 'number' ? template.updatedAt : Date.now(),
  };
}

function sanitizeTemplateRecords(templates) {
  return templates
    .map((template) => normalizeTemplateRecord(template))
    .filter((template) => !REMOVED_PRESET_TEMPLATE_IDS.has(template.id));
}

function normalizeProfileRecord(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const now = Date.now();
  return {
    fullName: String(profile.fullName ?? '').trim(),
    university: String(profile.university ?? '').trim(),
    createdAt: typeof profile.createdAt === 'number' ? profile.createdAt : now,
    updatedAt: typeof profile.updatedAt === 'number' ? profile.updatedAt : now,
  };
}

function normalizeDraftRecord(draft) {
  const now = Date.now();
  return {
    id: String(draft?.id ?? crypto.randomUUID()),
    title: String(draft?.title ?? '').trim(),
    professorId: draft?.professorId == null ? null : String(draft.professorId),
    templateId: draft?.templateId == null ? null : String(draft.templateId),
    subject: String(draft?.subject ?? '').trim(),
    body: String(draft?.body ?? ''),
    status: draft?.status === 'ready' ? 'ready' : 'draft',
    createdAt: typeof draft?.createdAt === 'number' ? draft.createdAt : now,
    updatedAt: typeof draft?.updatedAt === 'number' ? draft.updatedAt : now,
  };
}

function normalizeMailAccountRecord(account) {
  if (!account || typeof account !== 'object') {
    return null;
  }

  const encryptedSecret =
    account.encryptedSecret &&
    typeof account.encryptedSecret.iv === 'string' &&
    typeof account.encryptedSecret.tag === 'string' &&
    typeof account.encryptedSecret.content === 'string'
      ? {
          iv: account.encryptedSecret.iv,
          tag: account.encryptedSecret.tag,
          content: account.encryptedSecret.content,
        }
      : null;

  if (!encryptedSecret) {
    return null;
  }

  const now = Date.now();
  return {
    id: String(account.id ?? crypto.randomUUID()),
    provider: '163',
    email: String(account.email ?? '').trim(),
    displayName: String(account.displayName ?? '').trim(),
    smtpHost: String(account.smtpHost ?? '').trim(),
    smtpPort: Number(account.smtpPort ?? 465),
    secure: Boolean(account.secure),
    isDefault: Boolean(account.isDefault),
    authCodeHint: String(account.authCodeHint ?? '').trim(),
    encryptedSecret,
    createdAt: typeof account.createdAt === 'number' ? account.createdAt : now,
    updatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : now,
  };
}

function normalizeSendLogRecord(log) {
  const now = Date.now();
  return {
    id: String(log?.id ?? crypto.randomUUID()),
    accountId: String(log?.accountId ?? ''),
    to: String(log?.to ?? '').trim(),
    subject: String(log?.subject ?? '').trim(),
    status: log?.status === 'success' ? 'success' : 'failed',
    errorMessage: log?.errorMessage ? String(log.errorMessage) : undefined,
    guardBlocked: Boolean(log?.guardBlocked),
    createdAt: typeof log?.createdAt === 'number' ? log.createdAt : now,
  };
}

function normalizeAiConfigRecord(config) {
  if (!config || typeof config !== 'object') {
    return null;
  }

  const encryptedSecret =
    config.encryptedSecret &&
    typeof config.encryptedSecret.iv === 'string' &&
    typeof config.encryptedSecret.tag === 'string' &&
    typeof config.encryptedSecret.content === 'string'
      ? {
          iv: config.encryptedSecret.iv,
          tag: config.encryptedSecret.tag,
          content: config.encryptedSecret.content,
        }
      : null;

  const provider = config.provider === 'openai' ? 'openai' : 'gemini';
  const defaults = getAiDefaults(provider);
  const now = Date.now();

  return {
    id: String(config.id ?? crypto.randomUUID()),
    name: String(config.name ?? '').trim() || '配置 1',
    provider,
    baseUrl: normalizeBaseUrl(config.baseUrl, defaults.baseUrl),
    model: String(config.model ?? '').trim() || defaults.model,
    apiKeyHint: String(config.apiKeyHint ?? '').trim(),
    encryptedSecret,
    createdAt: typeof config.createdAt === 'number' ? config.createdAt : now,
    updatedAt: typeof config.updatedAt === 'number' ? config.updatedAt : now,
  };
}

function normalizeStore(rawStore) {
  const store = rawStore && typeof rawStore === 'object' ? rawStore : {};
  const aiConfigs =
    Array.isArray(store.aiConfigs) && store.aiConfigs.length > 0
      ? store.aiConfigs.map((config) => normalizeAiConfigRecord(config)).filter(Boolean)
      : store.aiSettings && typeof store.aiSettings === 'object'
        ? [
            normalizeAiConfigRecord({
              id: crypto.randomUUID(),
              name: '配置 1',
              provider: store.aiSettings.provider,
              baseUrl: store.aiSettings.baseUrl,
              model: store.aiSettings.model,
              apiKeyHint: store.aiSettings.apiKeyHint,
              encryptedSecret: store.aiSettings.encryptedSecret,
              createdAt: store.aiSettings.createdAt,
              updatedAt: store.aiSettings.updatedAt,
            }),
          ].filter(Boolean)
        : [];
  const activeAiConfigId =
    typeof store.activeAiConfigId === 'string' && aiConfigs.some((config) => config.id === store.activeAiConfigId)
      ? store.activeAiConfigId
      : aiConfigs[0]?.id ?? null;

  return {
    version: STORE_VERSION,
    professors: Array.isArray(store.professors)
      ? store.professors.map((record) => normalizeProfessorRecord(record))
      : DEFAULT_PROFESSORS,
    timelineEvents: Array.isArray(store.timelineEvents)
      ? store.timelineEvents.map((event) => normalizeTimelineEventRecord(event))
      : DEFAULT_TIMELINE_EVENTS,
    templates: Array.isArray(store.templates) ? sanitizeTemplateRecords(store.templates) : DEFAULT_TEMPLATES,
    drafts: Array.isArray(store.drafts) ? store.drafts.map((draft) => normalizeDraftRecord(draft)) : [],
    mailAccounts: Array.isArray(store.mailAccounts)
      ? store.mailAccounts.map((account) => normalizeMailAccountRecord(account)).filter(Boolean)
      : [],
    sendLogs: Array.isArray(store.sendLogs) ? store.sendLogs.map((log) => normalizeSendLogRecord(log)) : [],
    aiConfigs,
    activeAiConfigId,
    profile: normalizeProfileRecord(store.profile),
  };
}

function summarizeAiConfig(config, activeConfigId) {
  return {
    id: config.id,
    name: config.name,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKeyHint: config.apiKeyHint,
    hasApiKey: Boolean(config.encryptedSecret),
    isActive: config.id === activeConfigId,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function summarizeAiState(store) {
  const activeConfigId = store.activeAiConfigId ?? null;
  return {
    configs: (store.aiConfigs ?? []).map((config) => summarizeAiConfig(config, activeConfigId)),
    activeConfigId,
  };
}

function getActiveAiConfig(store) {
  if (!Array.isArray(store.aiConfigs) || store.aiConfigs.length === 0) {
    return null;
  }

  return (
    store.aiConfigs.find((config) => config.id === store.activeAiConfigId) ??
    store.aiConfigs[0] ??
    null
  );
}

function createMaskedHint(secret) {
  if (!secret) {
    return '';
  }

  if (secret.length <= 4) {
    return '*'.repeat(secret.length);
  }

  return `${'*'.repeat(Math.max(0, secret.length - 4))}${secret.slice(-4)}`;
}

function getAiDefaults(provider) {
  return AI_DEFAULTS[provider === 'openai' ? 'openai' : 'gemini'];
}

function normalizeBaseUrl(value, fallback) {
  const raw = String(value ?? '').trim();
  const finalValue = raw || fallback;
  return finalValue.replace(/\/+$/, '');
}

function createAiError(key, locale = 'zh') {
  const messages = {
    zh: {
      aiNotConfigured: '还没有配置 AI，请先到设置页保存 API 信息。',
      aiApiKeyMissing: 'AI API Key 未配置，请先到设置页保存。',
      aiEmptyResponse: 'AI 没有返回有效内容，请稍后再试。',
      aiProviderInvalid: '当前 AI 服务商配置无效。',
    },
    en: {
      aiNotConfigured: 'AI is not configured yet. Save your API settings first.',
      aiApiKeyMissing: 'AI API key is missing. Save it in Settings first.',
      aiEmptyResponse: 'The AI service returned no usable content. Please try again.',
      aiProviderInvalid: 'The configured AI provider is invalid.',
    },
  };

  return new Error(messages[locale === 'en' ? 'en' : 'zh'][key]);
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function extractHttpError(response) {
  const raw = await response.text();
  const parsed = parseJsonSafely(raw);
  const message =
    parsed?.error?.message ||
    parsed?.message ||
    raw ||
    `${response.status} ${response.statusText}`;
  return new Error(message);
}

function extractOpenAiContent(message) {
  if (!message) {
    return '';
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part?.type === 'text') {
          return part.text ?? '';
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

async function generateWithGemini(settings, apiKey, prompt, locale) {
  const endpoint = `${normalizeBaseUrl(settings.baseUrl, getAiDefaults('gemini').baseUrl)}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    throw await extractHttpError(response);
  }

  const data = await response.json();
  const content = (data?.candidates ?? [])
    .flatMap((candidate) => candidate?.content?.parts ?? [])
    .map((part) => part?.text ?? '')
    .join('\n')
    .trim();

  if (!content) {
    throw createAiError('aiEmptyResponse', locale);
  }

  return content;
}

async function generateWithOpenAi(settings, apiKey, prompt, locale) {
  const endpoint = `${normalizeBaseUrl(settings.baseUrl, getAiDefaults('openai').baseUrl)}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw await extractHttpError(response);
  }

  const data = await response.json();
  const content = extractOpenAiContent(data?.choices?.[0]?.message);
  if (!content) {
    throw createAiError('aiEmptyResponse', locale);
  }

  return content.trim();
}

async function runAiPrompt(store, prompt, locale = 'zh') {
  return runAiPromptWithSettings(getActiveAiConfig(store), prompt, locale);
}

async function runAiPromptWithSettings(settings, prompt, locale = 'zh') {
  if (!settings) {
    throw createAiError('aiNotConfigured', locale);
  }

  if (!settings.encryptedSecret) {
    throw createAiError('aiApiKeyMissing', locale);
  }

  const apiKey =
    settings.encryptedSecret.__plain ??
    (await decryptSecret(settings.encryptedSecret));
  if (!apiKey) {
    throw createAiError('aiApiKeyMissing', locale);
  }

  if (settings.provider === 'gemini') {
    return generateWithGemini(settings, apiKey, prompt, locale);
  }

  if (settings.provider === 'openai') {
    return generateWithOpenAi(settings, apiKey, prompt, locale);
  }

  throw createAiError('aiProviderInvalid', locale);
}

function buildTemporaryAiSettings(existing, input) {
  const provider = input?.provider === 'openai' ? 'openai' : 'gemini';
  const defaults = getAiDefaults(provider);
  const apiKey = String(input?.apiKey ?? '').trim();

  return {
    id: existing?.id ?? crypto.randomUUID(),
    name: String(input?.name ?? '').trim() || existing?.name || '配置 1',
    provider,
    baseUrl: normalizeBaseUrl(input?.baseUrl, defaults.baseUrl),
    model: String(input?.model ?? '').trim() || defaults.model,
    apiKeyHint: apiKey ? createMaskedHint(apiKey) : existing?.apiKeyHint ?? '',
    encryptedSecret: apiKey ? { __plain: apiKey } : existing?.encryptedSecret,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

function buildIteratePrompt(input) {
  if (input.locale === 'en') {
    return `
      You are a writing partner.
      The user is working on this text:
      ---
      ${input.fullContext}
      ---

      They selected this part:
      "${input.selection}"

      They want changes based on:
      "${input.feedback}"

      Rewrite ONLY the selected part so it fits naturally with the rest of the text.
      Keep the rewritten output in the same language as the selected text unless the feedback explicitly asks otherwise.
      Return ONLY the rewritten selection.
    `;
  }

  return `
    你是一名写作协作者。
    用户当前全文如下：
    ---
    ${input.fullContext}
    ---

    用户选中了这段内容：
    "${input.selection}"

    用户希望按下面的要求修改：
    "${input.feedback}"

    只改写被选中的这一段，让它自然融入全文。
    除非用户明确要求切换语言，否则保持与原选中文本一致的语言。
    只返回改写后的文本，不要补充说明。
  `;
}

function buildFeedbackPrompt(input) {
  if (input.locale === 'en') {
    return `
      You are a proactive writing coach.
      Review the following text and provide 1-2 brief, high-impact suggestions for improvement.
      Focus on clarity, tone, or specific word choices.
      Be direct and useful.

      Text:
      ${input.text}

      Return the suggestions in a concise bulleted list.
    `;
  }

  return `
    你是一名主动给建议的写作教练。
    请阅读下面这段文字，给出 1 到 2 条高价值的简短建议。
    重点关注清晰度、语气和措辞是否更贴合联系老师的场景。
    直接指出问题，并给出可执行建议。

    文本：
    ${input.text}

    请用简洁项目符号返回建议。
  `;
}

function getActionableFailures(logs, now) {
  return logs.filter(
    (log) =>
      log.status === 'failed' &&
      !log.guardBlocked &&
      typeof log.createdAt === 'number' &&
      now - log.createdAt <= SEND_GUARD.globalFailureWindowMs,
  );
}

function ensureSendAllowed(store, payload) {
  const now = Date.now();
  const realFailures = store.sendLogs.filter((log) => log.status === 'failed' && !log.guardBlocked);
  const recentRecipientFailure = realFailures.find(
    (log) => log.to === payload.to && now - log.createdAt <= SEND_GUARD.recipientFailureWindowMs,
  );

  if (recentRecipientFailure) {
    throw new Error(
      `Sending to ${payload.to} is temporarily blocked because a recent attempt failed. Review the account or recipient information before retrying.`,
    );
  }

  const recentGlobalFailures = getActionableFailures(store.sendLogs, now);
  if (recentGlobalFailures.length >= SEND_GUARD.globalFailureThreshold) {
    const latestFailureAt = Math.max(...recentGlobalFailures.map((log) => log.createdAt));
    if (now - latestFailureAt <= SEND_GUARD.globalCooldownMs) {
      throw new Error(
        'Sending is temporarily paused because several recent email attempts failed. Wait before retrying to avoid repeated bad sends.',
      );
    }
  }
}

async function getSecretKeyPath() {
  const preferredDir = getPreferredDataDir();
  await mkdir(preferredDir, { recursive: true });
  return path.join(preferredDir, 'mail-secret.key');
}

async function getSecretKey() {
  const secretPath = await getSecretKeyPath();

  try {
    const existing = await readFile(secretPath, 'utf8');
    return Buffer.from(existing, 'base64');
  } catch {
    const legacyKey = await readExistingDataFile('mail-secret.key');
    if (legacyKey) {
      await writePreferredDataFile('mail-secret.key', legacyKey.text);
      return Buffer.from(legacyKey.text, 'base64');
    }

    const key = crypto.randomBytes(32);
    await writeFile(secretPath, key.toString('base64'), 'utf8');
    return key;
  }
}

async function encryptSecret(secret) {
  const key = await getSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    content: encrypted.toString('base64'),
  };
}

async function decryptSecret(payload) {
  const key = await getSecretKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.content, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'Mentor Vault',
    width: 1560,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#fcfbf8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    window.loadURL(devServerUrl);
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function getStorePath() {
  return path.join(getPreferredDataDir(), 'vibe-data.json');
}

async function ensureStore() {
  const existing = await readExistingDataFile('vibe-data.json');
  if (!existing) {
    return normalizeStore(null);
  }

  return normalizeStore(parseJsonSafely(existing.text));
}

async function saveStore(store) {
  await writePreferredDataFile('vibe-data.json', JSON.stringify(normalizeStore(store), null, 2));
}

function filterProfessors(professors, filters = {}) {
  const query = String(filters.query ?? '').trim().toLowerCase();

  return professors
    .filter((professor) => (filters.includeDeleted ? true : !professor.deletedAt))
    .filter((professor) => {
      if (!query) {
        return true;
      }

      return [
        professor.name,
        professor.title,
        professor.school,
        professor.college,
        professor.email,
        professor.homepage,
        professor.researchArea,
        professor.status,
        professor.firstContactDate,
        professor.lastContactDate,
        professor.notes,
        professor.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function normalizeDraft(draft) {
  return {
    name: draft.name.trim(),
    title: draft.title.trim(),
    school: draft.school.trim(),
    college: String(draft.college ?? '').trim(),
    email: draft.email.trim(),
    homepage: String(draft.homepage ?? '').trim(),
    researchArea: draft.researchArea.trim(),
    status: normalizeProfessorStatus(draft.status),
    firstContactDate: normalizeDateValue(draft.firstContactDate),
    lastContactDate: normalizeDateValue(draft.lastContactDate),
    notes: draft.notes.trim(),
    tags: Array.isArray(draft.tags) ? draft.tags.map((tag) => tag.trim()).filter(Boolean) : [],
  };
}

ipcMain.handle('system:get-runtime-info', async () => ({
  platform: process.platform,
  storageMode: 'desktop-json',
  version: app.getVersion(),
}));

ipcMain.handle('system:check-for-updates', async () => checkForUpdates());

ipcMain.handle('system:open-external-url', async (_event, url) => {
  await openExternalUrl(url);
});

ipcMain.handle('system:install-update', async (event, downloadUrl) => installUpdate(downloadUrl, event.sender));

ipcMain.handle('professors:list', async (_event, filters) => {
  const store = await ensureStore();
  return filterProfessors(store.professors, filters);
});

ipcMain.handle('profile:get', async () => {
  const store = await ensureStore();
  return store.profile ?? null;
});

ipcMain.handle('profile:save', async (_event, input) => {
  const store = await ensureStore();
  const now = Date.now();
  const current = store.profile;
  store.profile = {
    fullName: String(input?.fullName ?? '').trim(),
    university: String(input?.university ?? '').trim(),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await saveStore(store);
  return store.profile;
});

ipcMain.handle('professors:create', async (_event, draft) => {
  const store = await ensureStore();
  const now = Date.now();
  const record = {
    id: crypto.randomUUID(),
    ...normalizeDraft(draft),
    createdAt: now,
    updatedAt: now,
  };
  store.professors.unshift(record);
  await saveStore(store);
  return record;
});

ipcMain.handle('professors:update', async (_event, id, draft) => {
  const store = await ensureStore();
  const now = Date.now();
  const normalized = normalizeDraft(draft);
  store.professors = store.professors.map((professor) =>
    professor.id === id ? { ...professor, ...normalized, updatedAt: now } : professor,
  );
  await saveStore(store);
  return store.professors.find((professor) => professor.id === id) ?? null;
});

ipcMain.handle('professors:trash', async (_event, id) => {
  const store = await ensureStore();
  const now = Date.now();
  store.professors = store.professors.map((professor) =>
    professor.id === id ? { ...professor, deletedAt: now, updatedAt: now } : professor,
  );
  await saveStore(store);
  return store.professors.find((professor) => professor.id === id) ?? null;
});

ipcMain.handle('professors:restore', async (_event, id) => {
  const store = await ensureStore();
  const now = Date.now();
  store.professors = store.professors.map((professor) =>
    professor.id === id ? { ...professor, deletedAt: undefined, updatedAt: now } : professor,
  );
  await saveStore(store);
  return store.professors.find((professor) => professor.id === id) ?? null;
});

ipcMain.handle('professors:purge', async (_event, id) => {
  const store = await ensureStore();
  store.professors = store.professors.filter((professor) => professor.id !== id);
  store.timelineEvents = store.timelineEvents.filter((event) => event.professorId !== id);
  await saveStore(store);
});

ipcMain.handle('timeline:list', async (_event, professorId) => {
  const store = await ensureStore();
  return store.timelineEvents
    .filter((event) => event.professorId === professorId)
    .sort((left, right) => {
      const dateCompare = right.eventDate.localeCompare(left.eventDate);
      return dateCompare !== 0 ? dateCompare : right.createdAt - left.createdAt;
    });
});

ipcMain.handle('timeline:create', async (_event, draft) => {
  const store = await ensureStore();
  const record = {
    id: crypto.randomUUID(),
    ...draft,
    createdAt: Date.now(),
  };
  store.timelineEvents.unshift(record);
  await saveStore(store);
  return record;
});

ipcMain.handle('templates:list', async () => {
  const store = await ensureStore();
  return store.templates.sort((left, right) => right.updatedAt - left.updatedAt);
});

ipcMain.handle('templates:save', async (_event, id, input) => {
  const store = await ensureStore();
  const now = Date.now();
  const existing = store.templates.find((template) => template.id === id) ?? null;
  const normalized = normalizeTemplateRecord({
    ...existing,
    id,
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  store.templates = existing
    ? store.templates.map((template) =>
        template.id === id
          ? {
              ...normalized,
              updatedAt: now,
            }
          : template,
      )
    : [normalized, ...store.templates];
  await saveStore(store);
  return store.templates.find((template) => template.id === id) ?? null;
});

ipcMain.handle('templates:delete', async (_event, id) => {
  const store = await ensureStore();
  store.templates = store.templates.filter((template) => template.id !== id);
  await saveStore(store);
});

ipcMain.handle('drafts:list', async () => {
  const store = await ensureStore();
  return store.drafts.sort((left, right) => right.updatedAt - left.updatedAt);
});

ipcMain.handle('drafts:save', async (_event, id, input) => {
  const store = await ensureStore();
  const now = Date.now();

  if (id) {
    store.drafts = store.drafts.map((draft) =>
      draft.id === id
        ? {
            ...draft,
            ...input,
            updatedAt: now,
          }
        : draft,
    );
    await saveStore(store);
    return store.drafts.find((draft) => draft.id === id) ?? null;
  }

  const record = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  store.drafts.unshift(record);
  await saveStore(store);
  return record;
});

ipcMain.handle('mail-accounts:list', async () => {
  const store = await ensureStore();
  return store.mailAccounts
    .map((account) => ({
      id: account.id,
      provider: '163',
      email: account.email,
      displayName: account.displayName,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      secure: account.secure,
      isDefault: account.isDefault,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      authCodeHint: account.authCodeHint,
    }))
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || right.updatedAt - left.updatedAt);
});

ipcMain.handle('mail-accounts:save', async (_event, id, input) => {
  const store = await ensureStore();
  const now = Date.now();
  const encryptedSecret = await encryptSecret(input.authorizationCode);

  if (input.isDefault) {
    store.mailAccounts = store.mailAccounts.map((account) => ({ ...account, isDefault: false }));
  }

  if (id) {
    store.mailAccounts = store.mailAccounts.map((account) =>
      account.id === id
        ? {
            ...account,
            email: input.email.trim(),
            displayName: input.displayName.trim(),
            smtpHost: input.smtpHost.trim(),
            smtpPort: Number(input.smtpPort),
            secure: Boolean(input.secure),
            isDefault: Boolean(input.isDefault),
            authCodeHint: createMaskedHint(input.authorizationCode),
            encryptedSecret,
            updatedAt: now,
          }
        : account,
    );
    await saveStore(store);
    return store.mailAccounts
      .map((account) => ({
        id: account.id,
        provider: '163',
        email: account.email,
        displayName: account.displayName,
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
        secure: account.secure,
        isDefault: account.isDefault,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        authCodeHint: account.authCodeHint,
      }))
      .find((account) => account.id === id);
  }

  const record = {
    id: crypto.randomUUID(),
    provider: '163',
    email: input.email.trim(),
    displayName: input.displayName.trim(),
    smtpHost: input.smtpHost.trim(),
    smtpPort: Number(input.smtpPort),
    secure: Boolean(input.secure),
    isDefault: Boolean(input.isDefault),
    authCodeHint: createMaskedHint(input.authorizationCode),
    encryptedSecret,
    createdAt: now,
    updatedAt: now,
  };
  store.mailAccounts.unshift(record);
  await saveStore(store);
  return {
    id: record.id,
    provider: '163',
    email: record.email,
    displayName: record.displayName,
    smtpHost: record.smtpHost,
    smtpPort: record.smtpPort,
    secure: record.secure,
    isDefault: record.isDefault,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    authCodeHint: record.authCodeHint,
  };
});

ipcMain.handle('ai:get-settings', async () => {
  const store = await ensureStore();
  return summarizeAiState(store);
});

ipcMain.handle('ai:save-settings', async (_event, input) => {
  const store = await ensureStore();
  const existing = input?.id
    ? store.aiConfigs.find((config) => config.id === input.id) ?? null
    : null;
  const provider = input?.provider === 'openai' ? 'openai' : 'gemini';
  const defaults = getAiDefaults(provider);
  const apiKey = String(input?.apiKey ?? '').trim();
  const now = Date.now();
  const name = String(input?.name ?? '').trim() || `配置 ${(store.aiConfigs?.length ?? 0) + 1}`;

  if (!apiKey && !existing?.encryptedSecret) {
    throw new Error('API key is required.');
  }

  const encryptedSecret = apiKey ? await encryptSecret(apiKey) : existing.encryptedSecret;
  const apiKeyHint = apiKey ? createMaskedHint(apiKey) : existing.apiKeyHint;
  const nextConfig = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    provider,
    baseUrl: normalizeBaseUrl(input?.baseUrl, defaults.baseUrl),
    model: String(input?.model ?? '').trim() || defaults.model,
    apiKeyHint,
    encryptedSecret,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (!Array.isArray(store.aiConfigs)) {
    store.aiConfigs = [];
  }

  if (existing) {
    store.aiConfigs = store.aiConfigs.map((config) => (config.id === existing.id ? nextConfig : config));
  } else {
    store.aiConfigs.unshift(nextConfig);
  }
  store.activeAiConfigId = nextConfig.id;
  await saveStore(store);

  return summarizeAiState(store);
});

ipcMain.handle('ai:set-active-config', async (_event, id) => {
  const store = await ensureStore();
  const exists = store.aiConfigs.find((config) => config.id === id);
  if (!exists) {
    throw new Error('AI config not found.');
  }

  store.activeAiConfigId = id;
  await saveStore(store);
  return summarizeAiState(store);
});

ipcMain.handle('ai:delete-config', async (_event, id) => {
  const store = await ensureStore();
  const existingCount = Array.isArray(store.aiConfigs) ? store.aiConfigs.length : 0;
  const nextConfigs = (store.aiConfigs ?? []).filter((config) => config.id !== id);

  if (nextConfigs.length === existingCount) {
    throw new Error('AI config not found.');
  }

  store.aiConfigs = nextConfigs;
  if (store.activeAiConfigId === id) {
    store.activeAiConfigId = nextConfigs[0]?.id ?? null;
  } else if (!nextConfigs.some((config) => config.id === store.activeAiConfigId)) {
    store.activeAiConfigId = nextConfigs[0]?.id ?? null;
  }

  await saveStore(store);
  return summarizeAiState(store);
});

ipcMain.handle('ai:test-settings', async (_event, input) => {
  const store = await ensureStore();
  const existing = input?.id ? store.aiConfigs.find((config) => config.id === input.id) ?? null : getActiveAiConfig(store);
  const temporarySettings = buildTemporaryAiSettings(existing, input);
  if (!temporarySettings.encryptedSecret) {
    throw new Error('API key is required.');
  }

  const locale = input?.locale === 'en' ? 'en' : 'zh';
  const prompt =
    locale === 'en'
      ? 'Reply with exactly one short sentence confirming the API connection works.'
      : '请只返回一句很短的话，确认 API 连接工作正常。';

  const preview = await runAiPromptWithSettings(temporarySettings, prompt, locale);
  return {
    ok: true,
    provider: temporarySettings.provider,
    model: temporarySettings.model,
    preview: preview.slice(0, 160),
  };
});

ipcMain.handle('ai:generate-draft', async (_event, input) => {
  const store = await ensureStore();
  return runAiPrompt(store, String(input?.prompt ?? ''), input?.locale ?? 'zh');
});

ipcMain.handle('ai:iterate-selection', async (_event, input) => {
  const store = await ensureStore();
  return runAiPrompt(store, buildIteratePrompt(input), input?.locale ?? 'zh');
});

ipcMain.handle('ai:get-feedback', async (_event, input) => {
  const store = await ensureStore();
  return runAiPrompt(store, buildFeedbackPrompt(input), input?.locale ?? 'zh');
});

ipcMain.handle('ai:chat', async (_event, input) => {
  const store = await ensureStore();
  const locale = input?.locale ?? 'zh';
  const transcript = Array.isArray(input?.messages)
    ? input.messages
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n\n')
    : '';

  const prompt =
    locale === 'en'
      ? `You are an outreach writing assistant. Continue the conversation naturally, stay concise, and help the user improve outreach emails.\n\nConversation:\n${transcript}\n\nReply as the assistant only.`
      : `你是一名保研/套磁邮件写作助手。请自然继续下面的对话，回答简洁、可执行，并帮助用户优化联系老师的邮件。\n\n对话记录：\n${transcript}\n\n只回复助手这一轮的内容。`;

  return runAiPrompt(store, prompt, locale);
});

ipcMain.handle('mail:logs', async () => {
  const store = await ensureStore();
  return store.sendLogs.sort((left, right) => right.createdAt - left.createdAt);
});

ipcMain.handle('mail:send', async (_event, payload) => {
  const store = await ensureStore();
  const account = store.mailAccounts.find((record) => record.id === payload.accountId);
  if (!account) {
    throw new Error('Mail account not found.');
  }

  try {
    ensureSendAllowed(store, payload);
  } catch (guardError) {
    store.sendLogs.unshift({
      id: crypto.randomUUID(),
      accountId: account.id,
      to: payload.to,
      subject: payload.subject,
      status: 'failed',
      errorMessage: guardError instanceof Error ? guardError.message : String(guardError),
      guardBlocked: true,
      createdAt: Date.now(),
    });
    await saveStore(store);
    throw guardError;
  }

  const authorizationCode = await decryptSecret(account.encryptedSecret);
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.secure,
    auth: {
      user: account.email,
      pass: authorizationCode,
    },
  });

  try {
    await transporter.sendMail({
      from: account.displayName
        ? `"${account.displayName}" <${account.email}>`
        : account.email,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      attachments: Array.isArray(payload.attachments)
        ? payload.attachments.map((attachment) => ({
            filename: attachment.name,
            content: Buffer.from(attachment.contentBase64, 'base64'),
            contentType: attachment.mimeType || 'application/octet-stream',
          }))
        : [],
    });

    store.sendLogs.unshift({
      id: crypto.randomUUID(),
      accountId: account.id,
      to: payload.to,
      subject: payload.subject,
      status: 'success',
      createdAt: Date.now(),
    });
    await saveStore(store);
    return { ok: true };
  } catch (error) {
    store.sendLogs.unshift({
      id: crypto.randomUUID(),
      accountId: account.id,
      to: payload.to,
      subject: payload.subject,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      createdAt: Date.now(),
    });
    await saveStore(store);
    throw error;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
