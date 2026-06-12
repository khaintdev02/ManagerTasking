import { useState, useEffect } from 'react';
import api, { adminAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import {
  Users, CheckSquare, AlertTriangle, TrendingUp,
  Trash2, Shield, User, Mail, Calendar, RefreshCw, BellRing,
  Plus, Edit, Key
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  // Modal State for Create/Edit User
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // null if creating, user object if editing
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'user' });

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, tasksRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers(),
        adminAPI.getAllTasks(),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setAllTasks(tasksRes.data);
    } catch (err) {
      toast.error('Không thể tải dữ liệu admin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleTriggerNotify = async () => {
    setTriggering(true);
    try {
      const res = await api.post('/admin/trigger-notify');
      toast.success('✅ Đã gửi notification! Kiểm tra email và log server.');
    } catch (err) {
      toast.error('Lỗi: ' + (err.response?.data?.error || err.message));
    } finally {
      setTriggering(false);
    }
  };

  const handleOpenDeleteConfirm = (user) => {
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await adminAPI.deleteUser(userToDelete.id);
      toast.success('Đã xóa user thành công');
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể xóa user');
    }
  };

  const handleChangeRole = async (user, newRole) => {
    try {
      await adminAPI.updateUserRole(user.id, newRole);
      toast.success(`Đã cập nhật role thành ${newRole}`);
      fetchData();
    } catch (err) {
      toast.error('Không thể cập nhật role');
    }
  };

  const handleOpenCreateModal = () => {
    setSelectedUser(null);
    setUserForm({ email: '', password: '', role: 'user' });
    setModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setSelectedUser(user);
    setUserForm({ email: user.email, password: '', role: user.role });
    setModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.email) {
      toast.error('Email không được để trống');
      return;
    }
    if (!selectedUser && !userForm.password) {
      toast.error('Mật khẩu không được để trống khi tạo mới');
      return;
    }
    if (userForm.password && userForm.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    try {
      if (selectedUser) {
        const payload = { email: userForm.email, role: userForm.role };
        if (userForm.password) payload.password = userForm.password;
        await adminAPI.updateUser(selectedUser.id, payload);
        toast.success('Cập nhật thông tin người dùng thành công');
      } else {
        await adminAPI.createUser(userForm);
        toast.success('Thêm người dùng mới thành công');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể lưu người dùng');
    }
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: 400 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Admin Panel</h1>
          <p className="page-subtitle">Quản lý toàn bộ hệ thống</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} />
            Làm mới
          </button>
          
          {activeTab === 'users' && (
            <button className="btn btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={16} />
              Thêm User
            </button>
          )}

          <button
            id="trigger-notify-btn"
            className="btn btn-primary"
            onClick={handleTriggerNotify}
            disabled={triggering}
            style={{ background: 'linear-gradient(135deg, #ff9500, #ff6b00)', boxShadow: '0 4px 15px rgba(255,149,0,0.3)' }}
          >
            {triggering
              ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Đang gửi...</>
              : <><BellRing size={16} /> Test Gửi Thông Báo</>}
          </button>
        </div>
      </div>

      {/* System stats */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div className="stat-card" style={{ '--stat-color': 'var(--accent-primary)', '--stat-color-rgb': '108, 99, 255' }}>
            <div className="stat-icon"><Users size={24} /></div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalUsers}</div>
              <div className="stat-label">Tổng người dùng</div>
            </div>
          </div>
          <div className="stat-card" style={{ '--stat-color': 'var(--accent-info)', '--stat-color-rgb': '30, 144, 255' }}>
            <div className="stat-icon"><CheckSquare size={24} /></div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalTasks}</div>
              <div className="stat-label">Tổng công việc</div>
            </div>
          </div>
          <div className="stat-card" style={{ '--stat-color': 'var(--accent-success)', '--stat-color-rgb': '46, 213, 115' }}>
            <div className="stat-icon"><TrendingUp size={24} /></div>
            <div className="stat-info">
              <div className="stat-value">{stats.doneTasks}</div>
              <div className="stat-label">Đã hoàn thành</div>
            </div>
          </div>
          <div className="stat-card" style={{ '--stat-color': 'var(--accent-danger)', '--stat-color-rgb': '255, 71, 87' }}>
            <div className="stat-icon"><AlertTriangle size={24} /></div>
            <div className="stat-info">
              <div className="stat-value">{stats.overdueTasks}</div>
              <div className="stat-label">Quá hạn</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-lg)',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: 'var(--spacing-sm)',
      }}>
        {[
          { key: 'users', label: '👥 Người dùng', count: users.length },
          { key: 'tasks', label: '📋 Công việc', count: allTasks.length },
        ].map(tab => (
          <button
            key={tab.key}
            id={`admin-tab-${tab.key}`}
            className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '20px',
              padding: '1px 8px',
              fontSize: '0.75rem',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Users table */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32, height: 32,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, color: 'white',
                        flexShrink: 0,
                      }}>
                        {user.email.slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ color: 'var(--text-primary)' }}>{user.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                      {user.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                      {user.role}
                    </span>
                  </td>
                  <td>{format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleOpenEditModal(user)}
                        title="Chỉnh sửa thông tin"
                      >
                        <Edit size={14} />
                        Sửa
                      </button>

                      {/* Chỉ cho phép đổi role nếu không phải tài khoản chính mình và không phải admin cố định */}
                      {user.id !== currentUser?.id && user.email !== 'khainguyenthe203@gmail.com' ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleChangeRole(user, user.role === 'admin' ? 'user' : 'admin')}
                          title="Đổi role"
                        >
                          <Shield size={14} />
                          {user.role === 'admin' ? 'Hạ User' : 'Nâng Admin'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled
                          style={{ opacity: 0.5, cursor: 'not-allowed' }}
                          title="Không thể tự đổi role hoặc đổi role admin cố định"
                        >
                          <Shield size={14} />
                          {user.role === 'admin' ? 'Hạ User' : 'Nâng Admin'}
                        </button>
                      )}

                      {/* Chỉ hiển thị nút xóa nếu không phải tài khoản chính mình và không phải admin cố định */}
                      {user.id !== currentUser?.id && user.email !== 'khainguyenthe203@gmail.com' ? (
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleOpenDeleteConfirm(user)}
                          style={{ color: 'var(--accent-danger)' }}
                          title="Xóa user"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-icon"
                          disabled
                          style={{ color: 'var(--text-muted)', opacity: 0.5, cursor: 'not-allowed' }}
                          title="Không thể xóa tài khoản chính mình hoặc admin cố định"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="empty-state">
              <Users size={40} />
              <h3>Chưa có người dùng nào</h3>
            </div>
          )}
        </div>
      )}

      {/* All tasks table */}
      {activeTab === 'tasks' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Người tạo</th>
                <th>Deadline</th>
                <th>Trạng thái</th>
                <th>Notify</th>
              </tr>
            </thead>
            <tbody>
              {allTasks.map(task => {
                const due = new Date(task.dueTime);
                const now = new Date();
                const isOverdue = !task.isDone && due < now;
                return (
                  <tr key={task.id}>
                    <td>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {task.title}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={12} />
                        {task.User?.email || '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} />
                        {format(due, 'dd/MM/yyyy HH:mm')}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${task.isDone ? 'badge-done' : isOverdue ? 'badge-overdue' : 'badge-pending'}`}>
                        {task.isDone ? 'Hoàn thành' : isOverdue ? 'Quá hạn' : 'Đang chờ'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {task.notifyTypes?.includes('email') && (
                          <span className="badge badge-email"><Mail size={10} /></span>
                        )}
                        {task.notifyTypes?.includes('push') && (
                          <span className="badge badge-push"><Shield size={10} /></span>
                        )}
                        {!task.notifyTypes?.length && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {allTasks.length === 0 && (
            <div className="empty-state">
              <CheckSquare size={40} />
              <h3>Chưa có công việc nào</h3>
            </div>
          )}
        </div>
      )}

      {/* User Create/Edit Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div className="card" style={{ maxWidth: 450, width: '100%', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedUser ? <Edit size={18} color="var(--accent-primary)" /> : <Plus size={18} color="var(--accent-primary)" />}
                {selectedUser ? 'Chỉnh sửa thông tin User' : 'Thêm User mới'}
              </span>
            </div>

            <form onSubmit={handleSaveUser}>
              <div className="form-group">
                <label className="form-label" htmlFor="user-email">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }} />
                  <input
                    id="user-email"
                    type="email"
                    className="form-input"
                    placeholder="name@example.com"
                    style={{
                      paddingLeft: 38,
                      background: selectedUser?.email === 'khainguyenthe203@gmail.com' ? 'rgba(255,255,255,0.03)' : 'var(--bg-input)',
                      color: selectedUser?.email === 'khainguyenthe203@gmail.com' ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: selectedUser?.email === 'khainguyenthe203@gmail.com' ? 'not-allowed' : 'text'
                    }}
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    disabled={selectedUser?.email === 'khainguyenthe203@gmail.com'}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="user-password">
                  {selectedUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }} />
                  <input
                    id="user-password"
                    type="password"
                    className="form-input"
                    placeholder={selectedUser ? '••••••••' : 'Ít nhất 6 ký tự'}
                    style={{ paddingLeft: 38 }}
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    required={!selectedUser}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="user-role">Quyền hạn (Role)</label>
                <div style={{ position: 'relative' }}>
                  <Shield size={16} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }} />
                  <select
                    id="user-role"
                    className="form-input"
                    style={{
                      paddingLeft: 38,
                      appearance: 'none',
                      background: (selectedUser?.email === 'khainguyenthe203@gmail.com' || selectedUser?.id === currentUser?.id) ? 'rgba(255,255,255,0.03)' : 'var(--bg-input)',
                      color: (selectedUser?.email === 'khainguyenthe203@gmail.com' || selectedUser?.id === currentUser?.id) ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: (selectedUser?.email === 'khainguyenthe203@gmail.com' || selectedUser?.id === currentUser?.id) ? 'not-allowed' : 'pointer'
                    }}
                    value={userForm.role}
                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                    disabled={selectedUser?.email === 'khainguyenthe203@gmail.com' || selectedUser?.id === currentUser?.id}
                  >
                    <option value="user">User (Người dùng thường)</option>
                    <option value="admin">Admin (Quản trị viên)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-xl)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div className="card" style={{ maxWidth: 450, width: '100%', border: '1px solid rgba(255, 71, 87, 0.2)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid rgba(255, 71, 87, 0.15)', paddingBottom: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-danger)' }}>
                <Trash2 size={18} />
                Xác nhận xóa người dùng
              </span>
            </div>

            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 'var(--spacing-md)' }}>
                Bạn có chắc chắn muốn xóa tài khoản <strong>{userToDelete?.email}</strong>?
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 'var(--spacing-xl)', padding: 12, background: 'rgba(255, 71, 87, 0.05)', borderRadius: 8, border: '1px solid rgba(255, 71, 87, 0.1)' }}>
                ⚠️ <strong>Cảnh báo:</strong> Toàn bộ các công việc (tasks) liên kết với tài khoản này cũng sẽ bị xóa vĩnh viễn và không thể khôi phục.
              </p>

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setDeleteConfirmOpen(false); setUserToDelete(null); }}>
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmDelete}
                  style={{ background: 'var(--accent-danger)' }}
                >
                  Xóa vĩnh viễn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
