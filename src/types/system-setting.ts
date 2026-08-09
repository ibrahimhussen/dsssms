export interface SystemSetting {
  schoolName: string;
  schoolAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currentAcademicYear: string;
  updatedAt: string;
  updatedByUsername: string | null;
}

export interface UpdateSystemSettingInput {
  schoolName: string;
  schoolAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  currentAcademicYear: string;
}
