// Nhãn tiếng Việt + màu trạng thái dùng chung toàn hệ thống
import type { AttendStatus, MeetingStatus, QuestionStatus, Role, VoteStatus } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị viên',
  chairman: 'Chủ trì',
  secretary: 'Thư ký',
  delegate: 'Đại biểu',
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
  pending: { label: 'Chưa mở', color: 'gray' },
  open: { label: 'Đang mở', color: 'green' },
  closed: { label: 'Đã đóng', color: 'navy' },
};

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

export const MEETING_ROLE: Record<string, string> = {
  chair: 'Chủ trì',
  secretary: 'Thư ký',
  member: 'Thành viên',
  guest: 'Khách mời',
};
