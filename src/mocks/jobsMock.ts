import type { Job } from "../types/job";

const companies = [
  { id: "c1", name: "FPT Software", logoUrl: "", industry: "IT", verified: true, address: "Hồ Chí Minh" },
  { id: "c2", name: "VNG Corporation", logoUrl: "", industry: "IT", verified: true, address: "Hồ Chí Minh" },
  { id: "c3", name: "Vietcombank", logoUrl: "", industry: "Finance", verified: true, address: "Hà Nội" },
  { id: "c4", name: "VinGroup", logoUrl: "", industry: "Hospitality", verified: true, address: "Hà Nội" },
  { id: "c5", name: "Tiki", logoUrl: "", industry: "Sales", verified: false, address: "Hồ Chí Minh" },
];

const cats = [
  { id: "it", name: "IT" }, { id: "finance", name: "Finance" }, { id: "marketing", name: "Marketing" },
  { id: "healthcare", name: "Healthcare" }, { id: "education", name: "Education" }, { id: "engineering", name: "Engineering" },
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
    ...o,
  } as Job;
}

export const MOCK_JOBS: Job[] = [
  mk(1, { title: "Frontend Developer (React)" }),
  mk(2, { title: "Backend Developer (.NET)" }),
  mk(3, { title: "Fullstack Engineer" }),
  mk(4, { title: "QA Engineer" }),
  mk(5, { title: "DevOps Engineer" }),
  mk(6, { title: "Data Engineer" }),
  mk(7, { title: "Marketing Specialist" }),
  mk(8, { title: "Finance Analyst" }),
  mk(9, { title: "HR Recruiter" }),
  mk(10, { title: "UI/UX Designer" }),
  mk(11, { title: "Mobile Developer (Flutter)" }),
  mk(12, { title: "AI Engineer" }),
  mk(13, { title: "Product Manager" }),
  mk(14, { title: "Sales Executive" }),
  mk(15, { title: "Customer Support Lead" }),
  mk(16, { title: "Security Engineer" }),
];

export const MOCK_CATEGORIES = cats;
