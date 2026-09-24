import React, { useEffect, useState, useMemo } from 'react';
import { Users, ShieldAlert, UserCheck, Search, CheckCircle2, XCircle, History, AlertTriangle, UserPlus, Ban, X } from 'lucide-react';
import { usersApi } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { usePageHeader } from '../contexts/PageHeaderContext';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { getApiErrorMessage } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { useInitialLoad } from '../utils/useInitialLoad';
import { formatDate } from '../utils/formatDate';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

// Small, self-contained badge for approvalStatus — deliberately NOT added to the shared
// StatusBadge.tsx dictionary: that component's keys ('PENDING', 'REJECTED', etc.) are
// already used for unrelated booking/payment statuses, and coupling approval-status
// colors to that shared map would risk an unrelated future change to booking/payment
// styling silently changing this badge too. Same visual pattern (padding/radius/
// fontSize/fontWeight/uppercase) as StatusBadge, just a dedicated small map here.
// Missing/undefined approvalStatus (older cached data) renders as 'approved' — matches
// the schema's own default and avoids ever showing a false "pending"/"rejected" badge.
function ApprovalBadge({ status }: { status: string | undefined }) {
  const resolved = status || 'approved';
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: '#FFF3E0', text: '#E65100', label: 'Pending' },
    approved: { bg: '#ECFDF5', text: '#10B981', label: 'Approved' },
    rejected: { bg: '#FEF2F2', text: '#EF4444', label: 'Rejected' },
  };
  const style = styles[resolved] || styles.approved;
  return (
    <span style={{
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 800,
      textTransform: 'uppercase',
      backgroundColor: style.bg,
      color: style.text,
      display: 'inline-block',
    }}>
      {style.label}
    </span>
  );
}

const AdminUserRolesPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // True only for the very first fetch — a post-action refresh (after approve/reject/
  // enable/disable/promote/demote) sets `loading` too, but must NOT replace the table
  // with the "Loading users..." text again; it should refresh in place.
  const isInitialLoad = useInitialLoad(loading);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [approvalFilter, setApprovalFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const toast = useToast();
  const { setPageHeader } = usePageHeader();

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'DISABLE' | 'ENABLE' | 'PROMOTE' | 'DEMOTE' | 'APPROVE' | 'REJECT' | null;
    targetUser: any;
  }>({ isOpen: false, type: null, targetUser: null });
  const [actionLoading, setActionLoading] = useState(false);
  // Only used by the REJECT modal — a genuinely optional reason (backend: z.string().
  // trim().min(1).optional()), reset whenever a new modal opens.
  const [rejectReason, setRejectReason] = useState('');

  useBodyScrollLock(selectedUser !== null);

  useEffect(() => {
    if (!selectedUser) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !modalConfig.isOpen) {
        setSelectedUser(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser, modalConfig.isOpen]);

  useEffect(() => {
    setPageHeader({
      title: 'User Roles & Accounts',
      subtitle: 'Manage user permissions and account status'
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await usersApi.getAll();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load users', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (id: string) => {
    try {
      setDetailsLoading(true);
      const { data } = await usersApi.getById(id);
      setUserDetails(data);
    } catch (error) {
      toast.error('Failed to load user details', getApiErrorMessage(error));
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    fetchUserDetails(user.id);
  };

  const openModal = (type: 'DISABLE' | 'ENABLE' | 'PROMOTE' | 'DEMOTE' | 'APPROVE' | 'REJECT', user: any) => {
    setRejectReason('');
    setModalConfig({ isOpen: true, type, targetUser: user });
  };

  const executeAction = async () => {
    const { type, targetUser } = modalConfig;
    if (!targetUser) return;

    setActionLoading(true);
    try {
      if (type === 'DISABLE') {
        await usersApi.updateStatus(targetUser.id, false);
        toast.success('User disabled', 'The user can no longer log in.');
      } else if (type === 'ENABLE') {
        await usersApi.updateStatus(targetUser.id, true);
        toast.success('User enabled', 'The user can now log in.');
      } else if (type === 'PROMOTE') {
        await usersApi.updateRole(targetUser.id, 'admin');
        toast.success('Role updated', 'User promoted to Admin.');
      } else if (type === 'DEMOTE') {
        await usersApi.updateRole(targetUser.id, 'customer');
        toast.success('Role updated', 'User demoted to Customer.');
      } else if (type === 'APPROVE') {
        await usersApi.updateApproval(targetUser.id, 'approved');
        toast.success('Registration approved', `${targetUser.fullName} can now log in. They will receive an email.`);
      } else if (type === 'REJECT') {
        await usersApi.updateApproval(targetUser.id, 'rejected', rejectReason);
        toast.success('Registration rejected', `${targetUser.fullName} will not be able to log in.`);
      }

      await fetchUsers();
      if (selectedUser?.id === targetUser.id) {
        await fetchUserDetails(targetUser.id);
      }
    } catch (error) {
      toast.error('Action failed', getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
      setModalConfig({ isOpen: false, type: null, targetUser: null });
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter.toLowerCase();
      const matchesStatus = statusFilter === 'ALL' ||
                            (statusFilter === 'ACTIVE' && u.isActive) ||
                            (statusFilter === 'DISABLED' && !u.isActive);
      const userApproval = u.approvalStatus || 'approved';
      const matchesApproval = approvalFilter === 'ALL' ||
                            (approvalFilter === 'PENDING' && userApproval === 'pending') ||
                            (approvalFilter === 'APPROVED' && userApproval === 'approved') ||
                            (approvalFilter === 'REJECTED' && userApproval === 'rejected');
      return matchesSearch && matchesRole && matchesStatus && matchesApproval;
    });
  }, [users, searchQuery, roleFilter, statusFilter, approvalFilter]);

  const totalRecords = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);

  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, startIndex, endIndex]);

  const summary = useMemo(() => {
    return {
      total: users.length,
      activeCustomers: users.filter(u => u.role === 'customer' && u.isActive).length,
      admins: users.filter(u => u.role === 'admin').length,
      disabled: users.filter(u => !u.isActive).length,
      // Only customers go through admin approval — an admin row is never "pending".
      pendingApproval: users.filter(u => u.role === 'customer' && (u.approvalStatus || 'approved') === 'pending').length
    };
  }, [users]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Users</span>
            <Users size={20} color="var(--warm-taupe)" />
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 900 }}>{summary.total}</span>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Active Customers</span>
            <UserCheck size={20} color="#10B981" />
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 900 }}>{summary.activeCustomers}</span>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Admin Accounts</span>
            <ShieldAlert size={20} color="#6366F1" />
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 900 }}>{summary.admins}</span>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Disabled Accounts</span>
            <XCircle size={20} color="#EF4444" />
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 900 }}>{summary.disabled}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={18} color="var(--gray-400)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            className="input"
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{ width: '100%', paddingLeft: '2.5rem', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
          />
        </div>
        <select 
          className="input" 
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
          style={{ width: '150px', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
        >
          <option value="ALL">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="CUSTOMER">Customer</option>
        </select>
        <select 
          className="input" 
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          style={{ width: '150px', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <select
          className="input"
          value={approvalFilter}
          onChange={(e) => { setApprovalFilter(e.target.value); setCurrentPage(1); }}
          style={{ width: '190px', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
        >
          <option value="ALL">All Approval</option>
          <option value="PENDING">Awaiting approval ({summary.pendingApproval})</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>User</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Role</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Approval</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Joined</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isInitialLoad ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>No users found matching filters.</td></tr>
              ) : (
                paginatedUsers.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--gray-100)', backgroundColor: selectedUser?.id === user.id ? 'var(--gray-50)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleSelectUser(user)}>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--black)' }}>{user.fullName}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {user.email}
                        {user.emailDeliveryStatus === 'bounced' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', backgroundColor: '#FEF2F2', color: '#DC2626', whiteSpace: 'nowrap' }}>
                            <AlertTriangle size={10} /> Bounced
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem', 
                        fontWeight: 800, 
                        textTransform: 'uppercase',
                        backgroundColor: user.role === 'admin' ? '#EEF2FF' : '#F3F4F6',
                        color: user.role === 'admin' ? '#4F46E5' : '#4B5563'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem', 
                        fontWeight: 800, 
                        textTransform: 'uppercase',
                        backgroundColor: user.isActive ? '#ECFDF5' : '#FEF2F2',
                        color: user.isActive ? '#10B981' : '#EF4444'
                      }}>
                        {user.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      {user.role === 'customer' ? (
                        <div>
                          <ApprovalBadge status={user.approvalStatus} />
                          {user.approvalStatus === 'rejected' && user.rejectionReason && (
                            <div
                              title={user.rejectionReason}
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--gray-500)',
                                marginTop: '0.35rem',
                                maxWidth: '180px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {user.rejectionReason}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--gray-300)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                      {formatDate(user.createdAt, 'short')}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button 
                        className="btn-outline" 
                        onClick={(e) => { e.stopPropagation(); handleSelectUser(user); }}
                        style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalRecords > 0 && (
          <div className="table-pagination">
            <div className="pagination-info">
              Showing <span style={{ fontWeight: 800, color: 'var(--black)' }}>{startIndex + 1}</span> to <span style={{ fontWeight: 800, color: 'var(--black)' }}>{endIndex}</span> of <span style={{ fontWeight: 800, color: 'var(--black)' }}>{totalRecords}</span> users
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

      {/* Slide-over User Details Drawer */}
      {selectedUser && (
        <div 
          className="slide-over-backdrop"
          onClick={() => setSelectedUser(null)}
        >
          <div 
            className="slide-over-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-details-title"
          >
            <div className="slide-over-header">
              <div>
                <h3 id="user-details-title" style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.25rem', color: 'var(--black)' }}>
                  User Details
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'monospace' }}>
                  ID: {selectedUser.id}
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="btn-outline" 
                style={{ padding: '0.4rem', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close user details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="slide-over-body">
              {detailsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--gray-500)' }}>
                  Loading details...
                </div>
              ) : userDetails ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <UserCheck size={30} color="var(--gray-400)" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, wordBreak: 'break-word' }}>{userDetails.fullName}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--gray-500)', wordBreak: 'break-word' }}>{userDetails.email}</div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--gray-50)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--gray-200)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Phone</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{userDetails.phoneNumber || 'Not provided'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Joined</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(userDetails.createdAt, 'long')}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Last Login</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{userDetails.lastLoginAt ? formatDate(userDetails.lastLoginAt, 'datetime') : 'Never'}</div>
                      </div>
                      {userDetails.emailDeliveryStatus === 'bounced' && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Email Status</span>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <AlertTriangle size={14} /> Bounced{userDetails.emailBouncedAt ? ` — ${formatDate(userDetails.emailBouncedAt, 'datetime')}` : ''}
                          </div>
                        </div>
                      )}
                    </div>

                    {userDetails.role === 'admin' && (
                      <div style={{ padding: '1rem', backgroundColor: '#EEF2FF', borderRadius: '12px', border: '1px solid #C7D2FE', display: 'flex', gap: '0.75rem' }}>
                        <ShieldAlert size={20} color="#4F46E5" style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: '0.85rem', color: '#4338CA' }}>
                          <strong>Administrator Account</strong><br/>
                          This user has full access to the management dashboard.
                        </div>
                      </div>
                    )}

                    {userDetails.role === 'customer' && userDetails.bookings?.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <History size={16} /> Recent Bookings
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {userDetails.bookings.map((b: any) => (
                            <div key={b.id} style={{ padding: '0.75rem', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: 700 }}>{b.vehicle.brand} {b.vehicle.model}</span>
                                <StatusBadge status={b.status} />
                              </div>
                              <div style={{ color: 'var(--gray-500)' }}>{formatDate(b.startDate, 'short')} - {formatDate(b.endDate, 'short')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.25rem' }}>Quick Actions</h4>
                    
                    {userDetails.isActive ? (
                      <button onClick={() => openModal('DISABLE', userDetails)} disabled={currentUser?.id === userDetails.id} className="btn-outline" style={{ color: '#EF4444', borderColor: '#EF4444' }}>
                        Disable Account
                      </button>
                    ) : (
                      <button onClick={() => openModal('ENABLE', userDetails)} className="btn-outline" style={{ color: '#10B981', borderColor: '#10B981' }}>
                        Enable Account
                      </button>
                    )}

                    {userDetails.role === 'customer' ? (
                      <button onClick={() => openModal('PROMOTE', userDetails)} className="btn-outline" style={{ color: '#4F46E5', borderColor: '#4F46E5' }}>
                        Promote to Admin
                      </button>
                    ) : (
                      <button onClick={() => openModal('DEMOTE', userDetails)} disabled={currentUser?.id === userDetails.id} className="btn-outline" style={{ color: '#F59E0B', borderColor: '#F59E0B' }}>
                        Demote to Customer
                      </button>
                    )}

                    {/* Approval controls — customers only. Admins never have an approvalStatus
                        that matters (never subject to approval, per the backend), and this
                        whole block is skipped for any non-customer row, which also covers
                        "the current admin" since an admin can never be role: 'customer'. */}
                    {userDetails.role === 'customer' && (userDetails.approvalStatus === 'pending' || userDetails.approvalStatus === 'rejected') && (
                      <>
                        <button
                          onClick={() => openModal('APPROVE', userDetails)}
                          disabled={actionLoading}
                          className="btn-outline"
                          style={{ color: '#10B981', borderColor: '#10B981' }}
                        >
                          <UserPlus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} />
                          Approve Registration
                        </button>
                        {userDetails.approvalStatus === 'pending' && (
                          <button
                            onClick={() => openModal('REJECT', userDetails)}
                            disabled={actionLoading}
                            className="btn-outline"
                            style={{ color: '#DC2626', borderColor: '#DC2626' }}
                          >
                            <Ban size={16} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} />
                            Reject Registration
                          </button>
                        )}
                      </>
                    )}

                    {currentUser?.id === userDetails.id && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textAlign: 'center', marginTop: '0.25rem' }}>
                        You cannot change your own role or status.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={modalConfig.isOpen}
        title={
          modalConfig.type === 'DISABLE' ? 'Disable user account?' :
          modalConfig.type === 'ENABLE' ? 'Enable user account?' :
          modalConfig.type === 'PROMOTE' ? 'Promote customer to admin?' :
          modalConfig.type === 'DEMOTE' ? 'Demote admin to customer?' :
          modalConfig.type === 'APPROVE' ? 'Approve this registration?' :
          'Reject this registration?'
        }
        message={
          modalConfig.type === 'DISABLE' ? 'This user will no longer be able to log in.' :
          modalConfig.type === 'ENABLE' ? 'This user will be able to log in again.' :
          modalConfig.type === 'PROMOTE' ? 'This user will gain access to all administrative modules.' :
          modalConfig.type === 'DEMOTE' ? 'This user will lose administrative access.' :
          modalConfig.type === 'APPROVE' ? 'The customer will be notified by email and will be able to log in.' :
          'The customer will not be able to log in. No email is sent for a rejection.'
        }
        // Reject's reason field is deliberately built here via `details` rather than
        // ConfirmActionModal's own `reasonInput` prop: reasonInput structurally REQUIRES
        // at least minLength characters before the Confirm button enables (it's built for
        // mandatory reasons, like the existing booking-void flow's 10-char minimum) — but
        // the backend's reason here is genuinely optional (z.string().min(1).optional()),
        // so a plain, non-blocking textarea is the correct fit, not a misuse of reasonInput.
        details={modalConfig.type === 'REJECT' ? (
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Reason (optional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Documents unclear or invalid"
              rows={3}
              maxLength={500}
              disabled={actionLoading}
              style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--gray-200)', padding: '0.75rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </div>
        ) : undefined}
        confirmLabel={
          modalConfig.type === 'ENABLE' || modalConfig.type === 'PROMOTE' ? 'Confirm' :
          modalConfig.type === 'APPROVE' ? 'Approve' :
          modalConfig.type === 'REJECT' ? 'Reject' :
          'Proceed'
        }
        variant={
          modalConfig.type === 'DISABLE' || modalConfig.type === 'DEMOTE' || modalConfig.type === 'REJECT' ? 'danger' :
          'success'
        }
        onConfirm={executeAction}
        onCancel={() => { setModalConfig({ isOpen: false, type: null, targetUser: null }); setRejectReason(''); }}
        loading={actionLoading}
      />
    </div>
  );
};

export default AdminUserRolesPage;
