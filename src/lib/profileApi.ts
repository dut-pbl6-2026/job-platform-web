import { api } from "./api";
import { unwrap, pickStr, pickNum, shouldUseMock } from "./http";
import type { Education, Profile, ProfileUpdate, Skill, WorkExperience } from "../types/profile";

const STORE_PREFIX = "jp.mock.profile.";

function emptyProfile(userId: string, fullName: string): Profile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    fullName,
    phone: "",
    address: "",
    headline: "",
    summary: "",
    skills: [],
    experiences: [],
    education: [],
    createdAt: now,
    updatedAt: now,
  };
}

function loadMock(userId: string, fullName: string): Profile {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + userId);
    if (raw) return JSON.parse(raw) as Profile;
  } catch { /* ignore */ }
  const p = emptyProfile(userId, fullName);
  saveMock(p);
  return p;
}

function saveMock(p: Profile) {
  p.updatedAt = new Date().toISOString();
  localStorage.setItem(STORE_PREFIX + p.userId, JSON.stringify(p));
}

function asSkill(raw: unknown): Skill | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    id: pickStr(o, "id") || crypto.randomUUID(),
    name: pickStr(o, "name") || "",
    proficiency: Math.min(5, Math.max(1, pickNum(o, "proficiency") ?? 1)),
    yearsOfExperience: pickNum(o, "yearsOfExperience", "years_of_experience") ?? 0,
  };
}

function asExp(raw: unknown): WorkExperience | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    id: pickStr(o, "id") || crypto.randomUUID(),
    company: pickStr(o, "company") || "",
    title: pickStr(o, "title") || "",
    startDate: pickStr(o, "startDate", "start_date") || "",
    endDate: pickStr(o, "endDate", "end_date") ?? null,
    isCurrent: Boolean(o.isCurrent ?? o.is_current),
    description: pickStr(o, "description") ?? null,
  };
}

function asEdu(raw: unknown): Education | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    id: pickStr(o, "id") || crypto.randomUUID(),
    institution: pickStr(o, "institution") || "",
    degree: pickStr(o, "degree") || "",
    field: pickStr(o, "field") || "",
    startDate: pickStr(o, "startDate", "start_date") || "",
    endDate: pickStr(o, "endDate", "end_date") ?? null,
    grade: pickStr(o, "grade") ?? null,
  };
}

export function normalizeProfile(raw: unknown, fallbackUserId: string, fallbackName: string): Profile {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const skills = Array.isArray(o.skills) ? o.skills.map(asSkill).filter((x): x is Skill => !!x) : [];
  const experiences = Array.isArray(o.experiences) ? o.experiences.map(asExp).filter((x): x is WorkExperience => !!x)
    : Array.isArray(o.workExperiences) ? (o.workExperiences as unknown[]).map(asExp).filter((x): x is WorkExperience => !!x)
    : Array.isArray(o.experience) ? (o.experience as unknown[]).map(asExp).filter((x): x is WorkExperience => !!x)
    : [];
  const education = Array.isArray(o.education) ? o.education.map(asEdu).filter((x): x is Education => !!x)
    : Array.isArray(o.educations) ? (o.educations as unknown[]).map(asEdu).filter((x): x is Education => !!x)
    : [];
  return {
    id: pickStr(o, "id") || "",
    userId: pickStr(o, "userId", "user_id") || fallbackUserId,
    fullName: pickStr(o, "fullName", "full_name") || fallbackName,
    phone: pickStr(o, "phone") ?? "",
    address: pickStr(o, "address") ?? "",
    headline: pickStr(o, "headline") ?? "",
    summary: pickStr(o, "summary") ?? "",
    avatarUrl: pickStr(o, "avatarUrl", "avatar_url") ?? null,
    dateOfBirth: pickStr(o, "dateOfBirth", "date_of_birth") ?? null,
    skills,
    experiences,
    education,
    createdAt: pickStr(o, "createdAt", "created_at") || new Date().toISOString(),
    updatedAt: pickStr(o, "updatedAt", "updated_at") || new Date().toISOString(),
  };
}

/** profile-svc routes (gateway: /api/profiles/{**catch-all}). */
const P = "/profiles";

/** DateOnly fields: send null, never "" (System.Text.Json cannot parse an empty date). */
const dateOrNull = (v?: string | null) => (v ? v.slice(0, 10) : null);
const textOrNull = (v?: string | null) => (v && v.trim() ? v.trim() : null);

function statusOf(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status;
}

