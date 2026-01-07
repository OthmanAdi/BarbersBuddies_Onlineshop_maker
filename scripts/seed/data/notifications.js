/**
 * Notification Generator for Seed Data
 */

const { generateId, randomItem, randomInt } = require('../utils/random');
const { generateTimestamp } = require('../utils/dates');

// Notification types and their templates
const NOTIFICATION_TYPES = {
  new_booking: {
    title: 'New Booking',
    messageTemplate: (data) => `${data.customerName} booked an appointment for ${data.date} at ${data.time}`
  },
  reschedule: {
    title: 'Appointment Rescheduled',
    messageTemplate: (data) => `${data.customerName} rescheduled their appointment to ${data.date} at ${data.time}`
  },
  status_update: {
    title: 'Booking Status Updated',
    messageTemplate: (data) => `Booking for ${data.customerName} has been ${data.status}`
  },
  new_message: {
    title: 'New Message',
    messageTemplate: (data) => `You have a new message from ${data.customerName}`
  },
  rating_response: {
    title: 'New Review',
    messageTemplate: (data) => `${data.customerName} left a ${data.rating}-star review`
  },
  reminder: {
    title: 'Appointment Reminder',
    messageTemplate: (data) => `Reminder: ${data.customerName} has an appointment tomorrow at ${data.time}`
  }
};

/**
 * Generate a notification
 * @param {string} type - Notification type
 * @param {Object} data - Data for the notification
 * @param {Object} shop - Shop object
 * @returns {Object} Notification object
 */
const generateNotification = (type, data, shop) => {
  const template = NOTIFICATION_TYPES[type];

  return {
    id: generateId(20),
    userId: shop.ownerId,
    shopId: shop.id,
    bookingId: data.bookingId || null,

    type,
    title: template.title,
    message: template.messageTemplate(data),

    appointmentDate: data.date || null,
    appointmentTime: data.time || null,
    services: data.services || '',
    totalPrice: data.totalPrice || 0,
    customerName: data.customerName,
    userEmail: data.userEmail || '',
    employeeId: data.employeeId || null,
    employeeName: data.employeeName || null,

    createdAt: generateTimestamp(data.daysAgo || -randomInt(0, 5)),
    read: Math.random() > 0.3, // 70% read
    status: 'delivered'
  };
};

/**
 * Generate notifications for demo shop from bookings
 * @param {Array} bookings - Shop's bookings
 * @param {Object} shop - Shop object
 * @param {Array} ratings - Shop's ratings
 * @returns {Array} Array of notification objects
 */
const generateShopNotifications = (bookings, shop, ratings = []) => {
  const notifications = [];

  // Notifications from bookings
  bookings.forEach((booking, index) => {
    // New booking notification
    notifications.push(generateNotification('new_booking', {
      bookingId: booking.id,
      customerName: booking.userName,
      userEmail: booking.userEmail,
      date: booking.selectedDate,
      time: booking.selectedTime,
      services: booking.selectedServices.map(s => s.name).join(', '),
      totalPrice: booking.totalPrice,
      employeeId: booking.employeeId,
      employeeName: booking.employeeName,
      daysAgo: -randomInt(1, 5)
    }, shop));

    // Status update notification for some
    if (booking.status === 'cancelled' && Math.random() > 0.5) {
      notifications.push(generateNotification('status_update', {
        bookingId: booking.id,
        customerName: booking.userName,
        status: 'cancelled',
        daysAgo: -randomInt(0, 3)
      }, shop));
    }

    // Reschedule notification
    if (booking.status === 'rescheduled') {
      notifications.push(generateNotification('reschedule', {
        bookingId: booking.id,
        customerName: booking.userName,
        date: booking.selectedDate,
        time: booking.selectedTime,
        daysAgo: -randomInt(0, 3)
      }, shop));
    }
  });

  // Notifications from ratings
  ratings.forEach(rating => {
    if (Math.random() > 0.3) {
      notifications.push(generateNotification('rating_response', {
        bookingId: rating.bookingId,
        customerName: rating.userName,
        rating: rating.rating,
        daysAgo: -randomInt(0, 4)
      }, shop));
    }
  });

  // Add some message notifications
  const messageNotificationCount = randomInt(5, 15);
  for (let i = 0; i < messageNotificationCount; i++) {
    const randomBooking = randomItem(bookings);
    notifications.push(generateNotification('new_message', {
      bookingId: randomBooking.id,
      customerName: randomBooking.userName,
      daysAgo: -randomInt(0, 5)
    }, shop));
  }

  // Sort by createdAt (newest first)
  return notifications.sort((a, b) => b.createdAt - a.createdAt);
};

module.exports = {
  NOTIFICATION_TYPES,
  generateNotification,
  generateShopNotifications
};
