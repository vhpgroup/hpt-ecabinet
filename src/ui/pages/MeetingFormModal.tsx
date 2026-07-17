// ============================================================
// FORM TẠO / CHỈNH SỬA PHIÊN HỌP — thông tin, thành phần, chương trình
// ============================================================
import React, { useState } from 'react';
import type { AgendaItem, Meeting } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Field, Icon, Modal } from '../components';
import * as meetingService from '../../services/meetingService';
import { catalogNames } from '../../services/catalogService';
import { fromLocalInput, toLocalInput } from '../format';

interface Props { initial?: Meeting; onClose: () => void; onSaved: (id: string) => void }

export default function MeetingFormModal({ initial, onClose, onSaved }: Props) {
  const { user, s, refresh, toast } = useApp();
  const activeUsers = s.users.filter((u) => u.status === 'active');

  const defStart = new Date(Date.now() + 24 * 3600e3); defStart.setHours(8, 0, 0, 0);
  const defEnd = new Date(defStart); defEnd.setHours(11, 30);

  const meetingTypes = catalogNames(s.catalogs, 'meetingType');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [meetingType, setMeetingType] = useState(initial?.meetingType ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [start, setStart] = useState(toLocalInput(initial?.startTime ?? defStart.toISOString()));
  const [end, setEnd] = useState(toLocalInput(initial?.endTime ?? defEnd.toISOString()));
  const [roomId, setRoomId] = useState(initial?.roomId ?? s.rooms[0]?.id ?? '');
  const [isOnline, setIsOnline] = useState(initial?.isOnline ?? true);
  const [chairId, setChairId] = useState(initial?.chairId ?? user?.id ?? '');
  const [secretaryId, setSecretaryId] = useState(initial?.secretaryId ?? s.users.find((u) => u.role === 'secretary')?.id ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(
    initial?.participants.filter((p) => p.meetingRole === 'member').map((p) => p.userId)
    ?? activeUsers.filter((u) => u.role === 'delegate').map((u) => u.id),
  );
  const [guestIds, setGuestIds] = useState<string[]>(
    initial?.participants.filter((p) => p.meetingRole === 'guest').map((p) => p.userId) ?? [],
  );
  const [agenda, setAgenda] = useState<AgendaItem[]>(
    initial?.agenda ?? [{ id: 'ag' + Date.now(), order: 1, title: '', presenterId: undefined, durationMinutes: 30, documentIds: [] }],
  );
  const [err, setErr] = useState('');

  const toggleMember = (id: string) =>
    setMemberIds((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const setAg = (i: number, patch: Partial<AgendaItem>) =>
    setAgenda((a) => a.map((x, ix) => (ix === i ? { ...x, ...patch } : x)));

  const addAg = () =>
    setAgenda((a) => [...a, { id: 'ag' + Date.now() + a.length, order: a.length + 1, title: '', presenterId: undefined, durationMinutes: 30, documentIds: [] }]);

  const rmAg = (i: number) => setAgenda((a) => a.filter((_, ix) => ix !== i).map((x, ix) => ({ ...x, order: ix + 1 })));

  const save = async () => {
    setErr('');
    if (!title.trim()) return setErr('Vui lòng nhập tên phiên họp');
    if (new Date(start) >= new Date(end)) return setErr('Thời gian kết thúc phải sau thời gian bắt đầu');
    if (!chairId || !secretaryId) return setErr('Vui lòng chọn chủ trì và thư ký');
    const cleanAgenda = agenda.filter((a) => a.title.trim()).map((a, i) => ({ ...a, order: i + 1 }));
    if (!user) return;
    try {
      const m = await meetingService.saveMeeting(user, {
        id: initial?.id,
        title: title.trim(), description: description.trim(),
        startTime: fromLocalInput(start), endTime: fromLocalInput(end),
        roomId, isOnline, chairId, secretaryId, memberIds, guestIds, agenda: cleanAgenda,
        meetingType: meetingType.trim() || undefined,
      });
      await refresh();
      toast(initial ? 'Đã cập nhật phiên họp' : 'Đã tạo phiên họp (bản nháp)');
      onSaved(m.id);
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  return (
    <Modal title={initial ? 'Chỉnh sửa phiên họp' : 'Tạo phiên họp mới'} onClose={onClose} width={760}
      footer={<>
        {err && <span style={{ color: 'var(--red)', fontSize: 13, marginRight: 'auto' }}>{err}</span>}
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={save}><Icon name="check" size={15} />{initial ? 'Lưu thay đổi' : 'Tạo phiên họp'}</button>
      </>}>
      <div className="form-row">
        <Field label="Tên phiên họp" required>
          <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Phiên họp thường kỳ UBND tỉnh tháng 8/2026" />
        </Field>
        <Field label="Loại phiên họp">
          {meetingTypes.length > 0 ? (
            <select className="sel" value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
              <option value="">— Chưa phân loại —</option>
              {/* giữ giá trị cũ nếu không còn trong danh mục (tương thích) */}
              {meetingType && !meetingTypes.includes(meetingType) && <option value={meetingType}>{meetingType}</option>}
              {meetingTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : (
            <input className="inp" placeholder="Nhập loại (danh mục trống)" value={meetingType} onChange={(e) => setMeetingType(e.target.value)} />
          )}
        </Field>
      </div>
      <Field label="Mô tả / nội dung chính">
        <textarea className="ta" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="form-row">
        <Field label="Bắt đầu" required><input type="datetime-local" className="inp" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Kết thúc" required><input type="datetime-local" className="inp" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <div className="form-row">
        <Field label="Phòng họp" required>
          <select className="sel" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {s.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.location} ({r.capacity} chỗ)</option>)}
          </select>
        </Field>
        <label className="checkline" style={{ marginTop: 26 }}>
          <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
          Kết hợp họp trực tuyến (đại biểu dự từ xa)
        </label>
      </div>
      <div className="form-row">
        <Field label="Chủ trì" required>
          <select className="sel" value={chairId} onChange={(e) => setChairId(e.target.value)}>
            {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName} — {u.title}</option>)}
          </select>
        </Field>
        <Field label="Thư ký" required>
          <select className="sel" value={secretaryId} onChange={(e) => setSecretaryId(e.target.value)}>
            {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName} — {u.title}</option>)}
          </select>
        </Field>
      </div>

      <Field label={`Thành phần tham dự (${memberIds.length} đại biểu)`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 14px', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px', maxHeight: 180, overflowY: 'auto' }}>
          {activeUsers.filter((u) => u.id !== chairId && u.id !== secretaryId).map((u) => (
            <label className="checkline" key={u.id} style={{ marginBottom: 4 }}>
              <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
              <span style={{ fontSize: 13 }}>{u.fullName} <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>— {u.title}</span></span>
            </label>
          ))}
        </div>
      </Field>

      <Field label={`Khách mời (${guestIds.length}) — tham dự, không thuộc thành phần biểu quyết`}>
        <select className="sel" value=""
          onChange={(e) => { if (e.target.value && !guestIds.includes(e.target.value)) setGuestIds([...guestIds, e.target.value]); }}>
          <option value="">— Chọn người để thêm làm khách mời —</option>
          {activeUsers
            .filter((u) => u.id !== chairId && u.id !== secretaryId && !memberIds.includes(u.id) && !guestIds.includes(u.id))
            .map((u) => <option key={u.id} value={u.id}>{u.fullName} — {u.title}</option>)}
        </select>
        {guestIds.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            {guestIds.map((gid) => {
              const u = s.users.find((x) => x.id === gid);
              return (
                <span key={gid} className="badge badge-purple">
                  {u?.fullName}
                  <a style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setGuestIds(guestIds.filter((x) => x !== gid))}>✕</a>
                </span>
              );
            })}
          </div>
        )}
      </Field>

      <Field label="Chương trình phiên họp">
        <div>
          {agenda.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span className="agenda-no">{i + 1}</span>
              <input className="inp" style={{ flex: 3 }} placeholder="Nội dung" value={a.title} onChange={(e) => setAg(i, { title: e.target.value })} />
              <select className="sel" style={{ flex: 2 }} value={a.presenterId ?? ''} onChange={(e) => setAg(i, { presenterId: e.target.value || undefined })}>
                <option value="">— Người trình bày —</option>
                {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
              <input className="inp" type="number" min={5} step={5} style={{ width: 76 }} title="Thời lượng (phút)"
                value={a.durationMinutes} onChange={(e) => setAg(i, { durationMinutes: Number(e.target.value) })} />
              <button className="icon-btn" onClick={() => rmAg(i)} title="Xóa mục"><Icon name="trash" size={15} /></button>
            </div>
          ))}
          <button className="btn ghost sm" onClick={addAg}><Icon name="plus" size={14} />Thêm nội dung</button>
        </div>
      </Field>
    </Modal>
  );
}
