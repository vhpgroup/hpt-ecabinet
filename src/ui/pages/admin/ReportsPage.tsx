// ============================================================
// BÁO CÁO THỐNG KÊ — hiệu quả họp không giấy
// E-HSMT mục 52: chọn khoảng thời gian tùy chỉnh (thay khung cố định 6 tháng) + xuất CSV.
// E-HSMT mục 48/53 (mobile 92/97): tab "Thống kê ý kiến văn bản" — tổng hợp theo
// TỪNG văn bản xin ý kiến (số người được xin/đã-chưa cho ý kiến/phân bố phương án)
// + tổng hợp toàn cục theo thời gian + xuất CSV.
// ============================================================
import React, { useMemo, useState } from 'react';
import { useApp } from '../../../store/AppContext';
import { BarChart, Donut, Icon, PageHeader, StatCard } from '../../components';
import { isOverdue } from '../../../services/taskService';
import * as voteService from '../../../services/voteService';
import { downloadTextFile, fmtDate, indexBy, toCsv } from '../../format';
import { VOTE_STATUS } from '../../../domain/labels';

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function ReportsPage() {
  const [tab, setTab] = useState<'ops' | 'polls'>('ops');
  return (
    <div>
      <PageHeader title="Báo cáo thống kê" subtitle="Hiệu quả vận hành hệ thống & thống kê ý kiến văn bản xin ý kiến" />
      <div className="tabs">
        <button className={'tab' + (tab === 'ops' ? ' active' : '')} onClick={() => setTab('ops')}>
          <Icon name="chart" size={15} />Hiệu quả vận hành
        </button>
        <button className={'tab' + (tab === 'polls' ? ' active' : '')} onClick={() => setTab('polls')}>
          <Icon name="vote" size={15} />Thống kê ý kiến văn bản
        </button>
      </div>
      {tab === 'ops' ? <OpsReportTab /> : <PollStatsTab />}
    </div>
  );
}

