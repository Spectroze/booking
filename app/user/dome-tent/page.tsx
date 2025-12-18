'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../services/auth';
import { createBooking } from '../../services/bookings';

export default function DomeTentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
    date: '',
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

  // Check authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    if (formData.mobileNo.length !== 11) {
      alert('Please enter a valid 11-digit mobile number.');
      return;
    }
    
    setLoading(true);

    try {
      // Get current user's email
      const user = auth.currentUser;
      const userEmail = user?.email || undefined;

      const bookingData = {
        type: 'dome-tent' as const,
        bookingReferenceNo: formData.bookingReferenceNo || undefined,
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

      await createBooking(bookingData);

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
          const errorData = await response.json();
          console.error('Admin notification failed:', errorData);
        } else {
          const result = await response.json();
          console.log('Admin notification sent:', result);
        }
      } catch (notifyError) {
        console.error('Error notifying admins:', notifyError);
        // Don't fail the booking if notification fails
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to submit booking. Please try again.');
    } finally {
      setLoading(false);
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
                value={formData.bookingReferenceNo}
                onChange={(e) => setFormData({ ...formData, bookingReferenceNo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
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
                    Date of Event: *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                className="flex-1 px-6 py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Booking Request'}
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
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Your booking request has been submitted. We will review it and contact you soon to confirm. You will receive an email notification once your booking is processed.
                </p>
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
