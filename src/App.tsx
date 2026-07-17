import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './store/AppContext';
import MainLayout from './ui/MainLayout';
import LoginPage from './ui/pages/LoginPage';
import DashboardPage from './ui/pages/DashboardPage';
import CalendarPage from './ui/pages/CalendarPage';
import MeetingsPage from './ui/pages/MeetingsPage';
import MeetingDetailPage from './ui/pages/MeetingDetailPage';
import LiveMeetingPage from './ui/pages/LiveMeetingPage';
import OnlineMeetingPage from './ui/pages/OnlineMeetingPage';
import ScreenDisplayPage from './ui/pages/ScreenDisplayPage';
import DocumentsPage from './ui/pages/DocumentsPage';
import PollsPage from './ui/pages/PollsPage';
import TasksPage from './ui/pages/TasksPage';
import NotificationsPage from './ui/pages/NotificationsPage';
import HelpPage from './ui/pages/HelpPage';
import SupportPage from './ui/pages/SupportPage';
import UsersAdminPage from './ui/pages/admin/UsersAdminPage';
import UnitsAdminPage from './ui/pages/admin/UnitsAdminPage';
import RoomsAdminPage from './ui/pages/admin/RoomsAdminPage';
import CatalogsAdminPage from './ui/pages/admin/CatalogsAdminPage';
import GuidesAdminPage from './ui/pages/admin/GuidesAdminPage';
import AuditLogPage from './ui/pages/admin/AuditLogPage';
import ReportsPage from './ui/pages/admin/ReportsPage';
import ApiAdminPage from './ui/pages/admin/ApiAdminPage';
import SupportAdminPage from './ui/pages/admin/SupportAdminPage';

function Boot() {
  return <div className="boot"><div className="boot-logo">eC</div><p>Đang khởi động hệ thống…</p></div>;
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, ready } = useApp();
  if (!ready) return <Boot />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { user } = useApp();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

// Cho phép cả Quản trị hệ thống (admin) và Quản trị đơn vị (unit_admin)
// vào phân hệ quản lý người dùng (unit_admin bị giới hạn phạm vi bên trong trang).
function RequireUserAdmin({ children }: { children: React.ReactElement }) {
  const { user } = useApp();
  if (user?.role !== 'admin' && user?.role !== 'unit_admin') return <Navigate to="/" replace />;
  return children;
}

// Báo cáo thống kê (bao gồm tab "Thống kê ý kiến văn bản" — E-HSMT mục 48/53):
// vai trò quản lý (chủ trì/thư ký/admin) đều xem được, không chỉ admin.
// Khu quản trị Hỗ trợ & Phản hồi dùng RequireUserAdmin — admin + quản trị đơn vị
// (vai trò HSMT "nhận & phân phối yêu cầu"); chủ trì/thư ký KHÔNG xử lý phản hồi (vá QA 18/07).
function RequireManage({ children }: { children: React.ReactElement }) {
  const { user } = useApp();
  if (!user || !['admin', 'chairman', 'secretary'].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function ToastHost() {
  const { toasts } = useApp();
  return (
    <div className="toasts">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
    </div>
  );
}

export default function App() {
  return (
    <>
    <ToastHost />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Màn hình toàn màn hình (không có khung sidebar) */}
      <Route path="/meetings/:id/live" element={<RequireAuth><LiveMeetingPage /></RequireAuth>} />
      <Route path="/meetings/:id/online" element={<RequireAuth><OnlineMeetingPage /></RequireAuth>} />
      <Route path="/meetings/:id/screen" element={<RequireAuth><ScreenDisplayPage /></RequireAuth>} />
      <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/meetings/:id" element={<MeetingDetailPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/polls" element={<PollsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/admin/users" element={<RequireUserAdmin><UsersAdminPage /></RequireUserAdmin>} />
        <Route path="/admin/units" element={<RequireAdmin><UnitsAdminPage /></RequireAdmin>} />
        <Route path="/admin/rooms" element={<RequireAdmin><RoomsAdminPage /></RequireAdmin>} />
        <Route path="/admin/catalogs" element={<RequireAdmin><CatalogsAdminPage /></RequireAdmin>} />
        <Route path="/admin/guides" element={<RequireAdmin><GuidesAdminPage /></RequireAdmin>} />
        <Route path="/admin/api" element={<RequireAdmin><ApiAdminPage /></RequireAdmin>} />
        <Route path="/admin/audit" element={<RequireAdmin><AuditLogPage /></RequireAdmin>} />
        <Route path="/admin/reports" element={<RequireManage><ReportsPage /></RequireManage>} />
        <Route path="/support-admin" element={<RequireUserAdmin><SupportAdminPage /></RequireUserAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
