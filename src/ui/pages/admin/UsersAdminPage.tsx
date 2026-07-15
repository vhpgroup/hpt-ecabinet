// ============================================================
// QUẢN TRỊ NGƯỜI DÙNG & PHÂN QUYỀN
// ============================================================
import React, { useMemo, useState } from 'react';
import type { Role, User } from '../../../domain/types';
import { useApp } from '../../../store/AppContext';
import { Avatar, Badge, Field, Icon, Modal, PageHeader } from '../../components';
import { ROLE_LABEL } from '../../../domain/labels';
import * as adminService from '../../../services/adminService';
import { indexBy } from '../../format';

const ROLE_COLOR: Record<Role, string> = { admin: 'navy', chairman: 'blue', secretary: 'purple', delegate: 'gray' };
const COLORS = ['#0f4c92', '#1d9e5f', '#d97706', '#7c3aed', '#d64545', '#0e7490', '#b45309', '#334155', '#be185d', '#4338ca'];

export default function UsersAdminPage() {
  const { user, s, refresh, toast } = useApp();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const units = indexBy(s.units);

  const list = useMemo(() => {
    let arr = [...s.users];
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      arr = arr.filter((u) => (u.fullName + u.username + u.title + u.email).toLowerCase().includes(k));
    }
    return arr;
  }, [s.users, q]);

  const save = async (data: Partial<User>) => {
    try {
      await adminService.saveUser(user!, data);
      await refresh();
      setEditing(null);
      toast(data.id ? 'Đã cập nhật người dùng' : 'Đã tạo người dùng (mật khẩu mặc định 123456)');
    } catch (ex) { toast((ex as Error).message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Quản trị người dùng" subtitle={`${s.users.length} tài khoản · phân quyền theo 4 vai trò`}
        actions={<button className="btn" onClick={() => setEditing({})}><Icon name="plus" size={15} />Thêm người dùng</button>} />
      <div className="search-box" style={{ maxWidth: 340, marginBottom: 14 }}>
        <Icon name="search" size={15} />
        <input className="inp" placeholder="Tìm theo tên, tài khoản…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Người dùng</th><th>Tài khoản</th><th>Đơn vị</th><th>Vai trò</th><th>Liên hệ</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Avatar user={u} size={32} />
                      <div><div className="t-title">{u.fullName}</div><div className="t-sub">{u.title}</div></div>
                    </div>
                  </td>
                  <td><code style={{ fontSize: 12.5 }}>{u.username}</code></td>
                  <td>{units.get(u.unitId)?.short ?? '—'}</td>
                  <td><Badge color={ROLE_COLOR[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                  <td><div className="t-sub">{u.email}<br />{u.phone}</div></td>
                  <td><Badge color={u.status === 'active' ? 'green' : 'red'}>{u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</Badge></td>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className="icon-btn" title="Sửa" onClick={() => setEditing(u)}><Icon name="edit" size={15} /></button>
                      <button className="icon-btn" title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                        onClick={() => save({ id: u.id, status: u.status === 'active' ? 'inactive' : 'active' })}>
                        <Icon name="lock" size={15} />
                      </button>
                      {u.id !== user?.id && (
                        <button className="icon-btn" title="Xóa" onClick={async () => {
                          if (window.confirm(`Xóa tài khoản ${u.username}?`)) { await adminService.removeUser(user!, u.id); await refresh(); toast('Đã xóa người dùng'); }
                        }}><Icon name="trash" size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <UserFormModal initial={editing} units={s.units} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}

function UserFormModal({ initial, units, onClose, onSave }: {
  initial: Partial<User>; units: { id: string; name: string }[];
  onClose: () => void; onSave: (d: Partial<User>) => void;
}) {
  const [f, setF] = useState<Partial<User>>({
    role: 'delegate', unitId: units[0]?.id, status: 'active',
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    ...initial,
  });
  const set = (k: keyof User, v: string) => setF({ ...f, [k]: v });
  const ok = f.fullName?.trim() && f.username?.trim();

  return (
    <Modal title={initial.id ? 'Cập nhật người dùng' : 'Thêm người dùng'} onClose={onClose}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" disabled={!ok} onClick={() => onSave(f)}>Lưu</button>
      </>}>
      <div className="form-row">
        <Field label="Họ và tên" required><input className="inp" value={f.fullName ?? ''} onChange={(e) => set('fullName', e.target.value)} /></Field>
        <Field label="Tên đăng nhập" required><input className="inp" value={f.username ?? ''} onChange={(e) => set('username', e.target.value.toLowerCase())} /></Field>
      </div>
      <Field label="Chức danh"><input className="inp" value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
      <div className="form-row">
        <Field label="Đơn vị">
          <select className="sel" value={f.unitId} onChange={(e) => set('unitId', e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Vai trò hệ thống">
          <select className="sel" value={f.role} onChange={(e) => set('role', e.target.value)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Email"><input className="inp" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Điện thoại"><input className="inp" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
      </div>
      {!initial.id && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Mật khẩu mặc định: <b>123456</b> (demo).</p>}
    </Modal>
  );
}
