import { useTranslation } from "react-i18next";
import { ButtonLink, EmptyState } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/** Public 404: friendly, with the two ways back that a visitor actually needs. */
export default function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("notFound.title"));
  return (
    <main className="jp-page jp-page--narrow">
      <EmptyState
        title={t("notFound.title")}
        action={
          <>
            <ButtonLink to="/jobs">{t("notFound.browseJobs")}</ButtonLink>
            <ButtonLink to="/" variant="secondary">
              {t("notFound.home")}
            </ButtonLink>
          </>
        }
      >
        {t("notFound.text")}
      </EmptyState>
    </main>
  );
}
