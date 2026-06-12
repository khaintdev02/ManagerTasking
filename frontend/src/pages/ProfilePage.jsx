import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import { User, Mail, Lock, Trash2, Shield, Eye, EyeOff, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (password && password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (password && password.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setUpdating(true);
    try {
      const payload = { email };
      if (password) payload.password = password;

      const res = await authAPI.updateProfile(payload);
      
      // Update local storage and context state
      const token = localStorage.getItem('token');
      login(token, res.data);

      toast.success('Cập nhật tài khoản thành công!');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể cập nhật tài khoản');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.confirm(
      '⚠️ CẢNH BÁO CỰC KỲ QUAN TRỌNG:\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản của mình? Hành động này sẽ xóa toàn bộ các công việc (tasks) của bạn và KHÔNG THỂ HOÀN TÁC.'
    );
    if (!confirmation) return;

    setDeleting(true);
    try {
      await authAPI.deleteProfile();
      toast.success('Tài khoản của bạn đã được xóa.');
      logout();
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể xóa tài khoản');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 Quản lý tài khoản</h1>
          <p className="page-subtitle">Cập nhật thông tin cá nhân và mật khẩu của bạn</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-xl)' }}>
        
        {/* Info & Update Profile Card */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--spacing-md)' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} color="var(--accent-primary)" />
              Thông tin cá nhân
            </span>
          </div>

          <form onSubmit={handleUpdateProfile} style={{ marginTop: 'var(--spacing-lg)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="profile-email">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  id="profile-email"
                  type="email"
                  className="form-input"
                  placeholder="your@email.com"
                  style={{ paddingLeft: 38 }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-role">Vai trò hệ thống</label>
              <div style={{ position: 'relative' }}>
                <Shield size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  id="profile-role"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: 38, background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                  value={user?.role === 'admin' ? '👑 Admin (Quản trị viên)' : '👤 User (Người dùng)'}
                  disabled
                />
              </div>
            </div>

            <div style={{ borderBottom: '1px solid var(--border-color)', margin: 'var(--spacing-xl) 0 var(--spacing-lg)' }} />

            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>
              🔑 Thay đổi mật khẩu
            </h3>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-password">Mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  id="profile-password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Để trống nếu không muốn đổi"
                  style={{ paddingLeft: 38, paddingRight: 38 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {password && (
              <div className="form-group">
                <label className="form-label" htmlFor="profile-confirm">Xác nhận mật khẩu mới</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }} />
                  <input
                    id="profile-confirm"
                    type={showPw ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Nhập lại mật khẩu mới"
                    style={{ paddingLeft: 38 }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!!password}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={updating}
              style={{ marginTop: 'var(--spacing-md)' }}
            >
              {updating ? (
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              ) : (
                <>
                  <Save size={16} />
                  Lưu thay đổi
                </>
              )}
            </button>
          </form>
        </div>

        {/* Danger Zone Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
          <div className="card" style={{ borderColor: 'rgba(255, 71, 87, 0.2)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid rgba(255, 71, 87, 0.15)', paddingBottom: 'var(--spacing-md)' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-danger)' }}>
                <Trash2 size={18} />
                Vùng nguy hiểm
              </span>
            </div>

            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 'var(--spacing-lg)' }}>
                Hành động xóa tài khoản sẽ xóa toàn bộ dữ liệu, các công việc và các thông báo đã liên kết của bạn. 
                Bạn sẽ không thể khôi phục lại các dữ liệu này sau khi thực hiện xóa.
              </p>

              <button
                type="button"
                className="btn w-full"
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  background: 'rgba(255, 71, 87, 0.1)',
                  color: 'var(--accent-danger)',
                  border: '1px solid rgba(255, 71, 87, 0.25)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--accent-danger)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 71, 87, 0.1)';
                  e.currentTarget.style.color = 'var(--accent-danger)';
                }}
              >
                {deleting ? (
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <>
                    <Trash2 size={16} />
                    Xóa tài khoản vĩnh viễn
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
