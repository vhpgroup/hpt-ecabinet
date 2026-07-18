// ============================================================
// HỌP TRỰC TUYẾN
//  - GATED BẰNG CẤU HÌNH: nếu chạy máy chủ (REST) và server bật LiveKit
//    (GET /api/rtc/config -> {enabled:true}) thì dùng WebRTC THẬT
//    (LiveKit): âm thanh + hình ảnh + chia sẻ màn hình.
//  - Nếu CHƯA cấu hình / chạy demo cục bộ / lỗi kết nối / bị chặn quyền
//    -> QUAY LẠI giao diện MÔ PHỎNG (giữ nguyên logic cũ, không xóa).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DocFile } from '../../domain/types';
import { db } from '../../data/db';
import {
  loadLivekit,
  type LivekitClientLib,
  type LkParticipant,
  type LkPublication,
  type LkRoom,
  type LkTrack,
} from '../../data/livekit';
import { useApp } from '../../store/AppContext';
import { Avatar, Icon } from '../components';
import { indexBy } from '../format';
import { DocViewerModal } from './shared';

// ============================================================
// GIAO DIỆN MÔ PHỎNG (giữ NGUYÊN như trước — fallback an toàn)
// ============================================================
function SimulatedMeeting({ meetingId, notice }: { meetingId: string; notice?: string }) {
  const { user, s, toast } = useApp();
  const nav = useNavigate();
  const m = s.meetings.find((x) => x.id === meetingId);
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
        <button className="ctl-btn" title="Chia sẻ màn hình (minh họa — bản triển khai chính thức có chia sẻ màn hình thật)" onClick={() => toast('Chia sẻ màn hình thật sẽ khả dụng ở bản triển khai chính thức có kết nối máy chủ truyền hình ảnh.', 'info')}>
          <Icon name="monitor" size={20} />
        </button>
        <button className="ctl-btn leave" onClick={() => nav(`/meetings/${m.id}/live`)}>
          <Icon name="logout" size={17} />Rời điểm cầu
        </button>
      </div>
      <p className="online-note">
        {notice ?? 'Giao diện minh họa họp trực tuyến — bản triển khai chính thức có kết nối máy chủ truyền âm thanh, hình ảnh và chia sẻ màn hình thật.'}
      </p>

      {viewDoc && <DocViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

// ============================================================
// MỘT Ô VIDEO (attach track thật vào <video>/<audio>)
// ============================================================
interface Tile {
  identity: string;
  name: string;
  isLocal: boolean;
  videoTrack: LkTrack | null;
  audioTrack: LkTrack | null;
  micOn: boolean;
  camOn: boolean;
}

function VideoTile({ tile }: { tile: Tile }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    const t = tile.videoTrack;
    if (el && t) {
      try { t.attach(el); } catch { /* track có thể vừa kết thúc */ }
      return () => { try { t.detach(el); } catch { /* ignore */ } };
    }
    return undefined;
  }, [tile.videoTrack]);

  useEffect(() => {
    // Không phát tiếng của chính mình (tránh vọng); local audio chỉ để đo mic.
    const el = audioRef.current;
    const t = tile.audioTrack;
    if (el && t && !tile.isLocal) {
      try { t.attach(el); } catch { /* ignore */ }
      return () => { try { t.detach(el); } catch { /* ignore */ } };
    }
    return undefined;
  }, [tile.audioTrack, tile.isLocal]);

  const showVideo = tile.camOn && !!tile.videoTrack;

  return (
    <div className="vid-tile">
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={tile.isLocal}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
      ) : (
        <span style={{ color: '#5d7896', fontSize: 12.5, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <Icon name="video" size={15} />Camera đang tắt
        </span>
      )}
      {!tile.isLocal && <audio ref={audioRef} autoPlay />}
      <span className="vid-name">
        {tile.micOn && <Icon name="mic" size={12} />} {tile.name}{tile.isLocal ? ' (Bạn)' : ''}
      </span>
      {!tile.micOn && <span className="vid-mic-off" title="Đang tắt mic"><Icon name="x" size={12} /></span>}
    </div>
  );
}

