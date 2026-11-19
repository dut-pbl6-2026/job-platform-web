import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SkeletonBlock } from "./ui";
import { PdfViewer } from "./PdfViewer";
import { fetchCvBlob } from "../lib/applicationsApi";

/** Chrome/Edge/Firefox expose the built-in PDF viewer; headless and some embedded browsers do not. */
function hasBrowserPdfViewer(): boolean {
  return typeof navigator !== "undefined" && navigator.pdfViewerEnabled === true;
}

/**
 * The CV the candidate submitted, inside the application page.
 *
 * When the browser has its own PDF viewer the file is shown in an iframe: that keeps the viewer's
 * frame (page navigation, zoom, print, save). Where there is no viewer (headless Chrome, embedded
 * browsers) pdf.js renders the pages into canvases instead, so the CV is never a blank box. No new
 * tab, and no separate download button.
 */
export function CvViewer({ cvUrl, fileName }: { cvUrl: string; fileName?: string | null }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);
  const isPdf = /\.pdf$/i.test(fileName ?? "") || !/\.(docx?|DOCX?)$/.test(fileName ?? "");
  const browserViewer = isPdf && hasBrowserPdfViewer();

  useEffect(() => {
    let alive = true;
    let revoke: (() => void) | null = null;
    setUrl(null);
    setData(null);
    setError(false);
    if (!isPdf) return;

    fetchCvBlob(cvUrl)
      .then(async (blob) => {
        if (!alive) return;
        // The iframe path needs a URL; the pdf.js path needs the bytes.
        const objectUrl = URL.createObjectURL(blob);
        revoke = () => URL.revokeObjectURL(objectUrl);
        setUrl(objectUrl);
        const buffer = await blob.arrayBuffer();
        if (alive) setData(buffer);
      })
      .catch(() => {
        if (alive) setError(true);
      });

    return () => {
      alive = false;
      revoke?.();
    };
  }, [cvUrl, isPdf]);

  if (!isPdf) return <p className="jp-cv-empty">{t("recruiter.applicationDetail.cvNoPreview")}</p>;
  if (error) return <p className="jp-cv-empty">{t("recruiter.applicationDetail.cvFailed")}</p>;
  if (!url || !data) return <SkeletonBlock height={420} label={t("recruiter.applicationDetail.cvLoading")} />;

  return (
    <div className="jp-cv-view">
      {browserViewer ? (
        <iframe
          className="jp-cv-frame"
          src={url}
          title={t("recruiter.applicationDetail.cvFrameTitle")}
        />
      ) : (
        <PdfViewer data={data} />
      )}
    </div>
  );
}
