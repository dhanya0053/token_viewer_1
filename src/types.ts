export type TokenStatus =
  | "ISSUED"
  | "CHECKED_IN"
  | "WAITING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface Department {
  id: string;
  name: string;
  location: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  staffId: string | null;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  departmentId: string;
  qualifications: string;
  experience: number;
  languagesSpoken: string[];
  consultationType: string;
  rating?: number;
  reviewCount?: number;
  fee?: string;
  image?: string;
  specializations: string[];
  consultationFee?: number;
  clinicAddress?: string;
}

export interface Token {
  id: string;
  value: string;
  status: TokenStatus;
  priority: PriorityLevel;
  patientId: string;
  appointmentId: string;
  queuePosition: number;
  department: string;
  service: string;
  doctorId: string;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  checkedInAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export type PriorityLevel = "NORMAL" | "HIGH" | "EMERGENCY";
