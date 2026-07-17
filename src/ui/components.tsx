// ============================================================
// COMPONENT DÙNG CHUNG — Icon, Badge, Avatar, Modal, biểu đồ SVG…
// ============================================================
import React, { useEffect } from 'react';
import type { RoomLayout, User, Vote } from '../domain/types';
import { thresholdLabel, voteOutcome, voteResults } from '../services/voteService';
import { initials } from './format';
import { EMOJI } from './emojiIcons';

// ---------------- Icon — bộ Lucide chính thức ----------------
// Dữ liệu SVG lấy nguyên bản từ Lucide (https://lucide.dev) — ISC License,
// © Lucide Contributors. Nhúng tĩnh để không thêm phụ thuộc runtime.
const PATHS: Record<string, string> = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  calendar: '<path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M16 3.128a4 4 0 0 1 0 7.744" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><circle cx="9" cy="7" r="4" />',
  file: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />',
  vote: '<path d="M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344" /><path d="m9 11 3 3L22 4" />',
  chat: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" />',
  building: '<path d="M10 12h4" /><path d="M10 8h4" /><path d="M14 21v-3a2 2 0 0 0-4 0v3" /><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" /><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />',
  room: '<path d="M11 20H2" /><path d="M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z" /><path d="M11 4H8a2 2 0 0 0-2 2v14" /><path d="M14 12h.01" /><path d="M22 20h-3" />',
  list: '<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />',
  logout: '<path d="m16 17 5-5-5-5" /><path d="M21 12H9" /><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />',
  plus: '<path d="M5 12h14" /><path d="M12 5v14" />',
  search: '<path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />',
  x: '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />',
  trash: '<path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
  share: '<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />',
  download: '<path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" />',
  mic: '<path d="M12 19v3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><rect x="9" y="2" width="6" height="13" rx="3" />',
  pen: '<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z" /><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18" /><path d="m2.3 2.3 7.286 7.286" /><circle cx="11" cy="11" r="2" />',
  clock: '<circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />',
  check: '<path d="M20 6 9 17l-5-5" />',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /><rect x="6" y="14" width="12" height="8" rx="1" />',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />',
  menu: '<path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" />',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" />',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />',
  paperclip: '<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" />',
  info: '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
  chevleft: '<path d="m15 18-6-6 6-6" />',
  chevright: '<path d="m9 18 6-6-6-6" />',
  book: '<path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />',
  settings: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" />',
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

/**
 * Icon MÀU 3D (Microsoft Fluent Emoji) — dùng cho menu điều hướng, thẻ thống kê,
 * tiêu đề khối nổi bật. Không có bản màu thì tự rơi về icon nét mảnh (Icon).
 */
export function ColorIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const src = EMOJI[name];
  if (!src) return <Icon name={name} size={size} className={className} />;
  return (
    <img
      src={src} width={size} height={size} className={className} alt=""
      style={{ objectFit: 'contain', flexShrink: 0 }} draggable={false}
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
export function PageHeader({ title, subtitle, actions, icon }: {
  title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; icon?: string;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 style={icon ? { display: 'flex', alignItems: 'center', gap: 10 } : undefined}>
          {icon && <ColorIcon name={icon} size={30} />}
          {title}
        </h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'mailbox', text }: { icon?: string; text: string }) {
  return (
    <div className="empty">
      <ColorIcon name={icon} size={44} />
      <p>{text}</p>
    </div>
  );
}

export function StatCard({ icon, label, value, tone = 'blue', hint }: {
  icon: string; label: string; value: React.ReactNode; tone?: string; hint?: string;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-ic"><ColorIcon name={icon} size={26} /></div>
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
