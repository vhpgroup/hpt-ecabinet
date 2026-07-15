// ============================================================
// PHIÊN HỌP — vòng đời: nháp -> mời họp -> diễn ra -> kết thúc
// Điểm danh, phát biểu, kết luận, biên bản & ký số (mô phỏng).
// ============================================================
import { db } from '../data/db';
import {
  uid, type AgendaItem, type AttendStatus, type Conclusion, type Meeting,
  type Participant, type SignatureInfo, type SpeakRequest, type Unit, type User,
} from '../domain/types';
import { audit } from './adminService';
import { notify } from './notificationService';

const nowIso = () => new Date().toISOString();

export interface MeetingDraft {
  id?: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  roomId: string;
  isOnline: boolean;
  chairId: string;
  secretaryId: string;
  memberIds: string[];
  /** khách mời — tham dự nhưng không thuộc thành phần biểu quyết */
  guestIds?: string[];
  agenda: AgendaItem[];
}

export async function saveMeeting(actor: User, draft: MeetingDraft): Promise<Meeting> {
  if (draft.id) {
    const existing = await db.meetings.get(draft.id);
    if (!existing) throw new Error('Không tìm thấy phiên họp');
    // giữ trạng thái xác nhận cũ của người đã có trong danh sách
    const participants: Participant[] = buildParticipants(draft, existing.participants);
    const updated = await db.meetings.update(draft.id, {
      title: draft.title, description: draft.description,
      startTime: draft.startTime, endTime: draft.endTime,
      roomId: draft.roomId, isOnline: draft.isOnline,
      chairId: draft.chairId, secretaryId: draft.secretaryId,
      participants, agenda: draft.agenda,
    });
    await audit(actor, 'Cập nhật phiên họp', `Cập nhật "${updated.title}"`);
    return updated;
  }
  const meeting: Meeting = {
    id: uid(),
    code: `PH-${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 90 + 10)}`,
    title: draft.title, description: draft.description,
    startTime: draft.startTime, endTime: draft.endTime,
    roomId: draft.roomId, isOnline: draft.isOnline,
    status: 'draft',
    chairId: draft.chairId, secretaryId: draft.secretaryId,
    participants: buildParticipants(draft),
    agenda: draft.agenda,
    currentAgendaItemId: null,
    conclusions: [], minutes: null,
    createdBy: actor.id, createdAt: nowIso(),
  };
  await db.meetings.create(meeting);
  await audit(actor, 'Tạo phiên họp', `Tạo phiên họp "${meeting.title}" (${meeting.code})`);
  return meeting;
}

function buildParticipants(draft: MeetingDraft, old: Participant[] = []): Participant[] {
  const find = (id: string) => old.find((p) => p.userId === id);
  const memberSet = new Set([draft.chairId, draft.secretaryId, ...draft.memberIds]);
  const guestIds = (draft.guestIds ?? []).filter((idX) => !memberSet.has(idX));
  const ids = [...Array.from(memberSet), ...guestIds];
  return ids.map((userId) => {
    const prev = find(userId);
    const meetingRole: Participant['meetingRole'] =
      userId === draft.chairId ? 'chair'
      : userId === draft.secretaryId ? 'secretary'
      : guestIds.includes(userId) ? 'guest'
      : 'member';
    return prev
      ? { ...prev, meetingRole }
      : { userId, meetingRole, attendStatus: userId === draft.chairId || userId === draft.secretaryId ? 'accepted' : 'pending', checkedInAt: null };
  });
}

export async function deleteMeeting(actor: User, id: string) {
  const m = await db.meetings.get(id);
  await db.meetings.remove(id);
  await audit(actor, 'Xóa phiên họp', `Xóa "${m?.title ?? id}"`);
}

