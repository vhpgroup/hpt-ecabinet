// ============================================================
// NHIỆM VỤ SAU HỌP — theo dõi thực hiện kết luận, chỉ đạo
// ============================================================
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { Badge, EmptyState, Icon, PageHeader, ProgressBar, StatCard } from '../components';
import { TASK_STATUS } from '../../domain/labels';
import { can } from '../../services/authService';
import * as taskService from '../../services/taskService';
import { fmtDate, indexBy } from '../format';
import { TaskCreateModal } from './MeetingDetailPage';

export default function TasksPage() {
  const { user, s, refresh, toast } = useApp();
  const [filter, setFilter] = useState<'all' | 'mine' | 'overdue' | 'done'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const users = indexBy(s.users);
  const meetings = indexBy(s.meetings);

  const list = useMemo(() => {
    let arr = [...s.tasks];
    if (filter === 'mine') arr = arr.filter((t) => t.assigneeId === user?.id);
    if (filter === 'overdue') arr = arr.filter((t) => taskService.isOverdue(t));
    if (filter === 'done') arr = arr.filter((t) => t.status === 'done');
    return arr.sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [s.tasks, filter, user]);

  const stats = {
    total: s.tasks.length,
    doing: s.tasks.filter((t) => t.status === 'doing').length,
    overdue: s.tasks.filter((t) => taskService.isOverdue(t)).length,
    done: s.tasks.filter((t) => t.status === 'done').length,
  };

  const setProgress = async (id: string, p: number) => {
    await taskService.updateTaskProgress(user!, id, p);
    await refresh();
    if (p >= 100) toast('Nhiệm vụ đã hoàn thành 🎉');
  };

  return (
    <div>
      <PageHeader title="Nhiệm vụ sau họp" subtitle="Theo dõi tiến độ thực hiện kết luận, chỉ đạo sau các phiên họp"
        actions={can.manageMeetings(user) && <button className="btn" onClick={() => setAddOpen(true)}><Icon name="plus" size={15} />Giao nhiệm vụ</button>} />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard icon="clipboard" label="Tổng nhiệm vụ" value={stats.total} tone="blue" />
        <StatCard icon="clock" label="Đang thực hiện" value={stats.doing} tone="amber" />
        <StatCard icon="info" label="Quá hạn" value={stats.overdue} tone="red" />
        <StatCard icon="check" label="Hoàn thành" value={stats.done} tone="green" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([['all', 'Tất cả'], ['mine', 'Của tôi'], ['overdue', 'Quá hạn'], ['done', 'Hoàn thành']] as const).map(([k, l]) => (
          <button key={k} className={'btn sm' + (filter === k ? '' : ' outline')} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="card">
        {list.length === 0 && <EmptyState icon="clipboard" text="Không có nhiệm vụ nào" />}
        <div className="tbl-wrap">
          {list.length > 0 && (
            <table className="tbl">
              <thead><tr><th style={{ width: '34%' }}>Nhiệm vụ</th><th>Từ phiên họp</th><th>Người phụ trách</th><th>Hạn xử lý</th><th style={{ width: 190 }}>Tiến độ</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {list.map((t) => {
                  const stt = TASK_STATUS[t.status];
                  const overdue = taskService.isOverdue(t);
                  const canUpdate = t.assigneeId === user?.id || can.manageMeetings(user);
                  return (
                    <tr key={t.id}>
                      <td><div className="t-title">{t.title}</div>{t.description && <div className="t-sub">{t.description}</div>}</td>
                      <td style={{ fontSize: 12.5 }}>
                        {t.meetingId
                          ? <Link to={`/meetings/${t.meetingId}`}>{meetings.get(t.meetingId)?.title ?? '—'}</Link>
                          : <span className="t-sub">Chỉ đạo trực tiếp</span>}
                      </td>
                      <td>{users.get(t.assigneeId)?.fullName ?? '—'}</td>
                      <td style={{ color: overdue ? 'var(--red)' : undefined, fontWeight: overdue ? 700 : 400 }}>{fmtDate(t.deadline)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {canUpdate && t.status !== 'done' ? (
                            <input type="range" min={0} max={100} step={5} value={t.progress}
                              onChange={(e) => setProgress(t.id, Number(e.target.value))}
                              style={{ flex: 1, accentColor: 'var(--primary)' }} />
                          ) : (
                            <ProgressBar value={t.progress} />
                          )}
                          <span style={{ fontSize: 12, minWidth: 34 }}>{t.progress}%</span>
                        </div>
                      </td>
                      <td><Badge color={overdue ? 'red' : stt.color}>{overdue ? 'Quá hạn' : stt.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {addOpen && <TaskCreateModal onClose={() => setAddOpen(false)} onDone={async () => { setAddOpen(false); await refresh(); toast('Đã giao nhiệm vụ'); }} />}
    </div>
  );
}
