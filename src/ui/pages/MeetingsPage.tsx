// ============================================================
// DANH SÁCH PHIÊN HỌP — lọc trạng thái, tìm kiếm, tạo mới
// ============================================================
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { Badge, EmptyState, Icon, PageHeader } from '../components';
import { MEETING_STATUS } from '../../domain/labels';
import { can } from '../../services/authService';
import { fmtTime, indexBy } from '../format';
import MeetingFormModal from './MeetingFormModal';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'upcoming', label: 'Sắp diễn ra' },
  { key: 'live', label: 'Đang diễn ra' },
  { key: 'finished', label: 'Đã kết thúc' },
  { key: 'mine', label: 'Tôi tham dự' },
];

export default function MeetingsPage() {
  const { user, s } = useApp();
  const nav = useNavigate();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const rooms = indexBy(s.rooms);
  const users = indexBy(s.users);

  const list = useMemo(() => {
    let arr = [...s.meetings];
    if (filter === 'upcoming') arr = arr.filter((m) => ['draft', 'invited'].includes(m.status));
    if (filter === 'live') arr = arr.filter((m) => m.status === 'live');
    if (filter === 'finished') arr = arr.filter((m) => m.status === 'finished');
    if (filter === 'mine') arr = arr.filter((m) => m.participants.some((p) => p.userId === user?.id));
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      arr = arr.filter((m) => (m.title + ' ' + m.code + ' ' + m.description).toLowerCase().includes(k));
    }
    return arr.sort((a, b) => b.startTime.localeCompare(a.startTime));
  }, [s.meetings, filter, q, user]);

  return (
    <div>
      <PageHeader
        title="Phiên họp"
        subtitle={`${s.meetings.length} phiên họp trong hệ thống`}
        actions={can.manageMeetings(user) && (
          <button className="btn" onClick={() => setShowForm(true)}><Icon name="plus" size={16} />Tạo phiên họp</button>
        )}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={'btn sm' + (filter === f.key ? '' : ' outline')} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
        <div className="search-box" style={{ marginLeft: 'auto', minWidth: 240 }}>
          <Icon name="search" size={15} />
          <input className="inp" placeholder="Tìm theo tên, mã phiên họp…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {list.length === 0 && <EmptyState icon="calendar" text="Không có phiên họp nào phù hợp" />}
        {list.map((m) => {
          const st = MEETING_STATUS[m.status];
          const d = new Date(m.startTime);
          const accepted = m.participants.filter((p) => p.attendStatus === 'accepted' || p.attendStatus === 'delegated').length;
          return (
            <div className="meeting-row" key={m.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/meetings/${m.id}`)}>
              <div className="m-date">
                <b>{d.getDate()}</b>
                <span>Th{d.getMonth() + 1} · {d.getFullYear() % 100}</span>
              </div>
              <div className="m-main">
                <span className="m-title">{m.title}</span>
                <div className="m-meta">
                  <span><Icon name="info" size={13} />{m.code}</span>
                  <span><Icon name="clock" size={13} />{fmtTime(m.startTime)} – {fmtTime(m.endTime)}</span>
                  <span><Icon name="room" size={13} />{rooms.get(m.roomId)?.name}{m.isOnline ? ' · Trực tuyến' : ''}</span>
                  <span><Icon name="users" size={13} />{accepted}/{m.participants.length} xác nhận</span>
                  <span><Icon name="mic" size={13} />Chủ trì: {users.get(m.chairId)?.fullName}</span>
                </div>
              </div>
              <div className="m-side">
                {m.meetingType && <Badge color="blue">{m.meetingType}</Badge>}
                <Badge color={st.color}>{st.label}</Badge>
                {m.status === 'live' && (
                  <button className="btn success sm" onClick={(e) => { e.stopPropagation(); nav(`/meetings/${m.id}/live`); }}>
                    Vào phòng họp
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && <MeetingFormModal onClose={() => setShowForm(false)} onSaved={(id) => { setShowForm(false); nav(`/meetings/${id}`); }} />}
    </div>
  );
}
