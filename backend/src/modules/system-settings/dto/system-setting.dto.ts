export interface SystemSettingDto {
  schoolName: string;
  schoolAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currentAcademicYear: string;
  promotionPassMark: number;
  minimumSubjectPassMark: number;
  updatedAt: string;
  updatedByUsername: string | null;
}
