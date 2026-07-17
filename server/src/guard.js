// ============================================================
// GUARD — khóa cứng đường CRUD chung (GĐ4).
// Các trường nhạy cảm CHỈ thay đổi được qua /api/actions:
//   votes    : ballots, status, openedAt, closedAt
//   meetings : status, participants[].checkedInAt, minutes.signatures/locked
// Đại biểu (không phải admin/thư ký/chủ trì) qua PATCH meetings chỉ được:
//   - sửa dòng tham dự CỦA MÌNH (xác nhận / báo vắng / ủy quyền)
//   - thêm đúng dòng khách mời mà mình ủy quyền
// ============================================================

const MANAGE = ['admin', 'secretary', 'chairman'];

const httpError = (status, message) => Object.assign(new Error(message), { status });

// ============================================================
// VALIDATE (GĐ6, vá P0-2) — kiểm KIỂU dữ liệu trước khi ghi.
// Nếu không kiểm, một PATCH sai kiểu (vd participants = số/null/chuỗi)
// sẽ lọt qua guard, được lưu vào JSONB, làm hỏng vĩnh viễn bản ghi
// và gây lỗi 500 dây chuyền ở mọi request sau (khi .map/.some trên
// giá trị không phải mảng). Sai kiểu -> 400, KHÔNG lưu.
// ============================================================
const SCHEMA = {
  // + meetingType (mục 7), currentItemStartedAt (mục 27) — đều string, OPTIONAL
  meetings: { code: 'string', title: 'string', description: 'string', startTime: 'string', endTime: 'string', roomId: 'string', isOnline: 'boolean', status: 'string', chairId: 'string', secretaryId: 'string', participants: 'array', agenda: 'array', currentAgendaItemId: 'string|null', conclusions: 'array', minutes: 'object|null', invitedAt: 'string', questionSession: 'string', seatAssignments: 'object', meetingType: 'string', currentItemStartedAt: 'string' },
  // + trackerUserId (P1-5, HSMT dòng 372 "Cán bộ theo dõi") — string, OPTIONAL
  votes: { kind: 'string', meetingId: 'string|null', agendaItemId: 'string|null', title: 'string', description: 'string', options: 'array', ballots: 'array', eligibleIds: 'array', documentIds: 'array', secret: 'boolean', status: 'string', deadline: 'string|null', trackerUserId: 'string' },
  // + issuingBody (mục 10), folder (mục 14) — đều string, OPTIONAL
  documents: { name: 'string', kind: 'string', meetingId: 'string|null', agendaItemId: 'string|null', sharedWith: 'array', secret: 'boolean', content: 'string', dataUrl: 'string', version: 'number', mime: 'string', reviewStatus: 'string', reviewNote: 'string', reviewedById: 'string', reviewedAt: 'string', issuingBody: 'string', folder: 'string' },
  annotations: { docId: 'string', content: 'string', isPublic: 'boolean' },
  tasks: { title: 'string', description: 'string', assigneeId: 'string', deadline: 'string', status: 'string', progress: 'number', meetingId: 'string|null' },
  notifications: { read: 'boolean', title: 'string', body: 'string', type: 'string' },
  // + position (mục 6) — string, OPTIONAL
  users: { fullName: 'string', title: 'string', unitId: 'string', role: 'string', email: 'string', phone: 'string', status: 'string', avatarColor: 'string', username: 'string', position: 'string' },
  units: { name: 'string', short: 'string', order: 'number' },
  rooms: { name: 'string', location: 'string', capacity: 'number', equipment: 'array', supportsOnline: 'boolean', status: 'string', layout: 'object|null' },
  speakRequests: { meetingId: 'string', topic: 'string', status: 'string' },
  questions: { meetingId: 'string', userId: 'string', targetName: 'string', topic: 'string', content: 'string', status: 'string', order: 'number', calledAt: 'string', endedAt: 'string' },
  messages: { meetingId: 'string', content: 'string', toId: 'string|null' },
  // ĐỢT 3 — Danh mục chung (E-HSMT mục 6, 7, 10)
  catalogs: { type: 'string', name: 'string', description: 'string', order: 'number', active: 'boolean' },
  // ĐỢT 3 — Tài liệu HDSD (E-HSMT mục 4)
  guides: { title: 'string', content: 'string', fileName: 'string', fileData: 'string', roleScope: 'array', updatedAt: 'string' },
  // RỔ B — Khóa API bên thứ 3 (E-HSMT mục 54–59). keyHash/prefix bất biến (guard chặn sửa).
  apiKeys: { name: 'string', prefix: 'string', keyHash: 'string', scopes: 'array', active: 'boolean', createdAt: 'string', createdById: 'string', lastUsedAt: 'string', callCount: 'number', note: 'string' },
  // P1-6 — Phản hồi/góp ý người dùng (E-HSMT mục 5.1–5.4). userId/unitId do SERVER ép lúc
  // tạo (index.js) — vẫn kiểm kiểu ở đây để chặn giá trị rác nếu có nơi khác vô tình ghi.
  feedbacks: { userId: 'string', unitId: 'string|null', category: 'string', content: 'string', status: 'string', response: 'string', handledBy: 'string|null', createdAt: 'string', updatedAt: 'string' },
};

