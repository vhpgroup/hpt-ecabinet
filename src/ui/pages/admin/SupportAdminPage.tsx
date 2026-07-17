// ============================================================
// QUẢN TRỊ HỖ TRỢ & PHẢN HỒI — danh sách toàn bộ, đổi trạng thái,
// nhập nội dung trả lời (HSMT tiêu chí 5.1–5.4).
// ============================================================
import React, { useMemo, useState } from 'react';
import type { Feedback, FeedbackStatus } from '../../../domain/types';
import { useApp } from '../../../store/AppContext';
import { Badge, EmptyState, Field, Icon, Modal, PageHeader } from '../../components';
import { FEEDBACK_CATEGORY, FEEDBACK_STATUS } from '../../../domain/labels';
import * as feedbackService from '../../../services/feedbackService';
import { fmtDT, indexBy, timeAgo } from '../../format';

const STATUS_FILTERS: (FeedbackStatus | 'all')[] = ['all', 'new', 'processing', 'resolved'];

export default function SupportAdminPage() {
  const { user, s, refresh, toast } = useApp();
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');
  const [editing, setEditing] = useState<Feedback | null>(null);
  const users = indexBy(s.users);

  // Quản trị đơn vị: chỉ thấy/xử lý phản hồi TRONG ĐƠN VỊ MÌNH (mirror lọc đọc phía server);
  // Quản trị hệ thống thấy toàn bộ. (vá QA 18/07)
  const scoped = useMemo(() => (
    user?.role === 'unit_admin' ? s.feedbacks.filter((f) => f.unitId === user.unitId) : s.feedbacks
  ), [s.feedbacks, user]);

  const list = useMemo(() => {
    let arr = [...scoped];
    if (filter !== 'all') arr = arr.filter((f) => f.status === filter);
    return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [scoped, filter]);

  const counts = useMemo(() => ({
    new: scoped.filter((f) => f.status === 'new').length,
    processing: scoped.filter((f) => f.status === 'processing').length,
    resolved: scoped.filter((f) => f.status === 'resolved').length,
  }), [scoped]);

  const quickStatus = async (f: Feedback, status: FeedbackStatus) => {
    try { await feedbackService.updateFeedback(user!, f.id, { status }); await refresh(); toast('Đã cập nhật trạng thái'); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Quản trị Hỗ trợ & Phản hồi" subtitle="Danh sách phản hồi/góp ý người dùng — xử lý & trả lời" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((k) => (
          <button key={k} className={'btn sm' + (filter === k ? '' : ' outline')} onClick={() => setFilter(k)}>
            {k === 'all' ? 'Tất cả' : FEEDBACK_STATUS[k].label}
            {k !== 'all' && <Badge color="gray">{(counts as Record<string, number>)[k]}</Badge>}
          </button>
        ))}
      </div>

      <div className="card">
        {list.length === 0 && <EmptyState icon="question" text="Chưa có phản hồi nào" />}
        {list.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Người gửi</th><th>Loại</th><th>Nội dung</th><th style={{ width: 120 }}>Trạng thái</th><th>Thời gian</th><th style={{ width: 170 }}></th></tr>
              </thead>
              <tbody>
                {list.map((f) => {
                  const st = FEEDBACK_STATUS[f.status];
                  return (
                    <tr key={f.id}>
                      <td className="t-title">{users.get(f.userId)?.fullName ?? '—'}</td>
                      <td><Badge color="gray">{FEEDBACK_CATEGORY[f.category]}</Badge></td>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{f.content}</div>
                        {f.response && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 3 }}>✓ Đã trả lời</div>}
                      </td>
                      <td><Badge color={st.color}>{st.label}</Badge></td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{timeAgo(f.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {f.status !== 'processing' && (
                            <button className="icon-btn" title="Đánh dấu đang xử lý" onClick={() => quickStatus(f, 'processing')}><Icon name="clock" size={15} /></button>
                          )}
                          <button className="icon-btn" title="Trả lời / sửa trạng thái" onClick={() => setEditing(f)}><Icon name="edit" size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ResponseModal feedback={editing} senderName={users.get(editing.userId)?.fullName}
          onClose={() => setEditing(null)}
          onSubmit={async (status, response) => {
            try {
              await feedbackService.updateFeedback(user!, editing.id, { status, response: response || undefined });
              await refresh();
              setEditing(null);
              toast('Đã cập nhật phản hồi');
            } catch (ex) { toast((ex as Error).message, 'error'); }
          }} />
      )}
    </div>
  );
}

function ResponseModal({ feedback, senderName, onClose, onSubmit }: {
  feedback: Feedback; senderName?: string;
  onClose: () => void;
  onSubmit: (status: FeedbackStatus, response: string) => void;
}) {
  const [status, setStatus] = useState<FeedbackStatus>(feedback.status);
  const [response, setResponse] = useState(feedback.response ?? '');

  return (
    <Modal title={`Xử lý phản hồi của ${senderName ?? '—'}`} onClose={onClose} width={560}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={() => onSubmit(status, response.trim())}>Lưu</button>
      </>}>
      <div style={{ background: '#f4f8fd', border: '1px solid #d7e5f5', borderRadius: 9, padding: '10px 13px', marginBottom: 12, fontSize: 13.5 }}>
        <b style={{ fontSize: 12, color: 'var(--muted)' }}>{FEEDBACK_CATEGORY[feedback.category]} · {fmtDT(feedback.createdAt)}</b>
        <p style={{ marginTop: 5, whiteSpace: 'pre-wrap' }}>{feedback.content}</p>
      </div>
      <Field label="Trạng thái">
        <select className="sel" value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
          <option value="new">Mới</option>
          <option value="processing">Đang xử lý</option>
          <option value="resolved">Đã trả lời</option>
        </select>
      </Field>
      <Field label="Nội dung trả lời">
        <textarea className="ta" style={{ minHeight: 120 }} value={response} onChange={(e) => setResponse(e.target.value)}
          placeholder="Nhập nội dung trả lời cho người dùng…" />
      </Field>
    </Modal>
  );
}
