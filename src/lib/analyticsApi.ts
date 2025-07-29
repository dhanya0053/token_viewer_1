import { api } from "./api";

export interface DepartmentAnalytics {
  department: {
    id: string;
    name: string;
    description: string;
  };
  totalAppointments: number;
  averageWaitTime: number;
  totalPatientsServed: number;
  activeDoctors: number;
  totalServices: number;
  lastUpdated: string;
}

export async function fetchDepartmentAnalytics(departmentId: string): Promise<DepartmentAnalytics> {
  return api<DepartmentAnalytics>(`/analytics/departments/${departmentId}`);
}

export async function fetchAllDepartmentsAnalytics(): Promise<DepartmentAnalytics[]> {
  return api<DepartmentAnalytics[]>('/analytics/departments');
}
