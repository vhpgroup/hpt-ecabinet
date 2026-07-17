// ============================================================
// COMPONENT DÙNG CHUNG — Icon, Badge, Avatar, Modal, biểu đồ SVG…
// ============================================================
import React, { useEffect } from 'react';
import type { RoomLayout, User, Vote } from '../domain/types';
import { thresholdLabel, voteOutcome, voteResults } from '../services/voteService';
import { initials } from './format';

// ---------------- Icon (SVG nét mảnh kiểu feather) ----------------
const PATHS: Record<string, string> = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  vote: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  building: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>',
  room: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="17" y2="14"/><line x1="21" y1="14" x2="21" y2="17"/><line x1="14" y1="17" x2="14" y2="21"/><line x1="17" y1="21" x2="21" y2="21"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  chevleft: '<polyline points="15 18 9 12 15 6"/>',
  chevright: '<polyline points="9 18 15 12 9 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

export function Icon({ name, size = 18, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? PATHS.info }}
    />
  );
}

// ---------------- Badge / Avatar ----------------
export function Badge({ color = 'gray', children }: { color?: string; children: React.ReactNode }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

export function Avatar({ user, size = 34 }: { user?: User | null; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: user?.avatarColor ?? '#94a3b8', fontSize: size * 0.36 }}
      title={user?.fullName}
    >
      {user ? initials(user.fullName) : '?'}
    </span>
  );
}

// ---------------- Modal ----------------
export function Modal({ title, onClose, children, width = 560, footer }: {
  title: React.ReactNode; onClose: () => void; children: React.ReactNode; width?: number; footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: width }}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------- Trang & khối ----------------
export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'info', text }: { icon?: string; text: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <p>{text}</p>
    </div>
  );
}

export function StatCard({ icon, label, value, tone = 'blue', hint }: {
  icon: string; label: string; value: React.ReactNode; tone?: string; hint?: string;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-ic"><Icon name={icon} size={20} /></div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="field">
      <span className="field-label">{label}{required && <em> *</em>}</span>
      {children}
    </label>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress"><div className="progress-in" style={{ width: `${Math.min(100, value)}%` }} /></div>
  );
}

// ---------------- Kết quả biểu quyết ----------------
const VOTE_COLORS = ['#1d9e5f', '#d64545', '#d97706', '#7c3aed', '#0369a1'];

export function VoteResultBars({ vote }: { vote: Vote }) {
  const rows = voteResults(vote);
  const o = voteOutcome(vote);
  return (
    <div className="vote-bars">
      {rows.map((r, i) => (
        <div key={r.optionId} className="vbar-row">
          <div className="vbar-top">
            <span>{r.label}</span>
            <strong>{r.count} phiếu · {vote.ballots.length ? r.percent : 0}%</strong>
          </div>
          <div className="vbar-track">
            <div className="vbar-fill" style={{ width: `${vote.ballots.length ? r.percent : 0}%`, background: VOTE_COLORS[i % VOTE_COLORS.length] }} />
          </div>
        </div>
      ))}
      {/* Phân loại theo TỔNG số có quyền biểu quyết (mẫu số = eligibleIds) */}
      <div className="vbar-breakdown" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
        <span>Tán thành <strong style={{ color: 'var(--green,#1d9e5f)' }}>{o.approve}</strong>/{o.totalEligible}</span>
        <span>• Không tán thành <strong>{o.against}</strong></span>
        <span>• Ý kiến khác <strong>{o.abstain}</strong></span>
        <span>• Chưa biểu quyết <strong>{o.notVoted}</strong></span>
      </div>
      <div className="vbar-total">Đã biểu quyết: <strong>{vote.ballots.length}/{vote.eligibleIds.length}</strong> đại biểu</div>
    </div>
  );
}

/**
 * VoteOutcomePanel — huy hiệu kết luận theo ngưỡng (P0-A).
 * Thông qua = xanh; Không thông qua = đỏ; Đang biểu quyết/Chưa đủ = amber/xám.
 * Không dán nhãn cứng khi đang mở; nếu đã đủ ngưỡng lúc mở thì ghi "chờ đóng".
 */
export function VoteOutcomePanel({ vote }: { vote: Vote }) {
  const o = voteOutcome(vote);
  const tone =
    o.status === 'closed' ? (o.approved ? 'green' : 'red')
    : o.status === 'open' ? 'amber'
    : 'gray';
  const palette: Record<string, { bg: string; bd: string; fg: string }> = {
    green: { bg: '#e9f7ef', bd: '#9fddba', fg: '#0f7a45' },
    red: { bg: '#fdeaea', bd: '#f0b4b4', fg: '#b3261e' },
    amber: { bg: '#fef6e7', bd: '#f4d79a', fg: '#a5641a' },
    gray: { bg: '#f1f5f9', bd: '#d8e0ea', fg: '#475569' },
  };
  const c = palette[tone];
  const openReady = o.status === 'open' && o.approved;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 11, padding: '10px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Icon name={o.status === 'closed' && o.approved ? 'check' : o.status === 'closed' ? 'x' : 'clock'} size={16} className="" />
        <b style={{ color: c.fg, fontSize: 15 }}>{o.label}</b>
        {openReady && <span style={{ color: c.fg, fontSize: 12.5, fontWeight: 600 }}>(đã đủ điều kiện, chờ đóng)</span>}
      </div>
      <div style={{ fontSize: 12.5, color: c.fg, marginTop: 4 }}>
        Tán thành {o.approve}/{o.totalEligible} • Cần ≥ {o.required} ({thresholdLabel(o.threshold)})
      </div>
    </div>
  );
}

