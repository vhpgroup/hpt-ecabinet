// ============================================================
// QUẢN TRỊ "API & TÍCH HỢP" (RỔ B — E-HSMT mục 54–59)
// 3 tab:
//  1. Khóa API      : bảng khóa + tạo/thu hồi/kích hoạt/xóa; key thô hiện 1 lần.
//  2. Danh mục API  : mô tả 6+2 endpoint (quản lý mô tả API — mục 58) + ví dụ curl
//                     + tải OpenAPI JSON.
//  3. Đấu nối LGSP   : hướng dẫn mô hình đấu nối + checklist thông tin cần cấp.
// CHỈ Quản trị hệ thống (route bảo vệ bằng RequireAdmin).
// ============================================================
import React, { useMemo, useState } from 'react';
import type { ApiKey, ApiScope, User } from '../../../domain/types';
import { API_CATALOG, API_ENDPOINT_COUNT, buildOpenApiSpecClient, OPEN_API_BASE } from '../../../domain/apiCatalog';
import { useApp } from '../../../store/AppContext';
import { db } from '../../../data/db';
import { Badge, EmptyState, Field, Icon, Modal, PageHeader } from '../../components';
import { fmtDT, downloadTextFile } from '../../format';
import * as apiKeyService from '../../../services/apiKeyService';

type Tab = 'keys' | 'catalog' | 'lgsp';

const SCOPE_LABEL: Record<ApiScope, string> = {
  meetings: 'Cuộc họp',
  documents: 'Tài liệu',
};

export default function ApiAdminPage() {
  const { user, s, refresh, toast } = useApp();
  const [tab, setTab] = useState<Tab>('keys');

  return (
    <div>
      <PageHeader title="API & Tích hợp"
        subtitle="Công bố API chia sẻ dữ liệu cuộc họp cho hệ thống bên thứ 3 (E-HSMT mục 54–59), sẵn sàng đấu nối LGSP" />

      {!db.remote && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 14, borderLeft: '3px solid var(--amber, #d97706)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="info" size={16} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Bản demo trình duyệt: khóa API quản lý trên máy cục bộ để minh họa. <b>Open API chỉ phục vụ ở chế độ máy chủ</b> (cần đặt VITE_API_URL khi triển khai).
          </span>
        </div>
      )}

      <div className="tabs">
        <button className={'tab' + (tab === 'keys' ? ' active' : '')} onClick={() => setTab('keys')}>
          <Icon name="lock" size={15} />Khóa API<Badge color="gray">{s.apiKeys.length}</Badge>
        </button>
        <button className={'tab' + (tab === 'catalog' ? ' active' : '')} onClick={() => setTab('catalog')}>
          <Icon name="list" size={15} />Danh mục API<Badge color="gray">{API_ENDPOINT_COUNT}</Badge>
        </button>
        <button className={'tab' + (tab === 'lgsp' ? ' active' : '')} onClick={() => setTab('lgsp')}>
          <Icon name="share" size={15} />Đấu nối LGSP
        </button>
      </div>

      {tab === 'keys' && <KeysTab user={user!} keys={s.apiKeys} refresh={refresh} toast={toast} />}
      {tab === 'catalog' && <CatalogTab sampleKey={s.apiKeys[0]?.prefix} />}
      {tab === 'lgsp' && <LgspTab />}
    </div>
  );
}

