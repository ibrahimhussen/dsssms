export interface SystemSetting {
  schoolName: string;
  schoolAddress: string | null;
  schoolZone: string | null;
  schoolWereda: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currentAcademicYear: string;
  schoolLogo: string | null;
  updatedAt: string;
  updatedByUsername: string | null;
}

export interface UpdateSystemSettingInput {
  schoolName: string;
  schoolAddress?: string;
  schoolZone?: string;
  schoolWereda?: string;
  contactEmail?: string;
  contactPhone?: string;
  currentAcademicYear: string;
  schoolLogo?: string;
}
