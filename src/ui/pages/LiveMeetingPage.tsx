// ============================================================
// PHÒNG HỌP TRỰC TIẾP — màn hình điều hành khi phiên họp diễn ra:
// chương trình + tài liệu, biểu quyết realtime (mô phỏng),
// điểm danh, đăng ký phát biểu, trao đổi riêng/nhóm.
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DocFile, QuestionRequest } from '../../domain/types';
import { QUESTION_STATUS, QUESTION_SESSION } from '../../domain/labels';
import { useApp } from '../../store/AppContext';
import { ColorIcon,Avatar, Badge, Icon, Modal, QRSvg, SeatGrid, defaultLayout, seatKey } from '../components';
import { can } from '../../services/authService';
import * as meetingService from '../../services/meetingService';
import * as chatService from '../../services/chatService';
import * as questionService from '../../services/questionService';
import { simulateLiveTick } from '../../services/sim';
import { db } from '../../data/db';
import { realtime } from '../../data/realtime';
import { downloadTextFile, fmtTime, indexBy, initials, timeAgo, toCsv } from '../format';
import { DocViewerModal } from './shared';
import { VoteCard } from './MeetingDetailPage';

export default function LiveMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, s, refresh, toast } = useApp();
  const nav = useNavigate();
  const m = s.meetings.find((x) => x.id === id);
  const [rightTab, setRightTab] = useState<'attend' | 'seatmap' | 'speak' | 'question' | 'chat'>('attend');
  const [viewDoc, setViewDoc] = useState<DocFile | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [clock, setClock] = useState('');
  // E-HSMT mục 27: đếm ngược "thời gian còn lại" của MỤC đang họp
  const [remain, setRemain] = useState<{ text: string; over: boolean } | null>(null);
  const users = useMemo(() => indexBy(s.users), [s.users]);
  const units = useMemo(() => indexBy(s.units), [s.units]);
  const docById = useMemo(() => indexBy(s.documents), [s.documents]);

  // đồng hồ thời gian họp
  useEffect(() => {
    const t = setInterval(() => {
      if (!m) return;
      const ms = Date.now() - new Date(m.startTime).getTime();
      const sec = Math.max(0, Math.floor(ms / 1000));
      const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
      const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      setClock(`${hh}:${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(t);
  }, [m?.startTime, m]);

  // E-HSMT mục 27: đếm ngược thời lượng mục chương trình đang họp.
  // Mốc bắt đầu = currentItemStartedAt (chủ tọa đặt khi chuyển mục); nếu chưa có
  // (dữ liệu cũ / mục đầu chưa chuyển) thì dùng startTime của phiên (chỉ mục đầu).
  useEffect(() => {
    const item = m?.agenda.find((a) => a.id === m?.currentAgendaItemId) ?? m?.agenda[0];
    if (!m || m.status !== 'live' || !item || !item.durationMinutes) { setRemain(null); return; }
    const isFirst = item.id === m.agenda[0]?.id;
    const startedIso = m.currentItemStartedAt ?? (isFirst ? m.startTime : undefined);
    if (!startedIso) { setRemain(null); return; }
    const started = new Date(startedIso).getTime();
    const totalMs = item.durationMinutes * 60000;
    const tick = () => {
      const left = started + totalMs - Date.now();
      const over = left < 0;
      const s = Math.floor(Math.abs(left) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setRemain({ text: (over ? '+' : '') + `${mm}:${ss}`, over });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [m?.currentAgendaItemId, m?.currentItemStartedAt, m?.status, m?.startTime, m]);

  // Realtime:
  // - Chế độ máy chủ + WebSocket đang kết nối: sự kiện tự đẩy về (AppContext) — không poll
  // - Chế độ máy chủ + WebSocket rớt: poll dự phòng 3s
  // - Chế độ demo cục bộ: mô phỏng đại biểu khác điểm danh / biểu quyết / nhắn tin
  const simBusy = useRef(false);
  useEffect(() => {
    if (!m || m.status !== 'live' || !user) return;
    const t = setInterval(async () => {
      if (simBusy.current) return;
      simBusy.current = true;
      try {
        if (db.remote) {
          if (!realtime.connected) await refresh(); // dự phòng khi WS rớt
        } else {
          const changed = await simulateLiveTick(m.id, user.id);
          if (changed) await refresh();
        }
      } finally {
        simBusy.current = false;
      }
    }, 3000);
    return () => clearInterval(t);
  }, [m?.id, m?.status, user, refresh, m]);

  if (!m || !user) return null;

  const chairCtl = can.chairControls(user, m.chairId, m.secretaryId);
  const mine = m.participants.find((p) => p.userId === user.id);
  const currentItem = m.agenda.find((a) => a.id === m.currentAgendaItemId) ?? m.agenda[0];
  const openVotes = s.votes.filter((v) => v.meetingId === m.id && v.status === 'open');
  const pendingVotes = s.votes.filter((v) => v.meetingId === m.id && v.status === 'pending');
  const speakReqs = s.speakRequests.filter((r) => r.meetingId === m.id);
  const speaking = speakReqs.find((r) => r.status === 'speaking');
  const waiting = speakReqs.filter((r) => r.status === 'waiting').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const present = m.participants.filter((p) => p.checkedInAt).length;
  // ----- Chất vấn (E-HSMT mục 34/45/46) -----
  const qPending = questionService.pendingQuestions(s.questions, m.id);
  const qActive = questionService.activeQuestion(s.questions, m.id);
  const qSession = questionService.sessionState(m);

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); await refresh(); if (msg) toast(msg); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  // E-HSMT mục 36: xuất danh sách điểm danh (CSV) ngay trong phòng họp
  const exportAttendance = () => {
    const { headers, rows } = meetingService.buildAttendanceRows(m, users, units);
    downloadTextFile(`diemdanh_${m.code.replace(/[^\p{L}\p{N}._-]+/gu, '_')}.csv`, toCsv(headers, rows));
    toast('Đã xuất danh sách điểm danh (CSV)');
  };

  if (m.status !== 'live') {
    return (
      <div className="boot">
        <p>Phiên họp {m.status === 'finished' ? 'đã kết thúc' : 'chưa bắt đầu'}.</p>
        <button className="btn" onClick={() => nav(`/meetings/${m.id}`)}>Về trang phiên họp</button>
      </div>
    );
  }

  return (
    <div className="live-shell">
      <div className="live-top">
        <button className="icon-btn" style={{ color: '#c8d6e8' }} onClick={() => nav(`/meetings/${m.id}`)} title="Về trang phiên họp">
          <Icon name="chevleft" />
        </button>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2>{m.title}</h2>
          <div className="sub">{m.code} · Đang thảo luận: <b style={{ color: '#fff' }}>Mục {currentItem?.order}. {currentItem?.title}</b></div>
        </div>
        <span className="live-banner" style={{ background: 'rgba(29,158,95,.18)', borderColor: 'rgba(29,158,95,.4)', color: '#7de0ae' }}>
          <span className="live-dot" />Trực tiếp · {present}/{m.participants.length} có mặt
        </span>
        <span className="live-clock" title="Thời gian họp">{clock}</span>
        {m.isOnline && (
          <button className="btn outline sm" style={{ background: 'transparent', color: '#c8d6e8', borderColor: 'rgba(255,255,255,.3)' }}
            onClick={() => nav(`/meetings/${m.id}/online`)}>
            <Icon name="video" size={14} />Trực tuyến
          </button>
        )}
        <button className="btn outline sm" style={{ background: 'transparent', color: '#c8d6e8', borderColor: 'rgba(255,255,255,.3)' }}
          title="Chế độ trình chiếu cho màn hình TV tại phòng họp" onClick={() => nav(`/meetings/${m.id}/screen`)}>
          <Icon name="monitor" size={14} />Màn hình TV
        </button>
        {chairCtl && (
          <button className="btn danger sm" onClick={() => {
            if (window.confirm('Kết thúc phiên họp? Hệ thống sẽ chuyển sang bước lập biên bản.')) {
              act(async () => { await meetingService.endMeeting(user, m.id); nav(`/meetings/${m.id}`); }, 'Phiên họp đã kết thúc — mời lập biên bản và ký số');
            }
          }}>Kết thúc phiên họp</button>
        )}
      </div>

      <div className="live-body">
        {/* ---------- CỘT TRÁI ---------- */}
        <div className="live-left">
          <div className="live-panel">
            <div className="live-panel-h">
              <Icon name="list" size={15} />Chương trình phiên họp
              {/* Đếm ngược thời gian còn lại của mục đang họp (E-HSMT mục 27) */}
              {remain && currentItem && (
                <span className={'agenda-countdown' + (remain.over ? ' over' : '')} title={`Thời lượng dự kiến mục ${currentItem.order}: ${currentItem.durationMinutes} phút`}>
                  <Icon name="clock" size={13} />
                  {remain.over ? 'Quá giờ ' : 'Còn lại '}{remain.text}
                </span>
              )}
            </div>
            <div style={{ padding: '10px 15px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {m.agenda.map((a) => (
                <button key={a.id}
                  className={'btn sm' + (a.id === currentItem?.id ? '' : ' outline')}
                  onClick={() => chairCtl && act(() => meetingService.setCurrentAgendaItem(user, m.id, a.id))}
                  title={chairCtl ? 'Chuyển sang nội dung này' : a.title}
                  style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.order}. {a.title.length > 34 ? a.title.slice(0, 34) + '…' : a.title}
                </button>
              ))}
            </div>
          </div>

          <div className="live-panel" style={{ flex: 1 }}>
            <div className="live-panel-h">
              <Icon name="file" size={15} />Tài liệu — Mục {currentItem?.order}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(currentItem?.documentIds ?? []).map((did) => {
                  const d = docById.get(did);
                  return d ? (
                    <button key={did} className="btn ghost sm" onClick={() => setViewDoc(d)}>
                      <Icon name="eye" size={13} />{d.name.length > 28 ? d.name.slice(0, 28) + '…' : d.name}
                    </button>
                  ) : null;
                })}
              </span>
            </div>
            <div style={{ padding: 15, overflowY: 'auto', maxHeight: '46vh' }}>
              {currentItem && currentItem.documentIds.length > 0 ? (
                (() => {
                  const d = docById.get(currentItem.documentIds[0]);
                  return d?.content
                    ? <div className="doc-viewer" style={{ maxHeight: 'none' }}><div className="doc-page">{d.content}</div></div>
                    : <div className="empty"><p>Nhấn nút tài liệu phía trên để xem.</p></div>;
                })()
              ) : (
                <div className="empty"><Icon name="file" size={26} /><p>Mục này chưa có tài liệu.</p></div>
              )}
            </div>
          </div>

          {(openVotes.length > 0 || (chairCtl && pendingVotes.length > 0)) && (
            <div className="live-panel">
              <div className="live-panel-h"><Icon name="vote" size={15} />Biểu quyết</div>
              <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {openVotes.map((v) => (
                  <VoteCard key={v.id} v={v} chairCtl={chairCtl} act={act} usersMap={users} compact />
                ))}
                {chairCtl && pendingVotes.map((v) => (
                  <VoteCard key={v.id} v={v} chairCtl={chairCtl} act={act} usersMap={users} compact />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---------- CỘT PHẢI ---------- */}
        <div className="live-right">
          <div className="live-panel">
            <div className="tabs">
              <button className={'tab' + (rightTab === 'attend' ? ' active' : '')} onClick={() => setRightTab('attend')}>
                <ColorIcon name="hand" size={15} /> Điểm danh <Badge color="green">{present}</Badge>
              </button>
              <button className={'tab' + (rightTab === 'seatmap' ? ' active' : '')} onClick={() => setRightTab('seatmap')}>
                <ColorIcon name="chair" size={15} /> Sơ đồ phòng họp
              </button>
              <button className={'tab' + (rightTab === 'speak' ? ' active' : '')} onClick={() => setRightTab('speak')}>
                <ColorIcon name="mic" size={15} /> Phát biểu <Badge color="amber">{waiting.length}</Badge>
              </button>
              <button className={'tab' + (rightTab === 'question' ? ' active' : '')} onClick={() => setRightTab('question')}>
                <ColorIcon name="question" size={15} /> Chất vấn {qActive ? <Badge color="green">•</Badge> : qPending.length > 0 ? <Badge color="amber">{qPending.length}</Badge> : null}
              </button>
              <button className={'tab' + (rightTab === 'chat' ? ' active' : '')} onClick={() => setRightTab('chat')}><ColorIcon name="chat" size={15} /> Trao đổi</button>
            </div>

            {rightTab === 'attend' && (
              <div className="tabpane">
                {mine && !mine.checkedInAt && (
                  <button className="btn success" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
                    onClick={() => act(() => meetingService.checkIn(user, m.id, user.id), 'Điểm danh thành công')}>
                    <Icon name="check" size={16} />Điểm danh tham dự
                  </button>
                )}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button className="btn outline sm" onClick={() => setQrOpen(true)}>
                    <Icon name="qr" size={14} />Mã QR điểm danh
                  </button>
                  {chairCtl && (
                    <button className="btn outline sm" onClick={exportAttendance} title="Xuất danh sách điểm danh ra CSV">
                      <Icon name="download" size={14} />Xuất DS điểm danh
                    </button>
                  )}
                </div>
                {m.participants.map((p) => {
                  const u = users.get(p.userId);
                  return (
                    <div className="attend-row" key={p.userId}>
                      <Avatar user={u} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u?.fullName}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.seat ?? ''}</div>
                      </div>
                      {p.checkedInAt
                        ? <span style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>✓ {fmtTime(p.checkedInAt)}</span>
                        : p.attendStatus === 'declined'
                          ? <Badge color="red">Vắng</Badge>
                          : chairCtl
                            ? <button className="btn ghost sm" onClick={() => act(() => meetingService.checkIn(user, m.id, p.userId), 'Đã điểm danh hộ')}>Điểm danh hộ</button>
                            : <Badge color="gray">Chưa vào</Badge>}
                    </div>
                  );
                })}
              </div>
            )}

            {rightTab === 'seatmap' && <SeatMapPane meetingId={m.id} />}
            {rightTab === 'speak' && <SpeakPane meetingId={m.id} chairCtl={chairCtl} speaking={speaking} waiting={waiting} act={act} />}
            {rightTab === 'question' && (
              <QuestionPane meetingId={m.id} chairCtl={chairCtl} session={qSession} active={qActive} pending={qPending} act={act} />
            )}
            {rightTab === 'chat' && <ChatPane meetingId={m.id} />}
          </div>
        </div>
      </div>

      {viewDoc && <DocViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
      {qrOpen && (
        <Modal title="Mã QR điểm danh" onClose={() => setQrOpen(false)} width={340}>
          <div style={{ textAlign: 'center' }}>
            <QRSvg seed={m.id + m.code} />
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>Đại biểu quét mã tại cửa phòng họp để điểm danh (mô phỏng).</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Đăng ký phát biểu ----------------
function SpeakPane({ meetingId, chairCtl, speaking, waiting, act }: {
  meetingId: string; chairCtl: boolean;
  speaking?: { id: string; userId: string; topic?: string; startedAt?: string };
  waiting: { id: string; userId: string; topic?: string; requestedAt: string }[];
  act: (fn: () => Promise<unknown>, msg?: string) => Promise<void>;
}) {
  const { user, s } = useApp();
  const [topic, setTopic] = useState('');
  const users = indexBy(s.users);
  const iAmWaiting = waiting.some((w) => w.userId === user?.id) || speaking?.userId === user?.id;

  return (
    <div className="tabpane">
      {speaking && (
        <div className="speaking-now">
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <Avatar user={users.get(speaking.userId)} size={34} />
            <div>
              <b style={{ fontSize: 13, color: '#10643c' }}><Icon name="mic" size={13} /> Đang phát biểu: {users.get(speaking.userId)?.fullName}</b>
              {speaking.topic && <div style={{ fontSize: 12, color: '#42775c' }}>{speaking.topic}</div>}
              {speaking.startedAt && <div style={{ fontSize: 11, color: '#42775c' }}>Bắt đầu {fmtTime(speaking.startedAt)}</div>}
            </div>
          </div>
          {chairCtl && (
            <button className="btn outline sm" style={{ marginTop: 8 }} onClick={() => act(() => meetingService.actOnSpeak(user!, speaking.id, 'end'), 'Đã kết thúc lượt phát biểu')}>
              Kết thúc lượt phát biểu
            </button>
          )}
        </div>
      )}

      {!iAmWaiting && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="inp" placeholder="Nội dung muốn phát biểu…" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <button className="btn" onClick={() => act(async () => { await meetingService.requestSpeak(user!, meetingId, topic.trim() || undefined); setTopic(''); }, 'Đã đăng ký phát biểu')}>
              <Icon name="hand" size={15} />
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>Đăng ký phát biểu — chủ tọa sẽ mời theo thứ tự.</p>
        </div>
      )}

      <b style={{ fontSize: 12.5, color: 'var(--muted)' }}>Danh sách chờ ({waiting.length})</b>
      {waiting.map((w, i) => (
        <div className="speak-row" key={w.id}>
          <span className="agenda-no" style={{ width: 22, height: 22, fontSize: 11.5 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12.8 }}>{users.get(w.userId)?.fullName}</div>
            {w.topic && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{w.topic}</div>}
            <div style={{ fontSize: 10.5, color: '#93a5ba' }}>{timeAgo(w.requestedAt)}</div>
          </div>
          {chairCtl && (
            <>
              <button className="btn success sm" title="Mời phát biểu" onClick={() => act(() => meetingService.actOnSpeak(user!, w.id, 'start'), 'Đã mời phát biểu')}><Icon name="mic" size={13} /></button>
              <button className="icon-btn" title="Từ chối" onClick={() => act(() => meetingService.actOnSpeak(user!, w.id, 'reject'))}><Icon name="x" size={14} /></button>
            </>
          )}
        </div>
      ))}
      {waiting.length === 0 && !speaking && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>Chưa có đại biểu đăng ký phát biểu.</p>}
    </div>
  );
}

// ---------------- Sơ đồ phòng họp trực tiếp (E-HSMT mục 38) ----------------
// Xem-only cho mọi đại biểu: hiển thị vị trí đại biểu + MÀU theo điểm danh realtime,
// viền nổi bật người đang phát biểu.
function SeatMapPane({ meetingId }: { meetingId: string }) {
  const { s } = useApp();
  const users = useMemo(() => indexBy(s.users), [s.users]);
  const m = s.meetings.find((x) => x.id === meetingId);
  const room = s.rooms.find((r) => r.id === m?.roomId);
  const layout = room?.layout ?? defaultLayout(room?.capacity ?? 24);
  const assignments = m?.seatAssignments ?? {};
  // ánh xạ userId -> dòng tham dự (Participant không có .id nên không dùng indexBy)
  const partByUser = useMemo(() => new Map((m?.participants ?? []).map((p) => [p.userId, p])), [m]);
  // người đang phát biểu (để nổi bật viền)
  const speakingUserId = s.speakRequests.find((r) => r.meetingId === meetingId && r.status === 'speaking')?.userId;

  const bySeat = useMemo(() => {
    const map = new Map<string, string>();
    for (const [uidX, sk] of Object.entries(assignments)) map.set(sk, uidX);
    return map;
  }, [assignments]);

  return (
    <div className="tabpane">
      <SeatGrid layout={layout}
        render={(r, c) => {
          const occupant = bySeat.get(seatKey(r, c));
          if (!occupant) return { label: <span className="seat-code">{r + 1}-{c + 1}</span> };
          const u = users.get(occupant);
          const p = partByUser.get(occupant);
          // màu theo điểm danh: có mặt=xanh, vắng có lý do=xám, chưa điểm danh=vàng nhạt
          const attCls = p?.checkedInAt ? 'att-present'
            : p?.attendStatus === 'declined' ? 'att-absent'
            : 'att-pending';
          const speakingCls = occupant === speakingUserId ? ' speaking' : '';
          const status = p?.checkedInAt ? 'Có mặt' : p?.attendStatus === 'declined' ? 'Vắng (có lý do)' : 'Chưa điểm danh';
          return {
            cls: attCls + speakingCls,
            label: <span>{u ? initials(u.fullName) : '?'}</span>,
            title: `${u?.fullName ?? ''} · ${status}${occupant === speakingUserId ? ' · Đang phát biểu' : ''}`,
          };
        }} />
      <div className="seatmap-legend">
        <span><span className="dot" style={{ background: '#e9f7ef', borderColor: '#57c98a' }} />Có mặt</span>
        <span><span className="dot" style={{ background: '#fef6e7', borderColor: '#f0cd80' }} />Chưa điểm danh</span>
        <span><span className="dot" style={{ background: '#f1f5f9', borderColor: '#cbd5e1' }} />Vắng có lý do</span>
        <span><span className="dot" style={{ background: '#fff', borderColor: '#1d9e5f' }} />Đang phát biểu</span>
      </div>
      {Object.keys(assignments).length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
          Chưa gán vị trí đại biểu. Chủ trì/thư ký gán tại trang chi tiết phiên họp → tab “Sơ đồ chỗ ngồi”.
        </p>
      )}
    </div>
  );
}

// ---------------- Chất vấn (E-HSMT mục 34/45/46) ----------------
function QuestionPane({ meetingId, chairCtl, session, active, pending, act }: {
  meetingId: string; chairCtl: boolean;
  session: 'closed' | 'open' | 'paused';
  active?: QuestionRequest;
  pending: QuestionRequest[];
  act: (fn: () => Promise<unknown>, msg?: string) => Promise<void>;
}) {
  const { user, s } = useApp();
  const users = indexBy(s.users);
  const [open, setOpen] = useState(false); // modal đăng ký
  const [view, setView] = useState<QuestionRequest | null>(null); // modal xem nội dung
  const [form, setForm] = useState({ targetName: '', topic: '', content: '' });

  // toàn bộ lượt đã gọi (đang/xong/từ chối) để "xem danh sách đã gọi"
  const called = questionService.calledQuestions(s.questions, meetingId);
  const myPending = pending.find((q) => q.userId === user?.id);
  const iAmInvolved = !!myPending || active?.userId === user?.id;

  const submit = () => act(async () => {
    await questionService.registerQuestion(user!, meetingId, form);
    setForm({ targetName: '', topic: '', content: '' });
    setOpen(false);
  }, 'Đã đăng ký chất vấn');

  const sess = QUESTION_SESSION[session];

  return (
    <div className="tabpane">
      {/* Trạng thái phiên + điều khiển của chủ tọa */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Phiên chất vấn:</span>
        <Badge color={sess.color}>{sess.label}</Badge>
        {chairCtl && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {session !== 'open' && (
              <button className="btn success sm" onClick={() => act(() => questionService.openSession(user!, meetingId), 'Đã bắt đầu phiên chất vấn')}>
                <Icon name="check" size={13} />Bắt đầu
              </button>
            )}
            {session === 'open' && (
              <button className="btn outline sm" onClick={() => act(() => questionService.pauseSession(user!, meetingId), 'Đã tạm dừng nhận đăng ký chất vấn')}>
                Tạm dừng
              </button>
            )}
            {session !== 'closed' && (
              <button className="btn danger sm" onClick={() => act(() => questionService.closeSession(user!, meetingId), 'Đã kết thúc phiên chất vấn')}>
                Kết thúc
              </button>
            )}
          </span>
        )}
      </div>

      {/* Lượt ĐANG chất vấn — nổi bật */}
      {active && (
        <div className="speaking-now" style={{ background: 'rgba(29,158,95,.1)', borderColor: 'rgba(29,158,95,.35)' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <Avatar user={users.get(active.userId)} size={34} />
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13, color: '#10643c' }}><Icon name="mic" size={13} /> Đang chất vấn: {users.get(active.userId)?.fullName}</b>
              {active.targetName && <div style={{ fontSize: 12, color: '#42775c' }}>→ Được chất vấn: <b>{active.targetName}</b></div>}
              <div style={{ fontSize: 12, color: '#42775c' }}>{active.topic}</div>
              {active.calledAt && <div style={{ fontSize: 11, color: '#42775c' }}>Bắt đầu {fmtTime(active.calledAt)}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="btn ghost sm" onClick={() => setView(active)}><Icon name="eye" size={13} />Xem nội dung</button>
            {chairCtl && (
              <button className="btn outline sm" onClick={() => act(() => questionService.endQuestion(user!, active.id), 'Đã kết thúc lượt chất vấn')}>
                Kết thúc lượt
              </button>
            )}
          </div>
        </div>
      )}

      {/* Đại biểu: đăng ký / trạng thái của mình */}
      {!chairCtl && (
        <div style={{ marginBottom: 12 }}>
          {session !== 'open' ? (
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              <Icon name="info" size={13} /> Phiên chất vấn {session === 'paused' ? 'đang tạm dừng' : 'chưa mở'} — vui lòng chờ chủ tọa.
            </p>
          ) : iAmInvolved ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge color={myPending ? 'amber' : 'green'}>{myPending ? 'Bạn đang chờ được gọi' : 'Bạn đang chất vấn'}</Badge>
              {myPending && (
                <button className="btn outline sm" onClick={() => act(() => questionService.cancelQuestion(user!, myPending.id), 'Đã hủy đăng ký chất vấn')}>
                  Hủy đăng ký
                </button>
              )}
            </div>
          ) : (
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setOpen(true)}>
              <Icon name="hand" size={15} />Đăng ký chất vấn
            </button>
          )}
        </div>
      )}

      {/* Danh sách CHƯA GỌI */}
      <b style={{ fontSize: 12.5, color: 'var(--muted)' }}>Chưa gọi ({pending.length})</b>
      {pending.map((q, i) => (
        <div className="speak-row" key={q.id}>
          <span className="agenda-no" style={{ width: 22, height: 22, fontSize: 11.5 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12.8 }}>{users.get(q.userId)?.fullName}</div>
            {q.targetName && <div style={{ fontSize: 11.5, color: 'var(--blue)' }}>→ {q.targetName}</div>}
            <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.topic}</div>
            <div style={{ fontSize: 10.5, color: '#93a5ba' }}>{timeAgo(q.createdAt)}</div>
          </div>
          <button className="icon-btn" title="Xem nội dung" onClick={() => setView(q)}><Icon name="eye" size={14} /></button>
          {chairCtl && (
            <>
              <button className="btn success sm" title="Gọi chất vấn" onClick={() => act(() => questionService.callQuestion(user!, q.id), 'Đã gọi chất vấn')}><Icon name="mic" size={13} /></button>
              <button className="icon-btn" title="Từ chối" onClick={() => act(() => questionService.rejectQuestion(user!, q.id), 'Đã từ chối lượt chất vấn')}><Icon name="x" size={14} /></button>
            </>
          )}
        </div>
      ))}
      {pending.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>Chưa có đại biểu đăng ký chất vấn.</p>}

      {/* Danh sách ĐÃ GỌI */}
      {called.length > 0 && (
        <>
          <b style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginTop: 14 }}>Đã gọi ({called.length})</b>
          {called.map((q) => (
            <div className="speak-row" key={q.id} style={{ opacity: q.status === 'called' ? 1 : 0.85 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.8 }}>{users.get(q.userId)?.fullName}</div>
                {q.targetName && <div style={{ fontSize: 11.5, color: 'var(--blue)' }}>→ {q.targetName}</div>}
                <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.topic}</div>
              </div>
              <Badge color={QUESTION_STATUS[q.status].color}>{QUESTION_STATUS[q.status].label}</Badge>
              <button className="icon-btn" title="Xem nội dung" onClick={() => setView(q)}><Icon name="eye" size={14} /></button>
            </div>
          ))}
        </>
      )}

      {/* Modal đăng ký chất vấn */}
      {open && (
        <Modal title="Đăng ký chất vấn" onClose={() => setOpen(false)} width={460} footer={
          <>
            <button className="btn outline" onClick={() => setOpen(false)}>Hủy</button>
            <button className="btn" onClick={submit} disabled={!form.topic.trim()}>Gửi đăng ký</button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Người / đơn vị được chất vấn
              <input className="inp" style={{ marginTop: 5 }} placeholder="VD: Sở Tài chính…" value={form.targetName}
                onChange={(e) => setForm({ ...form, targetName: e.target.value })} />
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Chủ đề chất vấn <span style={{ color: 'var(--red)' }}>*</span>
              <input className="inp" style={{ marginTop: 5 }} placeholder="Nội dung ngắn gọn của câu hỏi chất vấn" value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Nội dung chi tiết
              <textarea className="inp" style={{ marginTop: 5, minHeight: 90, resize: 'vertical' }} placeholder="Diễn giải chi tiết (tùy chọn)" value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </label>
          </div>
        </Modal>
      )}

      {/* Modal xem nội dung chất vấn */}
      {view && (
        <Modal title="Nội dung chất vấn" onClose={() => setView(null)} width={480}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
            <div><b>Người chất vấn:</b> {users.get(view.userId)?.fullName} — {users.get(view.userId)?.title}</div>
            {view.targetName && <div><b>Được chất vấn:</b> {view.targetName}</div>}
            <div><b>Chủ đề:</b> {view.topic}</div>
            {view.content && <div style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', padding: 12, borderRadius: 8 }}>{view.content}</div>}
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Trạng thái: {QUESTION_STATUS[view.status].label} · Đăng ký {fmtTime(view.createdAt)}
              {view.calledAt ? ` · Gọi ${fmtTime(view.calledAt)}` : ''}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Trao đổi ----------------
function ChatPane({ meetingId }: { meetingId: string }) {
  const { user, s, refresh } = useApp();
  const [toId, setToId] = useState<string>('');
  const [text, setText] = useState('');
  const users = indexBy(s.users);
  const meeting = s.meetings.find((x) => x.id === meetingId);
  const msgs = useMemo(
    () => (user ? chatService.visibleMessages(s.messages, meetingId, user.id) : []),
    [s.messages, meetingId, user],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = async () => {
    if (!user || !text.trim()) return;
    await chatService.sendMessage(user, meetingId, text, toId || null);
    setText('');
    await refresh();
  };

  return (
    <>
      <div className="tabpane">
        <div className="chat-list">
          {msgs.map((msg) => {
            const mineMsg = msg.fromId === user?.id;
            return (
              <div key={msg.id} className={'chat-msg' + (mineMsg ? ' mine' : '')} style={{ alignSelf: mineMsg ? 'flex-end' : 'flex-start' }}>
                <div className="who">
                  {!mineMsg && <b>{users.get(msg.fromId)?.fullName}</b>}
                  {msg.toId && <Badge color="purple">Riêng {msg.toId === user?.id ? '· gửi cho bạn' : `→ ${users.get(msg.toId)?.fullName}`}</Badge>}
                  <span>{fmtTime(msg.sentAt)}</span>
                </div>
                <div className="bubble">{msg.content}</div>
              </div>
            );
          })}
          {msgs.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Chưa có trao đổi nào.</p>}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="chat-input">
        <select className="sel" style={{ width: 132, flex: 'none' }} value={toId} onChange={(e) => setToId(e.target.value)} title="Gửi tới">
          <option value="">Cả phòng họp</option>
          {meeting?.participants.filter((p) => p.userId !== user?.id).map((p) => (
            <option key={p.userId} value={p.userId}>Riêng: {users.get(p.userId)?.fullName}</option>
          ))}
        </select>
        <input className="inp" placeholder="Nhập nội dung trao đổi…" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn" onClick={send}><Icon name="send" size={15} /></button>
      </div>
    </>
  );
}