// Vai trò hợp lệ + trạng thái duyệt tài liệu hợp lệ (chống ghi giá trị rác vào enum)
const VALID_ROLES = ['admin', 'chairman', 'secretary', 'delegate', 'unit_admin'];
const VALID_REVIEW = ['draft', 'pending', 'approved', 'rejected'];
// P1-5 — trạng thái phiếu lấy ý kiến/biểu quyết hợp lệ. 'draft' MỚI (chưa mở, cấm bỏ phiếu).
const VALID_VOTE_STATUS = ['draft', 'pending', 'open', 'closed'];
// ĐỢT 3 — loại danh mục hợp lệ (E-HSMT mục 6, 7, 10) + 'docType' (mục 8 — vá QA 18/07)
const VALID_CATALOG_TYPES = ['position', 'meetingType', 'issuingBody', 'docType'];
// P1-6 — loại/trạng thái phản hồi người dùng hợp lệ
const VALID_FEEDBACK_CATEGORY = ['bug', 'feature', 'question', 'other'];
const VALID_FEEDBACK_STATUS = ['new', 'processing', 'resolved'];
/** Khóa ghế hợp lệ: chuỗi "số-số" (vd "10-3"). */
const isSeatKey = (v) => typeof v === 'string' && /^\d+-\d+$/.test(v);

// P1-7 — Whitelist định dạng tệp đính kèm tài liệu theo Phụ lục TT 39/2017/TT-BTTTT
// (văn bản/bảng tính/trình chiếu văn phòng phổ biến + ảnh + nén — KHÔNG gồm thực thi/script).
const ALLOWED_FILE_EXT = [
  'pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp',
  'txt', 'rtf', 'jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp', 'zip', 'rar',
];
/** Phần mở rộng chữ thường của tên tệp; null nếu không có/không phải chuỗi. */
function extOf(name) {
  if (typeof name !== 'string') return null;
  const m = /\.([a-zA-Z0-9]+)$/.exec(name.trim());
  return m ? m[1].toLowerCase() : null;
}

function typeOk(val, spec) {
  for (const t of spec.split('|')) {
    if (t === 'null' && val === null) return true;
    if (t === 'array' && Array.isArray(val)) return true;
    if (t === 'object' && val !== null && typeof val === 'object' && !Array.isArray(val)) return true;
    if (t === 'string' && typeof val === 'string') return true;
    if (t === 'number' && typeof val === 'number' && Number.isFinite(val)) return true;
    if (t === 'boolean' && typeof val === 'boolean') return true;
  }
  return false;
}

/**
 * Kiểm kiểu cho PATCH/POST. Ném 400 khi sai. Áp cho mọi collection.
 * `existing` (P1-7, OPTIONAL): bản ghi HIỆN CÓ khi đây là PATCH (undefined khi POST/tạo
 * mới) — dùng để suy ra trạng thái HIỆU LỰC (existing + patch) của các trường liên quan
 * nhau trong 2 field khác nhau (vd documents.name/documents.dataUrl: một PATCH chỉ đổi
 * `name` — không kèm `dataUrl` — vẫn phải kiểm lại định dạng tệp nếu bản ghi ĐANG CÓ file).
 */