// ---------------- Biểu đồ SVG nhỏ ----------------
export function Donut({ parts, size = 130, label }: { parts: { label: string; value: number; color: string }[]; size?: number; label?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const R = size / 2 - 10;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#e8eef6" strokeWidth="14" />
        {parts.map((p, i) => {
          const frac = p.value / total;
          const dash = `${frac * C} ${C}`;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={R} fill="none" stroke={p.color} strokeWidth="14"
              strokeDasharray={dash} strokeDashoffset={-offset * C}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt" />
          );
          offset += frac;
          return el;
        })}
        <text x="50%" y="48%" textAnchor="middle" className="donut-num">{parts.reduce((a, p) => a + p.value, 0)}</text>
        {label && <text x="50%" y="62%" textAnchor="middle" className="donut-label">{label}</text>}
      </svg>
      <div className="donut-legend">
        {parts.map((p, i) => (
          <div key={i}><span className="dot" style={{ background: p.color }} />{p.label}: <strong>{p.value}</strong></div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data, height = 150 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="barchart" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="barchart-col">
          <span className="barchart-val">{d.value || ''}</span>
          <div className="barchart-bar" style={{ height: `${(d.value / max) * (height - 46)}px` }} />
          <span className="barchart-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------- QR mô phỏng (điểm danh) ----------------
export function QRSvg({ seed, size = 168 }: { seed: string; size?: number }) {
  // sinh ma trận giả-ngẫu-nhiên ổn định theo seed
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const rand = () => { h = (Math.imul(1103515245, h) + 12345) | 0; return (h >>> 16) / 65536; };
  const N = 21; const cell = size / N;
  const cells: React.ReactElement[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const finder = (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
      let fill = false;
      if (finder) {
        const lx = x % (N - 7) % 7, ly = y % (N - 7) % 7;
        const bx = x >= N - 7 ? x - (N - 7) : x, by = y >= N - 7 ? y - (N - 7) : y;
        fill = bx === 0 || bx === 6 || by === 0 || by === 6 || (bx >= 2 && bx <= 4 && by >= 2 && by <= 4);
        void lx; void ly;
      } else {
        fill = rand() > 0.52;
      }
      if (fill) cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#0c2d55" />);
    }
  }
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="qr">{cells}</svg>;
}

// ============================================================
// SƠ ĐỒ PHÒNG HỌP (E-HSMT mục 9 & 38) — lưới ghế dùng chung cho:
//  - RoomsAdminPage : chỉnh sơ đồ (bật/tắt gh, xem trước)
//  - MeetingDetailPage : gán vị trí đại biểu
//  - LiveMeetingPage : xem sơ đồ + màu điểm danh realtime
// ============================================================

/** Khóa ghế "hàng-cột" (0-based) — nhất quán với server (isSeatKey). */
export const seatKey = (r: number, c: number) => `${r}-${c}`;

/** Bố cục mặc định khi phòng chưa cấu hình sơ đồ (suy ra từ sức chứa). */
export function defaultLayout(capacity: number): RoomLayout {
  const cols = capacity <= 12 ? 4 : capacity <= 24 ? 5 : 6;
  const rows = Math.min(12, Math.max(1, Math.ceil(Math.min(capacity, 60) / cols)));
  return { rows, cols, disabled: [] };
}

export interface SeatCellInfo {
  /** class trạng thái thêm vào ô (assigned/att-present/speaking/selected…) */
  cls?: string;
  /** nhãn hiển thị trong ô (vd tên viết tắt) */
  label?: React.ReactNode;
  /** tooltip (vd họ tên đầy đủ) */
  title?: string;
}

/**
 * Lưới ghế. `render(r,c)` trả về thông tin hiển thị cho từng ghế (bỏ qua ô lối đi).
 * `onCellClick` (tùy chọn) cho phép bấm ghế/ô để tương tác (chỉnh sơ đồ hoặc gán chỗ).
 */
export function SeatGrid({ layout, render, onCellClick, showScreen = true, editMode = false }: {
  layout: RoomLayout;
  render?: (r: number, c: number) => SeatCellInfo | null;
  onCellClick?: (r: number, c: number, isAisle: boolean) => void;
  showScreen?: boolean;
  /** chế độ chỉnh sơ đồ: hiển thị cả ô lối đi để bấm bật/tắt */
  editMode?: boolean;
}) {
  const disabled = new Set(layout.disabled ?? []);
  const rows = Math.min(12, Math.max(1, layout.rows));
  const cols = Math.min(12, Math.max(1, layout.cols));
  return (
    <div>
      {showScreen && <div className="seatgrid-screen">MÀN HÌNH · CHỦ TỌA</div>}
      <div className="seatgrid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const key = seatKey(r, c);
            const isAisle = disabled.has(key);
            const info = !isAisle && render ? render(r, c) : null;
            const clickable = !!onCellClick && (editMode || !isAisle);
            const cls = [
              'cell',
              isAisle ? 'aisle' : '',
              clickable ? 'clickable' : '',
              info?.cls ?? '',
            ].filter(Boolean).join(' ');
            return (
              <div key={key} className={cls} title={info?.title ?? (isAisle ? 'Lối đi / khoảng trống' : `Ghế ${r + 1}-${c + 1}`)}
                onClick={clickable ? () => onCellClick!(r, c, isAisle) : undefined}>
                {isAisle
                  ? (editMode ? '·' : '')
                  : (info?.label ?? <span className="seat-code">{r + 1}-{c + 1}</span>)}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
