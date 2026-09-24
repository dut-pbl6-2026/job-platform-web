import type { Job } from "../types/job";

const companies = [
  { id: "c1", name: "FPT Software", logoUrl: "", industry: "IT", verified: true, address: "Hồ Chí Minh" },
  { id: "c2", name: "VNG Corporation", logoUrl: "", industry: "IT", verified: true, address: "Hồ Chí Minh" },
  { id: "c3", name: "Vietcombank", logoUrl: "", industry: "Finance", verified: true, address: "Hà Nội" },
  { id: "c4", name: "VinGroup", logoUrl: "", industry: "Hospitality", verified: true, address: "Hà Nội" },
  { id: "c5", name: "Tiki", logoUrl: "", industry: "Sales", verified: false, address: "Hồ Chí Minh" },
];

// Mock categoryId uses lowercase name as id; real API uses UUIDs.
// Mock search supports filtering by both category.name and categoryId for parity.
// Seeded 9 categories to match backend (was 6, added Sales, Hospitality, Others).
const cats = [
  { id: "it", name: "IT" }, { id: "finance", name: "Finance" }, { id: "marketing", name: "Marketing" },
  { id: "healthcare", name: "Healthcare" }, { id: "education", name: "Education" }, { id: "engineering", name: "Engineering" },
  { id: "sales", name: "Sales" }, { id: "hospitality", name: "Hospitality" }, { id: "others", name: "Others" },
];

function mk(i: number, o: Partial<Job> & Pick<Job, "title">): Job {
  const c = companies[i % companies.length];
  const cat = cats[i % cats.length];
  const now = new Date(Date.now() - i * 86400000 * 2).toISOString();
  return {
    id: `job-${String(i).padStart(3, "0")}`,
    description: `Mô tả công việc cho vị trí ${o.title}. Làm việc với đội ngũ chuyên nghiệp, cơ hội phát triển rõ ràng, môi trường năng động.`,
    company: c, companyId: c.id, location: ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Cần Thơ"][i % 4],
    salaryMin: 15000000 + (i % 5) * 5000000, salaryMax: 25000000 + (i % 5) * 8000000, salaryCurrency: "VND",
    category: cat, categoryId: cat.id,
    requirements: "• 2+ năm kinh nghiệm\n• Thành thạo React/TypeScript\n• Tiếng Anh giao tiếp\n• Tư duy sản phẩm",
    benefits: "• Bảo hiểm xã hội đầy đủ\n• Thưởng hiệu suất\n• Đào tạo nội bộ\n• Du lịch công ty",
    employmentType: (["Full-time", "Part-time", "Contract"] as const)[i % 3],
    experienceLevel: (["Junior", "Middle", "Senior"] as const)[i % 3],
    status: "active", viewCount: 120 + i * 34, createdAt: now, updatedAt: now,
    skills: o.skills ?? ["React", "TypeScript", "English"].slice(0, (i % 3) + 1),
    ...o,
  } as Job;
}

export const MOCK_JOBS: Job[] = [
  mk(1, { title: "Frontend Developer (React)", skills: ["React", "TypeScript", "CSS"] }),
  mk(2, { title: "Backend Developer (.NET)", skills: [".NET", "C#", "SQL"] }),
  mk(3, { title: "Fullstack Engineer", skills: ["React", "Node.js", "PostgreSQL"] }),
  mk(4, { title: "QA Engineer", skills: ["Testing", "Selenium"] }),
  mk(5, { title: "DevOps Engineer", skills: ["Docker", "Kubernetes", "CI/CD"] }),
  mk(6, { title: "Data Engineer", skills: ["Python", "Spark", "SQL"] }),
  mk(7, { title: "Marketing Specialist", skills: ["SEO", "Content"] }),
  mk(8, { title: "Finance Analyst", skills: ["Excel", "SQL"] }),
  mk(9, { title: "HR Recruiter", skills: ["Recruiting"] }),
  mk(10, { title: "UI/UX Designer", skills: ["Figma", "UX"] }),
  mk(11, { title: "Mobile Developer (Flutter)", skills: ["Flutter", "Dart"] }),
  mk(12, { title: "AI Engineer", skills: ["Python", "PyTorch"] }),
  mk(13, { title: "Product Manager", skills: ["Product", "Agile"] }),
  mk(14, { title: "Sales Executive", skills: ["Sales", "CRM"] }),
  mk(15, { title: "Customer Support Lead", skills: ["Support", "English"] }),
  mk(16, { title: "Security Engineer", skills: ["Security", "Linux"], location: "Remote" }),
];

export const MOCK_CATEGORIES = cats;
