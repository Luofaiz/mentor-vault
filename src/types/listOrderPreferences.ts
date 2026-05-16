export interface ListOrderPreferences {
  noteIds: string[];
  schools: string[];
  collegesBySchool: Record<string, string[]>;
}
