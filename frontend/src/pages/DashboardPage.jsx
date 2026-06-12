import { useState, useEffect } from 'react';
import { tasksAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CheckSquare, Clock, AlertTriangle, TrendingUp,
  Plus, ArrowRight, Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';

function StatCard({ value, label, icon: Icon, color, colorRgb }) {
  return (
    <div className="stat-card" style={{ '--stat-color': color, '--stat-color-rgb': colorRgb }}>
      <div className="stat-icon">
        <Icon size={24} />
      </div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksAPI.getAll().then(res => {
      setTasks(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const now = new Date();
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.isDone).length;
  const overdueTasks = tasks.filter(t => !t.isDone && isBefore(new Date(t.dueTime), now)).length;
  const soonTasks = tasks.filter(t => {
    const due = new Date(t.dueTime);
    return !t.isDone && isAfter(due, now) && isBefore(due, addDays(now, 3));
  }).length;

  const upcomingTasks = tasks
    .filter(t => !t.isDone)
    .sort((a, b) => new Date(a.dueTime) - new Date(b.dueTime))
    .slice(0, 5);

  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

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
          <h1 className="page-title">
            Xin chào, {user?.email?.split('@')[0]} 👋
          </h1>
          <p className="page-subtitle">
            {format(now, "EEEE, dd MMMM yyyy", { locale: vi })}
          </p>
        </div>
        <Link to="/tasks" className="btn btn-primary">
          <Plus size={18} />
          Thêm công việc
        </Link>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          value={totalTasks}
          label="Tổng công việc"
          icon={CheckSquare}
          color="var(--accent-primary)"
          colorRgb="108, 99, 255"
        />
        <StatCard
          value={doneTasks}
          label="Đã hoàn thành"
          icon={TrendingUp}
          color="var(--accent-success)"
          colorRgb="46, 213, 115"
        />
        <StatCard
          value={soonTasks}
          label="Sắp đến hạn (3 ngày)"
          icon={Clock}
          color="var(--accent-warning)"
          colorRgb="255, 165, 2"
        />
        <StatCard
          value={overdueTasks}
          label="Quá hạn"
          icon={AlertTriangle}
          color="var(--accent-danger)"
          colorRgb="255, 71, 87"
        />
      </div>

      {/* Progress */}
      <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div className="card-header">
          <span className="card-title">Tiến độ hoàn thành</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
            {completionRate}%
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <p style={{
          fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8
        }}>
          {doneTasks}/{totalTasks} công việc đã hoàn thành
        </p>
      </div>

      {/* Upcoming tasks */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">⏰ Công việc sắp đến hạn</span>
          <Link to="/tasks" className="btn btn-ghost btn-sm">
            Xem tất cả <ArrowRight size={14} />
          </Link>
        </div>

        {upcomingTasks.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--spacing-xl)' }}>
            <CheckSquare size={40} />
            <h3>Không có công việc nào!</h3>
            <p>Tất cả công việc đã hoàn thành hoặc chưa có task nào.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {upcomingTasks.map(task => {
              const due = new Date(task.dueTime);
              const isOverdue = isBefore(due, now);
              const isSoon = !isOverdue && isBefore(due, addDays(now, 3));

              return (
                <div key={task.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  padding: '12px 14px',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--border-radius-sm)',
                  border: `1px solid ${isOverdue ? 'rgba(255,71,87,0.3)' : isSoon ? 'rgba(255,165,2,0.3)' : 'var(--border-color)'}`,
                }}>
                  <Calendar size={16} style={{
                    color: isOverdue ? 'var(--accent-danger)' : isSoon ? 'var(--accent-warning)' : 'var(--text-muted)',
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{task.title}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {format(due, "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <span className={`badge ${isOverdue ? 'badge-overdue' : isSoon ? 'badge-pending' : ''}`}>
                    {isOverdue ? 'Quá hạn' : isSoon ? 'Sắp hạn' : 'Bình thường'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
