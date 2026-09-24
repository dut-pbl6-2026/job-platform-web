import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

const CATEGORY_LINKS = [
  { label: "Công nghệ Thông tin", value: "IT" },
  { label: "Kinh doanh/Bán hàng", value: "Sales" },
  { label: "Marketing/PR/Quảng cáo", value: "Marketing" },
  { label: "Tài chính/Ngân hàng", value: "Finance" },
  { label: "Kỹ thuật/Sản xuất", value: "Engineering" },
  { label: "Giáo dục/Đào tạo", value: "Education" },
];

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
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link to="/jobs" className="site-footer-wordmark">jobplatform</Link>
          <p>Nền tảng kết nối người tìm việc và nhà tuyển dụng: tìm việc theo kỹ năng, mức lương, địa điểm và theo dõi đơn ứng tuyển.</p>
        </div>

        <nav className="site-footer-col" aria-label="Dành cho ứng viên">
          <h4>Dành cho ứng viên</h4>
          <Link to="/jobs">Việc làm mới nhất</Link>
          <Link to={isAuthenticated ? "/profile" : "/register"}>Hồ sơ &amp; CV</Link>
          {(!isAuthenticated || isUser(user?.role)) && <Link to="/applications">Đơn ứng tuyển của tôi</Link>}
          {!isAuthenticated && <Link to="/login">Đăng nhập</Link>}
          {!isAuthenticated && <Link to="/register">Đăng ký tài khoản</Link>}
        </nav>

        <nav className="site-footer-col" aria-label="Việc làm theo ngành nghề">
          <h4>Việc làm theo ngành nghề</h4>
          {CATEGORY_LINKS.map((c) => (
            <Link key={c.value} to={`/jobs?category=${encodeURIComponent(c.value)}`}>{c.label}</Link>
          ))}
        </nav>

        <nav className="site-footer-col" aria-label="Việc làm theo địa điểm">
          <h4>Việc làm theo địa điểm</h4>
          {LOCATION_LINKS.map((l) => (
            <Link key={l.value} to={`/jobs?location=${encodeURIComponent(l.value)}`}>{l.label}</Link>
          ))}
        </nav>
      </div>

      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Job Platform · Đồ án PBL6</span>
      </div>
    </footer>
  );
}
