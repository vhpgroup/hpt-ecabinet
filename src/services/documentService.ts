// ============================================================
// TÀI LIỆU — tài liệu họp / tham khảo / cá nhân, chia sẻ, ghi chú
// ============================================================
import { db } from '../data/db';
import { uid, type Annotation, type DocFile, type DocKind, type Meeting, type User } from '../domain/types';
import { can } from './authService';
import { audit } from './adminService';
import { notify } from './notificationService';
import { unitOfMeeting } from './meetingService';

const nowIso = () => new Date().toISOString();

/**
 * Khuyến nghị 1 (2026-07-18, chốt code chéo) — QUẢN TRỊ ĐƠN VỊ (unit_admin) THÊM TÀI LIỆU
 * VÀO PHIÊN HỌP: chỉ được thao tác cho phiên THUỘC ĐƠN VỊ MÌNH (không phải MỌI phiên nhìn
 * thấy — trước đây `canUpload` ở MeetingDetailPage.tsx cho MỌI unit_admin bất kể đơn vị).
 * Mirror `enforceDocumentWrite`/`EnforceDocumentWrite` phía server. Chỉ áp khi có meetingId
 * (tài liệu tham khảo/cá nhân KHÔNG gắn phiên không bị ràng buộc này); delegate/MANAGE
 * không bị ảnh hưởng (giữ hành vi cũ).
 */
async function enforceUnitAdminDocumentWrite(actor: User, meetingId: string | null | undefined) {
  if (actor.role !== 'unit_admin' || !meetingId) return;
  if (!actor.unitId) throw new Error('Không xác định được đơn vị của bạn');
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  const meetingUnit = await unitOfMeeting(m);
  if (meetingUnit !== actor.unitId) {
    throw new Error('Bạn chỉ được thêm tài liệu cho phiên họp thuộc đơn vị của mình');
  }
}

/**
 * Trạng thái duyệt mặc định khi TẠO tài liệu (E-HSMT mục 24):
 * - Người trình KHÔNG phải quản lý (đại biểu / quản trị đơn vị): mặc định 'draft'
 *   -> phải "Trình duyệt" rồi Thành viên dự họp/quản lý duyệt.
 * - Quản lý (chủ trì/thư ký/admin) tự tạo: 'approved' luôn (đỡ tự duyệt vòng vo).
 * - Tài liệu cá nhân: không áp dụng quy trình duyệt (giữ approved để hiển thị bình thường).
 */
function defaultReviewStatus(actor: User, kind: DocKind): DocFile['reviewStatus'] {
  if (kind === 'personal') return 'approved';
  return can.manageMeetings(actor) ? 'approved' : 'draft';
}
// Chế độ máy chủ (GĐ2): 15MB; chế độ cục bộ: 1,5MB (hạn mức lưu trữ tại trình duyệt)
const MAX_UPLOAD = db.remote ? 15 * 1024 * 1024 : 1.5 * 1024 * 1024;
const MAX_UPLOAD_LABEL = db.remote ? '15MB' : '1,5MB (chế độ cục bộ, chưa kết nối máy chủ)';

/** VNPT: "Thông báo khi có các tài liệu mới cần xử lý" */
async function notifyNewMeetingDoc(actor: User, doc: DocFile) {
  if (!doc.meetingId) return;
  const m = await db.meetings.get(doc.meetingId);
  if (!m) return;
  await notify(
    m.participants.map((p) => p.userId).filter((idX) => idX !== actor.id),
    'Tài liệu mới cần xử lý',
    `Tài liệu "${doc.name}" vừa được thêm vào phiên họp "${m.title}".`,
    'doc', `#/meetings/${m.id}`,
  );
}

export interface AddDocOpts {
  meetingId?: string | null;
  agendaItemId?: string | null;
  secret?: boolean;
  issuingBody?: string;
  folder?: string;
  /** Loại tài liệu chọn từ danh mục loại tài liệu (E-HSMT mục 8). OPTIONAL. */
  docTypeId?: string;
}

