// ============================================================
// BIỂU QUYẾT (trong họp) & PHIẾU LẤY Ý KIẾN (ngoài họp)
// ============================================================
import { db } from '../data/db';
import { uid, type PassThreshold, type User, type Vote, type VoteKind, type VoteStatus } from '../domain/types';
import { audit } from './adminService';
import { notify } from './notificationService';

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
}

export async function createVote(actor: User, draft: VoteDraft): Promise<Vote> {
  const options = draft.optionLabels.filter(Boolean).map((label, i) => ({ id: 'o' + (i + 1), label }));
  const approveIdx = draft.approveOptionIndex ?? 0;
  const vote: Vote = {
    id: uid(),
    kind: draft.kind,
    meetingId: draft.meetingId ?? null,
    agendaItemId: draft.agendaItemId ?? null,
    title: draft.title,
    description: draft.description,
    options,
    secret: draft.secret,
    status: draft.kind === 'poll' ? 'open' : 'pending',
    deadline: draft.deadline,
    documentIds: draft.documentIds,
    ballots: [],
    eligibleIds: draft.eligibleIds,
    createdBy: actor.id,
    createdAt: nowIso(),
    openedAt: draft.kind === 'poll' ? nowIso() : undefined,
    // ngưỡng thông qua + phương án tán thành/ý kiến khác
    passThreshold: draft.passThreshold ?? 'majority',
    approveOptionId: options[approveIdx]?.id ?? options[0]?.id,
    abstainOptionId: draft.abstainOptionIndex != null ? options[draft.abstainOptionIndex]?.id : undefined,
  };
  await db.votes.create(vote);
  if (vote.kind === 'poll') {
    await notify(vote.eligibleIds.filter((x) => x !== actor.id), 'Phiếu lấy ý kiến mới',
      `Đề nghị cho ý kiến: "${vote.title}"${vote.deadline ? ` — hạn ${new Date(vote.deadline).toLocaleString('vi-VN')}` : ''}.`,
      'poll', '#/polls');
  }
  await audit(actor, vote.kind === 'poll' ? 'Tạo phiếu lấy ý kiến' : 'Tạo biểu quyết', `"${vote.title}"`);
  return vote;
}

export async function openVote(actor: User, voteId: string) {
  // GĐ4 — chế độ máy chủ: endpoint nghiệp vụ kiểm tra sâu + tự thông báo/audit
  if (db.action) { await db.action(`/vote/${voteId}/open`); return; }
  const v = await db.votes.update(voteId, { status: 'open', openedAt: nowIso() });
  await notify(v.eligibleIds, 'Biểu quyết đang mở', `Biểu quyết "${v.title}" đang chờ ý kiến của bạn.`, 'vote',
    v.meetingId ? `#/meetings/${v.meetingId}/live` : '#/polls');
  await audit(actor, 'Mở biểu quyết', `Mở "${v.title}"`);
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
  if (v.status === 'pending') label = 'Chưa đủ điều kiện';
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
