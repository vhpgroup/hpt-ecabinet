// ============================================================
// BIỂU QUYẾT (trong họp) & PHIẾU LẤY Ý KIẾN (ngoài họp)
// ============================================================
import { db } from '../data/db';
import { uid, type Ballot, type PassThreshold, type User, type Vote, type VoteKind, type VoteStatus } from '../domain/types';
import { audit } from './adminService';
import { notify } from './notificationService';
import { sha256Hex } from './sha256';

const nowIso = () => new Date().toISOString();

export interface VoteDraft {
  kind: VoteKind;
  meetingId?: string | null;
  agendaItemId?: string | null;
  title: string;
  description?: string;
  optionLabels: string[];
  secret: boolean;
  deadline?: string;
  documentIds: string[];
  eligibleIds: string[];
  // ---- Ngưỡng thông qua (P0-A) ----
  passThreshold?: PassThreshold;
  /** Chỉ số phương án "Tán thành" trong optionLabels (mặc định 0 = phương án đầu) */
  approveOptionIndex?: number;
  /** Chỉ số phương án "Ý kiến khác/Phiếu trắng" (không bắt buộc) */
  abstainOptionIndex?: number;
  /** Cán bộ theo dõi (E-HSMT dòng 372, chỉ có nghĩa với kind='poll'). OPTIONAL. */
  trackerUserId?: string;
  /**
   * E-HSMT mục 13 "Lưu nháp (chưa gửi)": chỉ áp dụng cho kind='poll'.
   * true  -> tạo ở trạng thái 'draft' (chưa gửi, chưa thông báo thành viên).
   * false/undefined -> giữ hành vi CŨ: poll mở ngay ('open'), vote chờ mở ('pending').
   */
  saveAsDraft?: boolean;
}

export async function createVote(actor: User, draft: VoteDraft): Promise<Vote> {
  const options = draft.optionLabels.filter(Boolean).map((label, i) => ({ id: 'o' + (i + 1), label }));
  const approveIdx = draft.approveOptionIndex ?? 0;
  const isDraftPoll = draft.kind === 'poll' && draft.saveAsDraft === true;
  const status: VoteStatus = isDraftPoll ? 'draft' : draft.kind === 'poll' ? 'open' : 'pending';
  const vote: Vote = {
    id: uid(),
    kind: draft.kind,
    meetingId: draft.meetingId ?? null,
    agendaItemId: draft.agendaItemId ?? null,
    title: draft.title,
    description: draft.description,
    options,
    secret: draft.secret,
    status,
    deadline: draft.deadline,
    documentIds: draft.documentIds,
    ballots: [],
    eligibleIds: draft.eligibleIds,
    createdBy: actor.id,
    createdAt: nowIso(),
    openedAt: status === 'open' ? nowIso() : undefined,
    // ngưỡng thông qua + phương án tán thành/ý kiến khác
    passThreshold: draft.passThreshold ?? 'majority',
    approveOptionId: options[approveIdx]?.id ?? options[0]?.id,
    abstainOptionId: draft.abstainOptionIndex != null ? options[draft.abstainOptionIndex]?.id : undefined,
    trackerUserId: draft.trackerUserId || undefined,
  };
  await db.votes.create(vote);
  if (vote.kind === 'poll' && status === 'open') {
    await notify(vote.eligibleIds.filter((x) => x !== actor.id), 'Phiếu lấy ý kiến mới',
      `Đề nghị cho ý kiến: "${vote.title}"${vote.deadline ? ` — hạn ${new Date(vote.deadline).toLocaleString('vi-VN')}` : ''}.`,
      'poll', '#/polls');
  }
  await audit(actor, vote.kind === 'poll' ? (isDraftPoll ? 'Lưu nháp phiếu lấy ý kiến' : 'Tạo phiếu lấy ý kiến') : 'Tạo biểu quyết', `"${vote.title}"`);
  return vote;
}

