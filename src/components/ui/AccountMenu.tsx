import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { isAdmin, isRecruiter, isUser } from "../../lib/roles";
import { fetchMyProfile } from "../../lib/profileApi";
import { queryKeys } from "../../lib/queryClient";
import { safeHttpUrl } from "../../lib/safeUrl";
import { cx } from "./controls";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

type Item = { to: string; label: string };

/**
 * The one account control for every signed-in header: avatar (image or initials), a menu with the
 * destinations that belong to the current role, and sign out. Escape, an outside click and a route
 * change close it; focus always returns to the button.
 */
export function AccountMenu({ onNavy = false }: { onNavy?: boolean }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const [imageFailed, setImageFailed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const profile = useQuery({
    queryKey: queryKeys.profile(user?.id ?? ""),
    queryFn: () => fetchMyProfile(user!.id, user!.fullName),
    enabled: !!user,
    staleTime: 60_000,
  });

  // A route change closes the menu without an effect.
  if (pathname !== openedAt) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (!user) return null;

  const name = user.fullName || user.email;
  const avatar = imageFailed ? null : safeHttpUrl(profile.data?.avatarUrl);
  const items: Item[] = [{ to: "/profile", label: t("accountMenu.profile") }];
  if (isUser(user.role)) items.push({ to: "/applications", label: t("accountMenu.applications") });
  if (isRecruiter(user.role)) items.push({ to: "/recruiter/company", label: t("accountMenu.company") });
  if (isAdmin(user.role)) items.push({ to: "/admin", label: t("accountMenu.admin") });

  async function signOut() {
    setOpen(false);
    await logout();
    nav("/login");
  }

  return (
    <div className={cx("jp-account", onNavy && "on-navy")} ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="jp-avatar-btn"
        aria-label={t("accountMenu.trigger", { name })}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {avatar ? (
          <img
            className="jp-avatar-img"
            src={avatar}
            alt=""
            onError={() => setImageFailed(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="jp-avatar-initials" aria-hidden="true">
            {initials(name)}
          </span>
        )}
      </button>

      {open && (
        <div className="jp-account-menu" id={menuId} role="menu" aria-label={t("accountMenu.label")}>
          <div className="jp-account-who">
            <strong>{name}</strong>
            <span>{user.email}</span>
          </div>
          {items.map((item) => (
            <Link key={item.to} to={item.to} role="menuitem" className="jp-account-item" onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <button type="button" role="menuitem" className="jp-account-item jp-account-signout" onClick={signOut}>
            {t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
