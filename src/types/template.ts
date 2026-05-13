export interface MailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DraftTemplateInput {
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
}

export interface TemplateVariableOption {
  key: string;
  label: string;
  example: string;
}
