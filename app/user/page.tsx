'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../services/auth';
import { useEffect } from 'react';

export default function UserPage() {
  const [selectedType, setSelectedType] = useState<'dome-tent' | 'training-hall' | null>(null);
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSelection = (type: 'dome-tent' | 'training-hall') => {
    setSelectedType(type);
    if (type === 'dome-tent') {
      router.push('/user/dome-tent');
    } else {
      router.push('/user/training-hall');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Book a Venue
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose the venue you'd like to book
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Dome Tent Option */}
          <div
            onClick={() => handleSelection('dome-tent')}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="w-20 h-20 mx-auto text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Dome Tent
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Perfect for outdoor events, parties, and gatherings
              </p>
              <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                <span>Book Now</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Training Hall Option */}
          <div
            onClick={() => handleSelection('training-hall')}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-green-500"
          >
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="w-20 h-20 mx-auto text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Training Hall
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Ideal for workshops, seminars, and training sessions
              </p>
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-medium">
                <span>Book Now</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

