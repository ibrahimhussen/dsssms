import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { SystemSetting, UpdateSystemSettingInput } from '../types/system-setting';

export const systemSettingsApi = {
  get() {
    return unwrap(apiClient.get<ApiResponse<SystemSetting>>('/system-settings'));
  },

  update(input: UpdateSystemSettingInput) {
    return unwrap(apiClient.patch<ApiResponse<SystemSetting>>('/system-settings', input));
  },
};
