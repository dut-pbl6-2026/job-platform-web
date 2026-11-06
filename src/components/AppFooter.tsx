import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { categoryLabel } from "../lib/labels";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

// Labels come from lib/labels.ts, the single source for category names.
const CATEGORY_LINKS = ["IT", "Sales", "Marketing", "Finance", "Engineering", "Education"].map((value) => ({
  label: categoryLabel(value),
  value,
}));

const LOCATION_LINKS = [
  { label: "Việc làm tại Hà Nội", value: "Hà Nội" },
  { label: "Việc làm tại TP. Hồ Chí Minh", value: "Hồ Chí Minh" },
  { label: "Việc làm tại Đà Nẵng", value: "Đà Nẵng" },
  { label: "Việc làm Miền Bắc", value: "Miền Bắc" },
  { label: "Việc làm Miền Nam", value: "Miền Nam" },
];

export function AppFooter() {
  const { pathname } = useLocation();
  const { isAuthenticated, user } = useAuth();
  if (AUTH_PATHS.includes(pathname)) return null;

  return (
    <footer className="jp-footer on-navy">
      <div className="jp-footer-inner">
        <div className="jp-footer-brand">
          <Link to="/jobs" className="jp-footer-wordmark">jobplatform</Link>
          <p>Nền tảng kết nối người tìm việc và nhà tuyển dụng: tìm việc theo kỹ năng, mức lương, địa điểm và theo dõi đơn ứng tuyển.</p>
        </div>

        <nav className="jp-footer-col" aria-label="Dành cho ứng viên">
          <h2 className="jp-footer-title">Dành cho ứng viên</h2>
          <Link to="/jobs">Việc làm mới nhất</Link>
          <Link to={isAuthenticated ? "/profile" : "/register"}>Hồ sơ &amp; CV</Link>
          {(!isAuthenticated || isUser(user?.role)) && <Link to="/applications">Đơn ứng tuyển của tôi</Link>}
          {isAuthenticated && <Link to="/chat">Trợ lý AI</Link>}
          {!isAuthenticated && <Link to="/login">Đăng nhập</Link>}
          {!isAuthenticated && <Link to="/register">Đăng ký tài khoản</Link>}
        </nav>

        <nav className="jp-footer-col" aria-label="Việc làm theo ngành nghề">
          <h2 className="jp-footer-title">Việc làm theo ngành nghề</h2>
          {CATEGORY_LINKS.map((c) => (
            <Link key={c.value} to={`/jobs?category=${encodeURIComponent(c.value)}`}>{c.label}</Link>
          ))}
        </nav>

        <nav className="jp-footer-col" aria-label="Việc làm theo địa điểm">
          <h2 className="jp-footer-title">Việc làm theo địa điểm</h2>
          {LOCATION_LINKS.map((l) => (
            <Link key={l.value} to={`/jobs?location=${encodeURIComponent(l.value)}`}>{l.label}</Link>
          ))}
        </nav>
      </div>

      <div className="jp-footer-bottom">
        <span>© {new Date().getFullYear()} Job Platform · Đồ án PBL6</span>
      </div>
    </footer>
  );
}
