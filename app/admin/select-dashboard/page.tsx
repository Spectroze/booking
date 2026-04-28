'use client';

import { useState } from 'react';
import { signOut } from '../../services/auth';
import { useRouter } from 'next/navigation';
import { useRouteGuard } from '../../hooks/useRouteGuard';

export default function SelectDashboardPage() {
  const router = useRouter();
  const { isCheckingAccess, isAuthorized } = useRouteGuard({
    allowRoles: ['admin'],
  });

  const handleSelectDashboard = (dashboard: 'training' | 'dome') => {
    if (dashboard === 'training') {
      router.push('/admin');
    } else {
      router.push('/admin/admin-dome-tent');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-4xl">
        <div className="bg-[#FDF8E1] dark:bg-[#FDF8E1] rounded-2xl shadow-xl p-8 space-y-8 border border-[#FDF4CB]">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-[#F9DC5C] via-[#FAE588] to-[#FCEFB4] rounded-full flex items-center justify-center mb-4 border border-[#FDF4CB]">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Select Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Choose which dashboard you want to access
            </p>
          </div>

          {/* Dashboard Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Training Hall Dashboard */}
            <button
              onClick={() => handleSelectDashboard('training')}
              className="group relative overflow-hidden bg-gradient-to-br from-[#F9DC5C] via-[#FCEFB4] to-[#FDF8E1] dark:from-[#F9DC5C] dark:via-[#FCEFB4] dark:to-[#FDF8E1] rounded-xl p-6 border-2 border-[#FAE588] dark:border-[#FAE588] hover:border-[#F9DC5C] dark:hover:border-[#F9DC5C] transition-all hover:shadow-xl transform hover:scale-105"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#F9DC5C] to-[#FAE588] rounded-full mb-4 group-hover:scale-110 transition-transform border border-[#FDF4CB]">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Training Hall
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Manage training hall bookings, view calendar, and handle appointments
                </p>
                <div className="flex items-center text-amber-900 dark:text-amber-900 font-medium group-hover:translate-x-2 transition-transform">
                  <span>Go to Dashboard</span>
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-[#FAE588]/40 to-[#FDF8E1]/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>

            {/* Dome Tent Dashboard */}
            <button
              onClick={() => handleSelectDashboard('dome')}
              className="group relative overflow-hidden bg-gradient-to-br from-[#F9DC5C] via-[#FCEFB4] to-[#FDF8E1] dark:from-[#F9DC5C] dark:via-[#FCEFB4] dark:to-[#FDF8E1] rounded-xl p-6 border-2 border-[#FAE588] dark:border-[#FAE588] hover:border-[#F9DC5C] dark:hover:border-[#F9DC5C] transition-all hover:shadow-xl transform hover:scale-105"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#FAE588] to-[#F9DC5C] rounded-full mb-4 group-hover:scale-110 transition-transform border border-[#FDF4CB]">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Dome Tent
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Manage dome tent bookings, view calendar, and handle appointments
                </p>
                <div className="flex items-center text-amber-900 dark:text-amber-900 font-medium group-hover:translate-x-2 transition-transform">
                  <span>Go to Dashboard</span>
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-[#FAE588]/40 to-[#FDF8E1]/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </div>

          {/* Sign Out Button */}
          <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
