import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ENV } from "@/config/env";
import { institutionCities, institutionProvinces } from "@/lib/institutionRegion";
import {
  registrationInstitutionSearchKey,
  REGISTRATION_INSTITUTION_NAME_MAX,
  type RegistrationInstitutionPage,
  type RegistrationInstitutionSuggestion,
} from "@/lib/registrationInstitution";

export type RegistrationInstitutionValue = {
  name: string;
  selected: RegistrationInstitutionSuggestion | null;
  proposal?: { provinceCode: string; cityCode: string };
};

type Lookup = {
  key: string;
  options: RegistrationInstitutionSuggestion[];
  meta: RegistrationInstitutionPage | null;
  failedPage?: number;
};

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
  const pageButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [page, setPage] = useState(1);

  const proposal = value.proposal;
  const search = registrationInstitutionSearchKey(value.name);
  const lookupKey = `${eventSlug}:${search}`;
  const current = lookup?.key === lookupKey ? lookup : null;
  const hasQuery = !!search || !proposal && !value.name.trim();
  const canSearch = open && !disabled && !value.selected && hasQuery;
  const suggestions = current?.options ?? [];
  const failed = current?.failedPage === page;
  const loading = canSearch && !failed && (current?.meta?.page ?? 0) < page;
  const hasMore = !!current?.meta && current.meta.page < current.meta.pageCount;
  const expanded = canSearch && suggestions.length > 0;
  const retrying = loading && !!current && !current.meta;

  useEffect(() => {
    if (!loading) return;
    const controller = new AbortController();
    let timeout: number | undefined;
    const fail = () => setLookup((previous) => ({
      key: lookupKey, failedPage: page,
      options: previous?.key === lookupKey ? previous.options : [],
      meta: previous?.key === lookupKey ? previous.meta : null,
    }));
    const debounce = window.setTimeout(() => {
      timeout = window.setTimeout(() => {
        controller.abort();
        fail();
      }, 8_000);
      const path = `/events/public/${encodeURIComponent(eventSlug)}/registration/institutions`;
      void fetch(`${ENV.API_BASE_URL}${path}?${new URLSearchParams({ search, page: String(page) })}`, {
        signal: controller.signal,
        cache: "no-store",
      }).then(async (response) => {
        if (!response.ok) throw new Error("Institution lookup failed");
        const { data, meta }: { data: RegistrationInstitutionSuggestion[]; meta: RegistrationInstitutionPage } = await response.json();
        if (!Array.isArray(data) || meta?.page !== page) throw new Error("Institution suggestions unavailable");
        if (controller.signal.aborted) return;
        if (page >= meta.pageCount && document.activeElement === pageButtonRef.current) inputRef.current?.focus();
        setLookup((previous) => {
          const options = page > 1 && previous?.key === lookupKey ? previous.options : [];
          const seen = new Set(options.map(({ id }) => id));
          return { key: lookupKey, meta, options: [...options, ...data.filter((option) => !seen.has(option.id))] };
        });
      }).catch(() => {
        if (!controller.signal.aborted) fail();
      }).finally(() => window.clearTimeout(timeout));
    }, search && page === 1 ? 250 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(debounce);
      window.clearTimeout(timeout);
    };
  }, [eventSlug, loading, lookupKey, page, search]);

  useEffect(() => {
    if (!error) return;
    setLookup(null);
    setPage(1);
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
    inputRef.current?.focus();
    close();
    setPage(1);
    onChange({ name: option.name, selected: option });
  };
  const change = (name: string) => {
    if (failed) setLookup(null);
    onChange({ name, selected: null, proposal });
    setPage(1);
    setActiveIndex(-1);
    setOpen(true);
  };
  const toggleProposal = () => {
    onChange(proposal
      ? { name: value.name, selected: null }
      : { name: value.selected ? "" : value.name, selected: null, proposal: { provinceCode: "", cityCode: "" } });
    setPage(1);
    setActiveIndex(-1);
    setOpen(true);
    inputRef.current?.focus();
  };
  const changePage = () => {
    if (loading) return;
    if (failed) {
      setLookup((previous) => previous ? { ...previous, failedPage: undefined } : previous);
    } else if (current?.meta && hasMore) {
      setPage(current.meta.page + 1);
    }
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
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !value.selected && hasQuery) {
      event.preventDefault();
      setOpen(true);
      if (suggestions.length) {
        setActiveIndex((index) => event.key === "ArrowDown" ? (index + 1) % suggestions.length
          : index <= 0 ? suggestions.length - 1 : index - 1);
      }
    }
  };

  let hint = proposal ? "Ketik nama lengkap untuk memeriksa apakah lembaga sudah tercatat."
    : "Buka daftar atau cari dengan nama dan wilayah lembaga.";
  if (value.selected) hint = value.selected.region ? `Lembaga dipilih · ${value.selected.region}` : "Lembaga dipilih dari daftar.";
  else if (failed) hint = "Daftar lembaga belum dapat dimuat. Coba lagi atau isi nama lengkap.";
  else if (loading && !expanded) hint = search ? "Mencari lembaga…" : "Memuat daftar lembaga…";
  else if (expanded && current?.meta) hint = proposal
    ? "Periksa pilihan berikut sebelum mengusulkan lembaga baru."
    : `Menampilkan ${suggestions.length} dari ${current.meta.total} lembaga. Pilih sesuai wilayahnya.`;
  else if (canSearch && current?.meta) hint = "Belum ada lembaga yang cocok.";

  const optionId = (index: number) => `${id}-option-${index}`;
  return (
    <div className="public-register__field" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) close();
    }} onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
      <div className="public-register__institution-label">
        <label htmlFor={id}>{proposal ? "Nama lembaga baru *" : <>Lembaga/komunitas <span>(opsional)</span></>}</label>
        <button className="public-register__institution-action" type="button" disabled={disabled} onClick={toggleProposal}>
          {proposal ? "Kembali ke daftar" : "Tambah lembaga baru"}
        </button>
      </div>
      <div className="public-register__institution-box">
        <div className="public-register__institution-input">
          <input ref={inputRef} id={id} type="text" role="combobox" aria-autocomplete="list" aria-expanded={expanded}
            aria-controls={expanded ? `${id}-suggestions` : undefined}
            aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={error ? true : undefined}
            value={value.name} maxLength={REGISTRATION_INSTITUTION_NAME_MAX} placeholder={proposal ? "Nama lengkap lembaga" : "Pilih atau cari lembaga"}
            required={!!proposal} disabled={disabled} autoComplete="off" onChange={(event) => change(event.target.value)} onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)} onClick={() => setOpen(true)} />
          {value.name && <button className="public-register__institution-action" type="button" disabled={disabled} aria-label="Kosongkan kolom lembaga"
            onClick={() => { change(""); inputRef.current?.focus(); }}>Hapus</button>}
        </div>
        <p id={`${id}-hint`} role="status">{hint}</p>
        {canSearch && (expanded || failed || retrying) && <div className="public-register__institution-panel">
          {expanded && <ul ref={listRef} id={`${id}-suggestions`} role="listbox" aria-label="Saran lembaga"
            className="public-register__institution-options">
            {suggestions.map((option, index) => <li key={option.id} id={optionId(index)} role="option"
              aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
              <strong>{option.name}</strong>
              {option.region && <span>{option.region}</span>}
            </li>)}
          </ul>}
          {(hasMore || failed || retrying) && <button ref={pageButtonRef} type="button" aria-disabled={loading}
            className="public-register__institution-action public-register__institution-more" onClick={changePage}>
            {failed ? "Coba lagi" : loading ? "Memuat…" : "Muat lebih banyak"}
          </button>}
        </div>}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="public-register__institution-error">{error}</p>}
      {proposal && <fieldset className="public-register__institution-proposal" disabled={disabled}>
        <legend>Wilayah lembaga (opsional)</legend>
        <div className="public-register__institution-region">
          <label htmlFor={`${id}-province`}>Provinsi
            <select id={`${id}-province`} value={proposal.provinceCode} onChange={(event) => onChange({
              ...value, proposal: { provinceCode: event.target.value, cityCode: "" },
            })}>
              <option value="">Pilih provinsi</option>
              {institutionProvinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
            </select>
          </label>
          <label htmlFor={`${id}-city`}>Kabupaten/kota
            <select id={`${id}-city`} value={proposal.cityCode} disabled={!proposal.provinceCode} onChange={(event) => onChange({
              ...value, proposal: { ...proposal, cityCode: event.target.value },
            })}>
              <option value="">Pilih kabupaten/kota</option>
              {institutionCities(proposal.provinceCode).map((city) => <option key={city.id} value={city.id}>{city.city}</option>)}
            </select>
          </label>
        </div>
        <p>Panitia akan memeriksa usulan lembaga setelah pendaftaran dikirim.</p>
      </fieldset>}
    </div>
  );
}