/** Gửi giấy mời: chuyển trạng thái + thông báo tới đại biểu */
export async function sendInvitations(actor: User, meetingId: string) {
  // GĐ4 — chế độ máy chủ: endpoint nghiệp vụ (server thông báo + audit)
  if (db.action) { await db.action(`/meetings/${meetingId}/invite`); return; }
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  await db.meetings.update(meetingId, { status: 'invited', invitedAt: nowIso() });
  await notify(
    m.participants.map((p) => p.userId).filter((idX) => idX !== actor.id),
    'Giấy mời họp',
    `Bạn được mời dự "${m.title}" — ${new Date(m.startTime).toLocaleString('vi-VN')}. Vui lòng xác nhận tham dự.`,
    'meeting',
    `#/meetings/${meetingId}`,
  );
  await audit(actor, 'Gửi giấy mời', `Gửi giấy mời "${m.title}" đến ${m.participants.length} đại biểu (email + SMS)`);
}

/** Đại biểu xác nhận / từ chối / ủy quyền */
export async function respondInvitation(
  actor: User, meetingId: string, status: AttendStatus,
  opts: { reason?: string; delegateToId?: string } = {},
) {
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  const participants = m.participants.map((p) =>
    p.userId === actor.id
      ? { ...p, attendStatus: status, declineReason: opts.reason, delegateToId: opts.delegateToId }
      : p,
  );
  // người được ủy quyền tham dự với vai trò khách mời
  if (status === 'delegated' && opts.delegateToId && !participants.some((p) => p.userId === opts.delegateToId)) {
    participants.push({ userId: opts.delegateToId, meetingRole: 'guest', attendStatus: 'accepted', checkedInAt: null });
  }
  await db.meetings.update(meetingId, { participants });
  const label = status === 'accepted' ? 'xác nhận tham dự' : status === 'declined' ? 'báo vắng' : 'ủy quyền tham dự';
  await notify([m.secretaryId], 'Phản hồi giấy mời', `${actor.fullName} đã ${label} phiên họp "${m.title}".`, 'meeting', `#/meetings/${meetingId}`);
  await audit(actor, 'Phản hồi giấy mời', `${label} — "${m.title}"`);
}

export async function startMeeting(actor: User, meetingId: string) {
  if (db.action) { await db.action(`/meetings/${meetingId}/start`); return; }
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  await db.meetings.update(meetingId, { status: 'live', currentAgendaItemId: m.agenda[0]?.id ?? null });
  await notify(m.participants.map((p) => p.userId), 'Phiên họp bắt đầu', `"${m.title}" đã khai mạc. Mời đại biểu điểm danh và vào phòng họp.`, 'meeting', `#/meetings/${meetingId}/live`);
  await audit(actor, 'Bắt đầu phiên họp', `Khai mạc "${m.title}"`);
}

export async function endMeeting(actor: User, meetingId: string) {
  if (db.action) { await db.action(`/meetings/${meetingId}/end`); return; }
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  await db.meetings.update(meetingId, { status: 'finished' });
  await audit(actor, 'Kết thúc phiên họp', `Bế mạc "${m.title}"`);
}

/** Điểm danh (tự điểm danh hoặc thư ký điểm danh hộ) */
export async function checkIn(actor: User, meetingId: string, userId: string) {
  // GĐ4 — chế độ máy chủ: server kiểm tra phiên đang diễn ra, đúng thành phần, quyền điểm danh hộ
  if (db.action) { await db.action(`/meetings/${meetingId}/checkin`, { userId }); return; }
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  const participants = m.participants.map((p) =>
    p.userId === userId ? { ...p, checkedInAt: p.checkedInAt ?? nowIso(), attendStatus: 'accepted' as AttendStatus } : p,
  );
  await db.meetings.update(meetingId, { participants });
  await audit(actor, 'Điểm danh', `Điểm danh ${userId === actor.id ? 'cá nhân' : 'hộ đại biểu'} tại "${m.title}"`);
}

export async function setCurrentAgendaItem(actor: User, meetingId: string, agendaItemId: string) {
  await db.meetings.update(meetingId, { currentAgendaItemId: agendaItemId });
  const m = await db.meetings.get(meetingId);
  const item = m?.agenda.find((a) => a.id === agendaItemId);
  await audit(actor, 'Chuyển nội dung', `Chuyển sang mục "${item?.title ?? ''}"`);
}

