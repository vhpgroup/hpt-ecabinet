// ============================================================
// KHUNG CHÍNH — sidebar điều hướng + topbar + chuông thông báo
// ============================================================
import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { db } from '../data/db';
import { Avatar, Badge, Icon } from './components';
import { ROLE_LABEL } from '../domain/labels';
import * as notificationService from '../services/notificationService';
import { resetAllData } from '../services/adminService';
import { timeAgo } from './format';

const NOTIF_ICON: Record<string, string> = {
  meeting: 'calendar', vote: 'vote', poll: 'vote', task: 'clipboard', doc: 'file', system: 'info',
};

export default function MainLayout() {
  const { user, s, rt, logout, refresh, toast } = useApp();
  const nav = useNavigate();
  const [sbOpen, setSbOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const myNotifs = useMemo(
    () => s.notifications.filter((n) => n.userId === user?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s.notifications, user],
  );
  const unread = myNotifs.filter((n) => !n.read).length;
  const liveMeeting = s.meetings.find(
    (m) => m.status === 'live' && m.participants.some((p) => p.userId === user?.id),
  );

  const openNotif = async (id: string, link?: string) => {
    await notificationService.markRead(id);
    await refresh();
    setBellOpen(false);
    if (link) nav(link.replace(/^#/, ''));
  };

  const doReset = async () => {
    if (!window.confirm('Khôi phục toàn bộ DỮ LIỆU MẪU? Các thay đổi hiện tại sẽ bị xóa.')) return;
    try {
      await resetAllData();
      await refresh();
      toast('Đã khôi phục dữ liệu mẫu', 'success');
    } catch (e) {
      toast((e as Error).message, 'error'); // chế độ máy chủ: chỉ quản trị viên được reset
    }
  };

  const linkCls = ({ isActive }: { isActive: boolean }) => 'sb-link' + (isActive ? ' active' : '');

  return (
    <div className="app-shell">
      <aside className={'sidebar' + (sbOpen ? ' open' : '')}>
        <div className="sb-brand">
          <div className="sb-logo">eC</div>
          <div>
            <b>eCabinet</b>
            <small>Phòng họp không giấy</small>
          </div>
        </div>
        <nav className="sb-nav" onClick={() => setSbOpen(false)}>
          <div className="sb-group">Tổng quan</div>
          <NavLink to="/" end className={linkCls}><Icon name="home" />Trang chủ</NavLink>
          <NavLink to="/calendar" className={linkCls}><Icon name="calendar" />Lịch công tác</NavLink>
          <NavLink to="/notifications" className={linkCls}>
            <Icon name="bell" />Thông báo
            {unread > 0 && <Badge color="red">{unread}</Badge>}
          </NavLink>
          <div className="sb-group">Nghiệp vụ họp</div>
          <NavLink to="/meetings" className={linkCls}><Icon name="users" />Phiên họp</NavLink>
          <NavLink to="/documents" className={linkCls}><Icon name="file" />Tài liệu</NavLink>
          <NavLink to="/polls" className={linkCls}><Icon name="vote" />Lấy ý kiến</NavLink>
          <NavLink to="/tasks" className={linkCls}><Icon name="clipboard" />Nhiệm vụ sau họp</NavLink>
          <div className="sb-group">Tiện ích</div>
          <NavLink to="/help" className={linkCls}><Icon name="book" />Hướng dẫn sử dụng</NavLink>
          {user?.role === 'admin' && (
            <>
              <div className="sb-group">Quản trị hệ thống</div>
              <NavLink to="/admin/users" className={linkCls}><Icon name="settings" />Người dùng</NavLink>
              <NavLink to="/admin/units" className={linkCls}><Icon name="building" />Đơn vị</NavLink>
              <NavLink to="/admin/rooms" className={linkCls}><Icon name="room" />Phòng họp</NavLink>
              <NavLink to="/admin/catalogs" className={linkCls}><Icon name="tag" />Danh mục</NavLink>
              <NavLink to="/admin/guides" className={linkCls}><Icon name="book" />Tài liệu HDSD</NavLink>
              <NavLink to="/admin/audit" className={linkCls}><Icon name="list" />Nhật ký hệ thống</NavLink>
              <NavLink to="/admin/reports" className={linkCls}><Icon name="chart" />Báo cáo thống kê</NavLink>
            </>
          )}
          {/* Quản trị đơn vị (E-HSMT vai trò thứ 5): CHỈ quản lý người dùng trong đơn vị mình */}
          {user?.role === 'unit_admin' && (
            <>
              <div className="sb-group">Quản trị đơn vị</div>
              <NavLink to="/admin/users" className={linkCls}><Icon name="settings" />Người dùng đơn vị</NavLink>
            </>
          )}
        </nav>
        <div className="sb-foot">
          <Avatar user={user} size={38} />
          <div className="who">
            <b>{user?.fullName}</b>
            <span>{user ? ROLE_LABEL[user.role] : ''} · {user?.title}</span>
          </div>
          <button className="icon-btn" title="Đăng xuất" onClick={() => { logout(); nav('/login'); }}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn hamburger" onClick={() => setSbOpen(!sbOpen)}><Icon name="menu" /></button>
          {liveMeeting && (
            <button className="live-banner" style={{ border: 'none', cursor: 'pointer' }}
              onClick={() => nav(`/meetings/${liveMeeting.id}/live`)}>
              <span className="live-dot" /> Phiên họp đang diễn ra — Vào phòng họp
            </button>
          )}
          <div className="spacer" />
          {db.remote && (
            <span className={'badge ' + (rt ? 'badge-green' : 'badge-amber')}
              title={rt ? 'Kênh WebSocket đang hoạt động — dữ liệu cập nhật tức thời' : 'Đang kết nối lại kênh thời gian thực…'}>
              {rt ? '● Thời gian thực' : '⟳ Kết nối lại…'}
            </span>
          )}
          <button className="icon-btn" title="Khôi phục dữ liệu mẫu" onClick={doReset}><Icon name="refresh" /></button>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setBellOpen(!bellOpen)} title="Thông báo">
              <Icon name="bell" />
              {unread > 0 && <span className="dot-alert" />}
            </button>
            {bellOpen && (
              <div className="notif-pop">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', borderBottom: '1px solid var(--line)' }}>
                  <b style={{ fontSize: 14 }}>Thông báo</b>
                  <button className="btn ghost sm" onClick={async () => { if (user) { await notificationService.markAllRead(user.id); await refresh(); } }}>
                    Đánh dấu đã đọc
                  </button>
                </div>
                {myNotifs.slice(0, 8).map((n) => (
                  <div key={n.id} className={'notif-item' + (n.read ? '' : ' unread')} onClick={() => openNotif(n.id, n.link)}>
                    <div className="ni-ic"><Icon name={NOTIF_ICON[n.type] ?? 'info'} size={16} /></div>
                    <div style={{ minWidth: 0 }}>
                      <b>{n.title}</b>
                      <p>{n.body}</p>
                      <small>{timeAgo(n.createdAt)}</small>
                    </div>
                  </div>
                ))}
                {myNotifs.length === 0 && <div className="empty"><p>Chưa có thông báo</p></div>}
              </div>
            )}
          </div>
          <Avatar user={user} size={34} />
        </header>
        <main className="content" onClick={() => bellOpen && setBellOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
