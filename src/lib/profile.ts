import { getDesktopApi } from './desktop';
import type { UserProfileSettings, UserProfileSettingsInput } from '../types/profile';

const STORAGE_KEY = 'vibe.profile.v1';

interface ProfileStore {
  version: 1;
  profile: UserProfileSettings | null;
}

function normalizeInput(input: UserProfileSettingsInput): UserProfileSettingsInput {
  return {
    fullName: input.fullName.trim(),
    university: input.university.trim(),
  };
}

function readBrowserStore(): ProfileStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = { version: 1 as const, profile: null };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as ProfileStore;
    if (parsed.version !== 1 || !('profile' in parsed)) {
      throw new Error('Invalid profile store.');
    }
    return parsed;
  } catch {
    const seeded = { version: 1 as const, profile: null };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeBrowserStore(profile: UserProfileSettings | null) {
  const next: ProfileStore = {
    version: 1,
    profile,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function getUserProfileSettings() {
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.profile.get();
  }

  return readBrowserStore().profile;
}

export async function saveUserProfileSettings(input: UserProfileSettingsInput) {
  const normalized = normalizeInput(input);
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    return desktopApi.profile.save(normalized);
  }

  const current = readBrowserStore().profile;
  const now = Date.now();
  const nextProfile: UserProfileSettings = {
    ...normalized,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  writeBrowserStore(nextProfile);
  return nextProfile;
}
