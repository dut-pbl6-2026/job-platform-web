import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Renders a PDF with pdf.js into plain canvases inside the page.
 *
 * The browser's own viewer is not available everywhere (headless Chrome, PDF plugins disabled, some
 * embedded browsers), where an <object>/<iframe> shows nothing or its fallback. Rendering here keeps
 * the CV readable in every browser, still inside the page and without a new tab. pdf.js is loaded
 * lazily: the chunk is only fetched when a recruiter opens an application with a PDF CV.
 */
export function PdfViewer({ data }: { data: ArrayBuffer }) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pdf: { destroy: () => Promise<void> } | null = null;
    setFailed(false);
    setReady(false);
    host.current?.replaceChildren();

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      const pdfDocument = await pdfjs.getDocument({ data: data.slice(0) }).promise;
      pdf = pdfDocument;
      for (let index = 1; index <= pdfDocument.numPages; index += 1) {
        const page = await pdfDocument.getPage(index);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.className = "jp-cv-page";
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas 2d context is unavailable");
        await page.render({ canvasContext: context, viewport }).promise;
        if (cancelled) return;
        host.current?.appendChild(canvas);
      }
      if (!cancelled) setReady(true);
    })().catch((error: unknown) => {
      // Keep the reason in the console: a viewer that silently disappears is hard to diagnose.
      console.error("PDF render failed:", error);
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      void pdf?.destroy();
    };
  }, [data]);

  if (failed) return <p className="jp-cv-empty">{t("recruiter.applicationDetail.cvNoPreview")}</p>;

  return (
    <div className="jp-cv-pages" ref={host} aria-busy={!ready}>
      <span className="jp-sr-only">
        {ready ? t("recruiter.applicationDetail.cvReady") : t("recruiter.applicationDetail.cvLoading")}
      </span>
    </div>
  );
}