function OpsReportTab() {
  const { s, toast } = useApp();
  const defaultFrom = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1); return isoDate(d); }, []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(isoDate(new Date()));

  const stats = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : -Infinity;
    const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : Infinity;
    const inRange = (iso: string) => { const t = new Date(iso).getTime(); return t >= fromMs && t <= toMs; };

    const meetingsInRange = s.meetings.filter((m) => inRange(m.startTime));
    const finished = meetingsInRange.filter((m) => m.status === 'finished');
    // tỷ lệ tham dự các phiên đã kết thúc (trong khoảng lọc)
    let totalP = 0; let present = 0;
    finished.forEach((m) => {
      totalP += m.participants.length;
      present += m.participants.filter((p) => p.checkedInAt).length;
    });
    const attendRate = totalP ? Math.round((present / totalP) * 100) : 0;

    // phiên họp theo tháng, TRONG khoảng [from, to] đã chọn (thay cố định 6 tháng gần nhất)
    const months: { label: string; value: number }[] = [];
    if (from && to) {
      const start = new Date(from); start.setDate(1); start.setHours(0, 0, 0, 0);
      const end = new Date(to);
      let cursor = new Date(start);
      let guard = 0;
      while (cursor <= end && guard < 60) { // guard chống lặp vô hạn nếu khoảng quá lớn
        const count = s.meetings.filter((m) => {
          const t = new Date(m.startTime);
          return t.getFullYear() === cursor.getFullYear() && t.getMonth() === cursor.getMonth();
        }).length;
        months.push({ label: `T${cursor.getMonth() + 1}/${cursor.getFullYear() % 100}`, value: count });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        guard++;
      }
    }

    const votesInRange = s.votes.filter((v) => inRange(v.createdAt));
    const votes = votesInRange.filter((v) => v.kind === 'vote');
    const polls = votesInRange.filter((v) => v.kind === 'poll');
    const ballots = votesInRange.reduce((a, v) => a + v.ballots.length, 0);

    // ước tính tiết kiệm: mỗi tài liệu ~10 trang x số đại biểu phiên họp (trong khoảng lọc)
    let pagesSaved = 0;
    s.documents.filter((d) => d.meetingId && inRange(d.uploadedAt)).forEach((d) => {
      const m = s.meetings.find((x) => x.id === d.meetingId);
      pagesSaved += 10 * (m?.participants.length ?? 5);
    });
    const moneySaved = pagesSaved * 700; // ~700đ/trang in + photo

    const tasksInRange = s.tasks.filter((t) => inRange(t.createdAt));
    const tasksBy = {
      done: tasksInRange.filter((t) => t.status === 'done').length,
      doing: tasksInRange.filter((t) => t.status === 'doing' && !isOverdue(t)).length,
      open: tasksInRange.filter((t) => t.status === 'open' && !isOverdue(t)).length,
      overdue: tasksInRange.filter((t) => isOverdue(t)).length,
    };

    const attendBy = {
      present, absent: totalP - present,
    };

    const docsInRange = s.documents.filter((d) => inRange(d.uploadedAt));
    const notifInRange = s.notifications.filter((n) => inRange(n.createdAt));
    const auditInRange = s.audit.filter((a) => inRange(a.at));
    const signedMinutesInRange = meetingsInRange.filter((m) => m.minutes?.signatures.length).length;
    const invitedInRange = meetingsInRange.filter((m) => m.invitedAt).length;

    return {
      finished, attendRate, months, votes, polls, ballots, pagesSaved, moneySaved, tasksBy, attendBy,
      totalMeetings: meetingsInRange.length,
      digitalRows: [
        ['Tài liệu điện tử phát hành', `${docsInRange.length} tài liệu`],
        ['Giấy mời điện tử đã gửi', `${invitedInRange} phiên họp`],
        ['Biên bản ký số', `${signedMinutesInRange} biên bản`],
        ['Thông báo tự động', `${notifInRange.length} lượt`],
        ['Bản ghi nhật ký', `${auditInRange.length} bản ghi`],
      ] as [string, string][],
    };
  }, [s, from, to]);

  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';
  const [exporting, setExporting] = useState(false); // HSMT dòng 534: xuất báo cáo có thể chậm khi dữ liệu lớn

  const exportCsv = () => {
    setExporting(true);
    try {
      const rows: (string | number)[][] = [
        ['Tổng số phiên họp', stats.totalMeetings],
        ['Tỷ lệ tham dự (%)', stats.attendRate],
        ['Lượt biểu quyết/ý kiến', stats.ballots],
        ['Số biểu quyết trong họp', stats.votes.length],
        ['Số phiếu lấy ý kiến', stats.polls.length],
        ['Trang giấy tiết kiệm', stats.pagesSaved],
        ['Chi phí in ấn tiết kiệm (đ)', stats.moneySaved],
        ...stats.digitalRows,
      ];
      const csv = toCsv(['Chỉ tiêu', 'Giá trị'], rows);
      downloadTextFile(`baocaothongke_${from}_${to}.csv`, csv);
      toast('Đã xuất báo cáo thống kê (CSV)');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* E-HSMT mục 52: chọn khoảng thời gian tùy chỉnh + xuất báo cáo */}
      <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Từ ngày</span>
          <input type="date" className="inp" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Đến ngày</span>
          <input type="date" className="inp" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Các số liệu và biểu đồ dưới đây tính theo khoảng thời gian đã chọn.</span>
        <button className="btn outline sm" style={{ marginLeft: 'auto' }} onClick={exportCsv} disabled={exporting}>
          <Icon name="download" size={14} />{exporting ? 'Đang xuất…' : 'Xuất báo cáo (CSV)'}
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard icon="calendar" label="Tổng số phiên họp" value={stats.totalMeetings} tone="blue"
          hint={`${stats.finished.length} đã kết thúc (trong khoảng đã chọn)`} />
        <StatCard icon="users" label="Tỷ lệ tham dự" value={stats.attendRate + '%'} tone="green" hint="các phiên đã kết thúc" />
        <StatCard icon="vote" label="Lượt biểu quyết / ý kiến" value={stats.ballots} tone="purple"
          hint={`${stats.votes.length} biểu quyết · ${stats.polls.length} phiếu lấy ý kiến`} />
        <StatCard icon="file" label="Trang giấy tiết kiệm" value={stats.pagesSaved.toLocaleString('vi-VN')} tone="amber"
          hint={`≈ ${vnd(stats.moneySaved)} chi phí in ấn`} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="chart" size={16} />Số phiên họp theo tháng (khoảng đã chọn)</h3>
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
          <h3 className="card-title">
            <Icon name="info" size={16} />Hiệu quả chuyển đổi số
            <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={exportCsv} disabled={exporting} title="Xuất bảng thống kê ra CSV">
              <Icon name="download" size={13} />{exporting ? 'Đang xuất…' : 'Xuất CSV'}
            </button>
          </h3>
          <table style={{ fontSize: 13.5, width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {stats.digitalRows.map(([k, v]) => (
                <tr key={k}>
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

// ============================================================
// TAB: THỐNG KÊ Ý KIẾN VĂN BẢN (E-HSMT mục 48/53, mobile 92/97)
// Chọn khoảng thời gian; tổng hợp theo TỪNG văn bản (số người được xin ý kiến,
// đã/chưa cho ý kiến, phân bố phương án — tái dùng BarChart/Donut) + tổng hợp
// toàn cục theo thời gian; xuất CSV.
// ============================================================
function PollStatsTab() {
  const { s, toast } = useApp();
  const defaultFrom = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1); return isoDate(d); }, []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(isoDate(new Date()));
  const [selectedId, setSelectedId] = useState<string>('');
  const usersById = indexBy(s.users);

  const rows = useMemo(() => voteService.pollStatsInRange(s.votes, from, to), [s.votes, from, to]);
  const monthly = useMemo(() => voteService.pollStatsByMonth(rows), [rows]);

  const totals = useMemo(() => {
    const totalEligible = rows.reduce((a, r) => a + r.totalEligible, 0);
    const totalResponded = rows.reduce((a, r) => a + r.responded, 0);
    return {
      count: rows.length,
      totalEligible,
      totalResponded,
      totalNotResponded: rows.reduce((a, r) => a + r.notResponded, 0),
      avgResponseRate: totalEligible > 0 ? Math.round((totalResponded / totalEligible) * 100) : 0,
    };
  }, [rows]);

  const selected = rows.find((r) => r.voteId === selectedId) ?? rows[0];
  const [exporting, setExporting] = useState(false); // HSMT dòng 534: xuất báo cáo có thể chậm khi dữ liệu lớn

  const exportSummaryCsv = () => {
    if (!rows.length) { toast('Không có văn bản nào trong khoảng thời gian đã chọn', 'info'); return; }
    setExporting(true);
    try {
      const headers = ['Văn bản xin ý kiến', 'Ngày tạo', 'Trạng thái', 'Số người được xin ý kiến', 'Đã cho ý kiến', 'Chưa cho ý kiến', 'Tỷ lệ phản hồi (%)'];
      const csvRows = rows.map((r) => [
        r.title, fmtDate(r.createdAt), VOTE_STATUS[r.status].label,
        r.totalEligible, r.responded, r.notResponded, r.responseRatePercent,
      ]);
      const csv = toCsv(headers, csvRows);
      downloadTextFile(`thongke_ykienvanban_${from}_${to}.csv`, csv);
      toast('Đã xuất thống kê ý kiến văn bản (CSV)');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Từ ngày</span>
          <input type="date" className="inp" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Đến ngày</span>
          <input type="date" className="inp" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Thống kê văn bản xin ý kiến được TẠO trong khoảng thời gian đã chọn.</span>
        <button className="btn outline sm" style={{ marginLeft: 'auto' }} onClick={exportSummaryCsv} disabled={exporting}>
          <Icon name="download" size={14} />{exporting ? 'Đang xuất…' : 'Xuất CSV'}
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard icon="vote" label="Số văn bản xin ý kiến" value={totals.count} tone="blue" />
        <StatCard icon="users" label="Tổng số người được xin ý kiến" value={totals.totalEligible} tone="purple" />
        <StatCard icon="check" label="Đã cho ý kiến" value={totals.totalResponded} tone="green" hint={`${totals.avgResponseRate}% trung bình`} />
        <StatCard icon="clock" label="Chưa cho ý kiến" value={totals.totalNotResponded} tone="amber" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="chart" size={16} />Số văn bản xin ý kiến theo tháng</h3>
          {monthly.length > 0 ? <BarChart data={monthly} height={170} /> : <p style={{ fontSize: 13, color: 'var(--muted)' }}>Không có dữ liệu trong khoảng đã chọn.</p>}
        </div>
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="users" size={16} />Tổng hợp đã/chưa cho ý kiến (toàn bộ văn bản)</h3>
          <Donut label="lượt" parts={[
            { label: 'Đã cho ý kiến', value: totals.totalResponded, color: '#1d9e5f' },
            { label: 'Chưa cho ý kiến', value: totals.totalNotResponded, color: '#d97706' },
          ]} />
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 15 }}>Chi tiết theo từng văn bản ({rows.length})</h3>
        </div>
        {rows.length === 0 && <div style={{ padding: 20 }}><p style={{ fontSize: 13, color: 'var(--muted)' }}>Không có văn bản xin ý kiến nào trong khoảng thời gian đã chọn.</p></div>}
        {rows.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Văn bản xin ý kiến</th><th>Ngày tạo</th><th>Trạng thái</th>
                  <th>Được xin ý kiến</th><th>Đã cho ý kiến</th><th>Chưa cho ý kiến</th><th>Tỷ lệ</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.voteId} style={{ cursor: 'pointer', background: r.voteId === selected?.voteId ? '#f0f6fd' : undefined }}
                    onClick={() => setSelectedId(r.voteId)}>
                    <td className="t-title">{r.title}</td>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td><span className={`badge badge-${VOTE_STATUS[r.status].color}`}>{VOTE_STATUS[r.status].label}</span></td>
                    <td>{r.totalEligible}</td>
                    <td>{r.responded}</td>
                    <td>{r.notResponded}</td>
                    <td>{r.responseRatePercent}%</td>
                    <td><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setSelectedId(r.voteId); }}>Xem biểu đồ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h3 className="card-title"><Icon name="vote" size={16} />Phân bố phương án — "{selected.title}"</h3>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
            {selected.responded}/{selected.totalEligible} đã cho ý kiến ({selected.responseRatePercent}%)
            {(() => {
              const v = s.votes.find((x) => x.id === selected.voteId);
              const tracker = v?.trackerUserId ? usersById.get(v.trackerUserId)?.fullName : undefined;
              return tracker ? ` · Cán bộ theo dõi: ${tracker}` : '';
            })()}
          </p>
          {selected.optionBreakdown.some((o) => o.value > 0) ? (
            <Donut label="lượt ý kiến" parts={selected.optionBreakdown.map((o, i) => ({
              label: o.label, value: o.value,
              color: ['#1d9e5f', '#d64545', '#d97706', '#7c3aed', '#0369a1'][i % 5],
            }))} />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có ai cho ý kiến văn bản này.</p>
          )}
        </div>
      )}
    </div>
  );
}
