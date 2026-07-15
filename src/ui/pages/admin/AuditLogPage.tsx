// ============================================================
// NHẬT KÝ HỆ THỐNG — lưu vết mọi thao tác quan trọng
// ============================================================
import React, { useMemo, useState } from 'react';
import { useApp } from '../../../store/AppContext';
import { Badge, EmptyState, Icon, PageHeader } from '../../components';
import { fmtDT } from '../../format';

export default function AuditLogPage() {
  const { s } = useApp();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');

  const actions = useMemo(() => Array.from(new Set(s.audit.map((a) => a.action))).sort(), [s.audit]);

  const list = useMemo(() => {
    let arr = [...s.audit].sort((a, b) => b.at.localeCompare(a.at));
    if (action) arr = arr.filter((a) => a.action === action);
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      arr = arr.filter((a) => (a.userName + a.action + a.detail).toLowerCase().includes(k));
    }
    return arr;
  }, [s.audit, q, action]);

  return (
    <div>
      <PageHeader title="Nhật ký hệ thống" subtitle={`${s.audit.length} bản ghi — phục vụ kiểm tra, giám sát và truy vết`} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ minWidth: 260 }}>
          <Icon name="search" size={15} />
          <input className="inp" placeholder="Tìm theo người dùng, nội dung…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="sel" style={{ maxWidth: 240 }} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">— Tất cả hành động —</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
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