export async function addTextDocument(
  actor: User, name: string, content: string, kind: DocKind,
  opts: AddDocOpts = {},
): Promise<DocFile> {
  await enforceUnitAdminDocumentWrite(actor, opts.meetingId);
  const doc: DocFile = {
    id: uid(), name: name.endsWith('.pdf') || name.includes('.') ? name : name + '.pdf',
    kind, meetingId: opts.meetingId ?? null, agendaItemId: opts.agendaItemId ?? null,
    ownerId: actor.id, sharedWith: [], size: content.length * 2, mime: 'application/pdf',
    content, uploadedAt: nowIso(), secret: opts.secret ?? false, version: 1,
    reviewStatus: defaultReviewStatus(actor, kind),
    issuingBody: opts.issuingBody, folder: opts.folder, docTypeId: opts.docTypeId,
  };
  await db.documents.create(doc);
  await audit(actor, 'Thêm tài liệu', `Thêm "${doc.name}"`);
  // Chỉ báo "tài liệu mới cần xử lý" khi tài liệu đã được duyệt (đại biểu mới thấy)
  if (doc.reviewStatus === 'approved') await notifyNewMeetingDoc(actor, doc);
  return doc;
}

export async function addFileDocument(
  actor: User, file: File, kind: DocKind,
  opts: AddDocOpts = {},
): Promise<DocFile> {
  await enforceUnitAdminDocumentWrite(actor, opts.meetingId);
  if (file.size > MAX_UPLOAD) {
    throw new Error(`Tệp vượt giới hạn ${MAX_UPLOAD_LABEL}`);
  }
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được tệp'));
    reader.readAsDataURL(file);
  });
  const doc: DocFile = {
    id: uid(), name: file.name, kind,
    meetingId: opts.meetingId ?? null, agendaItemId: opts.agendaItemId ?? null,
    ownerId: actor.id, sharedWith: [], size: file.size, mime: file.type || 'application/octet-stream',
    dataUrl, uploadedAt: nowIso(), secret: opts.secret ?? false, version: 1,
    reviewStatus: defaultReviewStatus(actor, kind),
    issuingBody: opts.issuingBody, folder: opts.folder, docTypeId: opts.docTypeId,
  };
  await db.documents.create(doc);
  await audit(actor, 'Tải lên tài liệu', `Tải lên "${doc.name}" (${Math.round(file.size / 1024)} KB)`);
  if (doc.reviewStatus === 'approved') await notifyNewMeetingDoc(actor, doc);
  return doc;
}

/** Cập nhật loại tài liệu (E-HSMT mục 8) cho tài liệu đã tồn tại. */
export async function setDocType(actor: User, docId: string, docTypeId: string) {
  await db.documents.update(docId, { docTypeId: docTypeId || undefined });
  await audit(actor, 'Cập nhật loại tài liệu', `Cập nhật loại tài liệu #${docId}`);
}

/**
 * Đặt/đổi thư mục cho tài liệu cá nhân (E-HSMT mục 14). folder trống = bỏ khỏi thư mục.
 * Chỉ chủ sở hữu thao tác (ACL server: documents update 'ownerOrManage').
 */
export async function setDocFolder(actor: User, docId: string, folder: string) {
  await db.documents.update(docId, { folder: folder.trim() || undefined });
  await audit(actor, 'Cập nhật thư mục tài liệu', `Chuyển tài liệu vào thư mục "${folder.trim() || '(bỏ thư mục)'}"`);
}

export async function shareDocument(actor: User, docId: string, userIds: string[]) {
  const doc = await db.documents.get(docId);
  if (!doc) throw new Error('Không tìm thấy tài liệu');
  const sharedWith = Array.from(new Set([...doc.sharedWith, ...userIds]));
  await db.documents.update(docId, { sharedWith });
  await notify(userIds, 'Tài liệu được chia sẻ', `${actor.fullName} đã chia sẻ tài liệu "${doc.name}" với bạn.`, 'doc', '#/documents');
  await audit(actor, 'Chia sẻ tài liệu', `Chia sẻ "${doc.name}" cho ${userIds.length} người`);
}

