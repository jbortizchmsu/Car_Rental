import React, { useEffect, useState, useMemo } from 'react';
import { Users, ShieldAlert, UserCheck, Search, CheckCircle2, XCircle, History } from 'lucide-react';
import { usersApi } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { usePageHeader } from '../contexts/PageHeaderContext';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { getApiErrorMessage } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';

const AdminUserRolesPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const toast = useToast();
  const { setPageHeader } = usePageHeader();

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'DISABLE' | 'ENABLE' | 'PROMOTE' | 'DEMOTE' | null;
    targetUser: any;
  }>({ isOpen: false, type: null, targetUser: null });
  const [actionLoading, setActionLoading] = useState(false);

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

  const openModal = (type: 'DISABLE' | 'ENABLE' | 'PROMOTE' | 'DEMOTE', user: any) => {
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
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: users.length,
      activeCustomers: users.filter(u => u.role === 'customer' && u.isActive).length,
      admins: users.filter(u => u.role === 'admin').length,
      disabled: users.filter(u => !u.isActive).length
    };
  }, [users]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 400px' : '1fr', gap: '2rem', transition: 'all 0.3s' }}>
        <div>
          {/* Toolbar */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} color="var(--gray-400)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="input"
                placeholder="Search by name or email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '2.5rem', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
              />
            </div>
            <select 
              className="input" 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: '150px', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="CUSTOMER">Customer</option>
            </select>
            <select 
              className="input" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '150px', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>User</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Joined</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>No users found matching filters.</td></tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--gray-100)', backgroundColor: selectedUser?.id === user.id ? 'var(--gray-50)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleSelectUser(user)}>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--black)' }}>{user.fullName}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{user.email}</div>
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
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                        {new Date(user.createdAt).toLocaleDateString()}
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
        </div>

        {/* Details Panel */}
        {selectedUser && (
          <div className="card" style={{ padding: '2rem', alignSelf: 'start', position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.25rem' }}>User Details</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'monospace' }}>ID: {selectedUser.id}</div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="btn-outline" style={{ padding: '0.4rem', border: 'none' }}>
                <XCircle size={20} />
              </button>
            </div>

            {detailsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>Loading details...</div>
            ) : userDetails ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={30} color="var(--gray-400)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900 }}>{userDetails.fullName}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--gray-500)' }}>{userDetails.email}</div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--gray-50)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--gray-200)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Phone</span>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{userDetails.phoneNumber || 'Not provided'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Joined</span>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{new Date(userDetails.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Last Login</span>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{userDetails.lastLoginAt ? new Date(userDetails.lastLoginAt).toLocaleString() : 'Never'}</div>
                    </div>
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
                            <div style={{ color: 'var(--gray-500)' }}>{new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()}</div>
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
                  {currentUser?.id === userDetails.id && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textAlign: 'center', marginTop: '0.25rem' }}>
                      You cannot change your own role or status.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      <ConfirmActionModal
        isOpen={modalConfig.isOpen}
        title={
          modalConfig.type === 'DISABLE' ? 'Disable user account?' :
          modalConfig.type === 'ENABLE' ? 'Enable user account?' :
          modalConfig.type === 'PROMOTE' ? 'Promote customer to admin?' :
          'Demote admin to customer?'
        }
        message={
          modalConfig.type === 'DISABLE' ? 'This user will no longer be able to log in.' :
          modalConfig.type === 'ENABLE' ? 'This user will be able to log in again.' :
          modalConfig.type === 'PROMOTE' ? 'This user will gain access to all administrative modules.' :
          'This user will lose administrative access.'
        }
        confirmLabel={modalConfig.type === 'ENABLE' || modalConfig.type === 'PROMOTE' ? 'Confirm' : 'Proceed'}
        variant={modalConfig.type === 'DISABLE' || modalConfig.type === 'DEMOTE' ? 'danger' : 'success'}
        onConfirm={executeAction}
        onCancel={() => setModalConfig({ isOpen: false, type: null, targetUser: null })}
        loading={actionLoading}
      />
    </div>
  );
};

export default AdminUserRolesPage;
