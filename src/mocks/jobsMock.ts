import type { Company, Job } from "../types/job";
import seed from "./seedJobs.json";

// Offline fallback built from job-platform-crawler/seed/jobs.json (refresh: `npm run sync:seed`).
type SeedJob = {
  source_url: string;
  title: string;
  company: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  description: string | null;
  requirements: string | null;
  category: string | null;
};

// Mock categoryId uses lowercase name as id; real API uses UUIDs.
const cats = [
  { id: "it", name: "IT" }, { id: "finance", name: "Finance" }, { id: "marketing", name: "Marketing" },
  { id: "healthcare", name: "Healthcare" }, { id: "education", name: "Education" }, { id: "engineering", name: "Engineering" },
  { id: "sales", name: "Sales" }, { id: "hospitality", name: "Hospitality" }, { id: "others", name: "Others" },
];

// Crawler categories are free-text vieclam.gov.vn groups; backend only knows the 9 predefined ones (JOB-01-06).
const CATEGORY_MAP: Record<string, string> = {
  CNTT: "IT",
  "Ke toan": "Finance",
  "Tai chinh": "Finance",
  "Ban hang": "Sales",
  Marketing: "Marketing",
  "Truyen thong": "Marketing",
  "Ky thuat": "Engineering",
  "Xay dung": "Engineering",
  "Y te": "Healthcare",
  "Giao duc": "Education",
  "Du lich": "Hospitality",
};

const LOCATION_MAP: Record<string, string> = {
  "Ha Noi": "Hà Nội", "Ho Chi Minh": "Hồ Chí Minh", "Da Nang": "Đà Nẵng", Hue: "Huế", "Thua Thien Hue": "Thừa Thiên Huế",
  "Can Tho": "Cần Thơ", "Hai Phong": "Hải Phòng", "Binh Duong": "Bình Dương", "Dong Nai": "Đồng Nai", "Bac Ninh": "Bắc Ninh",
  "Quang Ninh": "Quảng Ninh", "Nghe An": "Nghệ An", "Thanh Hoa": "Thanh Hóa", "Khanh Hoa": "Khánh Hòa", "Lam Dong": "Lâm Đồng",
  "Hai Duong": "Hải Dương", "Nam Dinh": "Nam Định", "Binh Dinh": "Bình Định", "Quang Nam": "Quảng Nam", "Long An": "Long An",
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toLocation(raw: string | null) {
  if (!raw) return "Toàn quốc";
  return raw
    .split(",")
    .map((part) => part.trim().replace(/^Tinh\s+/i, ""))
    .map((part) => LOCATION_MAP[part] ?? part)
    .join(", ");
}

const rows = seed as SeedJob[];
const companies = new Map<string, Company>();

export const MOCK_JOBS: Job[] = rows.map((row, i) => {
  const name = row.company?.trim() || "Nhà tuyển dụng";
  const catName = CATEGORY_MAP[row.category ?? ""] ?? "Others";
  const cat = cats.find((c) => c.name === catName)!;
  let company = companies.get(name);
  if (!company) {
    company = { id: slug(name), name, industry: catName, verified: false };
    companies.set(name, company);
  }
  const createdAt = new Date(Date.now() - i * 3 * 3600_000).toISOString();
  return {
    id: `seed-${row.source_url.split("/").pop() || i + 1}`,
    title: row.title,
    description: row.description ?? "",
    requirements: row.requirements,
    benefits: null,
    company,
    companyId: company.id,
    location: toLocation(row.location),
    salaryMin: row.salary_min ?? 0,
    salaryMax: row.salary_max ?? 0,
    salaryCurrency: row.salary_currency || "VND",
    category: cat,
    categoryId: cat.id,
    employmentType: (["Full-time", "Full-time", "Full-time", "Part-time", "Contract"] as const)[i % 5],
    experienceLevel: (["Junior", "Middle", "Senior"] as const)[i % 3],
    status: "active",
    viewCount: 50 + ((i * 37) % 900),
    createdAt,
    updatedAt: createdAt,
  } as Job;
});

export const MOCK_CATEGORIES = cats;