export async function removeDocument(actor: User, docId: string) {
  const doc = await db.documents.get(docId);
  await db.documents.remove(docId);
  await audit(actor, 'Xóa tài liệu', `Xóa "${doc?.name ?? docId}"`);
}

export async function attachToAgenda(actor: User, docId: string, meetingId: string, agendaItemId: string) {
  await db.documents.update(docId, { meetingId, agendaItemId, kind: 'main' });
  const m = await db.meetings.get(meetingId);
  if (m) {
    const agenda = m.agenda.map((a) => a.id === agendaItemId && !a.documentIds.includes(docId)
      ? { ...a, documentIds: [...a.documentIds, docId] } : a);
    await db.meetings.update(meetingId, { agenda });
  }
}

// ----- Ghi chú cá nhân & góp ý công khai trên tài liệu -----
export async function addAnnotation(actor: User, docId: string, content: string, isPublic = false): Promise<Annotation> {
  const an: Annotation = { id: uid(), docId, userId: actor.id, content, isPublic, createdAt: nowIso() };
  await db.annotations.create(an);
  if (isPublic) {
    const doc = await db.documents.get(docId);
    await audit(actor, 'Góp ý tài liệu', `Góp ý công khai trên "${doc?.name ?? docId}"`);
    // báo cho người trình tài liệu
    if (doc && doc.ownerId !== actor.id) {
      await notify([doc.ownerId], 'Góp ý mới trên tài liệu',
        `${actor.fullName} góp ý trên "${doc.name}": ${content.slice(0, 120)}`, 'doc',
        doc.meetingId ? `#/meetings/${doc.meetingId}` : '#/documents');
    }
  }
  return an;
}

export async function removeAnnotation(id: string) {
  await db.annotations.remove(id);
}

/** undefined coi như 'approved' (tương thích ngược dữ liệu cũ). */
export const isApproved = (d: DocFile) => d.reviewStatus === undefined || d.reviewStatus === 'approved';

/**
 * Tài liệu user được xem (E-HSMT mục 24 — lọc theo trạng thái duyệt):
 * - của mình (owner) hoặc được chia sẻ: xem MỌI trạng thái;
 * - quản lý (chủ trì/thư ký/admin): xem tất cả (phục vụ duyệt);
 * - đại biểu thường: CHỈ tài liệu đã duyệt (hoặc undefined) của phiên mình tham dự.
 */
export function visibleDocs(
  docs: DocFile[], meetingIdsOfUser: Set<string>, userId: string, manage = false,
): DocFile[] {
  return docs.filter((d) => {
    if (d.ownerId === userId || d.sharedWith.includes(userId)) return true;
    if (manage) return true;
    return d.kind !== 'personal' && (!d.meetingId || meetingIdsOfUser.has(d.meetingId)) && isApproved(d);
  });
}

// ----- Quy trình trình–duyệt tài liệu (E-HSMT mục 24) -----

/** Người trình gửi tài liệu đi duyệt (draft/rejected -> pending). */
export async function submitForReview(actor: User, doc: DocFile) {
  if (doc.ownerId !== actor.id) throw new Error('Chỉ người trình tài liệu được gửi duyệt');
  if (!(doc.reviewStatus === 'draft' || doc.reviewStatus === 'rejected')) {
    throw new Error('Chỉ trình duyệt được tài liệu ở trạng thái nháp hoặc bị từ chối');
  }
  await db.documents.update(doc.id, { reviewStatus: 'pending', reviewNote: undefined });
  await audit(actor, 'Trình duyệt tài liệu', `Trình duyệt "${doc.name}"`);
  // báo quản lý phiên họp có tài liệu chờ duyệt
  if (doc.meetingId) {
    const m = await db.meetings.get(doc.meetingId);
    if (m) {
      await notify(
        [m.chairId, m.secretaryId].filter((idX) => idX && idX !== actor.id) as string[],
        'Tài liệu chờ duyệt',
        `Tài liệu "${doc.name}" vừa được trình lên chờ duyệt trong phiên họp "${m.title}".`,
        'doc', `#/meetings/${m.id}`,
      );
    }
  }
}

