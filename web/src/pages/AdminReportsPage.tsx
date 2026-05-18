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
  Activity
} from 'lucide-react';
import { adminApi } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const AdminReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState('revenue');
  const [dateRange, setDateRange] = useState('month'); // today, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    handleQuickFilter(dateRange);
  }, [reportType]);

  const handleQuickFilter = (range: string) => {
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
    setLoading(true);
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
      }
      setData(response?.data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!data || !data.details) return;
    
    let headers: string[] = [];
    let rows: any[] = [];
    
    switch (reportType) {
      case 'revenue':
        headers = ['Date', 'Customer', 'Vehicle', 'Type', 'Amount', 'Status'];
        rows = data.details.map((p: any) => [
          new Date(p.createdAt).toLocaleDateString(),
          p.booking.customer.fullName,
          `${p.booking.vehicle.brand} ${p.booking.vehicle.model}`,
          p.paymentType,
          p.amount,
          p.status
        ]);
        break;
      case 'bookings':
        headers = ['ID', 'Requested', 'Customer', 'Vehicle', 'Pickup', 'Return', 'Total', 'Status'];
        rows = data.details.map((b: any) => [
          b.id,
          new Date(b.createdAt).toLocaleDateString(),
          b.customer.fullName,
          `${b.vehicle.brand} ${b.vehicle.model}`,
          new Date(b.startDate).toLocaleDateString(),
          new Date(b.endDate).toLocaleDateString(),
          b.totalAmount,
          b.status
        ]);
        break;
      case 'payments':
        headers = ['Date', 'Customer', 'Vehicle', 'Type', 'Amount', 'Ref#', 'Status'];
        rows = data.details.map((p: any) => [
          new Date(p.createdAt).toLocaleDateString(),
          p.booking.customer.fullName,
          `${p.booking.vehicle.brand} ${p.booking.vehicle.model}`,
          p.paymentType,
          p.amount,
          p.proofs?.[0]?.referenceNumber || 'N/A',
          p.status
        ]);
        break;
      default:
        alert('Export for this report type is coming soon.');
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
    link.setAttribute('download', `jd-rental-${reportType}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderRevenueReport = () => {
    if (!data) return null;
    const avgBookingValue = data.details.length > 0 ? (data.breakdown.total / data.details.length) : 0;
    
    return (
      <div className="reports-dashboard">
        <div className="reports-kpi-grid">
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
              <TrendingUp size={20} />
            </div>
            <div className="kpi-value">₱{data.breakdown.total.toLocaleString()}</div>
            <div className="kpi-label">Total Verified Revenue</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F0F9FF', color: '#0284C7' }}>
              <CreditCard size={20} />
            </div>
            <div className="kpi-value">₱{data.breakdown.FULL_GCASH.toLocaleString()}</div>
            <div className="kpi-label">Full GCash Payments</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
              <Smartphone size={20} />
            </div>
            <div className="kpi-value">₱{data.breakdown.DOWNPAYMENT_GCASH.toLocaleString()}</div>
            <div className="kpi-label">Downpayments Received</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <DollarSign size={20} />
            </div>
            <div className="kpi-value">₱{data.breakdown.REMAINING_CASH.toLocaleString()}</div>
            <div className="kpi-label">Cash Collected at Pickup</div>
          </div>
          <div className="reports-kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: '#F9FAFB', color: '#4B5563' }}>
              <BarChart3 size={20} />
            </div>
            <div className="kpi-value">₱{Math.round(avgBookingValue).toLocaleString()}</div>
            <div className="kpi-label">Avg. Booking Value</div>
          </div>
        </div>

        <div className="reports-chart-grid">
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Revenue Breakdown by Payment Type</h3>
              <PieChart size={18} color="var(--gray-300)" />
            </div>
            <div className="bar-chart-container">
              {[
                { label: 'Full GCash', value: data.breakdown.FULL_GCASH, color: '#0284C7' },
                { label: 'Downpayment', value: data.breakdown.DOWNPAYMENT_GCASH, color: '#7C3AED' },
                { label: 'Cash Pickup', value: data.breakdown.REMAINING_CASH, color: '#16A34A' }
              ].map((item, idx) => {
                const height = data.breakdown.total > 0 ? (item.value / data.breakdown.total) * 100 : 0;
                return (
                  <div key={idx} className="bar-wrapper">
                    <div className="bar" style={{ height: `${height}%`, backgroundColor: item.color }}>
                      <div className="bar-tooltip">₱{item.value.toLocaleString()}</div>
                    </div>
                    <div className="bar-label">{item.label}</div>
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
                  strokeDasharray="70 30" strokeDashoffset="0"
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 900, fontSize: '1.5rem' }}>70%</div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '1.5rem', fontWeight: 700 }}>GCash vs Cash Ratio</p>
          </div>
        </div>

        <div className="reports-table-card">
          <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Verified Transactions</h3>
            <button onClick={exportToCSV} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: 'auto' }}>
              <Download size={14} /> Export CSV
            </button>
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
              {data.details.map((payment: any) => (
                <tr key={payment.id}>
                  <td className="text-sm">{new Date(payment.createdAt).toLocaleDateString()}</td>
                  <td className="text-sm font-semibold">{payment.booking.customer.fullName}</td>
                  <td className="text-sm">{payment.booking.vehicle.brand} {payment.booking.vehicle.model}</td>
                  <td>
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded-md" style={{ color: 'var(--gray-600)' }}>
                      {payment.paymentType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-sm font-black" style={{ color: '#16A34A' }}>₱{Number(payment.amount).toLocaleString()}</td>
                  <td><StatusBadge status={payment.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBookingReport = () => {
    if (!data) return null;
    const totalBookings = data.details.length;
    const completedCount = data.statusCounts['COMPLETED'] || 0;
    const activeCount = data.statusCounts['ACTIVE'] || 0;
    const pendingCount = data.statusCounts['PENDING_REVIEW'] || 0;
    const rejectedCount = data.statusCounts['REJECTED'] || 0;

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
              {data.details.map((booking: any) => (
                <tr key={booking.id}>
                  <td className="text-xs font-mono">#{booking.id.slice(0, 8).toUpperCase()}</td>
                  <td className="text-sm">{new Date(booking.createdAt).toLocaleDateString()}</td>
                  <td className="text-sm font-semibold">{booking.customer.fullName}</td>
                  <td className="text-sm">{booking.vehicle.brand} {booking.vehicle.model}</td>
                  <td className="text-xs">
                    {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                  </td>
                  <td className="text-sm font-black">₱{Number(booking.totalAmount).toLocaleString()}</td>
                  <td><StatusBadge status={booking.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderVehicleReport = () => {
    if (!data) return null;
    const utilization = Math.round(data.stats.utilizationRate * 100);
    
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
                {data.topRented.map((v: any) => (
                  <tr key={v.id}>
                    <td className="text-sm font-semibold">{v.brand} {v.model}</td>
                    <td className="text-xs font-mono">{v.licensePlate}</td>
                    <td className="text-sm font-black">{v.rentalsCount}</td>
                    <td className="text-sm font-bold" style={{ color: '#16A34A' }}>₱{v.revenue.toLocaleString()}</td>
                    <td><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
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
              {data.details.map((v: any) => (
                <tr key={v.id}>
                  <td className="text-sm font-semibold">{v.brand} {v.model}</td>
                  <td className="text-xs font-bold">{v.category}</td>
                  <td className="text-sm font-black">{v.rentalsCount}</td>
                  <td className="text-sm font-bold" style={{ color: '#16A34A' }}>₱{v.revenue.toLocaleString()}</td>
                  <td className="text-xs">{v.currentOdometerKm.toLocaleString()} KM</td>
                  <td><StatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPaymentReport = () => {
    if (!data) return null;
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
              {data.details.map((p: any) => (
                <tr key={p.id}>
                  <td className="text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="text-sm font-semibold">{p.booking.customer.fullName}</td>
                  <td className="text-xs font-bold">{p.paymentType.replace('_', ' ')}</td>
                  <td className="text-sm font-black">₱{Number(p.amount).toLocaleString()}</td>
                  <td className="text-xs font-mono">{p.proofs?.[0]?.referenceNumber || 'No ref provided'}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMaintenanceReport = () => {
    if (!data) return null;
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
                {data.maintenance.map((m: any) => (
                  <tr key={m.id}>
                    <td className="text-sm font-semibold">{m.vehicle.brand} {m.vehicle.model}</td>
                    <td className="text-xs font-bold">{m.serviceType}</td>
                    <td className="text-sm font-black">₱{Number(m.cost || 0).toLocaleString()}</td>
                    <td className="text-xs">{new Date(m.serviceDate).toLocaleDateString()}</td>
                    <td><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-card">
            <h3 className="chart-title" style={{ marginBottom: '1.5rem' }}>Damage Reports</h3>
            {data.damages.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No damage reports found</div>
            ) : (
              <div className="space-y-4">
                {data.damages.map((d: any) => (
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
                      <div className="text-[10px] text-gray-400">{new Date(d.reportedAt).toLocaleDateString()}</div>
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
    if (!data) return null;
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
              {data.details.map((a: any) => (
                <tr key={a.id}>
                  <td className="text-sm">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="text-sm font-semibold">{a.vehicle.brand} {a.vehicle.model}</td>
                  <td className="text-sm">{a.booking.customer.fullName}</td>
                  <td className="text-xs font-bold">{a.alertType}</td>
                  <td className="text-xs font-black" style={{ color: a.severity === 'HIGH' ? '#DC2626' : '#EA580C' }}>{a.severity}</td>
                  <td>{a.resolved ? <span className="text-green-600 font-bold text-xs">RESOLVED</span> : <span className="text-red-600 font-bold text-xs">PENDING</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="reports-dashboard">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--black)', marginBottom: '0.5rem' }}>Reports & Analytics</h1>
          <p style={{ color: 'var(--gray-500)', fontWeight: 600 }}>Analyze revenue, bookings, fleet usage, payments, maintenance, and safety alerts.</p>
        </div>
      </header>

      {/* Modern Filter Bar */}
      <div className="reports-filter-bar">
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

      {/* Navigation Tabs */}
      <div className="booking-tabs-container" style={{ width: '100%' }}>
        {[
          { id: 'revenue', label: 'Revenue', icon: <DollarSign size={16} /> },
          { id: 'bookings', label: 'Bookings', icon: <Calendar size={16} /> },
          { id: 'vehicles', label: 'Vehicles', icon: <Car size={16} /> },
          { id: 'payments', label: 'Payments', icon: <CreditCard size={16} /> },
          { id: 'maintenance', label: 'Maintenance', icon: <Wrench size={16} /> },
          { id: 'alerts', label: 'Alerts', icon: <ShieldAlert size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
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
        </div>
      )}
    </div>
  );
};

export default AdminReportsPage;
