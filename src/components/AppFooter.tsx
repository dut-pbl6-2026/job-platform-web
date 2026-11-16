import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { categoryLabel } from "../lib/labels";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

// Category names come from lib/labels.ts, the single source for category names.
const CATEGORY_VALUES = ["IT", "Sales", "Marketing", "Finance", "Engineering", "Education"] as const;

// `value` is the search filter sent in the URL; only `labelKey` is display copy.
const LOCATION_LINKS = [
  { labelKey: "footer.jobsInHanoi", value: "Hà Nội" },
  { labelKey: "footer.jobsInHcmc", value: "Hồ Chí Minh" },
  { labelKey: "footer.jobsInDanang", value: "Đà Nẵng" },
  { labelKey: "footer.jobsNorth", value: "Miền Bắc" },
  { labelKey: "footer.jobsSouth", value: "Miền Nam" },
] as const;

export function AppFooter() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { isAuthenticated, user } = useAuth();
  if (AUTH_PATHS.includes(pathname)) return null;

  return (
    <footer className="jp-footer on-navy">
      <div className="jp-footer-inner">
        <div className="jp-footer-brand">
          <Link to="/" className="jp-footer-wordmark">
            jobplatform
          </Link>
          <p>{t("footer.about")}</p>
        </div>

        <nav className="jp-footer-col" aria-label={t("footer.forCandidates")}>
          <h2 className="jp-footer-title">{t("footer.forCandidates")}</h2>
          <Link to="/jobs">{t("footer.latestJobs")}</Link>
          {(!isAuthenticated || isUser(user?.role)) && <Link to="/applications">{t("footer.myApplications")}</Link>}
          {!isAuthenticated && <Link to="/login">{t("footer.login")}</Link>}
          {!isAuthenticated && <Link to="/register">{t("footer.register")}</Link>}
        </nav>

        <nav className="jp-footer-col" aria-label={t("footer.byCategory")}>
          <h2 className="jp-footer-title">{t("footer.byCategory")}</h2>
          {CATEGORY_VALUES.map((value) => (
            <Link key={value} to={`/jobs?category=${encodeURIComponent(value)}`}>
              {categoryLabel(value)}
            </Link>
          ))}
        </nav>

        <nav className="jp-footer-col" aria-label={t("footer.byLocation")}>
          <h2 className="jp-footer-title">{t("footer.byLocation")}</h2>
          {LOCATION_LINKS.map((l) => (
            <Link key={l.value} to={`/jobs?location=${encodeURIComponent(l.value)}`}>
              {t(l.labelKey)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="jp-footer-bottom">
        <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
      </div>
    </footer>
  );
}
