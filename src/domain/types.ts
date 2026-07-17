// ============================================================
// DOMAIN — Định nghĩa toàn bộ thực thể nghiệp vụ của eCabinet.
// Tầng này KHÔNG phụ thuộc UI hay nguồn dữ liệu.
// ============================================================

// 5 vai trò theo E-HSMT (mục "Các đối tượng tham gia phần mềm"):
// Chủ trì, Thư ký, Thành viên dự họp, Quản trị hệ thống, Quản trị đơn vị.
// 'unit_admin' = Quản trị đơn vị: quản lý người dùng trong PHẠM VI đơn vị mình.
export type Role = 'admin' | 'chairman' | 'secretary' | 'delegate' | 'unit_admin';

export interface Unit {
  id: string;
  name: string;
  short: string;
  order: number;
}

export interface User {
  id: string;
  username: string;
  password: string; // demo — giai đoạn 2 thay bằng hash phía server
  fullName: string;
  title: string; // chức danh
  unitId: string;
  role: Role;
  email: string;
  phone: string;
  avatarColor: string;
  status: 'active' | 'inactive';
  /**
   * Chức vụ chọn từ danh mục chức vụ (E-HSMT mục 6). OPTIONAL — lưu tên chức vụ
   * (cho phép nhập tự do khi danh mục trống). Khác với `title` (chức danh mô tả).
   */
  position?: string;
}

/**
 * Sơ đồ chỗ ngồi của phòng họp (E-HSMT mục 9 "Cập nhật sơ đồ phòng họp").
 * OPTIONAL để tương thích ngược dữ liệu cũ + round-trip JSONB/localStorage.
 * - rows/cols: kích thước lưới ghế (giới hạn 1..12).
 * - disabled : danh sách ô KHÔNG phải ghế (lối đi / khoảng trống), khóa theo "hàng-cột" (vd "2-3").
 */
export interface RoomLayout {
  rows: number;
  cols: number;
  disabled?: string[];
}

export interface Room {
  id: string;
  name: string;
  location: string;
  capacity: number;
  equipment: string[];
  supportsOnline: boolean;
  status: 'active' | 'maintenance';
  /** Sơ đồ phòng họp (lưới ghế). OPTIONAL — chưa cấu hình thì dùng bố cục mặc định. */
  layout?: RoomLayout;
}

// ---------------- Phiên họp ----------------
export type MeetingStatus = 'draft' | 'invited' | 'live' | 'finished' | 'cancelled';

export interface AgendaItem {
  id: string;
  order: number;
  title: string;
  presenterId?: string;
  durationMinutes: number;
  documentIds: string[];
}

// ---------------- Danh mục dùng chung (E-HSMT mục 6, 7, 10) ----------------
/**
 * Một mục danh mục: chức vụ / loại phiên họp / cơ quan ban hành.
 * Dùng chung 1 collection `catalogs`, phân biệt bằng `type`.
 * OPTIONAL các trường phụ để tương thích ngược + round-trip JSONB.
 */
export type CatalogType = 'position' | 'meetingType' | 'issuingBody';

export interface CatalogItem {
  id: string;
  type: CatalogType;
  name: string;
  description?: string;
  /** thứ tự hiển thị (nhỏ trước); mặc định 99 khi trống */
  order?: number;
  /** bật/tắt sử dụng; undefined coi như đang bật (tương thích dữ liệu cũ) */
  active?: boolean;
  createdAt: string;
}

// ---------------- Tài liệu hướng dẫn sử dụng (E-HSMT mục 4) ----------------
/**
 * Tài liệu HDSD: soạn nội dung trực tiếp HOẶC tải tệp (data URL, giống DocFile).
 * roleScope: giới hạn vai trò được xem (trống/undefined = mọi người dùng đăng nhập).
 * OPTIONAL các trường phụ để tương thích ngược + round-trip JSONB.
 */
export interface GuideDoc {
  id: string;
  title: string;
  /** nội dung soạn trực tiếp (văn bản) */
  content?: string;
  /** tên tệp khi tải lên */
  fileName?: string;
  /** dữ liệu tệp dạng data URL (base64) — lưu giống DocFile.dataUrl */
  fileData?: string;
  /** áp dụng cho vai trò nào; trống = tất cả */
  roleScope?: Role[];
  updatedAt: string;
  createdAt: string;
}

export type AttendStatus = 'pending' | 'accepted' | 'declined' | 'delegated';

export interface Participant {
  userId: string;
  meetingRole: 'chair' | 'secretary' | 'member' | 'guest';
  attendStatus: AttendStatus;
  declineReason?: string;
  delegateToId?: string; // ủy quyền cho ai
  checkedInAt?: string | null; // điểm danh
  seat?: string; // vị trí chỗ ngồi
}

export interface Conclusion {
  id: string;
  content: string;
  agendaItemId?: string;
  createdAt: string;
}

export interface SignatureInfo {
  signerId: string;
  signerName: string;
  signerTitle: string;
  signedAt: string;
  serial: string; // số serial chứng thư (mô phỏng)
  hash: string; // SHA-256 nội dung tại thời điểm ký
}

