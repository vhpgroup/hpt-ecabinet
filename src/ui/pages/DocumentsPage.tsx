// ============================================================
// KHO TÀI LIỆU — tài liệu họp / tài liệu cá nhân, chia sẻ
// ============================================================
import React, { useMemo, useState } from 'react';
import type { DocFile } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Badge, EmptyState, Field, Icon, Modal, PageHeader } from '../components';
import { can } from '../../services/authService';
import * as documentService from '../../services/documentService';
import { indexBy } from '../format';
import { DocReviewControls, DocRow, DocViewerModal } from './shared';

export default function DocumentsPage() {
  const { user, s, refresh, toast } = useApp();
  const [tab, setTab] = useState<'meeting' | 'personal'>('meeting');
  const [q, setQ] = useState('');
  const [viewDoc, setViewDoc] = useState<DocFile | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<DocFile | null>(null);
  const meetings = indexBy(s.meetings);
  const manage = can.manageMeetings(user);

  const myMeetingIds = useMemo(
    () => new Set(s.meetings.filter((m) => m.participants.some((p) => p.userId === user?.id)).map((m) => m.id)),
    [s.meetings, user],
  );

  const list = useMemo(() => {
    let arr = tab === 'personal'
      ? s.documents.filter((d) => d.kind === 'personal' && (d.ownerId === user?.id || d.sharedWith.includes(user?.id ?? '')))
      // E-HSMT mục 24: tài liệu phiên họp lọc theo trạng thái duyệt (owner/manage thấy mọi trạng thái)
      : documentService.visibleDocs(
          s.documents.filter((d) => d.kind !== 'personal'), myMeetingIds, user?.id ?? '', manage,
        );
    if (q.trim()) arr = arr.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()));
    return arr.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }, [s.documents, tab, q, user, myMeetingIds, manage]);

  // Hàng đợi duyệt (chỉ quản lý): tài liệu phiên họp đang chờ duyệt
  const reviewQueue = useMemo(
    () => (manage ? s.documents.filter((d) => d.kind !== 'personal' && d.reviewStatus === 'pending') : []),
    [s.documents, manage],
  );

  const del = async (d: DocFile) => {
    if (!window.confirm(`Xóa tài liệu "${d.name}"?`)) return;
    await documentService.removeDocument(user!, d.id);
    await refresh();
    toast('Đã xóa tài liệu');
  };

  return (
    <div>
      <PageHeader title="Tài liệu" subtitle="Kho tài liệu phiên họp và tài liệu cá nhân"
        actions={<button className="btn" onClick={() => setAddOpen(true)}><Icon name="plus" size={15} />Thêm tài liệu cá nhân</button>} />

      <div className="tabs">
        <button className={'tab' + (tab === 'meeting' ? ' active' : '')} onClick={() => setTab('meeting')}>
          <Icon name="users" size={15} />Tài liệu phiên họp
        </button>
        <button className={'tab' + (tab === 'personal' ? ' active' : '')} onClick={() => setTab('personal')}>
          <Icon name="file" size={15} />Tài liệu cá nhân
        </button>
      </div>

      <div className="search-box" style={{ maxWidth: 340, marginBottom: 14 }}>
        <Icon name="search" size={15} />
        <input className="inp" placeholder="Tìm tài liệu…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Hàng đợi duyệt tài liệu (E-HSMT mục 24) — chỉ chủ trì/thư ký/admin */}
      {tab === 'meeting' && manage && reviewQueue.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: '#f3ddb3', background: '#fffaf0' }}>
          <h3 className="card-title" style={{ marginBottom: 10 }}>
            <Icon name="clock" size={16} />Tài liệu chờ duyệt <Badge color="amber">{reviewQueue.length}</Badge>
          </h3>
          {reviewQueue.map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <DocRow doc={d} onView={setViewDoc} extra={<DocReviewControls doc={d} />} />
              </div>
              <div style={{ flex: 'none', width: 200, fontSize: 12, color: 'var(--muted)' }}>
                {d.meetingId ? meetings.get(d.meetingId)?.title : 'Dùng chung'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card card-pad">
        {list.length === 0 && <EmptyState icon="file" text="Không có tài liệu nào" />}
        {list.map((d) => (
          <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <DocRow doc={d} onView={setViewDoc}
                extra={
                  <>
                    <DocReviewControls doc={d} />
                    {d.ownerId === user?.id && d.kind === 'personal' && (
                      <button className="icon-btn" title="Chia sẻ" onClick={() => setShareDoc(d)}><Icon name="share" size={16} /></button>
                    )}
                    {d.ownerId === user?.id && (
                      <button className="icon-btn" title="Xóa" onClick={() => del(d)}><Icon name="trash" size={16} /></button>
                    )}
                  </>
                } />
            </div>
            <div style={{ flex: 'none', width: 210, fontSize: 12, color: 'var(--muted)' }}>
              {d.meetingId
                ? <span>{meetings.get(d.meetingId)?.title}</span>
                : d.kind === 'personal'
                  ? <span>{d.ownerId === user?.id
                      ? (d.sharedWith.length ? `Đã chia sẻ cho ${d.sharedWith.length} người` : 'Riêng tư')
                      : <Badge color="purple">Được chia sẻ với bạn</Badge>}</span>
                  : <span>Dùng chung</span>}
            </div>
          </div>
        ))}
      </div>

      {viewDoc && <DocViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
      {addOpen && <PersonalDocModal onClose={() => setAddOpen(false)} onDone={async () => { setAddOpen(false); await refresh(); toast('Đã thêm tài liệu cá nhân'); }} />}
      {shareDoc && <ShareModal doc={shareDoc} onClose={() => setShareDoc(null)} onDone={async () => { setShareDoc(null); await refresh(); toast('Đã chia sẻ tài liệu'); }} />}
    </div>
  );
}

function PersonalDocModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user } = useApp();
  const [mode, setMode] = useState<'file' | 'text'>('text');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!user) return;
    setErr('');
    try {
      if (mode === 'file') {
        if (!file) return setErr('Chọn tệp cần tải lên');
        await documentService.addFileDocument(user, file, 'personal');
      } else {
        if (!name.trim() || !content.trim()) return setErr('Nhập tên và nội dung');
        await documentService.addTextDocument(user, name.trim(), content, 'personal');
      }
      onDone();
    } catch (ex) { setErr((ex as Error).message); }
  };

  return (
    <Modal title="Thêm tài liệu cá nhân" onClose={onClose}
      footer={<>
        {err && <span style={{ color: 'var(--red)', fontSize: 13, marginRight: 'auto' }}>{err}</span>}
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={submit}>Thêm</button>
      </>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={'btn sm' + (mode === 'text' ? '' : ' outline')} onClick={() => setMode('text')}>Soạn ghi chú / nội dung</button>
        <button className={'btn sm' + (mode === 'file' ? '' : ' outline')} onClick={() => setMode('file')}>Tải tệp lên</button>
      </div>
      {mode === 'file' ? (
        <Field label="Tệp (≤ 1,5MB)"><input type="file" className="inp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
      ) : (
        <>
          <Field label="Tên tài liệu" required><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Nội dung" required><textarea className="ta" style={{ minHeight: 150 }} value={content} onChange={(e) => setContent(e.target.value)} /></Field>
        </>
      )}
    </Modal>
  );
}

function ShareModal({ doc, onClose, onDone }: { doc: DocFile; onClose: () => void; onDone: () => void }) {
  const { user, s } = useApp();
  const [ids, setIds] = useState<string[]>([]);
  const candidates = s.users.filter((u) => u.id !== user?.id && u.status === 'active' && !doc.sharedWith.includes(u.id));

  return (
    <Modal title={`Chia sẻ "${doc.name}"`} onClose={onClose} width={480}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" disabled={!ids.length} onClick={async () => { await documentService.shareDocument(user!, doc.id, ids); onDone(); }}>
          <Icon name="share" size={15} />Chia sẻ ({ids.length})
        </button>
      </>}>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Chọn người được xem tài liệu này:</p>
      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 13px' }}>
        {candidates.map((u) => (
          <label className="checkline" key={u.id}>
            <input type="checkbox" checked={ids.includes(u.id)}
              onChange={() => setIds((x) => x.includes(u.id) ? x.filter((y) => y !== u.id) : [...x, u.id])} />
            {u.fullName} <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>— {u.title}</span>
          </label>
        ))}
        {candidates.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Đã chia sẻ với tất cả mọi người.</p>}
      </div>
    </Modal>
  );
}
