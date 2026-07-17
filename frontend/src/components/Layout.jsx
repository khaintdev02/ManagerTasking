import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, CheckSquare, Shield, LogOut,
  Bell, Menu, X, ChevronRight, User, Sun, Moon, Wallet, Coins
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    logout();
    toast.success('Đã đăng xuất thành công');
    navigate('/login');
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99, display: 'none'
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 'var(--spacing-md)' }}>
          <h1>
            <CheckSquare size={22} />
            TaskManager
          </h1>
          <button
            id="theme-toggle-desktop"
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            style={{ padding: 6, color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-title">Chính</span>

          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <LayoutDashboard size={18} />
            Tổng quan
          </NavLink>

          <NavLink
            to="/tasks"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <CheckSquare size={18} />
            Công việc
          </NavLink>

          <NavLink
            to="/transactions"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Wallet size={18} />
            Chi tiêu & Thu nhập
          </NavLink>

          <NavLink
            to="/debts"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Coins size={18} />
            Sổ nợ (Vay & Cho vay)
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <User size={18} />
            Tài khoản
          </NavLink>

          {isAdmin && (
            <>
              <span className="nav-section-title">Quản trị</span>
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Shield size={18} />
                Admin Panel
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <div className="user-details">
              <div className="user-email">{user?.email}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="btn btn-ghost w-full" onClick={handleLogout} style={{ justifyContent: 'flex-start' }}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Mobile header */}
        <div style={{
          display: 'none',
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>TaskManager</span>
          <button
            id="theme-toggle-mobile"
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            style={{ padding: 6, color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
