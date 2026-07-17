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

// ============================================================
// XUẤT CSV phía client (E-HSMT mục 31 "Xuất ý kiến tài liệu",
// mục 36 "Xuất danh sách điểm danh"). Không cần server — dùng Blob.
// - Thêm BOM UTF-8 để Excel mở đúng tiếng Việt.
// - Bọc ô có dấu phẩy/xuống dòng/nháy kép trong nháy kép (escape "" ).
// ============================================================
const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Dựng nội dung CSV từ tiêu đề cột + các dòng. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  return '﻿' + lines.join('\r\n');
}

/** Tải một tệp văn bản (vd CSV) xuống máy bằng Blob (client-side). */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** input[type=datetime-local] value <-> ISO */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => new Date(v).toISOString();
