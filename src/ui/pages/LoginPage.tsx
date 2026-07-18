// ============================================================
// ĐĂNG NHẬP — mô phỏng (chọn nhanh tài khoản demo)
// ============================================================
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { Icon } from '../components';
import { ROLE_LABEL } from '../../domain/labels';
import {
  getServerUrl, setServerUrl, normalizeServerUrl, isLocalBuild,
} from '../../data/apiBase';

// ------------------------------------------------------------
// PANEL "ĐỔI MÁY CHỦ" — cấu hình địa chỉ máy chủ LÚC CHẠY.
// Cần cho app native (Capacitor) vì app khác origin với máy chủ:
// người dùng nhập URL máy chủ, kiểm tra, lưu rồi khởi động lại app.
// Trên web cùng origin panel vẫn dùng được (đổi sang máy chủ khác).
// ------------------------------------------------------------
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: unknown }).Capacitor;
}

function ServerPanel({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState(getServerUrl() ?? '');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean; msg: string }>(null);

  const check = async () => {
    setResult(null);
    const norm = normalizeServerUrl(url);
    if (!norm) { setResult({ ok: false, msg: 'Vui lòng nhập địa chỉ máy chủ' }); return; }
    // /health nằm ở GỐC máy chủ (không kèm /api) — lấy origin từ base đã chuẩn hóa
    const origin = norm.replace(/\/api$/i, '');
    setChecking(true);
    try {
      const res = await fetch(origin + '/health', { method: 'GET' });
      setResult(res.ok
        ? { ok: true, msg: `Kết nối được (${origin})` }
        : { ok: false, msg: `Máy chủ trả lỗi HTTP ${res.status}` });
    } catch {
      setResult({ ok: false, msg: 'Không kết nối được — kiểm tra URL, mạng hoặc HTTPS' });
    } finally {
      setChecking(false);
    }
  };

  const saveAndConnect = () => {
    const norm = normalizeServerUrl(url);
    if (!norm) { setResult({ ok: false, msg: 'Vui lòng nhập địa chỉ máy chủ' }); return; }
    setServerUrl(url);          // chuẩn hóa + lưu localStorage['ecabinet.serverUrl']
    location.reload();          // khởi động lại app -> db.ts chọn REST adapter theo URL mới
  };

  const backToDemo = () => {
    setServerUrl(null);         // xóa serverUrl -> quay lại LocalStorageAdapter (demo)
    location.reload();
  };

  const current = getServerUrl();

  return (
    <div className="srv-panel">
      <div className="srv-panel-head">
        <b><Icon name="settings" size={15} /> Kết nối máy chủ</b>
        <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Đóng"><Icon name="x" size={14} /></button>
      </div>
      <p className="srv-hint">
        Nhập địa chỉ máy chủ eCabinet của cơ quan. Ứng dụng sẽ kết nối tới máy chủ này
        cho đăng nhập, tài liệu và cập nhật thời gian thực.
      </p>
      <label className="field">
        <span className="field-label">Địa chỉ máy chủ</span>
        <input
          className="inp"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setResult(null); }}
          placeholder="https://ecabinet.example.gov.vn"
          autoComplete="url"
          inputMode="url"
          spellCheck={false}
        />
      </label>
      {url && (
        <div className="srv-preview">Sẽ gọi API tại: <code>{normalizeServerUrl(url) || '—'}</code></div>
      )}
      {result && (
        <p className={'srv-result ' + (result.ok ? 'ok' : 'bad')}>
          <Icon name={result.ok ? 'check' : 'x'} size={13} /> {result.msg}
        </p>
      )}
      <div className="srv-actions">
        <button type="button" className="btn outline sm" onClick={check} disabled={checking}>
          {checking ? 'Đang kiểm tra…' : 'Kiểm tra'}
        </button>
        <button type="button" className="btn sm" onClick={saveAndConnect}>Lưu &amp; kết nối</button>
        {isLocalBuild() && current && (
          <button type="button" className="btn ghost sm" onClick={backToDemo}>Về chế độ cục bộ (không máy chủ)</button>
        )}
      </div>
      {current && <div className="srv-current">Đang trỏ: <code>{current}</code></div>}
    </div>
  );
}

