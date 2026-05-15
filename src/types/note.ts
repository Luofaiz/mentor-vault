export interface DocumentNote {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentNoteInput {
  title: string;
  body: string;
}
