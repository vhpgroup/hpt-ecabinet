// ============================================================
// DÙNG CHUNG GIỮA CÁC TRANG — trình xem tài liệu + dòng tài liệu
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import type { DocFile, GuideDoc, Meeting } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Badge, Field, Icon, Modal } from '../components';
import { DOC_REVIEW } from '../../domain/labels';
import { can } from '../../services/authService';
import * as documentService from '../../services/documentService';
import { getDocContentUrl, getGuideContentUrl, revokeDocContent, revokeGuideContent, type FileContent } from '../../services/fileContent';
import { downloadTextFile, fmtDT, fmtSize, indexBy, timeAgo, toCsv } from '../format';

/** Nhãn loại tài liệu (E-HSMT mục 8) — tra theo docTypeId trên danh mục catalogs. */
function useDocTypeLabel(docTypeId?: string): string | undefined {
  const { s } = useApp();
  if (!docTypeId) return undefined;
  return s.catalogs.find((c) => c.id === docTypeId && c.type === 'docType')?.name;
}

export function DocViewerModal({ doc, onClose }: { doc: DocFile; onClose: () => void }) {
  const { user, s, refresh, toast } = useApp();
  const [note, setNote] = useState('');
  const [noteMode, setNoteMode] = useState<'private' | 'public'>('private');
  const users = indexBy(s.users);
  const docTypeLabel = useDocTypeLabel(doc.docTypeId);

  // ĐỢT 3 — nội dung tệp lấy qua helper (dataUrl sẵn -> dùng thẳng; contentUrl -> fetch có auth
  // -> Blob -> objectURL; fallback ?mode=stream). Tài liệu soạn tay (content) -> content = null.
  const [content, setContent] = useState<FileContent | null>(null);
  const [loadingFile, setLoadingFile] = useState<boolean>(!!doc.contentUrl && !doc.dataUrl);
  const [fileErr, setFileErr] = useState(false);

  useEffect(() => {
    let alive = true;
    // Chỉ cần tải khi có contentUrl (đã externalize) và chưa có dataUrl sẵn.
    if (!doc.contentUrl || doc.dataUrl) {
      setContent(doc.dataUrl ? { url: doc.dataUrl, isObjectUrl: false, mime: doc.mime } : null);
      setLoadingFile(false);
      setFileErr(false);
      return;
    }
    setLoadingFile(true);
    setFileErr(false);
    getDocContentUrl(doc)
      .then((fc) => { if (alive) { setContent(fc); setLoadingFile(false); } })
      .catch(() => { if (alive) { setFileErr(true); setLoadingFile(false); } });
    return () => {
      alive = false;
      revokeDocContent(doc); // dọn objectURL khi đóng/đổi tài liệu (tránh rò bộ nhớ)
    };
  }, [doc.id, doc.version, doc.contentUrl, doc.dataUrl, doc.mime]);

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

  const download = async () => {
    const a = document.createElement('a');
    if (content?.url) {
      // dataUrl base64 (cũ/demo) hoặc objectURL (đã fetch từ S3) — cùng dùng làm href tải.
      a.href = content.url;
    } else if (doc.contentUrl) {
      // Chưa tải xong / lỗi trước đó: thử lấy nội dung ngay lúc bấm tải.
      try {
        const fc = await getDocContentUrl(doc);
        if (fc?.url) a.href = fc.url;
        else return;
      } catch {
        toast('Không tải được tệp từ kho lưu trữ — vui lòng thử lại', 'error');
        return;
      }
    } else {
      // Tài liệu soạn tay: tải nội dung văn bản.
      a.href = URL.createObjectURL(new Blob([doc.content ?? ''], { type: 'text/plain;charset=utf-8' }));
    }
    a.download = doc.name;
    a.click();
  };

  // Thử tải lại nội dung tệp (nút "Thử tải trực tiếp" khi fetch lỗi — vd MinIO chưa mở CORS).
  const retryLoad = () => {
    if (!doc.contentUrl) return;
    setFileErr(false);
    setLoadingFile(true);
    getDocContentUrl(doc)
      .then((fc) => { setContent(fc); setLoadingFile(false); if (!fc) setFileErr(true); })
      .catch(() => { setFileErr(true); setLoadingFile(false); toast('Vẫn không tải được tệp — kiểm tra kết nối kho lưu trữ (MinIO/CORS)', 'error'); });
  };

  // E-HSMT mục 31: "Xuất ý kiến tài liệu" — xuất góp ý công khai ra CSV (client-side)
  const exportComments = () => {
    if (!publicAnnos.length) { toast('Tài liệu chưa có góp ý công khai để xuất', 'info'); return; }
    const rows = [...publicAnnos]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((a, i) => [i + 1, users.get(a.userId)?.fullName ?? '—', fmtDT(a.createdAt), a.content]);
    const csv = toCsv(['STT', 'Người góp ý', 'Thời gian', 'Nội dung góp ý'], rows);
    const safe = doc.name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 60);
    downloadTextFile(`gopy_${safe}.csv`, csv);
    toast('Đã xuất ý kiến tài liệu (CSV)');
  };

  return (
    <Modal title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{doc.name}{doc.secret && <Badge color="red">Mật</Badge>}</span>}
      onClose={onClose} width={860}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Người tải lên: <b>{users.get(doc.ownerId)?.fullName ?? '—'}</b> · {timeAgo(doc.uploadedAt)} · {fmtSize(doc.size)} · phiên bản {doc.version}
          {doc.issuingBody && <> · Cơ quan ban hành: <b>{doc.issuingBody}</b></>}
          {docTypeLabel && <> · Loại tài liệu: <b>{docTypeLabel}</b></>}
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn outline sm" onClick={download}><Icon name="download" size={14} />Tải xuống</button>
      </div>

      {(doc.contentUrl || doc.dataUrl) ? (
        // Tài liệu là TỆP: nội dung lấy qua helper (content.url = dataUrl hoặc objectURL của Blob).
        loadingFile ? (
          <div className="empty"><Icon name="clock" size={28} /><p>Đang tải nội dung tệp…</p></div>
        ) : fileErr ? (
          <div className="empty">
            <Icon name="file" size={28} />
            <p>Không tải được nội dung tệp từ kho lưu trữ.</p>
            <button className="btn outline sm" onClick={retryLoad}><Icon name="download" size={14} />Thử tải trực tiếp</button>
          </div>
        ) : content?.url ? (
          doc.mime.startsWith('image/') ? (
            <div className="doc-viewer"><img src={content.url} alt={doc.name} style={{ maxWidth: '100%', borderRadius: 6, display: 'block', margin: '0 auto' }} /></div>
          ) : doc.mime === 'application/pdf' ? (
            <iframe className="doc-frame" src={content.url} title={doc.name} />
          ) : (
            <div className="empty"><Icon name="file" size={28} /><p>Không xem trước được định dạng này — hãy tải xuống.</p></div>
          )
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
          {publicAnnos.length > 0 && (
            <button className="btn outline sm" style={{ marginLeft: 'auto' }} onClick={exportComments} title="Xuất góp ý ra tệp CSV">
              <Icon name="download" size={13} />Xuất ý kiến
            </button>
          )}
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
  const docTypeLabel = useDocTypeLabel(doc.docTypeId);
  return (
    <div className="doc-item">
      <div className={'doc-ic' + (doc.mime.includes('word') || doc.mime.includes('msword') ? ' word' : '')}>
        <Icon name="file" size={17} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="doc-name" onClick={() => onView(doc)}>
          {doc.name} {doc.secret && <Badge color="red">Mật</Badge>} <DocReviewBadge doc={doc} />
          {docTypeLabel && <Badge color="gray">{docTypeLabel}</Badge>}
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
 * - Quản lý (chủ trì/thư ký/admin) TOÀN HỆ THỐNG: "Duyệt" / "Từ chối" khi đang chờ duyệt.
 * - V2 (P1-1 dungthu-tester.md + BA mục 1(d), HSMT dòng 356-358 "Thành viên dự họp thực
 *   hiện duyệt"): THÀNH VIÊN của CHÍNH phiên chứa tài liệu (chairId/secretaryId/participant
 *   của `doc.meetingId`) cũng thấy nút Duyệt/Từ chối — mirror `canReviewDocumentAsMeetingMember`
 *   phía backend (guard.js). Người trình (owner) KHÔNG được tự duyệt dù họ CÓ là thành phần
 *   phiên đó (khớp guard server: `!isOwner` luôn được kiểm riêng khỏi điều kiện thành phần).
 *   `meeting` (OPTIONAL) = bản ghi phiên họp chứa `doc.meetingId`; truyền `undefined` khi
 *   gọi ở nơi không có sẵn meeting (vd DocumentsPage tab tài liệu cá nhân/dùng chung) — khi
 *   đó chỉ MANAGE toàn cục mới duyệt được (đúng hành vi cũ, tài liệu không gắn phiên không
 *   có "thành phần" để xét).
 */
export function DocReviewControls({ doc, meeting, onChanged }: { doc: DocFile; meeting?: Meeting; onChanged?: () => void }) {
  const { user, refresh, toast } = useApp();
  const [rejectOpen, setRejectOpen] = useState(false);
  if (!user) return null;
  const st = doc.reviewStatus ?? 'approved';
  const isOwner = doc.ownerId === user.id;
  const manage = can.manageMeetings(user);
  const isMeetingMember = !!meeting && meeting.id === doc.meetingId && (
    user.id === meeting.chairId || user.id === meeting.secretaryId
    || meeting.participants.some((p) => p.userId === user.id)
  );
  // người trình KHÔNG được tự duyệt dù có là thành phần phiên (mirror guard.js: !isOwner)
  const canApprove = (manage || isMeetingMember) && !isOwner;

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
      {canApprove && st === 'pending' && (
        <>
          <button className="btn success sm" onClick={() => act(() => documentService.approveDocument(user, doc, meeting), 'Đã duyệt tài liệu')}>
            <Icon name="check" size={13} />Duyệt
          </button>
          <button className="btn danger sm" onClick={() => setRejectOpen(true)}>
            <Icon name="x" size={13} />Từ chối
          </button>
        </>
      )}
      {rejectOpen && (
        <RejectModal onClose={() => setRejectOpen(false)}
          onSubmit={(note) => act(async () => { await documentService.rejectDocument(user, doc, note, meeting); setRejectOpen(false); }, 'Đã từ chối — yêu cầu đơn vị làm lại')} />
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

// ============================================================
// XEM TÀI LIỆU HƯỚNG DẪN (HDSD) — dùng chung GuidesAdminPage + HelpPage (ĐỢT 3).
// Cùng cơ chế đường XEM như DocViewerModal: fileData sẵn (demo/cũ) -> dùng thẳng; contentUrl
// (đã externalize S3) -> fetch có auth -> Blob -> objectURL; fallback ?mode=stream; dọn objectURL.
// ============================================================

/** Guide có TỆP đính kèm không (fileData base64 cũ HOẶC contentUrl đã externalize). */
export function guideHasFile(g: GuideDoc): boolean {
  return !!g.fileData || !!g.contentUrl;
}

/** Suy loại xem trước cho guide: ưu tiên mime của Blob, fallback theo đuôi fileName/dataUrl. */
function guidePreviewKind(g: GuideDoc, mime?: string): 'pdf' | 'image' | 'other' {
  const m = (mime || '').toLowerCase();
  if (m === 'application/pdf' || (g.fileData?.startsWith('data:application/pdf'))) return 'pdf';
  if (m.startsWith('image/') || (g.fileData?.startsWith('data:image/'))) return 'image';
  const name = (g.fileName || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(name)) return 'image';
  return 'other';
}

/** Thân xem 1 guide (tệp qua helper hoặc nội dung văn bản). toast: hàm hiện thông báo lỗi. */
export function GuideViewBody({ guide, toast }: { guide: GuideDoc; toast?: (m: string, t?: 'info' | 'error') => void }) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState<boolean>(!!guide.contentUrl && !guide.fileData);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!guide.contentUrl || guide.fileData) {
      setContent(guide.fileData ? { url: guide.fileData, isObjectUrl: false } : null);
      setLoading(false); setErr(false);
      return;
    }
    setLoading(true); setErr(false);
    getGuideContentUrl(guide)
      .then((fc) => { if (alive) { setContent(fc); setLoading(false); } })
      .catch(() => { if (alive) { setErr(true); setLoading(false); } });
    return () => { alive = false; revokeGuideContent(guide); };
  }, [guide.id, guide.updatedAt, guide.contentUrl, guide.fileData]);

  const download = async () => {
    const a = document.createElement('a');
    let href = content?.url;
    if (!href && guide.contentUrl) {
      try { href = (await getGuideContentUrl(guide))?.url; }
      catch { toast?.('Không tải được tệp hướng dẫn — vui lòng thử lại', 'error'); return; }
    }
    if (!href) return;
    a.href = href;
    a.download = guide.fileName ?? guide.title;
    a.click();
  };

  const retry = () => {
    if (!guide.contentUrl) return;
    setErr(false); setLoading(true);
    getGuideContentUrl(guide)
      .then((fc) => { setContent(fc); setLoading(false); if (!fc) setErr(true); })
      .catch(() => { setErr(true); setLoading(false); toast?.('Vẫn không tải được tệp (kiểm tra kết nối kho lưu trữ / CORS)', 'error'); });
  };

  if (!guideHasFile(guide)) {
    return <div className="doc-viewer"><div className="doc-page">{guide.content}</div></div>;
  }
  if (loading) return <div className="empty"><Icon name="clock" size={28} /><p>Đang tải nội dung tệp…</p></div>;
  if (err) {
    return (
      <div className="empty">
        <Icon name="file" size={28} /><p>Không tải được nội dung tệp từ kho lưu trữ.</p>
        <button className="btn outline sm" onClick={retry}><Icon name="download" size={14} />Thử tải trực tiếp</button>
      </div>
    );
  }
  const kind = guidePreviewKind(guide, content?.mime);
  if (content?.url && kind === 'pdf') return <iframe className="doc-frame" src={content.url} title={guide.title} />;
  if (content?.url && kind === 'image') return <img src={content.url} alt={guide.title} style={{ maxWidth: '100%', borderRadius: 6 }} />;
  return (
    <div className="empty"><Icon name="file" size={28} /><p>Không xem trước được định dạng này.</p>
      <button className="btn outline sm" onClick={download}><Icon name="download" size={14} />Tải xuống</button></div>
  );
}
