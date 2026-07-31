import { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Calendar, 
  TrendingUp, TrendingDown, Scale, User, X, 
  ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import { debtsAPI } from '../api';
import toast from 'react-hot-toast';

export default function DebtsPage() {
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState({ totalDebt: 0, totalLoan: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'debt',
    person: '',
    amount: '',
    dueDate: '',
    description: '',
    status: 'pending'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, summaryRes] = await Promise.all([
        debtsAPI.getAll({ type: typeFilter, status: statusFilter }),
        debtsAPI.getSummary()
      ]);
      setDebts(listRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to load debt ledger data:', err);
      toast.error('Không thể tải dữ liệu sổ nợ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [typeFilter, statusFilter]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      type: 'debt',
      person: '',
      amount: '',
      dueDate: '',
      description: '',
      status: 'pending'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (d) => {
    setEditingId(d.id);
    setFormData({
      type: d.type,
      person: d.person,
      amount: d.amount.toString(),
      dueDate: d.dueDate || '',
      description: d.description || '',
      status: d.status
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(formData.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }
    if (!formData.person.trim()) {
      toast.error('Vui lòng nhập tên người vay / cho vay');
      return;
    }

    setProcessing(true);
    try {
      if (editingId) {
        await debtsAPI.update(editingId, { ...formData, amount: amountVal });
        toast.success('Đã cập nhật khoản nợ thành công');
      } else {
        await debtsAPI.create({ ...formData, amount: amountVal });
        toast.success('Đã thêm ghi chép nợ mới');
      }
      setShowModal(false);
      await fetchData();
    } catch (err) {
      console.error('Submit debt error:', err);
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra khi lưu ghi chép');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickToggleStatus = async (debt) => {
    const nextStatus = debt.status === 'pending' ? 'settled' : 'pending';
    const actionText = nextStatus === 'settled' ? 'Đã trả xong' : 'Chưa thanh toán';
    setProcessing(true);
    try {
      await debtsAPI.update(debt.id, {
        status: nextStatus
      });
      toast.success(`Đã đánh dấu là ${actionText}`);
      await fetchData();
    } catch (err) {
      console.error('Toggle status error:', err);
      toast.error('Không thể cập nhật trạng thái');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ghi chép nợ này?')) return;
    setProcessing(true);
    try {
      await debtsAPI.delete(id);
      toast.success('Đã xóa ghi chép');
      await fetchData();
    } catch (err) {
      console.error('Delete debt error:', err);
      toast.error('Không thể xóa ghi chép');
    } finally {
      setProcessing(false);
    }
  };

  const filteredDebts = debts.filter(d => {
    const matchesSearch = !searchQuery || 
      d.person.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Check if a pending debt is overdue
  const isOverdue = (debt) => {
    if (debt.status !== 'pending' || !debt.dueDate) return false;
    const today = new Date().toISOString().substring(0, 10);
    return debt.dueDate < today;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Sổ nợ (Vay & Cho vay)</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Quản lý chi tiết các khoản nợ phải trả và nợ cần thu hồi</p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Thêm khoản nợ mới
        </button>
      </div>

      {/* Summary Cards Grid */}
      <div className="finance-grid">
        {/* Total Debt (I owe) */}
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-danger)', '--stat-color-rgb': '255, 71, 87' }}>
          <div className="stat-icon"><TrendingDown size={24} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--accent-danger)' }}>{formatVND(summary.totalDebt)}</div>
            <div className="stat-label">Tôi đi vay (Nợ phải trả)</div>
          </div>
        </div>

        {/* Total Loan (They owe me) */}
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-success)', '--stat-color-rgb': '46, 213, 115' }}>
          <div className="stat-icon"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--accent-success)' }}>{formatVND(summary.totalLoan)}</div>
            <div className="stat-label">Tôi cho vay (Nợ cần thu)</div>
          </div>
        </div>

        {/* Net Balance */}
        <div className="stat-card" style={{ 
          '--stat-color': summary.netBalance >= 0 ? 'var(--accent-info)' : 'var(--accent-danger)', 
          '--stat-color-rgb': summary.netBalance >= 0 ? '30, 144, 255' : '255, 71, 87' 
        }}>
          <div className="stat-icon"><Scale size={24} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: summary.netBalance >= 0 ? 'var(--accent-info)' : 'var(--accent-danger)' }}>
              {summary.netBalance >= 0 ? '+' : ''}{formatVND(summary.netBalance)}
            </div>
            <div className="stat-label">Số dư nợ thuần (Cần thu - Cần trả)</div>
          </div>
        </div>
      </div>

      {/* Main filter & table card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Tìm theo tên hoặc ghi chú..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <select className="form-select" style={{ width: 150 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Tất cả loại nợ</option>
              <option value="debt">Tôi đi vay (Nợ)</option>
              <option value="loan">Tôi cho vay (Cho mượn)</option>
            </select>

            <select className="form-select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chưa thanh toán</option>
              <option value="settled">Đã thanh toán xong</option>
            </select>
          </div>
        </div>

        {/* Debts Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div className="spinner" />
            </div>
          ) : filteredDebts.length === 0 ? (
            <div style={{ textAlignment: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Chưa có ghi chép nợ nào khớp bộ lọc.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Ngày tạo</th>
                  <th style={{ width: '15%' }}>Loại giao dịch</th>
                  <th style={{ width: '18%' }}>Người vay / Cho vay</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Số tiền</th>
                  <th style={{ width: '15%' }}>Hạn trả nợ</th>
                  <th style={{ width: '13%' }}>Trạng thái</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredDebts.map((d) => {
                  const overdue = isOverdue(d);
                  
                  return (
                    <tr key={d.id} style={{ 
                      opacity: d.status === 'settled' ? 0.65 : 1,
                      backgroundColor: overdue ? 'rgba(255, 71, 87, 0.03)' : 'transparent',
                      transition: 'background-color 0.2s' 
                    }}>
                      <td>{d.createdAt ? d.createdAt.substring(0, 10) : '---'}</td>
                      <td>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 4, 
                          color: d.type === 'loan' ? 'var(--accent-success)' : 'var(--accent-danger)', 
                          fontWeight: 'bold',
                          fontSize: '0.85rem'
                        }}>
                          {d.type === 'loan' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {d.type === 'loan' ? 'Tôi cho vay' : 'Tôi đi vay'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                            <span style={{ display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-input)', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>
                              <User size={12} style={{ color: 'var(--text-secondary)' }} />
                            </span>
                            <span>{d.person}</span>
                          </span>
                          {d.description && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: 30, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FileText size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
                              <span>{d.description}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ 
                        textAlign: 'right', 
                        fontWeight: 'bold',
                        color: d.type === 'loan' ? 'var(--accent-success)' : 'var(--text-primary)' 
                      }}>
                        {formatVND(d.amount)}
                      </td>
                      <td>
                        {d.dueDate ? (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            color: overdue ? 'var(--accent-danger)' : 'var(--text-secondary)',
                            fontWeight: overdue ? 'bold' : 'normal' 
                          }}>
                            <Calendar size={12} />
                            {d.dueDate}
                            {overdue && <AlertCircle size={12} title="Quá hạn trả nợ!" />}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Không kỳ hạn</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-ghost" 
                          style={{ 
                            padding: '2px 8px', 
                            borderRadius: 12, 
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: d.status === 'settled' ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                            color: d.status === 'settled' ? 'var(--accent-success)' : 'var(--accent-danger)',
                            border: '1px solid transparent'
                          }}
                          onClick={() => handleQuickToggleStatus(d)}
                          title="Click để đổi trạng thái thanh toán"
                        >
                          {d.status === 'settled' ? (
                            <>
                              <CheckCircle2 size={10} /> Đã trả
                            </>
                          ) : (
                            <>
                              <AlertCircle size={10} /> Chưa trả
                            </>
                          )}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleOpenEdit(d)} title="Sửa">
                            <Edit2 size={13} />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--accent-danger)' }} onClick={() => handleDelete(d.id)} title="Xóa">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Debt Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Chỉnh sửa khoản nợ' : 'Thêm ghi chép nợ mới'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {/* Type selector switch */}
              <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: 4 }}>
                <button 
                  type="button"
                  style={{ 
                    flex: 1, 
                    padding: '8px 12px', 
                    borderRadius: 'var(--border-radius-sm)', 
                    border: 'none', 
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: formData.type === 'debt' ? 'var(--accent-danger)' : 'transparent',
                    color: formData.type === 'debt' ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setFormData(prev => ({ ...prev, type: 'debt' }))}
                >
                  Tôi đi vay (Nợ phải trả)
                </button>
                <button 
                  type="button"
                  style={{ 
                    flex: 1, 
                    padding: '8px 12px', 
                    borderRadius: 'var(--border-radius-sm)', 
                    border: 'none', 
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: formData.type === 'loan' ? 'var(--accent-success)' : 'transparent',
                    color: formData.type === 'loan' ? '#0a0b0f' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setFormData(prev => ({ ...prev, type: 'loan' }))}
                >
                  Tôi cho vay (Nợ cần thu)
                </button>
              </div>

              {/* Person name */}
              <div className="form-group">
                <label className="form-label">Tên người vay / Cho vay *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ví dụ: Nguyễn Văn A, Chị Hoa..."
                  required
                  value={formData.person}
                  onChange={(e) => setFormData(prev => ({ ...prev, person: e.target.value }))}
                />
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="form-label">Số tiền (VND) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Ví dụ: 500000"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              {/* Due Date */}
              <div className="form-group">
                <label className="form-label">Hạn trả nợ (Không bắt buộc)</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Lý do / Mô tả chi tiết</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Ví dụ: Vay tiền ăn trưa, Cho mượn đóng tiền nhà..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* Status checkbox (for paid state) */}
              <label className="checkbox-group" style={{ marginTop: 4 }}>
                <input 
                  type="checkbox"
                  checked={formData.status === 'settled'}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked ? 'settled' : 'pending' }))}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Đã thanh toán xong khoản này</span>
              </label>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Cập nhật' : 'Thêm ghi chép'}</button>
              </div>
            </form>
          </div>
        </div>
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