export async function openVote(actor: User, voteId: string) {
  // GĐ4 — chế độ máy chủ: endpoint nghiệp vụ kiểm tra sâu + tự thông báo/audit
  if (db.action) { await db.action(`/vote/${voteId}/open`); return; }
  const v = await db.votes.update(voteId, { status: 'open', openedAt: nowIso() });
  await notify(v.eligibleIds, v.kind === 'poll' ? 'Phiếu lấy ý kiến mới' : 'Biểu quyết đang mở',
    v.kind === 'poll' ? `Đề nghị cho ý kiến: "${v.title}"${v.deadline ? ` — hạn ${new Date(v.deadline).toLocaleString('vi-VN')}` : ''}.` : `Biểu quyết "${v.title}" đang chờ ý kiến của bạn.`,
    v.kind === 'poll' ? 'poll' : 'vote',
    v.meetingId ? `#/meetings/${v.meetingId}/live` : '#/polls');
  await audit(actor, v.kind === 'poll' ? 'Gửi phiếu lấy ý kiến' : 'Mở biểu quyết', `${v.kind === 'poll' ? 'Gửi' : 'Mở'} "${v.title}"`);
}

export async function closeVote(actor: User, voteId: string) {
  if (db.action) { await db.action(`/vote/${voteId}/close`); return; }
  const v = await db.votes.update(voteId, { status: 'closed', closedAt: nowIso() });
  await audit(actor, 'Đóng biểu quyết', `Đóng "${v.title}" — ${v.ballots.length}/${v.eligibleIds.length} phiếu`);
}

export async function castBallot(actor: User, voteId: string, optionId: string, comment?: string) {
  // GĐ4 — chế độ máy chủ: server xác thực đủ điều kiện, danh tính lấy từ JWT
  if (db.action) { await db.action(`/vote/${voteId}/ballot`, { optionId, comment }); return; }
  const v = await db.votes.get(voteId);
  if (!v) throw new Error('Không tìm thấy nội dung biểu quyết');
  if (v.status !== 'open') throw new Error('Nội dung này chưa mở hoặc đã đóng biểu quyết');
  if (!v.eligibleIds.includes(actor.id)) throw new Error('Bạn không thuộc thành phần biểu quyết');
  if (v.ballots.some((b) => b.userId === actor.id)) throw new Error('Bạn đã biểu quyết nội dung này');
  await db.votes.update(voteId, {
    ballots: [...v.ballots, { userId: actor.id, optionId, comment, castAt: nowIso() }],
  });
}

/**
 * Ký số & gửi ý kiến (E-HSMT mục 30 + quy trình lấy ý kiến văn bản, dòng 373).
 * Mô phỏng — CHƯA tích hợp CA thật (khớp mức mô phỏng của ký biên bản).
 * Chế độ demo: tự tính SHA-256 trên voteId|userId|optionId|comment (sha256.ts sẵn có),
 * serial ngẫu nhiên theo cùng khuôn mẫu ký biên bản.
 * Chế độ REST: gửi kèm signPin trong action ballot — server tự tính, không client-side.
 */
export async function castBallotSigned(actor: User, voteId: string, optionId: string, comment: string | undefined, signPin: string) {
  if (!/^\d{6}$/.test(signPin)) throw new Error('Mã PIN ký số phải gồm 6 chữ số');
  // GĐ4 — chế độ máy chủ: gửi thêm signPin, server tự tính chữ ký (không tin client)
  if (db.action) { await db.action(`/vote/${voteId}/ballot`, { optionId, comment, signPin }); return; }
  const v = await db.votes.get(voteId);
  if (!v) throw new Error('Không tìm thấy nội dung biểu quyết');
  if (v.status !== 'open') throw new Error('Nội dung này chưa mở hoặc đã đóng biểu quyết');
  if (!v.eligibleIds.includes(actor.id)) throw new Error('Bạn không thuộc thành phần biểu quyết');
  if (v.ballots.some((b) => b.userId === actor.id)) throw new Error('Bạn đã cho ý kiến nội dung này');
  const castAt = nowIso();
  const hash = sha256Hex(`${voteId}|${actor.id}|${optionId}|${comment ?? ''}`);
  const signature = {
    signedAt: castAt,
    serialNumber: `VN-DEMO-CA:${Math.floor(1000 + Math.random() * 9000)}:${Math.random().toString(16).slice(2, 8)}`,
    hash,
    signerName: actor.fullName,
  };
  const ballot: Ballot = { userId: actor.id, optionId, comment, castAt, signature };
  await db.votes.update(voteId, { ballots: [...v.ballots, ballot] });
  await audit(actor, 'Ký số & gửi ý kiến', `Ký số ý kiến "${v.title}" (serial ${signature.serialNumber})`);
}

