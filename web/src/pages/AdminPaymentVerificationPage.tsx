import React, { useEffect, useState, useMemo } from 'react';
import { paymentsApi, getApiErrorMessage } from '../services/api';
import { Loader2, Download, FileText, Search, Plus, CheckCircle } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { usePageHeader } from '../contexts/PageHeaderContext';

const AdminPaymentVerificationPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'CASH_AT_PICKUP'>('SUBMITTED');
  const [aggregates, setAggregates] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { setPageHeader } = usePageHeader();
  const toast = useToast();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('ALL');

  // Cash recording modal state
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashForm, setCashForm] = useState({
    customerId: '',
    amount: '',
    collectedBy: '',
    dateCollected: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    setPageHeader({
      title: 'Payments',
      subtitle: 'Review payment records, transaction history, and cash collections.',
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  const getDateParams = (filter: string) => {
    const now = new Date();
    if (filter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { startDate: today.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
    }
    if (filter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return { startDate: weekAgo.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
    }
    if (filter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: monthStart.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
    }
    return {};
  };

  useEffect(() => {
    fetchPayments();
  }, [activeTab, searchQuery, dateRangeFilter, paymentTypeFilter]);

  const fetchPayments = async () => {
    try {
      setLoading(true);

      const dateParams = getDateParams(dateRangeFilter);
      const queryParams = { ...dateParams, paymentType: paymentTypeFilter };

      const [paymentsRes, aggregatesRes] = await Promise.all([
        activeTab === 'CASH_AT_PICKUP'
          ? paymentsApi.getCashAtPickup(dateParams)
          : paymentsApi.getPaymentsByStatus(activeTab, queryParams),
        paymentsApi.getAggregates(queryParams)
      ]);

      const normalizedData = Array.isArray(paymentsRes.data)
        ? paymentsRes.data
        : (paymentsRes.data?.records || paymentsRes.data?.cashCollections || []);

      setPayments(normalizedData);
      setAggregates(aggregatesRes.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      toast.success('Exporting...', 'CSV export in progress');

      const statusFilter = activeTab === 'CASH_AT_PICKUP' ? undefined : activeTab;
      const dateParams = getDateParams(dateRangeFilter);
      const response = await paymentsApi.exportCSV(statusFilter, { ...dateParams, paymentType: paymentTypeFilter });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Export complete', 'CSV downloaded successfully');
    } catch (error) {
      toast.error('Export failed', getApiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'VERIFY' | 'REJECT' | 'CONFIRM_CASH' | null;
  }>({ isOpen: false, type: null });
  const [modalError, setModalError] = useState<string | null>(null);

  const handleAction = (action: 'VERIFY' | 'REJECT' | 'CONFIRM_CASH') => {
    if (!selectedPayment) return;
    if (action === 'REJECT' && !remarks) {
      return toast.warning('Remarks required', 'Please provide a reason for rejection.');
    }
    setModalError(null);
    setModalConfig({ isOpen: true, type: action });
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModalConfig({ isOpen: false, type: null });
    setModalError(null);
  };

  const executeModalAction = async () => {
    if (!selectedPayment || !modalConfig.type) return;

    setModalError(null);
    setActionLoading(true);

    try {
      if (modalConfig.type === 'VERIFY') {
        await paymentsApi.verify(selectedPayment.id);
        toast.success('Payment verified', 'The payment record has been updated successfully.');
      } else if (modalConfig.type === 'REJECT') {
        await paymentsApi.reject(selectedPayment.id, remarks);
        toast.success('Payment rejected', 'The customer has been notified to re-submit.');
      } else if (modalConfig.type === 'CONFIRM_CASH') {
        const safePayments = Array.isArray(selectedPayment.payments) ? selectedPayment.payments : [];
        const paidAmount = safePayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const remaining = Number(selectedPayment.totalAmount) - paidAmount;
        await paymentsApi.confirmCash(selectedPayment.id, remaining);
        toast.success('Cash payment confirmed', 'The remaining balance has been recorded.');
      }

      setSelectedPayment(null);
      setRemarks('');
      closeModal();
      fetchPayments();
    } catch (error: any) {
      setModalError(getApiErrorMessage(error));
      toast.error('Action failed', getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordCash = async () => {
    if (!cashForm.customerId || !cashForm.amount) {
      toast.warning('Missing fields', 'Please fill in customer and amount');
      return;
    }

    try {
      setActionLoading(true);
      toast.success('Cash payment recorded', 'The payment has been recorded successfully');
      setShowCashModal(false);
      setCashForm({
        customerId: '',
        amount: '',
        collectedBy: '',
        dateCollected: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchPayments();
    } catch (error) {
      toast.error('Recording failed', getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return '#EA580C';
      case 'VERIFIED': return '#16A34A';
      case 'PAID_IN_PERSON': return '#16A34A';
      case 'REJECTED': return '#DC2626';
      case 'RESERVED': return '#0284C7';
      default: return 'var(--warm-taupe)';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return '#FED7AA';
      case 'VERIFIED': return '#DCFCE7';
      case 'PAID_IN_PERSON': return '#DCFCE7';
      case 'REJECTED': return '#FEE2E2';
      case 'RESERVED': return '#DBEAFE';
      default: return 'var(--gray-100)';
    }
  };

  const isCashMode = activeTab === 'CASH_AT_PICKUP';

  const filteredPayments = useMemo(() => {
    let filtered = payments;

    if (paymentTypeFilter && paymentTypeFilter !== 'ALL' && !isCashMode) {
      filtered = filtered.filter((p: any) => p.paymentType?.includes(paymentTypeFilter));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p: any) => {
        const customer = isCashMode ? p.customer?.fullName : p.booking?.customer?.fullName;
        const bookingId = isCashMode ? p.id : p.bookingId;
        return customer?.toLowerCase().includes(query) || bookingId?.toLowerCase().includes(query);
      });
    }

    return filtered;
  }, [payments, searchQuery, paymentTypeFilter, isCashMode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* FILTER BAR - Single clean row */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)',
        flexWrap: 'wrap'
      }}>
        {/* Search - grows to fill available space */}
        <div style={{ position: 'relative', flex: '1 1 250px', minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input
            type="text"
            placeholder="Search customer or booking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              paddingLeft: '2.5rem',
              paddingRight: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--gray-200)',
              fontSize: '0.95rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Payment Type Dropdown */}
        <select
          value={paymentTypeFilter}
          onChange={(e) => setPaymentTypeFilter(e.target.value)}
          style={{
            height: '40px',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--gray-200)',
            backgroundColor: 'white',
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          <option value="ALL">All Payment Types</option>
          <option value="GCASH">GCash</option>
          <option value="CASH">Cash</option>
          <option value="BANK">Bank Transfer</option>
        </select>

        {/* Date Range Dropdown */}
        <select
          value={dateRangeFilter}
          onChange={(e) => setDateRangeFilter(e.target.value)}
          style={{
            height: '40px',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--gray-200)',
            backgroundColor: 'white',
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>

        {/* Reset Filters Button */}
        <button
          onClick={() => { setSearchQuery(''); setPaymentTypeFilter('ALL'); setDateRangeFilter('all'); }}
          style={{
            height: '40px',
            padding: '0 1rem',
            borderRadius: '8px',
            border: '1px solid var(--gray-300)',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 500,
            color: 'var(--gray-700)',
            whiteSpace: 'nowrap'
          }}
        >
          Reset
        </button>

        {/* Export CSV Button */}
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          style={{
            height: '40px',
            padding: '0 1rem',
            borderRadius: '8px',
            border: '1px solid var(--gray-300)',
            backgroundColor: exporting ? 'var(--gray-100)' : 'white',
            cursor: exporting ? 'not-allowed' : 'pointer',
            fontSize: '0.95rem',
            fontWeight: 500,
            color: 'var(--gray-700)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
            opacity: exporting ? 0.6 : 1
          }}
        >
          {exporting ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={18} />}
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* STATUS SUMMARY CARDS - 4 columns */}
      {aggregates && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* Pending Card */}
          <div
            onClick={() => setActiveTab('SUBMITTED')}
            style={{
              padding: '1.25rem',
              backgroundColor: activeTab === 'SUBMITTED' ? 'var(--gray-50)' : 'white',
              borderRadius: '12px',
              border: '1px solid var(--gray-200)',
              borderLeft: '4px solid #EA580C',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'SUBMITTED' ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={(e) => { if (activeTab !== 'SUBMITTED') e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { if (activeTab !== 'SUBMITTED') e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Pending</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>{aggregates.counts.pending}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#EA580C' }}>₱{Number(aggregates.amounts.pending).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>

          {/* Verified Card */}
          <div
            onClick={() => setActiveTab('VERIFIED')}
            style={{
              padding: '1.25rem',
              backgroundColor: activeTab === 'VERIFIED' ? 'var(--gray-50)' : 'white',
              borderRadius: '12px',
              border: '1px solid var(--gray-200)',
              borderLeft: '4px solid #16A34A',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'VERIFIED' ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={(e) => { if (activeTab !== 'VERIFIED') e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { if (activeTab !== 'VERIFIED') e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Verified</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>{aggregates.counts.verified}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#16A34A' }}>₱{Number(aggregates.amounts.verified).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>

          {/* Rejected Card */}
          <div
            onClick={() => setActiveTab('REJECTED')}
            style={{
              padding: '1.25rem',
              backgroundColor: activeTab === 'REJECTED' ? 'var(--gray-50)' : 'white',
              borderRadius: '12px',
              border: '1px solid var(--gray-200)',
              borderLeft: '4px solid #DC2626',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'REJECTED' ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={(e) => { if (activeTab !== 'REJECTED') e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { if (activeTab !== 'REJECTED') e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Rejected</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>{aggregates.counts.rejected}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#DC2626' }}>₱{Number(aggregates.amounts.rejected).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>

          {/* Cash Pickups Card */}
          <div
            onClick={() => setActiveTab('CASH_AT_PICKUP')}
            style={{
              padding: '1.25rem',
              backgroundColor: activeTab === 'CASH_AT_PICKUP' ? 'var(--gray-50)' : 'white',
              borderRadius: '12px',
              border: '1px solid var(--gray-200)',
              borderLeft: '4px solid #0284C7',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'CASH_AT_PICKUP' ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={(e) => { if (activeTab !== 'CASH_AT_PICKUP') e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { if (activeTab !== 'CASH_AT_PICKUP') e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Cash Pickups</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>{aggregates.counts?.cashPickups || 0}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0284C7' }}>₱{Number(aggregates.amounts?.cashPickups || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}

      {/* REVENUE PANEL - 3 columns */}
      {aggregates && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Total Verified Card */}
          <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--gray-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Total Verified</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#16A34A', marginBottom: '0.5rem' }}>₱{Number(aggregates.amounts?.verified || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Verified revenue total</div>
          </div>

          {/* This Month Card */}
          <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--gray-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>This Month</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>₱{Number(aggregates.revenue?.thisMonth || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            <div style={{ fontSize: '0.8rem', color: aggregates.revenue?.monthChange >= 0 ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
              {aggregates.revenue?.monthChange >= 0 ? '↑' : '↓'} {Math.abs(aggregates.revenue?.monthChange || 0).toFixed(1)}% vs last month
            </div>
          </div>

          {/* Outstanding Card */}
          <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--gray-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Outstanding</div>
            {Number(aggregates.revenue?.outstanding) === 0 ? (
              <>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16A34A', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} /> All Clear
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>No unpaid rentals</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#EA580C', marginBottom: '0.5rem' }}>₱{Number(aggregates.revenue?.outstanding || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{aggregates.revenue?.outstanding} unpaid rentals</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ borderBottom: '1px solid var(--gray-200)', display: 'flex', gap: '2rem' }}>
        {[
          { id: 'SUBMITTED', label: 'Pending Verification', badge: aggregates?.counts?.pending },
          { id: 'VERIFIED', label: 'Verified History', badge: aggregates?.counts?.verified },
          { id: 'REJECTED', label: 'Rejected', badge: aggregates?.counts?.rejected },
          { id: 'CASH_AT_PICKUP', label: 'Cash Collections', action: true }
        ].map((tab) => (
          <div key={tab.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => { setActiveTab(tab.id as any); setSelectedPayment(null); }}
              style={{
                padding: '1rem 0',
                borderBottom: activeTab === tab.id ? '3px solid var(--warm-taupe)' : '3px solid transparent',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? 'var(--black)' : 'var(--gray-600)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {tab.label}
              {tab.badge !== undefined && <span style={{ backgroundColor: 'var(--gray-200)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{tab.badge}</span>}
            </button>
            {tab.action && activeTab === 'CASH_AT_PICKUP' && (
              <button onClick={(e) => { e.stopPropagation(); setShowCashModal(true); }} style={{ padding: '0.25rem 0.75rem', backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}>
                <Plus size={14} /> Record
              </button>
            )}
          </div>
        ))}
      </div>

      {/* PAYMENTS TABLE */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} size={40} />
          <p>Loading payments...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
          <FileText size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No payments found</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--gray-200)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gray-200)', backgroundColor: 'var(--gray-50)' }}>
                <th style={{ textAlign: 'left', padding: '1rem', fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Customer</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Vehicle</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Booking ID</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Ref #</th>
                <th style={{ textAlign: 'center', padding: '1rem', fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '1rem', fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.9rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p: any, i: number) => {
                const isCashMode = activeTab === 'CASH_AT_PICKUP';
                const safePayments = Array.isArray(p.payments) ? p.payments : [];
                const paid = isCashMode ? safePayments.reduce((sum: number, pay: any) => sum + Number(pay.amount), 0) : 0;
                const amount = isCashMode ? (Number(p.totalAmount) - paid) : Number(p.amount);
                const ref = isCashMode ? 'N/A' : (p.proofs?.[0]?.referenceNumber || '-');
                const customer = isCashMode ? p.customer?.fullName : p.booking?.customer?.fullName;
                const vehicle = isCashMode ? `${p.vehicle?.brand} ${p.vehicle?.model}` : `${p.booking?.vehicle?.brand} ${p.booking?.vehicle?.model}`;
                const bookingId = isCashMode ? p.id : p.bookingId;
                const status = isCashMode ? 'BALANCE DUE' : p.status;
                const isOverdue = !isCashMode && new Date(p.booking?.endDate) < new Date() && p.status === 'SUBMITTED';

                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--gray-200)',
                      backgroundColor: isOverdue ? '#FED7AA' : i % 2 === 0 ? 'var(--gray-50)' : 'white',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => setSelectedPayment(p)}
                    onMouseEnter={(e) => { if (!isOverdue) e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'var(--gray-50)' : isOverdue ? '#FED7AA' : 'white'; }}
                  >
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{new Date(p.createdAt || p.updatedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{customer}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{vehicle}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>#${bookingId.slice(0, 8).toUpperCase()}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.95rem', fontWeight: 700 }}>₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--gray-600)' }} title={ref}>{ref.length > 15 ? ref.slice(0, 15) + '...' : ref}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ backgroundColor: getStatusBgColor(status), color: getStatusColor(status), padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {status}
                        {isOverdue && ' 🔴'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {activeTab === 'SUBMITTED' && (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); handleAction('VERIFY'); }} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>✓ Verify</button>
                          <button onClick={(e) => { e.stopPropagation(); handleAction('REJECT'); }} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>✕ Reject</button>
                        </div>
                      )}
                      {activeTab === 'CASH_AT_PICKUP' && (
                        <button onClick={(e) => { e.stopPropagation(); handleAction('CONFIRM_CASH'); }} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#0284C7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Record</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ACTION MODAL */}
      {modalConfig.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
              {modalConfig.type === 'VERIFY' && 'Verify Payment'}
              {modalConfig.type === 'REJECT' && 'Reject Payment'}
              {modalConfig.type === 'CONFIRM_CASH' && 'Confirm Cash Payment'}
            </h2>

            {modalConfig.type === 'REJECT' && (
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Reason for rejection..."
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)', marginBottom: '1rem', minHeight: '100px', fontFamily: 'inherit' }}
              />
            )}

            {modalError && <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{modalError}</div>}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={closeModal}
                disabled={actionLoading}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--gray-200)', color: 'var(--black)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={executeModalAction}
                disabled={actionLoading}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: modalConfig.type === 'REJECT' ? '#DC2626' : '#16A34A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {actionLoading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                {modalConfig.type === 'VERIFY' && 'Verify'}
                {modalConfig.type === 'REJECT' && 'Reject'}
                {modalConfig.type === 'CONFIRM_CASH' && 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASH RECORDING MODAL */}
      {showCashModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', maxWidth: '500px', width: '90%' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Record Cash Payment</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Amount</label>
                <input
                  type="number"
                  value={cashForm.amount}
                  onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Date Collected</label>
                <input
                  type="date"
                  value={cashForm.dateCollected}
                  onChange={(e) => setCashForm({ ...cashForm, dateCollected: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Notes</label>
              <textarea
                value={cashForm.notes}
                onChange={(e) => setCashForm({ ...cashForm, notes: e.target.value })}
                placeholder="Optional notes..."
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)', minHeight: '80px', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowCashModal(false)}
                disabled={actionLoading}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--gray-200)', color: 'var(--black)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleRecordCash}
                disabled={actionLoading || !cashForm.amount}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: actionLoading || !cashForm.amount ? 0.5 : 1 }}
              >
                {actionLoading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentVerificationPage;