export interface Minutes {
  content: string;
  updatedAt: string;
  signatures: SignatureInfo[];
  locked: boolean;
}

export interface Meeting {
  id: string;
  code: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  roomId: string;
  isOnline: boolean;
  status: MeetingStatus;
  chairId: string;
  secretaryId: string;
  participants: Participant[];
  agenda: AgendaItem[];
  currentAgendaItemId?: string | null;
  conclusions: Conclusion[];
  minutes?: Minutes | null;
  createdBy: string;
  createdAt: string;
  invitedAt?: string;
  /**
   * Phiên chất vấn do chủ tọa điều hành (E-HSMT mục 45/89):
   * - undefined / 'closed' : chưa mở (mặc định, tương thích dữ liệu cũ)
   * - 'open'   : đang cho phép đại biểu đăng ký chất vấn
   * - 'paused' : tạm dừng đăng ký (đã bắt đầu nhưng dừng nhận đăng ký mới)
   * OPTIONAL để tương thích ngược dữ liệu cũ + round-trip JSONB.
   */
  questionSession?: 'closed' | 'open' | 'paused';
  // ---- Thể thức văn bản biên bản theo NĐ 30/2020 (P0-B). OPTIONAL ----
  /** Số & ký hiệu văn bản biên bản, vd "Số: 06/BB-UBND" */
  documentNumber?: string;
  /** Địa danh nơi ban hành, vd "Thành phố ………" (mặc định để trống điền tay) */
  documentLocation?: string;
  /** Nơi nhận (ngoài "Lưu: VT") */
  recipients?: string[];
  /**
   * Gán vị trí đại biểu trên sơ đồ phòng họp (E-HSMT mục 38 "Xem vị trí các đại biểu").
   * Bản đồ userId -> khóa ghế "hàng-cột" (vd "1-2"). Chỉ chủ trì/thư ký/admin được gán.
   * OPTIONAL để tương thích ngược dữ liệu cũ + round-trip JSONB.
   */
  seatAssignments?: Record<string, string>;
  /**
   * Loại phiên họp chọn từ danh mục loại phiên họp (E-HSMT mục 7). OPTIONAL —
   * lưu tên loại (vd "Họp thường kỳ"). Trống = chưa phân loại.
   */
  meetingType?: string;
  /**
   * Thời điểm chủ tọa CHUYỂN sang mục chương trình hiện tại (E-HSMT mục 27 —
   * "Xem thời gian còn lại"). Dùng làm mốc đếm ngược thời lượng mục đang họp.
   * CHỈ chủ trì/thư ký/admin đặt (server guard chặn đại biểu thường).
   * OPTIONAL để tương thích ngược dữ liệu cũ + round-trip JSONB.
   */
  currentItemStartedAt?: string;
}

// ---------------- Tài liệu ----------------
export type DocKind = 'main' | 'reference' | 'personal';

export interface DocFile {
  id: string;
  name: string;
  kind: DocKind;
  meetingId?: string | null;
  agendaItemId?: string | null;
  ownerId: string;
  sharedWith: string[]; // chia sẻ tài liệu cá nhân
  size: number;
  mime: string;
  content?: string; // nội dung văn bản (tài liệu mẫu)
  dataUrl?: string; // file tải lên (base64)
  uploadedAt: string;
  secret: boolean; // tài liệu mật
  version: number;
  // ---- Quy trình trình–duyệt tài liệu (E-HSMT mục 24 "Duyệt/không duyệt tài liệu"). OPTIONAL ----
  /**
   * Trạng thái duyệt tài liệu:
   * - undefined : tương thích ngược — coi như ĐÃ DUYỆT (tài liệu cũ hiển thị bình thường).
   * - 'draft'   : bản nháp (người trình đang chuẩn bị, chưa gửi duyệt).
   * - 'pending' : đã trình, chờ Thành viên dự họp/quản lý duyệt.
   * - 'approved': đã duyệt — hiển thị cho đại biểu.
   * - 'rejected': không duyệt (yêu cầu làm lại) — kèm lý do ở reviewNote.
   */
  reviewStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  /** Lý do/nhận xét khi duyệt hoặc từ chối (bắt buộc khi từ chối). */
  reviewNote?: string;
  /** Người thực hiện duyệt/từ chối gần nhất. */
  reviewedById?: string;
  /** Thời điểm duyệt/từ chối gần nhất. */
  reviewedAt?: string;
  /**
   * Cơ quan ban hành chọn từ danh mục cơ quan ban hành (E-HSMT mục 10).
   * OPTIONAL — lưu tên cơ quan (vd "UBND tỉnh"). Trống = không rõ.
   */
  issuingBody?: string;
  /**
   * Thư mục tài liệu cá nhân (E-HSMT mục 14). OPTIONAL — chỉ là nhãn phân loại
   * do người dùng đặt trên tài liệu cá nhân của mình; trống = "Chưa phân thư mục".
   */
  folder?: string;
}

