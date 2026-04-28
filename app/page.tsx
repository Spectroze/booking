'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  signInWithGoogle,
  getUserRole,
  getUserData,
  signOut,
} from './services/auth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const user = await signInWithGoogle();

      if (!user.email) {
        toast.error('Email is required. Please use a Google account with an email address.');
        return;
      }
//
      const [userData, userRole] = await Promise.all([
        getUserData(user.uid),
        getUserRole(user.uid),
      ]);

      // Admins bypass status check
      const isAdminRole =
        userRole === 'admin' ||
        userRole === 'admin-training' ||
        userRole === 'admin-dome';

      if (!isAdminRole) {
        const status = userData?.status || 'pending';
        if (status === 'declined') {
          await signOut();
          toast.error(
            '🚫 Your account access has been declined by the administrator. Please contact support.',
            { autoClose: 8000 }
          );
          return;
        }
        if (status === 'pending') {
          await signOut();
          toast.warn(
            '⏳ Your account is awaiting admin approval. You will be notified by email once access is granted.',
            { autoClose: 8000 }
          );
          return;
        }
      }

      // Redirect based on role
      if (userRole === 'admin-training') {
        router.push('/admin');
      } else if (userRole === 'admin-dome') {
        router.push('/admin/admin-dome-tent');
      } else if (userRole === 'admin') {
        router.push('/admin/select-dashboard');
      } else {
        router.push('/user');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error?.code === 'auth/popup-closed-by-user') {
        toast.warn('Sign-in was cancelled. Please try again.');
      } else {
        toast.error('Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 space-y-8 border border-slate-700/30">

          {/* Logo */}
          <div className="flex justify-center">
            <div className="relative w-24 h-24">
              <Image src="/images/gso.png" alt="GSO Logo" fill className="rounded-full object-cover" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">Welcome</h1>
            <p className="text-slate-300">Sign in to access the booking system</p>
          </div>

          {/* Info notice for new users */}
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-300">
              New accounts require admin approval before you can access the system. You will be notified by email once your access is granted.
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg className="animate-spin w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="text-gray-700 font-semibold text-base">
              {loading ? 'Signing in...' : 'Continue with Google'}
            </span>
          </button>

          {/* Footer */}
          <p className="text-xs text-center text-slate-500">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
