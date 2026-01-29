'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../services/auth';
import { subscribeToBookings, type Booking } from '../services/bookings';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

export default function UserPage() {
  const [selectedType, setSelectedType] = useState<'dome-tent' | 'training-hall' | null>(null);
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [domeTentCalendarMonth, setDomeTentCalendarMonth] = useState(new Date());
  const [trainingHallCalendarMonth, setTrainingHallCalendarMonth] = useState(new Date());

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Check authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Subscribe to bookings for calendar previews
  useEffect(() => {
    const unsubscribe = subscribeToBookings((bookingsList) => {
      setBookings(bookingsList);
    });
    return () => unsubscribe();
  }, []);

  // Calendar helpers
  const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    return days;
  };

  const isDateScheduled = (date: Date | null, venueType: 'dome-tent' | 'training-hall'): boolean => {
    if (!date) return false;
    return bookings.some((b) => {
      const bookingDate = new Date(b.date);
      const isPendingOrConfirmed = !b.status || b.status === 'pending' || b.status === 'confirmed';
      return b.type === venueType && bookingDate.toDateString() === date.toDateString() && isPendingOrConfirmed;
    });
  };

  const navigateCalendarMonth = (
    direction: 'prev' | 'next',
    venueType: 'dome-tent' | 'training-hall'
  ) => {
    if (venueType === 'dome-tent') {
      setDomeTentCalendarMonth((prev) => {
        const next = new Date(prev);
        next.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
        return next;
      });
    } else {
      setTrainingHallCalendarMonth((prev) => {
        const next = new Date(prev);
        next.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
        return next;
      });
    }
  };

  const renderCalendar = (venueType: 'dome-tent' | 'training-hall', calendarMonth: Date) => {
    const days = getDaysInMonth(calendarMonth);
    return (
      <div className="mt-4">
        <div className="flex justify-between items-center mb-3">
          <button
            type="button"
            onClick={() => navigateCalendarMonth('prev', venueType)}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => navigateCalendarMonth('next', venueType)}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-3">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-1">
              {day.substring(0, 1)}
            </div>
          ))}
          {days.map((day, index) => {
            const scheduled = day ? isDateScheduled(day, venueType) : false;
            const isToday = day ? day.toDateString() === new Date().toDateString() : false;
            const isPast = day ? day < new Date() && !isToday : false;

            return (
              <div
                key={index}
                className={`aspect-square flex items-center justify-center rounded text-xs font-medium ${
                  !day
                    ? 'invisible'
                    : isPast
                      ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800'
                      : scheduled
                        ? 'bg-amber-200 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100'
                        : isToday
                          ? 'bg-blue-500 text-white ring-2 ring-blue-700 dark:ring-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
                title={day ? (scheduled ? 'Scheduled' : isToday ? 'Today' : 'Available') : undefined}
              >
                {day ? day.getDate() : ''}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-600" />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800/60" />
            Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500" />
            Today
          </span>
        </div>
      </div>
    );
  };

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
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-blue-500"
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
              
              {/* Calendar Preview */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Availability Preview</span>
                </div>
                {renderCalendar('dome-tent', domeTentCalendarMonth)}
              </div>

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
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-green-500"
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
              
              {/* Calendar Preview */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Availability Preview</span>
                </div>
                {renderCalendar('training-hall', trainingHallCalendarMonth)}
              </div>

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

