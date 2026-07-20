// ============================================================
// KHO TÀI LIỆU — tài liệu họp / tài liệu cá nhân (có thư mục) / chia sẻ
// + View "Đơn vị tôi chuẩn bị tài liệu" (E-HSMT mục 23).
// ============================================================
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DocFile } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Badge, EmptyState, Field, Icon, Modal, PageHeader } from '../components';
import { MEETING_STATUS } from '../../domain/labels';
import { can } from '../../services/authService';
import * as documentService from '../../services/documentService';
import * as catalogService from '../../services/catalogService';
import { indexBy } from '../format';
import { DocReviewControls, DocRow, DocViewerModal } from './shared';

const NO_FOLDER = '__nofolder__'; // sentinel cho "chưa phân thư mục"

export default function DocumentsPage() {
  const { user, s, refresh, toast } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<'meeting' | 'personal' | 'unitprep'>('meeting');
  const [q, setQ] = useState('');
  const [viewDoc, setViewDoc] = useState<DocFile | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<DocFile | null>(null);
  const [folderFilter, setFolderFilter] = useState<string>(''); // '' = tất cả
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const meetings = indexBy(s.meetings);
  const manage = can.manageMeetings(user);

  const myMeetingIds = useMemo(
    () => new Set(s.meetings.filter((m) => m.participants.some((p) => p.userId === user?.id)).map((m) => m.id)),
    [s.meetings, user],
  );

  // ----- Tài liệu cá nhân của tôi (để dựng danh sách thư mục) -----
  const myPersonalDocs = useMemo(
    () => s.documents.filter((d) => d.kind === 'personal' && (d.ownerId === user?.id || d.sharedWith.includes(user?.id ?? ''))),
    [s.documents, user],
  );
  // danh sách thư mục (từ chính tài liệu của mình) — E-HSMT mục 14
  const folders = useMemo(
    () => Array.from(new Set(myPersonalDocs.filter((d) => d.ownerId === user?.id && d.folder).map((d) => d.folder as string))).sort(),
    [myPersonalDocs, user],
  );

  const list = useMemo(() => {
    let arr = tab === 'personal'
      ? myPersonalDocs
      // E-HSMT mục 24: tài liệu phiên họp lọc theo trạng thái duyệt (owner/manage thấy mọi trạng thái)
      : documentService.visibleDocs(
          s.documents.filter((d) => d.kind !== 'personal'), myMeetingIds, user?.id ?? '', manage,
        );
    // lọc theo thư mục (chỉ tab cá nhân)
    if (tab === 'personal' && folderFilter) {
      arr = folderFilter === NO_FOLDER ? arr.filter((d) => !d.folder) : arr.filter((d) => d.folder === folderFilter);
    }
    if (q.trim()) arr = arr.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()));
    return arr.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }, [s.documents, tab, q, user, myMeetingIds, manage, myPersonalDocs, folderFilter]);

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

  const moveToFolder = async (d: DocFile, folder: string) => {
    await documentService.setDocFolder(user!, d.id, folder);
    await refresh();
    toast(folder ? `Đã chuyển vào thư mục "${folder}"` : 'Đã bỏ khỏi thư mục');
  };

  // Xóa thư mục (E-HSMT mục 14) — chỉ gỡ nhãn, KHÔNG xóa tài liệu trong thư mục.
  const removeFolder = async () => {
    if (!folderFilter || folderFilter === NO_FOLDER) return;
    const name = folderFilter;
    if (!window.confirm(`Xóa thư mục "${name}"? Các tài liệu trong thư mục sẽ được chuyển về "Chưa phân thư mục", KHÔNG bị xóa.`)) return;
    await documentService.removeFolder(user!, name);
    setFolderFilter('');
    await refresh();
    toast(`Đã xóa thư mục "${name}" (tài liệu được giữ lại)`);
  };

  return (
    <div>
      <PageHeader icon="file" title="Tài liệu" subtitle="Kho tài liệu phiên họp và tài liệu cá nhân"
        actions={<button className="btn" onClick={() => setAddOpen(true)}><Icon name="plus" size={15} />Thêm tài liệu cá nhân</button>} />

      <div className="tabs">
        <button className={'tab' + (tab === 'meeting' ? ' active' : '')} onClick={() => setTab('meeting')}>
          <Icon name="users" size={15} />Tài liệu phiên họp
        </button>
        <button className={'tab' + (tab === 'personal' ? ' active' : '')} onClick={() => setTab('personal')}>
          <Icon name="file" size={15} />Tài liệu cá nhân
        </button>
        <button className={'tab' + (tab === 'unitprep' ? ' active' : '')} onClick={() => setTab('unitprep')}>
          <Icon name="building" size={15} />Đơn vị tôi chuẩn bị
        </button>
      </div>

      {tab === 'unitprep' ? (
        <UnitPrepView onOpenMeeting={(id) => nav(`/meetings/${id}`)} onViewDoc={setViewDoc} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box" style={{ minWidth: 260 }}>
              <Icon name="search" size={15} />
              <input className="inp" placeholder="Tìm tài liệu…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {/* Bộ lọc thư mục (E-HSMT mục 14) — chỉ tab cá nhân */}
            {tab === 'personal' && (
              <>
                <select className="sel" style={{ maxWidth: 220 }} value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} title="Lọc theo thư mục">
                  <option value="">— Tất cả thư mục —</option>
                  <option value={NO_FOLDER}>Chưa phân thư mục</option>
                  {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <button className="btn outline sm" onClick={() => setNewFolderOpen(true)}><Icon name="folder" size={14} />Thư mục mới</button>
                {/* Xóa thư mục (E-HSMT mục 14) — chỉ hiện khi đang lọc theo 1 thư mục cụ thể */}
                {folderFilter && folderFilter !== NO_FOLDER && (
                  <button className="btn outline sm" title="Xóa thư mục (tài liệu được giữ lại)" onClick={removeFolder}>
                    <Icon name="trash" size={14} />Xóa thư mục
                  </button>
                )}
              </>
            )}
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
                    <DocRow doc={d} onView={setViewDoc} extra={<DocReviewControls doc={d} meeting={d.meetingId ? meetings.get(d.meetingId) : undefined} />} />
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
                        <DocReviewControls doc={d} meeting={d.meetingId ? meetings.get(d.meetingId) : undefined} />
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
                  {tab === 'personal' && d.ownerId === user?.id ? (
                    // chọn thư mục ngay tại dòng (E-HSMT mục 14 — "kéo tài liệu vào thư mục")
                    <select className="sel" style={{ height: 30, fontSize: 12 }} value={d.folder ?? ''} onChange={(e) => moveToFolder(d, e.target.value)} title="Thư mục">
                      <option value="">Chưa phân thư mục</option>
                      {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  ) : d.meetingId
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
        </>
      )}

      {viewDoc && <DocViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
      {addOpen && <PersonalDocModal folders={folders} onClose={() => setAddOpen(false)} onDone={async () => { setAddOpen(false); await refresh(); toast('Đã thêm tài liệu cá nhân'); }} />}
      {shareDoc && <ShareModal doc={shareDoc} onClose={() => setShareDoc(null)} onDone={async () => { setShareDoc(null); await refresh(); toast('Đã chia sẻ tài liệu'); }} />}
      {newFolderOpen && (
        <NewFolderModal existing={folders} onClose={() => setNewFolderOpen(false)}
          onCreate={(name) => { setNewFolderOpen(false); setFolderFilter(name); toast(`Đã tạo thư mục "${name}". Chuyển tài liệu vào bằng ô thư mục ở mỗi dòng.`, 'info'); }} />
      )}
    </div>
  );
}

// ---------------- View: Đơn vị tôi chuẩn bị tài liệu (E-HSMT mục 23) ----------------
function UnitPrepView({ onOpenMeeting, onViewDoc }: { onOpenMeeting: (id: string) => void; onViewDoc: (d: DocFile) => void }) {
  const { user, s } = useApp();
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'invited' | 'finished' | 'draft'>('all');
  const users = indexBy(s.users);
  const meetings = indexBy(s.meetings);

  // id người dùng cùng ĐƠN VỊ với tôi
  const myUnitUserIds = useMemo(
    () => new Set(s.users.filter((u) => u.unitId === user?.unitId).map((u) => u.id)),
    [s.users, user],
  );

  // gom nhóm: mỗi phiên họp có tài liệu do người thuộc đơn vị tôi trình
  const rows = useMemo(() => {
    const byMeeting = new Map<string, DocFile[]>();
    for (const d of s.documents) {
      if (!d.meetingId || d.kind === 'personal') continue;
      if (!myUnitUserIds.has(d.ownerId)) continue;
      const arr = byMeeting.get(d.meetingId) ?? [];
      arr.push(d);
      byMeeting.set(d.meetingId, arr);
    }
    let out = Array.from(byMeeting.entries())
      .map(([mid, docs]) => ({ meeting: meetings.get(mid), docs }))
      .filter((r) => r.meeting);
    if (statusFilter !== 'all') out = out.filter((r) => r.meeting!.status === statusFilter);
    return out.sort((a, b) => b.meeting!.startTime.localeCompare(a.meeting!.startTime));
  }, [s.documents, myUnitUserIds, meetings, statusFilter]);

  // đếm trạng thái duyệt để biết "còn gì chưa xong" (reviewStatus đợt 2)
  const reviewInfo = (docs: DocFile[]) => {
    const st = (d: DocFile) => d.reviewStatus ?? 'approved';
    return {
      pending: docs.filter((d) => st(d) === 'pending').length,
      rejected: docs.filter((d) => st(d) === 'rejected').length,
      draft: docs.filter((d) => st(d) === 'draft').length,
      approved: docs.filter((d) => st(d) === 'approved').length,
    };
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Phiên họp có tài liệu do đơn vị bạn phụ trách chuẩn bị. Lọc theo trạng thái:</span>
        {(['all', 'draft', 'invited', 'live', 'finished'] as const).map((k) => (
          <button key={k} className={'btn sm' + (statusFilter === k ? '' : ' outline')} onClick={() => setStatusFilter(k)}>
            {k === 'all' ? 'Tất cả' : MEETING_STATUS[k].label}
          </button>
        ))}
      </div>
      <div className="card card-pad">
        {rows.length === 0 && <EmptyState icon="building" text="Đơn vị bạn chưa chuẩn bị tài liệu cho phiên họp nào" />}
        {rows.map(({ meeting, docs }) => {
          const info = reviewInfo(docs);
          const notDone = info.pending + info.rejected + info.draft;
          const stt = MEETING_STATUS[meeting!.status];
          return (
            <div key={meeting!.id} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 14, color: 'var(--navy)', cursor: 'pointer' }} onClick={() => onOpenMeeting(meeting!.id)}>{meeting!.title}</b>
                <Badge color={stt.color}>{stt.label}</Badge>
                {notDone === 0
                  ? <Badge color="green">Đã xong ({info.approved} tài liệu đã duyệt)</Badge>
                  : <Badge color="amber">Còn {notDone} tài liệu chưa hoàn tất</Badge>}
                <span style={{ marginLeft: 'auto' }}>
                  <button className="btn ghost sm" onClick={() => onOpenMeeting(meeting!.id)}>Mở phiên họp</button>
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 8px' }}>
                Chờ duyệt: {info.pending} · Bị từ chối: {info.rejected} · Nháp: {info.draft} · Đã duyệt: {info.approved}
              </div>
              {docs.sort((a, b) => (a.name).localeCompare(b.name)).map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <DocRow doc={d} onView={onViewDoc} extra={<DocReviewControls doc={d} meeting={meeting} />} />
                  </div>
                  <div style={{ flex: 'none', width: 150, fontSize: 12, color: 'var(--muted)' }}>
                    Người trình: {users.get(d.ownerId)?.fullName ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewFolderModal({ existing, onClose, onCreate }: { existing: string[]; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  const dup = existing.includes(name.trim());
  return (
    <Modal title="Tạo thư mục tài liệu" onClose={onClose} width={420}
      footer={<>
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" disabled={!name.trim() || dup} onClick={() => onCreate(name.trim())}>Tạo thư mục</button>
      </>}>
      <Field label="Tên thư mục" required>
        <input className="inp" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="VD: Chuẩn bị họp tháng 8" />
      </Field>
      {dup && <p style={{ fontSize: 12.5, color: 'var(--red)' }}>Thư mục này đã tồn tại.</p>}
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sau khi tạo, chọn thư mục ở ô bên phải mỗi tài liệu để chuyển tài liệu vào.</p>
    </Modal>
  );
}

function PersonalDocModal({ folders, onClose, onDone }: { folders: string[]; onClose: () => void; onDone: () => void }) {
  const { user, s } = useApp();
  const [mode, setMode] = useState<'file' | 'text'>('text');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState('');
  const [docTypeId, setDocTypeId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); // HSMT dòng 534: thao tác >10s (tải tệp lớn) cần hiện đang xử lý
  const docTypes = catalogService.catalogsByType(s.catalogs, 'docType', true);

  const submit = async () => {
    if (!user) return;
    setErr('');
    setBusy(true);
    try {
      const opts = { folder: folder.trim() || undefined, docTypeId: docTypeId || undefined };
      if (mode === 'file') {
        if (!file) { setErr('Chọn tệp cần tải lên'); return; }
        await documentService.addFileDocument(user, file, 'personal', opts);
      } else {
        if (!name.trim() || !content.trim()) { setErr('Nhập tên và nội dung'); return; }
        await documentService.addTextDocument(user, name.trim(), content, 'personal', opts);
      }
      onDone();
    } catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Thêm tài liệu cá nhân" onClose={onClose}
      footer={<>
        {err && <span style={{ color: 'var(--red)', fontSize: 13, marginRight: 'auto' }}>{err}</span>}
        <button className="btn outline" onClick={onClose} disabled={busy}>Hủy</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Đang tải lên…' : 'Thêm'}</button>
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
      <div className="form-row">
        <Field label="Thư mục (tùy chọn)">
          <input className="inp" list="folder-list" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Chọn hoặc nhập thư mục mới…" />
          <datalist id="folder-list">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        </Field>
        <Field label="Loại tài liệu (tùy chọn)">
          <select className="sel" value={docTypeId} onChange={(e) => setDocTypeId(e.target.value)}>
            <option value="">— Chưa phân loại —</option>
            {docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>
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