// ============================================================
// PHÒNG HỌP THẬT (LiveKit)
// ============================================================
function LiveRtcMeeting({
  meetingId,
  url,
  token,
  lib,
  onFatal,
}: {
  meetingId: string;
  url: string;
  token: string;
  lib: LivekitClientLib;
  onFatal: (msg: string) => void;
}) {
  const { user, s, toast } = useApp();
  const nav = useNavigate();
  const m = s.meetings.find((x) => x.id === meetingId);
  const docById = useMemo(() => indexBy(s.documents), [s.documents]);
  const users = useMemo(() => indexBy(s.users), [s.users]);

  const roomRef = useRef<LkRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocFile | null>(null);

  const nameOf = useCallback((identity: string, fallback?: string) => {
    return users.get(identity)?.fullName ?? fallback ?? identity;
  }, [users]);

  // Dựng lại toàn bộ danh sách ô video từ trạng thái phòng hiện tại.
  const rebuild = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const Track = lib.Track;
    const collect = (p: LkParticipant, isLocal: boolean): Tile => {
      const pubs: LkPublication[] = p.getTrackPublications
        ? p.getTrackPublications()
        : Array.from(p.trackPublications?.values() ?? []);
      let videoTrack: LkTrack | null = null;
      let audioTrack: LkTrack | null = null;
      let camOnP = false;
      let micOnP = false;
      for (const pub of pubs) {
        const kind = pub.kind ?? pub.track?.kind;
        const source = pub.source ?? pub.track?.source;
        if (kind === Track.Kind.Video || kind === 'video') {
          // ưu tiên camera; nếu là share màn hình vẫn hiển thị
          if (pub.track) videoTrack = pub.track;
          if (source === Track.Source.Camera || source === 'camera' || source === Track.Source.ScreenShare || source === 'screen_share') {
            camOnP = camOnP || !!pub.track;
          }
        } else if (kind === Track.Kind.Audio || kind === 'audio') {
          if (pub.track) audioTrack = pub.track;
          micOnP = micOnP || !!pub.track;
        }
      }
      return {
        identity: p.identity,
        name: nameOf(p.identity, p.name),
        isLocal,
        videoTrack,
        audioTrack,
        camOn: camOnP,
        micOn: micOnP,
      };
    };

    const local = collect(room.localParticipant, true);
    // local cam/mic dựa trên cờ thiết bị (chính xác hơn danh sách publication khi vừa bật)
    local.camOn = room.localParticipant.isCameraEnabled ?? local.camOn;
    local.micOn = room.localParticipant.isMicrophoneEnabled ?? local.micOn;
    const remotes = Array.from(room.remoteParticipants.values()).map((p) => collect(p, false));
    setTiles([local, ...remotes]);
  }, [lib, nameOf]);

  // Kết nối phòng khi mount; dọn dẹp khi unmount.
  useEffect(() => {
    let disposed = false;
    const RoomEvent = lib.RoomEvent;
    const room = new lib.Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const onChange = () => { if (!disposed) rebuild(); };
    const onDisconnected = () => {
      if (disposed) return;
      setConnected(false);
      onFatal('Đã ngắt kết nối phòng họp trực tuyến');
    };

    for (const ev of [
      RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
    ]) {
      if (ev) room.on(ev, onChange);
    }
    if (RoomEvent.Disconnected) room.on(RoomEvent.Disconnected, onDisconnected);

    (async () => {
      try {
        await room.connect(url, token);
        if (disposed) return;
        setConnected(true);
        rebuild();
        // Bật camera + mic THẬT (getUserMedia). Lỗi quyền/thiết bị -> fallback.
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          await room.localParticipant.setCameraEnabled(true);
          setMicOn(true);
          setCamOn(true);
        } catch (err) {
          // Vẫn trong phòng (nghe/xem người khác được) nhưng không phát được.
          setMicOn(false);
          setCamOn(false);
          toast(
            'Không truy cập được camera/micro (bị từ chối quyền hoặc không có thiết bị). Bạn vẫn xem/nghe được các điểm cầu khác.',
            'error',
          );
        }
        rebuild();
      } catch (err) {
        if (disposed) return;
        onFatal('Không kết nối được phòng họp trực tuyến: ' + ((err as Error)?.message ?? 'lỗi không rõ'));
      }
    })();

    return () => {
      disposed = true;
      try {
        if (RoomEvent.Disconnected) room.off(RoomEvent.Disconnected, onDisconnected);
      } catch { /* ignore */ }
      try { room.disconnect(true); } catch { /* ignore */ }
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token, lib]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      rebuild();
    } catch {
      toast('Không đổi được trạng thái micro', 'error');
    }
  }, [micOn, rebuild, toast]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    const next = !camOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamOn(next);
      rebuild();
    } catch {
      toast('Không bật được camera (bị từ chối quyền hoặc không có thiết bị)', 'error');
    }
  }, [camOn, rebuild, toast]);

  const toggleShare = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    const next = !sharing;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setSharing(next);
      rebuild();
    } catch {
      // người dùng bấm Hủy ở hộp chọn màn hình cũng rơi vào đây
      setSharing(false);
      toast('Không chia sẻ được màn hình (đã hủy hoặc trình duyệt chặn)', 'info');
    }
  }, [sharing, rebuild, toast]);

  const leave = useCallback(() => {
    try { roomRef.current?.disconnect(true); } catch { /* ignore */ }
    nav(`/meetings/${meetingId}/live`);
  }, [meetingId, nav]);

  if (!m || !user) return null;
  const currentItem = m.agenda.find((a) => a.id === m.currentAgendaItemId) ?? m.agenda[0];

  return (
    <div className="online-shell">
      <div className="live-top">
        <button className="icon-btn" style={{ color: '#c8d6e8' }} onClick={leave} title="Về phòng họp">
          <Icon name="chevleft" />
        </button>
        <div style={{ flex: 1 }}>
          <h2>{m.title}</h2>
          <div className="sub">
            Họp trực tuyến · {tiles.length} điểm cầu{currentItem ? ` · Đang thảo luận: Mục ${currentItem.order}` : ''}
          </div>
        </div>
        <span className="live-banner" style={{ background: 'rgba(29,158,95,.18)', borderColor: 'rgba(29,158,95,.4)', color: '#7de0ae' }}>
          <span className="live-dot" />{connected ? 'Trực tuyến' : 'Đang kết nối…'}
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
        {tiles.map((t) => <VideoTile key={t.identity + (t.isLocal ? ':self' : '')} tile={t} />)}
        {tiles.length === 0 && (
          <div className="vid-tile">
            <span style={{ color: '#5d7896', fontSize: 12.5 }}>Đang kết nối phòng họp…</span>
          </div>
        )}
      </div>

      <div className="online-bar">
        <button className={'ctl-btn' + (micOn ? '' : ' off')} title={micOn ? 'Tắt micro' : 'Bật micro'} onClick={toggleMic}>
          <Icon name="mic" size={20} />
        </button>
        <button className={'ctl-btn' + (camOn ? '' : ' off')} title={camOn ? 'Tắt camera' : 'Bật camera'} onClick={toggleCam}>
          <Icon name="video" size={20} />
        </button>
        <button className={'ctl-btn' + (sharing ? ' off' : '')} title={sharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'} onClick={toggleShare}>
          <Icon name="monitor" size={20} />
        </button>
        <button className="ctl-btn leave" onClick={leave}>
          <Icon name="logout" size={17} />Rời điểm cầu
        </button>
      </div>
      <p className="online-note">
        Họp trực tuyến thật — âm thanh, hình ảnh và chia sẻ màn hình được truyền trực tiếp qua máy chủ.
      </p>

      {viewDoc && <DocViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

// ============================================================
// TRANG ĐIỀU PHỐI: quyết định dùng RTC thật hay mô phỏng
// ============================================================
type Phase =
  | { mode: 'loading' }
  | { mode: 'sim'; notice?: string }
  | { mode: 'rtc'; url: string; token: string; lib: LivekitClientLib };

export default function OnlineMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, s, toast } = useApp();
  const [phase, setPhase] = useState<Phase>({ mode: 'loading' });

  const meeting = s.meetings.find((x) => x.id === id);

  const fallbackToSim = useCallback((msg?: string) => {
    if (msg) toast(msg, 'error');
    setPhase({ mode: 'sim', notice: msg });
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Không phải chế độ máy chủ hoặc adapter không hỗ trợ RTC -> mô phỏng.
      if (!db.remote || !db.rtcConfig || !db.rtcToken || !id) {
        if (!cancelled) setPhase({ mode: 'sim' });
        return;
      }
      try {
        const cfg = await db.rtcConfig();
        if (cancelled) return;
        if (!cfg?.enabled) {
          // Server chưa bật LiveKit -> giữ giao diện mô phỏng (không báo lỗi ồn ào).
          setPhase({ mode: 'sim' });
          return;
        }
        // Xin token cho phiên họp (server kiểm tra là thành phần phiên).
        const t = await db.rtcToken(id);
        if (cancelled) return;
        if (!t?.url || !t?.token) {
          setPhase({ mode: 'sim' });
          return;
        }
        // Tải livekit-client UMD qua CDN.
        const lib = await loadLivekit();
        if (cancelled) return;
        setPhase({ mode: 'rtc', url: t.url, token: t.token, lib });
      } catch (e) {
        if (cancelled) return;
        const err = e as Error & { status?: number };
        // 403: không thuộc thành phần phiên -> vẫn về mô phỏng nhưng báo rõ.
        const msg = err?.status === 403
          ? 'Bạn không thuộc thành phần phiên họp — hiển thị giao diện minh họa.'
          : 'Không vào được họp trực tuyến (' + (err?.message ?? 'lỗi') + ') — chuyển sang giao diện minh họa.';
        fallbackToSim(msg);
      }
    })();
    return () => { cancelled = true; };
  }, [id, fallbackToSim]);

  if (!meeting || !user) return null;

  if (phase.mode === 'loading') {
    return (
      <div className="online-shell">
        <div className="online-grid">
          <div className="vid-tile">
            <span style={{ color: '#5d7896', fontSize: 13 }}>Đang chuẩn bị phòng họp…</span>
          </div>
        </div>
      </div>
    );
  }

  if (phase.mode === 'rtc') {
    return (
      <LiveRtcMeeting
        meetingId={meeting.id}
        url={phase.url}
        token={phase.token}
        lib={phase.lib}
        onFatal={(msg) => fallbackToSim(msg)}
      />
    );
  }

  return <SimulatedMeeting meetingId={meeting.id} notice={phase.notice} />;
}
