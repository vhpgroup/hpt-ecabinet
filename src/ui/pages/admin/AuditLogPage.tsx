// ============================================================
// NHẬT KÝ HỆ THỐNG (E-HSMT mục 3) — lưu vết mọi thao tác quan trọng.
// Bộ lọc: theo TÀI KHOẢN + theo KHOẢNG THỜI GIAN (từ–đến) + theo hành động
// + tìm tự do. Admin có thể XÓA các bản ghi đang lọc (có xác nhận).
// ============================================================
import React, { useMemo, useState } from 'react';
import { useApp } from '../../../store/AppContext';
import { Badge, EmptyState, Icon, PageHeader } from '../../components';
import * as adminService from '../../../services/adminService';
import { fmtDT } from '../../format';

export default function AuditLogPage() {
  const { user, s, refresh, toast } = useApp();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState(''); // yyyy-mm-dd
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  const actions = useMemo(() => Array.from(new Set(s.audit.map((a) => a.action))).sort(), [s.audit]);
  // các tài khoản xuất hiện trong nhật ký (id -> tên) để dựng dropdown
  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of s.audit) if (!map.has(a.userId)) map.set(a.userId, a.userName);
    return Array.from(map.entries()).sort((x, y) => x[1].localeCompare(y[1]));
  }, [s.audit]);

  // mốc thời gian lọc (bao trọn ngày): from 00:00 -> to 23:59:59
  const fromMs = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
  const toMs = to ? new Date(to + 'T23:59:59.999').getTime() : Infinity;

  const list = useMemo(() => {
    let arr = [...s.audit].sort((a, b) => b.at.localeCompare(a.at));
    if (action) arr = arr.filter((a) => a.action === action);
    if (userId) arr = arr.filter((a) => a.userId === userId);
    arr = arr.filter((a) => { const t = new Date(a.at).getTime(); return t >= fromMs && t <= toMs; });
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      arr = arr.filter((a) => (a.userName + a.action + a.detail).toLowerCase().includes(k));
    }
    return arr;
  }, [s.audit, q, action, userId, fromMs, toMs]);

  const anyFilter = !!(action || userId || from || to || q.trim());

  const clearFilters = () => { setQ(''); setAction(''); setUserId(''); setFrom(''); setTo(''); };

  const doClear = async () => {
    if (!list.length) return;
    const msg = anyFilter
      ? `Xóa ${list.length} bản ghi nhật ký ĐANG LỌC? Hành động không thể hoàn tác.`
      : `Xóa TẤT CẢ ${list.length} bản ghi nhật ký? Hành động không thể hoàn tác.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const n = await adminService.clearAuditLogs(user!, list.map((a) => a.id));
      await refresh();
      toast(`Đã xóa ${n} bản ghi nhật ký`);
    } catch (ex) { toast((ex as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Nhật ký hệ thống" subtitle={`${s.audit.length} bản ghi — phục vụ kiểm tra, giám sát và truy vết`}
        actions={
          <button className="btn danger" disabled={busy || list.length === 0} onClick={doClear} title="Xóa các bản ghi đang lọc">
            <Icon name="trash" size={15} />Xóa nhật ký{anyFilter ? ` (${list.length})` : ' (tất cả)'}
          </button>
        } />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-box" style={{ minWidth: 220 }}>
          <Icon name="search" size={15} />
          <input className="inp" placeholder="Tìm theo người dùng, nội dung…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="sel" style={{ maxWidth: 220 }} value={userId} onChange={(e) => setUserId(e.target.value)} title="Lọc theo tài khoản">
          <option value="">— Tất cả tài khoản —</option>
          {accounts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="sel" style={{ maxWidth: 200 }} value={action} onChange={(e) => setAction(e.target.value)} title="Lọc theo hành động">
          <option value="">— Tất cả hành động —</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          Từ <input className="inp" type="date" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          đến <input className="inp" type="date" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {anyFilter && <button className="btn ghost sm" onClick={clearFilters}>Bỏ lọc</button>}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>Hiển thị {list.length}/{s.audit.length}</span>
      </div>

      <div className="card">
        {list.length === 0 && <EmptyState icon="list" text="Không có bản ghi phù hợp" />}
        <div className="tbl-wrap">
          {list.length > 0 && (
            <table className="tbl">
              <thead><tr><th style={{ width: 170 }}>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtDT(a.at)}</td>
                    <td className="t-title">{a.userName}</td>
                    <td><Badge color="blue">{a.action}</Badge></td>
                    <td style={{ fontSize: 13 }}>{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
