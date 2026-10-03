import { useEffect, useRef, useState } from "react";
import { MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import type { UkhuwahLocation } from "@/lib/ukhuwah";

const TILE = 256;
const MAX_LATITUDE = 85.05112878;
export function hasMapCoordinates(location: Pick<UkhuwahLocation, "latitude" | "longitude">) {
  return location.latitude != null && location.longitude != null && Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) && Math.abs(location.latitude) <= MAX_LATITUDE && Math.abs(location.longitude) <= 180;
}
export function projectCoordinate(latitude: number, longitude: number, zoom: number) {
  const sin = Math.sin(Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)) * Math.PI / 180);
  const size = TILE * 2 ** zoom;
  return { x: (longitude + 180) / 360 * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}
export function unprojectCoordinate(x: number, y: number, zoom: number) {
  const size = TILE * 2 ** zoom;
  return { latitude: Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI)),
    longitude: ((x / size * 360) % 360 + 360) % 360 - 180 };
}
const control = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50";
/** No third-party JS or geocoder. Only currently visible tiles are requested after user consent. */
export function UkhuwahMap({ locations, selectedId, onSelect, onPick }: {
  locations: UkhuwahLocation[]; selectedId?: string | null; onSelect: (location: UkhuwahLocation) => void;
  onPick?: (latitude: number, longitude: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; centerX: number; centerY: number; moved: boolean } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(11);
  const [center, setCenter] = useState({ latitude: -6.91, longitude: 107.61 });
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [tileView, setTileView] = useState({ center, zoom, size });
  // Wait until a pan/resize settles instead of downloading new tiles for every pointer event.
  useEffect(() => {
    if (!enabled) return;
    const timeout = window.setTimeout(() => setTileView({ center, zoom, size }), 160);
    return () => window.clearTimeout(timeout);
  }, [center, zoom, size, enabled]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => setSize({ width: Math.max(1, element.clientWidth), height: Math.max(1, element.clientHeight) });
    resize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const selected = locations.find((location) => location.id === selectedId);
    if (selected && hasMapCoordinates(selected)) setCenter({ latitude: selected.latitude!, longitude: selected.longitude! });
  }, [selectedId, locations]);
  const point = projectCoordinate(center.latitude, center.longitude, zoom);
  const left = point.x - size.width / 2, top = point.y - size.height / 2;
  const tilePoint = projectCoordinate(tileView.center.latitude, tileView.center.longitude, tileView.zoom);
  const tileLeft = tilePoint.x - tileView.size.width / 2, tileTop = tilePoint.y - tileView.size.height / 2;
  const tiles: Array<{ x: number; y: number }> = [];
  if (enabled && tileView.zoom === zoom) for (let y = Math.floor(tileTop / TILE); y <= Math.floor((tileTop + tileView.size.height - 1) / TILE); y++) {
    for (let x = Math.floor(tileLeft / TILE); x <= Math.floor((tileLeft + tileView.size.width - 1) / TILE); x++) {
      if (y >= 0 && y < 2 ** zoom) tiles.push({ x, y });
    }
  }
  const mapped = locations.filter(hasMapCoordinates);
  function pan(dx: number, dy: number) { setCenter(unprojectCoordinate(point.x + dx, point.y + dy, zoom)); }
  return <section aria-label="Peta lokasi Ukhuwah" className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold text-slate-900">Peta Ukhuwah · Bandung Raya</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={control} aria-label="Perbesar peta" disabled={zoom >= 16} onClick={() => setZoom((z) => Math.min(16, z + 1))}><Plus size={18} /></button>
        <button type="button" className={control} aria-label="Perkecil peta" disabled={zoom <= 9} onClick={() => setZoom((z) => Math.max(9, z - 1))}><Minus size={18} /></button>
        <button type="button" className={control} aria-label="Kembali ke Bandung Raya" onClick={() => { setCenter({ latitude: -6.91, longitude: 107.61 }); setZoom(11); }}><RotateCcw size={18} /></button>
      </div>
    </div>
    {!enabled && <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
      <p>Aktifkan latar peta OpenStreetMap jika setuju menghubungi penyedia eksternal. Penyedia menerima alamat IP, asal situs, dan area peta, bukan isi laporan atau kontak. Daftar lembaga tetap dapat digunakan tanpa latar peta.</p>
      <button type="button" className={`${control} mt-2 px-3 font-semibold`} onClick={() => { setFailed(false); setEnabled(true); }}>Aktifkan latar peta</button>
    </div>}
    {enabled && <button type="button" className={`${control} mb-3 px-3 text-sm`} onClick={() => setEnabled(false)}>Nonaktifkan latar peta</button>}
    {failed && <p role="status" className="mb-3 text-sm text-amber-900">Sebagian latar peta gagal dimuat. Pin dan direktori tetap tersedia. <button type="button" className="underline" onClick={() => { setFailed(false); setEnabled(false); }}>Gunakan tanpa latar peta</button></p>}
    <div ref={container} tabIndex={0} aria-label="Area peta; gunakan tombol panah untuk menggeser" className="relative h-[400px] w-full overflow-hidden rounded-lg bg-slate-100 outline-offset-4" style={{ touchAction: "none" }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const directions: Record<string, [number, number]> = { ArrowLeft: [-100, 0], ArrowRight: [100, 0], ArrowUp: [0, -100], ArrowDown: [0, 100] };
        if (directions[event.key]) { event.preventDefault(); pan(...directions[event.key]); }
      }}
      onPointerDown={(event) => {
        if ((event.target as Element).closest("button,a") || event.button !== 0) return;
        drag.current = { x: event.clientX, y: event.clientY, centerX: point.x, centerY: point.y, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) start.moved = true;
        if (start.moved) setCenter(unprojectCoordinate(start.centerX - dx, start.centerY - dy, zoom));
      }}
      onPointerUp={(event) => {
        const start = drag.current; drag.current = null;
        if (start && !start.moved && onPick) {
          const bounds = event.currentTarget.getBoundingClientRect();
          const picked = unprojectCoordinate(left + event.clientX - bounds.left, top + event.clientY - bounds.top, zoom);
          onPick(Number(picked.latitude.toFixed(6)), Number(picked.longitude.toFixed(6)));
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }} onPointerCancel={() => { drag.current = null; }}>
      {tiles.map(({ x, y }) => <img key={`${zoom}:${x}:${y}`} alt="" draggable={false} referrerPolicy="origin"
        src={`https://tile.openstreetmap.org/${zoom}/${((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom}/${y}.png`}
        onError={() => setFailed(true)} width={256} height={256} className="pointer-events-none absolute max-w-none select-none"
        style={{ left: x * TILE - left, top: y * TILE - top }} />)}
      {!enabled && <p className="pointer-events-none absolute inset-x-3 top-3 rounded bg-white/90 px-3 py-2 text-xs text-slate-600">Skema koordinat tanpa latar jalan. Geser atau gunakan tombol panah; bukan batas administratif resmi.</p>}
      {mapped.map((location) => {
        const p = projectCoordinate(location.latitude!, location.longitude!, zoom);
        const x = p.x - left, y = p.y - top;
        if (x < -20 || x > size.width + 20 || y < -20 || y > size.height + 20) return null;
        return <button key={location.id} type="button" aria-label={`Lihat ${location.name}`} title={`${location.name}${location.isVerified ? " · Data diverifikasi" : " · Belum diverifikasi"}`}
          className={`absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-2 bg-white shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${selectedId === location.id ? "border-emerald-800 text-emerald-900" : "border-slate-400 text-slate-700"}`}
          style={{ left: x, top: y }} onClick={() => onSelect(location)}><MapPin aria-hidden="true" size={26} /></button>;
      })}
      {enabled && <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="absolute bottom-0 right-0 z-20 bg-white/95 px-2 py-1 text-xs text-slate-900 underline">© OpenStreetMap contributors</a>}
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-600">{mapped.length} lokasi berkoordinat dari {locations.length} lokasi pada halaman ini. Titik berdekatan dapat bertumpuk; gunakan direktori untuk semua hasil. {onPick ? "Klik area peta untuk memilih koordinat; periksa alamat sebelum menyimpan." : "Klik pin untuk memilih lembaga."}</p>
  </section>;
}