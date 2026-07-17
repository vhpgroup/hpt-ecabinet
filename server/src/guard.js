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
  votes: { kind: 'string', meetingId: 'string|null', agendaItemId: 'string|null', title: 'string', description: 'string', options: 'array', ballots: 'array', eligibleIds: 'array', documentIds: 'array', secret: 'boolean', status: 'string', deadline: 'string|null' },
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
};

// Vai trò hợp lệ + trạng thái duyệt tài liệu hợp lệ (chống ghi giá trị rác vào enum)
const VALID_ROLES = ['admin', 'chairman', 'secretary', 'delegate', 'unit_admin'];
const VALID_REVIEW = ['draft', 'pending', 'approved', 'rejected'];
// ĐỢT 3 — loại danh mục hợp lệ (E-HSMT mục 6, 7, 10)
const VALID_CATALOG_TYPES = ['position', 'meetingType', 'issuingBody'];
/** Khóa ghế hợp lệ: chuỗi "số-số" (vd "10-3"). */
const isSeatKey = (v) => typeof v === 'string' && /^\d+-\d+$/.test(v);

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

/** Kiểm kiểu cho PATCH/POST. Ném 400 khi sai. Áp cho mọi collection. */
export function validatePatch(col, body) {
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
      throw httpError(400, 'Loại danh mục không hợp lệ (chỉ chức vụ / loại phiên họp / cơ quan ban hành)');
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
}

/**
 * Trả về patch đã làm sạch cho collection; ném lỗi 403 khi bị cấm hoàn toàn.
 */
export function guardPatch(col, existing, patch, user) {
  if (col === 'votes') return guardVotes(patch, user);
  if (col === 'meetings') return guardMeetings(existing, patch, user);
  if (col === 'questions') return guardQuestions(existing, patch, user);
  if (col === 'documents') return guardDocuments(existing, patch, user);
  return patch;
}

/**
 * TÀI LIỆU — siết quy trình trình–duyệt (E-HSMT mục 24):
 * - Người trình (owner) KHÔNG được tự approve. Chỉ chuyển draft/rejected -> pending.
 * - Quản lý (chủ trì/thư ký/admin) duyệt: pending -> approved | rejected.
 * - reviewedById/reviewedAt do SERVER quyết định, không tin client.
 * Vi phạm chuyển trạng thái -> 403 (phản hồi rõ ràng, không âm thầm bỏ qua).
 */
function guardDocuments(existing, patch, user) {
  const isManage = MANAGE.includes(user.role);
  const p = { ...patch };
  // các trường vết duyệt do server ghi (qua service) — chặn client tự đặt tùy tiện
  // (service phía máy chủ không có; client REST gửi trọn gói nên ta chuẩn hóa tại đây)
  const cur = existing.reviewStatus ?? 'approved';

  if (p.reviewStatus !== undefined && p.reviewStatus !== cur) {
    const isOwner = existing.ownerId === user.sub;
    const allowedOwner = isOwner && (cur === 'draft' || cur === 'rejected') && p.reviewStatus === 'pending';
    const allowedManage = isManage && cur === 'pending' && (p.reviewStatus === 'approved' || p.reviewStatus === 'rejected');
    if (!allowedOwner && !allowedManage) {
      throw httpError(403, 'Không được chuyển trạng thái duyệt tài liệu như vậy');
    }
    if (p.reviewStatus === 'rejected') {
      const note = typeof p.reviewNote === 'string' ? p.reviewNote.trim() : '';
      if (!note) throw httpError(400, 'Phải nhập lý do khi từ chối tài liệu');
      p.reviewNote = note.slice(0, 2000);
    }
    // ghi vết duyệt phía server khi là hành động duyệt/từ chối của quản lý
    if (allowedManage) {
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
