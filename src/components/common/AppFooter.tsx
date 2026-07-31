import React from "react";

type Props = {
  className?: string;
};

export const AppFooter: React.FC<Props> = ({ className = "" }) => (
  <footer className={className}>
    <span>© 2026 Aman Daurah Asatidz</span>
    <span>
      Disusun dan dikembangkan oleh{" "}
      <a
        href="https://yahyanursidik.my.id/"
        target="_blank"
        rel="noreferrer"
        className="font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-900"
      >
        Yahya Nursidik
      </a>
    </span>
  </footer>
);
