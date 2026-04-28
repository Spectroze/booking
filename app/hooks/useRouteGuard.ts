'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, getSafeUserRole, getUserData, getUserRole, signOut, type AppRole } from '../services/auth';

interface UseRouteGuardOptions {
  allowRoles: AppRole[];
  requireApproved?: boolean;
  redirectTo?: string;
  onAuthorized?: (role: AppRole) => void;
}

export function useRouteGuard({
  allowRoles,
  requireApproved = false,
  redirectTo = '/',
  onAuthorized,
}: UseRouteGuardOptions) {
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [authorizedRole, setAuthorizedRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setAuthorizedRole(null);
        setIsCheckingAccess(false);
        router.replace(redirectTo);
        return;
      }

      try {
        const [userData, userRole] = await Promise.all([
          getUserData(user.uid),
          getUserRole(user.uid),
        ]);

        const role = getSafeUserRole(userRole);
        const status = userData?.status || 'pending';
        const roleAllowed = allowRoles.includes(role);
        const statusAllowed = !requireApproved || status === 'approved';

        if (!roleAllowed || !statusAllowed) {
          await signOut();
          setAuthorizedRole(null);
          setIsCheckingAccess(false);
          router.replace(redirectTo);
          return;
        }

        setAuthorizedRole(role);
        onAuthorized?.(role);
        setIsCheckingAccess(false);
      } catch (error) {
        console.error('Route guard error:', error);
        try {
          await signOut();
        } catch (signOutError) {
          console.error('Route guard sign-out error:', signOutError);
        }
        setAuthorizedRole(null);
        setIsCheckingAccess(false);
        router.replace(redirectTo);
      }
    });

    return () => unsubscribe();
  }, [allowRoles, onAuthorized, redirectTo, router, requireApproved]);

  return {
    isCheckingAccess,
    authorizedRole,
    isAuthorized: !isCheckingAccess && authorizedRole !== null,
  };
}
