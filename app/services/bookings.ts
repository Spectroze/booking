import { 
  collection, 
  addDoc, 
  updateDoc,
  doc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Booking {
  id?: string;
  type: 'dome-tent' | 'training-hall';
  bookingReferenceNo?: string;
  // Requesting Party Information
  dateOfRequest?: string;
  contactPerson?: string;
  requestingOffice?: string;
  mobileNo?: string;
  // Event Details
  eventTitle?: string;
  typeOfEvent?: string;
  // Training Hall specific fields
  typeOfActivity?: {
    training?: boolean;
    seminar?: boolean;
    workshop?: boolean;
    meeting?: boolean;
    others?: string;
  };
  preferredDates?: string;
  date: Date;
  startTime: string;
  endTime: string;
  expectedNumberOfParticipants?: number;
  roomLayoutPreference?: {
    classroom?: boolean;
    theater?: boolean;
    uShape?: boolean;
    boardroom?: boolean;
  };
  // Equipment and Services
  equipmentNeeded?: {
    projectorAndScreen?: boolean;
    lectern?: boolean;
    tables?: boolean;
    tablesQuantity?: number;
    whiteboard?: boolean;
    soundSystem?: boolean;
    flagStand?: boolean;
    chairs?: boolean;
    chairsQuantity?: number;
    others?: string;
  };
  // Additional Information
  additionalNotes?: string;
  // Legacy fields (for backward compatibility)
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  numberOfGuests?: number;
  specialRequests?: string;
  status?: 'pending' | 'confirmed' | 'cancelled';
  createdAt?: Date;
}

// Helper function to remove undefined values from an object (including nested objects)
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  
  return obj;
};

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
};

// Convert Firestore document to Booking
const convertBooking = (doc: DocumentData): Booking => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    date: convertTimestamp(data.date),
    createdAt: data.createdAt ? convertTimestamp(data.createdAt) : undefined,
  };
};

// Create a new booking
export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt' | 'status'>): Promise<string> => {
  // Remove all undefined values before saving
  const cleanedBooking = removeUndefined({
    ...booking,
    date: Timestamp.fromDate(booking.date),
    status: 'pending',
    createdAt: Timestamp.now(),
  });
  
  const bookingRef = await addDoc(collection(db, 'bookings'), cleanedBooking);
  return bookingRef.id;
};

// Get all bookings
export const getBookings = async (): Promise<Booking[]> => {
  const q = query(collection(db, 'bookings'), orderBy('date', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(convertBooking);
};

// Subscribe to bookings (real-time)
export const subscribeToBookings = (
  callback: (bookings: Booking[]) => void
): (() => void) => {
  const q = query(collection(db, 'bookings'), orderBy('date', 'asc'));
  
  const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const bookings = snapshot.docs.map(convertBooking);
    callback(bookings);
  });
  
  return unsubscribe;
};

// Update booking status
export const updateBookingStatus = async (
  bookingId: string,
  status: 'pending' | 'confirmed' | 'cancelled'
): Promise<void> => {
  const bookingRef = doc(db, 'bookings', bookingId);
  await updateDoc(bookingRef, { status });
};

