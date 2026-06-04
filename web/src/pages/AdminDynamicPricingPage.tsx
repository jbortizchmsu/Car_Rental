import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Calendar, Zap, Info,
  Edit2, Trash2, Power, Loader2,
  Search, Calculator, Tag, X,
  ShieldCheck, Clock, FileText, Plus
} from 'lucide-react';
import { pricingApi, vehiclesApi, getApiErrorMessage } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { usePageHeader } from '../contexts/PageHeaderContext';
import ConfirmActionModal from '../components/ConfirmActionModal';

interface PricingRule {
  id: string;
  name: string;
  type: 'SEASONAL' | 'WEEKEND' | 'DEMAND' | 'CATEGORY';
  multiplier: number;
  startDate?: string;
  endDate?: string;
  vehicleCategory?: string;
  utilizationThreshold?: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
}

const AdminDynamicPricingPage: React.FC = () => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'SEASONAL' as any,
    multiplier: 1.0,
    startDate: '',
    endDate: '',
    vehicleCategory: '',
    utilizationThreshold: '',
    description: '',
    isActive: true
  });

  // Preview State
  const [previewData, setPreviewData] = useState({
    vehicleId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
  });
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const toast = useToast();
  const { setPageHeader } = usePageHeader();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setPageHeader({
      title: 'Dynamic Pricing',
      subtitle: 'Create and manage dynamic pricing strategies'
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  useEffect(() => {
    fetchRules();
    fetchVehicles();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data } = await pricingApi.getRules();
      setRules(data);
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Failed to load pricing rules', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data } = await vehiclesApi.getAll();
      setVehicles(data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const handleOpenModal = (rule?: PricingRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        type: rule.type,
        multiplier: rule.multiplier,
        startDate: rule.startDate ? new Date(rule.startDate).toISOString().split('T')[0] : '',
        endDate: rule.endDate ? new Date(rule.endDate).toISOString().split('T')[0] : '',
        vehicleCategory: rule.vehicleCategory || '',
        utilizationThreshold: rule.utilizationThreshold?.toString() || '',
        description: rule.description || '',
        isActive: rule.isActive
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        type: 'SEASONAL',
        multiplier: 1.0,
        startDate: '',
        endDate: '',
        vehicleCategory: '',
        utilizationThreshold: '',
        description: '',
        isActive: true
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (editingRule) {
        await pricingApi.updateRule(editingRule.id, formData);
        toast.success('Rule Updated', 'The pricing rule has been saved successfully.');
      } else {
        await pricingApi.createRule(formData);
        toast.success('Rule Created', 'The new pricing rule has been applied.');
      }
      setShowModal(false);
      fetchRules();
    } catch (error: any) {
      toast.error('Failed to save rule', getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (id: string) => {
    setDeleteId(id);
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setDeleteId(null);
    setDeleteError(null);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await pricingApi.deleteRule(deleteId);
      toast.success('Rule Deleted', 'The pricing rule has been permanently removed.');
      fetchRules();
      closeDeleteModal();
    } catch (error: any) {
      setDeleteError(getApiErrorMessage(error));
      toast.error('Deletion failed', getApiErrorMessage(error));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await pricingApi.toggleRule(id);
      toast.success('Rule Status Changed', 'The pricing rule has been toggled.');
      fetchRules();
    } catch (error) {
      toast.error('Failed to toggle rule', getApiErrorMessage(error));
    }
  };

  const handlePreview = async () => {
    if (!previewData.vehicleId || !previewData.startDate || !previewData.endDate) return;
    try {
      setPreviewLoading(true);
      const { data } = await pricingApi.getQuote(previewData);
      setPreviewResult(data);
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const activeRulesCount = rules.filter(r => r.isActive).length;
  const seasonalCount = rules.filter(r => r.type === 'SEASONAL' && r.isActive).length;
  const averageMultiplier = rules.length > 0 
    ? rules.reduce((acc, r) => acc + r.multiplier, 0) / rules.length 
    : 1.0;

  const getRuleBadgeClass = (type: string) => {
    switch (type) {
      case 'SEASONAL': return 'badge-seasonal';
      case 'WEEKEND': return 'badge-weekend';
      case 'DEMAND': return 'badge-demand';
      case 'CATEGORY': return 'badge-category';
      default: return '';
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--gray-50)', padding: '1rem', borderRadius: '16px' }}>
            <Zap size={28} color="var(--warm-taupe)" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Rules</h4>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.25rem' }}>{activeRulesCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#DBEAFE', padding: '1rem', borderRadius: '16px' }}>
            <Calendar size={28} color="#1E40AF" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seasonal Tiers</h4>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.25rem' }}>{seasonalCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#D1FAE5', padding: '1rem', borderRadius: '16px' }}>
            <TrendingUp size={28} color="#065F46" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Multiplier</h4>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.25rem' }}>{averageMultiplier.toFixed(2)}x</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2.5rem' }}>
        {/* Rules Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Page Header with Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button
              onClick={() => handleOpenModal()}
              className="btn btn-brand"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '14px',
                boxShadow: '0 4px 12px rgba(173, 155, 141, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Plus size={20} /> Add New Rule
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Pricing Strategy List</h3>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input 
                  type="text" 
                  placeholder="Filter rules..." 
                  className="form-input"
                  style={{ paddingLeft: '2.75rem', width: '250px', backgroundColor: 'var(--gray-50)', border: 'none' }}
                />
              </div>
            </div>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rule Configuration</th>
                    <th>Type</th>
                    <th>Multiplier</th>
                    <th>Application Details</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '4rem' }}>
                        <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--warm-taupe)' }} />
                        <p style={{ marginTop: '1rem', color: 'var(--gray-500)', fontSize: '0.9rem' }}>Loading rules...</p>
                      </td>
                    </tr>
                  ) : rules.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '4rem' }}>
                        <Info size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
                        <p style={{ color: 'var(--gray-500)', fontSize: '1rem', fontWeight: 500 }}>No pricing rules configured yet.</p>
                      </td>
                    </tr>
                  ) : rules.map(rule => (
                    <tr key={rule.id}>
                      <td style={{ minWidth: '200px' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{rule.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: '0.25rem' }}>{rule.description || 'No description provided.'}</div>
                      </td>
                      <td>
                        <span className={`pricing-rule-badge ${getRuleBadgeClass(rule.type)}`}>
                          {rule.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 900, color: rule.multiplier > 1 ? 'var(--status-error)' : 'inherit', fontSize: '1.1rem' }}>
                        {rule.multiplier.toFixed(2)}x
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                        {rule.type === 'SEASONAL' && rule.startDate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Clock size={14} />
                            {new Date(rule.startDate).toLocaleDateString()} — {new Date(rule.endDate!).toLocaleDateString()}
                          </div>
                        )}
                        {rule.type === 'WEEKEND' && <div style={{ fontWeight: 600 }}>Saturday & Sunday</div>}
                        {rule.type === 'DEMAND' && <div>Utilization ≥ {(parseFloat(rule.utilizationThreshold as any) * 100).toFixed(0)}%</div>}
                        {rule.type === 'CATEGORY' && <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Tag size={14} /> {rule.vehicleCategory}</div>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: rule.isActive ? 'var(--status-available)' : 'var(--gray-300)' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: rule.isActive ? 'var(--status-available)' : 'var(--gray-400)' }}>
                            {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleOpenModal(rule)} className="btn-outline" style={{ padding: '0.5rem', borderRadius: '10px' }} title="Edit"><Edit2 size={16} /></button>
                          <button onClick={() => handleToggle(rule.id)} className="btn-outline" style={{ padding: '0.5rem', borderRadius: '10px', color: rule.isActive ? 'var(--status-error)' : 'var(--status-available)' }} title={rule.isActive ? 'Disable' : 'Enable'}><Power size={16} /></button>
                          <button onClick={() => openDeleteModal(rule.id)} className="btn-outline" style={{ padding: '0.5rem', borderRadius: '10px', color: 'var(--status-error)' }} title="Delete"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--gray-50)', borderRadius: '20px', display: 'flex', gap: '1rem', border: '1.5px dashed var(--gray-200)' }}>
            <Info color="var(--warm-taupe)" size={24} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-500)', lineHeight: 1.6 }}>
              <strong>Optimization Note:</strong> Rules are evaluated in descending order of priority. If multiple rules apply (e.g., Weekend + Seasonal), the system automatically selects the <strong>highest multiplier</strong> to ensure profitability during peak periods.
            </p>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="pricing-preview-card">
          <div className="pricing-preview-header">
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calculator size={22} color="var(--warm-taupe)" /> Pricing Preview
            </h3>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: 500 }}>Test how active rules affect a booking total.</p>
          </div>
          
          <div className="pricing-preview-body">
            <div className="pricing-field">
              <label className="form-label">Target Vehicle</label>
              <select 
                className="form-select"
                value={previewData.vehicleId}
                onChange={(e) => setPreviewData({...previewData, vehicleId: e.target.value})}
              >
                <option value="">Select a vehicle model...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.category}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="pricing-field">
                <label className="form-label">Pickup Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={previewData.startDate}
                  onChange={(e) => setPreviewData({...previewData, startDate: e.target.value})}
                />
              </div>
              <div className="pricing-field">
                <label className="form-label">Return Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={previewData.endDate}
                  onChange={(e) => setPreviewData({...previewData, endDate: e.target.value})}
                />
              </div>
            </div>

            <button 
              onClick={handlePreview}
              disabled={previewLoading || !previewData.vehicleId}
              className="btn-brand w-full" 
              style={{ marginTop: '0.5rem', padding: '1rem' }}
            >
              {previewLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 className="animate-spin" size={20} /> Calculating...
                </div>
              ) : 'Calculate Estimate'}
            </button>

            {previewResult ? (
              <div className="pricing-preview-result">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <ShieldCheck size={18} color="var(--status-available)" />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calculation Verified</span>
                </div>
                
                <div className="pricing-breakdown-row">
                  <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>Base Daily Rate</span>
                  <span style={{ fontWeight: 700 }}>₱{previewResult.baseDailyRate.toLocaleString()}</span>
                </div>
                <div className="pricing-breakdown-row">
                  <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>Rental Duration</span>
                  <span style={{ fontWeight: 700 }}>{previewResult.rentalDays} {previewResult.rentalDays === 1 ? 'Day' : 'Days'}</span>
                </div>
                <div className="pricing-breakdown-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                    <Tag size={14} /> Applied Multiplier
                  </span>
                  <span style={{ fontWeight: 800, color: previewResult.multiplier > 1 ? 'var(--status-error)' : 'var(--status-available)' }}>
                    {previewResult.multiplier.toFixed(2)}x
                  </span>
                </div>
                
                {previewResult.appliedRuleName ? (
                  <div style={{ padding: '0.75rem', backgroundColor: 'rgba(173, 155, 141, 0.1)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--warm-taupe)', fontWeight: 700, margin: '0.5rem 0' }}>
                    Rule: {previewResult.appliedRuleName}
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem', backgroundColor: 'rgba(22, 163, 74, 0.05)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--status-available)', fontWeight: 700, margin: '0.5rem 0' }}>
                    Standard rate applied (No rules active).
                  </div>
                )}

                <div className="pricing-breakdown-row pricing-total-row">
                  <span style={{ fontWeight: 800, fontSize: '1rem' }}>Final Total</span>
                  <span style={{ fontWeight: 900, fontSize: '1.4rem' }}>₱{previewResult.totalPrice.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--gray-200)', borderRadius: '16px', backgroundColor: 'var(--gray-50)' }}>
                <Search size={32} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-400)', fontWeight: 500 }}>
                  Choose a vehicle and rental dates to preview pricing estimates.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container pricing-modal">
            <div className="pricing-modal-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900 }}>{editingRule ? 'Edit Pricing Rule' : 'Create Pricing Rule'}</h2>
                  <p className="pricing-modal-subtitle">Create a pricing adjustment for peak dates, weekends, or demand changes.</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.5rem', borderRadius: '12px', backgroundColor: 'var(--gray-50)', color: 'var(--gray-400)' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="pricing-modal-grid">
                {/* Left Column: Rule Info */}
                <div className="pricing-form-section">
                  <div className="pricing-section-title">
                    <ShieldCheck size={14} /> Rule Information
                  </div>
                  
                  <div className="pricing-field">
                    <label className="form-label">Internal Rule Name</label>
                    <input 
                      required
                      className="form-input" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g., Christmas Peak Season"
                    />
                    <span className="pricing-helper-text">Give this rule a descriptive name for internal tracking.</span>
                  </div>

                  <div className="pricing-field">
                    <label className="form-label">Rule Type</label>
                    <select 
                      className="form-select"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="SEASONAL">Seasonal (Specific Date Range)</option>
                      <option value="WEEKEND">Weekend (Automatic Sat/Sun)</option>
                      <option value="DEMAND">Demand (Fleet Utilization Threshold)</option>
                      <option value="CATEGORY">Category (Specific Vehicle Class)</option>
                    </select>
                    <span className="pricing-helper-text">Determines when and how the multiplier is triggered.</span>
                  </div>
                </div>

                {/* Right Column: Pricing Adjustment */}
                <div className="pricing-form-section">
                  <div className="pricing-section-title">
                    <TrendingUp size={14} /> Pricing Adjustment
                  </div>

                  <div className="pricing-field">
                    <label className="form-label">Pricing Multiplier</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        step="0.01"
                        min="1"
                        required
                        className="form-input" 
                        style={{ paddingRight: '2.5rem' }}
                        value={formData.multiplier}
                        onChange={(e) => setFormData({...formData, multiplier: parseFloat(e.target.value)})}
                      />
                      <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--gray-400)' }}>x</span>
                    </div>
                    <span className="pricing-helper-text">Example: 1.20 means a 20% increase over base rate.</span>
                  </div>

                  {formData.type === 'SEASONAL' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div className="pricing-field">
                        <label className="form-label">Start Date</label>
                        <input 
                          type="date" 
                          required
                          className="form-input" 
                          value={formData.startDate}
                          onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                        />
                      </div>
                      <div className="pricing-field">
                        <label className="form-label">End Date</label>
                        <input 
                          type="date" 
                          required
                          className="form-input" 
                          value={formData.endDate}
                          onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                        />
                      </div>
                    </div>
                  )}

                  {formData.type === 'DEMAND' && (
                    <div className="pricing-field">
                      <label className="form-label">Utilization Threshold (0.1 to 1.0)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="1"
                        required
                        className="form-input" 
                        value={formData.utilizationThreshold}
                        onChange={(e) => setFormData({...formData, utilizationThreshold: e.target.value})}
                        placeholder="e.g. 0.8 for 80%"
                      />
                      <span className="pricing-helper-text">Apply multiplier when fleet usage reaches this level.</span>
                    </div>
                  )}

                  {formData.type === 'CATEGORY' && (
                    <div className="pricing-field">
                      <label className="form-label">Vehicle Category</label>
                      <select 
                        className="form-select"
                        value={formData.vehicleCategory}
                        onChange={(e) => setFormData({...formData, vehicleCategory: e.target.value})}
                      >
                        <option value="">Select Target Class...</option>
                        <option value="Sedan">Sedan</option>
                        <option value="SUV">SUV</option>
                        <option value="Van">Van</option>
                        <option value="Pickup">Pickup</option>
                        <option value="Luxury">Luxury</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Full Width Notes */}
                <div style={{ gridColumn: '1 / -1' }} className="pricing-form-section">
                  <div className="pricing-section-title">
                    <FileText size={14} /> Internal Notes
                  </div>
                  <div className="pricing-field">
                    <textarea 
                      className="form-textarea" 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      placeholder="Optional notes about why and when this rule should apply..."
                      style={{ minHeight: '100px' }}
                    />
                  </div>
                </div>
              </div>

              <div className="pricing-modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn-outline" 
                  style={{ padding: '0.8rem 2rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="btn-primary" 
                  style={{ padding: '0.8rem 3rem', minWidth: '180px' }}
                >
                  {isSubmitting ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Loader2 className="animate-spin" size={20} /> {editingRule ? 'Updating...' : 'Creating...'}
                    </div>
                  ) : (editingRule ? 'Update Pricing Strategy' : 'Create Pricing Strategy')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={deleteModalOpen}
        title="Delete Pricing Rule?"
        message="Are you sure you want to permanently delete this dynamic pricing rule? Active quotes using this rule will not be affected, but future quotes will revert to base rates."
        variant="danger"
        confirmLabel="Delete Rule"
        loading={deleteLoading}
        error={deleteError}
        onConfirm={executeDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
};

export default AdminDynamicPricingPage;
