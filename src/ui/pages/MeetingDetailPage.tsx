// ============================================================
// CHI TIẾT PHIÊN HỌP — thông tin, đại biểu, tài liệu, biểu quyết,
// kết luận & biên bản (ký số), nhiệm vụ sau họp
// ============================================================
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DocFile, Meeting, User, Vote } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Avatar, Badge, EmptyState, Field, Icon, Modal, PageHeader, ProgressBar, QRSvg, SeatGrid, VoteOutcomePanel, VoteResultBars, defaultLayout, seatKey } from '../components';
import { ATTEND_STATUS, DOC_REVIEW, MEETING_ROLE, MEETING_STATUS, TASK_STATUS } from '../../domain/labels';
import { can } from '../../services/authService';
import * as meetingService from '../../services/meetingService';
import * as voteService from '../../services/voteService';
import * as documentService from '../../services/documentService';
import * as catalogService from '../../services/catalogService';
import * as taskService from '../../services/taskService';
import { downloadTextFile, fmtDate, fmtDT, fmtTime, indexBy, initials, timeAgo, toCsv, toLocalInput, fromLocalInput } from '../format';
import MeetingFormModal from './MeetingFormModal';
import { DocReviewControls, DocRow, DocViewerModal } from './shared';

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, s, refresh, toast } = useApp();
  const nav = useNavigate();
  const m = s.meetings.find((x) => x.id === id);
  const [tab, setTab] = useState('info');
  const [viewDoc, setViewDoc] = useState<DocFile | null>(null);
  const [editing, setEditing] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const users = useMemo(() => indexBy(s.users), [s.users]);
  const rooms = useMemo(() => indexBy(s.rooms), [s.rooms]);

  if (!m) {
    return <EmptyState icon="calendar" text="Không tìm thấy phiên họp" />;
  }

  const manage = can.manageMeetings(user);
  const chairCtl = can.chairControls(user, m.chairId, m.secretaryId);
  const mine = m.participants.find((p) => p.userId === user?.id);
  const st = MEETING_STATUS[m.status];
  const meetingVotes = s.votes.filter((v) => v.meetingId === m.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const meetingDocs = s.documents.filter((d) => d.meetingId === m.id);
  const meetingTasks = s.tasks.filter((t) => t.meetingId === m.id);

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      await refresh();
      if (msg) toast(msg);
    } catch (ex) {
      toast((ex as Error).message, 'error');
    }
  };

  return (
    <div>
      <Link to="/meetings" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <Icon name="chevleft" size={15} />Danh sách phiên họp
      </Link>
      <PageHeader
        title={<span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{m.title}<Badge color={st.color}>{st.label}</Badge></span>}
        subtitle={`Mã: ${m.code} · ${fmtDT(m.startTime)} → ${fmtTime(m.endTime)} · ${rooms.get(m.roomId)?.name ?? ''}${m.isOnline ? ' · Kết hợp trực tuyến' : ''}`}
        actions={
          <>
            {m.status === 'draft' && manage && (
              <>
                <button className="btn" onClick={() => act(() => meetingService.sendInvitations(user!, m.id), 'Đã gửi giấy mời đến các đại biểu (email + SMS mô phỏng)')}>
                  <Icon name="send" size={15} />Gửi giấy mời
                </button>
                <button className="btn outline" onClick={() => setEditing(true)}><Icon name="edit" size={15} />Chỉnh sửa</button>
                <button className="btn danger" onClick={() => { if (window.confirm('Xóa phiên họp này?')) act(async () => { await meetingService.deleteMeeting(user!, m.id); nav('/meetings'); }, 'Đã xóa phiên họp'); }}>
                  <Icon name="trash" size={15} />
                </button>
              </>
            )}
            {m.status === 'invited' && (
              <>
                {chairCtl && (
                  <button className="btn success" onClick={() => act(async () => { await meetingService.startMeeting(user!, m.id); nav(`/meetings/${m.id}/live`); })}>
                    <Icon name="mic" size={15} />Bắt đầu phiên họp
                  </button>
                )}
                {manage && <button className="btn outline" onClick={() => setEditing(true)}><Icon name="edit" size={15} />Chỉnh sửa</button>}
              </>
            )}
            {m.status === 'live' && (
              <>
                <button className="btn success" onClick={() => nav(`/meetings/${m.id}/live`)}><Icon name="users" size={15} />Vào phòng họp</button>
                {m.isOnline && <button className="btn outline" onClick={() => nav(`/meetings/${m.id}/online`)}><Icon name="video" size={15} />Họp trực tuyến</button>}
                <button className="btn outline" title="Chế độ trình chiếu cho màn hình TV tại phòng họp" onClick={() => nav(`/meetings/${m.id}/screen`)}>
                  <Icon name="monitor" size={15} />Màn hình TV
                </button>
              </>
            )}
            {m.status === 'finished' && (
              <button className="btn outline" onClick={() => setTab('minutes')}><Icon name="printer" size={15} />Biên bản phiên họp</button>
            )}
          </>
        }
      />

      {mine?.attendStatus === 'pending' && m.status === 'invited' && (
        <div className="card card-pad" style={{ marginBottom: 16, background: '#fffaf0', borderColor: '#f3ddb3' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Icon name="info" size={18} />
            <b style={{ flex: 1, minWidth: 200, fontSize: 13.5 }}>Bạn được mời tham dự phiên họp này. Vui lòng phản hồi giấy mời.</b>
            <button className="btn success sm" onClick={() => act(() => meetingService.respondInvitation(user!, m.id, 'accepted'), 'Đã xác nhận tham dự')}>
              <Icon name="check" size={14} />Tham dự
            </button>
            <button className="btn outline sm" onClick={() => setDelegateOpen(true)}>Ủy quyền</button>
            <button className="btn danger sm" onClick={() => setDeclineOpen(true)}>Báo vắng</button>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={'tab' + (tab === 'info' ? ' active' : '')} onClick={() => setTab('info')}><Icon name="info" size={15} />Thông tin & Chương trình</button>
        <button className={'tab' + (tab === 'people' ? ' active' : '')} onClick={() => setTab('people')}><Icon name="users" size={15} />Đại biểu<Badge color="gray">{m.participants.length}</Badge></button>
        <button className={'tab' + (tab === 'seating' ? ' active' : '')} onClick={() => setTab('seating')}><Icon name="room" size={15} />Sơ đồ chỗ ngồi</button>
        <button className={'tab' + (tab === 'docs' ? ' active' : '')} onClick={() => setTab('docs')}><Icon name="file" size={15} />Tài liệu<Badge color="gray">{meetingDocs.length}</Badge></button>
        <button className={'tab' + (tab === 'votes' ? ' active' : '')} onClick={() => setTab('votes')}><Icon name="vote" size={15} />Biểu quyết<Badge color="gray">{meetingVotes.length}</Badge></button>
        <button className={'tab' + (tab === 'minutes' ? ' active' : '')} onClick={() => setTab('minutes')}><Icon name="pen" size={15} />Kết luận & Biên bản</button>
        <button className={'tab' + (tab === 'tasks' ? ' active' : '')} onClick={() => setTab('tasks')}><Icon name="clipboard" size={15} />Nhiệm vụ<Badge color="gray">{meetingTasks.length}</Badge></button>
      </div>

      {tab === 'info' && <InfoTab m={m} onViewDoc={setViewDoc} />}
      {tab === 'people' && <PeopleTab m={m} onQr={() => setQrOpen(true)} />}
      {tab === 'seating' && <SeatingTab m={m} />}
      {tab === 'docs' && <DocsTab m={m} onViewDoc={setViewDoc} />}
      {tab === 'votes' && <VotesTab m={m} votes={meetingVotes} onViewDoc={setViewDoc} />}
      {tab === 'minutes' && <MinutesTab m={m} votes={meetingVotes} />}
      {tab === 'tasks' && <TasksTab m={m} tasks={meetingTasks} />}

      {viewDoc && <DocViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
      {editing && <MeetingFormModal initial={m} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {qrOpen && (
        <Modal title="Mã QR điểm danh" onClose={() => setQrOpen(false)} width={340}>
          <div style={{ textAlign: 'center' }}>
            <QRSvg seed={m.id + m.code} />
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
              Đại biểu quét mã bằng thiết bị tại cửa phòng họp để điểm danh (mô phỏng).
            </p>
          </div>
        </Modal>
      )}
      {declineOpen && (
        <DeclineModal onClose={() => setDeclineOpen(false)} onSubmit={(reason) =>
          act(async () => { await meetingService.respondInvitation(user!, m.id, 'declined', { reason }); setDeclineOpen(false); }, 'Đã gửi báo vắng')} />
      )}
      {delegateOpen && (
        <DelegateModal onClose={() => setDelegateOpen(false)}
          candidates={s.users.filter((u) => u.id !== user?.id && u.status === 'active')}
          onSubmit={(uid2) => act(async () => { await meetingService.respondInvitation(user!, m.id, 'delegated', { delegateToId: uid2 }); setDelegateOpen(false); }, 'Đã gửi ủy quyền tham dự')} />
      )}
    </div>
  );
}

// ---------------- Tab: Thông tin & chương trình ----------------
function InfoTab({ m, onViewDoc }: { m: Meeting; onViewDoc: (d: DocFile) => void }) {
  const { s } = useApp();
  const users = indexBy(s.users);
  const rooms = indexBy(s.rooms);
  const docById = indexBy(s.documents);
  const rows: [string, React.ReactNode][] = [
    ['Thời gian', `${fmtDT(m.startTime)} → ${fmtTime(m.endTime)}`],
    ['Loại phiên họp', m.meetingType ? <Badge color="blue">{m.meetingType}</Badge> : '—'],
    ['Địa điểm', `${rooms.get(m.roomId)?.name ?? '—'} — ${rooms.get(m.roomId)?.location ?? ''}`],
    ['Hình thức', m.isOnline ? 'Trực tiếp kết hợp trực tuyến' : 'Trực tiếp'],
    ['Chủ trì', `${users.get(m.chairId)?.fullName ?? '—'} — ${users.get(m.chairId)?.title ?? ''}`],
    ['Thư ký', `${users.get(m.secretaryId)?.fullName ?? '—'} — ${users.get(m.secretaryId)?.title ?? ''}`],
    ['Người tạo', `${users.get(m.createdBy)?.fullName ?? '—'} · ${fmtDate(m.createdAt)}`],
    ['Giấy mời', m.invitedAt ? `Đã gửi lúc ${fmtDT(m.invitedAt)}` : 'Chưa gửi'],
  ];
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
      <div className="card card-pad">
        <h3 className="card-title"><Icon name="info" size={16} />Thông tin chung</h3>
        {m.description && <p style={{ fontSize: 13.5, marginBottom: 14, color: 'var(--text)' }}>{m.description}</p>}
        <table style={{ fontSize: 13.5, borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: '6px 10px 6px 0', color: 'var(--muted)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td>
                <td style={{ padding: '6px 0', fontWeight: 500 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card card-pad">
        <h3 className="card-title"><Icon name="list" size={16} />Chương trình phiên họp</h3>
        {m.agenda.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Chưa xây dựng chương trình.</p>}
        {m.agenda.map((a) => (
          <div key={a.id} className={'agenda-item' + (m.status === 'live' && m.currentAgendaItemId === a.id ? ' current' : '')}>
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span className="agenda-no">{a.order}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13.5, color: 'var(--navy)' }}>{a.title}</b>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {a.presenterId ? `Trình bày: ${users.get(a.presenterId)?.fullName}` : 'Chưa phân công'} · {a.durationMinutes} phút
                  {m.status === 'live' && m.currentAgendaItemId === a.id && <Badge color="green"> Đang thảo luận</Badge>}
                </div>
                {a.documentIds.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {a.documentIds.map((did) => {
                      const d = docById.get(did);
                      return d ? <DocRow key={did} doc={d} onView={onViewDoc} /> : null;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Tab: Đại biểu ----------------
function PeopleTab({ m, onQr }: { m: Meeting; onQr: () => void }) {
  const { s, toast } = useApp();
  const users = indexBy(s.users);
  const units = indexBy(s.units);

  // E-HSMT mục 36: xuất danh sách điểm danh ra CSV (client-side)
  const exportAttendance = () => {
    const { headers, rows } = meetingService.buildAttendanceRows(m, users, units);
    const csv = toCsv(headers, rows);
    downloadTextFile(`diemdanh_${m.code.replace(/[^\p{L}\p{N}._-]+/gu, '_')}.csv`, csv);
    toast('Đã xuất danh sách điểm danh (CSV)');
  };

  const stats = {
    accepted: m.participants.filter((p) => p.attendStatus === 'accepted').length,
    declined: m.participants.filter((p) => p.attendStatus === 'declined').length,
    delegated: m.participants.filter((p) => p.attendStatus === 'delegated').length,
    pending: m.participants.filter((p) => p.attendStatus === 'pending').length,
    present: m.participants.filter((p) => p.checkedInAt).length,
  };
  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge color="green">Tham dự: {stats.accepted}</Badge>
        <Badge color="purple">Ủy quyền: {stats.delegated}</Badge>
        <Badge color="red">Vắng: {stats.declined}</Badge>
        <Badge color="amber">Chờ xác nhận: {stats.pending}</Badge>
        <Badge color="navy">Đã điểm danh: {stats.present}/{m.participants.length}</Badge>
        <span style={{ flex: 1 }} />
        <button className="btn outline sm" onClick={exportAttendance}><Icon name="download" size={14} />Xuất DS điểm danh</button>
        <button className="btn outline sm" onClick={onQr}><Icon name="qr" size={14} />Mã QR điểm danh</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Đại biểu</th><th>Đơn vị</th><th>Vai trò</th><th>Xác nhận</th><th>Điểm danh</th><th>Chỗ ngồi</th></tr>
          </thead>
          <tbody>
            {m.participants.map((p) => {
              const u = users.get(p.userId);
              const a = ATTEND_STATUS[p.attendStatus];
              return (
                <tr key={p.userId}>
                  <td>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Avatar user={u} size={32} />
                      <div>
                        <div className="t-title">{u?.fullName}</div>
                        <div className="t-sub">{u?.title}</div>
                      </div>
                    </div>
                  </td>
                  <td>{units.get(u?.unitId ?? '')?.short ?? '—'}</td>
                  <td><Badge color={p.meetingRole === 'chair' ? 'navy' : p.meetingRole === 'secretary' ? 'purple' : 'gray'}>{MEETING_ROLE[p.meetingRole]}</Badge></td>
                  <td>
                    <Badge color={a.color}>{a.label}</Badge>
                    {p.attendStatus === 'delegated' && p.delegateToId && (
                      <div className="t-sub">→ {users.get(p.delegateToId)?.fullName}</div>
                    )}
                    {p.attendStatus === 'declined' && p.declineReason && <div className="t-sub">{p.declineReason}</div>}
                  </td>
                  <td>{p.checkedInAt ? <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 12.5 }}>✓ {fmtTime(p.checkedInAt)}</span> : <span className="t-sub">—</span>}</td>
                  <td>{p.seat ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- Tab: Sơ đồ chỗ ngồi (E-HSMT mục 38) ----------------
function SeatingTab({ m }: { m: Meeting }) {
  const { user, s, refresh, toast } = useApp();
  const users = useMemo(() => indexBy(s.users), [s.users]);
  const room = s.rooms.find((r) => r.id === m.roomId);
  const layout = room?.layout ?? defaultLayout(room?.capacity ?? 24);
  const manage = can.manageMeetings(user);
  // đại biểu đang được chọn để gán ghế (chỉ manage)
  const [selectedUser, setSelectedUser] = useState<string>('');

  const assignments = m.seatAssignments ?? {};
  // bản đồ ngược: khóa ghế -> userId
  const bySeat = useMemo(() => {
    const map = new Map<string, string>();
    for (const [uidX, sk] of Object.entries(assignments)) map.set(sk, uidX);
    return map;
  }, [assignments]);

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); await refresh(); if (msg) toast(msg); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  const onCell = (r: number, c: number) => {
    if (!manage) return;
    const key = seatKey(r, c);
    const occupant = bySeat.get(key);
    if (occupant) {
      // bấm vào ghế đã có người: bỏ gán
      act(() => meetingService.assignSeat(user!, m.id, occupant, null), 'Đã bỏ gán vị trí');
      return;
    }
    if (!selectedUser) { toast('Chọn một đại biểu trong danh sách bên trái trước', 'info'); return; }
    act(() => meetingService.assignSeat(user!, m.id, selectedUser, key), 'Đã gán vị trí đại biểu');
  };

  const unassigned = m.participants.filter((p) => !assignments[p.userId]);

  return (
    <div className="grid" style={{ gridTemplateColumns: manage ? '300px 1fr' : '1fr' }}>
      {manage && (
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="users" size={16} />Thành phần dự họp</h3>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
            Chọn đại biểu rồi bấm vào ghế để gán. Bấm ghế đã có người để bỏ gán.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '52vh', overflowY: 'auto' }}>
            {m.participants.map((p) => {
              const u = users.get(p.userId);
              const seat = assignments[p.userId];
              return (
                <button key={p.userId}
                  className={'btn sm' + (selectedUser === p.userId ? '' : ' outline')}
                  style={{ justifyContent: 'flex-start', gap: 8 }}
                  onClick={() => setSelectedUser(selectedUser === p.userId ? '' : p.userId)}>
                  <Avatar user={u} size={22} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{u?.fullName}</span>
                  {seat
                    ? <Badge color="green">{seat.split('-').map((n) => Number(n) + 1).join('-')}</Badge>
                    : <span style={{ fontSize: 11, color: 'var(--muted)' }}>chưa xếp</span>}
                </button>
              );
            })}
          </div>
          {unassigned.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Còn {unassigned.length} đại biểu chưa xếp chỗ.</p>
          )}
        </div>
      )}
      <div className="card card-pad">
        <h3 className="card-title"><Icon name="room" size={16} />Sơ đồ {room?.name ?? 'phòng họp'}</h3>
        <SeatGrid layout={layout} onCellClick={manage ? onCell : undefined}
          render={(r, c) => {
            const key = seatKey(r, c);
            const occupant = bySeat.get(key);
            if (!occupant) return { label: <span className="seat-code">{r + 1}-{c + 1}</span> };
            const u = users.get(occupant);
            return {
              cls: 'assigned',
              label: <span>{u ? initials(u.fullName) : '?'}</span>,
              title: `${u?.fullName ?? ''}${u?.title ? ` — ${u.title}` : ''}`,
            };
          }} />
        <div className="seatmap-legend">
          <span><span className="dot" style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary)' }} />Đã gán đại biểu</span>
          <span><span className="dot" style={{ background: '#fff', borderColor: 'var(--line-2)' }} />Ghế trống</span>
          {!manage && <span style={{ color: 'var(--muted)' }}>· Chỉ chủ trì/thư ký được gán vị trí</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------- Tab: Tài liệu ----------------
function DocsTab({ m, onViewDoc }: { m: Meeting; onViewDoc: (d: DocFile) => void }) {
  const { user, s, refresh, toast } = useApp();
  const [upOpen, setUpOpen] = useState(false);
  const manage = can.manageMeetings(user);
  const docById = indexBy(s.documents);
  // E-HSMT mục 24: đại biểu thường chỉ thấy tài liệu ĐÃ DUYỆT (owner/manage thấy mọi trạng thái)
  const canSee = (d: DocFile) =>
    manage || d.ownerId === user?.id || documentService.isApproved(d);
  const refDocs = s.documents.filter((d) => d.meetingId === m.id && d.kind === 'reference' && canSee(d));
  // hàng đợi duyệt trong phiên họp (chỉ quản lý)
  const pendingDocs = s.documents.filter((d) => d.meetingId === m.id && d.reviewStatus === 'pending');

  return (
    <div>
      {manage && (
        <div style={{ marginBottom: 14 }}>
          <button className="btn" onClick={() => setUpOpen(true)}><Icon name="paperclip" size={15} />Thêm tài liệu vào phiên họp</button>
        </div>
      )}
      {/* Hàng đợi duyệt trong phiên họp */}
      {manage && pendingDocs.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: '#f3ddb3', background: '#fffaf0' }}>
          <h3 className="card-title" style={{ marginBottom: 10 }}><Icon name="clock" size={16} />Tài liệu chờ duyệt <Badge color="amber">{pendingDocs.length}</Badge></h3>
          {pendingDocs.map((d) => <DocRow key={d.id} doc={d} onView={onViewDoc} extra={<DocReviewControls doc={d} />} />)}
        </div>
      )}
      <div className="grid grid-2">
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="file" size={16} />Tài liệu chính theo chương trình</h3>
          {m.agenda.map((a) => (
            <div key={a.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Mục {a.order}. {a.title}</div>
              {a.documentIds.filter((did) => { const d = docById.get(did); return d && canSee(d); }).length === 0 && <p style={{ fontSize: 12.5, color: '#9aabc0', marginLeft: 4 }}>Chưa có tài liệu</p>}
              {a.documentIds.map((did) => {
                const d = docById.get(did);
                return d && canSee(d) ? <DocRow key={did} doc={d} onView={onViewDoc} extra={<DocReviewControls doc={d} />} /> : null;
              })}
            </div>
          ))}
        </div>
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="paperclip" size={16} />Tài liệu tham khảo</h3>
          {refDocs.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Không có tài liệu tham khảo.</p>}
          {refDocs.map((d) => <DocRow key={d.id} doc={d} onView={onViewDoc} extra={<DocReviewControls doc={d} />} />)}
        </div>
      </div>
      {upOpen && <UploadModal m={m} onClose={() => setUpOpen(false)} onDone={async () => { setUpOpen(false); await refresh(); toast('Đã thêm tài liệu'); }} />}
    </div>
  );
}

function UploadModal({ m, onClose, onDone }: { m: Meeting; onClose: () => void; onDone: () => void }) {
  const { user, s } = useApp();
  const issuingBodies = catalogService.catalogNames(s.catalogs, 'issuingBody');
  const [kind, setKind] = useState<'main' | 'reference'>('main');
  const [agendaItemId, setAgendaItemId] = useState(m.agenda[0]?.id ?? '');
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [secret, setSecret] = useState(false);
  const [issuingBody, setIssuingBody] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!user) return;
    setErr('');
    try {
      let doc: DocFile;
      const opts = { meetingId: m.id, agendaItemId: kind === 'main' ? agendaItemId : null, secret, issuingBody: issuingBody.trim() || undefined };
      if (mode === 'file') {
        if (!file) return setErr('Chọn tệp cần tải lên');
        doc = await documentService.addFileDocument(user, file, kind, opts);
      } else {
        if (!name.trim() || !content.trim()) return setErr('Nhập tên và nội dung tài liệu');
        doc = await documentService.addTextDocument(user, name.trim(), content, kind, opts);
      }
      if (kind === 'main' && agendaItemId) await documentService.attachToAgenda(user, doc.id, m.id, agendaItemId);
      onDone();
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  return (
    <Modal title="Thêm tài liệu phiên họp" onClose={onClose}
      footer={<>
        {err && <span style={{ color: 'var(--red)', fontSize: 13, marginRight: 'auto' }}>{err}</span>}
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={submit}>Thêm tài liệu</button>
      </>}>
      <div className="form-row">
        <Field label="Loại tài liệu">
          <select className="sel" value={kind} onChange={(e) => setKind(e.target.value as 'main' | 'reference')}>
            <option value="main">Tài liệu chính (gắn vào mục chương trình)</option>
            <option value="reference">Tài liệu tham khảo</option>
          </select>
        </Field>
        {kind === 'main' && (
          <Field label="Thuộc mục chương trình">
            <select className="sel" value={agendaItemId} onChange={(e) => setAgendaItemId(e.target.value)}>
              {m.agenda.map((a) => <option key={a.id} value={a.id}>Mục {a.order}. {a.title}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={'btn sm' + (mode === 'file' ? '' : ' outline')} onClick={() => setMode('file')}>Tải tệp lên</button>
        <button className={'btn sm' + (mode === 'text' ? '' : ' outline')} onClick={() => setMode('text')}>Soạn nội dung</button>
      </div>
      {mode === 'file' ? (
        <Field label="Tệp tài liệu (PDF, ảnh… ≤ 1,5MB)">
          <input type="file" className="inp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
      ) : (
        <>
          <Field label="Tên tài liệu"><input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Tờ trình về..." /></Field>
          <Field label="Nội dung"><textarea className="ta" style={{ minHeight: 140 }} value={content} onChange={(e) => setContent(e.target.value)} /></Field>
        </>
      )}
      <Field label="Cơ quan ban hành">
        {issuingBodies.length > 0 ? (
          <select className="sel" value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)}>
            <option value="">— Không xác định —</option>
            {issuingBody && !issuingBodies.includes(issuingBody) && <option value={issuingBody}>{issuingBody}</option>}
            {issuingBodies.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        ) : (
          <input className="inp" placeholder="Nhập cơ quan ban hành (danh mục trống)" value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} />
        )}
      </Field>
      <label className="checkline"><input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />Tài liệu mật (chỉ đại biểu phiên họp)</label>
    </Modal>
  );
}

// ---------------- Tab: Biểu quyết ----------------
function VotesTab({ m, votes, onViewDoc }: { m: Meeting; votes: Vote[]; onViewDoc: (d: DocFile) => void }) {
  const { user, s, refresh, toast } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const chairCtl = can.chairControls(user, m.chairId, m.secretaryId);
  const docById = indexBy(s.documents);
  const users = indexBy(s.users);

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); await refresh(); if (msg) toast(msg); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  return (
    <div>
      {chairCtl && (
        <div style={{ marginBottom: 14 }}>
          <button className="btn" onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} />Tạo nội dung biểu quyết</button>
        </div>
      )}
      {votes.length === 0 && <div className="card"><EmptyState icon="vote" text="Chưa có nội dung biểu quyết nào" /></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {votes.map((v) => (
          <VoteCard key={v.id} v={v} chairCtl={chairCtl} act={act} onViewDoc={(did) => { const d = docById.get(did); if (d) onViewDoc(d); }} usersMap={users} />
        ))}
      </div>
      {createOpen && <VoteCreateModal m={m} onClose={() => setCreateOpen(false)} onDone={async () => { setCreateOpen(false); await refresh(); toast('Đã tạo nội dung biểu quyết'); }} />}
    </div>
  );
}

export function VoteCard({ v, chairCtl, act, onViewDoc, usersMap, compact }: {
  v: Vote; chairCtl: boolean;
  act: (fn: () => Promise<unknown>, msg?: string) => Promise<void>;
  onViewDoc?: (docId: string) => void;
  usersMap: Map<string, User>;
  compact?: boolean;
}) {
  const { user } = useApp();
  const [optionId, setOptionId] = useState('');
  const [comment, setComment] = useState('');
  const stv = v.status === 'open' ? { label: 'Đang biểu quyết', color: 'green' } : v.status === 'closed' ? { label: 'Đã kết thúc', color: 'navy' } : { label: 'Chưa mở', color: 'gray' };
  const myBallot = v.ballots.find((b) => b.userId === user?.id);
  const eligible = !!user && v.eligibleIds.includes(user.id);
  const canVoteNow = v.status === 'open' && eligible && !myBallot;
  const showResults = v.status === 'closed' || myBallot || chairCtl;
  const comments = v.ballots.filter((b) => b.comment);
  const isPoll = v.kind === 'poll';
  const outcome = voteService.voteOutcome(v);

  // E-HSMT mục 42: "Xem đại biểu sẵn sàng biểu quyết" — khi đang mở & là chủ tọa,
  // hiển thị AI ĐÃ / CHƯA biểu quyết (KHÔNG lộ chọn gì). Với phiếu kín: chỉ dựa vào
  // việc có bỏ phiếu hay không (userId của ballot), không đọc optionId -> không lộ nội dung.
  const readyPanel = chairCtl && v.status === 'open' ? (() => {
    // tập userId đã bỏ phiếu (một số ballot phiếu kín có thể bị ẩn userId với người thường,
    // nhưng chủ tọa/quản lý vẫn thấy userId theo access.js projectVote)
    const votedIds = new Set(v.ballots.map((b) => b.userId).filter(Boolean) as string[]);
    const votedCount = votedIds.size;
    // nếu số ballot > số userId thấy được (phiếu kín ẩn danh với người xem) -> dùng số ballot
    const doneCount = Math.max(votedCount, v.ballots.length);
    const notYet = v.eligibleIds.filter((id) => !votedIds.has(id));
    // chỉ liệt kê tên khi biết chắc ai chưa bỏ (votedIds phản ánh đúng số ballot)
    const canListNames = votedCount === v.ballots.length;
    return { doneCount, total: v.eligibleIds.length, notYet, canListNames };
  })() : null;

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b style={{ color: 'var(--navy)', fontSize: 14.5 }}>{v.title}</b>
          {v.description && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{v.description}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <Badge color={stv.color}>{stv.label}</Badge>
            {!isPoll && v.status === 'closed' && (
              <Badge color={outcome.approved ? 'green' : 'red'}>{outcome.label}</Badge>
            )}
            {v.secret && <Badge color="gold">Biểu quyết kín</Badge>}
            {v.documentIds.map((did) => onViewDoc && (
              <button key={did} className="btn ghost sm" onClick={() => onViewDoc(did)}><Icon name="file" size={13} />Tài liệu kèm theo</button>
            ))}
          </div>
        </div>
        {chairCtl && v.status === 'pending' && (
          <button className="btn success sm" onClick={() => act(() => voteService.openVote(user!, v.id), 'Đã mở biểu quyết')}>Mở biểu quyết</button>
        )}
        {chairCtl && v.status === 'open' && (
          <button className="btn danger sm" onClick={() => act(() => voteService.closeVote(user!, v.id), 'Đã đóng biểu quyết')}>Đóng biểu quyết</button>
        )}
      </div>

      {canVoteNow && (
        <div style={{ marginTop: 12, background: '#f4f8fd', border: '1px solid #d7e5f5', borderRadius: 11, padding: '12px 14px' }}>
          <b style={{ fontSize: 13 }}>Ý kiến của bạn:</b>
          <div style={{ display: 'flex', gap: 14, margin: '8px 0', flexWrap: 'wrap' }}>
            {v.options.map((o) => (
              <label key={o.id} className="checkline" style={{ marginBottom: 0 }}>
                <input type="radio" name={'v' + v.id} checked={optionId === o.id} onChange={() => setOptionId(o.id)} />
                {o.label}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="inp" placeholder="Ý kiến bổ sung (không bắt buộc)…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn" disabled={!optionId}
              onClick={() => act(async () => { await voteService.castBallot(user!, v.id, optionId, comment.trim() || undefined); setComment(''); }, 'Đã ghi nhận biểu quyết của bạn')}>
              <Icon name="vote" size={15} />Biểu quyết
            </button>
          </div>
        </div>
      )}
      {myBallot && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: 'var(--green)', fontWeight: 600 }}>
          ✓ Bạn đã biểu quyết: {v.options.find((o) => o.id === myBallot.optionId)?.label} · {fmtTime(myBallot.castAt)}
        </p>
      )}

      {/* E-HSMT mục 42 — trạng thái sẵn sàng biểu quyết (chỉ chủ tọa, khi đang mở) */}
      {readyPanel && (
        <div style={{ marginTop: 12, background: '#f4f8fd', border: '1px solid #d7e5f5', borderRadius: 11, padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Icon name="check" size={15} />
            <b style={{ fontSize: 13 }}>Đã biểu quyết {readyPanel.doneCount}/{readyPanel.total}</b>
            {v.secret && <Badge color="gold">Phiếu kín — chỉ hiện đã/chưa</Badge>}
          </div>
          {readyPanel.notYet.length > 0 ? (
            readyPanel.canListNames ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
                Chưa biểu quyết ({readyPanel.notYet.length}):{' '}
                {readyPanel.notYet.map((id) => usersMap.get(id)?.fullName ?? id).join(', ')}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
                Còn {readyPanel.notYet.length} đại biểu chưa biểu quyết.
              </div>
            )
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--green)', marginTop: 6 }}>Tất cả đại biểu đã biểu quyết.</div>
          )}
        </div>
      )}

      {showResults && (
        <div style={{ marginTop: 12 }}>
          {compact ? (
            // compact: chỉ badge kết luận + dòng tán thành/tổng (không vẽ đầy đủ)
            !isPoll && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                <Badge color={v.status === 'closed' ? (outcome.approved ? 'green' : 'red') : v.status === 'open' ? 'amber' : 'gray'}>{outcome.label}</Badge>
                <span style={{ color: 'var(--muted)' }}>Tán thành {outcome.approve}/{outcome.totalEligible} · cần ≥ {outcome.required}</span>
              </div>
            )
          ) : (
            <>
              {!isPoll && <VoteOutcomePanel vote={v} />}
              <VoteResultBars vote={v} />
              {comments.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <b style={{ fontSize: 12.5, color: 'var(--muted)' }}>Ý kiến kèm theo:</b>
                  {comments.map((b, i) => (
                    <div key={i} className="anno" style={{ marginTop: 6 }}>
                      {b.comment}
                      <small>{v.secret ? 'Đại biểu (ẩn danh)' : usersMap.get(b.userId)?.fullName ?? '—'}</small>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VoteCreateModal({ m, onClose, onDone }: { m: Meeting; onClose: () => void; onDone: () => void }) {
  const { user } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agendaItemId, setAgendaItemId] = useState(m.agenda[0]?.id ?? '');
  const [opts, setOpts] = useState(['Đồng ý', 'Không đồng ý', 'Ý kiến khác']);
  const [secret, setSecret] = useState(false);
  const [openNow, setOpenNow] = useState(m.status === 'live');
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) return setErr('Nhập nội dung biểu quyết');
    try {
      const v = await voteService.createVote(user, {
        kind: 'vote', meetingId: m.id, agendaItemId: agendaItemId || null,
        title: title.trim(), description: description.trim() || undefined,
        optionLabels: opts, secret, documentIds: [],
        // khách mời không thuộc thành phần biểu quyết
        eligibleIds: m.participants.filter((p) => p.attendStatus !== 'declined' && p.meetingRole !== 'guest').map((p) => p.userId),
      });
      if (openNow) await voteService.openVote(user, v.id);
      onDone();
    } catch (ex) { setErr((ex as Error).message); }
  };

  return (
    <Modal title="Tạo nội dung biểu quyết" onClose={onClose}
      footer={<>
        {err && <span style={{ color: 'var(--red)', fontSize: 13, marginRight: 'auto' }}>{err}</span>}
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={submit}>Tạo</button>
      </>}>
      <Field label="Nội dung biểu quyết" required>
        <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Thông qua dự thảo Nghị quyết…" />
      </Field>
      <Field label="Mô tả"><textarea className="ta" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Thuộc mục chương trình">
        <select className="sel" value={agendaItemId} onChange={(e) => setAgendaItemId(e.target.value)}>
          <option value="">— Không gắn mục —</option>
          {m.agenda.map((a) => <option key={a.id} value={a.id}>Mục {a.order}. {a.title}</option>)}
        </select>
      </Field>
      <Field label="Các phương án">
        {opts.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input className="inp" value={o} onChange={(e) => setOpts(opts.map((x, ix) => ix === i ? e.target.value : x))} />
            <button className="icon-btn" onClick={() => setOpts(opts.filter((_, ix) => ix !== i))}><Icon name="trash" size={15} /></button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setOpts([...opts, ''])}><Icon name="plus" size={14} />Thêm phương án</button>
      </Field>
      <label className="checkline"><input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />Biểu quyết kín (ẩn danh tính)</label>
      <label className="checkline"><input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} />Mở biểu quyết ngay sau khi tạo</label>
    </Modal>
  );
}

// ---------------- Tab: Kết luận & Biên bản ----------------
function MinutesTab({ m, votes }: { m: Meeting; votes: Vote[] }) {
  const { user, s, refresh, toast } = useApp();
  const [conclusion, setConclusion] = useState('');
  const [conclusionAgenda, setConclusionAgenda] = useState('');
  const [minText, setMinText] = useState(m.minutes?.content ?? '');
  const [signOpen, setSignOpen] = useState(false);
  const chairCtl = can.chairControls(user, m.chairId, m.secretaryId);
  const canSign = can.signMinutes(user, m.chairId, m.secretaryId);
  const users = indexBy(s.users);
  const alreadySigned = m.minutes?.signatures.some((x) => x.signerId === user?.id);

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); await refresh(); if (msg) toast(msg); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  const makeDraft = () => {
    const summaries = votes.filter((v) => v.status === 'closed').map((v) => voteService.voteSummaryLine(v, true));
    // tổng hợp góp ý công khai trên các tài liệu của phiên họp
    const meetingDocIds = new Set(s.documents.filter((d) => d.meetingId === m.id).map((d) => d.id));
    const docComments = s.annotations
      .filter((a) => a.isPublic && meetingDocIds.has(a.docId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((a) => {
        const d = s.documents.find((x) => x.id === a.docId);
        const u = s.users.find((x) => x.id === a.userId);
        return `- [${d?.name ?? ''}] ${u?.fullName ?? ''}: ${a.content}`;
      });
    // cấp số biên bản theo NĐ 30/2020 nếu phiên chưa có (ký hiệu theo đơn vị chủ tọa)
    act(async () => {
      const chair = s.users.find((x) => x.id === m.chairId);
      const chairUnit = s.units.find((x) => x.id === chair?.unitId);
      const documentNumber = await meetingService.ensureMinutesNumber(m.id, chairUnit?.short);
      const draft = meetingService.buildMinutesDraft(m, s.users, summaries, docComments, {
        units: s.units,
        documentNumber,
        location: m.documentLocation,
        recipients: m.recipients,
      });
      setMinText(draft);
      await meetingService.saveMinutes(user!, m.id, draft);
    }, 'Đã tạo dự thảo biên bản từ dữ liệu phiên họp');
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
      <div className="card card-pad">
        <h3 className="card-title"><Icon name="check" size={16} />Kết luận của chủ tọa ({m.conclusions.length})</h3>
        {m.conclusions.map((c, i) => (
          <div key={c.id} style={{ borderLeft: '3px solid var(--primary)', background: '#f4f8fd', borderRadius: '0 9px 9px 0', padding: '9px 13px', marginBottom: 9 }}>
            <b style={{ fontSize: 12, color: 'var(--primary)' }}>Kết luận {i + 1}{c.agendaItemId ? ` · Mục ${m.agenda.find((a) => a.id === c.agendaItemId)?.order ?? ''}` : ''}</b>
            <p style={{ fontSize: 13.5 }}>{c.content}</p>
            <small style={{ color: 'var(--muted)', fontSize: 11.5 }}>{timeAgo(c.createdAt)}</small>
          </div>
        ))}
        {m.conclusions.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Chưa có kết luận.</p>}
        {chairCtl && m.status !== 'draft' && (
          <div style={{ marginTop: 10 }}>
            <textarea className="ta" placeholder="Nội dung kết luận, chỉ đạo của chủ tọa…" value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <select className="sel" style={{ flex: 1 }} value={conclusionAgenda} onChange={(e) => setConclusionAgenda(e.target.value)}>
                <option value="">— Kết luận chung —</option>
                {m.agenda.map((a) => <option key={a.id} value={a.id}>Mục {a.order}. {a.title}</option>)}
              </select>
              <button className="btn" disabled={!conclusion.trim()}
                onClick={() => act(async () => { await meetingService.addConclusion(user!, m.id, conclusion.trim(), conclusionAgenda || undefined); setConclusion(''); }, 'Đã ghi kết luận')}>
                Ghi kết luận
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <h3 className="card-title">
          <Icon name="pen" size={16} />Biên bản phiên họp
          {m.minutes?.locked && <Badge color="green"><Icon name="lock" size={11} /> Đã ký số — khóa chỉnh sửa</Badge>}
        </h3>
        {!m.minutes && (
          <div className="empty">
            <Icon name="pen" size={28} />
            <p>Chưa lập biên bản.</p>
            {chairCtl && <button className="btn" onClick={makeDraft}><Icon name="refresh" size={15} />Tạo dự thảo từ dữ liệu phiên họp</button>}
          </div>
        )}
        {m.minutes && (
          <>
            <textarea className="ta" style={{ minHeight: 300, fontFamily: "'Times New Roman', serif", fontSize: 14 }}
              value={minText} readOnly={m.minutes.locked || !chairCtl}
              onChange={(e) => setMinText(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {chairCtl && !m.minutes.locked && (
                <>
                  <button className="btn outline" onClick={() => act(() => meetingService.saveMinutes(user!, m.id, minText), 'Đã lưu biên bản')}><Icon name="check" size={15} />Lưu biên bản</button>
                  <button className="btn ghost" onClick={makeDraft}><Icon name="refresh" size={15} />Tạo lại dự thảo</button>
                  <VoiceDictation onText={(t) => setMinText((x) => (x ? x.replace(/\s*$/, '') + '\n' : '') + t)} />
                </>
              )}
              {canSign && !alreadySigned && (
                <button className="btn success" onClick={() => setSignOpen(true)}><Icon name="pen" size={15} />Ký số biên bản</button>
              )}
              <button className="btn outline" onClick={() => {
                // window.print() bị chặn/ném lỗi trong iframe sandbox thiếu allow-modals.
                // (kể cả so sánh window.self/top cross-origin cũng có thể ném — nên bọc try/catch)
                let embedded = false;
                try { embedded = window.self !== window.top; } catch { embedded = true; }
                try {
                  window.print();
                  if (embedded) toast('Nếu hộp thoại in không hiện (do đang xem nhúng), hãy mở ứng dụng ở tab riêng rồi In / Xuất PDF.', 'info');
                } catch {
                  toast('Môi trường xem nhúng chặn hộp thoại in — mở ứng dụng ở tab riêng để In / Xuất PDF.', 'error');
                }
              }}><Icon name="printer" size={15} />In / Xuất PDF</button>
            </div>
            {m.minutes.signatures.map((sig) => (
              <div className="sig-block" key={sig.signerId}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Icon name="check" size={15} />
                  <b>Đã ký số: {sig.signerName}</b>
                  <span style={{ fontSize: 12, color: '#4c7a62' }}>({sig.signerTitle})</span>
                </div>
                <div style={{ fontSize: 12, color: '#4c7a62', marginTop: 3 }}>
                  Thời điểm: {fmtDT(sig.signedAt)} · Serial: {sig.serial}
                </div>
                <div className="hash">SHA-256: {sig.hash}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bản in biên bản */}
      {m.minutes && (
        <div className="print-root">
          {/* Quốc hiệu/tiêu ngữ đã nằm trong nội dung biên bản (buildMinutesDraft)
              — không chèn cứng ở đây để tránh in đôi. */}
          <pre>{m.minutes.content}</pre>
          <div className="print-sig">
            <div>
              <b>THƯ KÝ</b>
              {m.minutes.signatures.filter((x) => x.signerId === m.secretaryId).map((x) => (
                <p key={x.serial} style={{ fontSize: '10.5pt' }}>Đã ký số · {fmtDT(x.signedAt)}<br />{x.signerName}</p>
              ))}
            </div>
            <div>
              <b>CHỦ TRÌ</b>
              {m.minutes.signatures.filter((x) => x.signerId === m.chairId).map((x) => (
                <p key={x.serial} style={{ fontSize: '10.5pt' }}>Đã ký số · {fmtDT(x.signedAt)}<br />{x.signerName}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {signOpen && <SignModal onClose={() => setSignOpen(false)} onSubmit={(pin) =>
        act(async () => {
          const sig = await meetingService.signMinutes(user!, m.id, pin);
          setSignOpen(false);
          toast(`Ký số thành công — serial ${sig.serial}`);
        })} />}
    </div>
  );
}

// ---------------- Ghi biên bản bằng giọng nói (Web Speech API) ----------------
function VoiceDictation({ onText }: { onText: (t: string) => void }) {
  const { toast } = useApp();
  const [rec, setRec] = useState<{ stop: () => void } | null>(null);
  const [interim, setInterim] = useState('');
  const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
    ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

  const stop = () => {
    try { rec?.stop(); } catch { /* ignore */ }
    setRec(null);
    setInterim('');
  };

  const start = () => {
    if (!SR) {
      toast('Trình duyệt không hỗ trợ nhận dạng giọng nói — hãy dùng Chrome/Edge (tính năng thử nghiệm)', 'error');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = new (SR as any)();
      r.lang = 'vi-VN';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e: any) => {
        let interimTxt = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript as string;
          if (e.results[i].isFinal) onText(t.trim());
          else interimTxt += t;
        }
        setInterim(interimTxt);
      };
      r.onerror = (e: any) => {
        toast(e?.error === 'not-allowed'
          ? 'Không truy cập được micro (môi trường nhúng có thể chặn — dùng bản chạy HTTPS/Docker)'
          : 'Lỗi nhận dạng giọng nói: ' + (e?.error ?? 'không rõ'), 'error');
        stop();
      };
      r.onend = () => { setRec(null); setInterim(''); };
      r.start();
      setRec(r);
      toast('Đang nghe — đọc nội dung biên bản bằng tiếng Việt…', 'info');
    } catch {
      toast('Không khởi động được nhận dạng giọng nói trên trình duyệt này', 'error');
    }
  };

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {rec ? (
        <button className="btn danger" onClick={stop}><Icon name="mic" size={15} />Dừng ghi âm</button>
      ) : (
        <button className="btn outline" onClick={start} title="Đọc để hệ thống tự gõ vào biên bản (thử nghiệm — Chrome/Edge)">
          <Icon name="mic" size={15} />Ghi bằng giọng nói
        </button>
      )}
      {interim && <em style={{ fontSize: 12.5, color: 'var(--muted)' }}>“{interim}…”</em>}
    </span>
  );
}

function SignModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  return (
    <Modal title="Ký số biên bản (mô phỏng USB Token / SmartCA)" onClose={onClose} width={420}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn success" disabled={pin.length !== 6} onClick={() => onSubmit(pin)}><Icon name="pen" size={15} />Xác nhận ký</button>
      </>}>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Thiết bị: <b>USB Token — VN DEMO CA</b> (mô phỏng). Nhập mã PIN 6 chữ số của chứng thư số để ký.
        Giai đoạn 2 sẽ tích hợp ký số thật (VNPT-CA / Viettel-CA / SmartCA).
      </p>
      <input className="inp pin-inp" type="password" maxLength={6} inputMode="numeric" placeholder="••••••"
        value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Gợi ý demo: nhập 6 chữ số bất kỳ, ví dụ 123456.</p>
    </Modal>
  );
}

// ---------------- Tab: Nhiệm vụ ----------------
function TasksTab({ m, tasks }: { m: Meeting; tasks: ReturnType<typeof Array.prototype.slice> }) {
  const { user, s, refresh, toast } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const chairCtl = can.chairControls(user, m.chairId, m.secretaryId);
  const users = indexBy(s.users);

  return (
    <div className="card">
      <div style={{ display: 'flex', padding: '13px 16px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
        <h3 style={{ fontSize: 15 }}>Nhiệm vụ giao sau phiên họp</h3>
        <span style={{ flex: 1 }} />
        {chairCtl && <button className="btn sm" onClick={() => setAddOpen(true)}><Icon name="plus" size={14} />Giao nhiệm vụ</button>}
      </div>
      {tasks.length === 0 && <EmptyState icon="clipboard" text="Chưa có nhiệm vụ nào từ phiên họp này" />}
      <div className="tbl-wrap">
        {tasks.length > 0 && (
          <table className="tbl">
            <thead><tr><th style={{ width: '38%' }}>Nhiệm vụ</th><th>Người phụ trách</th><th>Hạn xử lý</th><th>Tiến độ</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {(tasks as typeof s.tasks).map((t) => {
                const stt = TASK_STATUS[t.status];
                const overdue = taskService.isOverdue(t);
                return (
                  <tr key={t.id}>
                    <td><div className="t-title">{t.title}</div>{t.description && <div className="t-sub">{t.description}</div>}</td>
                    <td>{users.get(t.assigneeId)?.fullName ?? '—'}</td>
                    <td style={{ color: overdue ? 'var(--red)' : undefined, fontWeight: overdue ? 700 : 400 }}>{fmtDate(t.deadline)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <ProgressBar value={t.progress} /><span style={{ fontSize: 12 }}>{t.progress}%</span>
                      </div>
                    </td>
                    <td><Badge color={overdue ? 'red' : stt.color}>{overdue ? 'Quá hạn' : stt.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {addOpen && (
        <TaskCreateModal meetingId={m.id} onClose={() => setAddOpen(false)}
          onDone={async () => { setAddOpen(false); await refresh(); toast('Đã giao nhiệm vụ'); }} />
      )}
    </div>
  );
}

export function TaskCreateModal({ meetingId, onClose, onDone }: { meetingId?: string | null; onClose: () => void; onDone: () => void }) {
  const { user, s } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(s.users[0]?.id ?? '');
  const d = new Date(Date.now() + 7 * 24 * 3600e3); d.setHours(17, 0, 0, 0);
  const [deadline, setDeadline] = useState(toLocalInput(d.toISOString()));
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) return setErr('Nhập tên nhiệm vụ');
    try {
      await taskService.createTask(user, { title: title.trim(), description: description.trim() || undefined, assigneeId, deadline: fromLocalInput(deadline), meetingId });
      onDone();
    } catch (ex) { setErr((ex as Error).message); }
  };

  return (
    <Modal title="Giao nhiệm vụ" onClose={onClose}
      footer={<>
        {err && <span style={{ color: 'var(--red)', fontSize: 13, marginRight: 'auto' }}>{err}</span>}
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={submit}>Giao nhiệm vụ</button>
      </>}>
      <Field label="Nhiệm vụ" required><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Mô tả"><textarea className="ta" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="form-row">
        <Field label="Người phụ trách" required>
          <select className="sel" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {s.users.filter((u) => u.status === 'active').map((u) => <option key={u.id} value={u.id}>{u.fullName} — {u.title}</option>)}
          </select>
        </Field>
        <Field label="Hạn xử lý" required><input type="datetime-local" className="inp" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------------- Modal phản hồi giấy mời ----------------
function DeclineModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Báo vắng phiên họp" onClose={onClose} width={440}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn danger" disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>Gửi báo vắng</button>
      </>}>
      <Field label="Lý do vắng mặt" required>
        <textarea className="ta" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Trùng lịch công tác với đoàn của Bộ…" />
      </Field>
    </Modal>
  );
}

function DelegateModal({ candidates, onClose, onSubmit }: {
  candidates: { id: string; fullName: string; title: string }[];
  onClose: () => void; onSubmit: (userId: string) => void;
}) {
  const [uid2, setUid2] = useState(candidates[0]?.id ?? '');
  return (
    <Modal title="Ủy quyền tham dự" onClose={onClose} width={440}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={() => onSubmit(uid2)}>Xác nhận ủy quyền</button>
      </>}>
      <Field label="Người được ủy quyền" required>
        <select className="sel" value={uid2} onChange={(e) => setUid2(e.target.value)}>
          {candidates.map((u) => <option key={u.id} value={u.id}>{u.fullName} — {u.title}</option>)}
        </select>
      </Field>
      <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Người được ủy quyền sẽ nhận giấy mời và tham dự với vai trò khách mời.</p>
    </Modal>
  );
}
