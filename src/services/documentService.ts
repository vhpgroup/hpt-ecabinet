// ============================================================
// TÀI LIỆU — tài liệu họp / tham khảo / cá nhân, chia sẻ, ghi chú
// ============================================================
import { db } from '../data/db';
import { uid, type Annotation, type DocFile, type DocKind, type User } from '../domain/types';
import { audit } from './adminService';
import { notify } from './notificationService';

const nowIso = () => new Date().toISOString();
// Chế độ máy chủ (GĐ2): 15MB; demo trình duyệt: 1,5MB (hạn mức localStorage)
const MAX_UPLOAD = db.remote ? 15 * 1024 * 1024 : 1.5 * 1024 * 1024;
const MAX_UPLOAD_LABEL = db.remote ? '15MB' : '1,5MB (bản demo trình duyệt)';

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

export async function addTextDocument(
  actor: User, name: string, content: string, kind: DocKind,
  opts: { meetingId?: string | null; agendaItemId?: string | null; secret?: boolean } = {},
): Promise<DocFile> {
  const doc: DocFile = {
    id: uid(), name: name.endsWith('.pdf') || name.includes('.') ? name : name + '.pdf',
    kind, meetingId: opts.meetingId ?? null, agendaItemId: opts.agendaItemId ?? null,
    ownerId: actor.id, sharedWith: [], size: content.length * 2, mime: 'application/pdf',
    content, uploadedAt: nowIso(), secret: opts.secret ?? false, version: 1,
  };
  await db.documents.create(doc);
  await audit(actor, 'Thêm tài liệu', `Thêm "${doc.name}"`);
  await notifyNewMeetingDoc(actor, doc);
  return doc;
}

export async function addFileDocument(
  actor: User, file: File, kind: DocKind,
  opts: { meetingId?: string | null; agendaItemId?: string | null; secret?: boolean } = {},
): Promise<DocFile> {
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
  };
  await db.documents.create(doc);
  await audit(actor, 'Tải lên tài liệu', `Tải lên "${doc.name}" (${Math.round(file.size / 1024)} KB)`);
  await notifyNewMeetingDoc(actor, doc);
  return doc;
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

/** Tài liệu user được xem: tài liệu họp mình tham dự + của mình + được chia sẻ */
export function visibleDocs(docs: DocFile[], meetingIdsOfUser: Set<string>, userId: string): DocFile[] {
  return docs.filter((d) =>
    d.ownerId === userId ||
    d.sharedWith.includes(userId) ||
    (d.kind !== 'personal' && (!d.meetingId || meetingIdsOfUser.has(d.meetingId))),
  );
}