export function validatePatch(col, body, existing) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Dữ liệu gửi lên không hợp lệ (phải là đối tượng JSON)');
  }
  const schema = SCHEMA[col];
  if (schema) {
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      const spec = schema[k];
      if (!spec) continue; // trường không quản trong schema: bỏ qua kiểm kiểu
      if (!typeOk(v, spec)) throw httpError(400, `Trường "${k}" sai kiểu dữ liệu (cần ${spec})`);
    }
  }
  // Kiểm sâu phần tử mảng cấu trúc — chống làm hỏng bản ghi
  if (col === 'meetings' && Array.isArray(body.participants)) {
    for (const p of body.participants) {
      if (p === null || typeof p !== 'object' || Array.isArray(p) || typeof p.userId !== 'string') {
        throw httpError(400, 'Danh sách tham dự không hợp lệ (mỗi phần tử phải có userId)');
      }
    }
  }
  if (col === 'meetings' && Array.isArray(body.agenda)) {
    for (const a of body.agenda) {
      if (a === null || typeof a !== 'object' || Array.isArray(a) || typeof a.id !== 'string') {
        throw httpError(400, 'Chương trình họp không hợp lệ');
      }
    }
  }
  if (col === 'votes' && Array.isArray(body.ballots)) {
    for (const b of body.ballots) {
      if (b === null || typeof b !== 'object' || Array.isArray(b) || typeof b.userId !== 'string' || typeof b.optionId !== 'string') {
        throw httpError(400, 'Danh sách phiếu không hợp lệ');
      }
    }
  }
  if (col === 'tasks' && typeof body.progress === 'number' && (body.progress < 0 || body.progress > 100)) {
    throw httpError(400, 'Tiến độ phải trong khoảng 0–100');
  }
  // Chất vấn: trạng thái phải nằm trong tập hợp lệ (chống ghi giá trị rác)
  if (col === 'questions' && body.status !== undefined
      && !['pending', 'called', 'done', 'rejected'].includes(body.status)) {
    throw httpError(400, 'Trạng thái chất vấn không hợp lệ');
  }
  // Phiên chất vấn của phiên họp: chỉ nhận 3 giá trị hợp lệ
  if (col === 'meetings' && body.questionSession !== undefined
      && !['closed', 'open', 'paused'].includes(body.questionSession)) {
    throw httpError(400, 'Trạng thái phiên chất vấn không hợp lệ');
  }
  // Sơ đồ chỗ ngồi (E-HSMT mục 38): phải là object map userId(string) -> "hàng-cột".
  // Chặn mảng / kiểu sai / giá trị rác để không làm hỏng bản ghi.
  if (col === 'meetings' && body.seatAssignments !== undefined) {
    const sa = body.seatAssignments;
    if (sa === null || typeof sa !== 'object' || Array.isArray(sa)) {
      throw httpError(400, 'Sơ đồ chỗ ngồi không hợp lệ (phải là đối tượng ánh xạ)');
    }
    for (const [k, v] of Object.entries(sa)) {
      if (typeof k !== 'string' || !isSeatKey(v)) {
        throw httpError(400, 'Vị trí chỗ ngồi không hợp lệ (mỗi giá trị phải là "hàng-cột")');
      }
    }
  }
  // Sơ đồ phòng họp (E-HSMT mục 9): rows/cols trong khoảng 1..12, disabled là mảng khóa "hàng-cột".
  if (col === 'rooms' && body.layout !== undefined && body.layout !== null) {
    const lo = body.layout;
    if (typeof lo !== 'object' || Array.isArray(lo)
      || !Number.isInteger(lo.rows) || !Number.isInteger(lo.cols)
      || lo.rows < 1 || lo.rows > 12 || lo.cols < 1 || lo.cols > 12) {
      throw httpError(400, 'Sơ đồ phòng họp không hợp lệ (số hàng/cột phải trong khoảng 1–12)');
    }
    if (lo.disabled !== undefined && (!Array.isArray(lo.disabled) || lo.disabled.some((x) => !isSeatKey(x)))) {
      throw httpError(400, 'Danh sách ô lối đi không hợp lệ');
    }
  }
  // Trạng thái duyệt tài liệu (E-HSMT mục 24): chỉ nhận enum hợp lệ
  if (col === 'documents' && body.reviewStatus !== undefined && !VALID_REVIEW.includes(body.reviewStatus)) {
    throw httpError(400, 'Trạng thái duyệt tài liệu không hợp lệ');
  }
  // P1-5 — trạng thái phiếu lấy ý kiến/biểu quyết: chỉ nhận enum hợp lệ (gồm 'draft' mới)
  if (col === 'votes' && body.status !== undefined && !VALID_VOTE_STATUS.includes(body.status)) {
    throw httpError(400, 'Trạng thái phiếu lấy ý kiến/biểu quyết không hợp lệ');
  }
  // P1-7 — TT 39/2017/TT-BTTTT: whitelist định dạng tệp đính kèm tài liệu. Chỉ kiểm khi
  // BẢN GHI HIỆU LỰC (existing hợp nhất với patch) có file thật (dataUrl là chuỗi khác rỗng)
  // — tài liệu chỉ có `content` (soạn trực tiếp, không upload) KHÔNG bị áp whitelist này.
  if (col === 'documents') {
    const effectiveDataUrl = body.dataUrl !== undefined ? body.dataUrl : existing?.dataUrl;
    if (typeof effectiveDataUrl === 'string' && effectiveDataUrl) {
      const effectiveName = body.name !== undefined ? body.name : existing?.name;
      const ext = extOf(effectiveName);
      if (!ext || !ALLOWED_FILE_EXT.includes(ext)) {
        throw httpError(400, `Định dạng tệp không hợp lệ. Định dạng cho phép: ${ALLOWED_FILE_EXT.join(', ')}`);
      }
    }
  }
  // Vai trò người dùng: chỉ nhận 5 vai trò hợp lệ
  if (col === 'users' && body.role !== undefined && !VALID_ROLES.includes(body.role)) {
    throw httpError(400, 'Vai trò người dùng không hợp lệ');
  }
  // Chương trình họp (E-HSMT mục 27): thời lượng mỗi mục phải là số ≥ 0 (chống giá trị rác/âm)
  if (col === 'meetings' && Array.isArray(body.agenda)) {
    for (const a of body.agenda) {
      if (a && a.durationMinutes !== undefined
          && (typeof a.durationMinutes !== 'number' || !Number.isFinite(a.durationMinutes) || a.durationMinutes < 0)) {
        throw httpError(400, 'Thời lượng mục chương trình phải là số phút không âm');
      }
    }
  }
  // ĐỢT 3 — Danh mục chung (E-HSMT mục 6, 7, 10)
  if (col === 'catalogs') {
    if (body.type !== undefined && !VALID_CATALOG_TYPES.includes(body.type)) {
      throw httpError(400, 'Loại danh mục không hợp lệ (chỉ chức vụ / loại phiên họp / cơ quan ban hành / loại tài liệu)');
    }
    // tên danh mục: khi có mặt PHẢI là chuỗi không rỗng
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      throw httpError(400, 'Tên danh mục không được để trống');
    }
  }
  // ĐỢT 3 — Tài liệu HDSD (E-HSMT mục 4)
  if (col === 'guides') {
    // tiêu đề: khi có mặt PHẢI là chuỗi không rỗng
    if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
      throw httpError(400, 'Tiêu đề tài liệu hướng dẫn không được để trống');
    }
    // roleScope (nếu có): mảng vai trò hợp lệ
    if (Array.isArray(body.roleScope) && body.roleScope.some((r) => !VALID_ROLES.includes(r))) {
      throw httpError(400, 'Phạm vi vai trò của tài liệu hướng dẫn không hợp lệ');
    }
  }
  // RỔ B — Khóa API: scopes chỉ nhận 'meetings' | 'documents'
  if (col === 'apiKeys' && body.scopes !== undefined) {
    if (!Array.isArray(body.scopes) || body.scopes.some((s) => s !== 'meetings' && s !== 'documents')) {
      throw httpError(400, 'Phạm vi (scope) của khóa API không hợp lệ (chỉ meetings / documents)');
    }
  }
  // P1-6 — Phản hồi/góp ý người dùng: category/status theo enum; nội dung không rỗng
  if (col === 'feedbacks') {
    if (body.category !== undefined && !VALID_FEEDBACK_CATEGORY.includes(body.category)) {
      throw httpError(400, 'Loại phản hồi không hợp lệ (chỉ: lỗi / đề xuất tính năng / câu hỏi / khác)');
    }
    if (body.status !== undefined && !VALID_FEEDBACK_STATUS.includes(body.status)) {
      throw httpError(400, 'Trạng thái phản hồi không hợp lệ');
    }
    if (body.content !== undefined && (typeof body.content !== 'string' || !body.content.trim())) {
      throw httpError(400, 'Nội dung phản hồi không được để trống');
    }
  }
}