// ------------------------------------------------------------
// TAB 1 — KHÓA API
// ------------------------------------------------------------
function KeysTab({ user, keys, refresh, toast }: {
  user: User;
  keys: ApiKey[];
  refresh: () => Promise<void>;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ name: string; scopes: ApiScope[]; note: string }>({ name: '', scopes: ['meetings'], note: '' });
  const [newKey, setNewKey] = useState<string | null>(null); // key thô hiện 1 lần

  const sorted = useMemo(
    () => keys.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [keys],
  );

  const toggleScope = (sc: ApiScope) =>
    setForm((f) => ({ ...f, scopes: f.scopes.includes(sc) ? f.scopes.filter((x) => x !== sc) : [...f.scopes, sc] }));

  const doCreate = async () => {
    try {
      const res = await apiKeyService.createApiKey(user, { name: form.name, scopes: form.scopes, note: form.note });
      await refresh();
      setNewKey(res.key);
      setCreating(false);
      setForm({ name: '', scopes: ['meetings'], note: '' });
      toast('Đã tạo khóa API — sao chép và lưu lại ngay', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const doRevoke = async (k: ApiKey) => {
    if (!window.confirm(`Thu hồi khóa API "${k.name}"? Hệ thống bên thứ 3 sẽ không gọi được nữa.`)) return;
    try { await apiKeyService.revokeApiKey(user, k); await refresh(); toast('Đã thu hồi khóa API'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const doEnable = async (k: ApiKey) => {
    try { await apiKeyService.enableApiKey(user, k); await refresh(); toast('Đã kích hoạt lại khóa API'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const doRemove = async (k: ApiKey) => {
    if (!window.confirm(`Xóa vĩnh viễn khóa API "${k.name}"?`)) return;
    try { await apiKeyService.removeApiKey(user, k); await refresh(); toast('Đã xóa khóa API'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Đã sao chép vào bộ nhớ tạm'); }
    catch { toast('Không sao chép được — hãy chọn và sao chép thủ công', 'error'); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn" onClick={() => { setCreating(true); setNewKey(null); }}>
          <Icon name="plus" size={15} />Tạo khóa API
        </button>
      </div>

      <div className="card">
        {sorted.length === 0 && <EmptyState icon="lock" text="Chưa cấp khóa API nào cho hệ thống bên thứ 3" />}
        {sorted.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tên hệ thống</th>
                  <th style={{ width: 130 }}>Prefix</th>
                  <th style={{ width: 150 }}>Phạm vi</th>
                  <th style={{ width: 110 }}>Trạng thái</th>
                  <th style={{ width: 160 }}>Lần dùng cuối</th>
                  <th style={{ width: 90 }}>Lượt gọi</th>
                  <th style={{ width: 130 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((k) => (
                  <tr key={k.id}>
                    <td className="t-title">
                      {k.name}
                      {k.note && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>{k.note}</div>}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{k.prefix}…</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(k.scopes ?? []).map((sc) => <Badge key={sc} color="blue">{SCOPE_LABEL[sc] ?? sc}</Badge>)}
                      </div>
                    </td>
                    <td><Badge color={k.active ? 'green' : 'red'}>{k.active ? 'Hoạt động' : 'Đã thu hồi'}</Badge></td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{k.lastUsedAt ? fmtDT(k.lastUsedAt) : 'Chưa dùng'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{k.callCount ?? 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {k.active
                          ? <button className="icon-btn" title="Thu hồi" onClick={() => doRevoke(k)}><Icon name="lock" size={15} /></button>
                          : <button className="icon-btn" title="Kích hoạt lại" onClick={() => doEnable(k)}><Icon name="eye" size={15} /></button>}
                        <button className="icon-btn" title="Xóa" onClick={() => doRemove(k)}><Icon name="trash" size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal tạo khóa */}
      {creating && (
        <Modal title="Tạo khóa API mới" onClose={() => setCreating(false)}
          footer={<>
            <button className="btn outline" onClick={() => setCreating(false)}>Hủy</button>
            <button className="btn" disabled={!form.name.trim() || form.scopes.length === 0} onClick={doCreate}>Tạo khóa</button>
          </>}>
          <Field label="Tên hệ thống / đơn vị tích hợp" required>
            <input className="inp" autoFocus value={form.name} placeholder="VD: Hệ thống Quản lý văn bản tỉnh"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phạm vi (scope)" required>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {(['meetings', 'documents'] as ApiScope[]).map((sc) => (
                <label key={sc} className="checkline">
                  <input type="checkbox" checked={form.scopes.includes(sc)} onChange={() => toggleScope(sc)} />
                  {SCOPE_LABEL[sc]} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({sc})</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Ghi chú">
            <input className="inp" value={form.note} placeholder="VD: môi trường sản xuất; đầu mối: phòng CNTT"
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </Modal>
      )}

      {/* Modal hiển thị KEY THÔ 1 lần */}
      {newKey && (
        <Modal title="Khóa API mới — sao chép ngay" onClose={() => setNewKey(null)} width={620}
          footer={<button className="btn" onClick={() => setNewKey(null)}>Tôi đã lưu khóa</button>}>
          <div className="card" style={{ padding: '10px 14px', marginBottom: 14, borderLeft: '3px solid var(--red, #d64545)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="lock" size={16} />
            <span style={{ fontSize: 13 }}>
              Đây là <b>lần duy nhất</b> khóa được hiển thị đầy đủ. Hệ thống chỉ lưu bản băm (SHA-256) — không thể xem lại key thô. Hãy sao chép và cấp cho đơn vị vận hành, lưu bảo mật.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, padding: '10px 12px', background: 'var(--bg2, #f1f5f9)', borderRadius: 8, fontSize: 14, wordBreak: 'break-all' }}>{newKey}</code>
            <button className="btn outline" onClick={() => copy(newKey)}><Icon name="clipboard" size={15} />Sao chép</button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>
            Sử dụng: gửi header <code>X-API-Key: {newKey.slice(0, 12)}…</code> khi gọi các endpoint <code>{OPEN_API_BASE}/…</code>
          </p>
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------
// TAB 2 — DANH MỤC API (quản lý mô tả API — mục 58)
// ------------------------------------------------------------
function CatalogTab({ sampleKey }: { sampleKey?: string }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const keyExample = sampleKey ? `${sampleKey}...` : 'ecab_...';

  const downloadSpec = () => {
    if (db.remote) {
      // chế độ máy chủ: mở /spec trực tiếp (server tự sinh, đầy đủ schema)
      window.open(`${OPEN_API_BASE}/spec`, '_blank', 'noopener');
      return;
    }
    // demo: sinh client-side
    const spec = buildOpenApiSpecClient(origin || '/');
    downloadTextFile('ecabinet-openapi.json', JSON.stringify(spec, null, 2), 'application/json;charset=utf-8');
  };

  const curlSample = `curl -H "X-API-Key: ${keyExample}" \\
  "${origin}${OPEN_API_BASE}/units/un-vp/meetings/upcoming?page=1&size=20"`;

  return (
    <>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <b style={{ fontSize: 14 }}>Đặc tả OpenAPI 3.0</b>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
            Dùng để đăng ký dịch vụ chia sẻ trên LGSP hoặc nạp vào Swagger/Postman.
            {db.remote ? ' Bản đầy đủ tại /api/open/v1/spec (công khai).' : ' Bản demo sinh từ danh mục dưới đây.'}
          </p>
        </div>
        <button className="btn outline" onClick={downloadSpec}><Icon name="download" size={15} />Tải OpenAPI (JSON)</button>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Mục</th>
                <th style={{ width: 60 }}>PT</th>
                <th>Đường dẫn & mô tả</th>
                <th style={{ width: 110 }}>Quyền</th>
                <th>Tham số</th>
              </tr>
            </thead>
            <tbody>
              {API_CATALOG.map((e) => (
                <tr key={e.id}>
                  <td><Badge color="navy">{e.hsmtItem}</Badge></td>
                  <td><Badge color="green">{e.method}</Badge></td>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{e.path}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}><b>{e.summary}.</b> {e.description}</div>
                  </td>
                  <td>{e.scope ? <Badge color="blue">{SCOPE_LABEL[e.scope]}</Badge> : <Badge color="gray">—</Badge>}</td>
                  <td style={{ fontSize: 12.5 }}>
                    {e.params.length === 0 ? <span style={{ color: 'var(--muted)' }}>Không</span> : (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {e.params.map((p) => (
                          <li key={p.name}>
                            <code>{p.name}</code> <span style={{ color: 'var(--muted)' }}>({p.in}{p.required ? ', bắt buộc' : ''})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <h3 className="card-title" style={{ marginTop: 0 }}><Icon name="file" size={16} />Ví dụ gọi (curl)</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Xác thực bằng header <code>X-API-Key</code> (hoặc <code>Authorization: ApiKey &lt;key&gt;</code>).</p>
        <pre style={{ background: 'var(--bg2, #0f172a)', color: '#e2e8f0', padding: 14, borderRadius: 8, overflowX: 'auto', fontSize: 13 }}>{curlSample}</pre>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 0 }}>
          Phản hồi JSON UTF-8, thời gian ISO 8601, phân trang <code>?page</code>/<code>?size</code> (tối đa 100/trang).
        </p>
      </div>
    </>
  );
}

// ------------------------------------------------------------
// TAB 3 — ĐẤU NỐI LGSP (nội dung tĩnh)
// ------------------------------------------------------------
function LgspTab() {
  return (
    <div className="card" style={{ padding: 20, lineHeight: 1.65, fontSize: 14 }}>
      <h3 style={{ marginTop: 0 }}>Mô hình đấu nối qua LGSP</h3>
      <p style={{ color: 'var(--muted)' }}>
        Nền tảng tích hợp và chia sẻ dữ liệu (LGSP) của thành phố gọi các API REST công bố của eCabinet theo chuẩn HTTP/JSON,
        xác thực bằng khóa API. eCabinet đóng vai trò dịch vụ cung cấp dữ liệu cuộc họp cho các hệ thống liên quan
        (E-HSMT mục 54–59).
      </p>
      <ol style={{ paddingLeft: 20 }}>
        <li>LGSP (hoặc hệ thống bên thứ 3) gọi REST đến <code>{OPEN_API_BASE}/…</code> kèm header <code>X-API-Key</code>.</li>
        <li>Đặc tả <b>OpenAPI 3.0</b> tại <code>{OPEN_API_BASE}/spec</code> để đăng ký dịch vụ chia sẻ trên LGSP.</li>
        <li>Khuyến nghị giới hạn IP (<b>IP allowlist</b>) cho dải địa chỉ của LGSP tại reverse proxy (nginx) trước ứng dụng.</li>
        <li><b>TLS bắt buộc</b> (HTTPS) trên toàn tuyến; không truyền khóa API qua kênh không mã hóa.</li>
        <li>Giới hạn tần suất (rate-limit) áp theo từng khóa (mặc định 120 lượt/phút, cấu hình qua <code>OPEN_RATE_MAX</code>).</li>
      </ol>

      <h3>Bảo mật & phạm vi dữ liệu</h3>
      <ul style={{ paddingLeft: 20 }}>
        <li>Khóa API lưu dưới dạng băm SHA-256; key thô chỉ hiển thị 1 lần lúc tạo.</li>
        <li>API tài liệu chỉ trả tài liệu <b>đã duyệt</b> và <b>không mật</b>; không lộ biên bản, kết luận chi tiết hay phiếu biểu quyết cá nhân.</li>
        <li>Mỗi khóa có phạm vi (scope) riêng: <b>Cuộc họp</b> và/hoặc <b>Tài liệu</b>; có thể thu hồi tức thời.</li>
      </ul>

      <h3>Checklist thông tin cấp cho đơn vị vận hành LGSP</h3>
      <ul style={{ paddingLeft: 20 }}>
        <li>URL gốc dịch vụ (base URL) và đường dẫn OpenAPI <code>{OPEN_API_BASE}/spec</code>.</li>
        <li>Khóa API (key thô) tương ứng phạm vi cần dùng — cấp qua kênh bảo mật.</li>
        <li>Danh sách dải IP của LGSP để cấu hình allowlist ở reverse proxy.</li>
        <li>Đầu mối kỹ thuật hai bên (liên hệ khi sự cố / gia hạn / thu hồi khóa).</li>
        <li>Chính sách tần suất gọi và mức giới hạn đã cấu hình.</li>
      </ul>
    </div>
  );
}
