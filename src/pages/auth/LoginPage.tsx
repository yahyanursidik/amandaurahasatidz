/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * Hallmark · genre: modern-minimal · tone: warm-utilitarian · macrostructure: Photographic
 * enrichment: existing faceless library interior · nav: N9 Edge-aligned minimal · footer: Ft2 Inline rule
 * audience: admin, panitia, dan asatidz · use: masuk cepat ke ruang kerja sesuai peran
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { authProvider } from "@/lib/refine/authProvider";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Library,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { AppFooter } from "@/components/common/AppFooter";
import { ENV } from "@/config/env";

type PortalCode = "admin" | "committee" | "ustadz";

const portalConfig: Record<
  PortalCode,
  {
    name: string;
    eyebrow: string;
    headline: string;
    description: string;
    helper: string;
    defaultEmail: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  admin: {
    name: "Portal Admin",
    eyebrow: "Administrasi sistem",
    headline: "Kendali penuh untuk daurah yang tertata.",
    description: "Kelola event, lembaga, undangan, data asatidz, dan laporan dari satu ruang kerja.",
    helper: "Akses khusus administrator dan pengelola event.",
    defaultEmail: "admin@yts.or.id",
    icon: ShieldCheck,
  },
  committee: {
    name: "Portal Panitia",
    eyebrow: "Operasional lapangan",
    headline: "Pelayanan peserta, cepat dan terukur.",
    description: "Tangani check-in, kehadiran, dan informasi acara tanpa membuka data administrasi yang tidak diperlukan.",
    helper: "Akses khusus panitia yang ditugaskan pada event.",
    defaultEmail: "panitia@yts.or.id",
    icon: ClipboardCheck,
  },
  ustadz: {
    name: "Portal Asatidz",
    eyebrow: "Peserta daurah",
    headline: "Informasi daurah dalam satu ruang pribadi.",
    description: "Akses jadwal, kartu peserta, QR kehadiran, pengumuman, dan riwayat presensi Anda.",
    helper: "Gunakan akun pribadi yang terdaftar sebagai peserta.",
    defaultEmail: "ustadz.demo@yts.or.id",
    icon: BookOpen,
  },
};

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const portal = useMemo<PortalCode>(() => {
    if (location.pathname.endsWith("/committee")) return "committee";
    if (location.pathname.endsWith("/ustadz")) return "ustadz";
    return "admin";
  }, [location.pathname]);
  const config = portalConfig[portal];
  const PortalIcon = config.icon;

  const [email, setEmail] = useState(config.defaultEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);
  const [activationStep, setActivationStep] = useState<"request" | "complete" | "success">("request");
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [previewCode, setPreviewCode] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    setEmail(config.defaultEmail);
    setPassword("");
    setShowPassword(false);
    setCapsLockOn(false);
    setError("");
    setActivationOpen(false);
    setActivationStep("request");
    setActivationError("");
  }, [config.defaultEmail]);

  const readApiError = async (response: Response) => {
    const payload = await response.json().catch(() => ({}));
    return payload.error?.message || "Permintaan akun tidak dapat diproses.";
  };

  const requestActivation = async (event: React.FormEvent) => {
    event.preventDefault();
    setActivationPending(true);
    setActivationError("");
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/auth/password/setup/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, portal }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = await response.json();
      setChallengeToken(payload.data.challengeToken);
      setPreviewCode(payload.data.previewCode || "");
      setActivationStep("complete");
    } catch (activationRequestError) {
      setActivationError(
        activationRequestError instanceof Error
          ? activationRequestError.message
          : "Kode aktivasi gagal dikirim.",
      );
    } finally {
      setActivationPending(false);
    }
  };

  const completeActivation = async (event: React.FormEvent) => {
    event.preventDefault();
    setActivationError("");
    if (newPassword !== confirmPassword) {
      setActivationError("Konfirmasi password tidak sama. Ketik ulang password yang sama.");
      return;
    }
    setActivationPending(true);
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/auth/password/setup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          portal,
          challengeToken,
          otp: activationCode,
          newPassword,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setPassword(newPassword);
      setActivationStep("success");
    } catch (activationCompleteError) {
      setActivationError(
        activationCompleteError instanceof Error
          ? activationCompleteError.message
          : "Password baru gagal disimpan.",
      );
    } finally {
      setActivationPending(false);
    }
  };

  const fillDevelopmentAccount = () => {
    setEmail(config.defaultEmail);
    setPassword("DemoAsatidz2026!");
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsPending(true);
    try {
      const result = await authProvider.login!({ email, password, portal });
      if (result.success) {
        const destination =
          result.redirectTo ||
          (portal === "committee" ? "/committee" : portal === "ustadz" ? "/portal" : "/admin");
        // A hard replace starts the protected workspace with a fresh Refine
        // authentication cache. SPA navigation can otherwise reuse the
        // anonymous result cached while the login page was open.
        window.location.replace(destination);
        return;
      }
      setError(result.error?.message || "Email atau password tidak sesuai.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login tidak dapat diproses.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="login-portal" data-portal={portal}>
      <a
        href="#login-form"
        className="login-skip-link"
      >
        Lewati ke formulir masuk
      </a>

      <header className="login-nav">
        <div className="login-nav__inner">
          <Link
            to="/"
            className="login-brand"
            aria-label="Aman Daurah Asatidz, kembali ke beranda"
          >
            <span className="login-brand__mark">ADA</span>
            <span className="login-brand__copy">
              <strong>Aman Daurah Asatidz</strong>
              <span>Sistem pengelolaan daurah</span>
            </span>
          </Link>
          <span className="login-nav__portal">
            <LockKeyhole aria-hidden="true" />
            {config.name}
          </span>
        </div>
      </header>

      <main className="login-stage">
        <figure className="login-visual">
          <img
            src="/images/login-daurah-illustration.webp"
            alt="Interior perpustakaan ilmiah yang tenang dan tertata"
            width={1536}
            height={1024}
            fetchPriority="high"
          />
          <div className="login-visual__shade" aria-hidden="true" />
          <figcaption className="login-visual__caption">
            <span className="login-visual__eyebrow">
              <Library aria-hidden="true" />
              {config.eyebrow}
            </span>
            <strong>{config.headline}</strong>
            <span>{config.description}</span>
          </figcaption>
        </figure>

        <section className="login-panel" aria-labelledby="login-title">
          <div id="login-form" className="login-form">
            <div className="login-form__icon" aria-hidden="true">
              <PortalIcon />
            </div>
            <div className="login-form__intro">
              <p>{config.eyebrow}</p>
              <h1 id="login-title">
                Masuk ke {config.name}
              </h1>
              <span>{config.helper}</span>
            </div>

            <form onSubmit={handleSubmit} className="login-form__fields" aria-busy={isPending}>
              <div className="login-field">
                <label htmlFor={`${portal}-email`}>
                  Alamat email
                </label>
                <div className="login-field__control">
                  <Mail aria-hidden="true" />
                  <input
                    id={`${portal}-email`}
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@lembaga.id"
                    disabled={isPending}
                    aria-invalid={Boolean(error)}
                  />
                </div>
                <p className="login-field__hint login-field__hint--reserved" aria-hidden="true">
                  Gunakan email akun yang terdaftar.
                </p>
              </div>

              <div className="login-field">
                <div className="login-field__label-row">
                  <label htmlFor={`${portal}-password`}>
                    Password
                  </label>
                  <span>Minimal 8 karakter</span>
                </div>
                <div className="login-field__control">
                  <KeyRound aria-hidden="true" />
                  <input
                    id={`${portal}-password`}
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyUp={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
                    onBlur={() => setCapsLockOn(false)}
                    placeholder="Masukkan password"
                    disabled={isPending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={capsLockOn ? `${portal}-caps-lock` : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    aria-pressed={showPassword}
                    className="login-field__toggle"
                    disabled={isPending}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
                <p
                  id={`${portal}-caps-lock`}
                  className="login-field__hint"
                  data-visible={capsLockOn}
                  role="status"
                >
                  Caps Lock sedang aktif.
                </p>
              </div>

              {error && (
                <div role="alert" className="login-alert">
                  <Info aria-hidden="true" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={Boolean(isPending)}
                className="login-submit"
              >
                {isPending ? (
                  <>
                    <Loader2 className="login-spinner" aria-hidden="true" />
                    Memverifikasi akun…
                  </>
                ) : (
                  <>
                    Masuk {config.name.replace("Portal ", "")}
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div className="login-activation">
              <button
                type="button"
                className="login-activation__toggle"
                aria-expanded={activationOpen}
                aria-controls={`${portal}-activation-panel`}
                onClick={() => {
                  setActivationOpen((current) => !current);
                  setActivationError("");
                }}
              >
                {activationOpen ? "Tutup aktivasi akun" : "Aktivasi atau atur ulang password"}
              </button>

              {activationOpen && (
                <section id={`${portal}-activation-panel`} className="login-activation__panel" aria-live="polite">
                  {activationStep === "request" && (
                    <form onSubmit={requestActivation} className="login-activation__form">
                      <div>
                        <strong>Aktivasi akun</strong>
                        <p>Kode 6 digit akan dikirim ke email akun yang terdaftar pada portal ini.</p>
                      </div>
                      <button type="submit" disabled={activationPending} className="login-activation__action">
                        {activationPending ? <Loader2 className="login-spinner" aria-hidden="true" /> : <Mail aria-hidden="true" />}
                        {activationPending ? "Mengirim kode…" : "Kirim kode aktivasi"}
                      </button>
                    </form>
                  )}

                  {activationStep === "complete" && (
                    <form onSubmit={completeActivation} className="login-activation__form">
                      <div>
                        <strong>Buat password baru</strong>
                        <p>Kode berlaku 10 menit. Password minimal 10 karakter, memakai huruf besar, huruf kecil, dan angka.</p>
                      </div>
                      {previewCode && (
                        <p className="login-activation__preview">
                          Mode development · kode lokal <strong>{previewCode}</strong>
                        </p>
                      )}
                      <label className="login-activation__field">
                        <span>Kode aktivasi</span>
                        <input
                          value={activationCode}
                          onChange={(event) => setActivationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          required
                          disabled={activationPending}
                        />
                      </label>
                      <label className="login-activation__field">
                        <span>Password baru</span>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          autoComplete="new-password"
                          minLength={10}
                          required
                          disabled={activationPending}
                        />
                      </label>
                      <label className="login-activation__field">
                        <span>Ulangi password baru</span>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          autoComplete="new-password"
                          minLength={10}
                          required
                          disabled={activationPending}
                        />
                      </label>
                      <button type="submit" disabled={activationPending} className="login-activation__action">
                        {activationPending ? <Loader2 className="login-spinner" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                        {activationPending ? "Menyimpan password…" : "Simpan password baru"}
                      </button>
                    </form>
                  )}

                  {activationStep === "success" && (
                    <div className="login-activation__success">
                      <CheckCircle2 aria-hidden="true" />
                      <div>
                        <strong>Password berhasil disimpan.</strong>
                        <p>Email dan password baru sudah terisi pada formulir masuk.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActivationOpen(false);
                          setActivationStep("request");
                        }}
                      >
                        Kembali masuk
                      </button>
                    </div>
                  )}

                  {activationError && <p role="alert" className="login-activation__error">{activationError}</p>}
                </section>
              )}
            </div>

            <div className="login-form__support">
              <div className="login-form__verified">
                <CheckCircle2 aria-hidden="true" />
                <span>Akses akan diverifikasi berdasarkan peran akun dan jalur portal ini.</span>
              </div>
              {import.meta.env.DEV && (
                <div className="login-demo">
                  <div>
                    <strong>Akun uji lokal</strong>
                    <span>{config.defaultEmail}</span>
                  </div>
                  <button type="button" onClick={fillDevelopmentAccount} disabled={isPending}>
                    Isi akun uji
                  </button>
                </div>
              )}
              <Link
                to="/"
                className="login-back"
              >
                <ArrowLeft aria-hidden="true" />
                Kembali ke beranda
              </Link>
            </div>
          </div>
        </section>
      </main>

      <AppFooter className="login-footer" />
    </div>
  );
};