/** Mock fallback writes PII to localStorage: only in VITE_ENABLE_MOCKS demo mode. */
const isOffline = (e: unknown) => shouldUseMock(e, "profile-svc");

export async function fetchMyProfile(userId: string, fullName: string): Promise<Profile> {
  try {
    const { data } = await api.get(`${P}/me`);
    return normalizeProfile(unwrap(data), userId, fullName);
  } catch (e) {
    // 404 = the user has no profile yet; PUT /me (or adding a skill/experience) creates it.
    if (statusOf(e) === 404) return emptyProfile(userId, fullName);
    if (!isOffline(e)) throw e;
    await new Promise((r) => setTimeout(r, 180));
    return loadMock(userId, fullName);
  }
}

export async function updateMyProfile(payload: ProfileUpdate, userId: string): Promise<void> {
  try {
    await api.put(`${P}/me`, {
      fullName: payload.fullName,
      headline: textOrNull(payload.headline),
      summary: textOrNull(payload.summary),
      phone: textOrNull(payload.phone),
      address: textOrNull(payload.address),
      dateOfBirth: dateOrNull(payload.dateOfBirth),
    });
  } catch (e) {
    if (!isOffline(e)) throw e;
    const p = loadMock(userId, payload.fullName);
    Object.assign(p, payload);
    saveMock(p);
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function addSkill(userId: string, skill: Omit<Skill, "id">): Promise<Skill> {
  try {
    const { data } = await api.post(`${P}/skills`, {
      name: skill.name,
      proficiency: skill.proficiency,
      yearsOfExperience: skill.yearsOfExperience,
    });
    const body = unwrap<Record<string, unknown>>(data);
    return asSkill({ ...skill, id: pickStr(body, "id") })!;
  } catch (e) {
    if (!isOffline(e)) throw e;
    const p = loadMock(userId, "");
    const item: Skill = { ...skill, id: crypto.randomUUID() };
    p.skills = [...p.skills, item];
    saveMock(p);
    return item;
  }
}

export async function deleteSkill(userId: string, id: string): Promise<void> {
  try {
    await api.delete(`${P}/skills/${id}`);
  } catch (e) {
    if (!isOffline(e)) throw e;
    const p = loadMock(userId, "");
    p.skills = p.skills.filter((s) => s.id !== id);
    saveMock(p);
  }
}

export async function addExperience(userId: string, exp: Omit<WorkExperience, "id">): Promise<WorkExperience> {
  try {
    const { data } = await api.post(`${P}/experiences`, {
      company: exp.company,
      title: exp.title,
      startDate: dateOrNull(exp.startDate),
      endDate: exp.isCurrent ? null : dateOrNull(exp.endDate),
      isCurrent: exp.isCurrent,
      description: textOrNull(exp.description),
    });
    const body = unwrap<Record<string, unknown>>(data);
    return asExp({ ...exp, id: pickStr(body, "id") })!;
  } catch (e) {
    if (!isOffline(e)) throw e;
    const p = loadMock(userId, "");
    const item: WorkExperience = { ...exp, id: crypto.randomUUID() };
    p.experiences = [...p.experiences, item];
    saveMock(p);
    return item;
  }
}

export async function deleteExperience(userId: string, id: string): Promise<void> {
  try {
    await api.delete(`${P}/experiences/${id}`);
  } catch (e) {
    if (!isOffline(e)) throw e;
    const p = loadMock(userId, "");
    p.experiences = p.experiences.filter((x) => x.id !== id);
    saveMock(p);
  }
}

export async function addEducation(userId: string, edu: Omit<Education, "id">): Promise<Education> {
  try {
    const { data } = await api.post(`${P}/educations`, {
      institution: edu.institution,
      degree: textOrNull(edu.degree),
      field: textOrNull(edu.field),
      startDate: dateOrNull(edu.startDate),
      endDate: dateOrNull(edu.endDate),
      grade: textOrNull(edu.grade),
    });
    const body = unwrap<Record<string, unknown>>(data);
    return asEdu({ ...edu, id: pickStr(body, "id") })!;
  } catch (e) {
    if (!isOffline(e)) throw e;
    const p = loadMock(userId, "");
    const item: Education = { ...edu, id: crypto.randomUUID() };
    p.education = [...p.education, item];
    saveMock(p);
    return item;
  }
}

export async function deleteEducation(userId: string, id: string): Promise<void> {
  try {
    await api.delete(`${P}/educations/${id}`);
  } catch (e) {
    if (!isOffline(e)) throw e;
    const p = loadMock(userId, "");
    p.education = p.education.filter((x) => x.id !== id);
    saveMock(p);
  }
}