// ----- Đăng ký phát biểu -----
export async function requestSpeak(actor: User, meetingId: string, topic?: string) {
  const all = await db.speakRequests.list();
  if (all.some((s) => s.meetingId === meetingId && s.userId === actor.id && ['waiting', 'speaking'].includes(s.status))) {
    throw new Error('Bạn đã có lượt đăng ký phát biểu đang chờ');
  }
  const sr: SpeakRequest = { id: uid(), meetingId, userId: actor.id, topic, status: 'waiting', requestedAt: nowIso() };
  await db.speakRequests.create(sr);
}

export async function actOnSpeak(actor: User, id: string, action: 'start' | 'end' | 'reject') {
  if (action === 'start') {
    // kết thúc người đang phát biểu trước đó
    const req = await db.speakRequests.get(id);
    if (req) {
      const all = await db.speakRequests.list();
      for (const s of all.filter((x) => x.meetingId === req.meetingId && x.status === 'speaking')) {
        await db.speakRequests.update(s.id, { status: 'done', endedAt: nowIso() });
      }
    }
    await db.speakRequests.update(id, { status: 'speaking', startedAt: nowIso() });
  } else if (action === 'end') {
    await db.speakRequests.update(id, { status: 'done', endedAt: nowIso() });
  } else {
    await db.speakRequests.update(id, { status: 'rejected' });
  }
}

// ----- Kết luận -----
export async function addConclusion(actor: User, meetingId: string, content: string, agendaItemId?: string) {
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  const conclusion: Conclusion = { id: uid(), content, agendaItemId, createdAt: nowIso() };
  await db.meetings.update(meetingId, { conclusions: [...m.conclusions, conclusion] });
  await audit(actor, 'Ghi kết luận', `Kết luận tại "${m.title}"`);
}

// ============================================================
// BIÊN BẢN — dựng theo thể thức Nghị định 30/2020/NĐ-CP (P0-B)
// ============================================================

/**
 * Chuẩn hóa ký hiệu cơ quan (dùng cho "BB-{ký hiệu}" và "Lưu: VT, {ký hiệu}").
 * Bỏ tiền tố loại đơn vị (Sở/Ban/UBND…) & khoảng trắng → lấy phần ký hiệu gọn.
 * VD: "VP UBND" → "UBND"; "Sở KH&ĐT" → "KH&ĐT"; "Sở TT&TT" → "TT&TT".
 */
export function orgSymbol(unitShort?: string): string {
  if (!unitShort) return 'VP';
  let s = unitShort.trim();
  // bỏ các tiền tố loại hình đơn vị phổ biến
  s = s.replace(/^(VP\s+|Sở\s+|Ban\s+|Phòng\s+|UBND\s+|Cục\s+|Chi cục\s+)/i, '');
  s = s.replace(/\s+/g, '');
  return s || 'VP';
}

/**
 * Cấp số biên bản kế tiếp theo NĂM hiện tại (client-side).
 * Đếm các phiên đã có minutes.documentNumber trong cùng năm → max + 1.
 * TODO (P1): thay bằng endpoint cấp số NGUYÊN TỬ phía máy chủ để tránh trùng
 *            khi nhiều thư ký thao tác đồng thời.
 */
export async function nextMinutesNumber(unitShort?: string): Promise<string> {
  const year = new Date().getFullYear();
  const all = await db.meetings.list();
  let max = 0;
  for (const mx of all) {
    // Số biên bản lưu ở cấp Meeting (documentNumber); vẫn dò minutes.documentNumber
    // để tương thích dữ liệu cũ nếu có.
    const dn = mx.documentNumber ?? (mx.minutes as { documentNumber?: string } | null | undefined)?.documentNumber;
    if (!dn) continue;
    // khớp "Số: 12/BB-..." và (khi có) kèm năm; nếu không mang năm thì vẫn tính vào năm hiện tại
    const numMatch = dn.match(/(\d+)\s*\/\s*BB/i);
    if (!numMatch) continue;
    const yearMatch = dn.match(/\/(\d{4})\b/);
    if (yearMatch && Number(yearMatch[1]) !== year) continue;
    const n = Number(numMatch[1]);
    if (n > max) max = n;
  }
  return `Số: ${max + 1}/BB-${orgSymbol(unitShort)}`;
}