/**
 * Trả về patch đã làm sạch cho collection; ném lỗi 403 khi bị cấm hoàn toàn.
 * `extra` (OPTIONAL): ngữ cảnh bổ sung KHÔNG lấy được chỉ từ existing/patch — hiện chỉ
 * dùng cho documents: `{ meeting }` — bản ghi phiên họp chứa tài liệu (nạp trước ở
 * index.js từ `existing.meetingId`) để guardDocuments biết ai là "thành phần phiên"
 * (P0-3, HSMT dòng 356-358 "Thành viên dự họp thực hiện duyệt").
 */
export function guardPatch(col, existing, patch, user, extra) {
  if (col === 'votes') return guardVotes(patch, user);
  if (col === 'meetings') return guardMeetings(existing, patch, user);
  if (col === 'questions') return guardQuestions(existing, patch, user);
  if (col === 'documents') return guardDocuments(existing, patch, user, extra?.meeting);
  if (col === 'apiKeys') return guardApiKeys(patch);
  if (col === 'feedbacks') return guardFeedbacks(existing, patch, user, extra?.actorUnitId);
  return patch;
}

/**
 * KHÓA API — danh tính khóa BẤT BIẾN: không cho sửa keyHash/prefix qua PATCH.
 * (Key thô sinh server-side lúc tạo; đổi hash/prefix sẽ làm sai lệch xác thực.)
 * Cũng chặn tự đặt lastUsedAt/callCount (server ghi nhận, không tin client).
 * Cho phép: name, scopes, active, note.
 */
