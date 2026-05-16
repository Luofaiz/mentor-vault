import { getDesktopApi } from './desktop';
import type { ListOrderPreferences } from '../types/listOrderPreferences';

const STORAGE_KEY = 'mentor.listOrderPreferences.v1';

const DEFAULT_PREFERENCES: ListOrderPreferences = {
  noteIds: [],
  schools: [],
  collegesBySchool: {},
};

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean)));
}

export function normalizeListOrderPreferences(value: unknown): ListOrderPreferences {
  const input = value && typeof value === 'object' ? value as Partial<ListOrderPreferences> : {};
  const collegesBySchool = input.collegesBySchool && typeof input.collegesBySchool === 'object'
    ? Object.fromEntries(
        Object.entries(input.collegesBySchool)
          .map(([school, colleges]) => [school.trim(), normalizeStringArray(colleges)])
          .filter(([school]) => school),
      )
    : {};

  return {
    noteIds: normalizeStringArray(input.noteIds),
    schools: normalizeStringArray(input.schools),
    collegesBySchool,
  };
}

function readBrowserPreferences() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
    return DEFAULT_PREFERENCES;
  }

  try {
    return normalizeListOrderPreferences(JSON.parse(raw));
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
    return DEFAULT_PREFERENCES;
  }
}

function writeBrowserPreferences(preferences: ListOrderPreferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeListOrderPreferences(preferences)));
}

export async function getListOrderPreferences() {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.listOrderPreferences.get();
  }

  return readBrowserPreferences();
}

export async function saveListOrderPreferences(preferences: ListOrderPreferences) {
  const normalized = normalizeListOrderPreferences(preferences);
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.listOrderPreferences.save(normalized);
  }

  writeBrowserPreferences(normalized);
  return normalized;
}
