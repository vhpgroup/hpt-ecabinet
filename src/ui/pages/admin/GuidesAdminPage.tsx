// ============================================================
// QUẢN TRỊ TÀI LIỆU HƯỚNG DẪN SỬ DỤNG (E-HSMT mục 4)
// Thêm/sửa/xóa/xem HDSD: soạn nội dung hoặc tải tệp; giới hạn vai trò.
// ============================================================
import React, { useState } from 'react';
import type { GuideDoc, Role } from '../../../domain/types';
import { ROLE_LABEL } from '../../../domain/labels';
import { useApp } from '../../../store/AppContext';
import { Badge, EmptyState, Field, Icon, Modal, PageHeader } from '../../components';
import * as catalogService from '../../../services/catalogService';
import { fmtDT } from '../../format';

const ROLE_KEYS = Object.keys(ROLE_LABEL) as Role[];

export default function GuidesAdminPage() {
  const { user, s, refresh, toast } = useApp();
  const [editing, setEditing] = useState<Partial<GuideDoc> | null>(null);
  const [viewing, setViewing] = useState<GuideDoc | null>(null);

  const list = [...s.guides].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const del = async (g: GuideDoc) => {
    if (!window.confirm(`Xóa tài liệu hướng dẫn "${g.title}"?`)) return;
    try { await catalogService.removeGuide(user!, g); await refresh(); toast('Đã xóa tài liệu hướng dẫn'); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Tài liệu hướng dẫn sử dụng"
        subtitle="Soạn nội dung hoặc tải tệp HDSD; giới hạn theo vai trò người xem"
        actions={<button className="btn" onClick={() => setEditing({ roleScope: [] })}><Icon name="plus" size={15} />Thêm tài liệu</button>} />

      <div className="card card-pad">
        {list.length === 0 && <EmptyState icon="file" text="Chưa có tài liệu hướng dẫn nào" />}
        {list.map((g) => (
          <div key={g.id} className="doc-item">
            <div className="doc-ic"><Icon name={g.fileData ? 'file' : 'info'} size={17} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="doc-name" onClick={() => setViewing(g)}>{g.title}</div>
              <div className="doc-sub">
                Cập nhật {fmtDT(g.updatedAt)} ·{' '}
                {g.roleScope && g.roleScope.length > 0
                  ? `Cho: ${g.roleScope.map((r) => ROLE_LABEL[r]).join(', ')}`
                  : 'Áp dụng cho tất cả'}
                {g.fileData ? ` · Tệp: ${g.fileName ?? 'đính kèm'}` : ''}
              </div>
            </div>
            <div className="doc-acts">
              <button className="icon-btn" title="Xem" onClick={() => setViewing(g)}><Icon name="eye" size={16} /></button>
              <button className="icon-btn" title="Sửa" onClick={() => setEditing(g)}><Icon name="edit" size={16} /></button>
              <button className="icon-btn" title="Xóa" onClick={() => del(g)}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <GuideFormModal initial={editing} onClose={() => setEditing(null)}
          onDone={async () => { setEditing(null); await refresh(); toast('Đã lưu tài liệu hướng dẫn'); }} />
      )}
      {viewing && <GuideViewModal guide={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function GuideFormModal({ initial, onClose, onDone }: { initial: Partial<GuideDoc>; onClose: () => void; onDone: () => void }) {
  const { user } = useApp();
  const [title, setTitle] = useState(initial.title ?? '');
  const [mode, setMode] = useState<'text' | 'file'>(initial.fileData ? 'file' : 'text');
  const [content, setContent] = useState(initial.content ?? '');
  const [fileName, setFileName] = useState(initial.fileName ?? '');
  const [fileData, setFileData] = useState(initial.fileData ?? '');
  const [roleScope, setRoleScope] = useState<Role[]>(initial.roleScope ?? []);
  const [err, setErr] = useState('');

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { setErr('Tệp HDSD vượt giới hạn 3MB'); return; }
    const data: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error('Không đọc được tệp'));
      r.readAsDataURL(f);
    });
    setFileName(f.name); setFileData(data); setErr('');
  };

  const toggleRole = (r: Role) => setRoleScope((x) => x.includes(r) ? x.filter((y) => y !== r) : [...x, r]);

  const submit = async () => {
    setErr('');
    if (!title.trim()) return setErr('Nhập tiêu đề tài liệu hướng dẫn');
    if (mode === 'text' && !content.trim()) return setErr('Nhập nội dung hoặc chuyển sang tải tệp');
    if (mode === 'file' && !fileData) return setErr('Chọn tệp để tải lên');
    try {
      await catalogService.saveGuide(user!, {
        id: initial.id, title: title.trim(),
        // giữ đúng 1 dạng nội dung theo lựa chọn (xóa dạng còn lại)
        content: mode === 'text' ? content : undefined,
        fileName: mode === 'file' ? fileName : undefined,
        fileData: mode === 'file' ? fileData : undefined,
        roleScope,
      });
      onDone();
    } catch (ex) { setErr((ex as Error).message); }
  };

  return (
    <Modal title={initial.id ? 'Cập nhật tài liệu hướng dẫn' : 'Thêm tài liệu hướng dẫn'} onClose={onClose} width={640}
      footer={<>
        {err && <span style={{ color: 'var(--red)', fontSize: 13, marginRight: 'auto' }}>{err}</span>}
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={submit}>Lưu</button>
      </>}>
      <Field label="Tiêu đề" required><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
        <button className={'btn sm' + (mode === 'text' ? '' : ' outline')} onClick={() => setMode('text')}>Soạn nội dung</button>
        <button className={'btn sm' + (mode === 'file' ? '' : ' outline')} onClick={() => setMode('file')}>Tải tệp lên</button>
      </div>
      {mode === 'text' ? (
        <Field label="Nội dung"><textarea className="ta" style={{ minHeight: 180 }} value={content} onChange={(e) => setContent(e.target.value)} /></Field>
      ) : (
        <Field label="Tệp hướng dẫn (PDF, ảnh… ≤ 3MB)">
          <input type="file" className="inp" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          {fileData && <span style={{ fontSize: 12, color: 'var(--green)' }}>Đã chọn: {fileName}</span>}
        </Field>
      )}
      <Field label="Phạm vi vai trò (bỏ trống = áp dụng cho tất cả)">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px' }}>
          {ROLE_KEYS.map((r) => (
            <label className="checkline" key={r} style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={roleScope.includes(r)} onChange={() => toggleRole(r)} />
              {ROLE_LABEL[r]}
            </label>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

function GuideViewModal({ guide, onClose }: { guide: GuideDoc; onClose: () => void }) {
  const download = () => {
    const a = document.createElement('a');
    a.href = guide.fileData!;
    a.download = guide.fileName ?? guide.title;
    a.click();
  };
  return (
    <Modal title={guide.title} onClose={onClose} width={800}>
      {guide.fileData ? (
        guide.fileData.startsWith('data:application/pdf') ? (
          <iframe className="doc-frame" src={guide.fileData} title={guide.title} />
        ) : guide.fileData.startsWith('data:image/') ? (
          <img src={guide.fileData} alt={guide.title} style={{ maxWidth: '100%', borderRadius: 6 }} />
        ) : (
          <div className="empty"><Icon name="file" size={28} /><p>Không xem trước được định dạng này.</p>
            <button className="btn outline sm" onClick={download}><Icon name="download" size={14} />Tải xuống</button></div>
        )
      ) : (
        <div className="doc-viewer"><div className="doc-page">{guide.content}</div></div>
      )}
    </Modal>
  );
}
