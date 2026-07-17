import { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Calendar, 
  TrendingUp, TrendingDown, Wallet, DollarSign, 
  SlidersHorizontal, X, ArrowUpRight, ArrowDownRight, CreditCard
} from 'lucide-react';
import { transactionsAPI } from '../api';
import toast from 'react-hot-toast';

// Categories mapping and colors/labels in Vietnamese
const CATEGORY_MAP = {
  // Expense categories
  food: { label: 'Ăn uống', color: '#ff6b81', icon: '🍔' },
  transport: { label: 'Di chuyển', color: '#1e90ff', icon: '🚗' },
  shopping: { label: 'Mua sắm', color: '#ffa502', icon: '🛍️' },
  housing: { label: 'Nhà ở & Thuê nhà', color: '#ff7f50', icon: '🏠' },
  utilities: { label: 'Điện & Nước', color: '#70a1ff', icon: '💧' },
  internet: { label: 'Internet & Viễn thông', color: '#2ed573', icon: '🌐' },
  bills: { label: 'Hóa đơn & Tiện ích', color: '#ff4757', icon: '⚡' },
  entertainment: { label: 'Giải trí', color: '#a55eea', icon: '🎮' },
  education: { label: 'Học tập', color: '#2bcbba', icon: '📚' },
  health: { label: 'Sức khỏe', color: '#2ed573', icon: '❤️' },
  other_expense: { label: 'Chi tiêu khác', color: '#747d8c', icon: '💸' },
  
  // Income categories
  salary: { label: 'Lương', color: '#2ed573', icon: '💼' },
  bonus: { label: 'Thưởng', color: '#ffd32a', icon: '🎁' },
  investment: { label: 'Đầu tư', color: '#05c46b', icon: '📈' },
  other_income: { label: 'Thu nhập khác', color: '#0be881', icon: '💰' }
};

