// ============================================================
// HỖ TRỢ & PHẢN HỒI — module Phản hồi/Góp ý người dùng
// (HSMT tiêu chí 5.1–5.4 "Sự hài lòng người sử dụng").
// Form gửi phản hồi + danh sách phản hồi của tôi + trạng thái/trả lời +
// thông tin kênh hỗ trợ (hotline/email).
// ============================================================
import React, { useMemo, useState } from 'react';
import type { FeedbackCategory } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Badge, EmptyState, Field, Icon, PageHeader } from '../components';
import { FEEDBACK_CATEGORY, FEEDBACK_STATUS, SUPPORT_CHANNELS } from '../../domain/labels';
import * as feedbackService from '../../services/feedbackService';
import { fmtDT, timeAgo } from '../format';

const CATEGORIES: FeedbackCategory[] = ['bug', 'feature', 'question', 'other'];

export default function SupportPage() {
  const { user, s, refresh, toast } = useApp();
  const [category, setCategory] = useState<FeedbackCategory>('question');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const mine = useMemo(() => feedbackService.myFeedbacks(s.feedbacks, user?.id ?? ''), [s.feedbacks, user]);

  const submit = async () => {
    if (!user || !content.trim()) return;
    setSending(true);
    try {
      await feedbackService.submitFeedback(user, category, content);
      setContent('');
      await refresh();
      toast('Đã gửi phản hồi/góp ý — cảm ơn bạn');
    } catch (ex) {
      toast((ex as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader icon="question" title="Hỗ trợ & Phản hồi" subtitle="Gửi góp ý, báo lỗi hoặc câu hỏi tới bộ phận hỗ trợ" />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          <h3 className="card-title"><Icon name="send" size={16} />Gửi phản hồi mới</h3>
          <Field label="Loại phản hồi">
            <select className="sel" value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{FEEDBACK_CATEGORY[c]}</option>)}
            </select>
          </Field>
          <Field label="Nội dung" required>
            <textarea className="ta" style={{ minHeight: 130 }} value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Mô tả chi tiết vấn đề, đề xuất hoặc câu hỏi của bạn…" />
          </Field>
          <button className="btn" disabled={!content.trim() || sending} onClick={submit}>
            <Icon name="send" size={15} />Gửi phản hồi
          </button>
        </div>

        <div className="card card-pad">
          <h3 className="card-title"><Icon name="info" size={16} />Kênh hỗ trợ</h3>
          <table style={{ fontSize: 13.5, width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.values(SUPPORT_CHANNELS).map((c) => (
                <tr key={c.label}>
                  <td style={{ padding: '7px 0', color: 'var(--muted)', borderBottom: '1px dashed var(--line)' }}>{c.label}</td>
                  <td style={{ padding: '7px 0', fontWeight: 700, color: 'var(--navy)', textAlign: 'right', borderBottom: '1px dashed var(--line)' }}>{c.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            Bạn cũng có thể gửi phản hồi trực tiếp trong ứng dụng qua form bên trái — bộ phận hỗ trợ sẽ trả lời và cập nhật trạng thái ngay tại đây.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 15 }}>Phản hồi của tôi ({mine.length})</h3>
        </div>
        {mine.length === 0 && <EmptyState icon="question" text="Bạn chưa gửi phản hồi nào" />}
        <div style={{ padding: mine.length ? '10px 16px' : 0 }}>
          {mine.map((f) => {
            const st = FEEDBACK_STATUS[f.status];
            return (
              <div key={f.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge color="gray">{FEEDBACK_CATEGORY[f.category]}</Badge>
                  <Badge color={st.color}>{st.label}</Badge>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{timeAgo(f.createdAt)}</span>
                </div>
                <p style={{ fontSize: 13.5, marginTop: 6 }}>{f.content}</p>
                {f.response && (
                  <div style={{ marginTop: 6, background: '#f0f6fd', border: '1px solid #d7e5f5', borderRadius: 9, padding: '8px 12px' }}>
                    <b style={{ fontSize: 12, color: 'var(--primary)' }}>Trả lời từ bộ phận hỗ trợ:</b>
                    <p style={{ fontSize: 13, marginTop: 3 }}>{f.response}</p>
                    <small style={{ color: 'var(--muted)' }}>{fmtDT(f.updatedAt)}</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
