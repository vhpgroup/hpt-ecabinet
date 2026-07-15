// ============================================================
// DOMAIN — Định nghĩa toàn bộ thực thể nghiệp vụ của eCabinet.
// Tầng này KHÔNG phụ thuộc UI hay nguồn dữ liệu.
// ============================================================

export type Role = 'admin' | 'chairman' | 'secretary' | 'delegate';

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
}

export interface Room {
  id: string;
  name: string;
  location: string;
  capacity: number;
  equipment: string[];
  supportsOnline: boolean;
  status: 'active' | 'maintenance';
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
  // ---- Thể thức văn bản biên bản theo NĐ 30/2020 (P0-B). OPTIONAL ----
  /** Số & ký hiệu văn bản biên bản, vd "Số: 06/BB-UBND" */
  documentNumber?: string;
  /** Địa danh nơi ban hành, vd "Thành phố ………" (mặc định để trống điền tay) */
  documentLocation?: string;
  /** Nơi nhận (ngoài "Lưu: VT") */
  recipients?: string[];
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
  messages: ChatMessage[];
  tasks: TaskItem[];
  notifications: Notification[];
  audit: AuditEntry[];
}

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
