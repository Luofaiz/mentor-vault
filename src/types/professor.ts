export const PROFESSOR_STATUSES = [
  'Pending',
  'Drafting',
  'Contacted',
  'Follow-Up Due',
  'Replied',
  '未读',
  '已读不回',
  '官回',
  '待面试',
  '待考核',
  'Rejected',
] as const;

export type BuiltInProfessorStatus = (typeof PROFESSOR_STATUSES)[number];
export type ProfessorStatus = BuiltInProfessorStatus | (string & {});

export interface Professor {
  id: string;
  name: string;
  title: string;
  school: string;
  email: string;
  homepage: string;
  researchArea: string;
  status: ProfessorStatus;
  tags: string[];
  firstContactDate: string;
  lastContactDate: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface ProfessorDraft {
  name: string;
  title: string;
  school: string;
  email: string;
  homepage: string;
  researchArea: string;
  status: ProfessorStatus;
  tags: string[];
  firstContactDate: string;
  lastContactDate: string;
  notes: string;
}

export interface ProfessorFilters {
  includeDeleted?: boolean;
  query?: string;
}
