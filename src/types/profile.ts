export interface Skill {
  id: string;
  name: string;
  proficiency: number;
  yearsOfExperience: number;
}

export interface WorkExperience {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
  description?: string | null;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string | null;
  grade?: string | null;
}

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  headline?: string | null;
  summary?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  skills: Skill[];
  experiences: WorkExperience[];
  education: Education[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpdate {
  fullName: string;
  phone?: string;
  address?: string;
  headline?: string;
  summary?: string;
  dateOfBirth?: string;
}
