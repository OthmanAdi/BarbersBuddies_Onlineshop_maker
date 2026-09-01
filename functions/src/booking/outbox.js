'use strict';

const { sha256Canonical } = require('./domain');

const OUTBOX_EVENT_TYPES = Object.freeze({
  CUSTOMER_EMAIL: 'booking.created.customer-email',
  SHOP_EMAIL: 'booking.created.shop-email',
});

function createOutboxId({ bookingId, version, eventType }) {
  return sha256Canonical({
    scope: 'booking-outbox:v2',
    bookingId,
    version,
    eventType,
  });
}

function buildCreateBookingOutbox({
  db,
  bookingId,
  bookingVersion,
  shopId,
  commandId,
  serverTimestamp,
}) {
  const definitions = [
    {
      eventType: OUTBOX_EVENT_TYPES.CUSTOMER_EMAIL,
      audience: 'customer',
    },
    {
      eventType: OUTBOX_EVENT_TYPES.SHOP_EMAIL,
      audience: 'shop',
    },
  ];

  return Object.freeze(definitions.map(({ eventType, audience }) => {
    const id = createOutboxId({ bookingId, version: bookingVersion, eventType });
    return Object.freeze({
      ref: db.collection('bookingOutbox').doc(id),
      data: {
        schemaVersion: 2,
        id,
        eventType,
        channel: 'email',
        audience,
        bookingId,
        shopId,
        bookingVersion,
        commandId,
        state: 'pending',
        attempts: 0,
        availableAt: serverTimestamp,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      },
    });
  }));
}

module.exports = {
  OUTBOX_EVENT_TYPES,
  buildCreateBookingOutbox,
  createOutboxId,
};
