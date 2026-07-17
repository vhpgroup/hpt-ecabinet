// ============================================================
// MA TRẬN PHÂN QUYỀN (ACL) theo bộ dữ liệu + hàm allowed().
// Tách khỏi index.js để KIỂM THỬ MỨC HÀM được (index.js có side-effect khởi
// động HTTP server nên không import test trực tiếp). Logic giữ NGUYÊN.
//
// Quy ước rule:
//   'any'            : mọi người dùng đã đăng nhập
//   [roles]          : vai trò trong danh sách
//   'adminOrSelf'    : admin hoặc chính chủ (users)
//   'ownerOrManage'  : chủ sở hữu bản ghi (ownerId) hoặc admin/thư ký/chủ trì
//   'owner:<field>'  : bản ghi có <field> === user hiện tại
//   'ownerOrManage:<field>' : bản ghi có <field> === user hiện tại HOẶC quản lý
//   'self:<field>'   : dữ liệu gửi lên có <field> === user hiện tại
//   'assigneeOrManage': người được giao (assigneeId) hoặc quản lý
//   'none'           : cấm qua API chung (phải qua endpoint nghiệp vụ)
// ============================================================

export const MANAGE = ['admin', 'secretary', 'chairman'];

export const ACL = {
  // Quản trị đơn vị (unit_admin) được tạo/sửa người dùng TRONG đơn vị mình.
  // Kiểm tra sâu (cùng đơn vị, không đụng admin, không tự đổi unitId) nằm ở
  // enforceUserWrite() — đọc unitId từ DB, KHÔNG tin body. Xóa vẫn CHỈ admin.
  users:         { create: ['admin', 'unit_admin'], update: 'adminOrSelfOrUnitAdmin', remove: ['admin'] },
  units:         { create: ['admin'], update: ['admin'], remove: ['admin'] },
  rooms:         { create: ['admin'], update: ['admin'], remove: ['admin'] },
  // P0-2 (HSMT dòng 354-355): "Quản trị đơn vị" là actor CHÍNH tạo phiên họp — thêm
  // unit_admin vào quyền tạo. Kiểm tra sâu (chairId/secretaryId PHẢI thuộc đơn vị
  // unit_admin, đọc từ DB không tin body) nằm ở enforceMeetingWrite() trong index.js.
  // update/remove GIỮ NGUYÊN (unit_admin không nằm trong MANAGE cho sửa/xóa — ngoài
  // phạm vi P0-2, xem báo cáo dev-backend.md mục "rủi ro còn lại").
  meetings:      { create: [...MANAGE, 'unit_admin'], update: 'any', remove: MANAGE },
  documents:     { create: 'any', update: 'ownerOrManage', remove: 'ownerOrManage' },
  annotations:   { create: 'self:userId', update: 'owner:userId', remove: 'owner:userId' },
  votes:         { create: MANAGE, update: 'any', remove: MANAGE },
  speakRequests: { create: 'self:userId', update: 'any', remove: 'any' },
  // Chất vấn: đại biểu tạo cho CHÍNH MÌNH; cập nhật 'any' nhưng guard siết
  // (chỉ manage đổi trạng thái gọi/xong/từ chối, chính chủ chỉ sửa nội dung khi
  // đang chờ); xóa = chính chủ (hủy đăng ký) HOẶC quản lý.
  questions:     { create: 'self:userId', update: 'any', remove: 'ownerOrManage:userId' },
  messages:      { create: 'self:fromId', update: 'none', remove: 'none' },
  tasks:         { create: MANAGE, update: 'assigneeOrManage', remove: MANAGE },
  notifications: { create: 'any', update: 'owner:userId', remove: 'owner:userId' },
  // Nhật ký (E-HSMT mục 3): ai cũng ghi được (server tự ghi khi thao tác); KHÔNG sửa;
  // GIỜ CHO admin XÓA (trước là 'none') để "Xóa nhật ký đăng nhập hệ thống".
  audit:         { create: 'any', update: 'none', remove: ['admin'] },
  // ĐỢT 3 — Danh mục chung (E-HSMT mục 6, 7, 10): đọc = mọi người đăng nhập;
  // tạo/sửa/xóa CHỈ admin (Quản trị hệ thống quản trị danh mục).
  catalogs:      { create: ['admin'], update: ['admin'], remove: ['admin'] },
  // ĐỢT 3 — Tài liệu HDSD (E-HSMT mục 4): đọc = mọi người (access.js lọc theo roleScope);
  // tạo/sửa/xóa CHỈ admin.
  guides:        { create: ['admin'], update: ['admin'], remove: ['admin'] },
  // RỔ B — Khóa API bên thứ 3 (E-HSMT mục 54–59):
  //  create 'none' -> BẮT BUỘC qua endpoint nghiệp vụ POST /api/apikeys/create (key sinh server-side,
  //  không cho client tự đặt keyHash). update/remove CHỈ admin; guard chặn sửa keyHash/prefix.
  //  Đọc: access.js xếp apiKeys vào SENSITIVE -> chỉ admin thấy.
  apiKeys:       { create: 'none', update: ['admin'], remove: ['admin'] },
  // P1-6 — Phản hồi/góp ý người dùng (E-HSMT mục 5.1–5.4): bất kỳ ai đăng nhập tạo được
  // (server ép userId/unitId = chính mình, không tin body — xem index.js). update = 'any'
  // để guardFeedbacks() (guard.js) làm toàn bộ việc siết field theo vai trò (status/
  // response/handledBy CHỈ admin; không ai sửa được phản hồi NGƯỜI KHÁC trừ admin) — cùng
  // triết lý với votes/meetings/questions (ACL lỏng, GUARD siết field). remove: chỉ admin.
  feedbacks:     { create: 'any', update: 'any', remove: ['admin'] },
};

/** Kiểm quyền theo rule + ngữ cảnh request. Trả boolean. */
export function allowed(rule, req, existing, body) {
  const { sub, role } = req.user;
  if (rule === 'any') return true;
  if (rule === 'none') return false;
  if (Array.isArray(rule)) return rule.includes(role);
  if (rule === 'adminOrSelf') return role === 'admin' || existing?.id === sub;
  // Quản trị đơn vị: admin | chính chủ | unit_admin (phạm vi đơn vị kiểm sâu ở enforceUserWrite)
  if (rule === 'adminOrSelfOrUnitAdmin') return role === 'admin' || existing?.id === sub || role === 'unit_admin';
  if (rule === 'ownerOrManage') return MANAGE.includes(role) || existing?.ownerId === sub;
  if (rule === 'assigneeOrManage') return MANAGE.includes(role) || existing?.assigneeId === sub;
  if (rule.startsWith('ownerOrManage:')) return MANAGE.includes(role) || existing?.[rule.slice(14)] === sub;
  if (rule.startsWith('owner:')) return existing?.[rule.slice(6)] === sub;
  if (rule.startsWith('self:')) return body?.[rule.slice(5)] === sub;
  return false;
}
