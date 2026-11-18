export const RECORDING_TITLE_MAX = 160;
export const RECORDING_URL_MAX = 2048;
export const RECORDING_URL_ERROR = "Masukkan tautan HTTPS ke satu video YouTube atau file Google Drive.";

export type RecordingSource = {
  provider: "YouTube" | "Google Drive";
  url: string;
  previewUrl: string;
};

export type Recording = { id: string; title: string; url: string };
export type EventRecording = Recording & { published: boolean };

export type RecordingEvent = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type PortalRecordingGroup = RecordingEvent & { recordings: Recording[] };

const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"]);
const youtubeId = /^[A-Za-z0-9_-]{11}$/;
const driveId = /^[A-Za-z0-9_-]{10,128}$/;
const driveResourceKey = /^[A-Za-z0-9_-]{1,200}$/;

export function parseRecordingSource(value: string): RecordingSource | null {
  const trimmed = value.trim();
  if (trimmed.length > RECORDING_URL_MAX) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;

  if (url.hostname === "youtu.be" || youtubeHosts.has(url.hostname)) {
    const id = url.hostname === "youtu.be" ? url.pathname.match(/^\/([\w-]+)\/?$/)?.[1]
      : /^\/watch\/?$/.test(url.pathname) ? url.searchParams.get("v")
      : url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)\/?$/)?.[1];
    if (!id || !youtubeId.test(id)) return null;
    return {
      provider: "YouTube",
      url: `https://www.youtube.com/watch?v=${id}`,
      previewUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  if (url.hostname === "drive.google.com") {
    const id = /^\/(?:open|uc)\/?$/.test(url.pathname) ? url.searchParams.get("id")
      : url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/(?:view|preview|edit))?\/?$/)?.[1];
    const key = url.searchParams.get("resourcekey") ?? url.searchParams.get("resourceKey");
    if (!id || !driveId.test(id) || (key !== null && !driveResourceKey.test(key))) return null;
    const resource = key ? `?${new URLSearchParams({ resourcekey: key })}` : "";
    const path = `https://drive.google.com/file/d/${id}`;
    return { provider: "Google Drive", url: `${path}/view${resource}`, previewUrl: `${path}/preview${resource}` };
  }
  return null;
}
