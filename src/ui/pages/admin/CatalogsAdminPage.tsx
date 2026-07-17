// ============================================================
// QUẢN TRỊ DANH MỤC CHUNG (E-HSMT mục 6, 7, 8, 10)
// 4 tab: Chức vụ / Loại phiên họp / Cơ quan ban hành / Loại tài liệu.
// Bảng CRUD: thêm/sửa/xóa, bật-tắt sử dụng, sắp xếp thứ tự.
// LƯU Ý: tab "Loại tài liệu" (docType) là danh mục ĐỘC LẬP với DocFile.kind
// (main/reference/personal) — KHÔNG thay thế/đụng ngữ nghĩa kind hiện có.
// ============================================================
import React, { useMemo, useState } from 'react';
import type { CatalogItem, CatalogType } from '../../../domain/types';
import { CATALOG_TYPE } from '../../../domain/labels';
import { useApp } from '../../../store/AppContext';
import { Badge, EmptyState, Field, Icon, Modal, PageHeader } from '../../components';
import * as catalogService from '../../../services/catalogService';

const TABS: CatalogType[] = ['position', 'meetingType', 'issuingBody', 'docType'];

export default function CatalogsAdminPage() {
  const { user, s, refresh, toast } = useApp();
  const [tab, setTab] = useState<CatalogType>('position');
  const [editing, setEditing] = useState<(Partial<CatalogItem> & { type: CatalogType }) | null>(null);

  const list = useMemo(() => catalogService.catalogsByType(s.catalogs, tab), [s.catalogs, tab]);

  const save = async (data: Partial<CatalogItem> & { type: CatalogType }) => {
    try {
      await catalogService.saveCatalog(user!, data);
      await refresh();
      setEditing(null);
      toast(data.id ? 'Đã cập nhật danh mục' : 'Đã thêm mục danh mục');
    } catch (ex) { toast((ex as Error).message, 'error'); }
  };

  const toggle = async (item: CatalogItem) => {
    try { await catalogService.toggleCatalog(user!, item); await refresh(); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  const del = async (item: CatalogItem) => {
    if (!window.confirm(`Xóa "${item.name}" khỏi danh mục?`)) return;
    try { await catalogService.removeCatalog(user!, item); await refresh(); toast('Đã xóa mục danh mục'); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Quản trị danh mục"
        subtitle="Danh mục dùng chung: chức vụ, loại phiên họp, cơ quan ban hành"
        actions={<button className="btn" onClick={() => setEditing({ type: tab, active: true, order: (list.at(-1)?.order ?? 0) + 1 })}>
          <Icon name="plus" size={15} />Thêm {CATALOG_TYPE[tab].label.toLowerCase()}
        </button>} />

      <div className="tabs">
        {TABS.map((tp) => (
          <button key={tp} className={'tab' + (tab === tp ? ' active' : '')} onClick={() => setTab(tp)}>
            <Icon name="list" size={15} />{CATALOG_TYPE[tp].label}
            <Badge color="gray">{catalogService.catalogsByType(s.catalogs, tp).length}</Badge>
          </button>
        ))}
      </div>

      <div className="card">
        {list.length === 0 && <EmptyState icon="list" text={`Chưa có ${CATALOG_TYPE[tab].label.toLowerCase()} nào`} />}
        {list.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th style={{ width: 70 }}>Thứ tự</th><th>Tên</th><th>Mô tả</th><th style={{ width: 120 }}>Trạng thái</th><th style={{ width: 110 }}></th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.order ?? 99}</td>
                    <td className="t-title">{c.name}</td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{c.description || '—'}</td>
                    <td>
                      <Badge color={c.active === false ? 'gray' : 'green'}>{c.active === false ? 'Ngừng dùng' : 'Đang dùng'}</Badge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="icon-btn" title={c.active === false ? 'Bật sử dụng' : 'Tắt sử dụng'} onClick={() => toggle(c)}><Icon name={c.active === false ? 'eye' : 'lock'} size={15} /></button>
                        <button className="icon-btn" title="Sửa" onClick={() => setEditing(c)}><Icon name="edit" size={15} /></button>
                        <button className="icon-btn" title="Xóa" onClick={() => del(c)}><Icon name="trash" size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? `Cập nhật ${CATALOG_TYPE[editing.type].label.toLowerCase()}` : `Thêm ${CATALOG_TYPE[editing.type].label.toLowerCase()}`}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn outline" onClick={() => setEditing(null)}>Hủy</button>
            <button className="btn" disabled={!editing.name?.trim()} onClick={() => save(editing)}>Lưu</button>
          </>}>
          <Field label="Tên" required>
            <input className="inp" value={editing.name ?? ''} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <Field label="Mô tả">
            <input className="inp" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </Field>
          <div className="form-row">
            <Field label="Thứ tự hiển thị">
              <input className="inp" type="number" value={editing.order ?? 99} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} />
            </Field>
            <label className="checkline" style={{ marginTop: 26 }}>
              <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Đang sử dụng (hiện trong dropdown nghiệp vụ)
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
