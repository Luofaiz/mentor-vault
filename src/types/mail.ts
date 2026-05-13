export interface MailAccount {
  id: string;
  provider: '163';
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  authCodeHint: string;
}

export interface MailAccountInput {
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  isDefault: boolean;
  authorizationCode: string;
}

export interface MailAttachment {
  name: string;
  mimeType: string;
  contentBase64: string;
  size: number;
}

export interface SendEmailPayload {
  accountId: string;
  to: string;
  subject: string;
  body: string;
  attachments?: MailAttachment[];
}

export interface SendLog {
  id: string;
  accountId: string;
  to: string;
  subject: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  createdAt: number;
}
