// Tiện ích định dạng ngày giờ / chuỗi tiếng Việt
export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const fmtTime = (s?: string | null) =>
  s ? new Date(s).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtDT = (s?: string | null) => (s ? `${fmtTime(s)} ${fmtDate(s)}` : '—');

export const fmtWeekday = (s: string) =>
  new Date(s).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });

export function timeAgo(s: string): string {
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} ngày trước`;
  return fmtDate(s);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return '?';
  const last = parts[parts.length - 1][0] ?? '';
  const first = parts.length > 1 ? parts[0][0] : '';
  return (first + last).toUpperCase();
}

export const indexBy = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));

export const fmtSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** input[type=datetime-local] value <-> ISO */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => new Date(v).toISOString();
