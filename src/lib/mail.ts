import { getDesktopApi } from './desktop';
import type { MailAccount, MailAccountInput, SendEmailPayload, SendLog } from '../types/mail';

export async function listMailAccounts() {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    return [];
  }

  return desktopApi.mailAccounts.list();
}

export async function saveMailAccount(id: string | null, input: MailAccountInput) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for mail account storage.');
  }

  return desktopApi.mailAccounts.save(id, input);
}

export async function listSendLogs() {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    return [];
  }

  return desktopApi.mail.listLogs();
}

export async function sendEmail(payload: SendEmailPayload) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error('Desktop runtime required for SMTP sending.');
  }

  return desktopApi.mail.send(payload);
}

export function getDefault163AccountInput(): MailAccountInput {
  return {
    email: '',
    displayName: '',
    smtpHost: 'smtp.163.com',
    smtpPort: 465,
    secure: true,
    isDefault: true,
    authorizationCode: '',
  };
}

export function getDefaultMailAccount(accounts: MailAccount[]) {
  return accounts.find((account) => account.isDefault) ?? accounts[0] ?? null;
}
