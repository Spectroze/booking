'use client';

import { useState, useEffect } from 'react';
import { Booking, subscribeToBookings, updateBookingStatus } from '../../services/bookings';
import { auth, getUserRole, signOut } from '../../services/auth';
import { useRouter } from 'next/navigation';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

export default function AdminDomeTentPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'history' | 'booked'>('calendar');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [statusModalData, setStatusModalData] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const router = useRouter();

  // Filter bookings by type - only dome-tent
  const filteredBookings = bookings.filter(booking => booking.type === 'dome-tent');

  // Check authentication and role
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/');
        return;
      }

      // Check if user has access to dome tent dashboard
      const role = await getUserRole(user.uid);
      if (role !== 'admin-dome' && role !== 'admin') {
        // If user is admin-training, redirect to training hall dashboard
        if (role === 'admin-training') {
          router.push('/admin');
        } else {
          // Otherwise redirect to home
          router.push('/');
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Subscribe to real-time bookings
  useEffect(() => {
    const unsubscribe = subscribeToBookings((bookingsList) => {
      setBookings(bookingsList);
    });
    return () => unsubscribe();
  }, []);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
        
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getBookingsForDate = (date: Date | null): Booking[] => {
    if (!date) return [];
    return filteredBookings.filter(booking => {
      const bookingDate = new Date(booking.date);
      // Only show pending bookings on the calendar
      // Pending bookings remain visible regardless of date until admin accepts or declines them
      return bookingDate.toDateString() === date.toDateString() && 
             (booking.status === 'pending' || !booking.status);
    });
  };

  const getConfirmedBookingsForDate = (date: Date | null): Booking[] => {
    if (!date) return [];
    return filteredBookings.filter(booking => {
      const bookingDate = new Date(booking.date);
      // Only show confirmed/accepted bookings on the booked calendar
      return bookingDate.toDateString() === date.toDateString() && 
             booking.status === 'confirmed';
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const openBookingModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBooking(null);
  };

  const openDateModal = (date: Date) => {
    setSelectedDate(date);
    setShowDateModal(true);
  };

  const closeDateModal = () => {
    setShowDateModal(false);
    setSelectedDate(null);
  };

  const handleAcceptBooking = async () => {
    if (!selectedBooking?.id) return;
    try {
      // Update booking status first
      await updateBookingStatus(selectedBooking.id, 'confirmed');
      
      // Send confirmation email if email is available
      if (selectedBooking.clientEmail) {
        try {
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: selectedBooking.clientEmail,
              booking: selectedBooking,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Email sending failed:', errorData);
            setStatusModalData({
              type: 'success',
              title: 'Booking Confirmed',
              message: 'Booking has been confirmed successfully, but email notification could not be sent.',
            });
          } else {
            setStatusModalData({
              type: 'success',
              title: 'Booking Confirmed',
              message: 'Booking has been confirmed and email notification has been sent successfully!',
            });
          }
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          setStatusModalData({
            type: 'success',
            title: 'Booking Confirmed',
            message: 'Booking has been confirmed successfully, but email notification could not be sent.',
          });
        }
      } else {
        setStatusModalData({
          type: 'success',
          title: 'Booking Confirmed',
          message: 'Booking has been confirmed successfully! (No email address available)',
        });
      }
      
      closeModal();
      setShowStatusModal(true);
    } catch (error) {
      console.error('Error confirming booking:', error);
      setStatusModalData({
        type: 'error',
        title: 'Error',
        message: 'Failed to confirm booking. Please try again.',
      });
      setShowStatusModal(true);
    }
  };

  const handleRejectBooking = async () => {
    if (!selectedBooking?.id) return;
    if (confirm('Are you sure you want to reject this booking?')) {
      try {
        await updateBookingStatus(selectedBooking.id, 'cancelled');
        setStatusModalData({
          type: 'success',
          title: 'Booking Rejected',
          message: 'Booking has been rejected successfully.',
        });
        closeModal();
        setShowStatusModal(true);
      } catch (error) {
        console.error('Error rejecting booking:', error);
        setStatusModalData({
          type: 'error',
          title: 'Error',
          message: 'Failed to reject booking. Please try again.',
        });
        setShowStatusModal(true);
      }
    }
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setStatusModalData(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  };

  // Convert 24-hour time (HH:MM) to 12-hour format with AM/PM
  const formatTime12Hour = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Get all confirmed bookings (for booked calendar table view)
  const confirmedBookings = filteredBookings.filter(
    booking => booking.status === 'confirmed'
  ).sort((a, b) => {
    // Sort by date (most recent first)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Get history bookings (confirmed and cancelled)
  const historyBookings = filteredBookings.filter(
    booking => booking.status === 'confirmed' || booking.status === 'cancelled'
  ).sort((a, b) => {
    // Sort by date (most recent first)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const days = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Statistics - filtered by dome-tent
  const pendingCount = filteredBookings.filter(b => b.status === 'pending' || !b.status).length;
  const confirmedCount = filteredBookings.filter(b => b.status === 'confirmed').length;
  const cancelledCount = filteredBookings.filter(b => b.status === 'cancelled').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Gradient */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
                  {viewMode === 'calendar' && (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {viewMode === 'booked' && (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {viewMode === 'history' && (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {viewMode === 'calendar' ? 'Dome Tent Booking Calendar' : viewMode === 'booked' ? 'Dome Tent Booked Calendar' : 'Dome Tent Booking History'}
                </h1>
                {viewMode === 'calendar' && (
                  <p className="text-blue-100 text-sm sm:text-base mt-1">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()} - Pending Dome Tent Appointments
                  </p>
                )}
                {viewMode === 'booked' && (
                  <p className="text-blue-100 text-sm sm:text-base mt-1">
                    All confirmed dome tent bookings and accepted appointments
                  </p>
                )}
                {viewMode === 'history' && (
                  <p className="text-blue-100 text-sm sm:text-base mt-1">
                    All accepted and rejected dome tent bookings
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-4 sm:px-5 py-2.5 text-sm sm:text-base rounded-xl transition-all font-medium shadow-lg ${
                    viewMode === 'calendar'
                      ? 'bg-white text-blue-600 hover:bg-blue-50 transform hover:scale-105'
                      : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Calendar
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('booked')}
                  className={`px-4 sm:px-5 py-2.5 text-sm sm:text-base rounded-xl transition-all font-medium shadow-lg ${
                    viewMode === 'booked'
                      ? 'bg-white text-green-600 hover:bg-green-50 transform hover:scale-105'
                      : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Booked
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`px-4 sm:px-5 py-2.5 text-sm sm:text-base rounded-xl transition-all font-medium shadow-lg ${
                    viewMode === 'history'
                      ? 'bg-white text-blue-600 hover:bg-blue-50 transform hover:scale-105'
                      : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    History
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

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border-l-4 border-yellow-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{pendingCount}</p>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-full">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border-l-4 border-green-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Confirmed</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{confirmedCount}</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border-l-4 border-red-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cancelled</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{cancelledCount}</p>
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

        {/* Calendar View */}
        {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
          {/* Calendar Navigation */}
          <div className="flex justify-between items-center mb-6 sm:mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 rounded-xl p-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all shadow-md hover:shadow-lg font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white text-center flex items-center gap-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all shadow-md hover:shadow-lg font-medium flex items-center gap-2"
            >
              <span className="hidden sm:inline">Next</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {/* Day Headers */}
            {dayNames.map(day => (
              <div key={day} className="text-center font-bold text-gray-700 dark:text-gray-300 py-3 text-sm sm:text-base bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.substring(0, 1)}</span>
              </div>
            ))}

            {/* Calendar Days */}
            {days.map((day, index) => {
              const dayBookings = getBookingsForDate(day);
              const isToday = day && day.toDateString() === new Date().toDateString();
              const isPast = day && day < new Date() && !isToday;

              // Helper function to check if time is AM (00:00-11:59) or PM (12:00-23:59)
              const isAM = (time: string) => {
                const [hours] = time.split(':');
                const hour = parseInt(hours, 10);
                return hour < 12;
              };

              // Separate bookings into AM and PM
              const amBookings = dayBookings.filter(booking => isAM(booking.startTime));
              const pmBookings = dayBookings.filter(booking => !isAM(booking.startTime));

              return (
                <div
                  key={index}
                  className={`relative overflow-hidden min-h-[100px] sm:min-h-[140px] aspect-square border-2 rounded-xl p-1.5 sm:p-2.5 transition-all hover:shadow-lg ${
                    day
                      ? isToday
                        ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-400 dark:border-blue-600 shadow-md'
                        : isPast
                        ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 opacity-75'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                      : 'bg-transparent border-transparent'
                  }`}
                >
                  {day && (
                    <>
                      <div
                        className="absolute inset-0 pointer-events-none z-0 bg-[linear-gradient(135deg,transparent_49%,rgba(0,0,0,0.18)_50%,transparent_51%)] dark:bg-[linear-gradient(135deg,transparent_49%,rgba(255,255,255,0.22)_50%,transparent_51%)]"
                        aria-hidden
                      />
                      <span className="absolute top-1 left-1 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 z-10">
                        AM
                      </span>
                      <span className="absolute bottom-1 right-1 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 z-10">
                        PM
                      </span>

                      {/* Date number */}
                      <div className={`absolute top-1 right-1 text-xs sm:text-sm font-medium z-10 ${
                        isToday
                          ? 'text-blue-700 dark:text-blue-300'
                          : isPast
                          ? 'text-gray-400 dark:text-gray-600'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {day.getDate()}
                      </div>

                      {/* AM Bookings - Upper Left Triangle */}
                      <div className="absolute top-0 left-0 w-1/2 h-1/2 overflow-hidden z-10 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-start justify-start p-1 sm:p-2 space-y-0.5 sm:space-y-1 pointer-events-auto">
                          {amBookings.slice(0, 2).map(booking => (
                            <div
                              key={booking.id}
                              onClick={() => openBookingModal(booking)}
                              className={`text-[8px] sm:text-[10px] ${getStatusColor(booking.status)} text-white px-1.5 sm:px-2 py-1 rounded-lg truncate cursor-pointer hover:opacity-90 hover:shadow-md max-w-full transition-all font-medium`}
                              title={`${formatTime12Hour(booking.startTime)} - ${formatTime12Hour(booking.endTime)}: ${booking.eventTitle || booking.type}`}
                            >
                              <span className="hidden sm:inline">{formatTime12Hour(booking.startTime)} - {booking.eventTitle || booking.type}</span>
                              <span className="sm:hidden">{formatTime12Hour(booking.startTime)}</span>
                            </div>
                          ))}
                          {amBookings.length > 2 && (
                            <div className="text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 px-1">
                              +{amBookings.length - 2}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PM Bookings - Bottom Right Triangle */}
                      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 overflow-hidden z-10 pointer-events-none">
                        <div className="absolute bottom-0 right-0 w-full h-full flex flex-col items-end justify-end p-1 sm:p-2 space-y-0.5 sm:space-y-1 pointer-events-auto">
                          {pmBookings.slice(0, 2).map(booking => (
                            <div
                              key={booking.id}
                              onClick={() => openBookingModal(booking)}
                              className={`text-[8px] sm:text-[10px] ${getStatusColor(booking.status)} text-white px-1.5 sm:px-2 py-1 rounded-lg truncate cursor-pointer hover:opacity-90 hover:shadow-md max-w-full transition-all font-medium`}
                              title={`${formatTime12Hour(booking.startTime)} - ${formatTime12Hour(booking.endTime)}: ${booking.eventTitle || booking.type}`}
                            >
                              <span className="hidden sm:inline">{formatTime12Hour(booking.startTime)} - {booking.eventTitle || booking.type}</span>
                              <span className="sm:hidden">{formatTime12Hour(booking.startTime)}</span>
                            </div>
                          ))}
                          {pmBookings.length > 2 && (
                            <div className="text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 px-1">
                              +{pmBookings.length - 2}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Booked Calendar View - Shows Confirmed Bookings in Calendar Format */}
        {viewMode === 'booked' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
          {/* Calendar Navigation */}
          <div className="flex justify-between items-center mb-6 sm:mb-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700 rounded-xl p-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all shadow-md hover:shadow-lg font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white text-center flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all shadow-md hover:shadow-lg font-medium flex items-center gap-2"
            >
              <span className="hidden sm:inline">Next</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {/* Day Headers */}
            {dayNames.map(day => (
              <div key={day} className="text-center font-bold text-gray-700 dark:text-gray-300 py-3 text-sm sm:text-base bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.substring(0, 1)}</span>
              </div>
            ))}

            {/* Calendar Days */}
            {days.map((day, index) => {
              const dayBookings = getConfirmedBookingsForDate(day);
              const isToday = day && day.toDateString() === new Date().toDateString();
              const isPast = day && day < new Date() && !isToday;

              // Helper function to check if time is AM (00:00-11:59) or PM (12:00-23:59)
              const isAM = (time: string) => {
                const [hours] = time.split(':');
                const hour = parseInt(hours, 10);
                return hour < 12;
              };

              // Separate bookings into AM and PM
              const amBookings = dayBookings.filter(booking => isAM(booking.startTime));
              const pmBookings = dayBookings.filter(booking => !isAM(booking.startTime));

              return (
                <div
                  key={index}
                  onClick={() => day && dayBookings.length > 0 && openDateModal(day)}
                  className={`relative overflow-hidden min-h-[100px] sm:min-h-[140px] aspect-square border-2 rounded-xl p-1.5 sm:p-2.5 transition-all hover:shadow-lg ${
                    day
                      ? dayBookings.length > 0
                        ? 'cursor-pointer hover:scale-105'
                        : ''
                      : ''
                  } ${
                    day
                      ? isToday
                        ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-400 dark:border-green-600 shadow-md'
                        : isPast
                        ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 opacity-75'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600'
                      : 'bg-transparent border-transparent'
                  }`}
                >
                  {day && (
                    <>
                      <div
                        className="absolute inset-0 pointer-events-none z-0 bg-[linear-gradient(135deg,transparent_49%,rgba(0,0,0,0.18)_50%,transparent_51%)] dark:bg-[linear-gradient(135deg,transparent_49%,rgba(255,255,255,0.22)_50%,transparent_51%)]"
                        aria-hidden
                      />
                      <span className="absolute top-1 left-1 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 z-10">
                        AM
                      </span>
                      <span className="absolute bottom-1 right-1 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 z-10">
                        PM
                      </span>

                      {/* Date number */}
                      <div className={`absolute top-1 right-1 text-xs sm:text-sm font-medium z-10 ${
                        isToday
                          ? 'text-green-700 dark:text-green-300'
                          : isPast
                          ? 'text-gray-400 dark:text-gray-600'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {day.getDate()}
                      </div>

                      {/* AM Bookings - Upper Left Triangle */}
                      <div className="absolute top-0 left-0 w-1/2 h-1/2 overflow-hidden z-10 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-start justify-start p-1 sm:p-2 space-y-0.5 sm:space-y-1 pointer-events-auto">
                          {amBookings.slice(0, 2).map(booking => (
                            <div
                              key={booking.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openBookingModal(booking);
                              }}
                              className={`text-[8px] sm:text-[10px] bg-green-600 text-white px-1.5 sm:px-2 py-1 rounded-lg truncate cursor-pointer hover:opacity-90 hover:shadow-md max-w-full transition-all font-medium`}
                              title={`${formatTime12Hour(booking.startTime)} - ${formatTime12Hour(booking.endTime)}: ${booking.eventTitle || booking.type}`}
                            >
                              <span className="hidden sm:inline">{formatTime12Hour(booking.startTime)} - {booking.eventTitle || booking.type}</span>
                              <span className="sm:hidden">{formatTime12Hour(booking.startTime)}</span>
                            </div>
                          ))}
                          {amBookings.length > 2 && (
                            <div className="text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 px-1">
                              +{amBookings.length - 2}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PM Bookings - Bottom Right Triangle */}
                      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 overflow-hidden z-10 pointer-events-none">
                        <div className="absolute bottom-0 right-0 w-full h-full flex flex-col items-end justify-end p-1 sm:p-2 space-y-0.5 sm:space-y-1 pointer-events-auto">
                          {pmBookings.slice(0, 2).map(booking => (
                            <div
                              key={booking.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openBookingModal(booking);
                              }}
                              className={`text-[8px] sm:text-[10px] bg-green-600 text-white px-1.5 sm:px-2 py-1 rounded-lg truncate cursor-pointer hover:opacity-90 hover:shadow-md max-w-full transition-all font-medium`}
                              title={`${formatTime12Hour(booking.startTime)} - ${formatTime12Hour(booking.endTime)}: ${booking.eventTitle || booking.type}`}
                            >
                              <span className="hidden sm:inline">{formatTime12Hour(booking.startTime)} - {booking.eventTitle || booking.type}</span>
                              <span className="sm:hidden">{formatTime12Hour(booking.startTime)}</span>
                            </div>
                          ))}
                          {pmBookings.length > 2 && (
                            <div className="text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 px-1">
                              +{pmBookings.length - 2}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* History View - Same as admin page but filtered for dome-tent */}
        {viewMode === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
            {historyBookings.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                  <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-medium">
                  No dome tent booking history found
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  Accepted and rejected dome tent bookings will appear here
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div className="overflow-hidden rounded-2xl">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 dark:from-blue-600 dark:via-indigo-600 dark:to-purple-600">
                          <th className="text-left py-5 px-6 font-extrabold text-white text-sm uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Date
                            </div>
                          </th>
                          <th className="text-left py-5 px-6 font-extrabold text-white text-sm uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Time
                            </div>
                          </th>
                          <th className="text-left py-5 px-6 font-extrabold text-white text-sm uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              Venue
                            </div>
                          </th>
                          <th className="text-left py-5 px-6 font-extrabold text-white text-sm uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              Event Title
                            </div>
                          </th>
                          <th className="text-left py-5 px-6 font-extrabold text-white text-sm uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Contact Person
                            </div>
                          </th>
                          <th className="text-left py-5 px-6 font-extrabold text-white text-sm uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Status
                            </div>
                          </th>
                          <th className="text-left py-5 px-6 font-extrabold text-white text-sm uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {historyBookings.map((booking, index) => (
                          <tr
                            key={booking.id}
                            className={`group transition-all duration-300 ${
                              index % 2 === 0 
                                ? 'bg-white dark:bg-gray-800' 
                                : 'bg-gray-50/50 dark:bg-gray-800/50'
                            } hover:bg-gradient-to-r hover:from-blue-50 hover:via-indigo-50 hover:to-purple-50 dark:hover:from-gray-700/70 dark:hover:via-gray-700/70 dark:hover:to-gray-700/70 hover:shadow-lg hover:scale-[1.01]`}
                          >
                            <td className="py-5 px-6 text-gray-900 dark:text-white font-semibold">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="font-bold">{new Date(booking.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(booking.date).getFullYear()}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-gray-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <div className="flex-shrink-0 w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <span className="font-medium">{formatTime12Hour(booking.startTime)} - {formatTime12Hour(booking.endTime)}</span>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-gray-900 dark:text-white capitalize">
                              <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-300 shadow-sm">
                                🏕️ Dome Tent
                              </span>
                            </td>
                            <td className="py-5 px-6 text-gray-900 dark:text-white">
                              <div className="font-medium max-w-xs truncate">
                                {booking.eventTitle || <span className="text-gray-400 italic">No title</span>}
                              </div>
                            </td>
                            <td className="py-5 px-6 text-gray-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="font-medium">{booking.contactPerson || <span className="text-gray-400 italic">N/A</span>}</span>
                              </div>
                            </td>
                            <td className="py-5 px-6">
                              <span
                                className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-bold ${getStatusColor(booking.status)} text-white shadow-lg transform group-hover:scale-110 transition-transform`}
                              >
                                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {getStatusText(booking.status)}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              <button
                                onClick={() => openBookingModal(booking)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {historyBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-lg hover:shadow-xl transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {new Date(booking.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {formatTime12Hour(booking.startTime)} - {formatTime12Hour(booking.endTime)}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-bold ${getStatusColor(booking.status)} text-white shadow-sm`}
                        >
                          {getStatusText(booking.status)}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Venue: </span>
                          <span className="text-gray-900 dark:text-white capitalize">
                            Dome Tent
                          </span>
                        </div>
                        {booking.eventTitle && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Event: </span>
                            <span className="text-gray-900 dark:text-white">{booking.eventTitle}</span>
                          </div>
                        )}
                        {booking.contactPerson && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Contact: </span>
                            <span className="text-gray-900 dark:text-white">{booking.contactPerson}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => openBookingModal(booking)}
                        className="mt-4 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Booking Details Modal - Same structure as admin page */}
      {showModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-4 sm:p-6 my-4 sm:my-8 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Booking Details
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedBooking.status)} text-white self-start sm:self-auto`}>
                {getStatusText(selectedBooking.status)}
              </span>
            </div>

            <div className="space-y-4">
              {/* Booking Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Venue Type
                </label>
                <p className="text-gray-900 dark:text-white capitalize">
                  Dome Tent
                </p>
              </div>

              {/* Booking Reference */}
              {selectedBooking.bookingReferenceNo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Booking Reference No.
                  </label>
                  <p className="text-gray-900 dark:text-white">{selectedBooking.bookingReferenceNo}</p>
                </div>
              )}

              {/* Requesting Party Information */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Requesting Party Information
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {selectedBooking.dateOfRequest && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Date of Request
                      </label>
                      <p className="text-gray-900 dark:text-white">{selectedBooking.dateOfRequest}</p>
                    </div>
                  )}
                  {selectedBooking.contactPerson && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Contact Person
                      </label>
                      <p className="text-gray-900 dark:text-white">{selectedBooking.contactPerson}</p>
                    </div>
                  )}
                  {selectedBooking.requestingOffice && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Requesting Office
                      </label>
                      <p className="text-gray-900 dark:text-white">{selectedBooking.requestingOffice}</p>
                    </div>
                  )}
                  {selectedBooking.mobileNo && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mobile No.
                      </label>
                      <p className="text-gray-900 dark:text-white">{selectedBooking.mobileNo}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Details */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Event Details
                </h4>
                <div className="space-y-3">
                  {selectedBooking.eventTitle && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Event Title
                      </label>
                      <p className="text-gray-900 dark:text-white">{selectedBooking.eventTitle}</p>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Date
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(selectedBooking.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Start Time
                        </label>
                        <p className="text-gray-900 dark:text-white">{formatTime12Hour(selectedBooking.startTime)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          End Time
                        </label>
                        <p className="text-gray-900 dark:text-white">{formatTime12Hour(selectedBooking.endTime)}</p>
                      </div>
                    </div>
                  </div>
                  {selectedBooking.expectedNumberOfParticipants && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Expected Number of Participants
                      </label>
                      <p className="text-gray-900 dark:text-white">{selectedBooking.expectedNumberOfParticipants}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Equipment and Services */}
              {selectedBooking.equipmentNeeded && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Equipment and Services Needed
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedBooking.equipmentNeeded.projectorAndScreen && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                        Projector and Screen
                      </span>
                    )}
                    {selectedBooking.equipmentNeeded.lectern && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                        Lectern
                      </span>
                    )}
                    {selectedBooking.equipmentNeeded.tables && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                        Tables {selectedBooking.equipmentNeeded.tablesQuantity && `(${selectedBooking.equipmentNeeded.tablesQuantity})`}
                      </span>
                    )}
                    {selectedBooking.equipmentNeeded.whiteboard && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                        Whiteboard
                      </span>
                    )}
                    {selectedBooking.equipmentNeeded.soundSystem && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                        Sound System
                      </span>
                    )}
                    {selectedBooking.equipmentNeeded.flagStand && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                        Flag Stand
                      </span>
                    )}
                    {selectedBooking.equipmentNeeded.chairs && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                        Chairs {selectedBooking.equipmentNeeded.chairsQuantity && `(${selectedBooking.equipmentNeeded.chairsQuantity})`}
                      </span>
                    )}
                    {selectedBooking.equipmentNeeded.others && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                        {selectedBooking.equipmentNeeded.others}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              {selectedBooking.additionalNotes && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Additional Notes or Special Requests
                  </label>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {selectedBooking.additionalNotes}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {selectedBooking.status === 'pending' && (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleAcceptBooking}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm sm:text-base"
                  >
                    Accept Booking
                  </button>
                  <button
                    onClick={handleRejectBooking}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm sm:text-base"
                  >
                    Reject Booking
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm sm:text-base"
                  >
                    Close
                  </button>
                </div>
              )}

              {selectedBooking.status !== 'pending' && (
                <div className="flex gap-2 sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm sm:text-base"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Modal (Success/Error) */}
      {showStatusModal && statusModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${
                statusModalData.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {statusModalData.type === 'success' ? (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className={`text-lg sm:text-xl font-bold mb-2 ${
                  statusModalData.type === 'success'
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-red-900 dark:text-red-100'
                }`}>
                  {statusModalData.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4">
                  {statusModalData.message}
                </p>
                <button
                  onClick={closeStatusModal}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    statusModalData.type === 'success'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Appointments Modal */}
      {showDateModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 my-4 sm:my-8 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  All confirmed dome tent appointments for this date
                </p>
              </div>
              <button
                onClick={closeDateModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(() => {
              const dateBookings = getConfirmedBookingsForDate(selectedDate);
              
              if (dateBookings.length === 0) {
                return (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                      No confirmed dome tent appointments for this date
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {dateBookings
                    .sort((a, b) => {
                      const timeA = a.startTime.split(':').map(Number);
                      const timeB = b.startTime.split(':').map(Number);
                      return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
                    })
                    .map((booking) => (
                      <div
                        key={booking.id}
                        onClick={() => {
                          openBookingModal(booking);
                          closeDateModal();
                        }}
                        className="border-2 border-green-200 dark:border-green-700 rounded-xl p-4 sm:p-5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 cursor-pointer transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-600 dark:bg-green-700 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                  {formatTime12Hour(booking.startTime)} - {formatTime12Hour(booking.endTime)}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {booking.eventTitle || 'No event title'}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                🏕️ Dome Tent
                              </span>
                              {booking.contactPerson && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  👤 {booking.contactPerson}
                                </span>
                              )}
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-600 text-white">
                                ✓ Confirmed
                              </span>
                            </div>
                          </div>
                          <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