function guardApiKeys(patch) {
  const p = { ...patch };
  delete p.keyHash;
  delete p.prefix;
  delete p.createdAt;
  delete p.createdById;
  delete p.lastUsedAt;
  delete p.callCount;
  return p;
}

/**
 * P0-3 — BYPASS HẸP cho ACL thô `documents.update = 'ownerOrManage'`.
 * ACL cấp độ collection (acl.js) chạy TRƯỚC guardPatch/guardDocuments; nếu giữ nguyên
 * 'ownerOrManage', một "Thành viên dự họp" (không phải owner, không phải MANAGE toàn cục)
 * sẽ bị chặn 403 ngay tại ACL, guardDocuments không bao giờ được gọi tới — vô hiệu hóa
 * hoàn toàn tính năng P0-3. Thay vì MỞ RỘNG ACL chung (rủi ro: mọi field khác của mọi
 * tài liệu sẽ bị bất kỳ ai PATCH được, vì guardDocuments hiện KHÔNG hạn chế field ngoài
 * reviewStatus), ta thêm 1 lối đi HẸP: cho qua ACL CHỈ KHI đúng là 1 yêu cầu DUYỆT hợp lệ
 * (patch CHỈ chứa reviewStatus/reviewNote — không kèm field khác — chuyển pending ->
 * approved|rejected, người gọi là thành phần phiên chứa tài liệu, KHÔNG phải owner).
 * guardDocuments vẫn ĐỘC LẬP kiểm tra lại toàn bộ điều kiện này (defense-in-depth) —
 * hàm này chỉ quyết định có cho "đi qua cổng ACL" hay không.
 */
export function canReviewDocumentAsMeetingMember(doc, patch, user, meeting) {
  if (!meeting) return false;
  if (doc.ownerId === user.sub) return false; // owner không được lách qua đường này
  const isMember = user.sub === meeting.chairId
    || user.sub === meeting.secretaryId
    || (meeting.participants ?? []).some((p) => p.userId === user.sub);
  if (!isMember) return false;
  const allowedKeys = new Set(['reviewStatus', 'reviewNote']);
  if (!Object.keys(patch).every((k) => allowedKeys.has(k))) return false; // không cho lách sửa field khác kèm theo
  const cur = doc.reviewStatus ?? 'approved';
  return cur === 'pending' && (patch.reviewStatus === 'approved' || patch.reviewStatus === 'rejected');
}

