'use strict';

const { normalizeEmail } = require('./domain');
const { BookingError } = require('./errors');

const IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f/]{1,128}$/;

function authError(code, message, httpStatus, details = {}) {
  return new BookingError(code, message, {
    httpStatus,
    retryable: false,
    details,
  });
}

function normalizeIdentifier(value, field) {
  if (typeof value !== 'string') {
    throw authError('UNAUTHENTICATED', 'a verified Firebase identity is required', 401);
  }
  if (value !== value.trim() || !IDENTIFIER_PATTERN.test(value)) {
    throw authError('UNAUTHENTICATED', 'a verified Firebase identity is required', 401);
  }
  return value;
}

/**
 * Normalizes an actor that has already crossed the Firebase ID-token verification
 * boundary. This module deliberately does not accept request-body identity fields.
 */
function normalizeVerifiedActor(actor) {
  if (actor === null || typeof actor !== 'object' || Array.isArray(actor)) {
    throw authError('UNAUTHENTICATED', 'a verified Firebase identity is required', 401);
  }

  const uid = normalizeIdentifier(actor.uid, 'actor.uid');
  const emailVerified = actor.emailVerified === true || actor.email_verified === true;
  let email = null;
  if (emailVerified && typeof actor.email === 'string' && actor.email.trim().length > 0) {
    try {
      email = normalizeEmail(actor.email);
    } catch (error) {
      if (!(error instanceof BookingError)) {
        throw error;
      }
      // An invalid optional email cannot authorize a legacy binding. The UID is
      // still a valid verified identity for owner or already-bound customer use.
      email = null;
    }
  }

  return Object.freeze({ uid, email, emailVerified });
}

function normalizedBookingEmail(booking) {
  if (typeof booking?.userEmail !== 'string' || booking.userEmail.trim().length === 0) {
    return null;
  }
  let legacyEmail;
  try {
    legacyEmail = normalizeEmail(booking.userEmail);
  } catch (error) {
    if (error instanceof BookingError) {
      return null;
    }
    throw error;
  }

  if (booking?.customer?.email !== undefined && booking.customer.email !== null) {
    try {
      if (normalizeEmail(booking.customer.email) !== legacyEmail) {
        return null;
      }
    } catch (error) {
      if (error instanceof BookingError) {
        return null;
      }
      throw error;
    }
  }
  return legacyEmail;
}

/**
 * Authorizes a mutation using only a verified actor plus authoritative booking
 * and shop documents read in the same transaction.
 */
function authorizeBookingMutation({ actor, booking, shop }) {
  const verifiedActor = normalizeVerifiedActor(actor);
  if (booking === null || typeof booking !== 'object' || Array.isArray(booking)) {
    throw authError('BOOKING_NOT_FOUND', 'booking does not exist', 404);
  }
  if (shop === null || typeof shop !== 'object' || Array.isArray(shop)) {
    throw authError('SHOP_NOT_FOUND', 'shop does not exist or is inactive', 404);
  }

  if (typeof shop.ownerId === 'string' && shop.ownerId === verifiedActor.uid) {
    return Object.freeze({
      actor: verifiedActor,
      role: 'shop-owner',
      bindCustomerUid: false,
    });
  }

  const customerUid = typeof booking.customerUid === 'string'
    ? booking.customerUid
    : '';
  if (customerUid.length > 0) {
    if (customerUid === verifiedActor.uid) {
      return Object.freeze({
        actor: verifiedActor,
        role: 'customer',
        bindCustomerUid: false,
      });
    }
    throw authError('FORBIDDEN', 'verified caller cannot mutate this booking', 403);
  }

  const bookingEmail = normalizedBookingEmail(booking);
  if (
    verifiedActor.emailVerified &&
    verifiedActor.email !== null &&
    bookingEmail !== null &&
    verifiedActor.email === bookingEmail
  ) {
    return Object.freeze({
      actor: verifiedActor,
      role: 'customer',
      bindCustomerUid: true,
    });
  }

  throw authError('FORBIDDEN', 'verified caller cannot mutate this booking', 403);
}

module.exports = {
  authorizeBookingMutation,
  normalizeVerifiedActor,
};
