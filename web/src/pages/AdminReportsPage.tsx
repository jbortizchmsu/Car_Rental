import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  ChevronRight, 
  Clock, 
  Loader2,
  TrendingUp,
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Car,
  Wrench,
  ShieldAlert,
  PieChart,
  Filter,
  DollarSign,
  Activity,
  Search
} from 'lucide-react';
import { adminApi } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { formatDate } from '../utils/formatDate';
import { useToast } from '../components/ToastProvider';
import { usePageHeader } from '../contexts/PageHeaderContext';

const AdminReportsPage: React.FC = () => {
  const toast = useToast();
  const { setPageHeader } = usePageHeader();
  const [reportType, setReportType] = useState('revenue');
  const [dateRange, setDateRange] = useState('month'); // today, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'current' | 'custom'>('all');
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);

  useEffect(() => {
    setPageHeader({
      title: 'Reports & Analytics',
      subtitle: 'Analyze revenue, bookings, fleet usage, payments, maintenance, and safety alerts.',
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  useEffect(() => {
    handleQuickFilter(dateRange);
  }, [reportType]);

  const handleQuickFilter = (range: string) => {
    setCurrentPage(1);
    setDateRange(range);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'custom':
        return; // Don't trigger fetch yet, wait for manual input
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    fetchReport(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  const fetchReport = async (sDate = startDate, eDate = endDate) => {
    setCurrentPage(1);
    setLoading(true);
    setData(null); // clear stale data — prevents wrong-shape render while new fetch is in flight
    try {
      let response;
      const params = { startDate: sDate, endDate: eDate };
      
      switch (reportType) {
        case 'revenue':
          response = await adminApi.getRevenueReport(params);
          break;
        case 'bookings':
          response = await adminApi.getBookingReport(params);
          break;
        case 'vehicles':
          response = await adminApi.getVehicleReport(params);
          break;
        case 'payments':
          response = await adminApi.getPaymentReport(params);
          break;
        case 'maintenance':
          response = await adminApi.getMaintenanceReport(params);
          break;
        case 'alerts':
          response = await adminApi.getGeofenceAlertReport(params);
          break;
        case 'snapshots':
          response = await adminApi.getReportSnapshots();
          break;
      }
      setData(response?.data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSnapshot = async () => {
    try {
      setLoading(true);
      await adminApi.saveReportSnapshot({
        reportType: reportType === 'snapshots' ? 'summary' : reportType,
        periodStart: startDate || new Date(Date.now() - 30 * 86400000).toISOString(),
        periodEnd: endDate || new Date().toISOString(),
        totalRevenue: data?.breakdown?.total || data?.stats?.totalRevenue || 0,
        totalBookings: data?.totalBookings || data?.stats?.totalBookings || (data?.details ? data.details.length : 0)
      });
      toast.success('Snapshot Saved', 'The current analytics snapshot has been archived to the database.');
      if (reportType === 'snapshots') {
        fetchReport();
      }
    } catch (err) {
      toast.error('Save Failed', 'Could not archive the report snapshot.');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!data || (!data.details && !data.snapshots)) return;
    const count = data.details?.length || data.snapshots?.length || 0;
    const totalP = Math.max(1, Math.ceil(count / pageSize));
    setExportScope('all');
    setFromPage(1);
    setToPage(totalP);
    setIsExportModalOpen(true);
  };

  const executeExportCSV = () => {
    if (!data || (!data.details && !data.snapshots)) return;

    let baseItems = reportType === 'snapshots' ? (data.snapshots || []) : (data.details || []);

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      if (reportType === 'revenue') {
        baseItems = baseItems.filter((payment: any) => {
          const customer = payment.booking?.customer?.fullName ?? '';
          const vehicle = `${payment.booking?.vehicle?.brand ?? ''} ${payment.booking?.vehicle?.model ?? ''}`;
          const type = (payment.paymentType ?? '').replace('_', ' ');
          const rawType = payment.paymentType ?? '';
          const status = payment.status ?? '';
          const date = formatDate(payment.createdAt, 'short');
          return (
            customer.toLowerCase().includes(term) ||
            vehicle.toLowerCase().includes(term) ||
            type.toLowerCase().includes(term) ||
            rawType.toLowerCase().includes(term) ||
            status.toLowerCase().includes(term) ||
            date.toLowerCase().includes(term)
          );
        });
      } else if (reportType === 'bookings') {
        baseItems = baseItems.filter((b: any) => {
          const id = b.id ?? '';
          const customer = b.customer?.fullName ?? '';
          const vehicle = `${b.vehicle?.brand ?? ''} ${b.vehicle?.model ?? ''}`;
          return id.toLowerCase().includes(term) || customer.toLowerCase().includes(term) || vehicle.toLowerCase().includes(term);
        });
      }
    }

    const totalP = Math.max(1, Math.ceil(baseItems.length / pageSize));
    const validCurrPage = Math.min(currentPage, totalP);

    let targetItems: any[] = [];
    let fileSuffix = 'all';

    if (exportScope === 'current') {
      const start = (validCurrPage - 1) * pageSize;
      targetItems = baseItems.slice(start, start + pageSize);
      fileSuffix = `page-${validCurrPage}`;
    } else if (exportScope === 'custom') {
      const startP = Math.max(1, Math.min(fromPage, totalP));
      const endP = Math.max(startP, Math.min(toPage, totalP));
      const start = (startP - 1) * pageSize;
      const end = endP * pageSize;
      targetItems = baseItems.slice(start, end);
      fileSuffix = `pages-${startP}-to-${endP}`;
    } else {
      targetItems = baseItems;
      fileSuffix = 'all';
    }

    if (targetItems.length === 0) {
      toast.info('No Records', 'There are no records to export for this selection.');
      setIsExportModalOpen(false);
      return;
    }

    let headers: string[] = [];
    let rows: any[] = [];

    switch (reportType) {
      case 'revenue':
        headers = ['Date', 'Customer', 'Vehicle', 'Payment Type', 'Amount', 'Status'];
        rows = targetItems.map((p: any) => [
          new Date(p.createdAt).toLocaleDateString(),
          p.booking?.customer?.fullName || 'N/A',
          `${p.booking?.vehicle?.brand || ''} ${p.booking?.vehicle?.model || ''}`,
          p.paymentType,
          p.amount,
          p.status
        ]);
        break;
      case 'bookings':
        headers = ['ID', 'Requested', 'Customer', 'Vehicle', 'Pickup', 'Return', 'Total', 'Status'];
        rows = targetItems.map((b: any) => [
          b.id,
          new Date(b.createdAt).toLocaleDateString(),
          b.customer?.fullName || 'N/A',
          `${b.vehicle?.brand || ''} ${b.vehicle?.model || ''}`,
          new Date(b.startDate).toLocaleDateString(),
          new Date(b.endDate).toLocaleDateString(),
          b.totalAmount,
          b.status
        ]);
        break;
      case 'payments':
        headers = ['Date', 'Customer', 'Vehicle', 'Type', 'Amount', 'Ref#', 'Status'];
        rows = targetItems.map((p: any) => [
          new Date(p.createdAt).toLocaleDateString(),
          p.booking?.customer?.fullName || 'N/A',
          `${p.booking?.vehicle?.brand || ''} ${p.booking?.vehicle?.model || ''}`,
          p.paymentType,
          p.amount,
          p.proofs?.[0]?.referenceNumber || 'N/A',
          p.status
        ]);
        break;
      case 'snapshots':
        headers = ['Snapshot ID', 'Report Type', 'Start Period', 'End Period', 'Total Revenue', 'Total Bookings', 'Generated By', 'Captured At'];
        rows = targetItems.map((s: any) => [
          s.id,
          s.reportType,
          new Date(s.periodStart).toLocaleDateString(),
          new Date(s.periodEnd).toLocaleDateString(),
          s.totalRevenue,
          s.totalBookings,
          s.generatedBy?.fullName || 'System Admin',
          new Date(s.generatedAt).toLocaleString()
        ]);
        break;
      default:
        toast.info('Export Unavailable', 'Export for this report type is coming soon.');
        setIsExportModalOpen(false);
        return;
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `jd-rental-${reportType}-${fileSuffix}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV Exported', `Successfully exported ${targetItems.length} transaction(s).`);
    setIsExportModalOpen(false);
  };

  const renderRevenueReport = () => {
    if (!data) return null;
    const totalRev = Number(data.breakdown?.total || 0);
    const fullGcash = Number(data.breakdown?.FULL_GCASH || 0);
    const downpaymentGcash = Number(data.breakdown?.DOWNPAYMENT_GCASH || 0);
    const remainingCash = Number(data.breakdown?.REMAINING_CASH || 0);
    const gcashTotal = fullGcash + downpaymentGcash;
    const gcashRatio = totalRev > 0 ? Math.round((gcashTotal / totalRev) * 100) : 0;
    const avgBookingValue = data.details?.length > 0 ? (totalRev / data.details.length) : 0;
    
    const filteredDetails = (data.details || []).filter((payment: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const customer = payment.booking?.customer?.fullName ?? '';
      const vehicle = `${payment.booking?.vehicle?.brand ?? ''} ${payment.booking?.vehicle?.model ?? ''}`;
      const type = (payment.paymentType ?? '').replace('_', ' ');
      const rawType = payment.paymentType ?? '';
      const status = payment.status ?? '';
      const date = formatDate(payment.createdAt, 'short');
      return (
        customer.toLowerCase().includes(term) ||
        vehicle.toLowerCase().includes(term) ||
        type.toLowerCase().includes(term) ||
        rawType.toLowerCase().includes(term) ||
        status.toLowerCase().includes(term) ||
        date.toLowerCase().includes(term)
      );
    });

    const totalRecords = filteredDetails.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const validCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (validCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const paginatedDetails = filteredDetails.slice(startIndex, endIndex);

    return (
      <div className="reports-dashboard">
        <div className="reports-kpi-grid">
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
              <TrendingUp size={20} />
            </div>
            <div className="kpi-value">₱{totalRev.toLocaleString()}</div>
            <div className="kpi-label">Total Verified Revenue</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0F9FF', color: '#0284C7' }}>
              <CreditCard size={20} />
            </div>
            <div className="kpi-value">₱{fullGcash.toLocaleString()}</div>
            <div className="kpi-label">Full GCash Payments</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
              <Smartphone size={20} />
            </div>
            <div className="kpi-value">₱{downpaymentGcash.toLocaleString()}</div>
            <div className="kpi-label">Downpayments Received</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <DollarSign size={20} />
            </div>
            <div className="kpi-value">₱{remainingCash.toLocaleString()}</div>
            <div className="kpi-label">Cash Collected at Pickup</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F9FAFB', color: '#4B5563' }}>
              <BarChart3 size={20} />
            </div>
            <div className="kpi-value">₱{Math.round(avgBookingValue).toLocaleString()}</div>
            <div className="kpi-label">Avg. Booking Value</div>
          </div>
          {data.maintenanceCost !== undefined && (
            <div className="reports-kpi-card">
              <div className="kpi-icon-wrapper" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                <Wrench size={20} />
              </div>
              <div className="kpi-value">₱{(data.maintenanceCost || 0).toLocaleString()}</div>
              <div className="kpi-label">Fleet Maintenance</div>
            </div>
          )}
          {data.netProfit !== undefined && (
            <div className="reports-kpi-card">
              <div className="kpi-icon-wrapper" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                <TrendingUp size={20} />
              </div>
              <div className="kpi-value" style={{ color: data.netProfit >= 0 ? '#059669' : '#DC2626' }}>
                ₱{(data.netProfit || 0).toLocaleString()}
              </div>
              <div className="kpi-label">Net Operating Profit</div>
            </div>
          )}
        </div>

        <div className="reports-chart-grid">
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Revenue Breakdown by Payment Type</h3>
              <PieChart size={18} color="var(--gray-300)" />
            </div>
            <div className="bar-chart-container">
              {[
                { label: 'Full GCash', value: fullGcash, color: '#0284C7' },
                { label: 'Downpayment', value: downpaymentGcash, color: '#7C3AED' },
                { label: 'Cash Pickup', value: remainingCash, color: '#16A34A' }
              ].map((item, idx) => {
                const pct = totalRev > 0 ? Math.round((item.value / totalRev) * 100) : 0;
                return (
                  <div key={idx} className="bar-wrapper">
                    <div className="bar-value">₱{item.value.toLocaleString()}</div>
                    <div className="bar-track">
                      <div 
                        className="bar" 
                        style={{ 
                          height: `${pct}%`, 
                          backgroundColor: item.color,
                          minHeight: item.value > 0 ? '6px' : '0px'
                        }}
                      >
                        <div className="bar-tooltip">₱{item.value.toLocaleString()} ({pct}%)</div>
                      </div>
                    </div>
                    <div className="bar-label">{item.label}</div>
                    <div className="bar-pct">{pct}% of revenue</div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <h3 className="chart-title" style={{ marginBottom: '2rem' }}>Revenue Composition</h3>
            <div style={{ position: 'relative', width: '150px', height: '150px' }}>
              <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#F3F4F6" strokeWidth="3" />
                <circle 
                  cx="18" cy="18" r="15.915" fill="transparent" stroke="var(--warm-taupe)" strokeWidth="3" 
                  strokeDasharray={`${gcashRatio} ${100 - gcashRatio}`} strokeDashoffset="0"
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 900, fontSize: '1.5rem' }}>{gcashRatio}%</div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '1.5rem', fontWeight: 700 }}>GCash vs Cash Ratio</p>
          </div>
        </div>

        <div className="reports-table-card">
          <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Verified Transactions</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleSaveSnapshot} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }} title="Save current report snapshot to ReportSnapshot table">
                <Clock size={14} /> Save Snapshot
              </button>
              <button onClick={exportToCSV} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Payment Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDetails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No matching transactions found for "{searchTerm}"
                  </td>
                </tr>
              ) : (
                paginatedDetails.map((payment: any) => (
                  <tr key={payment.id}>
                    <td className="text-sm">{formatDate(payment.createdAt, 'short')}</td>
                    <td className="text-sm font-semibold">{payment.booking?.customer?.fullName || 'N/A'}</td>
                    <td className="text-sm">{payment.booking?.vehicle?.brand || ''} {payment.booking?.vehicle?.model || ''}</td>
                    <td>
                      <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded-md" style={{ color: 'var(--gray-600)' }}>
                        {payment.paymentType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-sm font-black" style={{ color: '#16A34A' }}>₱{Number(payment.amount).toLocaleString()}</td>
                    <td><StatusBadge status={payment.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalRecords > 0 && (
            <div className="table-pagination">
              <div className="pagination-info">
                Showing <span style={{ fontWeight: 800, color: 'var(--black)' }}>{startIndex + 1}</span> to <span style={{ fontWeight: 800, color: 'var(--black)' }}>{endIndex}</span> of <span style={{ fontWeight: 800, color: 'var(--black)' }}>{totalRecords}</span> transactions
              </div>
              <div className="pagination-controls">
                <div className="page-size-selector">
                  <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600 }}>Show:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="page-select"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
                
                <div className="page-nav-buttons">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={validCurrentPage <= 1}
                    className="page-nav-btn"
                    title="Previous Page"
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - validCurrentPage) <= 1)
                    .reduce((acc: (number | string)[], p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) => (
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="page-ellipsis">...</span>
                      ) : (
                        <button
                          key={`page-${item}`}
                          onClick={() => setCurrentPage(item as number)}
                          className={`page-num-btn ${validCurrentPage === item ? 'active' : ''}`}
                        >
                          {item}
                        </button>
                      )
                    ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={validCurrentPage >= totalPages}
                    className="page-nav-btn"
                    title="Next Page"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBookingReport = () => {
    if (!data || !data.statusCounts || !data.details) return null;
    const totalBookings = data.details.length;
    const completedCount = data.statusCounts['COMPLETED'] || 0;
    const activeCount = data.statusCounts['ACTIVE'] || 0;
    const pendingCount = data.statusCounts['PENDING_REVIEW'] || 0;
    const rejectedCount = data.statusCounts['REJECTED'] || 0;

    const filteredBookings = data.details.filter((booking: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const id = booking.id ?? '';
      const shortId = `#${id.slice(0, 8)}`;
      const customer = booking.customer?.fullName ?? '';
      const vehicle = `${booking.vehicle?.brand ?? ''} ${booking.vehicle?.model ?? ''}`;
      const status = booking.status ?? '';
      return (
        id.toLowerCase().includes(term) ||
        shortId.toLowerCase().includes(term) ||
        customer.toLowerCase().includes(term) ||
        vehicle.toLowerCase().includes(term) ||
        status.toLowerCase().includes(term)
      );
    });

    return (
      <div className="reports-dashboard">
        <div className="reports-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {[
            { label: 'Total Volume', value: totalBookings, icon: <Activity />, bg: '#F9FAFB', color: '#4B5563' },
            { label: 'Pending Review', value: pendingCount, icon: <Clock />, bg: '#FFF7ED', color: '#EA580C' },
            { label: 'Active Rentals', value: activeCount, icon: <Car />, bg: '#F0F9FF', color: '#0284C7' },
            { label: 'Completed', value: completedCount, icon: <CheckCircle2 />, bg: '#F0FDF4', color: '#16A34A' },
            { label: 'Rejected', value: rejectedCount, icon: <AlertTriangle />, bg: '#FEF2F2', color: '#DC2626' }
          ].map((kpi, idx) => (
            <div key={idx} className="reports-kpi-card">
              <div className="kpi-icon-wrapper" style={{ backgroundColor: kpi.bg, color: kpi.color }}>
                {kpi.icon}
              </div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
          ))}
        </div>

        <div className="reports-table-card">
          <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Booking Lifecycle Records</h3>
            <button onClick={exportToCSV} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: 'auto' }}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Requested</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Dates</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    No matching bookings found for "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking: any) => (
                  <tr key={booking.id}>
                    <td className="text-xs font-mono">#{booking.id.slice(0, 8).toUpperCase()}</td>
                    <td className="text-sm">{formatDate(booking.createdAt, 'short')}</td>
                    <td className="text-sm font-semibold">{booking.customer.fullName}</td>
                    <td className="text-sm">{booking.vehicle.brand} {booking.vehicle.model}</td>
                    <td className="text-xs">
                      {formatDate(booking.startDate, 'short')} - {formatDate(booking.endDate, 'short')}
                    </td>
                    <td className="text-sm font-black">₱{Number(booking.totalAmount).toLocaleString()}</td>
                    <td><StatusBadge status={booking.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderVehicleReport = () => {
    if (!data || !data.stats || !data.topRented || !data.details) return null;
    const utilization = Math.round(data.stats.utilizationRate * 100);

    const filterVehicle = (v: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const vehicleName = `${v.brand ?? ''} ${v.model ?? ''}`;
      const plate = v.licensePlate ?? '';
      const category = v.category ?? '';
      const status = v.status ?? '';
      return (
        vehicleName.toLowerCase().includes(term) ||
        plate.toLowerCase().includes(term) ||
        category.toLowerCase().includes(term) ||
        status.toLowerCase().includes(term)
      );
    };

    const filteredTopRented = data.topRented.filter(filterVehicle);
    const filteredDetails = data.details.filter(filterVehicle);
    
    return (
      <div className="reports-dashboard">
        <div className="reports-kpi-grid">
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F9FAFB', color: '#4B5563' }}>
              <Car size={20} />
            </div>
            <div className="kpi-value">{data.stats.totalFleet}</div>
            <div className="kpi-label">Total Fleet Size</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0F9FF', color: '#0284C7' }}>
              <Activity size={20} />
            </div>
            <div className="kpi-value">{utilization}%</div>
            <div className="kpi-label">Fleet Utilization Rate</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <AlertTriangle size={20} />
            </div>
            <div className="kpi-value">{data.stats.oilChangeDue}</div>
            <div className="kpi-label">Oil Change Required</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
              <Wrench size={20} />
            </div>
            <div className="kpi-value">{data.stats.serviceSoon}</div>
            <div className="kpi-label">Service Due Soon</div>
          </div>
        </div>

        <div className="reports-chart-grid">
          <div className="chart-card">
            <h3 className="chart-title" style={{ marginBottom: '1.5rem' }}>Top Performing Vehicles (by Bookings)</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Plate</th>
                  <th>Rentals</th>
                  <th>Total Revenue</th>
                  <th>Current Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopRented.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">
                      No matching top vehicles found for "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  filteredTopRented.map((v: any) => (
                    <tr key={v.id}>
                      <td className="text-sm font-semibold">{v.brand} {v.model}</td>
                      <td className="text-xs font-mono">{v.licensePlate}</td>
                      <td className="text-sm font-black">{v.rentalsCount}</td>
                      <td className="text-sm font-bold" style={{ color: '#16A34A' }}>₱{v.revenue.toLocaleString()}</td>
                      <td><StatusBadge status={v.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="chart-card">
            <h3 className="chart-title" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Live Utilization</h3>
            <div className="utilization-gauge" style={{ '--percentage': `${utilization}%` } as any}>
              <div className="gauge-value">{utilization}%</div>
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '1.5rem', fontWeight: 700 }}>
              {data.stats.utilizedCount} of {data.stats.totalFleet} vehicles in use
            </p>
          </div>
        </div>

        <div className="reports-table-card">
          <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-100)' }}>
            <h3 className="card-title">Full Fleet Performance Data</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Category</th>
                <th>Rentals</th>
                <th>Revenue</th>
                <th>Mileage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDetails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No matching fleet vehicles found for "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filteredDetails.map((v: any) => (
                  <tr key={v.id}>
                    <td className="text-sm font-semibold">{v.brand} {v.model}</td>
                    <td className="text-xs font-bold">{v.category}</td>
                    <td className="text-sm font-black">{v.rentalsCount}</td>
                    <td className="text-sm font-bold" style={{ color: '#16A34A' }}>₱{v.revenue.toLocaleString()}</td>
                    <td className="text-xs">{v.currentOdometerKm.toLocaleString()} KM</td>
                    <td><StatusBadge status={v.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPaymentReport = () => {
    if (!data || !data.statusSummary || !data.details) return null;

    const filteredPayments = data.details.filter((p: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const customer = p.booking?.customer?.fullName ?? '';
      const vehicle = `${p.booking?.vehicle?.brand ?? ''} ${p.booking?.vehicle?.model ?? ''}`;
      const type = (p.paymentType ?? '').replace('_', ' ');
      const rawType = p.paymentType ?? '';
      const refNum = p.proofs?.[0]?.referenceNumber ?? '';
      const status = p.status ?? '';
      return (
        customer.toLowerCase().includes(term) ||
        vehicle.toLowerCase().includes(term) ||
        type.toLowerCase().includes(term) ||
        rawType.toLowerCase().includes(term) ||
        refNum.toLowerCase().includes(term) ||
        status.toLowerCase().includes(term)
      );
    });

    return (
      <div className="reports-dashboard">
        <div className="reports-kpi-grid">
          {Object.entries(data.statusSummary).map(([status, count]: any) => (
            <div key={status} className="reports-kpi-card">
              <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F9FAFB', color: '#4B5563' }}>
                <CheckCircle2 size={20} />
              </div>
              <div className="kpi-value">{count}</div>
              <div className="kpi-label">{status} Payments</div>
            </div>
          ))}
        </div>

        <div className="reports-table-card">
          <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Payment Transaction Ledger</h3>
            <button onClick={exportToCSV} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: 'auto' }}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Ref Number</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No matching payment transactions found for "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p: any) => (
                  <tr key={p.id}>
                    <td className="text-sm">{formatDate(p.createdAt, 'short')}</td>
                    <td className="text-sm font-semibold">{p.booking?.customer?.fullName ?? 'N/A'}</td>
                    <td className="text-xs font-bold">{p.paymentType?.replace('_', ' ') ?? '—'}</td>
                    <td className="text-sm font-black">₱{Number(p.amount ?? 0).toLocaleString()}</td>
                    <td className="text-xs font-mono">{p.proofs?.[0]?.referenceNumber ?? 'No ref provided'}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMaintenanceReport = () => {
    if (!data || !data.summary || !data.maintenance || !data.damages) return null;

    const filteredMaintenance = data.maintenance.filter((m: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const vehicle = `${m.vehicle?.brand ?? ''} ${m.vehicle?.model ?? ''}`;
      const type = m.serviceType ?? '';
      const desc = m.description ?? '';
      const status = m.status ?? '';
      return (
        vehicle.toLowerCase().includes(term) ||
        type.toLowerCase().includes(term) ||
        desc.toLowerCase().includes(term) ||
        status.toLowerCase().includes(term)
      );
    });

    const filteredDamages = data.damages.filter((d: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const vehicle = `${d.booking?.vehicle?.brand ?? ''} ${d.booking?.vehicle?.model ?? ''}`;
      const severity = d.severity ?? '';
      const desc = d.description ?? '';
      const status = d.status ?? '';
      return (
        vehicle.toLowerCase().includes(term) ||
        severity.toLowerCase().includes(term) ||
        desc.toLowerCase().includes(term) ||
        status.toLowerCase().includes(term)
      );
    });

    return (
      <div className="reports-dashboard">
        <div className="reports-kpi-grid">
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <TrendingUp size={20} />
            </div>
            <div className="kpi-value">₱{data.summary.totalMaintenanceCost.toLocaleString()}</div>
            <div className="kpi-label">Total Maintenance Cost</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
              <ShieldAlert size={20} />
            </div>
            <div className="kpi-value">₱{data.summary.totalDamageEstimate.toLocaleString()}</div>
            <div className="kpi-label">Pending Damage Estimates</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
              <Wrench size={20} />
            </div>
            <div className="kpi-value">{data.summary.pendingMaintenance}</div>
            <div className="kpi-label">Open Service Logs</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
              <AlertTriangle size={20} />
            </div>
            <div className="kpi-value">{data.summary.unresolvedDamages}</div>
            <div className="kpi-label">Unresolved Damage Reports</div>
          </div>
        </div>

        <div className="reports-chart-grid">
          <div className="chart-card">
            <h3 className="chart-title" style={{ marginBottom: '1.5rem' }}>Recent Maintenance Logs</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Cost</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">
                      No matching maintenance logs found for "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  filteredMaintenance.map((m: any) => (
                    <tr key={m.id}>
                      <td className="text-sm font-semibold">{m.vehicle.brand} {m.vehicle.model}</td>
                      <td className="text-xs font-bold">{m.serviceType}</td>
                      <td className="text-sm font-black">₱{Number(m.cost || 0).toLocaleString()}</td>
                      <td className="text-xs">{formatDate(m.serviceDate, 'short')}</td>
                      <td><StatusBadge status={m.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="chart-card">
            <h3 className="chart-title" style={{ marginBottom: '1.5rem' }}>Damage Reports</h3>
            {filteredDamages.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                {searchTerm ? `No matching damage reports found for "${searchTerm}"` : 'No damage reports found'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDamages.map((d: any) => (
                  <div key={d.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-sm">{d.booking.vehicle.brand} {d.booking.vehicle.model}</div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        d.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {d.severity}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{d.description}</div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs font-black text-red-600">₱{Number(d.estimatedCost || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400">{formatDate(d.reportedAt, 'short')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAlertReport = () => {
    if (!data || !data.stats || !data.details) return null;

    const filteredAlerts = data.details.filter((a: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const vehicle = `${a.vehicle?.brand ?? ''} ${a.vehicle?.model ?? ''}`;
      const customer = a.booking?.customer?.fullName ?? '';
      const alertType = a.alertType ?? '';
      const severity = a.severity ?? '';
      const status = a.resolved ? 'resolved' : 'pending';
      return (
        vehicle.toLowerCase().includes(term) ||
        customer.toLowerCase().includes(term) ||
        alertType.toLowerCase().includes(term) ||
        severity.toLowerCase().includes(term) ||
        status.toLowerCase().includes(term)
      );
    });

    return (
      <div className="reports-dashboard">
        <div className="reports-kpi-grid">
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F9FAFB', color: '#4B5563' }}>
              <ShieldAlert size={20} />
            </div>
            <div className="kpi-value">{data.stats.total}</div>
            <div className="kpi-label">Total Safety Alerts</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <AlertTriangle size={20} />
            </div>
            <div className="kpi-value">{data.stats.unresolved}</div>
            <div className="kpi-label">Unresolved Violations</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
              <CheckCircle2 size={20} />
            </div>
            <div className="kpi-value">{data.stats.resolved}</div>
            <div className="kpi-label">Resolved Incidents</div>
          </div>
        </div>

        <div className="reports-table-card">
          <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-100)' }}>
            <h3 className="card-title">Geofence & GPS Alert History</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Customer</th>
                <th>Alert Type</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No matching safety alerts found for "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((a: any) => (
                  <tr key={a.id}>
                    <td className="text-sm">{formatDate(a.createdAt, 'datetime')}</td>
                    <td className="text-sm font-semibold">{a.vehicle?.brand ?? '—'} {a.vehicle?.model ?? ''}</td>
                    <td className="text-sm">{a.booking?.customer?.fullName ?? 'N/A'}</td>
                    <td className="text-xs font-bold">{a.alertType ?? '—'}</td>
                    <td className="text-xs font-black" style={{ color: a.severity === 'HIGH' ? '#DC2626' : '#EA580C' }}>{a.severity ?? '—'}</td>
                    <td>{a.resolved ? <span className="text-green-600 font-bold text-xs">RESOLVED</span> : <span className="text-red-600 font-bold text-xs">PENDING</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSnapshotsReport = () => {
    if (!data) return null;
    const snapshotsList = data.snapshots || [];

    const filteredSnapshots = snapshotsList.filter((s: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const type = (s.reportType || '').toLowerCase();
      const user = (s.generatedBy?.fullName || '').toLowerCase();
      const id = (s.id || '').toLowerCase();
      const date = formatDate(s.generatedAt, 'short').toLowerCase();
      return type.includes(term) || user.includes(term) || id.includes(term) || date.includes(term);
    });

    return (
      <div className="reports-dashboard">
        <div className="reports-kpi-grid">
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0F9FF', color: '#0284C7' }}>
              <Clock size={20} />
            </div>
            <div className="kpi-value">{snapshotsList.length}</div>
            <div className="kpi-label">Archived Snapshots</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
              <TrendingUp size={20} />
            </div>
            <div className="kpi-value">
              ₱{(snapshotsList[0]?.totalRevenue || 0).toLocaleString()}
            </div>
            <div className="kpi-label">Latest Snapshot Revenue</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
              <Calendar size={20} />
            </div>
            <div className="kpi-value">
              {snapshotsList[0]?.totalBookings ?? 0}
            </div>
            <div className="kpi-label">Latest Snapshot Bookings</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F9FAFB', color: '#4B5563' }}>
              <CheckCircle2 size={20} />
            </div>
            <div className="kpi-value" style={{ fontSize: '1rem' }}>
              {snapshotsList[0]?.generatedAt ? formatDate(snapshotsList[0].generatedAt, 'short') : 'No History'}
            </div>
            <div className="kpi-label">Last Snapshot Taken</div>
          </div>
        </div>

        <div className="reports-table-card">
          <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">Archived Report Snapshots</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>
                Historical executive records stored in the ReportSnapshot database table.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={handleSaveSnapshot} 
                className="btn btn-primary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                title="Archive a fresh snapshot of current figures"
              >
                <Clock size={14} /> Capture Snapshot Now
              </button>
              <button onClick={exportToCSV} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Snapshot ID</th>
                <th>Report Type</th>
                <th>Period Range</th>
                <th>Total Revenue</th>
                <th>Total Bookings</th>
                <th>Generated By</th>
                <th>Captured At</th>
              </tr>
            </thead>
            <tbody>
              {filteredSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    {snapshotsList.length === 0 
                      ? "No report snapshots archived yet. Click 'Capture Snapshot Now' to create one."
                      : `No matching snapshots found for "${searchTerm}"`}
                  </td>
                </tr>
              ) : (
                filteredSnapshots.map((s: any) => (
                  <tr key={s.id}>
                    <td className="text-xs font-mono font-bold" style={{ color: 'var(--gray-600)' }}>
                      #{s.id.slice(-8).toUpperCase()}
                    </td>
                    <td>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '6px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        backgroundColor: s.reportType === 'revenue' ? '#F0FDF4' : s.reportType === 'summary' ? '#EFF6FF' : '#F3F4F6',
                        color: s.reportType === 'revenue' ? '#16A34A' : s.reportType === 'summary' ? '#2563EB' : '#4B5563',
                        textTransform: 'uppercase'
                      }}>
                        {s.reportType}
                      </span>
                    </td>
                    <td className="text-xs">
                      {formatDate(s.periodStart, 'short')} - {formatDate(s.periodEnd, 'short')}
                    </td>
                    <td className="text-sm font-semibold" style={{ color: '#16A34A' }}>
                      ₱{Number(s.totalRevenue || 0).toLocaleString()}
                    </td>
                    <td className="text-sm font-bold">
                      {s.totalBookings || 0}
                    </td>
                    <td className="text-xs">
                      {s.generatedBy?.fullName || 'System Admin'}
                    </td>
                    <td className="text-xs text-gray-500">
                      {formatDate(s.generatedAt, 'datetime')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="reports-dashboard">
      {/* Modern Filter Bar */}
      <div className="reports-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="filter-group">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' }
            ].map(range => (
              <button 
                key={range.id}
                onClick={() => handleQuickFilter(range.id)}
                className={`filter-btn ${dateRange === range.id ? 'active' : ''}`}
              >
                {range.id === 'custom' && <Filter size={14} style={{ marginRight: '0.5rem' }} />}
                {range.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="filter-group" style={{ backgroundColor: 'var(--gray-50)', padding: '0.4rem 1rem', borderRadius: '12px', border: '1px solid var(--gray-200)' }}>
              <Calendar size={16} className="text-gray-400" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
                style={{ border: 'none', outline: 'none', background: 'none' }}
              />
              <ChevronRight size={14} className="text-gray-300" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm"
                style={{ border: 'none', outline: 'none', background: 'none' }}
              />
              <button 
                onClick={() => fetchReport()}
                style={{ backgroundColor: 'var(--black)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem' }}
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Client-side Search Input */}
        <div className="filter-group" style={{ backgroundColor: 'var(--gray-50)', padding: '0.4rem 0.8rem', borderRadius: '12px', border: '1px solid var(--gray-200)', minWidth: '240px', flex: '0 1 300px' }}>
          <Search size={16} className="text-gray-400" style={{ marginRight: '0.5rem', flexShrink: 0 }} />
          <input 
            type="text" 
            placeholder="Search report table..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="text-sm w-full"
            style={{ border: 'none', outline: 'none', background: 'none', width: '100%' }}
          />
          {searchTerm && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: '0.85rem', padding: '0 0.2rem' }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="booking-tabs-container" style={{ width: '100%' }}>
        {[
          { id: 'revenue', label: 'Revenue', icon: <DollarSign size={16} /> },
          { id: 'bookings', label: 'Bookings', icon: <Calendar size={16} /> },
          { id: 'vehicles', label: 'Vehicles', icon: <Car size={16} /> },
          { id: 'payments', label: 'Payments', icon: <CreditCard size={16} /> },
          { id: 'maintenance', label: 'Maintenance', icon: <Wrench size={16} /> },
          { id: 'alerts', label: 'Alerts', icon: <ShieldAlert size={16} /> },
          { id: 'snapshots', label: 'Snapshots', icon: <Clock size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setData(null); setSearchTerm(''); setCurrentPage(1); setReportType(tab.id); }}
            className={`booking-tab ${reportType === tab.id ? 'booking-tab-active' : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="reports-empty-state" style={{ padding: '8rem' }}>
          <Loader2 className="animate-spin" size={48} style={{ color: 'var(--warm-taupe)', marginBottom: '1.5rem' }} />
          <h3 className="empty-state-title">Synthesizing Analytics...</h3>
          <p className="empty-state-subtitle">We're gathering data from all departments to build your report.</p>
        </div>
      ) : (
        <div style={{ minHeight: '400px' }}>
          {reportType === 'revenue' && renderRevenueReport()}
          {reportType === 'bookings' && renderBookingReport()}
          {reportType === 'vehicles' && renderVehicleReport()}
          {reportType === 'payments' && renderPaymentReport()}
          {reportType === 'maintenance' && renderMaintenanceReport()}
          {reportType === 'alerts' && renderAlertReport()}
          {reportType === 'snapshots' && renderSnapshotsReport()}
        </div>
      )}

      {/* Export CSV Configuration Modal */}
      {isExportModalOpen && (
        <div className="export-modal-backdrop" onClick={() => setIsExportModalOpen(false)}>
          <div className="export-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="export-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', width: '36px', height: '36px' }}>
                  <Download size={18} />
                </div>
                <div>
                  <h3 className="export-modal-title">Export Transactions to CSV</h3>
                  <p className="export-modal-subtitle">
                    Select which pages or records to include in the exported report.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="export-modal-close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="export-modal-body">
              <div className="export-summary-pill">
                <span>Matching Records: <strong>{data?.details?.length || data?.snapshots?.length || 0}</strong></span>
                <span>•</span>
                <span>Page Size: <strong>{pageSize} rows/page</strong></span>
                <span>•</span>
                <span>Total Pages: <strong>{Math.max(1, Math.ceil((data?.details?.length || data?.snapshots?.length || 0) / pageSize))}</strong></span>
              </div>

              {/* Option 1: All Pages */}
              <label className={`export-radio-card ${exportScope === 'all' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="exportScope"
                  value="all"
                  checked={exportScope === 'all'}
                  onChange={() => setExportScope('all')}
                />
                <div className="export-radio-content">
                  <div className="export-radio-title">All Pages (Full Dataset)</div>
                  <div className="export-radio-desc">
                    Exports all {data?.details?.length || data?.snapshots?.length || 0} transactions for the current period across all {Math.max(1, Math.ceil((data?.details?.length || data?.snapshots?.length || 0) / pageSize))} page(s).
                  </div>
                </div>
              </label>

              {/* Option 2: Current Page Only */}
              <label className={`export-radio-card ${exportScope === 'current' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="exportScope"
                  value="current"
                  checked={exportScope === 'current'}
                  onChange={() => setExportScope('current')}
                />
                <div className="export-radio-content">
                  <div className="export-radio-title">
                    Current Page Only (Page {Math.min(currentPage, Math.max(1, Math.ceil((data?.details?.length || data?.snapshots?.length || 0) / pageSize)))})
                  </div>
                  <div className="export-radio-desc">
                    Exports only the records visible on the current page (up to {pageSize} transactions).
                  </div>
                </div>
              </label>

              {/* Option 3: Custom Page Range */}
              <label className={`export-radio-card ${exportScope === 'custom' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="exportScope"
                  value="custom"
                  checked={exportScope === 'custom'}
                  onChange={() => setExportScope('custom')}
                />
                <div className="export-radio-content">
                  <div className="export-radio-title">Custom Page Range</div>
                  <div className="export-radio-desc">
                    Specify the starting and ending page numbers to include.
                  </div>
                  
                  {exportScope === 'custom' && (
                    <div className="export-range-inputs" onClick={(e) => e.stopPropagation()}>
                      <div className="range-field">
                        <label>From Page</label>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, Math.ceil((data?.details?.length || data?.snapshots?.length || 0) / pageSize))}
                          value={fromPage}
                          onChange={(e) => setFromPage(Math.max(1, Math.min(Math.max(1, Math.ceil((data?.details?.length || data?.snapshots?.length || 0) / pageSize)), Number(e.target.value))))}
                          className="range-input"
                        />
                      </div>
                      <span className="range-separator">to</span>
                      <div className="range-field">
                        <label>To Page</label>
                        <input
                          type="number"
                          min={fromPage}
                          max={Math.max(1, Math.ceil((data?.details?.length || data?.snapshots?.length || 0) / pageSize))}
                          value={toPage}
                          onChange={(e) => setToPage(Math.max(fromPage, Math.min(Math.max(1, Math.ceil((data?.details?.length || data?.snapshots?.length || 0) / pageSize)), Number(e.target.value))))}
                          className="range-input"
                        />
                      </div>
                      <div className="range-hint">
                        (Exports {Math.min(data?.details?.length || data?.snapshots?.length || 0, Math.max(0, (toPage - fromPage + 1) * pageSize))} transactions)
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="export-modal-footer">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="btn btn-outline"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                onClick={executeExportCSV}
                className="btn btn-primary"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#16A34A', borderColor: '#16A34A' }}
              >
                <Download size={15} /> Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReportsPage;
