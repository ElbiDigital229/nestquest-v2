import { EventEmitter } from "events";

export interface BookingConfirmedPayload {
  bookingId: string;
  pmUserId: string;
  guestUserId: string | null;
  guestName: string;
  propertyId: string;
  propertyName: string;
  propertyAddress?: string;
  pmName?: string;
  pmPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalNights: number;
  totalAmount: string;
  accessPin?: string | null;
}

export interface BookingCheckedInPayload extends BookingConfirmedPayload {
  accessPin: string | null;
}

export interface BookingCheckedOutPayload {
  bookingId: string;
  pmUserId: string;
  guestUserId: string | null;
  guestName: string;
  propertyId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalNights: number;
}

export interface BookingCancelledPayload {
  bookingId: string;
  guestUserId: string | null;
  propertyId: string;
  propertyName: string;
  reason?: string;
}

interface BookingEvents {
  "booking:confirmed": [BookingConfirmedPayload];
  "booking:checked_in": [BookingCheckedInPayload];
  "booking:checked_out": [BookingCheckedOutPayload];
  "booking:cancelled": [BookingCancelledPayload];
}

class TypedBookingEmitter extends EventEmitter {
  emit<K extends keyof BookingEvents>(event: K, payload: BookingEvents[K][0]): boolean {
    return super.emit(event as string, payload);
  }

  on<K extends keyof BookingEvents>(event: K, listener: (payload: BookingEvents[K][0]) => void): this {
    return super.on(event as string, listener);
  }
}

export const bookingEmitter = new TypedBookingEmitter();
