import { api } from "./api";
import type { ResumeScore, ScoreError } from "../types/resumeScore";

export const SCORE_CV_MAX_BYTES = 5 * 1024 * 1024;
export const SCORE_CV_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function validateScoreCv(file: File | null): string | null {
  if (!file) return "Hãy chọn file CV";
  const n = file.name.toLowerCase();
  if (n.endsWith(".doc")) return "Chưa hỗ trợ file .doc cũ — hãy lưu CV thành PDF hoặc DOCX";
  if (!n.endsWith(".pdf") && !n.endsWith(".docx")) return "Chỉ nhận PDF hoặc DOCX";
  if (file.size > SCORE_CV_MAX_BYTES) return "File tối đa 5 MB";
  return null;
}

/** Vietnamese, user-facing text for each error code of the AI service (SPEC section 7). */
const ERROR_TEXT: Record<string, string> = {
  cv_no_text: "Không đọc được chữ trong CV. Hãy tải lên file rõ nét hơn hoặc bản PDF/DOCX gốc.",
  cv_encrypted: "CV đang đặt mật khẩu. Hãy gỡ mật khẩu rồi tải lại.",
  cv_unreadable: "File CV bị hỏng hoặc không mở được.",
  unsupported_media_type: "Chỉ nhận PDF hoặc DOCX.",
  file_too_large: "File tối đa 5 MB.",
  job_not_found: "Không tìm thấy việc làm này.",
  rate_limited: "Bạn thử quá nhiều lần. Vui lòng đợi một phút rồi thử lại.",
  busy: "Hệ thống đang bận. Hãy thử lại sau ít giây.",
  job_service_unavailable: "Dịch vụ việc làm tạm thời không phản hồi. Thử lại sau nhé.",
  unauthorized: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
};

export function toScoreError(ex: unknown): ScoreError {
  const ax = ex as { response?: { status?: number; data?: { code?: string; detail?: string } }; code?: string };
  const code = ax.response?.data?.code ?? (ax.response?.status === 401 ? "unauthorized" : ax.code === "ECONNABORTED" ? "busy" : "network");
  return { code, message: ERROR_TEXT[code] ?? ax.response?.data?.detail ?? "Không chấm điểm được CV. Vui lòng thử lại." };
}

export async function scoreResume(jobId: string, cvFile: File): Promise<ResumeScore> {
  const fd = new FormData();
  fd.append("cv_file", cvFile);
  fd.append("job_id", jobId);
  fd.append("lang", "vi"); // UI is Vietnamese: suggestions in Vietnamese even for an English CV
  const res = await api.post<ResumeScore>("/ai/score-resume", fd, { timeout: 90_000 });
  return res.data;
}