/** VNPT: "Nhắc quá hạn cho ý kiến" — gửi nhắc những người chưa phản hồi */
export async function remindPoll(actor: User, voteId: string): Promise<number> {
  const v = await db.votes.get(voteId);
  if (!v) throw new Error('Không tìm thấy phiếu lấy ý kiến');
  if (v.status !== 'open') throw new Error('Phiếu đã kết thúc');
  const pending = v.eligibleIds.filter(
    (idX) => idX !== actor.id && !v.ballots.some((b) => b.userId === idX),
  );
  if (!pending.length) return 0;
  await notify(pending, 'Nhắc cho ý kiến',
    `Đề nghị cho ý kiến "${v.title}"${v.deadline ? ` trước ${new Date(v.deadline).toLocaleString('vi-VN')}` : ''}. (Email/SMS nhắc kèm theo — mô phỏng)`,
    'poll', '#/polls');
  await audit(actor, 'Gửi nhắc nhở', `Nhắc ${pending.length} người chưa cho ý kiến — "${v.title}"`);
  return pending.length;
}

export interface VoteResultRow { optionId: string; label: string; count: number; percent: number }

export function voteResults(v: Vote): VoteResultRow[] {
  const total = v.ballots.length || 1;
  return v.options.map((o) => {
    const count = v.ballots.filter((b) => b.optionId === o.id).length;
    return { optionId: o.id, label: o.label, count, percent: Math.round((count / total) * 100) };
  });
}

// ============================================================
// NGƯỠNG THÔNG QUA (P0-A) — voteOutcome là hàm THUẦN, KHÔNG phụ thuộc db.
// Mẫu số = số người CÓ QUYỀN (eligibleIds.length); vắng = chưa tán thành.
// ============================================================

/** Ngưỡng mặc định khi Vote chưa gắn passThreshold */
export const DEFAULT_PASS_THRESHOLD: PassThreshold = 'majority';

/** Số phiếu tán thành tối thiểu để "Thông qua" trên tổng `total` người có quyền */
export function requiredVotes(threshold: PassThreshold, total: number): number {
  if (total <= 0) return 0;
  switch (threshold) {
    case 'two_thirds': return Math.ceil((total * 2) / 3);
    case 'all': return total;
    case 'majority':
    default: return Math.floor(total / 2) + 1;
  }
}

/** Mô tả ngưỡng bằng tiếng Việt (dùng cho biên bản & panel) */
export function thresholdLabel(threshold: PassThreshold): string {
  switch (threshold) {
    case 'two_thirds': return 'hai phần ba tổng số thành viên';
    case 'all': return 'toàn bộ thành viên';
    case 'majority':
    default: return 'quá nửa tổng số thành viên';
  }
}

export interface VoteOutcome {
  status: VoteStatus;
  approveOptionId: string;
  totalEligible: number;
  approve: number;
  against: number;
  abstain: number;
  notVoted: number;
  ballotsCount: number;
  threshold: PassThreshold;
  required: number;
  approvePercentOfEligible: number;
  approved: boolean;
  decided: boolean;
  label: string;
}

const ABSTAIN_RE = /ý kiến khác|phiếu trắng/i;

/**
 * Tính kết quả biểu quyết theo ngưỡng, trên MẪU SỐ = eligibleIds.length.
 * Thuần túy — chỉ đọc optionId/castAt/eligibleIds/options nên an toàn với
 * cả bản chiếu biểu quyết kín từ server (đã ẩn userId/comment).
 */
export function voteOutcome(v: Vote): VoteOutcome {
  const threshold: PassThreshold = v.passThreshold ?? DEFAULT_PASS_THRESHOLD;
  const total = v.eligibleIds.length;
  const approveOptionId = v.approveOptionId ?? v.options[0]?.id ?? '';
  // phương án "ý kiến khác/phiếu trắng": ưu tiên cấu hình, nếu không dò theo nhãn
  const abstainOptionId =
    v.abstainOptionId ?? v.options.find((o) => ABSTAIN_RE.test(o.label))?.id;

  const ballotsCount = v.ballots.length;
  const approve = v.ballots.filter((b) => b.optionId === approveOptionId).length;
  const abstain = abstainOptionId ? v.ballots.filter((b) => b.optionId === abstainOptionId).length : 0;
  const against = Math.max(0, ballotsCount - approve - abstain);
  const notVoted = Math.max(0, total - ballotsCount);

  const required = requiredVotes(threshold, total);
  const approved = total > 0 && approve >= required;
  const decided = v.status === 'closed';
  const approvePercentOfEligible = total > 0 ? Math.round((approve / total) * 100) : 0;

  let label: string;
  if (v.status === 'draft') label = 'Nháp — chưa gửi';
  else if (v.status === 'pending') label = 'Chưa đủ điều kiện';
  else if (v.status === 'open') label = 'Đang biểu quyết';
  else label = approved ? 'Thông qua' : 'Không thông qua'; // closed

  return {
    status: v.status,
    approveOptionId,
    totalEligible: total,
    approve, against, abstain, notVoted,
    ballotsCount,
    threshold,
    required,
    approvePercentOfEligible,
    approved,
    decided,
    label,
  };
}

