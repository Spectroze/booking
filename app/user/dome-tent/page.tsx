'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '../../services/auth';
import { createBooking, subscribeToBookings, type Booking } from '../../services/bookings';
import { toast } from 'react-toastify';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

function DomeTentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date') || '';
  const [loading, setLoading] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedReferenceNo, setGeneratedReferenceNo] = useState<string>('');
  const [formData, setFormData] = useState({
    bookingReferenceNo: '',
    // Requesting Party Information
    dateOfRequest: new Date().toISOString().split('T')[0],
    contactPerson: '',
    requestingOffice: '',
    mobileNo: '',
    // Event Details
    eventTitle: '',
    typeOfEvent: '',
    date: dateParam,
    startTime: '',
    endTime: '',
    expectedNumberOfParticipants: '',
    // Equipment and Services
    lectern: false,
    tables: false,
    flagStand: false,
    chairs: false,
    chairsQuantity: '',
    others: '',
    // Additional Notes
    additionalNotes: '',
  });

  // Bookings state for validation
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Check authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Subscribe to dome-tent bookings for validation
  useEffect(() => {
    const unsubscribe = subscribeToBookings((bookingsList) => {
      setBookings(bookingsList.filter((b) => b.type === 'dome-tent'));
    });
    return () => unsubscribe();
  }, []);

  // Helper to get booking status for a specific date
  const getDayBookings = (date: Date | null) => {
    if (!date) return { am: false, pm: false, hasBookings: false, bookings: [] };

    let am = false;
    let pm = false;

    const dayBookings = bookings.filter((b) => {
      const bookingDate = new Date(b.date);
      const isPendingOrConfirmed = !b.status || b.status === 'pending' || b.status === 'confirmed';
      return bookingDate.toDateString() === date.toDateString() && isPendingOrConfirmed;
    });

    dayBookings.forEach(b => {
      if (!b.startTime) return;

      const getFloatTime = (time: string) => {
        if (!time) return 0;
        const [h, m] = time.split(':');
        return parseInt(h, 10) + parseInt(m, 10) / 60;
      };

      const startFloat = getFloatTime(b.startTime);
      const endFloat = b.endTime ? getFloatTime(b.endTime) : startFloat;

      if (startFloat < 12) {
        am = true;
      }
      if (startFloat >= 12 || endFloat > 12) {
        pm = true;
      }
    });

    return { am, pm, hasBookings: dayBookings.length > 0, bookings: dayBookings };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number
    if (formData.mobileNo.length !== 11) {
      toast.error('Please enter a valid 11-digit mobile number.');
      return;
    }

    // Validate if date is selected
    if (!formData.date) {
      toast.error('Please select a date for your event.');
      return;
    }

    // Check if the selected date is completely scheduled
    const selectedDate = new Date(formData.date);
    const dayStatus = getDayBookings(selectedDate);

    if (dayStatus.am && dayStatus.pm) {
      const formattedDate = selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      toast.error(`This date (${formattedDate}) is fully booked. Please select another date.`);
      return;
    }

    // Check for AM/PM slot overlap
    if (formData.startTime) {
      if (formData.endTime && formData.startTime >= formData.endTime) {
        toast.error('Start time must be before end time.');
        return;
      }

      const getFloatTime = (time: string) => {
        const [h, m] = time.split(':');
        return parseInt(h, 10) + parseInt(m, 10) / 60;
      };

      const startFloat = getFloatTime(formData.startTime);
      const endFloat = formData.endTime ? getFloatTime(formData.endTime) : startFloat;

      const requestsAM = startFloat < 12;
      // It implies PM if it starts at/after 12, or ends strictly after 12:00
      const requestsPM = startFloat >= 12 || endFloat > 12;

      if (requestsAM && dayStatus.am) {
        toast.error('The AM slot for this date is already booked. Please select a PM time (12:00 PM onwards).');
        return;
      }

      if (requestsPM && dayStatus.pm) {
        toast.error('The PM slot for this date is already booked. Please select an AM time (before 12:00 PM).');
        return;
      }
    }

    setLoading(true);
    setSubmitProgress(0);

    // Simulate progress bar increment while processing
    const progressInterval = setInterval(() => {
      setSubmitProgress(prev => {
        // Slow down as it gets closer to 90% to wait for actual completion
        if (prev >= 90) return prev;
        const increment = prev < 50 ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 5) + 1;
        return Math.min(prev + increment, 90);
      });
    }, 200);

    try {
      // Get current user's email
      const user = auth.currentUser;
      const userEmail = user?.email || undefined;

      const bookingData = {
        type: 'dome-tent' as const,
        dateOfRequest: formData.dateOfRequest,
        contactPerson: formData.contactPerson,
        requestingOffice: formData.requestingOffice,
        mobileNo: formData.mobileNo,
        clientEmail: userEmail,
        eventTitle: formData.eventTitle,
        typeOfEvent: formData.typeOfEvent,
        date: new Date(formData.date),
        startTime: formData.startTime,
        endTime: formData.endTime,
        expectedNumberOfParticipants: formData.expectedNumberOfParticipants ? parseInt(formData.expectedNumberOfParticipants) : undefined,
        equipmentNeeded: {
          lectern: formData.lectern,
          tables: formData.tables,
          flagStand: formData.flagStand,
          chairs: formData.chairs,
          chairsQuantity: formData.chairsQuantity ? parseInt(formData.chairsQuantity) : undefined,
          others: formData.others || undefined,
        },
        additionalNotes: formData.additionalNotes || undefined,
      };

      const result = await createBooking(bookingData);
      setGeneratedReferenceNo(result.bookingReferenceNo);

      // Notify admins about the new booking
      try {
        // Convert Date object to ISO string for API
        const bookingForApi = {
          ...bookingData,
          date: bookingData.date.toISOString(),
        };

        const response = await fetch('/api/notify-admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking: bookingForApi,
          }),
        });

        if (!response.ok) {
          // Try to get error message from response
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json();
              if (errorData.error) {
                errorMessage = errorData.error;
              } else if (errorData.message) {
                errorMessage = errorData.message;
              } else if (Object.keys(errorData).length > 0) {
                errorMessage = JSON.stringify(errorData);
              }
            } else {
              const text = await response.text();
              if (text) {
                errorMessage = text;
              }
            }
          } catch (parseError) {
            // If parsing fails, use default error message
            console.warn('Could not parse error response:', parseError);
          }
          console.warn('Admin notification failed:', errorMessage);
        } else {
          try {
            const result = await response.json();
            console.log('Admin notification sent:', result);
          } catch (parseError) {
            console.warn('Admin notification may have succeeded but could not parse response');
          }
        }
      } catch (notifyError: any) {
        console.warn('Error notifying admins:', notifyError?.message || notifyError);
        // Don't fail the booking if notification fails
      }

      // Once fully complete, jump to 100%
      clearInterval(progressInterval);
      setSubmitProgress(100);

      toast.success('Booking successfully submitted!');
      // Slight delay to let user see 100% before modal shows up
      setTimeout(() => setShowSuccessModal(true), 300);
    } catch (error) {
      clearInterval(progressInterval);
      setSubmitProgress(0);
      console.error('Error creating booking:', error);
      toast.error('Failed to submit booking. Please try again.');
    } finally {
      setTimeout(() => setLoading(false), 500); // Give it a short moment after completion
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/user')}
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Venue Selection
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 border-2 border-yellow-400">
          {/* Official Header */}
          <div className="text-center mb-8 border-b-2 border-yellow-400 pb-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">Republic of the Philippines</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              PROVINCIAL GOVERNMENT OF AURORA
            </h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">Baler</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              PGA Multi-purpose Covered Court (Dome Tent) BOOKING REQUEST FORM
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Booking Reference No */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                BOOKING REFERENCE NO.
              </label>
              <input
                type="text"
                value={generatedReferenceNo || 'Will be generated upon submission'}
                readOnly
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Reference number will be automatically generated when you submit the form
              </p>
            </div>

            {/* REQUESTING PARTY INFORMATION */}
            <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 uppercase">
                REQUESTING PARTY INFORMATION
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date of request: *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dateOfRequest}
                    onChange={(e) => setFormData({ ...formData, dateOfRequest: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact person: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Requesting office: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.requestingOffice}
                    onChange={(e) => setFormData({ ...formData, requestingOffice: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mobile no.: *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.mobileNo}
                    onChange={(e) => {
                      // Only allow numbers and limit to 11 digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setFormData({ ...formData, mobileNo: value });
                    }}
                    pattern="[0-9]{11}"
                    maxLength={11}
                    placeholder="11 digits only"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {formData.mobileNo && formData.mobileNo.length !== 11 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                      Please enter exactly 11 digits
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* EVENT DETAILS */}
            <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 uppercase">
                EVENT DETAILS
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Event Title: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.eventTitle}
                    onChange={(e) => setFormData({ ...formData, eventTitle: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type of Event / Activity: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.typeOfEvent}
                    onChange={(e) => setFormData({ ...formData, typeOfEvent: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preferred Date: *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setFormData({ ...formData, date: '' });
                        return;
                      }
                      const selected = new Date(e.target.value);
                      const status = getDayBookings(selected);
                      if (status.am && status.pm) {
                        toast.error('This date is fully booked. Please select another date.');
                        setFormData({ ...formData, date: '' });
                      } else {
                        setFormData({ ...formData, date: e.target.value });
                        if (status.am) toast.info('AM is already booked on this date. You may book for PM.');
                        else if (status.pm) toast.info('PM is already booked on this date. You may book for AM.');
                      }
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Time: *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Time: *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expected Number of Participants: *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.expectedNumberOfParticipants}
                    onChange={(e) => setFormData({ ...formData, expectedNumberOfParticipants: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Equipment and Services Needed */}
            <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Equipment and Services Needed (check all that apply):
              </h3>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="lectern"
                    checked={formData.lectern}
                    onChange={(e) => setFormData({ ...formData, lectern: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="lectern" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Lectern
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="tables"
                    checked={formData.tables}
                    onChange={(e) => setFormData({ ...formData, tables: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="tables" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tables
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="flagStand"
                    checked={formData.flagStand}
                    onChange={(e) => setFormData({ ...formData, flagStand: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="flagStand" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Flag stand
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="chairs"
                    checked={formData.chairs}
                    onChange={(e) => setFormData({ ...formData, chairs: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="chairs" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Chairs
                  </label>
                  {formData.chairs && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">(qtty)</span>
                  )}
                  {formData.chairs && (
                    <input
                      type="number"
                      min="1"
                      value={formData.chairsQuantity}
                      onChange={(e) => setFormData({ ...formData, chairsQuantity: e.target.value })}
                      placeholder="Quantity"
                      className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="others"
                      checked={!!formData.others}
                      onChange={(e) => setFormData({ ...formData, others: e.target.checked ? formData.others || '' : '' })}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="others" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Others:
                    </label>
                  </div>
                  <input
                    type="text"
                    value={formData.others}
                    onChange={(e) => setFormData({ ...formData, others: e.target.value })}
                    placeholder="Specify"
                    className="flex-1 min-w-[200px] px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Additional Notes or Special Requests */}
            <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Additional Notes or Special Requests:
              </h3>
              <textarea
                value={formData.additionalNotes}
                onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-6 border-t-2 border-gray-300 dark:border-gray-600">
              <button
                type="button"
                onClick={() => router.push('/user')}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="relative flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium overflow-hidden disabled:opacity-100 disabled:cursor-wait"
              >
                {/* Background Progress Bar Fill */}
                {loading && (
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-800 transition-all duration-200 ease-out"
                    style={{ width: `${submitProgress}%` }}
                  />
                )}

                {/* Button Content Context */}
                <div className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Submitting... {submitProgress}%</span>
                    </>
                  ) : (
                    'Submit Booking Request'
                  )}
                </div>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              {/* Success Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">
                  Booking Submitted Successfully!
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Your booking request has been submitted. We will review it and contact you soon to confirm. You will receive an email notification once your booking is processed.
                </p>
                {generatedReferenceNo && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Your Booking Reference Number:
                    </p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300 font-mono">
                      {generatedReferenceNo}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                      Please save this reference number for your records.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push('/user');
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
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

export default function DomeTentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <DomeTentContent />
    </Suspense>
  );
}
