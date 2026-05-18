import React, { useEffect, useState } from 'react';
import { paymentsApi, filesApi } from '../services/api';
import { Loader2, Check, X, Smartphone, AlertCircle, Receipt, Download, Clock, CheckCircle2, DollarSign, Wallet, FileText, Ban } from 'lucide-react';
import { Link } from 'react-router-dom';
import FilePreviewModal from '../components/FilePreviewModal';

const AdminPaymentVerificationPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'CASH_AT_PICKUP'>('SUBMITTED');
  const [summary, setSummary] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    fetchPayments();
  }, [activeTab]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      
      const [paymentsRes, summaryRes] = await Promise.all([
        activeTab === 'CASH_AT_PICKUP' 
          ? paymentsApi.getCashAtPickup() 
          : paymentsApi.getPaymentsByStatus(activeTab),
        paymentsApi.getPaymentSummary()
      ]);

      const normalizedData = Array.isArray(paymentsRes.data) 
        ? paymentsRes.data 
        : (paymentsRes.data?.records || paymentsRes.data?.cashCollections || []);
        
      setPayments(normalizedData);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!payments.length) return;
    
    const headers = ['Date', 'Customer', 'Vehicle', 'Booking ID', 'Amount', 'Reference #', 'Status'];
    const rows = payments.map((p: any) => {
      const isCashMode = activeTab === 'CASH_AT_PICKUP';
      const safePayments = Array.isArray(p.payments) ? p.payments : [];
      const paid = isCashMode ? safePayments.reduce((sum: number, pay: any) => sum + Number(pay.amount), 0) : 0;
      const amount = isCashMode ? (Number(p.totalAmount) - paid) : p.amount;
      const ref = isCashMode ? 'N/A' : (p.proofs?.[0]?.referenceNumber || 'No reference number provided');
      const customer = isCashMode ? p.customer?.fullName : p.booking?.customer?.fullName;
      const vehicle = isCashMode ? `${p.vehicle?.brand} ${p.vehicle?.model}` : `${p.booking?.vehicle?.brand} ${p.booking?.vehicle?.model}`;
      const bookingId = isCashMode ? p.id : p.bookingId;
      
      return [
        new Date(p.createdAt || p.updatedAt).toLocaleDateString(),
        customer,
        vehicle,
        `#${bookingId.slice(0, 8).toUpperCase()}`,
        amount,
        ref,
        isCashMode ? 'BALANCE DUE' : p.status
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `jd-payments-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAction = async (action: 'VERIFY' | 'REJECT' | 'CONFIRM_CASH') => {
    if (!selectedPayment) return;
    
    if (action === 'REJECT' && !remarks) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setActionLoading(true);
    try {
      if (action === 'VERIFY') {
        await paymentsApi.verify(selectedPayment.id);
      } else if (action === 'REJECT') {
        await paymentsApi.reject(selectedPayment.id, remarks);
      } else if (action === 'CONFIRM_CASH') {
        const safePayments = Array.isArray(selectedPayment.payments) ? selectedPayment.payments : [];
        const paidAmount = safePayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const remaining = Number(selectedPayment.totalAmount) - paidAmount;
        await paymentsApi.confirmCash(selectedPayment.id, remaining);
      }

      setSelectedPayment(null);
      setRemarks('');
      fetchPayments();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return '#AD9B8D';
      case 'VERIFIED': return '#2E7D32';
      case 'PAID_IN_PERSON': return '#2E7D32';
      case 'REJECTED': return '#C62828';
      case 'RESERVED': return '#1976D2';
      default: return 'var(--warm-taupe)';
    }
  };

  const isCashMode = activeTab === 'CASH_AT_PICKUP';

  return (
    <div className="payments-ledger-page">
      {/* Header */}
      <div className="payments-header">
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--black)', marginBottom: '0.5rem' }}>Payments Ledger</h1>
          <p style={{ color: 'var(--gray-500)', fontWeight: 600 }}>Review payment records, transaction history, and cash collections.</p>
        </div>
        <button onClick={exportToCSV} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '12px' }}>
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="payments-summary-section">
          {/* Workflow Summary */}
          <div className="payment-workflow-summary-card">
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--black)' }}>Payment Workflow</h3>
            <div className="payment-workflow-stat-grid">
              <div className="payment-workflow-stat">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={16} color="#EA580C" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Pending</span>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--black)' }}>{summary.pendingVerification}</span>
              </div>
              <div className="payment-workflow-stat">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} color="#16A34A" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Verified</span>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--black)' }}>{summary.verifiedHistory}</span>
              </div>
              <div className="payment-workflow-stat">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Ban size={16} color="#DC2626" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Rejected</span>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--black)' }}>{summary.rejected}</span>
              </div>
              <div className="payment-workflow-stat" style={{ borderRight: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wallet size={16} color="#0284C7" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Cash Pickups</span>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--black)' }}>{summary.cashCollections}</span>
              </div>
            </div>
          </div>

          {/* Revenue Summary */}
          <div className="payment-revenue-summary-card">
            <div className="payment-revenue-main">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <DollarSign size={16} color="var(--gray-400)" />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Verified Revenue</span>
              </div>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#16A34A' }}>₱{summary.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="payment-revenue-secondary">
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)' }}>Today's Collections</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7C3AED' }}>₱{summary.todayRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Tabs */}
      <div className="payments-tabs">
        {[
          { id: 'SUBMITTED', label: 'Pending Verification' },
          { id: 'VERIFIED', label: 'Verified History' },
          { id: 'REJECTED', label: 'Rejected' },
          { id: 'CASH_AT_PICKUP', label: 'Cash Collections' }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSelectedPayment(null); }}
            className={`payment-tab ${activeTab === tab.id ? 'payment-tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedPayment ? '1fr 480px' : '1fr', gap: '2rem', transition: 'all 0.3s' }}>
        {/* Payments List */}
        <div className="payments-table-card">
          <div className="table-container" style={{ maxHeight: 'calc(100vh - 400px)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Vehicle & Booking</th>
                  <th>Payment Type</th>
                  <th>Amount</th>
                  <th>Reference #</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '4rem', textAlign: 'center' }}>
                      <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--warm-taupe)' }} />
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="payments-empty-state">
                        {activeTab === 'SUBMITTED' && <><FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} /><h4>No payments waiting for verification.</h4><p>Submitted GCash receipts will appear here.</p></>}
                        {activeTab === 'VERIFIED' && <><CheckCircle2 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} /><h4>No verified payments yet.</h4></>}
                        {activeTab === 'REJECTED' && <><Ban size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} /><h4>No rejected payments.</h4></>}
                        {activeTab === 'CASH_AT_PICKUP' && <><Wallet size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} /><h4>No cash collections yet.</h4><p>Remaining balance payments confirmed at pickup will appear here.</p></>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map((item) => {
                    const safeItemPayments = Array.isArray(item.payments) ? item.payments : [];
                    const paid = isCashMode ? safeItemPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) : 0;
                    const remaining = isCashMode ? Number(item.totalAmount) - paid : 0;

                    return (
                      <tr 
                        key={item.id} 
                        style={{ 
                          backgroundColor: selectedPayment?.id === item.id ? 'rgba(173, 155, 141, 0.05)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onClick={() => setSelectedPayment(item)}
                        className="hover:bg-gray-50"
                      >
                        <td style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                          {new Date(item.createdAt || item.updatedAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{isCashMode ? item.customer?.fullName : item.booking.customer?.fullName}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            {isCashMode ? `${item.vehicle.brand} ${item.vehicle.model}` : `${item.booking.vehicle.brand} ${item.booking.vehicle.model}`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'monospace' }}>
                            #{isCashMode ? item.id.slice(0, 8).toUpperCase() : item.bookingId.slice(0, 8).toUpperCase()}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)' }}>
                            {isCashMode ? 'CASH BALANCE' : item.paymentType?.replace('_', ' ')}
                          </div>
                        </td>
                        <td style={{ fontWeight: 900, fontSize: '0.95rem', color: isCashMode ? '#DC2626' : '#16A34A' }}>
                          ₱{(isCashMode ? remaining : item.amount).toLocaleString()}
                        </td>
                        <td>
                          {isCashMode ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>N/A</span>
                          ) : (
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--gray-600)' }}>
                              {item.proofs?.[0]?.referenceNumber || <span style={{ color: 'var(--gray-400)', fontWeight: 500, fontStyle: 'italic' }}>No reference number provided</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="payment-status-badge" style={{ backgroundColor: getStatusColor(item.status), color: 'white' }}>
                            {isCashMode ? 'BALANCE DUE' : item.status}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn-outline"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px' }}
                            onClick={(e) => { e.stopPropagation(); setSelectedPayment(item); }}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Panel */}
        {selectedPayment && (
          <div className="payment-detail-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 className="card-title" style={{ margin: 0 }}>{isCashMode ? 'Cash Settlement' : 'Payment Audit'}</h2>
              <button 
                onClick={() => setSelectedPayment(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={24} color="var(--gray-400)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {!isCashMode ? (
                <>
                  <section style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--gray-400)', letterSpacing: '0.1em', fontWeight: 700 }}>Payment Record</h4>
                      <Receipt size={18} color="var(--warm-taupe)" />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--soft-beige)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Smartphone size={24} color="var(--warm-taupe)" />
                      </div>
                      <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace' }}>
                          {selectedPayment.proofs?.[0]?.referenceNumber || <span style={{ color: 'var(--gray-400)', fontSize: '0.9rem', fontStyle: 'italic', fontFamily: 'sans-serif' }}>No reference number provided</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 500 }}>GCash Reference Number</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px dashed var(--gray-200)', paddingTop: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 700 }}>Amount</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>₱{selectedPayment.amount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 700 }}>Status</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: getStatusColor(selectedPayment.status) }}>{selectedPayment.status}</div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: '1rem', letterSpacing: '0.1em', fontWeight: 700 }}>Proof of Payment</h4>
                    {selectedPayment.proofs?.[0]?.id ? (
                      <div 
                        onClick={() => setPreviewFile({ id: selectedPayment.proofs[0].id, title: 'GCash Receipt' })}
                        style={{ 
                          width: '100%', cursor: 'pointer', position: 'relative',
                          backgroundColor: 'var(--gray-50)', height: '200px', borderRadius: '16px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid var(--gray-200)', overflow: 'hidden'
                        }}
                      >
                        <div style={{ textAlign: 'center' }}>
                          <Smartphone size={40} color="var(--gray-300)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: 600 }}>Click to preview receipt</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', backgroundColor: 'var(--gray-50)', borderRadius: '16px', border: '1px dashed var(--gray-300)', textAlign: 'center' }}>
                        <AlertCircle size={32} color="var(--gray-300)" style={{ margin: '0 auto 1rem' }} />
                        <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>No proof image attached.</p>
                      </div>
                    )}
                  </section>

                  {activeTab === 'SUBMITTED' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <textarea 
                        className="input"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Audit notes or rejection reason..."
                        style={{ minHeight: '100px', padding: '1rem' }}
                      />
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                          onClick={() => handleAction('REJECT')} 
                          disabled={actionLoading} 
                          className="payments-action-button" 
                          style={{ flex: 1, backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                        >
                          <X size={18} /> Reject
                        </button>
                        <button 
                          onClick={() => handleAction('VERIFY')} 
                          disabled={actionLoading} 
                          className="payments-action-button" 
                          style={{ flex: 1, backgroundColor: 'var(--black)', color: 'white', border: 'none' }}
                        >
                          <Check size={18} /> Verify Payment
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: '1rem', letterSpacing: '0.1em', fontWeight: 700 }}>Source Booking</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--gray-50)', padding: '1rem', borderRadius: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>#{selectedPayment.booking.id.slice(0, 8).toUpperCase()}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{selectedPayment.booking.vehicle.brand} {selectedPayment.booking.vehicle.model}</div>
                      </div>
                      <Link to="/admin/bookings" style={{ color: 'var(--warm-taupe)', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>Go to Booking</Link>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <section style={{ backgroundColor: 'var(--gray-50)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--gray-100)' }}>
                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: '1.5rem', letterSpacing: '0.1em', fontWeight: 700 }}>Cash Collection Audit</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>Contract Amount:</span>
                        <span style={{ fontWeight: 700 }}>₱{Number(selectedPayment.totalAmount).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>Downpayment Verified:</span>
                        <span style={{ fontWeight: 700, color: 'var(--status-available)' }}>- ₱{selectedPayment.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--gray-300)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem' }}>Balance Outstanding:</span>
                        <span style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--black)' }}>
                          ₱{(Number(selectedPayment.totalAmount) - selectedPayment.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </section>

                    <div style={{ backgroundColor: 'rgba(173, 155, 141, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(173, 155, 141, 0.1)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                      Verify cash receipt for this booking. Confirming cash here will update the booking status to <strong>Ready for Pickup</strong>.
                    </p>
                    <button 
                      onClick={() => handleAction('CONFIRM_CASH')}
                      disabled={actionLoading}
                      className="payments-action-button"
                      style={{ width: '100%', backgroundColor: 'var(--black)', color: 'white', border: 'none' }}
                    >
                      {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><Check size={18} /> Confirm Cash Collection</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {previewFile && (
        <FilePreviewModal 
          fileId={previewFile.id}
          title={previewFile.title}
          onClose={() => setPreviewFile(null)}
          fetchFileBlob={filesApi.getProtectedFileBlob}
        />
      )}
    </div>
  );
};

export default AdminPaymentVerificationPage;
