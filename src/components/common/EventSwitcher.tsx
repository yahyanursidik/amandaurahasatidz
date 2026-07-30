import React, { useState } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";

export interface EventSwitcherProps {
  onEventChange?: (eventId: string) => void;
}

export const EventSwitcher: React.FC<EventSwitcherProps> = ({ onEventChange }) => {
  const [selectedEventId, setSelectedEventId] = useState("event-1");
  const [isOpen, setIsOpen] = useState(false);

  const mockEvents = [
    { id: "event-1", name: "Daurah Asatidz Nasional 2026 - Bandung", code: "DAURAH-2026-BDG", status: "ONGOING" },
    { id: "event-2", name: "Daurah Syariah Regional 2026 - Surabaya", code: "DAURAH-2026-SUB", status: "REGISTRATION_OPEN" },
  ];

  const currentEvent = mockEvents.find((e) => e.id === selectedEventId) || mockEvents[0];

  const handleSelect = (id: string) => {
    setSelectedEventId(id);
    setIsOpen(false);
    if (onEventChange) onEventChange(id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition min-h-[44px] sm:min-h-[auto]"
      >
        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
        <div className="text-left">
          <span className="block font-bold text-[11px] truncate max-w-[150px] sm:max-w-[200px]">{currentEvent.name}</span>
          <span className="block text-[9px] text-slate-400 font-mono">{currentEvent.code}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-2 space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-2 py-1 block">
            Pilih Event Daurah Aktif
          </span>
          {mockEvents.map((ev) => (
            <button
              key={ev.id}
              onClick={() => handleSelect(ev.id)}
              className={`w-full text-left p-2 rounded-lg flex items-center justify-between text-xs transition ${
                ev.id === selectedEventId ? "bg-emerald-950 text-emerald-300 font-bold" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <div>
                <span className="block font-semibold">{ev.name}</span>
                <span className="block text-[10px] text-slate-400 font-mono">{ev.code}</span>
              </div>
              {ev.id === selectedEventId && <Check className="w-4 h-4 text-emerald-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
