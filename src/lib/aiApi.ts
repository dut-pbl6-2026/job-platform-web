import { api } from "./api";
import i18n from "../i18n";
import type { ResumeScore, ScoreError } from "../types/resumeScore";

export const SCORE_CV_MAX_BYTES = 5 * 1024 * 1024;
export const SCORE_CV_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function validateScoreCv(file: File | null): string | null {
  if (!file) return i18n.t("cv.missing");
  const n = file.name.toLowerCase();
  if (n.endsWith(".doc")) return i18n.t("cv.legacyDoc");
  if (!n.endsWith(".pdf") && !n.endsWith(".docx")) return i18n.t("cv.allowedPdfDocx");
  if (file.size > SCORE_CV_MAX_BYTES) return i18n.t("cv.tooLarge");
  return null;
}

/** Translation key for each error code of the AI service (SPEC section 7). */
const SCORE_ERROR_KEYS = {
  cv_no_text: "cv.scoreError.cvNoText",
  cv_encrypted: "cv.scoreError.cvEncrypted",
  cv_unreadable: "cv.scoreError.cvUnreadable",
  unsupported_media_type: "cv.scoreError.unsupportedMediaType",
  file_too_large: "cv.scoreError.fileTooLarge",
  job_not_found: "cv.scoreError.jobNotFound",
  rate_limited: "cv.scoreError.rateLimited",
  busy: "cv.scoreError.busy",
  job_service_unavailable: "cv.scoreError.jobServiceUnavailable",
  unauthorized: "cv.scoreError.unauthorized",
} as const;

export function toScoreError(ex: unknown): ScoreError {
  const ax = ex as { response?: { status?: number; data?: { code?: string; detail?: string } }; code?: string };
  const code =
    ax.response?.data?.code ??
    (ax.response?.status === 401 ? "unauthorized" : ax.code === "ECONNABORTED" ? "busy" : "network");
  // Unknown codes get the generic text: the backend `detail` is English and not meant for users.
  const key = (Object.keys(SCORE_ERROR_KEYS) as string[]).includes(code)
    ? SCORE_ERROR_KEYS[code as keyof typeof SCORE_ERROR_KEYS]
    : "cv.scoreError.generic";
  return { code, message: i18n.t(key) };
}

export async function scoreResume(jobId: string, cvFile: File): Promise<ResumeScore> {
  const fd = new FormData();
  fd.append("cv_file", cvFile);
  fd.append("job_id", jobId);
  fd.append("lang", "vi"); // UI is Vietnamese: suggestions in Vietnamese even for an English CV
  const res = await api.post<ResumeScore>("/ai/score-resume", fd, { timeout: 90_000 });
  return res.data;
}
