import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  Timestamp,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from './firebase';

export interface Appointment {
  id?: string;
  title: string;
  description?: string;
  date: Date;
  startTime: string;
  endTime: string;
  clientName: string;
  clientEmail?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

// Convert appointment from Firestore
const convertAppointment = (doc: DocumentData): Appointment => {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title,
    description: data.description,
    date: convertTimestamp(data.date),
    startTime: data.startTime,
    endTime: data.endTime,
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    createdAt: data.createdAt ? convertTimestamp(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
  };
};

// Create a new appointment
export const createAppointment = async (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const appointmentRef = await addDoc(collection(db, 'appointments'), {
    ...appointment,
    date: Timestamp.fromDate(appointment.date),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return appointmentRef.id;
};

// Update an appointment
export const updateAppointment = async (id: string, appointment: Partial<Omit<Appointment, 'id' | 'createdAt'>>): Promise<void> => {
  const appointmentRef = doc(db, 'appointments', id);
  const updateData: any = {
    ...appointment,
    updatedAt: Timestamp.now(),
  };
  
  if (appointment.date) {
    updateData.date = Timestamp.fromDate(appointment.date);
  }
  
  await updateDoc(appointmentRef, updateData);
};

// Delete an appointment
export const deleteAppointment = async (id: string): Promise<void> => {
  const appointmentRef = doc(db, 'appointments', id);
  await deleteDoc(appointmentRef);
};

// Subscribe to appointments (real-time)
export const subscribeToAppointments = (
  callback: (appointments: Appointment[]) => void
): (() => void) => {
  const q = query(collection(db, 'appointments'), orderBy('date', 'asc'));
  
  const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const appointments = snapshot.docs.map(convertAppointment);
    callback(appointments);
  });
  
  return unsubscribe;
};

