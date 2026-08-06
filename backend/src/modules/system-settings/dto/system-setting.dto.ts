export interface SystemSettingDto {
  schoolName: string;
  schoolAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currentAcademicYear: string;
  updatedAt: string;
  updatedByUsername: string | null;
}
