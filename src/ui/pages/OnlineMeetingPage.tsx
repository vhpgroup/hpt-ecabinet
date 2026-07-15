// ============================================================
// HỌP TRỰC TUYẾN — GIAO DIỆN MÔ PHỎNG (WebRTC tích hợp ở GĐ2)
// ============================================================
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DocFile } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Avatar, Icon } from '../components';
import { indexBy } from '../format';
import { DocViewerModal } from './shared';

export default function OnlineMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, s, toast } = useApp();
  const nav = useNavigate();
  const m = s.meetings.find((x) => x.id === id);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewDoc, setViewDoc] = useState<DocFile | null>(null);
  const users = useMemo(() => indexBy(s.users), [s.users]);
  const docById = useMemo(() => indexBy(s.documents), [s.documents]);

  if (!m || !user) return null;

  const speaking = s.speakRequests.find((r) => r.meetingId === m.id && r.status === 'speaking');
  const tiles = m.participants.filter((p) => p.attendStatus !== 'declined');
  const currentItem = m.agenda.find((a) => a.id === m.currentAgendaItemId) ?? m.agenda[0];

  // trạng thái mic mô phỏng ổn định theo userId
  const micOf = (uid2: string) => {
    let h = 0; for (let i = 0; i < uid2.length; i++) h = (h * 31 + uid2.charCodeAt(i)) | 0;
    return Math.abs(h) % 3 !== 0;
  };

  return (
    <div className="online-shell">
      <div className="live-top">
        <button className="icon-btn" style={{ color: '#c8d6e8' }} onClick={() => nav(`/meetings/${m.id}/live`)} title="Về phòng họp">
          <Icon name="chevleft" />
        </button>
        <div style={{ flex: 1 }}>
          <h2>{m.title}</h2>
          <div className="sub">Họp trực tuyến · {tiles.length} điểm cầu · Đang thảo luận: Mục {currentItem?.order}</div>
        </div>
        <span className="live-banner" style={{ background: 'rgba(29,158,95,.18)', borderColor: 'rgba(29,158,95,.4)', color: '#7de0ae' }}>
          <span className="live-dot" />Trực tuyến
        </span>
        {(currentItem?.documentIds ?? []).slice(0, 1).map((did) => {
          const d = docById.get(did);
          return d ? (
            <button key={did} className="btn outline sm" style={{ background: 'transparent', color: '#c8d6e8', borderColor: 'rgba(255,255,255,.3)' }}
              onClick={() => setViewDoc(d)}>
              <Icon name="file" size={14} />Tài liệu đang chia sẻ
            </button>
          ) : null;
        })}
      </div>

      <div className="online-grid">
        {tiles.map((p) => {
          const u = users.get(p.userId);
          const isSelf = p.userId === user.id;
          const isSpeaking = speaking?.userId === p.userId;
          const mic = isSelf ? micOn : micOf(p.userId);
          return (
            <div key={p.userId} className={'vid-tile' + (isSpeaking ? ' speaking' : '')}>
              {(isSelf ? camOn : true) ? (
                <Avatar user={u} size={62} />
              ) : (
                <span style={{ color: '#5d7896', fontSize: 12.5, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <Icon name="video" size={15} />Camera đang tắt
                </span>
              )}
              <span className="vid-name">
                {isSpeaking && <Icon name="mic" size={12} />} {u?.fullName}{isSelf ? ' (Bạn)' : ''}
              </span>
              {!mic && <span className="vid-mic-off" title="Đang tắt mic"><Icon name="x" size={12} /></span>}
            </div>
          );
        })}
      </div>

      <div className="online-bar">
        <button className={'ctl-btn' + (micOn ? '' : ' off')} title={micOn ? 'Tắt micro' : 'Bật micro'} onClick={() => setMicOn(!micOn)}>
          <Icon name="mic" size={20} />
        </button>
        <button className={'ctl-btn' + (camOn ? '' : ' off')} title={camOn ? 'Tắt camera' : 'Bật camera'} onClick={() => setCamOn(!camOn)}>
          <Icon name="video" size={20} />
        </button>
        <button className="ctl-btn" title="Chia sẻ màn hình (mô phỏng)" onClick={() => toast('Mô phỏng: chia sẻ màn hình sẽ hoạt động khi tích hợp WebRTC ở giai đoạn 2', 'info')}>
          <Icon name="monitor" size={20} />
        </button>
        <button className="ctl-btn leave" onClick={() => nav(`/meetings/${m.id}/live`)}>
          <Icon name="logout" size={17} />Rời điểm cầu
        </button>
      </div>
      <p className="online-note">
        Giao diện mô phỏng họp trực tuyến — giai đoạn 2 tích hợp WebRTC (LiveKit/Jitsi) cho âm thanh, hình ảnh và chia sẻ màn hình thật.
      </p>

      {viewDoc && <DocViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}
