// ============================================================
// TRUNG TÂM THÔNG BÁO
// ============================================================
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EmptyState, Icon, PageHeader } from '../components';
import * as notificationService from '../../services/notificationService';
import { timeAgo } from '../format';

const NOTIF_ICON: Record<string, string> = {
  meeting: 'calendar', vote: 'vote', poll: 'vote', task: 'clipboard', doc: 'file', system: 'info',
};

export default function NotificationsPage() {
  const { user, s, refresh } = useApp();
  const nav = useNavigate();
  const [onlyUnread, setOnlyUnread] = useState(false);

  const list = useMemo(() => {
    let arr = s.notifications.filter((n) => n.userId === user?.id);
    if (onlyUnread) arr = arr.filter((n) => !n.read);
    return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [s.notifications, user, onlyUnread]);

  const open = async (id: string, link?: string) => {
    await notificationService.markRead(id);
    await refresh();
    if (link) nav(link.replace(/^#/, ''));
  };

  return (
    <div>
      <PageHeader icon="bell" title="Thông báo" subtitle="Giấy mời họp, biểu quyết, tài liệu, nhiệm vụ… (giai đoạn 2: đẩy thêm email/SMS)"
        actions={
          <>
            <button className={'btn sm' + (onlyUnread ? '' : ' outline')} onClick={() => setOnlyUnread(!onlyUnread)}>Chưa đọc</button>
            <button className="btn outline sm" onClick={async () => { if (user) { await notificationService.markAllRead(user.id); await refresh(); } }}>
              <Icon name="check" size={14} />Đánh dấu tất cả đã đọc
            </button>
          </>
        } />
      <div className="card">
        {list.length === 0 && <EmptyState icon="bell" text="Không có thông báo nào" />}
        {list.map((n) => (
          <div key={n.id} className={'notif-item' + (n.read ? '' : ' unread')} onClick={() => open(n.id, n.link)}>
            <div className="ni-ic"><Icon name={NOTIF_ICON[n.type] ?? 'info'} size={16} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <b>{n.title}</b>
              <p>{n.body}</p>
              <small>{timeAgo(n.createdAt)}</small>
            </div>
            {!n.read && <span className="live-dot" style={{ background: 'var(--primary)', marginTop: 8 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
