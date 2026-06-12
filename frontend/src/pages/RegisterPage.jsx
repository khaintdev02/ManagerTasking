import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import { CheckSquare, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.register({
        email: form.email,
        password: form.password,
      });
      login(res.data.token, res.data.user);
      toast.success('Đăng ký thành công!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <CheckSquare size={32} color="white" />
          </div>
          <h2>Tạo tài khoản</h2>
          <p>Bắt đầu quản lý công việc ngay</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                id="reg-email"
                type="email"
                name="email"
                className="form-input"
                placeholder="your@email.com"
                style={{ paddingLeft: 38 }}
                value={form.email}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                id="reg-password"
                type={showPw ? 'text' : 'password'}
                name="password"
                className="form-input"
                placeholder="Ít nhất 6 ký tự"
                style={{ paddingLeft: 38, paddingRight: 38 }}
                value={form.password}
                onChange={handleChange}
                required
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

          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Xác nhận mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                id="reg-confirm"
                type={showPw ? 'text' : 'password'}
                name="confirm"
                className="form-input"
                placeholder="Nhập lại mật khẩu"
                style={{ paddingLeft: 38 }}
                value={form.confirm}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button
            id="register-submit"
            type="submit"
            className="btn btn-primary w-full btn-lg"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              <>Đăng ký <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        <div className="auth-divider">hoặc</div>

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
