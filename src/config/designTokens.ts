export const DESIGN_TOKENS = {
  colors: {
    primary: {
      50: "#ecfdf5",
      100: "#d1fae5",
      500: "#10b981",
      600: "#059669",
      700: "#047857",
      800: "#065f46",
      900: "#064e3b",
      950: "#022c22",
    },
    neutral: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
    status: {
      success: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
      warning: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
      danger: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
      info: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
      neutral: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
    },
  },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    sizes: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
    },
  },
  touchTarget: {
    minHeight: "44px",
    minWidth: "44px",
  },
};
