import { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Calendar, 
  TrendingUp, TrendingDown, Scale, User, X, 
  ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle, FileText,
  Users, History, DollarSign, Wallet, ArrowRightLeft, Clock
} from 'lucide-react';
import { debtsAPI } from '../api';
import toast from 'react-hot-toast';

export default function DebtsPage() {
  const [viewMode, setViewMode] = useState('people'); // 'people' | 'records'
  const [people, setPeople] = useState([]);
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState({ totalDebt: 0, totalLoan: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Debt Modal State
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [debtFormData, setDebtFormData] = useState({
    type: 'loan',
    person: '',
    amount: '',
    dueDate: '',
    description: '',
    status: 'pending'
  });

  // Repayment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null); // { person, type, remainingAmount }
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    paymentDate: new Date().toISOString().substring(0, 10),
    note: ''
  });

  // Person Details & History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedPersonGroup, setSelectedPersonGroup] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [peopleRes, listRes, summaryRes] = await Promise.all([
        debtsAPI.getPeople({ type: typeFilter, search: searchQuery }),
        debtsAPI.getAll({ type: typeFilter, status: statusFilter, search: searchQuery }),
        debtsAPI.getSummary()
      ]);
      setPeople(peopleRes.data);
      setDebts(listRes.data);
      setSummary(summaryRes.data);

      // If history modal is currently open, refresh its selected person data
      if (selectedPersonGroup) {
        const updatedGroup = peopleRes.data.find(g => g.key === selectedPersonGroup.key);
        if (updatedGroup) {
          setSelectedPersonGroup(updatedGroup);
        }
      }
    } catch (err) {
      console.error('Failed to load debt ledger data:', err);
      toast.error('Không thể tải dữ liệu sổ nợ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [typeFilter, statusFilter, searchQuery]);

  // Open Add Debt Modal
  const handleOpenAddDebt = (prefill = {}) => {
    setEditingDebtId(null);
    setDebtFormData({
      type: prefill.type || 'loan',
      person: prefill.person || '',
      amount: '',
      dueDate: '',
      description: '',
      status: 'pending'
    });
    setShowDebtModal(true);
  };

  // Open Edit Debt Modal
  const handleOpenEditDebt = (d) => {
    setEditingDebtId(d.id);
    setDebtFormData({
      type: d.type,
      person: d.person,
      amount: d.amount.toString(),
      dueDate: d.dueDate || '',
      description: d.description || '',
      status: d.status
    });
    setShowDebtModal(true);
  };

  // Save Add / Edit Debt
  const handleSaveDebt = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(debtFormData.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }
    if (!debtFormData.person.trim()) {
      toast.error('Vui lòng nhập tên người vay / cho vay');
      return;
    }

    setProcessing(true);
    try {
      if (editingDebtId) {
        await debtsAPI.update(editingDebtId, { ...debtFormData, amount: amountVal });
        toast.success('Đã cập nhật khoản nợ thành công');
      } else {
        await debtsAPI.create({ ...debtFormData, amount: amountVal });
        toast.success('Đã thêm ghi chép nợ mới');
      }
      setShowDebtModal(false);
      await fetchData();
    } catch (err) {
      console.error('Submit debt error:', err);
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra khi lưu ghi chép');
    } finally {
      setProcessing(false);
    }
  };

  // Open Quick Repayment Modal
  const handleOpenPayment = (group) => {
    setPaymentTarget(group);
    setPaymentFormData({
      amount: group.remainingAmount > 0 ? group.remainingAmount.toString() : '',
      paymentDate: new Date().toISOString().substring(0, 10),
      note: ''
    });
    setShowPaymentModal(true);
  };

  // Save Repayment
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!paymentTarget) return;

    const amountVal = parseFloat(paymentFormData.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Số tiền thanh toán phải lớn hơn 0');
      return;
    }

    setProcessing(true);
    try {
      await debtsAPI.recordPayment({
        person: paymentTarget.person,
        type: paymentTarget.type,
        amount: amountVal,
        paymentDate: paymentFormData.paymentDate,
        note: paymentFormData.note
      });
      toast.success(`Đã ghi nhận thanh toán ${formatVND(amountVal)} thành công!`);
      setShowPaymentModal(false);
      await fetchData();
    } catch (err) {
      console.error('Record payment error:', err);
      toast.error(err.response?.data?.error || 'Không thể ghi nhận thanh toán');
    } finally {
      setProcessing(false);
    }
  };

  // Delete Payment Record
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch sử thanh toán này?')) return;
    setProcessing(true);
    try {
      await debtsAPI.deletePayment(paymentId);
      toast.success('Đã xóa giao dịch thanh toán');
      await fetchData();
    } catch (err) {
      console.error('Delete payment error:', err);
      toast.error('Không thể xóa giao dịch');
    } finally {
      setProcessing(false);
    }
  };

  // Delete Debt Record
  const handleDeleteDebt = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ghi chép nợ này?')) return;
    setProcessing(true);
    try {
      await debtsAPI.delete(id);
      toast.success('Đã xóa ghi chép nợ');
      await fetchData();
    } catch (err) {
      console.error('Delete debt error:', err);
      toast.error('Không thể xóa ghi chép');
    } finally {
      setProcessing(false);
    }
  };

  // Quick Toggle Status on individual debt
  const handleQuickToggleStatus = async (debt) => {
    const nextStatus = debt.status === 'pending' ? 'settled' : 'pending';
    const actionText = nextStatus === 'settled' ? 'Đã trả xong' : 'Chưa thanh toán';
    setProcessing(true);
    try {
      await debtsAPI.update(debt.id, { status: nextStatus });
      toast.success(`Đã đánh dấu là ${actionText}`);
      await fetchData();
    } catch (err) {
      console.error('Toggle status error:', err);
      toast.error('Không thể cập nhật trạng thái');
    } finally {
      setProcessing(false);
    }
  };

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  const isOverdue = (debt) => {
    if (debt.status !== 'pending' || !debt.dueDate) return false;
    const today = new Date().toISOString().substring(0, 10);
    return debt.dueDate < today;
  };

  // Filtered people for view
  const filteredPeople = people.filter(p => {
    if (statusFilter === 'pending' && p.status !== 'pending') return false;
    if (statusFilter === 'settled' && p.status !== 'settled') return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wallet style={{ color: 'var(--accent-primary)' }} /> Sổ nợ (Vay & Cho vay)
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Tổng hợp nợ theo từng người và ghi nhận trả nợ linh hoạt nhiều lần
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => handleOpenAddDebt()}>
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
            <div className="stat-label">Tôi đi vay (Nợ còn phải trả)</div>
          </div>
        </div>

        {/* Total Loan (They owe me) */}
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-success)', '--stat-color-rgb': '46, 213, 115' }}>
          <div className="stat-icon"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--accent-success)' }}>{formatVND(summary.totalLoan)}</div>
            <div className="stat-label">Tôi cho vay (Nợ cần thu hồi)</div>
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
            <div className="stat-label">Số dư nợ thuần (Thu hồi - Phải trả)</div>
          </div>
        </div>
      </div>

      {/* Navigation View Switch & Filters */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--spacing-md)' }}>
          {/* View Mode Buttons */}
          <div style={{ display: 'flex', gap: 8, background: 'var(--bg-input)', padding: 4, borderRadius: 'var(--border-radius-sm)' }}>
            <button
              type="button"
              className={`btn ${viewMode === 'people' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              onClick={() => setViewMode('people')}
            >
              <Users size={15} /> Theo người (Gom nhóm)
            </button>
            <button
              type="button"
              className={`btn ${viewMode === 'records' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              onClick={() => setViewMode('records')}
            >
              <FileText size={15} /> Tất cả phiếu ghi lẻ
            </button>
          </div>

          {/* Search & Select Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <div className="search-box">
              <Search size={16} />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Tìm người hoặc ghi chú..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select className="form-select" style={{ width: 150 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Tất cả loại nợ</option>
              <option value="debt">Tôi đi vay (Nợ)</option>
              <option value="loan">Tôi cho vay (Cho mượn)</option>
            </select>

            <select className="form-select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Còn nợ / Chưa xong</option>
              <option value="settled">Đã thanh toán hết</option>
            </select>
          </div>
        </div>

        {/* LOADING SPINNER */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
            <div className="spinner" />
          </div>
        ) : viewMode === 'people' ? (
          /* ==================== VIEW 1: PEOPLE GROUPED VIEW ==================== */
          filteredPeople.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
              Chưa có dữ liệu sổ nợ nào khớp bộ lọc.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--spacing-md)' }}>
              {filteredPeople.map((group) => {
                const isLoan = group.type === 'loan';
                const isSettled = group.status === 'settled';

                return (
                  <div 
                    key={group.key}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--spacing-sm)',
                      border: isSettled ? '1px solid var(--border-color)' : isLoan ? '1px solid rgba(46, 213, 115, 0.4)' : '1px solid rgba(255, 71, 87, 0.4)',
                      background: isSettled ? 'rgba(255, 255, 255, 0.02)' : isLoan ? 'rgba(46, 213, 115, 0.03)' : 'rgba(255, 71, 87, 0.03)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: 'var(--spacing-md)',
                      position: 'relative'
                    }}
                  >
                    {/* Header: Avatar, Name, Type */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: isLoan ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                          color: isLoan ? 'var(--accent-success)' : 'var(--accent-danger)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '1.1rem'
                        }}>
                          {group.person.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{group.person}</div>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            color: isLoan ? 'var(--accent-success)' : 'var(--accent-danger)', 
                            fontSize: '0.78rem',
                            fontWeight: 600
                          }}>
                            {isLoan ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                            {isLoan ? 'Tôi cho vay' : 'Tôi đi vay'} • {group.debts.length} lần ghi
                          </span>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: isSettled ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255, 165, 2, 0.2)',
                        color: isSettled ? 'var(--accent-success)' : 'var(--accent-warning)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {isSettled ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {isSettled ? 'Đã xong' : 'Còn nợ'}
                      </span>
                    </div>

                    {/* Balance Information */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      background: 'var(--bg-input)',
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius-sm)',
                      marginTop: 4
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tổng số tiền</div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatVND(group.totalAmount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Đã thanh toán</div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-success)' }}>{formatVND(group.paidAmount)}</div>
                      </div>
                    </div>

                    {/* Remaining Amount Highlight */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Còn lại cần {isLoan ? 'thu' : 'trả'}:</span>
                      <span style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: 800, 
                        color: isSettled ? 'var(--text-secondary)' : isLoan ? 'var(--accent-success)' : 'var(--accent-danger)' 
                      }}>
                        {formatVND(group.remainingAmount)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden', margin: '2px 0' }}>
                      <div style={{
                        width: `${group.progressPercent}%`,
                        height: '100%',
                        background: isSettled ? 'var(--accent-success)' : isLoan ? 'var(--accent-info)' : 'var(--accent-warning)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Tiến độ thanh toán: {group.progressPercent}%</span>
                      {group.payments.length > 0 && <span>{group.payments.length} đợt trả</span>}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                      <button 
                        className={`btn ${isSettled ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem', justifyContent: 'center' }}
                        onClick={() => handleOpenPayment(group)}
                      >
                        <DollarSign size={14} /> Ghi nhận trả tiền
                      </button>

                      <button 
                        className="btn btn-ghost"
                        style={{ padding: '7px 10px', fontSize: '0.82rem' }}
                        onClick={() => {
                          setSelectedPersonGroup(group);
                          setShowHistoryModal(true);
                        }}
                        title="Xem lịch sử chi tiết"
                      >
                        <History size={14} /> Sổ chi tiết
                      </button>

                      <button 
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '7px' }}
                        onClick={() => handleOpenAddDebt({ person: group.person, type: group.type })}
                        title="Thêm khoản vay mới cho người này"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ==================== VIEW 2: ALL INDIVIDUAL RECORDS TABLE ==================== */
          <div style={{ overflowX: 'auto' }}>
            {debts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
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
                  {debts.map((d) => {
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
                            title="Click để đổi trạng thái"
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
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleOpenEditDebt(d)} title="Sửa">
                              <Edit2 size={13} />
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--accent-danger)' }} onClick={() => handleDeleteDebt(d.id)} title="Xóa">
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
        )}
      </div>

      {/* ==================== MODAL 1: ADD / EDIT DEBT ==================== */}
      {showDebtModal && (
        <div className="modal-overlay" onClick={() => setShowDebtModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingDebtId ? 'Chỉnh sửa khoản nợ' : 'Thêm ghi chép nợ mới'}</h3>
              <button className="modal-close" onClick={() => setShowDebtModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSaveDebt} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
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
                    background: debtFormData.type === 'loan' ? 'var(--accent-success)' : 'transparent',
                    color: debtFormData.type === 'loan' ? '#0a0b0f' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setDebtFormData(prev => ({ ...prev, type: 'loan' }))}
                >
                  Tôi cho vay (Nợ cần thu)
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
                    background: debtFormData.type === 'debt' ? 'var(--accent-danger)' : 'transparent',
                    color: debtFormData.type === 'debt' ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setDebtFormData(prev => ({ ...prev, type: 'debt' }))}
                >
                  Tôi đi vay (Nợ phải trả)
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
                  value={debtFormData.person}
                  onChange={(e) => setDebtFormData(prev => ({ ...prev, person: e.target.value }))}
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
                  value={debtFormData.amount}
                  onChange={(e) => setDebtFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              {/* Due Date */}
              <div className="form-group">
                <label className="form-label">Hạn trả nợ (Không bắt buộc)</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={debtFormData.dueDate}
                  onChange={(e) => setDebtFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Lý do / Ghi chú</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Ví dụ: Vay tiền đóng học, Cho mượn mua sắm..."
                  value={debtFormData.description}
                  onChange={(e) => setDebtFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDebtModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingDebtId ? 'Cập nhật' : 'Thêm ghi chép'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: RECORD PAYMENT (TRẢ NỢ LINH HOẠT) ==================== */}
      {showPaymentModal && paymentTarget && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={20} style={{ color: 'var(--accent-success)' }} />
                Ghi nhận trả tiền: {paymentTarget.person}
              </h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {/* Target info card */}
              <div style={{
                background: 'var(--bg-input)',
                padding: '12px 16px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {paymentTarget.type === 'loan' ? 'Họ đang nợ bạn:' : 'Bạn đang nợ họ:'}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', color: paymentTarget.type === 'loan' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {formatVND(paymentTarget.remainingAmount)}
                  </div>
                </div>

                {/* Quick preset buttons */}
                {paymentTarget.remainingAmount > 0 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => setPaymentFormData(prev => ({ ...prev, amount: (paymentTarget.remainingAmount / 2).toString() }))}
                    >
                      Trả 50%
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => setPaymentFormData(prev => ({ ...prev, amount: paymentTarget.remainingAmount.toString() }))}
                    >
                      Trả hết 100%
                    </button>
                  </div>
                )}
              </div>

              {/* Repayment Amount */}
              <div className="form-group">
                <label className="form-label">Số tiền thực tế thanh toán đợt này (VND) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Nhập số tiền trả..."
                  required
                  autoFocus
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              {/* Payment Date */}
              <div className="form-group">
                <label className="form-label">Ngày thanh toán *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  required
                  value={paymentFormData.paymentDate}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                />
              </div>

              {/* Payment Note */}
              <div className="form-group">
                <label className="form-label">Ghi chú (Tùy chọn)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ví dụ: Chuyển khoản Vietcombank, Trả tiền mặt..."
                  value={paymentFormData.note}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, note: e.target.value }))}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Xác nhận thanh toán</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: PERSON HISTORY & DETAIL LEDGER ==================== */}
      {showHistoryModal && selectedPersonGroup && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <History size={20} style={{ color: 'var(--accent-primary)' }} />
                  Sổ chi tiết: {selectedPersonGroup.person}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedPersonGroup.type === 'loan' ? 'Khoản tôi cho vay' : 'Khoản tôi đi vay'}
                </span>
              </div>
              <button className="modal-close" onClick={() => setShowHistoryModal(false)}><X size={16} /></button>
            </div>

            {/* Summary Cards in Modal */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              background: 'var(--bg-input)',
              padding: 12,
              borderRadius: 'var(--border-radius-sm)',
              marginBottom: 16
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Tổng số tiền</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{formatVND(selectedPersonGroup.totalAmount)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Đã thanh toán</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-success)' }}>{formatVND(selectedPersonGroup.paidAmount)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Còn lại</div>
                <div style={{ 
                  fontWeight: 800, 
                  fontSize: '0.95rem', 
                  color: selectedPersonGroup.status === 'settled' ? 'var(--text-secondary)' : selectedPersonGroup.type === 'loan' ? 'var(--accent-success)' : 'var(--accent-danger)' 
                }}>
                  {formatVND(selectedPersonGroup.remainingAmount)}
                </div>
              </div>
            </div>

            {/* Scrollable Timeline Lists */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
              {/* SECTION A: Lịch sử các lần cho vay / vay thêm */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    1. Các lần {selectedPersonGroup.type === 'loan' ? 'cho vay' : 'đi vay'} ({selectedPersonGroup.debts.length})
                  </h4>
                  <button 
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={() => {
                      setShowHistoryModal(false);
                      handleOpenAddDebt({ person: selectedPersonGroup.person, type: selectedPersonGroup.type });
                    }}
                  >
                    <Plus size={12} /> Thêm khoản mới
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedPersonGroup.debts.map((d) => (
                    <div 
                      key={d.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        padding: '8px 12px',
                        borderRadius: 'var(--border-radius-sm)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{formatVND(d.amount)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Ngày tạo: {d.createdAt ? d.createdAt.substring(0, 10) : '---'} {d.dueDate ? `• Hạn trả: ${d.dueDate}` : ''}
                        </div>
                        {d.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{d.description}</div>}
                      </div>

                      <div style={{ display: 'flex', gap: 4 }}>
                        <button 
                          className="btn btn-ghost btn-icon btn-sm" 
                          onClick={() => {
                            setShowHistoryModal(false);
                            handleOpenEditDebt(d);
                          }}
                          title="Sửa"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          className="btn btn-ghost btn-icon btn-sm" 
                          style={{ color: 'var(--accent-danger)' }}
                          onClick={() => handleDeleteDebt(d.id)}
                          title="Xóa"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION B: Lịch sử các lần đã trả tiền */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-success)' }}>
                    2. Lịch sử các đợt đã trả tiền ({selectedPersonGroup.payments.length})
                  </h4>
                  {selectedPersonGroup.remainingAmount > 0 && (
                    <button 
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      onClick={() => handleOpenPayment(selectedPersonGroup)}
                    >
                      <Plus size={12} /> Trả thêm
                    </button>
                  )}
                </div>

                {selectedPersonGroup.payments.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                    Chưa có ghi nhận đợt trả tiền nào.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedPersonGroup.payments.map((p) => (
                      <div 
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(46, 213, 115, 0.05)',
                          border: '1px solid rgba(46, 213, 115, 0.2)',
                          padding: '8px 12px',
                          borderRadius: 'var(--border-radius-sm)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--accent-success)' }}>
                            +{formatVND(p.amount)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Ngày trả: {p.paymentDate}
                          </div>
                          {p.note && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ghi chú: {p.note}</div>}
                        </div>

                        <button 
                          className="btn btn-ghost btn-icon btn-sm" 
                          style={{ color: 'var(--accent-danger)' }}
                          onClick={() => handleDeletePayment(p.id)}
                          title="Xóa đợt thanh toán này"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>Đóng</button>
              {selectedPersonGroup.remainingAmount > 0 && (
                <button type="button" className="btn btn-primary" onClick={() => handleOpenPayment(selectedPersonGroup)}>
                  <DollarSign size={14} /> Ghi nhận trả tiền
                </button>
              )}
            </div>
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
