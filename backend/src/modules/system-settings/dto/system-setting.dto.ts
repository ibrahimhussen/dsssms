export interface SystemSettingDto {
  schoolName: string;
  schoolAddress: string | null;
  schoolZone: string | null;
  schoolWereda: string | null;
  schoolRegion: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currentAcademicYear: string;
  schoolLogo: string | null;
  promotionPassMark: number;
  minimumSubjectPassMark: number;
  updatedAt: string;
  updatedByUsername: string | null;
}