/**
 * Dòng tóm tắt cho biên bản/hiển thị.
 * - withOutcome=false (mặc định) HOẶC kind==='poll': GIỮ NGUYÊN chuỗi cũ.
 * - withOutcome=true & kind==='vote': dòng đầy đủ kèm kết luận theo ngưỡng.
 */
export function voteSummaryLine(v: Vote, withOutcome = false): string {
  if (withOutcome && v.kind === 'vote') {
    const o = voteOutcome(v);
    // khi đang mở & đã đủ ngưỡng: ghi rõ chờ đóng thay vì dán nhãn "Thông qua"
    const concl = o.status === 'open' && o.approved
      ? `${o.label} (đã đủ điều kiện, chờ đóng)`
      : o.label;
    return `- ${v.title}: Tán thành ${o.approve}/${o.totalEligible} (${o.approvePercentOfEligible}%), `
      + `Không tán thành ${o.against}, Ý kiến khác ${o.abstain}, Chưa biểu quyết ${o.notVoted}. `
      + `Kết luận: ${concl} (ngưỡng ${thresholdLabel(o.threshold)}, cần ≥ ${o.required}).`;
  }
  const rs = voteResults(v);
  const parts = rs.map((r) => `${r.label}: ${r.count}`).join('; ');
  return `- ${v.title}: ${parts} (tổng ${v.ballots.length}/${v.eligibleIds.length} phiếu)`;
}

// ============================================================
// THỐNG KÊ Ý KIẾN VĂN BẢN (E-HSMT mục 48/53, mobile 92/97) — hàm THUẦN.
// Tổng hợp theo TỪNG văn bản xin ý kiến (poll) trong khoảng thời gian, dùng
// cho trang Thống kê ý kiến văn bản (biểu đồ + xuất CSV).
// ============================================================

export interface PollStatRow {
  voteId: string;
  title: string;
  createdAt: string;
  deadline?: string;
  status: VoteStatus;
  totalEligible: number;
  responded: number;
  notResponded: number;
  responseRatePercent: number;
  /** phân bố theo phương án trả lời — dùng cho BarChart/Donut */
  optionBreakdown: { label: string; value: number }[];
}

/**
 * Lọc phiếu lấy ý kiến (kind='poll') theo khoảng thời gian tạo [from, to] (ISO, inclusive)
 * rồi dựng dòng thống kê cho từng phiếu. from/to bỏ trống = không giới hạn.
 */
export function pollStatsInRange(votes: Vote[], from?: string, to?: string): PollStatRow[] {
  const fromMs = from ? new Date(from).getTime() : -Infinity;
  // to là ngày (không giờ) -> lấy hết ngày đó
  const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : Infinity;
  return votes
    .filter((v) => v.kind === 'poll')
    .filter((v) => {
      const t = new Date(v.createdAt).getTime();
      return t >= fromMs && t <= toMs;
    })
    .map((v) => {
      const total = v.eligibleIds.length;
      const responded = v.ballots.length;
      return {
        voteId: v.id,
        title: v.title,
        createdAt: v.createdAt,
        deadline: v.deadline,
        status: v.status,
        totalEligible: total,
        responded,
        notResponded: Math.max(0, total - responded),
        responseRatePercent: total > 0 ? Math.round((responded / total) * 100) : 0,
        optionBreakdown: voteResults(v).map((r) => ({ label: r.label, value: r.count })),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Tổng hợp toàn cục (nhiều văn bản) theo tháng — dùng cho BarChart xu hướng theo thời gian. */
export function pollStatsByMonth(rows: PollStatRow[]): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => {
      const [, mm] = key.split('-');
      return { label: `T${Number(mm)}`, value };
    });
}