/**
 * Đảm bảo phiên họp đã có số biên bản; nếu chưa thì cấp mới & lưu vào meeting.
 * Trả về documentNumber hiện hành. `chairUnitShort` = ký hiệu đơn vị chủ tọa.
 */
export async function ensureMinutesNumber(meetingId: string, chairUnitShort?: string): Promise<string> {
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  if (m.documentNumber) return m.documentNumber;
  const dn = await nextMinutesNumber(chairUnitShort);
  await db.meetings.update(meetingId, { documentNumber: dn });
  return dn;
}

export interface MinutesOpts {
  /** Danh sách đơn vị (để tra tên cơ quan chủ quản & ký hiệu theo chủ tọa) */
  units?: Unit[];
  /** Số & ký hiệu văn bản; nếu bỏ trống dùng m.documentNumber */
  documentNumber?: string;
  /** Địa danh nơi ban hành; nếu bỏ trống dùng m.documentLocation */
  location?: string;
  /** Nơi nhận; nếu bỏ trống dùng m.recipients */
  recipients?: string[];
}

export function buildMinutesDraft(
  m: Meeting,
  users: User[],
  voteSummaries: string[],
  docComments: string[] = [],
  opts: MinutesOpts = {},
): string {
  const u = (idX: string) => users.find((x) => x.id === idX);
  const units = opts.units ?? [];
  const chair = u(m.chairId);
  const chairUnit = units.find((x) => x.id === chair?.unitId);
  // Tên cơ quan chủ quản (in hoa) — đơn vị của chủ tọa
  const orgName = (chairUnit?.name ?? 'ỦY BAN NHÂN DÂN TỈNH').toUpperCase();
  const symbol = orgSymbol(chairUnit?.short);

  const documentNumber = opts.documentNumber ?? m.documentNumber ?? `Số: …/BB-${symbol}`;
  const location = (opts.location ?? m.documentLocation ?? '………').trim() || '………';
  const recipients = opts.recipients ?? m.recipients ?? [];

  const start = new Date(m.startTime);
  const dd = String(start.getDate()).padStart(2, '0');
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const yyyy = start.getFullYear();
  const hh = String(start.getHours()).padStart(2, '0');
  const mi = String(start.getMinutes()).padStart(2, '0');
  const endTime = new Date(m.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const present = m.participants.filter((p) => p.checkedInAt);
  const absent = m.participants.filter((p) => p.attendStatus === 'declined');

  // số mục cố định I–V
  const lines: string[] = [
    // Quốc hiệu — Tiêu ngữ — vạch ngăn
    'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    'Độc lập - Tự do - Hạnh phúc',
    '---------------',
    '',
    // Tên cơ quan (đơn vị chủ tọa, in hoa) + địa danh, ngày tháng
    orgName,
    `${location}, ngày ${dd} tháng ${mm} năm ${yyyy}`,
    documentNumber,
    '',
    // Tên loại + trích yếu
    'BIÊN BẢN',
    m.title,
    `(Mã phiên họp: ${m.code})`,
    '',
    // Câu mở đầu
    `Hôm nay, lúc ${hh} giờ ${mi} phút, ngày ${dd} tháng ${mm} năm ${yyyy}, tại ………, diễn ra phiên họp: ${m.title}.`,
    '',
    // I. THÀNH PHẦN
    'I. THÀNH PHẦN THAM DỰ',
    `- Chủ trì: ${chair?.fullName ?? ''}${chair?.title ? ` — ${chair.title}` : ''}.`,
    `- Thư ký: ${u(m.secretaryId)?.fullName ?? ''}${u(m.secretaryId)?.title ? ` — ${u(m.secretaryId)?.title}` : ''}.`,
    `- Có mặt: ${present.length}/${m.participants.length} đại biểu.`
      + (absent.length ? ` Vắng mặt (có lý do): ${absent.map((p) => u(p.userId)?.fullName).filter(Boolean).join(', ')}.` : ''),
    '',
    // II. CHƯƠNG TRÌNH
    'II. CHƯƠNG TRÌNH LÀM VIỆC',
    ...(m.agenda.length
      ? m.agenda.map((a, i) => `${i + 1}. ${a.title}${a.presenterId ? ` — Trình bày: ${u(a.presenterId)?.fullName ?? ''}` : ''}.`)
      : ['(Chưa có chương trình)']),
    '',
    // III. DIỄN BIẾN
    'III. DIỄN BIẾN PHIÊN HỌP',
    ...(m.agenda.length
      ? m.agenda.map((a, i) => `${i + 1}. ${a.title}: đại biểu nghe trình bày, thảo luận và cho ý kiến.`)
      : ['Phiên họp tiến hành theo chương trình đã thông qua.']),
    ...(docComments.length ? ['', 'Tổng hợp ý kiến góp ý trên tài liệu:', ...docComments] : []),
    '',
    // IV. KẾT QUẢ BIỂU QUYẾT
    'IV. KẾT QUẢ BIỂU QUYẾT',
    ...(voteSummaries.length ? voteSummaries : ['(Không có nội dung biểu quyết)']),
    '',
    // V. KẾT LUẬN CHỦ TỌA
    'V. KẾT LUẬN CỦA CHỦ TỌA',
    ...(m.conclusions.length
      ? m.conclusions.map((c, i) => `(${i + 1}) ${c.content}`)
      : ['(Chưa có kết luận)']),
    '',
    // Câu kết thúc
    `Phiên họp kết thúc lúc ${endTime} cùng ngày. Biên bản được lập và ký số trên Hệ thống phòng họp không giấy eCabinet.`,
    '',
    // Nơi nhận / Lưu
    'Nơi nhận:',
    ...(recipients.length ? recipients.map((r) => `- ${r};`) : ['- Như thành phần dự họp;']),
    `- Lưu: VT, ${symbol}.`,
  ];
  return lines.join('\n');
}

export async function saveMinutes(actor: User, meetingId: string, content: string) {
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  if (m.minutes?.locked) throw new Error('Biên bản đã ký số, không thể chỉnh sửa');
  await db.meetings.update(meetingId, {
    minutes: { content, updatedAt: nowIso(), signatures: m.minutes?.signatures ?? [], locked: false },
  });
  await audit(actor, 'Cập nhật biên bản', `Cập nhật biên bản "${m.title}"`);
}

async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // fallback khi không có crypto.subtle (môi trường không bảo mật)
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return 'fb' + Math.abs(h).toString(16).padStart(12, '0');
  }
}

