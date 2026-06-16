import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Calendar, Mail, Bell, Type, AlignLeft, Users, Clock } from 'lucide-react';
import EmailTagsInput from './EmailTagsInput';
import toast from 'react-hot-toast';

const emptyForm = {
  title: '',
  description: '',
  dueTime: '',
  notifyTypes: [],
  recipients: [],
  notifyCycle: 'none',
};

export default function TaskFormModal({ task, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        dueTime: task.dueTime
          ? format(new Date(task.dueTime), "yyyy-MM-dd'T'HH:mm")
          : '',
        notifyTypes: task.notifyTypes || [],
        recipients: task.recipients || [],
        notifyCycle: task.notifyCycle || 'none',
      });
    } else {
      setForm(emptyForm);
    }
  }, [task]);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleNotifyToggle = (type) => {
    setForm(f => ({
      ...f,
      notifyTypes: f.notifyTypes.includes(type)
        ? f.notifyTypes.filter(t => t !== type)
        : [...f.notifyTypes, type],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề');
      return;
    }
    if (!form.dueTime) {
      toast.error('Vui lòng chọn thời hạn');
      return;
    }
    if (form.notifyTypes.includes('email') && form.recipients.length === 0) {
      toast.error('Vui lòng nhập ít nhất 1 email nhận thông báo');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ...form,
        dueTime: new Date(form.dueTime).toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const isEmailChecked = form.notifyTypes.includes('email');
  const isPushChecked = form.notifyTypes.includes('push');

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {task ? '✏️ Chỉnh sửa công việc' : '➕ Thêm công việc mới'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="form-group">
            <label className="form-label">
              <Type size={14} style={{ display: 'inline', marginRight: 6 }} />
              Tiêu đề *
            </label>
            <input
              id="task-title"
              type="text"
              name="title"
              className="form-input"
              placeholder="Nhập tiêu đề công việc..."
              value={form.title}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">
              <AlignLeft size={14} style={{ display: 'inline', marginRight: 6 }} />
              Mô tả
            </label>
            <textarea
              id="task-description"
              name="description"
              className="form-textarea"
              placeholder="Mô tả chi tiết công việc..."
              value={form.description}
              onChange={handleChange}
            />
          </div>

          {/* Due time */}
          <div className="form-group">
            <label className="form-label">
              <Calendar size={14} style={{ display: 'inline', marginRight: 6 }} />
              Thời hạn *
            </label>
            <input
              id="task-due"
              type="datetime-local"
              name="dueTime"
              className="form-input"
              value={form.dueTime}
              onChange={handleChange}
              required
            />
          </div>

          {/* Notify types */}
          <div className="form-group">
            <label className="form-label">
              <Bell size={14} style={{ display: 'inline', marginRight: 6 }} />
              Hình thức thông báo
            </label>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <label className="checkbox-group">
                <input
                  id="notify-email"
                  type="checkbox"
                  checked={isEmailChecked}
                  onChange={() => handleNotifyToggle('email')}
                />
                <Mail size={14} />
                Email
              </label>
              <label className="checkbox-group">
                <input
                  id="notify-push"
                  type="checkbox"
                  checked={isPushChecked}
                  onChange={() => handleNotifyToggle('push')}
                />
                <Bell size={14} />
                Push Notification
              </label>
            </div>
          </div>

          {/* Notify Cycle */}
          {form.notifyTypes.length > 0 && (
            <div className="form-group" style={{ animation: 'slideUp 0.2s ease' }}>
              <label className="form-label">
                <Clock size={14} style={{ display: 'inline', marginRight: 6 }} />
                Chu kỳ thông báo
              </label>
              <select
                id="task-notify-cycle"
                name="notifyCycle"
                className="form-select"
                value={form.notifyCycle || 'none'}
                onChange={handleChange}
              >
                <option value="none">Không lặp lại (Mặc định)</option>
                <option value="daily">Hằng ngày</option>
                <option value="weekly">Hàng tuần</option>
                <option value="monthly">Hàng tháng</option>
              </select>
            </div>
          )}

          {/* Recipients - only show when email is checked */}
          {isEmailChecked && (
            <div className="form-group" style={{
              animation: 'slideUp 0.2s ease',
              background: 'rgba(30,144,255,0.05)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid rgba(30,144,255,0.2)',
            }}>
              <label className="form-label">
                <Users size={14} style={{ display: 'inline', marginRight: 6 }} />
                Email nhận thông báo *
              </label>
              <EmailTagsInput
                value={form.recipients}
                onChange={(emails) => setForm(f => ({ ...f, recipients: emails }))}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                Nhấn Enter hoặc dấu phẩy để thêm email
              </p>
            </div>
          )}

          {/* Notification logic info */}
          {form.notifyTypes.length > 0 && (
            <div style={{
              background: 'rgba(108,99,255,0.08)',
              border: '1px solid rgba(108,99,255,0.2)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 'var(--spacing-md)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}>
              ℹ️ <strong>Lịch gửi thông báo:</strong>
              {form.notifyCycle === 'daily' && (
                <p style={{ marginTop: 6 }}>Thông báo sẽ được gửi định kỳ <strong>hằng ngày</strong> cho đến khi công việc hoàn thành.</p>
              )}
              {form.notifyCycle === 'weekly' && (
                <p style={{ marginTop: 6 }}>Thông báo sẽ được gửi định kỳ <strong>hàng tuần</strong> cho đến khi công việc hoàn thành.</p>
              )}
              {form.notifyCycle === 'monthly' && (
                <p style={{ marginTop: 6 }}>Thông báo sẽ được gửi định kỳ <strong>hàng tháng</strong> cho đến khi công việc hoàn thành.</p>
              )}
              {(!form.notifyCycle || form.notifyCycle === 'none') && (
                <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
                  <li>Còn &gt; 3 ngày: Chưa gửi</li>
                  <li>Còn ≤ 3 ngày: Mỗi <strong>12 tiếng</strong></li>
                  <li>Còn ≤ 1 ngày: Mỗi <strong>8 tiếng</strong></li>
                  <li>Quá hạn: Mỗi <strong>4 tiếng</strong></li>
                </ul>
              )}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button
              id="task-save"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              ) : (
                task ? 'Lưu thay đổi' : 'Tạo công việc'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
