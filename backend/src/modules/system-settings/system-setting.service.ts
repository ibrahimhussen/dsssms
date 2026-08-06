import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { recordAudit } from '../../core/audit/audit-recorder';
import { SystemSettingDto } from './dto/system-setting.dto';
import { UpdateSystemSettingInput } from './validation/system-setting.validation';

const SETTINGS_ROW_ID = 1;

type SettingWithUpdatedBy = Prisma.SystemSettingGetPayload<{ include: { updatedBy: true } }>;

function toDto(row: SettingWithUpdatedBy): SystemSettingDto {
  return {
    schoolName: row.schoolName,
    schoolAddress: row.schoolAddress,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    currentAcademicYear: row.currentAcademicYear,
    updatedAt: row.updatedAt.toISOString(),
    updatedByUsername: row.updatedBy?.username ?? null,
  };
}

export class SystemSettingService {
  /**
   * Reads the singleton settings row, creating a bare default if it
   * somehow doesn't exist yet (the initial migration seeds it, so this is
   * just a defensive fallback).
   */
  async get(): Promise<SystemSettingDto> {
    const row = await prisma.systemSetting.upsert({
      where: { id: SETTINGS_ROW_ID },
      update: {},
      create: { id: SETTINGS_ROW_ID, schoolName: 'My School', currentAcademicYear: new Date().getFullYear().toString() },
      include: { updatedBy: true },
    });

    return toDto(row);
  }

  async update(input: UpdateSystemSettingInput, actor: { userId: number; ipAddress?: string }): Promise<SystemSettingDto> {
    const row = await prisma.systemSetting.upsert({
      where: { id: SETTINGS_ROW_ID },
      update: { ...input, updatedByUserId: actor.userId },
      create: { id: SETTINGS_ROW_ID, ...input, updatedByUserId: actor.userId },
      include: { updatedBy: true },
    });

    await recordAudit({
      userId: actor.userId,
      action: 'SYSTEM_SETTINGS_UPDATED',
      entity: 'SystemSetting',
      entityId: String(SETTINGS_ROW_ID),
      ipAddress: actor.ipAddress,
      metadata: { ...input },
    });

    return toDto(row);
  }
}

export const systemSettingService = new SystemSettingService();
