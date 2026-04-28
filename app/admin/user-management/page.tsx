'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAllUsers,
  subscribeToAllUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  UserData,
  signOut,
} from '../../services/auth';
import { CountBadge } from '../CountBadge';
import { useRouteGuard } from '../../hooks/useRouteGuard';

type AppRole = 'user' | 'admin' | 'admin-training' | 'admin-dome';

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'admin-training', label: 'Admin (Training Hall)' },
  { value: 'admin-dome', label: 'Admin (Dome Tent)' },
];

async function notifyUserEmail(payload: {
  to: string;
  displayName?: string;
  status?: 'approved' | 'declined' | 'pending';
  role?: AppRole;
}) {
  try {
    const res = await fetch('/api/notify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('notify-user failed', await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('notify-user error', e);
    return false;
  }
}

export const dynamic = 'force-dynamic';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'declined'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [roleDraft, setRoleDraft] = useState<Record<string, AppRole>>({});
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const router = useRouter();
  const { isCheckingAccess, isAuthorized } = useRouteGuard({
    allowRoles: ['admin', 'admin-training', 'admin-dome'],
  });

  const displayRole = (u: UserData): AppRole =>
    roleDraft[u.uid] ?? ((u.role || 'user') as AppRole);

  const sortUsersList = useCallback((allUsers: UserData[]) => {
    return [...allUsers].sort((a, b) => {
      const statusOrder: Record<string, number> = { pending: 0, approved: 1, declined: 2 };
      const aOrder = statusOrder[a.status || 'pending'] ?? 3;
      const bOrder = statusOrder[b.status || 'pending'] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return 0;
    });
  }, []);

  // Real-time user list
  useEffect(() => {
    if (!isAuthorized) return;
    setLoading(true);
    const unsubscribe = subscribeToAllUsers(allUsers => {
      setUsers(sortUsersList(allUsers));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAuthorized, sortUsersList]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsers();
      setUsers(sortUsersList(allUsers));
    } catch (e) {
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter when search or status filter changes
  useEffect(() => {
    let result = users;
    if (statusFilter !== 'all') {
      result = result.filter(u => (u.status || 'pending') === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        u =>
          u.displayName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      );
    }
    setFilteredUsers(result);
  }, [searchQuery, statusFilter, users]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleStatusUpdate = async (
    uid: string,
    status: 'approved' | 'declined' | 'pending',
    meta?: { email: string; displayName?: string }
  ) => {
    setActionLoading(uid + status);
    try {
      await updateUserStatus(uid, status);
      setUsers(prev =>
        prev.map(u => u.uid === uid ? { ...u, status } : u)
      );
      const labels: Record<string, string> = { approved: 'Approved', declined: 'Declined', pending: 'Reset to Pending' };
      const sent =
        !meta?.email ||
        (await notifyUserEmail({
          to: meta.email,
          displayName: meta.displayName,
          status,
        }));
      showToast(
        sent
          ? `User ${labels[status]} successfully. A confirmation email was sent.`
          : `User ${labels[status]} successfully, but the confirmation email could not be sent.`,
        sent ? 'success' : 'error'
      );
    } catch {
      showToast('Failed to update user status. Please try again.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleUpdate = async (
    uid: string,
    newRole: AppRole,
    meta: { email: string; displayName?: string; previousRole?: string }
  ) => {
    const prev = (meta.previousRole || 'user') as AppRole;
    if (newRole === prev) return;
    setActionLoading(uid + 'role');
    try {
      await updateUserRole(uid, newRole);
      setUsers(prevUsers => prevUsers.map(u => (u.uid === uid ? { ...u, role: newRole } : u)));
      setRoleDraft(d => {
        const next = { ...d };
        delete next[uid];
        return next;
      });
      const sent =
        !meta.email ||
        (await notifyUserEmail({
          to: meta.email,
          displayName: meta.displayName,
          role: newRole,
        }));
      showToast(
        sent
          ? 'Role updated successfully. A confirmation email was sent.'
          : 'Role updated, but the confirmation email could not be sent.',
        sent ? 'success' : 'error'
      );
    } catch {
      showToast('Failed to update role. Please try again.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const closeDeleteModal = () => {
    if (actionLoading === 'delete-user') return;
    setUserToDelete(null);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setActionLoading('delete-user');
    try {
      await deleteUser(userToDelete.uid);
      setRoleDraft(d => {
        const next = { ...d };
        delete next[userToDelete.uid];
        return next;
      });
      setUserToDelete(null);
      showToast('User deleted successfully.', 'success');
    } catch {
      showToast('Failed to delete user. Please try again.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Stats
  const totalCount = users.length;
  const pendingCount = users.filter(u => !u.status || u.status === 'pending').length;
  const approvedCount = users.filter(u => u.status === 'approved').length;
  const declinedCount = users.filter(u => u.status === 'declined').length;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Approved
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-700">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
            Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse"></span>
            Pending
          </span>
        );
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (email: string) => {
    const colors = [
      'from-indigo-500 to-purple-600',
      'from-blue-500 to-cyan-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
      'from-violet-500 to-indigo-600',
    ];
    const idx = email.charCodeAt(0) % colors.length;
    return colors[idx];
  };

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-4 rounded-xl shadow-2xl text-white text-sm font-medium flex items-center gap-3 transition-all animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 dark:from-violet-700 dark:via-purple-700 dark:to-indigo-700 rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
                  <span className="relative inline-flex">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <CountBadge count={pendingCount} className="ring-violet-700" />
                  </span>
                  User Management
                </h1>
                <p className="text-purple-100 text-sm sm:text-base mt-1">
                  Manage user access — approve or decline sign-up requests
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => router.back()}
                  className="px-4 sm:px-5 py-2.5 text-sm sm:text-base rounded-xl transition-all font-medium shadow-lg bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </span>
                </button>
                <button
                  onClick={loadUsers}
                  className="px-4 sm:px-5 py-2.5 text-sm sm:text-base rounded-xl transition-all font-medium shadow-lg bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-4 sm:px-5 py-2.5 text-sm sm:text-base rounded-xl transition-all font-medium shadow-lg bg-red-600 hover:bg-red-700 text-white"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border-l-4 border-indigo-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{totalCount}</p>
                </div>
                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-full">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div
              onClick={() => setStatusFilter('pending')}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border-l-4 border-amber-500 hover:shadow-xl transition-all cursor-pointer hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
                </div>
                <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
                  <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div
              onClick={() => setStatusFilter('approved')}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border-l-4 border-emerald-500 hover:shadow-xl transition-all cursor-pointer hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{approvedCount}</p>
                </div>
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div
              onClick={() => setStatusFilter('declined')}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border-l-4 border-red-500 hover:shadow-xl transition-all cursor-pointer hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Declined</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{declinedCount}</p>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Search & Filter Bar */}
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'approved', 'declined'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    statusFilter === f
                      ? f === 'all'
                        ? 'bg-violet-600 text-white shadow-md'
                        : f === 'pending'
                        ? 'bg-amber-500 text-white shadow-md'
                        : f === 'approved'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-red-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== 'all' && (
                    <span className="ml-1.5 text-xs opacity-80">
                      ({f === 'pending' ? pendingCount : f === 'approved' ? approvedCount : declinedCount})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
                  <svg className="animate-spin w-8 h-8 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Loading users...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">No users found</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                  {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'No users have signed up yet'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 dark:from-violet-600 dark:via-purple-600 dark:to-indigo-600">
                      <th className="text-left py-4 px-6 font-bold text-white text-sm uppercase tracking-wider">#</th>
                      <th className="text-left py-4 px-6 font-bold text-white text-sm uppercase tracking-wider">User</th>
                      <th className="text-left py-4 px-6 font-bold text-white text-sm uppercase tracking-wider">Email</th>
                      <th className="text-left py-4 px-6 font-bold text-white text-sm uppercase tracking-wider">Role</th>
                      <th className="text-left py-4 px-6 font-bold text-white text-sm uppercase tracking-wider">Status</th>
                      <th className="text-center py-4 px-6 font-bold text-white text-sm uppercase tracking-wider min-w-[260px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredUsers.map((user, idx) => {
                      const status = user.status || 'pending';
                      const isLoadingApprove = actionLoading === user.uid + 'approved';
                      const isLoadingDecline = actionLoading === user.uid + 'declined';
                      const isLoadingRole = actionLoading === user.uid + 'role';
                      const isDeletingUser = actionLoading === 'delete-user' && userToDelete?.uid === user.uid;
                      const roleMeta = {
                        email: user.email,
                        displayName: user.displayName,
                      };
                      return (
                        <tr
                          key={user.uid}
                          className={`transition-colors hover:bg-violet-50/40 dark:hover:bg-violet-900/10 ${
                            idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/60 dark:bg-gray-800/60'
                          }`}
                        >
                          <td className="py-4 px-6 text-sm font-medium text-gray-400 dark:text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {user.photoURL ? (
                                <img
                                  src={user.photoURL}
                                  alt={user.displayName}
                                  className="w-10 h-10 rounded-full object-cover ring-2 ring-violet-200 dark:ring-violet-700"
                                />
                              ) : (
                                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(user.email)} flex items-center justify-center text-white text-sm font-bold ring-2 ring-violet-200 dark:ring-violet-700`}>
                                  {getInitials(user.displayName || user.email)}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">{user.displayName || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-600 dark:text-gray-300">{user.email}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-2 min-w-[12rem] max-w-[14rem]">
                              <select
                                value={displayRole(user)}
                                onChange={e =>
                                  setRoleDraft(d => ({
                                    ...d,
                                    [user.uid]: e.target.value as AppRole,
                                  }))
                                }
                                disabled={!!actionLoading}
                                className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                              >
                                {ROLE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRoleUpdate(user.uid, displayRole(user), {
                                    ...roleMeta,
                                    previousRole: user.role || 'user',
                                  })
                                }
                                disabled={
                                  !!actionLoading ||
                                  displayRole(user) === (user.role || 'user')
                                }
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isLoadingRole ? (
                                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                  </svg>
                                ) : null}
                                Set role
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {getStatusBadge(status)}
                          </td>
                          <td className="py-4 px-6 min-w-[260px]">
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              {status !== 'approved' && (
                                <button
                                  id={`approve-${user.uid}`}
                                  onClick={() => handleStatusUpdate(user.uid, 'approved', roleMeta)}
                                  disabled={!!actionLoading}
                                  className="inline-flex items-center justify-center gap-1.5 min-w-[92px] px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md hover:shadow-emerald-300/50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                  {isLoadingApprove ? (
                                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  Approve
                                </button>
                              )}
                              {status !== 'declined' && (
                                <button
                                  id={`decline-${user.uid}`}
                                  onClick={() => handleStatusUpdate(user.uid, 'declined', roleMeta)}
                                  disabled={!!actionLoading}
                                  className="inline-flex items-center justify-center gap-1.5 min-w-[92px] px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-md hover:shadow-red-300/50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                  {isLoadingDecline ? (
                                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                  Decline
                                </button>
                              )}
                              {status !== 'pending' && (
                                <button
                                  onClick={() => handleStatusUpdate(user.uid, 'pending', roleMeta)}
                                  disabled={!!actionLoading}
                                  className="inline-flex items-center justify-center gap-1.5 min-w-[92px] px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Reset
                                </button>
                              )}
                              <button
                                onClick={() => setUserToDelete(user)}
                                disabled={!!actionLoading}
                                className="inline-flex items-center justify-center gap-1.5 min-w-[92px] px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {isDeletingUser ? (
                                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                  </svg>
                                )}
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                {filteredUsers.map((user, idx) => {
                  const status = user.status || 'pending';
                  const isLoadingApprove = actionLoading === user.uid + 'approved';
                  const isLoadingDecline = actionLoading === user.uid + 'declined';
                  const isLoadingRole = actionLoading === user.uid + 'role';
                  const isDeletingUser = actionLoading === 'delete-user' && userToDelete?.uid === user.uid;
                  const roleMeta = {
                    email: user.email,
                    displayName: user.displayName,
                  };
                  return (
                    <div key={user.uid} className="p-4 hover:bg-violet-50/30 dark:hover:bg-violet-900/10 transition-colors">
                      <div className="flex items-start gap-3 mb-3">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName} className="w-12 h-12 rounded-full object-cover ring-2 ring-violet-200 dark:ring-violet-700 flex-shrink-0" />
                        ) : (
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(user.email)} flex items-center justify-center text-white font-bold ring-2 ring-violet-200 dark:ring-violet-700 flex-shrink-0`}>
                            {getInitials(user.displayName || user.email)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{user.displayName || '—'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {getStatusBadge(status)}
                          </div>
                        </div>
                      </div>
                      <div className="mb-3 space-y-2">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
                        <select
                          value={displayRole(user)}
                          onChange={e =>
                            setRoleDraft(d => ({
                              ...d,
                              [user.uid]: e.target.value as AppRole,
                            }))
                          }
                          disabled={!!actionLoading}
                          className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {ROLE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            handleRoleUpdate(user.uid, displayRole(user), {
                              ...roleMeta,
                              previousRole: user.role || 'user',
                            })
                          }
                          disabled={
                            !!actionLoading ||
                            displayRole(user) === (user.role || 'user')
                          }
                          className="w-full py-2 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white transition-all disabled:opacity-50"
                        >
                          {isLoadingRole ? '...' : 'Set role'}
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {status !== 'approved' && (
                          <button onClick={() => handleStatusUpdate(user.uid, 'approved', roleMeta)} disabled={!!actionLoading} className="flex-1 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50">
                            {isLoadingApprove ? '...' : '✓ Approve'}
                          </button>
                        )}
                        {status !== 'declined' && (
                          <button onClick={() => handleStatusUpdate(user.uid, 'declined', roleMeta)} disabled={!!actionLoading} className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50">
                            {isLoadingDecline ? '...' : '✕ Decline'}
                          </button>
                        )}
                        {status !== 'pending' && (
                          <button onClick={() => handleStatusUpdate(user.uid, 'pending', roleMeta)} disabled={!!actionLoading} className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200 transition-all disabled:opacity-50">
                            Reset
                          </button>
                        )}
                        <button onClick={() => setUserToDelete(user)} disabled={!!actionLoading} className="w-full py-2 rounded-lg text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-200 transition-all disabled:opacity-50">
                          {isDeletingUser ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredUsers.length}</span> of <span className="font-semibold text-gray-700 dark:text-gray-300">{totalCount}</span> users
                </p>
                {(searchQuery || statusFilter !== 'all') && (
                  <button
                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                    className="text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {userToDelete && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={closeDeleteModal}
              aria-label="Close dialog"
            />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl ring-1 ring-red-200/50 dark:ring-red-900/50 bg-white dark:bg-gray-900">
              <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-5 text-white">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 id="delete-user-title" className="text-lg font-bold leading-tight">
                      Are you sure you want to delete this user?
                    </h3>
                    <p className="mt-1 text-sm text-red-100">
                      This will remove `{userToDelete.displayName || userToDelete.email}` from the user list.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 p-4 text-sm text-red-900 dark:text-red-100">
                  <p><strong>Name:</strong> {userToDelete.displayName || 'N/A'}</p>
                  <p><strong>Email:</strong> {userToDelete.email}</p>
                  <p><strong>Status:</strong> {userToDelete.status || 'pending'}</p>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-1">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    disabled={actionLoading === 'delete-user'}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteUser}
                    disabled={actionLoading === 'delete-user'}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold shadow-lg shadow-red-500/25 hover:from-red-700 hover:to-rose-700 transition-all disabled:opacity-60"
                  >
                    {actionLoading === 'delete-user' ? 'Deleting...' : 'Yes, delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
