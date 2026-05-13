export interface MailDraft {
  id: string;
  title: string;
  professorId: string | null;
  templateId: string | null;
  subject: string;
  body: string;
  status: 'draft' | 'ready';
  createdAt: number;
  updatedAt: number;
}

export interface MailDraftInput {
  title: string;
  professorId: string | null;
  templateId: string | null;
  subject: string;
  body: string;
  status: 'draft' | 'ready';
}
