import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ENV } from "@/config/env";
import {
  hasRegistrationInstitutionSearchTerm,
  registrationInstitutionSearchKey,
  REGISTRATION_INSTITUTION_NAME_MAX,
  REGISTRATION_INSTITUTION_SEARCH_MIN,
  type RegistrationInstitutionSuggestion,
} from "@/lib/registrationInstitution";

export type RegistrationInstitutionValue = {
  name: string;
  selected: RegistrationInstitutionSuggestion | null;
};

type Lookup =
  | { key: string; status: "ready"; options: RegistrationInstitutionSuggestion[] }
  | { key: string; status: "failed" };

type Props = {
  id: string;
  eventSlug: string;
  value: RegistrationInstitutionValue;
  onChange: (value: RegistrationInstitutionValue) => void;
  disabled: boolean;
  error: string;
};

export function RegistrationInstitutionField({ id, eventSlug, value, onChange, disabled, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lookup, setLookup] = useState<Lookup | null>(null);

  const search = registrationInstitutionSearchKey(value.name);
  const lookupKey = `${eventSlug}:${search}`;
  const current = lookup?.key === lookupKey ? lookup : null;
  const canSearch = open && !disabled && !value.selected && hasRegistrationInstitutionSearchTerm(search);
  const suggestions = current?.status === "ready" ? current.options : [];
  const expanded = canSearch && suggestions.length > 0;

  useEffect(() => {
    if (!canSearch || current) return;
    const controller = new AbortController();
    let timeout: number | undefined;
    const debounce = window.setTimeout(() => {
      timeout = window.setTimeout(() => {
        controller.abort();
        setLookup({ key: lookupKey, status: "failed" });
      }, 8_000);
      const path = `/events/public/${encodeURIComponent(eventSlug)}/registration/institutions`;
      void fetch(`${ENV.API_BASE_URL}${path}?${new URLSearchParams({ search })}`, {
        signal: controller.signal,
        cache: "no-store",
      }).then(async (response) => {
        if (!response.ok) throw new Error("Institution lookup failed");
        const { data } = await response.json();
        if (!Array.isArray(data)) throw new Error("Institution suggestions unavailable");
        if (!controller.signal.aborted) setLookup({ key: lookupKey, status: "ready", options: data });
      }).catch(() => {
        if (!controller.signal.aborted) setLookup({ key: lookupKey, status: "failed" });
      }).finally(() => window.clearTimeout(timeout));
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(debounce);
      window.clearTimeout(timeout);
    };
  }, [canSearch, current, eventSlug, lookupKey, search]);

  useEffect(() => {
    if (!error) return;
    setLookup(null);
    setActiveIndex(-1);
    setOpen(true);
    inputRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (expanded && activeIndex >= 0) listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [expanded, activeIndex]);

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };
  const choose = (option: RegistrationInstitutionSuggestion) => {
    close();
    onChange({ name: option.name, selected: option });
  };
  const change = (name: string) => {
    if (current?.status === "failed") setLookup(null);
    onChange({ name, selected: null });
    setActiveIndex(-1);
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = expanded ? suggestions[activeIndex] : undefined;
      if (option) choose(option);
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !value.selected && hasRegistrationInstitutionSearchTerm(search)) {
      event.preventDefault();
      setOpen(true);
      if (suggestions.length) {
        setActiveIndex((index) => event.key === "ArrowDown" ? (index + 1) % suggestions.length
          : index <= 0 ? suggestions.length - 1 : index - 1);
      } else if (current?.status === "failed") setLookup(null);
    }
  };

  let hint = `Ketik sedikitnya ${REGISTRATION_INSTITUTION_SEARCH_MIN} huruf atau angka. Jika lembaga belum muncul, isi nama lengkapnya.`;
  if (value.selected) hint = value.selected.region ? `Lembaga dipilih · ${value.selected.region}` : "Lembaga dipilih dari daftar.";
  else if (current?.status === "failed") hint = "Saran sedang tidak tersedia. Anda bisa tetap mengisi nama lengkap.";
  else if (canSearch && !current) hint = "Mencari lembaga…";
  else if (canSearch) hint = expanded
    ? `${suggestions.length} saran. Pilih lembaga sesuai wilayahnya.`
    : "Belum ada saran yang cocok. Isi nama lengkap lembaga Anda.";

  const optionId = (index: number) => `${id}-option-${index}`;
  return (
    <div className="public-register__field">
      <label htmlFor={id}>Lembaga/komunitas <span>(opsional)</span></label>
      <div className="public-register__institution-box">
        <div className="public-register__institution-input">
          <input ref={inputRef} id={id} type="text" role="combobox" aria-autocomplete="list" aria-expanded={expanded}
            aria-controls={expanded ? `${id}-suggestions` : undefined}
            aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={error ? true : undefined}
            value={value.name} maxLength={REGISTRATION_INSTITUTION_NAME_MAX} placeholder="Cari nama lembaga"
            disabled={disabled} autoComplete="off" onChange={(event) => change(event.target.value)} onKeyDown={onKeyDown}
            onFocus={() => { if (current?.status === "failed") setLookup(null); setOpen(true); }} onBlur={close} />
          {value.name && <button type="button" disabled={disabled} aria-label="Kosongkan kolom lembaga"
            onClick={() => { change(""); inputRef.current?.focus(); }}>Hapus</button>}
        </div>
        {expanded && <ul ref={listRef} id={`${id}-suggestions`} role="listbox" aria-label="Saran lembaga"
          className="public-register__institution-options">
          {suggestions.map((option, index) => <li key={option.id} id={optionId(index)} role="option"
            aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
            <strong>{option.name}</strong>
            {option.region && <span>{option.region}</span>}
          </li>)}
        </ul>}
      </div>
      <p id={`${id}-hint`} role="status">{hint}</p>
      {error && <p id={`${id}-error`} role="alert" className="public-register__institution-error">{error}</p>}
    </div>
  );
}
