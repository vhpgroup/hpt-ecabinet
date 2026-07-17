// ============================================================
// DÙNG CHUNG GIỮA CÁC TRANG — trình xem tài liệu + dòng tài liệu
// ============================================================
import React, { useMemo, useState } from 'react';
import type { DocFile } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Badge, Field, Icon, Modal } from '../components';
import { DOC_REVIEW } from '../../domain/labels';
import { can } from '../../services/authService';
import * as documentService from '../../services/documentService';
import { fmtSize, indexBy, timeAgo } from '../format';

export function DocViewerModal({ doc, onClose }: { doc: DocFile; onClose: () => void }) {
  const { user, s, refresh, toast } = useApp();
  const [note, setNote] = useState('');
  const [noteMode, setNoteMode] = useState<'private' | 'public'>('private');
  const users = indexBy(s.users);
  const myAnnos = useMemo(
    () => s.annotations.filter((a) => a.docId === doc.id && a.userId === user?.id && !a.isPublic)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s.annotations, doc.id, user],
  );
  const publicAnnos = useMemo(
    () => s.annotations.filter((a) => a.docId === doc.id && a.isPublic)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s.annotations, doc.id],
  );

  const addNote = async () => {
    if (!user || !note.trim()) return;
    await documentService.addAnnotation(user, doc.id, note.trim(), noteMode === 'public');
    setNote('');
    await refresh();
    toast(noteMode === 'public' ? 'Đã gửi góp ý công khai' : 'Đã lưu ghi chú cá nhân');
  };

  const download = () => {
    const a = document.createElement('a');
    if (doc.dataUrl) {
      a.href = doc.dataUrl;
    } else {
      a.href = URL.createObjectURL(new Blob([doc.content ?? ''], { type: 'text/plain;charset=utf-8' }));
    }
    a.download = doc.name;
    a.click();
  };

  return (
    <Modal title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{doc.name}{doc.secret && <Badge color="red">Mật</Badge>}</span>}
      onClose={onClose} width={860}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Người tải lên: <b>{users.get(doc.ownerId)?.fullName ?? '—'}</b> · {timeAgo(doc.uploadedAt)} · {fmtSize(doc.size)} · phiên bản {doc.version}
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn outline sm" onClick={download}><Icon name="download" size={14} />Tải xuống</button>
      </div>

      {doc.dataUrl ? (
        doc.mime.startsWith('image/') ? (
          <div className="doc-viewer"><img src={doc.dataUrl} alt={doc.name} style={{ maxWidth: '100%', borderRadius: 6, display: 'block', margin: '0 auto' }} /></div>
        ) : doc.mime === 'application/pdf' ? (
          <iframe className="doc-frame" src={doc.dataUrl} title={doc.name} />
        ) : (
          <div className="empty"><Icon name="file" size={28} /><p>Không xem trước được định dạng này — hãy tải xuống.</p></div>
        )
      ) : (
        <div className="doc-viewer"><div className="doc-page">{doc.content}</div></div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select className="sel" style={{ width: 175, flex: 'none' }} value={noteMode}
            onChange={(e) => setNoteMode(e.target.value as 'private' | 'public')} title="Phạm vi">
            <option value="private">Ghi chú cá nhân</option>
            <option value="public">Góp ý công khai</option>
          </select>
          <input className="inp" placeholder={noteMode === 'public' ? 'Góp ý nội dung tài liệu (mọi đại biểu cùng xem)…' : 'Thêm ghi chú riêng của bạn…'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()} />
          <button className="btn" onClick={addNote}><Icon name="send" size={15} /></button>
        </div>

        <h4 style={{ fontSize: 13.5, marginBottom: 8, display: 'flex', gap: 7, alignItems: 'center' }}>
          <Icon name="chat" size={15} />Góp ý công khai ({publicAnnos.length})
        </h4>
        {publicAnnos.map((a) => (
          <div className="anno" key={a.id} style={{ borderLeftColor: 'var(--primary)', background: '#f0f6fd' }}>
            {a.content}
            <small>
              <b>{users.get(a.userId)?.fullName ?? '—'}</b> · {timeAgo(a.createdAt)}
              {a.userId === user?.id && <> · <a style={{ cursor: 'pointer' }} onClick={async () => { await documentService.removeAnnotation(a.id); await refresh(); }}>Xóa</a></>}
            </small>
          </div>
        ))}
        {publicAnnos.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>Chưa có góp ý công khai nào.</p>}

        <h4 style={{ fontSize: 13.5, margin: '14px 0 8px', display: 'flex', gap: 7, alignItems: 'center' }}>
          <Icon name="pen" size={15} />Ghi chú cá nhân <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(chỉ mình bạn thấy)</span>
        </h4>
        {myAnnos.map((a) => (
          <div className="anno" key={a.id}>
            {a.content}
            <small>{timeAgo(a.createdAt)} · <a style={{ cursor: 'pointer' }} onClick={async () => { await documentService.removeAnnotation(a.id); await refresh(); }}>Xóa</a></small>
          </div>
        ))}
        {myAnnos.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Chưa có ghi chú nào.</p>}
      </div>
    </Modal>
  );
}

