// Nhãn tiếng Việt + màu trạng thái dùng chung toàn hệ thống
import type {
  AttendStatus, CatalogType, FeedbackCategory, FeedbackStatus, MeetingStatus,
  QuestionStatus, Role, UnitAdminType, VoteStatus,
} from './types';

// Nhãn 4 loại danh mục chung (E-HSMT mục 6, 7, 8, 10)
export const CATALOG_TYPE: Record<CatalogType, { label: string; labelPlural: string }> = {
  position: { label: 'Chức vụ', labelPlural: 'Danh mục chức vụ' },
  meetingType: { label: 'Loại phiên họp', labelPlural: 'Danh mục loại phiên họp' },
  issuingBody: { label: 'Cơ quan ban hành', labelPlural: 'Danh mục cơ quan ban hành' },
  docType: { label: 'Loại tài liệu', labelPlural: 'Danh mục loại tài liệu' },
};

// Nhãn loại đơn vị hành chính (bối cảnh xã/phường/đặc khu TP Hải Phòng)
export const UNIT_ADMIN_TYPE: Record<UnitAdminType, { label: string; color: string }> = {
  xa: { label: 'Xã', color: 'green' },
  phuong: { label: 'Phường', color: 'blue' },
  dac_khu: { label: 'Đặc khu', color: 'purple' },
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị viên',
  chairman: 'Chủ trì',
  secretary: 'Thư ký',
  delegate: 'Đại biểu',
  unit_admin: 'Quản trị đơn vị',
};

export const MEETING_STATUS: Record<MeetingStatus, { label: string; color: string }> = {
  draft: { label: 'Bản nháp', color: 'gray' },
  invited: { label: 'Đã gửi giấy mời', color: 'blue' },
  live: { label: 'Đang diễn ra', color: 'green' },
  finished: { label: 'Đã kết thúc', color: 'navy' },
  cancelled: { label: 'Đã hủy', color: 'red' },
};

export const ATTEND_STATUS: Record<AttendStatus, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'amber' },
  accepted: { label: 'Tham dự', color: 'green' },
  declined: { label: 'Vắng mặt', color: 'red' },
  delegated: { label: 'Ủy quyền', color: 'purple' },
};

export const VOTE_STATUS: Record<VoteStatus, { label: string; color: string }> = {
  draft: { label: 'Nháp — chưa gửi', color: 'gray' },
  pending: { label: 'Chưa mở', color: 'gray' },
  open: { label: 'Đang mở', color: 'green' },
  closed: { label: 'Đã đóng', color: 'navy' },
};

// Phân loại phản hồi/góp ý người dùng (HSMT tiêu chí 5.1–5.4)
export const FEEDBACK_CATEGORY: Record<FeedbackCategory, string> = {
  bug: 'Báo lỗi',
  feature: 'Đề xuất tính năng',
  question: 'Câu hỏi/hỗ trợ',
  other: 'Khác',
};

export const FEEDBACK_STATUS: Record<FeedbackStatus, { label: string; color: string }> = {
  new: { label: 'Mới', color: 'amber' },
  processing: { label: 'Đang xử lý', color: 'blue' },
  resolved: { label: 'Đã trả lời', color: 'green' },
};

/**
 * Thông tin kênh hỗ trợ (HSMT mục 5.2 "phương thức ghi nhận ý kiến người dùng":
 * in-app, hotline, email). Hằng số tĩnh — cập nhật tại đây khi có số/địa chỉ thật.
 */
export const SUPPORT_CHANNELS = {
  hotline: { label: 'Tổng đài hỗ trợ (giờ hành chính)', value: '1900 xxxx' },
  hotlineAdmin: { label: 'Hỗ trợ quản trị hệ thống (24/7)', value: '0912 000 001' },
  email: { label: 'Email hỗ trợ', value: 'hotro.ecabinet@hpt.tech' },
} as const;

// Trạng thái lượt đăng ký chất vấn (E-HSMT mục 34/45/46)
export const QUESTION_STATUS: Record<QuestionStatus, { label: string; color: string }> = {
  pending: { label: 'Chờ gọi', color: 'amber' },
  called: { label: 'Đang chất vấn', color: 'green' },
  done: { label: 'Đã chất vấn', color: 'navy' },
  rejected: { label: 'Từ chối', color: 'red' },
};

// Trạng thái phiên chất vấn (chủ tọa điều hành)
export const QUESTION_SESSION: Record<string, { label: string; color: string }> = {
  closed: { label: 'Chưa mở', color: 'gray' },
  open: { label: 'Đang mở', color: 'green' },
  paused: { label: 'Tạm dừng', color: 'amber' },
};

export const TASK_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: 'Chưa thực hiện', color: 'gray' },
  doing: { label: 'Đang thực hiện', color: 'blue' },
  done: { label: 'Hoàn thành', color: 'green' },
};

export const DOC_KIND: Record<string, string> = {
  main: 'Tài liệu chính',
  reference: 'Tài liệu tham khảo',
  personal: 'Tài liệu cá nhân',
};

// Trạng thái duyệt tài liệu (E-HSMT mục 24). undefined coi như 'approved'.
export const DOC_REVIEW: Record<string, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'gray' },
  pending: { label: 'Chờ duyệt', color: 'amber' },
  approved: { label: 'Đã duyệt', color: 'green' },
  rejected: { label: 'Từ chối', color: 'red' },
};

export const MEETING_ROLE: Record<string, string> = {
  chair: 'Chủ trì',
  secretary: 'Thư ký',
  member: 'Thành viên',
  guest: 'Khách mời',
};
