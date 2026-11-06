import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Icon, Spinner, cx } from "./ui";
import { fetchCompanies, type CompanyOption } from "../lib/jobsApi";
import { loadErrorMessage } from "../lib/http";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/**
 * Pick a company by name (ARIA 1.2 combobox). The recruiter sign-up needs a company, but a person
 * knows a name, not a UUID: the id never reaches the screen. Typing 2+ characters searches
 * job-svc; ↑/↓ move, Enter picks, Esc closes. Once picked, the field becomes the company's
 * name with a "Đổi" button.
 */
export function CompanyPicker({ id, label, value, onChange, error }: {
  id: string;
  label: string;
  value: CompanyOption | null;
  onChange: (company: CompanyOption | null) => void;
  error?: string | null;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocus = useRef(false);

  // Search only once typing pauses, and only for a term long enough to mean something.
  useEffect(() => {
    const trimmed = text.trim();
    const t = window.setTimeout(() => setTerm(trimmed.length >= MIN_CHARS ? trimmed : ""), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [text]);

  const search = useQuery({
    queryKey: ["companies", term],
    queryFn: () => fetchCompanies(term),
    enabled: term.length >= MIN_CHARS,
    staleTime: 60_000,
  });
  const options = search.data ?? [];
  const waiting = text.trim().length >= MIN_CHARS && (text.trim() !== term || search.isFetching);
  const hasList = open && !waiting && options.length > 0;

  // "Đổi" removes the selection and puts the caret back in the search box.
  useEffect(() => {
    if (!value && refocus.current) {
      refocus.current = false;
      inputRef.current?.focus();
    }
  }, [value]);

  function pick(company: CompanyOption) {
    onChange(company);
    setText("");
    setTerm("");
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + options.length) % options.length);
    } else if (e.key === "Enter" && hasList) {
      // Picking from the list must not submit the form behind it.
      e.preventDefault();
      pick(options[active >= 0 ? active : 0]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  const errorId = error ? `${id}-error` : undefined;

  if (value) {
    return (
      <div className="jp-field">
        <span className="jp-label" id={`${id}-label`}>{label}</span>
        <div className="jp-company-picked" role="group" aria-labelledby={`${id}-label`}>
          <Icon name="checkCircle" size={20} />
          <div className="jp-company-picked-text">
            <strong>{value.name}</strong>
            {(value.industry || value.address) && <span>{[value.industry, value.address].filter(Boolean).join(" · ")}</span>}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              refocus.current = true;
              onChange(null);
            }}
          >
            Đổi
            <span className="jp-sr"> công ty</span>
          </Button>
        </div>
      </div>
    );
  }

  const showStatus = open && text.trim().length >= MIN_CHARS && !hasList;
  return (
    <div className="jp-field jp-company">
      <label className="jp-label" htmlFor={id}>
        {label}
        <span className="jp-req" aria-hidden="true"> *</span>
      </label>
      <div className="jp-company-box">
      <input
        ref={inputRef}
        id={id}
        className="jp-input"
        role="combobox"
        aria-expanded={hasList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={hasList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={[`${id}-hint`, errorId].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-required="true"
        autoComplete="off"
        spellCheck={false}
        placeholder="Gõ tên công ty"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label="Công ty tìm thấy" className="jp-company-list" hidden={!hasList}>
        {options.map((company, i) => (
          <li
            key={company.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={cx("jp-company-option", i === active && "is-active")}
            // Keep focus in the input: a blur here would close the list before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(company)}
          >
            <strong>{company.name}</strong>
            {(company.industry || company.address) && <span>{[company.industry, company.address].filter(Boolean).join(" · ")}</span>}
          </li>
        ))}
      </ul>
      </div>
      <p id={`${id}-hint`} className="jp-hint">Gõ ít nhất {MIN_CHARS} ký tự, rồi chọn công ty trong danh sách.</p>

      {/* Always mounted, so screen readers announce the text when it changes. */}
      <div className={showStatus ? "jp-company-status" : undefined} role="status">
        {showStatus &&
          (waiting ? (
            <>
              <Spinner />
              Đang tìm công ty…
            </>
          ) : search.isError ? (
            <>
              <span>{loadErrorMessage(search.error, "danh sách công ty")}</span>
              <Button variant="secondary" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => void search.refetch()}>
                Thử lại
              </Button>
            </>
          ) : (
            <span>Chưa thấy công ty? Liên hệ quản trị viên.</span>
          ))}
      </div>

      {error && (
        <p id={errorId} className="jp-error" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}
