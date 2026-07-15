// ============================================================
// QUẢN TRỊ ĐƠN VỊ / PHÒNG BAN
// ============================================================
import React, { useState } from 'react';
import type { Unit } from '../../../domain/types';
import { useApp } from '../../../store/AppContext';
import { Field, Icon, Modal, PageHeader } from '../../components';
import * as adminService from '../../../services/adminService';

export default function UnitsAdminPage() {
  const { user, s, refresh, toast } = useApp();
  const [editing, setEditing] = useState<Partial<Unit> | null>(null);

  const save = async (data: Partial<Unit>) => {
    await adminService.saveUnit(user!, data);
    await refresh();
    setEditing(null);
    toast(data.id ? 'Đã cập nhật đơn vị' : 'Đã thêm đơn vị');
  };

  return (
    <div>
      <PageHeader title="Quản trị đơn vị" subtitle={`${s.units.length} đơn vị trực thuộc`}
        actions={<button className="btn" onClick={() => setEditing({})}><Icon name="plus" size={15} />Thêm đơn vị</button>} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th style={{ width: 60 }}>TT</th><th>Tên đơn vị</th><th>Viết tắt</th><th>Số cán bộ</th><th></th></tr></thead>
            <tbody>
              {[...s.units].sort((a, b) => a.order - b.order).map((u, i) => (
                <tr key={u.id}>
                  <td>{i + 1}</td>
                  <td className="t-title">{u.name}</td>
                  <td>{u.short}</td>
                  <td>{s.users.filter((x) => x.unitId === u.id).length}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className="icon-btn" onClick={() => setEditing(u)}><Icon name="edit" size={15} /></button>
                      <button className="icon-btn" onClick={async () => {
                        if (s.users.some((x) => x.unitId === u.id)) return toast('Không thể xóa: đơn vị còn cán bộ', 'error');
                        if (window.confirm(`Xóa đơn vị ${u.name}?`)) { await adminService.removeUnit(user!, u.id); await refresh(); toast('Đã xóa đơn vị'); }
                      }}><Icon name="trash" size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Cập nhật đơn vị' : 'Thêm đơn vị'} onClose={() => setEditing(null)}
          footer={<>
            <button className="btn outline" onClick={() => setEditing(null)}>Hủy</button>
            <button className="btn" disabled={!editing.name?.trim()} onClick={() => save(editing)}>Lưu</button>
          </>}>
          <Field label="Tên đơn vị" required>
            <input className="inp" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <div className="form-row">
            <Field label="Viết tắt">
              <input className="inp" value={editing.short ?? ''} onChange={(e) => setEditing({ ...editing, short: e.target.value })} />
            </Field>
            <Field label="Thứ tự hiển thị">
              <input className="inp" type="number" value={editing.order ?? 99} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