export interface Annotation {
  id: string;
  docId: string;
  userId: string;
  content: string;
  /** true = góp ý công khai (đại biểu cùng xem); false/undefined = ghi chú cá nhân */
  isPublic?: boolean;
  createdAt: string;
}

// ---------------- Biểu quyết / Lấy ý kiến ----------------
export type VoteKind = 'vote' | 'poll'; // vote: biểu quyết trong họp; poll: phiếu lấy ý kiến
export type VoteStatus = 'pending' | 'open' | 'closed';
/**
 * Ngưỡng thông qua biểu quyết (tính trên TỔNG số người có quyền — eligibleIds):
 * - majority   : quá nửa  → cần ≥ floor(total/2)+1
 * - two_thirds : hai phần ba → cần ≥ ceil(total*2/3)
 * - all        : tuyệt đối → cần = total (toàn bộ tán thành)
 */
export type PassThreshold = 'majority' | 'two_thirds' | 'all';

export interface VoteOption {
  id: string;
  label: string;
}

export interface Ballot {
  userId: string;
  optionId: string;
  comment?: string;
  castAt: string;
}

export interface Vote {
  id: string;
  kind: VoteKind;
  meetingId?: string | null;
  agendaItemId?: string | null;
  title: string;
  description?: string;
  options: VoteOption[];
  secret: boolean; // biểu quyết kín
  status: VoteStatus;
  deadline?: string; // hạn lấy ý kiến
  documentIds: string[];
  ballots: Ballot[];
  eligibleIds: string[]; // người có quyền biểu quyết
  createdBy: string;
  createdAt: string;
  openedAt?: string;
  closedAt?: string;
  // ---- Ngưỡng thông qua (P0-A). Tất cả OPTIONAL để tương thích dữ liệu cũ ----
  /** Ngưỡng tán thành để "Thông qua"; mặc định 'majority' khi không đặt */
  passThreshold?: PassThreshold;
  /** Phương án được tính là "Tán thành"; mặc định = options[0].id */
  approveOptionId?: string;
  /** Phương án được tính là "Ý kiến khác / Phiếu trắng" (không tính chống) */
  abstainOptionId?: string;
}

// ---------------- Diễn biến họp ----------------
export interface SpeakRequest {
  id: string;
  meetingId: string;
  userId: string;
  topic?: string;
  status: 'waiting' | 'speaking' | 'done' | 'rejected';
  requestedAt: string;
  startedAt?: string;
  endedAt?: string;
}

// ---------------- Chất vấn (E-HSMT mục 34/45/46/80/89/90) ----------------
/**
 * Trạng thái một lượt đăng ký chất vấn:
 * - pending  : đã đăng ký, chờ chủ tọa gọi
 * - called   : đang được chủ tọa gọi chất vấn (tại 1 thời điểm chỉ 1 lượt 'called')
 * - done     : đã kết thúc lượt chất vấn
 * - rejected : chủ tọa từ chối lượt đăng ký
 */
export type QuestionStatus = 'pending' | 'called' | 'done' | 'rejected';

export interface QuestionRequest {
  id: string;
  meetingId: string;
  userId: string; // đại biểu đăng ký chất vấn (người chất vấn)
  targetName?: string; // người / đơn vị được chất vấn
  topic: string; // chủ đề chất vấn
  content?: string; // nội dung chi tiết
  status: QuestionStatus;
  order?: number; // thứ tự đăng ký (dự phòng sắp xếp)
  createdAt: string;
  calledAt?: string; // thời điểm được gọi
  endedAt?: string; // thời điểm kết thúc lượt / bị từ chối
}

export interface ChatMessage {
  id: string;
  meetingId: string;
  fromId: string;
  toId?: string | null; // null => trao đổi chung cả phòng họp
  content: string;
  sentAt: string;
}

// ---------------- Nhiệm vụ sau họp ----------------
export interface TaskItem {
  id: string;
  meetingId?: string | null;
  title: string;
  description?: string;
  assigneeId: string;
  deadline: string;
  status: 'open' | 'doing' | 'done';
  progress: number; // 0..100
  createdAt: string;
  updatedAt: string;
}

// ---------------- Thông báo & Nhật ký ----------------
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'meeting' | 'vote' | 'poll' | 'task' | 'doc' | 'system';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  detail: string;
  at: string;
}

// Gói dữ liệu tổng (dùng cho snapshot state & seed)
export interface Snapshot {
  users: User[];
  units: Unit[];
  rooms: Room[];
  meetings: Meeting[];
  documents: DocFile[];
  annotations: Annotation[];
  votes: Vote[];
  speakRequests: SpeakRequest[];
  questions: QuestionRequest[];
  messages: ChatMessage[];
  tasks: TaskItem[];
  notifications: Notification[];
  audit: AuditEntry[];
  // ĐỢT 3 — OPTIONAL trong tương thích ngược nhưng luôn có ở snapshot mới:
  catalogs: CatalogItem[];   // danh mục chức vụ / loại phiên họp / cơ quan ban hành
  guides: GuideDoc[];        // tài liệu hướng dẫn sử dụng
}

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
