import { useState, useEffect, useCallback } from 'react';
import { tasksAPI, pushAPI } from '../api';
import { format, isBefore, addDays, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Plus, Search, CheckCircle2, Circle, Edit2, Trash2,
  Calendar, Mail, Bell, Filter, AlertTriangle, Clock,
  CheckSquare, BellRing, LayoutGrid, List
} from 'lucide-react';
import TaskFormModal from '../components/TaskFormModal';
import toast from 'react-hot-toast';

function TaskCard({ task, onEdit, onDelete, onToggle, viewMode }) {
  const now = new Date();
  const due = new Date(task.dueTime);
  const isOverdue = !task.isDone && isBefore(due, now);
  const isSoon = !task.isDone && !isOverdue && isBefore(due, addDays(now, 3));

  const cardClass = `task-card ${task.isDone ? 'done' : isOverdue ? 'overdue' : isSoon ? 'soon' : ''}`;
  const isList = viewMode === 'list';

  if (isList) {
    return (
      <div className={cardClass} style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
          {/* Left: Complete check + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: '200px' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => onToggle(task)}
              style={{ padding: 0, flexShrink: 0 }}
              title={task.isDone ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
            >
              {task.isDone
                ? <CheckCircle2 size={20} color="var(--accent-success)" />
                : <Circle size={20} color="var(--text-muted)" />
              }
            </button>
            <h3 className={`task-title ${task.isDone ? 'done-title' : ''}`} style={{ fontSize: '0.95rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.title}
            </h3>
          </div>

          {/* Middle: Due date & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexShrink: 0, flexWrap: 'wrap' }}>
            <div className="task-due" style={{ margin: 0 }}>
              <Calendar size={12} />
              <span style={{ fontSize: '0.78rem', color: isOverdue ? 'var(--accent-danger)' : isSoon ? 'var(--accent-warning)' : 'var(--text-muted)' }}>
                {format(due, "dd/MM/yyyy HH:mm")}
              </span>
            </div>

            <div className="task-meta" style={{ margin: 0, gap: 4 }}>
              <span className={`badge ${task.isDone ? 'badge-done' : isOverdue ? 'badge-overdue' : isSoon ? 'badge-pending' : ''}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                {task.isDone ? '✓ Xong' : isOverdue ? '⚠ Quá hạn' : isSoon ? '⏰ Sắp hạn' : '○ Chờ'}
              </span>

              {task.notifyTypes?.includes('email') && (
                <span className="badge badge-email" style={{ padding: '2px 8px', fontSize: '0.7rem' }} title="Email"><Mail size={8} /></span>
              )}
              {task.notifyTypes?.includes('push') && (
                <span className="badge badge-push" style={{ padding: '2px 8px', fontSize: '0.7rem' }} title="Push"><Bell size={8} /></span>
              )}
              {task.notifyCycle && task.notifyCycle !== 'none' && (
                <span className="badge badge-cycle" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                  <Clock size={8} /> {
                    task.notifyCycle === 'daily' ? 'Ngày' :
                    task.notifyCycle === 'weekly' ? 'Tuần' :
                    task.notifyCycle === 'monthly' ? 'Tháng' :
                    task.notifyCycle
                  }
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="task-actions" style={{ opacity: 1, gap: 2, position: 'static' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => onEdit(task)}
              title="Chỉnh sửa"
              style={{ padding: 4 }}
            >
              <Edit2 size={14} />
            </button>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => onDelete(task)}
              title="Xóa"
              style={{ color: 'var(--accent-danger)', padding: 4 }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div className="task-header">
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => onToggle(task)}
          style={{ padding: 0, flexShrink: 0 }}
          title={task.isDone ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
        >
          {task.isDone
            ? <CheckCircle2 size={22} color="var(--accent-success)" />
            : <Circle size={22} color="var(--text-muted)" />
          }
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className={`task-title ${task.isDone ? 'done-title' : ''}`}>
            {task.title}
          </h3>
        </div>

        <div className="task-actions">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => onEdit(task)}
            title="Chỉnh sửa"
          >
            <Edit2 size={15} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => onDelete(task)}
            title="Xóa"
            style={{ color: 'var(--accent-danger)' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-meta">
        <span className={`badge ${task.isDone ? 'badge-done' : isOverdue ? 'badge-overdue' : isSoon ? 'badge-pending' : ''}`}>
          {task.isDone ? '✓ Hoàn thành' : isOverdue ? '⚠ Quá hạn' : isSoon ? '⏰ Sắp hạn' : '○ Đang chờ'}
        </span>

        {task.notifyTypes?.includes('email') && (
          <span className="badge badge-email"><Mail size={10} /> Email</span>
        )}
        {task.notifyTypes?.includes('push') && (
          <span className="badge badge-push"><Bell size={10} /> Push</span>
        )}
        {task.notifyCycle && task.notifyCycle !== 'none' && (
          <span className="badge badge-cycle">
            <Clock size={10} /> {
              task.notifyCycle === 'daily' ? 'Hằng ngày' :
              task.notifyCycle === 'weekly' ? 'Hàng tuần' :
              task.notifyCycle === 'monthly' ? 'Hàng tháng' :
              task.notifyCycle
            }
          </span>
        )}
      </div>

      <div className="task-due">
        <Calendar size={13} />
        <span style={{ color: isOverdue ? 'var(--accent-danger)' : isSoon ? 'var(--accent-warning)' : 'var(--text-muted)' }}>
          {format(due, "dd/MM/yyyy HH:mm")}
          {' · '}
          {formatDistanceToNow(due, { locale: vi, addSuffix: true })}
        </span>
      </div>

      {task.recipients?.length > 0 && (
        <div style={{
          marginTop: 8,
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}>
          <Mail size={11} />
          {task.recipients.slice(0, 2).join(', ')}
          {task.recipients.length > 2 && ` +${task.recipients.length - 2} nữa`}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('taskViewMode') || 'grid');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    localStorage.setItem('taskViewMode', viewMode);
  }, [viewMode]);

  const fetchTasks = useCallback(async () => {
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const res = await tasksAPI.getAll(params);
      setTasks(res.data);
    } catch (err) {
      toast.error('Không thể tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchTasks, 300);
    return () => clearTimeout(timer);
  }, [fetchTasks]);

  // Check push subscription status
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(async reg => {
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      });
    }
  }, []);

  const handleSubscribePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error('Trình duyệt không hỗ trợ Push Notification');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const res = await pushAPI.getVapidKey();
      const publicKey = res.data.publicKey;

      if (!publicKey || publicKey === 'your_vapid_public_key') {
        toast.error('VAPID key chưa được cấu hình trên server');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await pushAPI.subscribe(sub.toJSON());
      setPushEnabled(true);
      toast.success('Đã bật Push Notification!');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        toast.error('Bạn đã chặn quyền thông báo trong trình duyệt');
      } else {
        toast.error('Không thể bật Push Notification: ' + err.message);
      }
    }
  };

  const handleUnsubscribePush = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await pushAPI.unsubscribe();
      setPushEnabled(false);
      toast.success('Đã tắt Push Notification');
    } catch (err) {
      toast.error('Không thể tắt Push Notification');
    }
  };

  const handleSave = async (formData) => {
    setProcessing(true);
    try {
      if (editingTask) {
        await tasksAPI.update(editingTask.id, formData);
        toast.success('Đã cập nhật công việc!');
      } else {
        await tasksAPI.create(formData);
        toast.success('Đã tạo công việc mới!');
      }
      setShowModal(false);
      setEditingTask(null);
      await fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra');
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Xóa công việc "${task.title}"?`)) return;
    setProcessing(true);
    try {
      await tasksAPI.delete(task.id);
      toast.success('Đã xóa công việc');
      await fetchTasks();
    } catch (err) {
      toast.error('Không thể xóa công việc');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggle = async (task) => {
    setProcessing(true);
    try {
      await tasksAPI.toggleComplete(task.id);
      toast.success(task.isDone ? 'Đã đánh dấu chưa hoàn thành' : '✅ Đã hoàn thành!');
      await fetchTasks();
    } catch (err) {
      toast.error('Có lỗi xảy ra');
    } finally {
      setProcessing(false);
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  const filters = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: '⏳ Đang chờ' },
    { key: 'done', label: '✅ Hoàn thành' },
    { key: 'overdue', label: '⚠️ Quá hạn' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Công việc</h1>
          <p className="page-subtitle">{tasks.length} công việc trong danh sách</p>
        </div>
        <button id="create-task-btn" className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} />
          Thêm mới
        </button>
      </div>

      {/* Push notification banner */}
      {'serviceWorker' in navigator && 'PushManager' in window && (
        <div className="push-banner">
          <BellRing size={20} color="var(--accent-primary)" />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Push Notification</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {pushEnabled
                ? '✅ Đã bật thông báo trên trình duyệt'
                : 'Bật để nhận thông báo ngay trên trình duyệt'}
            </p>
          </div>
          <button
            className={`btn btn-sm ${pushEnabled ? 'btn-secondary' : 'btn-primary'}`}
            onClick={pushEnabled ? handleUnsubscribePush : handleSubscribePush}
          >
            {pushEnabled ? 'Tắt' : 'Bật ngay'}
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
      }}>
        <div className="filter-bar">
          {filters.map(f => (
            <button
              key={f.key}
              id={`filter-${f.key}`}
              className={`filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <div className="search-box">
            <Search size={16} />
            <input
              id="task-search"
              type="text"
              className="search-input"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            id="view-mode-toggle"
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            title={viewMode === 'grid' ? 'Hiển thị dạng danh sách' : 'Hiển thị dạng lưới'}
            style={{ height: 38, width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            {viewMode === 'grid' ? <List size={18} /> : <LayoutGrid size={18} />}
          </button>
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <CheckSquare size={56} />
          <h3>Chưa có công việc nào</h3>
          <p>
            {filter !== 'all'
              ? 'Không có công việc nào phù hợp với bộ lọc này'
              : 'Hãy bắt đầu bằng cách thêm công việc đầu tiên!'}
          </p>
          {filter === 'all' && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} /> Thêm công việc
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'tasks-grid' : 'tasks-list'}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {/* Task form modal */}
      {showModal && (
        <TaskFormModal
          task={editingTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
          onSave={handleSave}
        />
      )}

      {/* Loading Overlay */}
      {processing && (
        <div className="loading-overlay">
          <div className="spinner" />
          <div className="loading-text">Đang xử lý dữ liệu...</div>
        </div>
      )}
    </div>
  );
}

// Helper: convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
