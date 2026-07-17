// ============================================================
// DATA LAYER — Hợp đồng (interface) truy cập dữ liệu.
// Giai đoạn 1: LocalStorageAdapter (data/db.ts).
// Giai đoạn 2: chỉ cần viết RestApiAdapter implement đúng các
// interface dưới đây và đổi factory createDataSource() — toàn bộ
// services & UI giữ nguyên.
// ============================================================
import type {
  Annotation, AuditEntry, CatalogItem, ChatMessage, DocFile, GuideDoc, Meeting, Notification,
  QuestionRequest, Room, SpeakRequest, TaskItem, Unit, User, Vote,
} from '../domain/types';

export interface Repo<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(item: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
  saveAll(items: T[]): Promise<void>;
}

export interface DataSource {
  /** true khi dùng máy chủ từ xa (REST) — app tắt mô phỏng cục bộ, tăng giới hạn tải tệp */
  remote?: boolean;
  /** Đăng nhập phía máy chủ (chỉ tồn tại ở REST adapter — GĐ2) */
  login?(username: string, password: string): Promise<User>;
  /** JWT hiện tại (REST adapter — dùng cho kênh realtime GĐ3) */
  getToken?(): string | null;
  /** Đường WebSocket realtime (REST adapter — vd "/api/realtime") */
  realtimePath?: string;
  /**
   * Gọi endpoint nghiệp vụ chuyên biệt /api/actions/... (GĐ4).
   * Các mutation nhạy cảm (bỏ phiếu, ký, điểm danh, điều hành họp)
   * đi qua đây để server kiểm tra sâu; demo cục bộ không có.
   */
  action?(path: string, body?: unknown): Promise<unknown>;
  /**
   * Họp trực tuyến WebRTC (LiveKit) — chỉ có ở REST adapter (GĐ2+).
   * rtcConfig(): server có bật RTC không (đã đặt env LiveKit chưa).
   * rtcToken(meetingId): xin access token + URL LiveKit cho phiên họp.
   * Local demo KHÔNG có (undefined) -> OnlineMeetingPage coi như disabled
   * và giữ nguyên giao diện mô phỏng.
   */
  rtcConfig?(): Promise<{ enabled: boolean }>;
  rtcToken?(meetingId: string): Promise<{ url: string; token: string; room?: string; identity?: string }>;
  users: Repo<User>;
  units: Repo<Unit>;
  rooms: Repo<Room>;
  meetings: Repo<Meeting>;
  documents: Repo<DocFile>;
  annotations: Repo<Annotation>;
  votes: Repo<Vote>;
  speakRequests: Repo<SpeakRequest>;
  questions: Repo<QuestionRequest>;
  messages: Repo<ChatMessage>;
  tasks: Repo<TaskItem>;
  notifications: Repo<Notification>;
  audit: Repo<AuditEntry>;
  catalogs: Repo<CatalogItem>; // danh mục chung (E-HSMT mục 6, 7, 10)
  guides: Repo<GuideDoc>;      // tài liệu hướng dẫn sử dụng (E-HSMT mục 4)
  /** Xóa toàn bộ và nạp lại dữ liệu mẫu */
  reset(): Promise<void>;
  /** Khóa/giá trị phiên đăng nhập (giai đoạn 2: token JWT) */
  getSession(): string | null;
  setSession(userId: string | null): void;
}
