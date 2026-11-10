import React, { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { AppFooter } from "@/components/common/AppFooter";

interface PublicLayoutProps {
  children: React.ReactNode;
  wide?: boolean;
  kiosk?: boolean;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, wide = false, kiosk = false }) => {
  const location = useLocation();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (mobileMenu.current) mobileMenu.current.open = false; }, [location.pathname]);
  const closeMenu = () => { if (mobileMenu.current) mobileMenu.current.open = false; };
  const navClass = ({ isActive }: { isActive: boolean }) => isActive ? "public-site__nav-link public-site__nav-link--active" : "public-site__nav-link";
  const inProgramFlow = /^\/(events|invitation|check-in|card|confirm)(\/|$)/.test(location.pathname);
  const programNavClass = ({ isActive }: { isActive: boolean }) => navClass({ isActive: isActive || inProgramFlow });

  return (
    <div className="public-site">
      <a className="public-site__skip" href="#konten-utama">Lewati ke konten</a>
      <header className="public-site__header">
        <div className={`public-site__bar ${wide ? "public-site__bar--wide" : ""}`}>
          <Link to="/" className="public-site__brand" aria-label="Yayasan Tarbiyah Sunnah — Aman Daurah Asatidz, halaman utama">
            <img src="/images/tarbiyah-sunnah-logo.svg" alt="" width="148" height="42" />
            <span>Aman Daurah<br />Asatidz</span>
          </Link>
          {!kiosk && <nav aria-label="Navigasi publik" className="public-site__nav">
            <NavLink end to="/" className={navClass}>Yayasan</NavLink>
            <NavLink to="/programs" className={programNavClass}>Daurah</NavLink>
            <NavLink to="/ruang-asatidz" className={navClass}>Ruang Asatidz</NavLink>
          </nav>}
          {!kiosk && <Link to="/login/ustadz" className="public-site__portal" aria-label="Masuk ke Portal Asatidz">Masuk portal</Link>}
          {!kiosk && <details ref={mobileMenu} className="public-site__mobile">
            <summary><Menu aria-hidden="true" /> Menu</summary>
            <nav aria-label="Navigasi publik seluler">
              <NavLink end to="/" className={navClass} onClick={closeMenu}>Yayasan</NavLink>
              <NavLink to="/programs" className={programNavClass} onClick={closeMenu}>Daurah</NavLink>
              <NavLink to="/ruang-asatidz" className={navClass} onClick={closeMenu}>Ruang Asatidz</NavLink>
              <Link to="/login/ustadz" className="public-site__portal" onClick={closeMenu}>Masuk portal</Link>
            </nav>
          </details>}
        </div>
      </header>

      <main id="konten-utama" className={`public-site__main ${wide ? "public-site__main--wide" : ""}`}>
        {children}
      </main>

      {!kiosk && <div className="public-site__footer">
        <div className="public-site__footer-inner">
          <div><strong>Aman Daurah Asatidz</strong><p>Layanan program daurah Yayasan Tarbiyah Sunnah.</p></div>
          <nav aria-label="Tautan penutup"><Link to="/">Yayasan</Link><Link to="/programs">Riwayat Daurah</Link><Link to="/ruang-asatidz">Ruang Asatidz</Link><a href="https://tarbiyahsunnah.com/tentang-kami/" target="_blank" rel="noopener noreferrer">Profil resmi YTS</a></nav>
        </div>
        <AppFooter className="public-site__credits" />
      </div>}
    </div>
  );
};
