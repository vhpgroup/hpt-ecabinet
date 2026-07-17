// ============================================================
// QUẢN TRỊ PHÒNG HỌP & VỊ TRÍ CHỖ NGỒI
// ============================================================
import React, { useState } from 'react';
import type { Room, RoomLayout } from '../../../domain/types';
import { useApp } from '../../../store/AppContext';
import { Badge, Field, Icon, Modal, PageHeader, SeatGrid, defaultLayout, seatKey } from '../../components';
import * as adminService from '../../../services/adminService';

export default function RoomsAdminPage() {
  const { user, s, refresh, toast } = useApp();
  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [seatRoom, setSeatRoom] = useState<Room | null>(null);

  const save = async (data: Partial<Room>) => {
    await adminService.saveRoom(user!, data);
    await refresh();
    setEditing(null);
    toast(data.id ? 'Đã cập nhật phòng họp' : 'Đã thêm phòng họp');
  };

  return (
    <div>
      <PageHeader title="Quản trị phòng họp" subtitle="Phòng họp, thiết bị và sơ đồ vị trí chỗ ngồi"
        actions={<button className="btn" onClick={() => setEditing({})}><Icon name="plus" size={15} />Thêm phòng họp</button>} />

      <div className="grid grid-3">
        {s.rooms.map((r) => {
          const usedBy = s.meetings.filter((m) => m.roomId === r.id && ['invited', 'live'].includes(m.status)).length;
          return (
            <div className="card card-pad" key={r.id}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div className="stat-ic" style={{ background: 'var(--blue-soft)', color: 'var(--primary)' }}><Icon name="room" size={20} /></div>
                <div style={{ flex: 1 }}>
                  <b style={{ color: 'var(--navy)', fontSize: 15 }}>{r.name}</b>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.location}</div>
                </div>
                <Badge color={r.status === 'active' ? 'green' : 'amber'}>{r.status === 'active' ? 'Sẵn sàng' : 'Bảo trì'}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '11px 0' }}>
                <Badge color="navy">{r.capacity} chỗ ngồi</Badge>
                {r.supportsOnline && <Badge color="blue">Họp trực tuyến</Badge>}
                {usedBy > 0 && <Badge color="amber">{usedBy} phiên họp sắp tới</Badge>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
                Thiết bị: {r.equipment.join(' · ') || '—'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn outline sm" onClick={() => setSeatRoom(r)}><Icon name="users" size={14} />Sơ đồ chỗ ngồi</button>
                <button className="btn ghost sm" onClick={() => setEditing(r)}><Icon name="edit" size={14} />Sửa</button>
                <button className="icon-btn" onClick={async () => {
                  if (window.confirm(`Xóa ${r.name}?`)) { await adminService.removeRoom(user!, r.id); await refresh(); toast('Đã xóa phòng họp'); }
                }}><Icon name="trash" size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {seatRoom && (
        <SeatLayoutModal room={seatRoom} onClose={() => setSeatRoom(null)}
          onSave={async (layout) => {
            await adminService.saveRoom(user!, { id: seatRoom.id, layout });
            await refresh();
            setSeatRoom(null);
            toast('Đã lưu sơ đồ phòng họp');
          }} />
      )}

      {editing && (
        <Modal title={editing.id ? 'Cập nhật phòng họp' : 'Thêm phòng họp'} onClose={() => setEditing(null)}
          footer={<>
            <button className="btn outline" onClick={() => setEditing(null)}>Hủy</button>
            <button className="btn" disabled={!editing.name?.trim()} onClick={() => save(editing)}>Lưu</button>
          </>}>
          <Field label="Tên phòng họp" required>
            <input className="inp" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <Field label="Vị trí">
            <input className="inp" value={editing.location ?? ''} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
          </Field>
          <div className="form-row">
            <Field label="Sức chứa (chỗ)">
              <input className="inp" type="number" value={editing.capacity ?? 20} onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })} />
            </Field>
            <Field label="Trạng thái">
              <select className="sel" value={editing.status ?? 'active'} onChange={(e) => setEditing({ ...editing, status: e.target.value as Room['status'] })}>
                <option value="active">Sẵn sàng</option>
                <option value="maintenance">Bảo trì</option>
              </select>
            </Field>
          </div>
          <Field label="Thiết bị (phân cách bằng dấu phẩy)">
            <input className="inp" value={(editing.equipment ?? []).join(', ')}
              onChange={(e) => setEditing({ ...editing, equipment: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          </Field>
          <label className="checkline">
            <input type="checkbox" checked={editing.supportsOnline ?? false}
              onChange={(e) => setEditing({ ...editing, supportsOnline: e.target.checked })} />
            Hỗ trợ họp trực tuyến (thiết bị hội nghị truyền hình)
          </label>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Chỉnh sơ đồ phòng họp (E-HSMT mục 9) ----------------
function SeatLayoutModal({ room, onClose, onSave }: {
  room: Room; onClose: () => void; onSave: (layout: RoomLayout) => void;
}) {
  const init = room.layout ?? defaultLayout(room.capacity);
  const [rows, setRows] = useState(init.rows);
  const [cols, setCols] = useState(init.cols);
  const [disabled, setDisabled] = useState<Set<string>>(new Set(init.disabled ?? []));
  const clamp = (n: number) => Math.min(12, Math.max(1, Math.floor(n || 1)));

  const layout: RoomLayout = {
    rows, cols,
    // chỉ giữ ô lối đi nằm trong phạm vi lưới hiện tại
    disabled: Array.from(disabled).filter((k) => {
      const [r, c] = k.split('-').map(Number);
      return r < rows && c < cols;
    }),
  };
  const seats = rows * cols - layout.disabled!.length;

  const toggle = (r: number, c: number) => {
    const k = seatKey(r, c);
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  return (
    <Modal title={`Sơ đồ phòng họp — ${room.name}`} onClose={onClose} width={560}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={() => onSave(layout)}><Icon name="check" size={15} />Lưu sơ đồ</button>
      </>}>
      <div className="form-row">
        <Field label="Số hàng (1–12)">
          <input className="inp" type="number" min={1} max={12} value={rows}
            onChange={(e) => setRows(clamp(Number(e.target.value)))} />
        </Field>
        <Field label="Số cột (1–12)">
          <input className="inp" type="number" min={1} max={12} value={cols}
            onChange={(e) => setCols(clamp(Number(e.target.value)))} />
        </Field>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 12px' }}>
        Bấm vào ô để bật/tắt ghế. Ô nét đứt = lối đi / khoảng trống (không phải ghế).
        Tổng số ghế: <b>{seats}</b>.
      </p>
      <SeatGrid layout={layout} editMode onCellClick={(r, c) => toggle(r, c)}
        render={() => ({ label: <span className="seat-code">ghế</span> })} />
    </Modal>
  );
}