const QUICK_ACCOUNTS = [
  { username: 'chutich', name: 'Trần Đại Nghĩa', role: 'Chủ tịch UBND tỉnh — Chủ trì' },
  { username: 'thuky', name: 'Phạm Văn Thư', role: 'Chánh Văn phòng — Thư ký' },
  { username: 'phochutich', name: 'Lê Minh Khuê', role: 'Phó Chủ tịch UBND tỉnh' },
  { username: 'sokhdt', name: 'Nguyễn Hoài An', role: 'GĐ Sở KH&ĐT — Đại biểu' },
  { username: 'sotc', name: 'Vũ Thị Hồng', role: 'GĐ Sở Tài chính — Đại biểu' },
  { username: 'quantri', name: 'Đỗ Quang Trị', role: 'Quản trị hệ thống' },
];

export default function LoginPage() {
  const { user, login, ready } = useApp();
  const nav = useNavigate();
  const [username, setUsername] = useState('chutich');
  const [password, setPassword] = useState('123456');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Panel đổi máy chủ TỰ MỞ trong app native khi chưa cấu hình máy chủ.
  const [showServer, setShowServer] = useState(() => isCapacitor() && !getServerUrl());

  if (ready && user) return <Navigate to="/" replace />;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(username, password);
      nav('/');
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="lb-logo">
          <div className="sb-logo">eC</div>
          <div>
            <b style={{ color: '#fff', fontSize: 19 }}>eCabinet</b>
            <div style={{ fontSize: 12, color: '#a9bdd8' }}>Hệ thống phòng họp không giấy</div>
          </div>
        </div>
        <h1>Phòng họp không giấy cho chính quyền số</h1>
        <p className="lead">
          Toàn bộ vòng đời phiên họp trên một nền tảng: giấy mời — tài liệu — điểm danh —
          phát biểu — biểu quyết — biên bản ký số — nhiệm vụ sau họp.
        </p>
        <div className="login-feats">
          <div><span className="fi"><Icon name="vote" size={17} /></span>Biểu quyết, lấy ý kiến điện tử — tổng hợp kết quả tức thời</div>
          <div><span className="fi"><Icon name="file" size={17} /></span>Tài liệu tập trung, ghi chú cá nhân, chia sẻ có kiểm soát</div>
          <div><span className="fi"><Icon name="pen" size={17} /></span>Biên bản điện tử, ký số, lưu vết đầy đủ</div>
          <div><span className="fi"><Icon name="clipboard" size={17} /></span>Theo dõi nhiệm vụ, kết luận sau phiên họp</div>
        </div>
        <div className="lb-foot">
          Bản trình diễn — dữ liệu mẫu lưu cục bộ tại trình duyệt; phiên bản triển khai kết nối máy chủ tập trung
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card card">
          <div className="card-pad">
            <h2>Đăng nhập hệ thống</h2>
            <p className="sub">Chọn nhanh một tài khoản dùng thử hoặc nhập thông tin đăng nhập.</p>
            <div className="acct-grid">
              {QUICK_ACCOUNTS.map((a) => (
                <button key={a.username} type="button"
                  className={'acct-chip' + (username === a.username ? ' active' : '')}
                  onClick={() => { setUsername(a.username); setPassword('123456'); }}>
                  <div>
                    <b>{a.name}</b>
                    <span>{a.role}</span>
                  </div>
                </button>
              ))}
            </div>
            <form onSubmit={submit}>
              <label className="field">
                <span className="field-label">Tên đăng nhập</span>
                <input className="inp" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </label>
              <label className="field">
                <span className="field-label">Mật khẩu</span>
                <input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </label>
              {err && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{err}</p>}
              <button className="btn lg" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
                {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </button>
            </form>
            <p className="login-hint">Mật khẩu dùng thử cho mọi tài khoản: <b>123456</b> · Vai trò: {Object.values(ROLE_LABEL).join(' / ')}</p>

            <div className="srv-toggle-row">
              <button type="button" className="srv-toggle" onClick={() => setShowServer((v) => !v)}>
                <Icon name="settings" size={13} /> Đổi máy chủ
              </button>
            </div>
            {showServer && <ServerPanel onClose={() => setShowServer(false)} />}
          </div>
        </div>
      </div>
    </div>
  );
}
