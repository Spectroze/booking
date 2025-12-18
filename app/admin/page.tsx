'use client';

import { useState, useEffect } from 'react';
import { Booking, subscribeToBookings, updateBookingStatus } from '../services/bookings';
import { auth } from '../services/auth';
import { useRouter } from 'next/navigation';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'history'>('calendar');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalData, setStatusModalData] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
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
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.date);
      // Only show pending bookings on the calendar (accepted/rejected are in history)
      return bookingDate.toDateString() === date.toDateString() && 
             booking.status === 'pending';
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

  // Get history bookings (confirmed and cancelled)
  const historyBookings = bookings.filter(
    booking => booking.status === 'confirmed' || booking.status === 'cancelled'
  ).sort((a, b) => {
    // Sort by date (most recent first)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const days = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {viewMode === 'calendar' ? 'Booking Calendar' : 'Booking History'}
            </h1>
            {viewMode === 'calendar' && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </p>
            )}
            {viewMode === 'history' && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                All accepted and rejected bookings
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                viewMode === 'history'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Calendar View */}
        {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          {/* Calendar Navigation */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              ← Previous
            </button>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Next →
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {dayNames.map(day => (
              <div key={day} className="text-center font-semibold text-gray-700 dark:text-gray-300 py-2">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {days.map((day, index) => {
              const dayBookings = getBookingsForDate(day);
              const isToday = day && day.toDateString() === new Date().toDateString();
              const isPast = day && day < new Date() && !isToday;

              return (
                <div
                  key={index}
                  className={`min-h-[100px] border rounded-lg p-2 ${
                    day
                      ? isToday
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                        : isPast
                        ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-transparent border-transparent'
                  }`}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${
                        isToday
                          ? 'text-blue-700 dark:text-blue-300'
                          : isPast
                          ? 'text-gray-400 dark:text-gray-600'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayBookings.slice(0, 2).map(booking => (
                          <div
                            key={booking.id}
                            onClick={() => openBookingModal(booking)}
                            className={`text-xs ${getStatusColor(booking.status)} text-white px-2 py-1 rounded truncate cursor-pointer hover:opacity-80`}
                            title={`${booking.startTime} - ${booking.endTime}: ${booking.eventTitle || booking.type}`}
                          >
                            {booking.startTime} - {booking.eventTitle || booking.type}
                          </div>
                        ))}
                        {dayBookings.length > 2 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                            +{dayBookings.length - 2} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* History View */}
        {viewMode === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            {historyBookings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No booking history found. Accepted and rejected bookings will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Time</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Venue</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Event Title</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Contact Person</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyBookings.map((booking) => (
                      <tr
                        key={booking.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {new Date(booking.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {booking.startTime} - {booking.endTime}
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white capitalize">
                          {booking.type === 'dome-tent' ? 'Dome Tent' : 'Training Hall'}
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {booking.eventTitle || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {booking.contactPerson || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)} text-white`}
                          >
                            {getStatusText(booking.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openBookingModal(booking)}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {showModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Booking Details
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedBooking.status)} text-white`}>
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
                  {selectedBooking.type === 'dome-tent' ? 'Dome Tent' : 'Training Hall'}
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
                        <p className="text-gray-900 dark:text-white">{selectedBooking.startTime}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          End Time
                        </label>
                        <p className="text-gray-900 dark:text-white">{selectedBooking.endTime}</p>
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

              {/* Type of Activity (Training Hall) */}
              {selectedBooking.typeOfActivity && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type of Activity
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedBooking.typeOfActivity.training && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                        Training
                      </span>
                    )}
                    {selectedBooking.typeOfActivity.seminar && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                        Seminar
                      </span>
                    )}
                    {selectedBooking.typeOfActivity.workshop && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                        Workshop
                      </span>
                    )}
                    {selectedBooking.typeOfActivity.meeting && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                        Meeting
                      </span>
                    )}
                    {selectedBooking.typeOfActivity.others && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                        {selectedBooking.typeOfActivity.others}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Room Layout Preference (Training Hall) */}
              {selectedBooking.roomLayoutPreference && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Room Layout Preference
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedBooking.roomLayoutPreference.classroom && (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                        Classroom
                      </span>
                    )}
                    {selectedBooking.roomLayoutPreference.theater && (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                        Theater
                      </span>
                    )}
                    {selectedBooking.roomLayoutPreference.uShape && (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                        U-Shape
                      </span>
                    )}
                    {selectedBooking.roomLayoutPreference.boardroom && (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                        Boardroom
                      </span>
                    )}
                  </div>
                </div>
              )}

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
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleAcceptBooking}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Accept Booking
                  </button>
                  <button
                    onClick={handleRejectBooking}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Reject Booking
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}

              {selectedBooking.status !== 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                statusModalData.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {statusModalData.type === 'success' ? (
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-2 ${
                  statusModalData.type === 'success'
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-red-900 dark:text-red-100'
                }`}>
                  {statusModalData.title}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {statusModalData.message}
                </p>
                <button
                  onClick={closeStatusModal}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
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
    </div>
  );
}