/**
 * TÀI LIỆU — siết quy trình trình–duyệt (E-HSMT mục 24; P0-3 HSMT dòng 356-358):
 * - Người trình (owner) KHÔNG được tự approve. Chỉ chuyển draft/rejected -> pending.
 * - Duyệt pending -> approved|rejected: quản lý (chủ trì/thư ký/admin) TOÀN HỆ THỐNG,
 *   HOẶC bất kỳ ai là THÀNH PHẦN của CHÍNH phiên họp chứa tài liệu này (chủ trì/thư ký/
 *   participant của `meeting` — tra theo `existing.meetingId`, KHÔNG mở cho "delegate"
 *   toàn hệ thống một cách chung — đúng nghĩa "Thành viên dự họp thực hiện duyệt").
 *   Tài liệu KHÔNG gắn phiên họp (meetingId null, vd tài liệu tham khảo/cá nhân) chỉ
 *   quản lý mới duyệt được (không có "phiên" để làm thành phần).
 * - reviewedById/reviewedAt do SERVER quyết định, không tin client.
 * Vi phạm chuyển trạng thái -> 403 (phản hồi rõ ràng, không âm thầm bỏ qua).
 */
function guardDocuments(existing, patch, user, meeting) {
  const isManage = MANAGE.includes(user.role);
  const isMeetingMember = !!meeting && (
    user.sub === meeting.chairId
    || user.sub === meeting.secretaryId
    || (meeting.participants ?? []).some((p) => p.userId === user.sub)
  );
  const p = { ...patch };
  // các trường vết duyệt do server ghi (qua service) — chặn client tự đặt tùy tiện
  // (service phía máy chủ không có; client REST gửi trọn gói nên ta chuẩn hóa tại đây)
  const cur = existing.reviewStatus ?? 'approved';

  if (p.reviewStatus !== undefined && p.reviewStatus !== cur) {
    const isOwner = existing.ownerId === user.sub;
    const allowedOwner = isOwner && (cur === 'draft' || cur === 'rejected') && p.reviewStatus === 'pending';
    // QUAN TRỌNG: !isOwner — người trình KHÔNG được tự duyệt tài liệu CỦA CHÍNH MÌNH dù
    // họ CÓ là thành phần phiên họp đó (vd owner vừa là participant vừa là người trình) —
    // nếu không chặn riêng, "cùng phiên" sẽ vô tình mở lại đúng lỗ hổng "tự duyệt" mà
    // allowedOwner phía trên đang ngăn.
    const allowedApprover = (isManage || isMeetingMember) && !isOwner && cur === 'pending'
      && (p.reviewStatus === 'approved' || p.reviewStatus === 'rejected');
    if (!allowedOwner && !allowedApprover) {
      throw httpError(403, 'Không được chuyển trạng thái duyệt tài liệu như vậy');
    }
    if (p.reviewStatus === 'rejected') {
      const note = typeof p.reviewNote === 'string' ? p.reviewNote.trim() : '';
      if (!note) throw httpError(400, 'Phải nhập lý do khi từ chối tài liệu');
      p.reviewNote = note.slice(0, 2000);
    }
    // ghi vết duyệt phía server khi là hành động duyệt/từ chối (quản lý HOẶC thành phần phiên)
    if (allowedApprover) {
      p.reviewedById = user.sub;
      p.reviewedAt = new Date().toISOString();
      if (p.reviewStatus === 'approved') p.reviewNote = undefined;
    } else {
      // owner trình duyệt lại: xóa vết/nhận xét cũ
      p.reviewNote = undefined;
    }
  } else if (p.reviewStatus === undefined) {
    // không đổi trạng thái duyệt -> không cho lén ghi vết duyệt
    delete p.reviewedById;
    delete p.reviewedAt;
  }
  return p;
}