export function DocRow({ doc, onView, extra }: { doc: DocFile; onView: (d: DocFile) => void; extra?: React.ReactNode }) {
  return (
    <div className="doc-item">
      <div className={'doc-ic' + (doc.mime.includes('word') || doc.mime.includes('msword') ? ' word' : '')}>
        <Icon name="file" size={17} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="doc-name" onClick={() => onView(doc)}>
          {doc.name} {doc.secret && <Badge color="red">Mật</Badge>} <DocReviewBadge doc={doc} />
        </div>
        <div className="doc-sub">{fmtSize(doc.size)} · {timeAgo(doc.uploadedAt)} · v{doc.version}</div>
      </div>
      <div className="doc-acts">
        <button className="icon-btn" title="Xem tài liệu" onClick={() => onView(doc)}><Icon name="eye" size={16} /></button>
        {extra}
      </div>
    </div>
  );
}

// ============================================================
// QUY TRÌNH TRÌNH–DUYỆT TÀI LIỆU (E-HSMT mục 24) — hiển thị & thao tác
// ============================================================

/** Huy hiệu trạng thái duyệt. undefined/'approved' của tài liệu cá nhân -> không hiện (tránh nhiễu). */
export function DocReviewBadge({ doc }: { doc: DocFile }) {
  const st = doc.reviewStatus;
  if (!st || st === 'approved') return null; // đã duyệt (mặc định) — không cần badge
  const info = DOC_REVIEW[st];
  return (
    <span title={st === 'rejected' && doc.reviewNote ? `Lý do từ chối: ${doc.reviewNote}` : info.label}>
      <Badge color={info.color}>{info.label}</Badge>
    </span>
  );
}

/**
 * Nút thao tác duyệt tài liệu dùng chung (DocumentsPage + tab tài liệu phiên họp):
 * - Người trình (owner): "Trình duyệt" khi nháp/bị từ chối.
 * - Quản lý (chủ trì/thư ký/admin): "Duyệt" / "Từ chối" khi đang chờ duyệt.
 */
export function DocReviewControls({ doc, onChanged }: { doc: DocFile; onChanged?: () => void }) {
  const { user, refresh, toast } = useApp();
  const [rejectOpen, setRejectOpen] = useState(false);
  if (!user) return null;
  const st = doc.reviewStatus ?? 'approved';
  const isOwner = doc.ownerId === user.id;
  const manage = can.manageMeetings(user);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); await refresh(); onChanged?.(); toast(msg); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  return (
    <>
      {isOwner && (st === 'draft' || st === 'rejected') && (
        <button className="btn outline sm" title="Trình tài liệu lên để duyệt"
          onClick={() => act(() => documentService.submitForReview(user, doc), 'Đã trình tài liệu chờ duyệt')}>
          <Icon name="send" size={13} />Trình duyệt
        </button>
      )}
      {manage && st === 'pending' && (
        <>
          <button className="btn success sm" onClick={() => act(() => documentService.approveDocument(user, doc), 'Đã duyệt tài liệu')}>
            <Icon name="check" size={13} />Duyệt
          </button>
          <button className="btn danger sm" onClick={() => setRejectOpen(true)}>
            <Icon name="x" size={13} />Từ chối
          </button>
        </>
      )}
      {rejectOpen && (
        <RejectModal onClose={() => setRejectOpen(false)}
          onSubmit={(note) => act(async () => { await documentService.rejectDocument(user, doc, note); setRejectOpen(false); }, 'Đã từ chối — yêu cầu đơn vị làm lại')} />
      )}
    </>
  );
}

function RejectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Modal title="Từ chối tài liệu" onClose={onClose} width={440}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn danger" disabled={!note.trim()} onClick={() => onSubmit(note.trim())}>Từ chối tài liệu</button>
      </>}>
      <Field label="Lý do từ chối (để đơn vị làm lại)" required>
        <textarea className="ta" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="VD: Thiếu phụ lục số liệu; đề nghị bổ sung căn cứ pháp lý…" />
      </Field>
    </Modal>
  );
}
