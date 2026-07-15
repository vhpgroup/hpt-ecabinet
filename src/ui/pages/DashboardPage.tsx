// ============================================================
// TRANG CHỦ — tổng quan công việc của người dùng hiện tại
// ============================================================
import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { Badge, Icon, StatCard } from '../components';
import { MEETING_STATUS } from '../../domain/labels';
import * as meetingService from '../../services/meetingService';
import { isOverdue } from '../../services/taskService';
import { fmtDate, fmtTime, indexBy, timeAgo } from '../format';

export default function DashboardPage() {
  const { user, s, refresh, toast } = useApp();
  const nav = useNavigate();
  const rooms = indexBy(s.rooms);

  const data = useMemo(() => {
    const uid = user?.id ?? '';
    const myMeetings = s.meetings.filter((m) => m.participants.some((p) => p.userId === uid));
    const live = myMeetings.find((m) => m.status === 'live');
    const upcoming = myMeetings
      .filter((m) => ['invited', 'draft'].includes(m.status) && new Date(m.startTime).getTime() > Date.now() - 3600e3)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const pendingInvites = myMeetings.filter((m) =>
      m.status === 'invited' && m.participants.some((p) => p.userId === uid && p.attendStatus === 'pending'));
    const openVotes = s.votes.filter((v) =>
      v.status === 'open' && v.eligibleIds.includes(uid) && !v.ballots.some((b) => b.userId === uid));
    const myTasks = s.tasks.filter((t) => t.assigneeId === uid && t.status !== 'done');
    const overdue = s.tasks.filter((t) => t.assigneeId === uid && isOverdue(t));
    const openPolls = s.votes.filter((v) => v.kind === 'poll' && v.status === 'open');
    const recentDocs = [...s.documents]
      .filter((d) => d.kind !== 'personal')
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 4);
    const notifs = s.notifications.filter((n) => n.userId === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    return { live, upcoming, pendingInvites, openVotes, myTasks, overdue, openPolls, recentDocs, notifs };
  }, [s, user]);

  const quickAccept = async (meetingId: string) => {
    if (!user) return;
    await meetingService.respondInvitation(user, meetingId, 'accepted');
    await refresh();
    toast('Đã xác nhận tham dự');
  };

  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Xin chào, {user?.fullName}</h1>
          <p className="page-sub" style={{ textTransform: 'capitalize' }}>{today}</p>
        </div>
      </div>

      {data.live && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: '#bfe7d2', background: 'linear-gradient(120deg,#f0fbf5,#ffffff)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="live-banner"><span className="live-dot" />Đang diễn ra</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <b style={{ color: 'var(--navy)', fontSize: 15 }}>{data.live.title}</b>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                {fmtTime(data.live.startTime)} – {fmtTime(data.live.endTime)} · {rooms.get(data.live.roomId)?.name}
              </div>
            </div>
            <button className="btn success" onClick={() => nav(`/meetings/${data.live!.id}/live`)}>
              <Icon name="users" size={16} />Vào phòng họp
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard icon="calendar" label="Phiên họp sắp tới" value={data.upcoming.length} tone="blue" />
        <StatCard icon="clock" label="Giấy mời chờ xác nhận" value={data.pendingInvites.length} tone="amber" />
        <StatCard icon="vote" label="Biểu quyết / lấy ý kiến chờ bạn" value={data.openVotes.length} tone="purple" />
        <StatCard icon="clipboard" label="Nhiệm vụ đang thực hiện" value={data.myTasks.length} tone={data.overdue.length ? 'red' : 'green'}
          hint={data.overdue.length ? `${data.overdue.length} nhiệm vụ quá hạn` : undefined} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 17px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 15 }}>Phiên họp sắp diễn ra</h3>
              <Link to="/meetings" className="btn ghost sm">Tất cả phiên họp</Link>
            </div>
            {data.upcoming.length === 0 && <div className="empty"><p>Không có phiên họp nào sắp diễn ra</p></div>}
            {data.upcoming.slice(0, 5).map((m) => {
              const mine = m.participants.find((p) => p.userId === user?.id);
              const st = MEETING_STATUS[m.status];
              return (
                <div className="meeting-row" key={m.id}>
                  <div className="m-date">
                    <b>{new Date(m.startTime).getDate()}</b>
                    <span>Th{new Date(m.startTime).getMonth() + 1}</span>
                  </div>
                  <div className="m-main">
                    <Link to={`/meetings/${m.id}`} className="m-title">{m.title}</Link>
                    <div className="m-meta">
                      <span><Icon name="clock" size={13} />{fmtTime(m.startTime)} – {fmtTime(m.endTime)}</span>
                      <span><Icon name="room" size={13} />{rooms.get(m.roomId)?.name}{m.isOnline ? ' · Trực tuyến' : ''}</span>
                      <span><Icon name="users" size={13} />{m.participants.length} đại biểu</span>
                    </div>
                  </div>
                  <div className="m-side">
                    <Badge color={st.color}>{st.label}</Badge>
                    {mine?.attendStatus === 'pending' && m.status === 'invited' && (
                      <button className="btn sm" onClick={() => quickAccept(m.id)}>Xác nhận tham dự</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card card-pad">
            <h3 className="card-title"><Icon name="file" size={16} />Tài liệu mới cập nhật</h3>
            {data.recentDocs.map((d) => (
              <div className="doc-item" key={d.id}>
                <div className={'doc-ic' + (d.mime.includes('word') ? ' word' : '')}><Icon name="file" size={17} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="doc-name" onClick={() => nav('/documents')}>{d.name}</div>
                  <div className="doc-sub">{timeAgo(d.uploadedAt)} · phiên bản {d.version}{d.secret ? ' · ' : ''}{d.secret && <Badge color="red">Mật</Badge>}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad">
            <h3 className="card-title"><Icon name="vote" size={16} />Phiếu lấy ý kiến đang mở</h3>
            {data.openPolls.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Không có phiếu lấy ý kiến nào.</p>}
            {data.openPolls.map((p) => {
              const answered = p.ballots.some((b) => b.userId === user?.id);
              const soon = !!p.deadline && new Date(p.deadline).getTime() - Date.now() < 48 * 3600e3;
              return (
                <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px dashed var(--line)' }}>
                  <b style={{ fontSize: 13.5, color: 'var(--navy)' }}>{p.title}</b>
                  {!answered && soon && <Badge color="red">⏰ Sắp đến hạn</Badge>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Hạn: {p.deadline ? `${fmtTime(p.deadline)} ${fmtDate(p.deadline)}` : '—'} · {p.ballots.length}/{p.eligibleIds.length} phản hồi
                    </span>
                    <button className={'btn sm' + (answered ? ' outline' : '')} onClick={() => nav('/polls')}>
                      {answered ? 'Xem' : 'Cho ý kiến'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card card-pad">
            <h3 className="card-title"><Icon name="bell" size={16} />Thông báo mới</h3>
            {data.notifs.map((n) => (
              <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
                <b style={{ fontSize: 13, color: n.read ? 'var(--text)' : 'var(--primary)' }}>{n.title}</b>
                <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{n.body}</p>
                <small style={{ fontSize: 11, color: '#93a5ba' }}>{timeAgo(n.createdAt)}</small>
              </div>
            ))}
            {data.notifs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Chưa có thông báo.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
