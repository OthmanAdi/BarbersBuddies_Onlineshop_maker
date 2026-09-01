// Compatibility facade. The canonical registry now owns the protocol, durable
// localStorage key, fingerprint scope, error identity, and lifecycle semantics.
export {
  BOOKING_INTENT_STORAGE_KEY,
  BookingIntentRegistryError,
  acquireBookingIntentKey as getBookingIntentKey,
  settleBookingIntent,
} from '../booking-v2/intentRegistry';
