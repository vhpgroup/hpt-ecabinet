// ============================================================
// BÁO CÁO THỐNG KÊ — hiệu quả họp không giấy
// ============================================================
import React, { useMemo } from 'react';
import { useApp } from '../../../store/AppContext';
import { BarChart, Donut, Icon, PageHeader, StatCard } from '../../components';
import { isOverdue } from '../../../services/taskService';

export default function ReportsPage() {
  const { s } = useApp();

  const stats = useMemo(() => {
    const finished = s.meetings.filter((m) => m.status === 'finished');
    // tỷ lệ tham dự các phiên đã kết thúc
    let totalP = 0; let present = 0;
    finished.forEach((m) => {
      totalP += m.participants.length;
      present += m.participants.filter((p) => p.checkedInAt).length;
    });
    const attendRate = totalP ? Math.round((present / totalP) * 100) : 0;

    // phiên họp 6 tháng gần nhất
    const months: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const count = s.meetings.filter((m) => {
        const t = new Date(m.startTime);
        return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
      }).length;
      months.push({ label: `T${d.getMonth() + 1}`, value: count });
    }

    const votes = s.votes.filter((v) => v.kind === 'vote');
    const polls = s.votes.filter((v) => v.kind === 'poll');
    const ballots = s.votes.reduce((a, v) => a + v.ballots.length, 0);

    // ước tính tiết kiệm: mỗi tài liệu ~10 trang x số đại biểu phiên họp
    let pagesSaved = 0;
    s.documents.filter((d) => d.meetingId).forEach((d) => {
      const m = s.meetings.find((x) => x.id === d.meetingId);
      pagesSaved += 10 * (m?.participants.length ?? 5);
    });
    const moneySaved = pagesSaved * 700; // ~700đ/trang in + photo

    const tasksBy = {
      done: s.tasks.filter((t) => t.status === 'done').length,
      doing: s.tasks.filter((t) => t.status === 'doing' && !isOverdue(t)).length,
      open: s.tasks.filter((t) => t.status === 'open' && !isOverdue(t)).length,
      overdue: s.tasks.filter((t) => isOverdue(t)).length,
    };

    const attendBy = {
      present, absent: totalP - present,
    };

    return { finished, attendRate, months, votes, polls, ballots, pagesSaved, moneySaved, tasksBy, attendBy };
  }, [s]);

  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

  return (
    <div>
      <PageHeader title="Báo cáo thống kê" subtitle="Hiệu quả vận hành hệ thống phòng họp không giấy" />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard icon="calendar" label="Tổng số phiên họp" value={s.meetings.length} tone="blue"
          hint={`${stats.finished.length} đã kết thúc`} />
        <StatCard icon="users" label="Tỷ lệ tham dự" value={stats.attendRate + '%'} tone="green" hint="các phiên đã kết thúc" />
        <StatCard icon="vote" label="Lượt biểu quyết / ý kiến" value={stats.ballots} tone="purple"
          hint={`${stats.votes.length} biểu quyết · ${stats.polls.length} phiếu lấy ý kiến`} />
        <StatCard icon="file" label="Trang giấy tiết kiệm" value={stats.pagesSaved.toLocaleString('vi-VN')} tone="amber"
          hint={`≈ ${vnd(stats.moneySaved)} chi phí in ấn`} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="chart" size={16} />Số phiên họp 6 tháng gần nhất</h3>
          <BarChart data={stats.months} height={170} />
        </div>
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="clipboard" size={16} />Nhiệm vụ sau họp</h3>
          <Donut label="nhiệm vụ" parts={[
            { label: 'Hoàn thành', value: stats.tasksBy.done, color: '#1d9e5f' },
            { label: 'Đang thực hiện', value: stats.tasksBy.doing, color: '#0f4c92' },
            { label: 'Chưa thực hiện', value: stats.tasksBy.open, color: '#94a3b8' },
            { label: 'Quá hạn', value: stats.tasksBy.overdue, color: '#d64545' },
          ]} />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="users" size={16} />Điểm danh các phiên đã kết thúc</h3>
          <Donut label="lượt đại biểu" parts={[
            { label: 'Có mặt', value: stats.attendBy.present, color: '#1d9e5f' },
            { label: 'Vắng / không điểm danh', value: stats.attendBy.absent, color: '#d97706' },
          ]} />
        </div>
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="info" size={16} />Hiệu quả chuyển đổi số</h3>
          <table style={{ fontSize: 13.5, width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Tài liệu điện tử phát hành', `${s.documents.length} tài liệu`],
                ['Giấy mời điện tử đã gửi', `${s.meetings.filter((m) => m.invitedAt).length} phiên họp`],
                ['Biên bản ký số', `${s.meetings.filter((m) => m.minutes?.signatures.length).length} biên bản`],
                ['Thông báo tự động', `${s.notifications.length} lượt`],
                ['Bản ghi nhật ký', `${s.audit.length} bản ghi`],
              ].map(([k, v]) => (
                <tr key={k as string}>
                  <td style={{ padding: '8px 0', color: 'var(--muted)', borderBottom: '1px dashed var(--line)' }}>{k}</td>
                  <td style={{ padding: '8px 0', fontWeight: 700, color: 'var(--navy)', textAlign: 'right', borderBottom: '1px dashed var(--line)' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
