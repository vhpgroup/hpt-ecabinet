// ============================================================
// ĐĂNG NHẬP — mô phỏng (chọn nhanh tài khoản demo)
// ============================================================
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { Icon } from '../components';
import { ROLE_LABEL } from '../../domain/labels';

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
          Toàn bộ vòng đời cuộc họp trên một nền tảng: giấy mời — tài liệu — điểm danh —
          phát biểu — biểu quyết — biên bản ký số — nhiệm vụ sau họp.
        </p>
        <div className="login-feats">
          <div><span className="fi"><Icon name="vote" size={17} /></span>Biểu quyết, lấy ý kiến điện tử — tổng hợp kết quả tức thời</div>
          <div><span className="fi"><Icon name="file" size={17} /></span>Tài liệu tập trung, ghi chú cá nhân, chia sẻ có kiểm soát</div>
          <div><span className="fi"><Icon name="pen" size={17} /></span>Biên bản điện tử, ký số, lưu vết đầy đủ</div>
          <div><span className="fi"><Icon name="clipboard" size={17} /></span>Theo dõi nhiệm vụ, kết luận sau phiên họp</div>
        </div>
        <div className="lb-foot">
          Bản demo giai đoạn 1 — dữ liệu mẫu lưu tại trình duyệt · Kiến trúc sẵn sàng nâng cấp máy chủ + PostgreSQL
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card card">
          <div className="card-pad">
            <h2>Đăng nhập hệ thống</h2>
            <p className="sub">Chọn nhanh một tài khoản demo hoặc nhập thông tin đăng nhập.</p>
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
            <p className="login-hint">Mật khẩu demo cho mọi tài khoản: <b>123456</b> · Vai trò: {Object.values(ROLE_LABEL).join(' / ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
