import React from "react";
import { AlertCircle, Check, Loader2, MessageCircle } from "lucide-react";

const states = [
  { label: "Default", className: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: MessageCircle },
  { label: "Hover", className: "border-emerald-300 bg-emerald-100 text-emerald-950 -translate-y-px", icon: MessageCircle },
  { label: "Focus", className: "border-emerald-200 bg-emerald-50 text-emerald-900 outline outline-2 outline-offset-2 outline-slate-900", icon: MessageCircle },
  { label: "Pressed", className: "border-emerald-300 bg-emerald-200 text-emerald-950 translate-y-px", icon: MessageCircle },
  { label: "Disabled", className: "border-slate-200 bg-slate-100 text-slate-500 opacity-50", icon: MessageCircle },
  { label: "Loading", className: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: Loader2 },
  { label: "Error", className: "border-rose-300 bg-rose-50 text-rose-950", icon: AlertCircle },
  { label: "Success", className: "border-emerald-300 bg-emerald-50 text-emerald-950", icon: Check },
] as const;

export const ParticipantCommunicationPanelPreview: React.FC = () => (
  <section className="grid gap-4 rounded-2xl bg-white p-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="State preview tombol komunikasi peserta">
    {states.map((state) => (
      <div key={state.label} className="space-y-2">
        <p className="text-sm font-bold text-slate-700">{state.label}</p>
        <button
          type="button"
          disabled={state.label === "Disabled"}
          className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-bold ${state.className}`}
        >
          <state.icon className={`h-4 w-4 ${state.label === "Loading" ? "animate-spin" : ""}`} />
          {state.label === "Loading" ? "Memuat…" : state.label === "Success" ? "Pesan disalin" : "Hubungi"}
        </button>
      </div>
    ))}
  </section>
);