const PAYMENT_METHOD_MAP = {
  cash: { label: 'Tiền mặt', color: '#747d8c' },
  card: { label: 'Thẻ / Chuyển khoản', color: '#54a0ff' },
  'e-wallet': { label: 'Ví điện tử', color: '#ff9ff3' }
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().substring(0, 7)); // YYYY-MM
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Budget settings (persisted in localStorage)
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    return parseInt(localStorage.getItem('monthly_budget') || '10000000', 10);
  });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [tempBudget, setTempBudget] = useState(monthlyBudget);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    category: 'food',
    paymentMethod: 'cash',
    description: '',
    date: new Date().toISOString().substring(0, 10)
  });

  // Load transactions and statistics
  const fetchData = async () => {
    setLoading(true);
    try {
      // Calculate start and end date for the selected month to fetch exact list
      const year = parseInt(selectedMonth.split('-')[0], 10);
      const month = parseInt(selectedMonth.split('-')[1], 10);
      const startDate = `${selectedMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      const [listRes, statsRes] = await Promise.all([
        transactionsAPI.getAll({ startDate, endDate }),
        transactionsAPI.getStats({ month: selectedMonth })
      ]);

      setTransactions(listRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load transaction data:', err);
      toast.error('Không thể tải dữ liệu tài chính');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const handleBudgetSave = () => {
    localStorage.setItem('monthly_budget', tempBudget.toString());
    setMonthlyBudget(tempBudget);
    setShowBudgetModal(false);
    toast.success('Đã cập nhật hạn mức ngân sách!');
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      amount: '',
      type: 'expense',
      category: 'food',
      paymentMethod: 'cash',
      description: '',
      date: new Date().toISOString().substring(0, 10)
    });
    setShowModal(true);
  };

  const handleOpenEdit = (t) => {
    setEditingId(t.id);
    setFormData({
      amount: t.amount.toString(),
      type: t.type,
      category: t.category,
      paymentMethod: t.paymentMethod,
      description: t.description || '',
      date: t.date
    });
    setShowModal(true);
  };

  const handleTypeChangeInForm = (newType) => {
    setFormData(prev => ({
      ...prev,
      type: newType,
      category: newType === 'expense' ? 'food' : 'salary'
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(formData.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }

    try {
      if (editingId) {
        await transactionsAPI.update(editingId, formData);
        toast.success('Đã cập nhật giao dịch thành công');
      } else {
        await transactionsAPI.create(formData);
        toast.success('Đã thêm giao dịch mới');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Submit transaction error:', err);
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra khi lưu giao dịch');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
    try {
      await transactionsAPI.delete(id);
      toast.success('Đã xóa giao dịch');
      fetchData();
    } catch (err) {
      console.error('Delete transaction error:', err);
      toast.error('Không thể xóa giao dịch');
    }
  };

  // Filter transactions locally for quick responsive interface
  const filteredTransactions = transactions.filter(t => {
    const matchesType = !typeFilter || t.type === typeFilter;
    const matchesCategory = !categoryFilter || t.category === categoryFilter;
    const matchesPayment = !paymentFilter || t.paymentMethod === paymentFilter;
    const matchesSearch = !searchQuery || 
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (CATEGORY_MAP[t.category]?.label || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesCategory && matchesPayment && matchesSearch;
  });

  // Formatting currency helper
  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Budget calculations
  const totalExpense = stats?.summary?.monthExpense || 0;
  const totalIncome = stats?.summary?.monthIncome || 0;
  const monthBalance = stats?.summary?.monthBalance || 0;
  const budgetProgress = Math.min((totalExpense / monthlyBudget) * 100, 100);
  
  // Progress bar colors depending on budget utilization
  let progressColor = 'var(--accent-success)';
  if (budgetProgress >= 90) progressColor = 'var(--accent-danger)';
  else if (budgetProgress >= 70) progressColor = 'var(--accent-warning)';

  // Process data for charts
  // 1. Group daily stats to build standard monthly chart
  const year = parseInt(selectedMonth.split('-')[0], 10);
  const month = parseInt(selectedMonth.split('-')[1], 10);
  const totalDays = new Date(year, month, 0).getDate();
  
  const dailyDataMap = {};
  for (let d = 1; d <= totalDays; d++) {
    const dayStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
    dailyDataMap[dayStr] = { income: 0, expense: 0 };
  }
  
  if (stats?.dailyStats) {
    stats.dailyStats.forEach(dStat => {
      if (dailyDataMap[dStat.date]) {
        dailyDataMap[dStat.date][dStat.type] = dStat.total;
      }
    });
  }

  // Find max value to scale the custom bars nicely
  let maxDailyAmount = 100000; // base minimum scale
  Object.values(dailyDataMap).forEach(day => {
    if (day.income > maxDailyAmount) maxDailyAmount = day.income;
    if (day.expense > maxDailyAmount) maxDailyAmount = day.expense;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Quản lý Tài chính cá nhân</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Theo dõi, ghi chép thu nhập và chi tiêu hằng ngày của bạn</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '4px 8px' }}>
            <Calendar size={16} style={{ color: 'var(--text-secondary)', marginRight: 6 }} />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontWeight: 600 }}
            />
          </div>
          
          <button className="btn btn-secondary" onClick={() => { setTempBudget(monthlyBudget); setShowBudgetModal(true); }}>
            Hạn mức ngân sách
          </button>

          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Thêm giao dịch
          </button>
        </div>
      </div>

      {/* Main widgets grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--spacing-lg)' }}>
        {/* Income Card */}
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-success)', '--stat-color-rgb': '46, 213, 115' }}>
          <div className="stat-icon"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--accent-success)' }}>{formatVND(totalIncome)}</div>
            <div className="stat-label">Tổng thu nhập tháng này</div>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-danger)', '--stat-color-rgb': '255, 71, 87' }}>
          <div className="stat-icon"><TrendingDown size={24} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--accent-danger)' }}>{formatVND(totalExpense)}</div>
            <div className="stat-label">Tổng chi tiêu tháng này</div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="stat-card" style={{ '--stat-color': monthBalance >= 0 ? 'var(--accent-info)' : 'var(--accent-danger)', '--stat-color-rgb': monthBalance >= 0 ? '30, 144, 255' : '255, 71, 87' }}>
          <div className="stat-icon"><Wallet size={24} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: monthBalance >= 0 ? 'var(--accent-info)' : 'var(--accent-danger)' }}>
              {formatVND(monthBalance)}
            </div>
            <div className="stat-label">Số dư tích lũy trong tháng</div>
          </div>
        </div>

        {/* Budget Status Widget */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Ngân sách chi tiêu tháng</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{Math.round(budgetProgress)}%</span>
          </div>
          <div style={{ height: 10, background: 'var(--bg-input)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${budgetProgress}%`, height: '100%', background: progressColor, borderRadius: 5, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Đã dùng: {formatVND(totalExpense)}</span>
            <span>Hạn mức: {formatVND(monthlyBudget)}</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-lg)', alignItems: 'stretch' }} className="analytics-grid">
        {/* Daily chart card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-title">Biểu đồ thu chi hằng ngày ({selectedMonth})</div>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-success)' }} /> Thu nhập
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-danger)' }} /> Chi tiêu
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 250 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: 6, paddingBottom: 10, overflowX: 'auto', borderBottom: '1px solid var(--border-color)' }}>
              {Object.entries(dailyDataMap).map(([dayStr, vals]) => {
                const dateNum = dayStr.split('-')[2];
                const incHeight = (vals.income / maxDailyAmount) * 100;
                const expHeight = (vals.expense / maxDailyAmount) * 100;
                const hasActivity = vals.income > 0 || vals.expense > 0;

                return (
                  <div key={dayStr} style={{ flex: 1, minWidth: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: '80%', width: '100%', justifyContent: 'center' }}>
                      {/* Income bar */}
                      <div 
                        title={`Thu nhập ngày ${dateNum}: ${formatVND(vals.income)}`}
                        style={{ 
                          width: 6, 
                          height: `${Math.max(incHeight, vals.income > 0 ? 3 : 0)}%`, 
                          background: 'var(--accent-success)', 
                          borderRadius: '3px 3px 0 0',
                          opacity: hasActivity ? 1 : 0.2,
                          transition: 'height 0.3s ease'
                        }} 
                      />
                      {/* Expense bar */}
                      <div 
                        title={`Chi tiêu ngày ${dateNum}: ${formatVND(vals.expense)}`}
                        style={{ 
                          width: 6, 
                          height: `${Math.max(expHeight, vals.expense > 0 ? 3 : 0)}%`, 
                          background: 'var(--accent-danger)', 
                          borderRadius: '3px 3px 0 0',
                          opacity: hasActivity ? 1 : 0.2,
                          transition: 'height 0.3s ease'
                        }} 
                      />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: hasActivity ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: hasActivity ? 'bold' : 'normal' }}>
                      {dateNum}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category breakdown card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-title">Cơ cấu chi tiêu ({selectedMonth})</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
            {stats?.categoryBreakdown?.filter(c => c.type === 'expense').length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', minHeight: 150 }}>
                Chưa có dữ liệu chi tiêu tháng này
              </div>
            ) : (
              stats?.categoryBreakdown?.filter(c => c.type === 'expense').map((cStat, index) => {
                const catInfo = CATEGORY_MAP[cStat.category] || { label: cStat.category, color: '#747d8c', icon: '💸' };
                const pct = totalExpense > 0 ? (cStat.total / totalExpense) * 100 : 0;
                
                return (
                  <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <span>{catInfo.icon}</span>
                        <span>{catInfo.label}</span>
                      </span>
                      <span style={{ fontWeight: 600 }}>{formatVND(cStat.total)} <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 'normal' }}>({Math.round(pct)}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: catInfo.color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Interactive Transactions list widget */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* Table actions & filter bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Tìm kiếm giao dịch, ghi chú..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <SlidersHorizontal size={14} style={{ color: 'var(--text-secondary)' }} />
            
            <select className="form-select" style={{ width: 130, padding: '6px 12px', fontSize: '0.8rem' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Tất cả loại</option>
              <option value="income">Thu nhập (+)</option>
              <option value="expense">Chi tiêu (-)</option>
            </select>

            <select className="form-select" style={{ width: 140, padding: '6px 12px', fontSize: '0.8rem' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Tất cả danh mục</option>
              <optgroup label="Chi tiêu">
                <option value="food">Ăn uống</option>
                <option value="transport">Di chuyển</option>
                <option value="shopping">Mua sắm</option>
                <option value="housing">Nhà ở & Thuê nhà</option>
                <option value="utilities">Điện & Nước</option>
                <option value="internet">Internet & Viễn thông</option>
                <option value="bills">Hóa đơn</option>
                <option value="entertainment">Giải trí</option>
                <option value="education">Học tập</option>
                <option value="health">Sức khỏe</option>
                <option value="other_expense">Chi tiêu khác</option>
              </optgroup>
              <optgroup label="Thu nhập">
                <option value="salary">Lương</option>
                <option value="bonus">Thưởng</option>
                <option value="investment">Đầu tư</option>
                <option value="other_income">Thu nhập khác</option>
              </optgroup>
            </select>

            <select className="form-select" style={{ width: 155, padding: '6px 12px', fontSize: '0.8rem' }} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="">Tất cả P/T thanh toán</option>
              <option value="cash">Tiền mặt</option>
              <option value="card">Thẻ / Chuyển khoản</option>
              <option value="e-wallet">Ví điện tử</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div className="spinner" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div style={{ textAlignment: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Không tìm thấy giao dịch nào khớp với bộ lọc.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Ngày</th>
                  <th style={{ width: '10%' }}>Loại</th>
                  <th style={{ width: '18%' }}>Danh mục</th>
                  <th style={{ width: '15%' }}>P/T Thanh toán</th>
                  <th style={{ width: '25%' }}>Mô tả</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Số tiền</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => {
                  const catInfo = CATEGORY_MAP[t.category] || { label: t.category, color: '#747d8c', icon: '💸' };
                  const pmInfo = PAYMENT_METHOD_MAP[t.paymentMethod] || { label: t.paymentMethod, color: '#747d8c' };
                  
                  return (
                    <tr key={t.id} style={{ transition: 'background-color 0.2s' }}>
                      <td>{t.date}</td>
                      <td>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 4, 
                          color: t.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)', 
                          fontWeight: 'bold' 
                        }}>
                          {t.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {t.type === 'income' ? 'Thu' : 'Chi'}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: `${catInfo.color}15`, color: catInfo.color, alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                            {catInfo.icon}
                          </span>
                          <span style={{ fontWeight: 500 }}>{catInfo.label}</span>
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: `${pmInfo.color}15`, color: pmInfo.color }}>
                          <CreditCard size={12} style={{ marginRight: 2 }} />
                          {pmInfo.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxLine: 1, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {t.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Không có mô tả</span>}
                      </td>
                      <td style={{ 
                        textAlign: 'right', 
                        fontWeight: 'bold', 
                        fontSize: '0.95rem',
                        color: t.type === 'income' ? 'var(--accent-success)' : 'var(--text-primary)' 
                      }}>
                        {t.type === 'income' ? '+' : '-'}{formatVND(t.amount)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleOpenEdit(t)} title="Sửa">
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--accent-danger)' }} onClick={() => handleDelete(t.id)} title="Xóa">
                            <Trash2 size={14} />
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

      {/* Budget Limit Setup Modal */}
      {showBudgetModal && (
        <div className="modal-overlay" onClick={() => setShowBudgetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Đặt hạn mức chi tiêu tháng</h3>
              <button className="modal-close" onClick={() => setShowBudgetModal(false)}><X size={16} /></button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Hạn mức ngân sách hàng tháng (VND)</label>
              <input 
                type="number" 
                className="form-input" 
                value={tempBudget}
                onChange={(e) => setTempBudget(parseInt(e.target.value, 10) || 0)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Hệ thống sẽ tính phần trăm chi tiêu thực tế dựa trên hạn mức này để hiển thị cảnh báo.
              </span>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBudgetModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleBudgetSave}>Lưu thiết lập</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch mới'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {/* Type Switch */}
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
                    background: formData.type === 'expense' ? 'var(--accent-danger)' : 'transparent',
                    color: formData.type === 'expense' ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleTypeChangeInForm('expense')}
                >
                  Chi tiêu (Expense)
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
                    background: formData.type === 'income' ? 'var(--accent-success)' : 'transparent',
                    color: formData.type === 'income' ? '#0a0b0f' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleTypeChangeInForm('income')}
                >
                  Thu nhập (Income)
                </button>
              </div>

              {/* Amount input */}
              <div className="form-group">
                <label className="form-label">Số tiền (VND) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Ví dụ: 100000"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              {/* Date & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                <div className="form-group">
                  <label className="form-label">Ngày giao dịch *</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Danh mục *</label>
                  <select 
                    className="form-select" 
                    required
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {formData.type === 'expense' ? (
                      <>
                        <option value="food">🍔 Ăn uống</option>
                        <option value="transport">🚗 Di chuyển</option>
                        <option value="shopping">🛍️ Mua sắm</option>
                        <option value="housing">🏠 Nhà ở & Thuê nhà</option>
                        <option value="utilities">💧 Điện & Nước</option>
                        <option value="internet">🌐 Internet & Viễn thông</option>
                        <option value="bills">⚡ Hóa đơn & Tiện ích</option>
                        <option value="entertainment">🎮 Giải trí</option>
                        <option value="education">📚 Học tập</option>
                        <option value="health">❤️ Sức khỏe</option>
                        <option value="other_expense">💸 Chi tiêu khác</option>
                      </>
                    ) : (
                      <>
                        <option value="salary">💼 Lương</option>
                        <option value="bonus">🎁 Thưởng</option>
                        <option value="investment">📈 Đầu tư</option>
                        <option value="other_income">💰 Thu nhập khác</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label className="form-label">Phương thức thanh toán *</label>
                <select 
                  className="form-select"
                  required
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  <option value="cash">💵 Tiền mặt</option>
                  <option value="card">💳 Thẻ / Chuyển khoản ngân hàng</option>
                  <option value="e-wallet">📱 Ví điện tử</option>
                </select>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Mô tả giao dịch</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Ghi chú chi tiết giao dịch (ví dụ: Ăn trưa phở bò, Mua quà sinh nhật...)"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Cập nhật' : 'Thêm giao dịch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
