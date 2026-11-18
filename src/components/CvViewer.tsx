import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SkeletonBlock } from "./ui";
import { PdfViewer } from "./PdfViewer";
import { fetchCvBlob } from "../lib/applicationsApi";

/**
 * The CV the candidate submitted, inside the application page: a PDF is rendered with pdf.js (works
 * even where the browser's PDF plugin is absent), anything else gets a short explanation. No new tab.
 */
export function CvViewer({ cvUrl, fileName }: { cvUrl: string; fileName?: string | null }) {
  const { t } = useTranslation();
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);
  const isPdf = /\.pdf$/i.test(fileName ?? "") || !/\.(docx?|DOCX?)$/.test(fileName ?? "");

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(false);
    if (!isPdf) return;
    fetchCvBlob(cvUrl)
      .then((blob) => blob.arrayBuffer())
      .then((buffer) => {
        if (alive) setData(buffer);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [cvUrl, isPdf]);

  if (!isPdf) return <p className="jp-cv-empty">{t("recruiter.applicationDetail.cvNoPreview")}</p>;
  if (error) return <p className="jp-cv-empty">{t("recruiter.applicationDetail.cvFailed")}</p>;
  if (!data) return <SkeletonBlock height={420} label={t("recruiter.applicationDetail.cvLoading")} />;

  return (
    <div className="jp-cv-view">
      <PdfViewer data={data} />
    </div>
  );
}