/**
 * V2 (P1-1 dungthu-tester.md + BA mục 1(d), HSMT dòng 356-358 "Thành viên dự họp thực hiện
 * duyệt"): quản lý toàn cục (chủ trì/thư ký/admin) HOẶC bất kỳ ai là THÀNH PHẦN của CHÍNH
 * phiên chứa tài liệu (`meeting` — chairId/secretaryId/participant, phải khớp
 * `meeting.id === doc.meetingId`) được duyệt. Người trình (owner) KHÔNG được tự duyệt dù
 * họ CÓ là thành phần phiên đó — mirror `guardDocuments`/`canReviewDocumentAsMeetingMember`
 * phía backend (guard.js). `meeting` OPTIONAL: bỏ trống -> chỉ quản lý toàn cục (hành vi cũ,
 * dùng khi tài liệu không gắn phiên hoặc nơi gọi không có sẵn bản ghi meeting).
 */
function canReviewDocument(reviewer: User, doc: DocFile, meeting?: Meeting): boolean {
  if (doc.ownerId === reviewer.id) return false; // không tự duyệt tài liệu của chính mình
  if (can.manageMeetings(reviewer)) return true;
  if (!meeting || meeting.id !== doc.meetingId) return false;
  return reviewer.id === meeting.chairId || reviewer.id === meeting.secretaryId
    || meeting.participants.some((p) => p.userId === reviewer.id);
}

/** Quản lý HOẶC thành phần phiên duyệt tài liệu (pending -> approved). */
export async function approveDocument(reviewer: User, doc: DocFile, meeting?: Meeting) {
  if (!canReviewDocument(reviewer, doc, meeting)) throw new Error('Bạn không có quyền duyệt tài liệu này');
  if (doc.reviewStatus !== 'pending') throw new Error('Chỉ duyệt được tài liệu đang chờ duyệt');
  await db.documents.update(doc.id, {
    reviewStatus: 'approved', reviewedById: reviewer.id, reviewedAt: nowIso(), reviewNote: undefined,
  });
  await audit(reviewer, 'Duyệt tài liệu', `Duyệt "${doc.name}"`);
  // tài liệu đã duyệt: báo thành phần phiên họp có tài liệu mới cần xử lý + báo người trình
  await notifyNewMeetingDoc(reviewer, doc);
  if (doc.ownerId !== reviewer.id) {
    await notify([doc.ownerId], 'Tài liệu đã được duyệt', `Tài liệu "${doc.name}" của bạn đã được duyệt.`,
      'doc', doc.meetingId ? `#/meetings/${doc.meetingId}` : '#/documents');
  }
}

/** Quản lý HOẶC thành phần phiên từ chối tài liệu (pending -> rejected + lý do bắt buộc). */
export async function rejectDocument(reviewer: User, doc: DocFile, note: string, meeting?: Meeting) {
  if (!canReviewDocument(reviewer, doc, meeting)) throw new Error('Bạn không có quyền duyệt tài liệu này');
  if (doc.reviewStatus !== 'pending') throw new Error('Chỉ từ chối được tài liệu đang chờ duyệt');
  if (!note.trim()) throw new Error('Vui lòng nhập lý do từ chối để đơn vị làm lại');
  await db.documents.update(doc.id, {
    reviewStatus: 'rejected', reviewNote: note.trim(), reviewedById: reviewer.id, reviewedAt: nowIso(),
  });
  await audit(reviewer, 'Từ chối tài liệu', `Từ chối "${doc.name}": ${note.trim().slice(0, 120)}`);
  if (doc.ownerId !== reviewer.id) {
    await notify([doc.ownerId], 'Tài liệu bị từ chối — yêu cầu làm lại',
      `Tài liệu "${doc.name}" chưa được duyệt. Lý do: ${note.trim().slice(0, 160)}`,
      'doc', doc.meetingId ? `#/meetings/${doc.meetingId}` : '#/documents');
  }
}
