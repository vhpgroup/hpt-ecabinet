// ============================================================
// MÀN HÌNH TV PHÒNG HỌP — chế độ trình chiếu (kết nối màn hình lớn):
// thông tin phiên họp, nội dung đang thảo luận, QR điểm danh,
// kết quả biểu quyết trực tiếp. Tự làm mới liên tục.
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { Icon, QRSvg } from '../components';
import { voteOutcome, voteResults } from '../../services/voteService';
import { simulateLiveTick } from '../../services/sim';
import { db } from '../../data/db';
import { realtime } from '../../data/realtime';
import { fmtTime, indexBy } from '../format';

const VOTE_COLORS = ['#2fbf78', '#e05b5b', '#e8a33c'];

export default function ScreenDisplayPage() {
  const { id } = useParams<{ id: string }>();
  const { user, s, refresh } = useApp();
  const nav = useNavigate();
  const m = s.meetings.find((x) => x.id === id);
  const [now, setNow] = useState(new Date());
  const users = useMemo(() => indexBy(s.users), [s.users]);

  // đồng hồ + tự làm mới dữ liệu (mô phỏng realtime)
  useEffect(() => {
    const t1 = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t1);
  }, []);
  const simBusy = useRef(false);
  useEffect(() => {
    if (!m || !user) return;
    const t = setInterval(async () => {
      if (simBusy.current) return;
      simBusy.current = true;
      try {
        if (db.remote) {
          if (!realtime.connected) await refresh(); // WS rớt -> poll dự phòng
        } else {
          if (m.status === 'live') await simulateLiveTick(m.id, user.id);
          await refresh();
        }
      } finally { simBusy.current = false; }
    }, 3000);
    return () => clearInterval(t);
  }, [m?.id, m?.status, user, refresh, m]);

  if (!m) return null;

  const currentItem = m.agenda.find((a) => a.id === m.currentAgendaItemId) ?? m.agenda[0];
  const openVote = s.votes.find((v) => v.meetingId === m.id && v.status === 'open');
  const speaking = s.speakRequests.find((r) => r.meetingId === m.id && r.status === 'speaking');
  const present = m.participants.filter((p) => p.checkedInAt).length;
  const room = s.rooms.find((r) => r.id === m.roomId);

  return (
    <div className="tv-shell">
      <div className="tv-head">
        <div className="sb-logo" style={{ width: 54, height: 54, fontSize: 22 }}>eC</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tv-title">{m.title}</div>
          <div className="tv-sub">{m.code} · {room?.name} · {fmtTime(m.startTime)} – {fmtTime(m.endTime)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="tv-clock">{now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div className="tv-sub" style={{ textTransform: 'capitalize' }}>
            {now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        </div>
        <button className="icon-btn tv-exit" title="Thoát chế độ trình chiếu" onClick={() => nav(`/meetings/${m.id}/live`)}>
          <Icon name="x" size={20} />
        </button>
      </div>

      {m.status === 'finished' ? (
        <div className="tv-finished">
          <Icon name="check" size={54} />
          <h2>Phiên họp đã kết thúc</h2>
          <p>Trân trọng cảm ơn quý đại biểu. Biên bản và kết luận được phát hành trên hệ thống eCabinet.</p>
        </div>
      ) : (
        <div className="tv-body">
          <div className="tv-col-main">
            <div className="tv-panel">
              <div className="tv-label"><span className="live-dot" /> Đang thảo luận</div>
              <div className="tv-current">
                <span className="tv-no">{currentItem?.order ?? '—'}</span>
                <div>
                  <div className="tv-current-title">{currentItem?.title ?? 'Chưa bắt đầu nội dung'}</div>
                  {currentItem?.presenterId && (
                    <div className="tv-sub" style={{ marginTop: 6 }}>
                      Trình bày: <b style={{ color: '#fff' }}>{users.get(currentItem.presenterId)?.fullName}</b> — {users.get(currentItem.presenterId)?.title}
                    </div>
                  )}
                </div>
              </div>
              {speaking && (
                <div className="tv-speaking">
                  <Icon name="mic" size={20} />
                  Đang phát biểu: <b>{users.get(speaking.userId)?.fullName}</b>{speaking.topic ? ` — ${speaking.topic}` : ''}
                </div>
              )}
            </div>

            {openVote && (
              <div className="tv-panel">
                <div className="tv-label"><Icon name="vote" size={17} /> Biểu quyết: {openVote.title}</div>
                <div className="tv-votes">
                  {voteResults(openVote).map((r, i) => (
                    <div key={r.optionId} className="tv-vote-row">
                      <div className="tv-vote-top"><span>{r.label}</span><b>{r.count} phiếu · {openVote.ballots.length ? r.percent : 0}%</b></div>
                      <div className="tv-vote-track">
                        <div className="tv-vote-fill" style={{ width: `${openVote.ballots.length ? r.percent : 0}%`, background: VOTE_COLORS[i % VOTE_COLORS.length] }} />
                      </div>
                    </div>
                  ))}
                  {(() => {
                    const o = voteOutcome(openVote);
                    const gap = o.required - o.approve;
                    return (
                      <div className="tv-sub" style={{ marginTop: 6 }}>
                        Tán thành {o.approve}/{o.totalEligible} • {o.approved ? 'đã đủ điều kiện thông qua' : `còn thiếu ${gap} phiếu`} — cập nhật trực tiếp
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="tv-panel">
              <div className="tv-label"><Icon name="list" size={17} /> Chương trình</div>
              <div className="tv-agenda">
                {m.agenda.map((a) => (
                  <div key={a.id} className={'tv-agenda-item' + (a.id === currentItem?.id ? ' now' : '')}>
                    <span className="tv-no sm">{a.order}</span>
                    <span className="tv-agenda-title">{a.title}</span>
                    <span className="tv-sub">{a.durationMinutes}’</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="tv-col-side">
            <div className="tv-panel tv-center">
              <div className="tv-label" style={{ justifyContent: 'center' }}><Icon name="qr" size={17} /> Điểm danh</div>
              <div className="tv-qr-box"><QRSvg seed={m.id + m.code} size={190} /></div>
              <p className="tv-sub" style={{ textAlign: 'center' }}>Quét mã bằng thiết bị được cấp để điểm danh</p>
              <div className="tv-attend">
                <b>{present}</b><span>/{m.participants.length}</span>
              </div>
              <p className="tv-sub" style={{ textAlign: 'center' }}>đại biểu có mặt</p>
            </div>
            <div className="tv-panel tv-note">
              <Icon name="file" size={17} />
              Tài liệu phiên họp đã sẵn sàng trên thiết bị của đại biểu — Phòng họp không giấy eCabinet
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
