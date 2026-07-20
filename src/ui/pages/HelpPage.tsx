// ============================================================
// HƯỚNG DẪN SỬ DỤNG — trang trợ giúp cho NGƯỜI DÙNG THƯỜNG (E-HSMT mục 4)
// Liệt kê tài liệu HDSD áp dụng cho vai trò của người đang đăng nhập
// (đọc nội dung soạn hoặc tải tệp). Admin thấy tất cả.
// ============================================================
import React, { useMemo, useState } from 'react';
import type { GuideDoc } from '../../domain/types';
import { ROLE_LABEL } from '../../domain/labels';
import { useApp } from '../../store/AppContext';
import { EmptyState, Icon, Modal, PageHeader } from '../components';
import * as catalogService from '../../services/catalogService';
import { GuideViewBody, guideHasFile } from './shared';
import { fmtDT } from '../format';

export default function HelpPage() {
  const { user, s } = useApp();
  const [viewing, setViewing] = useState<GuideDoc | null>(null);

  const list = useMemo(
    () => catalogService.visibleGuides(s.guides, user?.role, user?.role === 'admin'),
    [s.guides, user],
  );

  return (
    <div>
      <PageHeader icon="book" title="Hướng dẫn sử dụng"
        subtitle={`Tài liệu hướng dẫn áp dụng cho vai trò ${user ? ROLE_LABEL[user.role] : ''}`} />
      <div className="card card-pad">
        {list.length === 0 && <EmptyState icon="info" text="Chưa có tài liệu hướng dẫn nào dành cho bạn" />}
        {list.map((g) => (
          <div key={g.id} className="doc-item">
            <div className="doc-ic"><Icon name={guideHasFile(g) ? 'file' : 'info'} size={17} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="doc-name" onClick={() => setViewing(g)}>{g.title}</div>
              <div className="doc-sub">Cập nhật {fmtDT(g.updatedAt)}{guideHasFile(g) ? ` · Tệp: ${g.fileName ?? 'đính kèm'}` : ''}</div>
            </div>
            <div className="doc-acts">
              <button className="icon-btn" title="Xem" onClick={() => setViewing(g)}><Icon name="eye" size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      {viewing && <HelpViewModal guide={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function HelpViewModal({ guide, onClose }: { guide: GuideDoc; onClose: () => void }) {
  const { toast } = useApp();
  return (
    <Modal title={guide.title} onClose={onClose} width={800}>
      <GuideViewBody guide={guide} toast={toast} />
    </Modal>
  );
}
