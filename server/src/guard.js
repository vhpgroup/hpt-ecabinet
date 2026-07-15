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
  meetings: { code: 'string', title: 'string', description: 'string', startTime: 'string', endTime: 'string', roomId: 'string', isOnline: 'boolean', status: 'string', chairId: 'string', secretaryId: 'string', participants: 'array', agenda: 'array', currentAgendaItemId: 'string|null', conclusions: 'array', minutes: 'object|null', invitedAt: 'string' },
  votes: { kind: 'string', meetingId: 'string|null', agendaItemId: 'string|null', title: 'string', description: 'string', options: 'array', ballots: 'array', eligibleIds: 'array', documentIds: 'array', secret: 'boolean', status: 'string', deadline: 'string|null' },
  documents: { name: 'string', kind: 'string', meetingId: 'string|null', agendaItemId: 'string|null', sharedWith: 'array', secret: 'boolean', content: 'string', dataUrl: 'string', version: 'number', mime: 'string' },
  annotations: { docId: 'string', content: 'string', isPublic: 'boolean' },
  tasks: { title: 'string', description: 'string', assigneeId: 'string', deadline: 'string', status: 'string', progress: 'number', meetingId: 'string|null' },
  notifications: { read: 'boolean', title: 'string', body: 'string', type: 'string' },
  users: { fullName: 'string', title: 'string', unitId: 'string', role: 'string', email: 'string', phone: 'string', status: 'string', avatarColor: 'string', username: 'string' },
  units: { name: 'string', short: 'string', order: 'number' },
  rooms: { name: 'string', location: 'string', capacity: 'number', equipment: 'array', supportsOnline: 'boolean', status: 'string' },
  speakRequests: { meetingId: 'string', topic: 'string', status: 'string' },
  messages: { meetingId: 'string', content: 'string', toId: 'string|null' },
};

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
}

/**
 * Trả về patch đã làm sạch cho collection; ném lỗi 403 khi bị cấm hoàn toàn.
 */
export function guardPatch(col, existing, patch, user) {
  if (col === 'votes') return guardVotes(patch, user);
  if (col === 'meetings') return guardMeetings(existing, patch, user);
  return patch;
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