/**
 * CHẤT VẤN — siết cập nhật (E-HSMT mục 34/45/46):
 * - Quản lý (chủ trì/thư ký/admin): điều hành lượt chất vấn (đổi status
 *   pending/called/done/rejected + calledAt/endedAt). Không cho đổi người
 *   đăng ký (userId) hay phiên (meetingId).
 * - Đại biểu thường: KHÔNG được tự đổi status/order/mốc thời gian; chỉ được
 *   sửa nội dung (topic/content/targetName) của CHÍNH MÌNH khi đang chờ
 *   (pending). Hủy đăng ký thực hiện bằng DELETE (ACL: chính chủ khi pending).
 */
function guardQuestions(existing, patch, user) {
  const isManage = MANAGE.includes(user.role);
  const p = { ...patch };
  // không ai được đổi khóa liên kết qua PATCH
  delete p.meetingId;
  delete p.userId;

  if (isManage) return p; // quản lý điều hành đầy đủ (server logic đã kiểm tra chuyển trạng thái hợp lệ)

  // đại biểu thường: chỉ thao tác trên lượt của CHÍNH MÌNH
  if (existing.userId !== user.sub) {
    throw httpError(403, 'Bạn chỉ được sửa lượt chất vấn của chính mình');
  }
  // KHÔNG được tự chuyển trạng thái / thứ tự / mốc thời gian (chỉ chủ tọa gọi/kết thúc)
  // -> chặn thẳng để phản hồi rõ ràng, không âm thầm bỏ qua.
  if (p.status !== undefined || p.order !== undefined || p.calledAt !== undefined || p.endedAt !== undefined) {
    throw httpError(403, 'Đại biểu không được tự đổi trạng thái lượt chất vấn — việc gọi/kết thúc do chủ tọa điều hành');
  }
  // chỉ được sửa nội dung khi đang chờ gọi
  if (existing.status !== 'pending' && (p.topic !== undefined || p.content !== undefined || p.targetName !== undefined)) {
    throw httpError(403, 'Chỉ sửa được nội dung chất vấn khi đang chờ gọi');
  }
  return p;
}

/**
 * P1-6 — PHẢN HỒI/GÓP Ý NGƯỜI DÙNG (E-HSMT mục 5.1–5.4), vá QA 18/07:
 * - status/response/handledBy: admin (toàn hệ thống) HOẶC unit_admin với phản hồi
 *   TRONG ĐƠN VỊ MÌNH (actorUnitId đọc từ DB tại index.js — JWT không mang unitId;
 *   đúng vai trò HSMT "Quản trị đơn vị: nhận & phân phối yêu cầu"). KHÔNG áp dụng
 *   cho secretary/chairman dù họ thuộc nhóm MANAGE ở các collection khác.
 * - Người KHÔNG phải người xử lý: chỉ sửa được phản hồi CỦA CHÍNH MÌNH (userId === sub),
 *   và KHÔNG được đụng userId/unitId (danh tính/phạm vi do server ép lúc tạo, bất biến).
 * - Người xử lý: khi đặt handledBy, SERVER ép = chính người đang xử lý (không tin client
 *   khai người xử lý là ai khác); cũng không cho đổi userId (danh tính người gửi gốc).
 */
function guardFeedbacks(existing, patch, user, actorUnitId) {
  const p = { ...patch };
  const isHandler = user.role === 'admin'
    || (user.role === 'unit_admin' && existing.unitId != null && existing.unitId === actorUnitId);
  if (!isHandler) {
    if (p.status !== undefined || p.response !== undefined || p.handledBy !== undefined) {
      throw httpError(403, 'Chỉ Quản trị hệ thống hoặc Quản trị đơn vị (trong đơn vị mình) được cập nhật trạng thái/phản hồi góp ý');
    }
    if (existing.userId !== user.sub) {
      throw httpError(403, 'Bạn không được sửa phản hồi của người khác');
    }
  }
  delete p.userId; // danh tính người gửi: bất biến, không cho đổi qua PATCH (admin hay không)
  delete p.unitId; // phạm vi đơn vị: server ép lúc tạo, bất biến
  if (p.handledBy !== undefined) p.handledBy = user.sub; // server ép người xử lý = chính người đang PATCH
  return p;
}

