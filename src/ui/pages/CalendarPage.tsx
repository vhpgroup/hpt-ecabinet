// ============================================================
// LỊCH CÔNG TÁC — lịch đơn vị / lịch cá nhân theo tháng
// ============================================================
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { Icon, PageHeader, Badge } from '../components';
import { MEETING_STATUS } from '../../domain/labels';
import { fmtTime, indexBy } from '../format';

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function CalendarPage() {
  const { user, s } = useApp();
  const nav = useNavigate();
  const [anchor, setAnchor] = useState(() => new Date());
  const [scope, setScope] = useState<'unit' | 'mine'>('unit');
  const rooms = indexBy(s.rooms);

  const meetings = useMemo(
    () => scope === 'mine'
      ? s.meetings.filter((m) => m.participants.some((p) => p.userId === user?.id))
      : s.meetings,
    [s.meetings, scope, user],
  );

  const cells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const mondayIdx = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - mondayIdx);
    const out: { date: Date; inMonth: boolean; isToday: boolean; events: typeof meetings }[] = [];
    const today = new Date();
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const events = meetings
        .filter((m) => {
          const t = new Date(m.startTime);
          return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() && t.getDate() === d.getDate();
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      out.push({
        date: d,
        inMonth: d.getMonth() === anchor.getMonth(),
        isToday: d.toDateString() === today.toDateString(),
        events,
      });
    }
    return out;
  }, [anchor, meetings]);

  const monthMeetings = useMemo(
    () => meetings
      .filter((m) => {
        const t = new Date(m.startTime);
        return t.getFullYear() === anchor.getFullYear() && t.getMonth() === anchor.getMonth();
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [meetings, anchor],
  );

  const shift = (n: number) => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));

  return (
    <div>
      <PageHeader
        title="Lịch công tác"
        subtitle="Lịch họp của đơn vị và lịch cá nhân"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={'btn sm' + (scope === 'unit' ? '' : ' outline')} onClick={() => setScope('unit')}>Lịch đơn vị</button>
            <button className={'btn sm' + (scope === 'mine' ? '' : ' outline')} onClick={() => setScope('mine')}>Lịch của tôi</button>
          </div>
        }
      />

      <div className="card card-pad">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)}><Icon name="chevleft" /></button>
          <div className="cal-title">Tháng {anchor.getMonth() + 1}/{anchor.getFullYear()}</div>
          <button className="icon-btn" onClick={() => shift(1)}><Icon name="chevright" /></button>
          <button className="btn outline sm" onClick={() => setAnchor(new Date())}>Hôm nay</button>
        </div>
        <div className="cal-grid">
          {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
          {cells.map((c, i) => (
            <div key={i} className={'cal-cell' + (c.inMonth ? '' : ' dim') + (c.isToday ? ' today' : '')}>
              <div className="d">{c.date.getDate()}</div>
              {c.events.slice(0, 3).map((m) => (
                <a key={m.id} className={'cal-ev' + (m.status === 'live' ? ' live' : m.status === 'finished' ? ' finished' : '')}
                  title={m.title} onClick={() => nav(`/meetings/${m.id}`)} style={{ cursor: 'pointer' }}>
                  {fmtTime(m.startTime)} {m.title}
                </a>
              ))}
              {c.events.length > 3 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{c.events.length - 3} khác</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 17px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 15 }}>Cuộc họp trong tháng {anchor.getMonth() + 1} ({monthMeetings.length})</h3>
        </div>
        {monthMeetings.length === 0 && <div className="empty"><p>Không có cuộc họp trong tháng này</p></div>}
        {monthMeetings.map((m) => {
          const st = MEETING_STATUS[m.status];
          return (
            <div className="meeting-row" key={m.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/meetings/${m.id}`)}>
              <div className="m-date">
                <b>{new Date(m.startTime).getDate()}</b>
                <span>{new Date(m.startTime).toLocaleDateString('vi-VN', { weekday: 'short' })}</span>
              </div>
              <div className="m-main">
                <span className="m-title">{m.title}</span>
                <div className="m-meta">
                  <span><Icon name="clock" size={13} />{fmtTime(m.startTime)} – {fmtTime(m.endTime)}</span>
                  <span><Icon name="room" size={13} />{rooms.get(m.roomId)?.name}</span>
                  <span><Icon name="users" size={13} />{m.participants.length} đại biểu</span>
                </div>
              </div>
              <div className="m-side"><Badge color={st.color}>{st.label}</Badge></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
