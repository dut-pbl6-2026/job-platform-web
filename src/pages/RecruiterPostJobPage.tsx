import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, Button, Field, Input, Select, Textarea } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { apiErrorMessage } from "../lib/http";
import { createJob, fetchCategories, type JobCreatePayload } from "../lib/jobsApi";
import { queryKeys } from "../lib/queryClient";
import { showToast } from "../lib/toastBus";

// Values are the backend enum names (job-svc); labels are the mobile post-job screen's Vietnamese.
const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: "FullTime", label: "Toàn thời gian" },
  { value: "PartTime", label: "Bán thời gian" },
  { value: "Contract", label: "Hợp đồng" },
  { value: "Internship", label: "Thực tập" },
];

const EXPERIENCE_LEVELS: { value: string; label: string }[] = [
  { value: "Entry", label: "Junior" },
  { value: "Mid", label: "Middle" },
  { value: "Senior", label: "Senior" },
  { value: "Lead", label: "Lead" },
];

type Form = {
  title: string;
  description: string;
  location: string;
  categoryId: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: string;
  salaryMax: string;
  requirements: string;
  benefits: string;
};

const EMPTY: Form = {
  title: "",
  description: "",
  location: "",
  categoryId: "",
  employmentType: "FullTime",
  experienceLevel: "Entry",
  salaryMin: "",
  salaryMax: "",
  requirements: "",
  benefits: "",
};

type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.title.trim()) e.title = "Vui lòng nhập tiêu đề";
  if (!f.description.trim()) e.description = "Vui lòng nhập mô tả";
  if (!f.location.trim()) e.location = "Vui lòng nhập địa điểm";
  const min = f.salaryMin.trim() === "" ? null : Number(f.salaryMin);
  const max = f.salaryMax.trim() === "" ? null : Number(f.salaryMax);
  if (min !== null && (!Number.isFinite(min) || min < 0)) e.salaryMin = "Mức lương phải là số không âm";
  if (max !== null && (!Number.isFinite(max) || max < 0)) e.salaryMax = "Mức lương phải là số không âm";
  if (min !== null && max !== null && Number.isFinite(min) && Number.isFinite(max) && min > max) {
    e.salaryMax = "Mức lương tối đa phải lớn hơn hoặc bằng tối thiểu";
  }
  return e;
}

export default function RecruiterPostJobPage() {
  useDocumentTitle("Nhà tuyển dụng: Đăng tin");
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = user?.companyId ?? "";
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategories, staleTime: 5 * 60_000 });

  const submit = useMutation({
    mutationFn: (payload: JobCreatePayload) => createJob(payload),
    onSuccess: () => {
      showToast({ title: "Tin tuyển dụng đã được gửi duyệt thành công!", kind: "success" });
      navigate("/recruiter/jobs");
    },
  });

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    submit.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      companyId,
      location: form.location.trim(),
      salaryMin: num(form.salaryMin),
      salaryMax: num(form.salaryMax),
      salaryCurrency: "VND",
      categoryId: form.categoryId || null,
      requirements: form.requirements.trim() || null,
      benefits: form.benefits.trim() || null,
      employmentType: form.employmentType,
      experienceLevel: form.experienceLevel,
    });
  }

  return (
    <RecruiterShell title="Đăng tin tuyển dụng" lead="Điền thông tin vị trí. Tin sẽ đăng dưới công ty của tài khoản bạn.">
      {!companyId && (
        <Alert tone="warning">
          Tài khoản của bạn chưa gắn với công ty nên chưa đăng tin được. Hãy liên hệ quản trị viên.
        </Alert>
      )}

      <form className="jp-recruiter-form" onSubmit={onSubmit} noValidate>
        <fieldset className="jp-recruiter-section">
          <legend>Mô tả công việc &amp; Yêu cầu</legend>
          <Field id="post-title" label="Tiêu đề vị trí" required error={errors.title}>
            <Input id="post-title" value={form.title} placeholder="Ví dụ: Senior UI/UX Designer" onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field id="post-description" label="Mô tả công việc" required error={errors.description} hint="Mô tả chi tiết trách nhiệm và kỹ năng cần có">
            <Textarea id="post-description" rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field id="post-requirements" label="Yêu cầu" optional>
            <Textarea id="post-requirements" rows={4} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} />
          </Field>
        </fieldset>

        <fieldset className="jp-recruiter-section">
          <legend>Công ty &amp; Địa điểm làm việc</legend>
          <Field id="post-location" label="Địa điểm" required error={errors.location}>
            <Input id="post-location" value={form.location} placeholder="Ví dụ: Hà Nội" onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field id="post-category" label="Lĩnh vực" optional>
            <Select id="post-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Chưa chọn</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </fieldset>

        <fieldset className="jp-recruiter-section">
          <legend>Mức lương &amp; Tiền tệ</legend>
          <div className="jp-recruiter-row">
            <Field id="post-salary-min" label="Lương tối thiểu (VND)" optional error={errors.salaryMin}>
              <Input id="post-salary-min" inputMode="numeric" value={form.salaryMin} onChange={(e) => set("salaryMin", e.target.value)} />
            </Field>
            <Field id="post-salary-max" label="Lương tối đa (VND)" optional error={errors.salaryMax}>
              <Input id="post-salary-max" inputMode="numeric" value={form.salaryMax} onChange={(e) => set("salaryMax", e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="jp-recruiter-section">
          <legend>Loại hình &amp; Cấp độ</legend>
          <div className="jp-recruiter-row">
            <Field id="post-employment" label="Loại hình làm việc" required>
              <Select id="post-employment" value={form.employmentType} onChange={(e) => set("employmentType", e.target.value)}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field id="post-experience" label="Cấp độ kinh nghiệm" required>
              <Select id="post-experience" value={form.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value)}>
                {EXPERIENCE_LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="jp-recruiter-section">
          <legend>Chế độ đãi ngộ &amp; Phúc lợi</legend>
          <Field id="post-benefits" label="Phúc lợi" optional hint="Bảo hiểm, thưởng, ngày phép, đào tạo...">
            <Textarea id="post-benefits" rows={4} value={form.benefits} onChange={(e) => set("benefits", e.target.value)} />
          </Field>
        </fieldset>

        {submit.isError && (
          <Alert tone="error">{apiErrorMessage(submit.error, "Không gửi được tin tuyển dụng. Vui lòng thử lại.")}</Alert>
        )}

        <div className="jp-recruiter-actions">
          <Button type="submit" loading={submit.isPending} disabled={!companyId}>
            {submit.isPending ? "Đang đăng…" : "Xuất bản"}
          </Button>
        </div>
      </form>
    </RecruiterShell>
  );
}