function guardVotes(patch, user) {
  if (!MANAGE.includes(user.role)) {
    throw httpError(403, 'Biểu quyết/lấy ý kiến thực hiện qua /api/actions/vote/… — không sửa trực tiếp');
  }
  // quản lý: được sửa nội dung phiếu, nhưng KHÔNG đụng kết quả/trạng thái
  const p = { ...patch };
  delete p.ballots;
  delete p.status;
  delete p.openedAt;
  delete p.closedAt;
  return p;
}

function guardMeetings(existing, patch, user) {
  const isManage = MANAGE.includes(user.role);
  const p = { ...patch };

  // trạng thái phiên họp: chỉ qua /actions (start / invite / end)
  delete p.status;
  delete p.invitedAt;

  // Phiên chất vấn (E-HSMT mục 45/89): CHỈ chủ trì/thư ký/admin điều hành.
  // Đại biểu thường gửi lên -> chặn thẳng (không âm thầm bỏ qua).
  if (p.questionSession !== undefined && !isManage) {
    throw httpError(403, 'Chỉ chủ tọa/thư ký được điều hành phiên chất vấn');
  }

  // Sơ đồ chỗ ngồi (E-HSMT mục 38): CHỈ chủ trì/thư ký/admin được gán vị trí đại biểu.
  // Đại biểu thường gửi lên -> chặn thẳng.
  if (p.seatAssignments !== undefined && !isManage) {
    throw httpError(403, 'Chỉ chủ tọa/thư ký được gán vị trí chỗ ngồi cho đại biểu');
  }

  // Mốc bắt đầu mục chương trình (E-HSMT mục 27 — đếm ngược thời gian còn lại):
  // CHỈ chủ trì/thư ký/admin đặt (khi chuyển mục). Đại biểu thường -> chặn thẳng.
  if (p.currentItemStartedAt !== undefined && !isManage) {
    throw httpError(403, 'Chỉ chủ tọa/thư ký được cập nhật tiến trình mục chương trình');
  }

  // biên bản: chữ ký & khóa chỉ qua /actions/sign; đã khóa là bất biến
  if (p.minutes !== undefined) {
    if (existing.minutes?.locked) {
      delete p.minutes;
    } else if (p.minutes) {
      p.minutes = {
        ...p.minutes,
        signatures: existing.minutes?.signatures ?? [],
        locked: false,
      };
    }
  }

  // thành phần tham dự
  if (p.participants !== undefined && Array.isArray(p.participants)) {
    p.participants = isManage
      ? keepServerCheckins(existing, p.participants)
      : delegateOwnRowOnly(existing, p.participants, user.sub);
  }

  // đại biểu thường: ngoài dòng tham dự của mình, không sửa gì khác
  if (!isManage) {
    for (const key of Object.keys(p)) {
      if (key !== 'participants') delete p[key];
    }
  }
  return p;
}

/** Quản lý sửa danh sách: giữ nguyên checkedInAt từ server (điểm danh qua /actions/checkin) */
function keepServerCheckins(existing, incoming) {
  return incoming.map((row) => {
    const old = existing.participants.find((x) => x.userId === row.userId);
    return { ...row, checkedInAt: old?.checkedInAt ?? null };
  });
}

/** Đại biểu: chỉ dòng của mình + thêm dòng khách mời do mình ủy quyền */
function delegateOwnRowOnly(existing, incoming, sub) {
  const out = existing.participants.map((old) => {
    if (old.userId !== sub) return old;
    const mine = incoming.find((r) => r.userId === sub);
    if (!mine) return old;
    return {
      ...old,
      attendStatus: ['pending', 'accepted', 'declined', 'delegated'].includes(mine.attendStatus)
        ? mine.attendStatus
        : old.attendStatus,
      declineReason: typeof mine.declineReason === 'string' ? mine.declineReason.slice(0, 500) : undefined,
      delegateToId: typeof mine.delegateToId === 'string' ? mine.delegateToId : undefined,
      // checkedInAt / seat / meetingRole: giữ nguyên của server
    };
  });

  const myRow = out.find((r) => r.userId === sub);
  for (const row of incoming) {
    const isNew = !out.some((r) => r.userId === row.userId);
    if (isNew && myRow?.attendStatus === 'delegated' && myRow.delegateToId === row.userId) {
      out.push({ userId: row.userId, meetingRole: 'guest', attendStatus: 'accepted', checkedInAt: null });
    }
  }
  return out;
}