/** Ký số — chế độ máy chủ: hash + serial + khóa biên bản do SERVER quyết định */
export async function signMinutes(actor: User, meetingId: string, pin: string) {
  if (db.action) {
    return (await db.action(`/meetings/${meetingId}/sign`, { pin })) as SignatureInfo;
  }
  if (!/^\d{6}$/.test(pin)) throw new Error('Mã PIN chứng thư số phải gồm 6 chữ số');
  const m = await db.meetings.get(meetingId);
  if (!m?.minutes) throw new Error('Chưa có biên bản để ký');
  if (m.minutes.signatures.some((s) => s.signerId === actor.id)) throw new Error('Bạn đã ký biên bản này');
  const hash = await sha256(m.minutes.content);
  const sig: SignatureInfo = {
    signerId: actor.id,
    signerName: actor.fullName,
    signerTitle: actor.title,
    signedAt: nowIso(),
    serial: `VN-DEMO-CA:${Math.floor(1000 + Math.random() * 9000)}:${Math.random().toString(16).slice(2, 8)}`,
    hash,
  };
  const signatures = [...m.minutes.signatures, sig];
  // đủ chữ ký thư ký + chủ trì thì khóa biên bản
  const locked = signatures.some((s) => s.signerId === m.chairId) && signatures.some((s) => s.signerId === m.secretaryId);
  await db.meetings.update(meetingId, { minutes: { ...m.minutes, signatures, locked } });
  await audit(actor, 'Ký số biên bản', `Ký số biên bản "${m.title}" (serial ${sig.serial})`);
  return sig;
}
