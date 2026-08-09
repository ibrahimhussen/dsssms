import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../lib/dashboard-api';

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: () => dashboardApi.getAdminDashboard(),
  });
}

export function useDirectorDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'director'],
    queryFn: () => dashboardApi.getDirectorDashboard(),
  });
}

export function useViceDirectorDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'vice-director'],
    queryFn: () => dashboardApi.getViceDirectorDashboard(),
  });
}
