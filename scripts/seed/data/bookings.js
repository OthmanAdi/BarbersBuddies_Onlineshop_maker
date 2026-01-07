/**
 * Booking Generator for Seed Data
 */

const { generateId, randomItem, randomInt, randomSubset, weightedRandom } = require('../utils/random');
const { randomDate, randomTimeSlot, generateTimestamp, getToday } = require('../utils/dates');
const config = require('../config');

/**
 * Generate bookings for a shop
 * @param {Object} shop - Shop object with services and employees
 * @param {Array} customers - Array of customer objects
 * @param {number} count - Number of bookings to generate
 * @returns {Array} Array of booking objects
 */
const generateShopBookings = (shop, customers, count = 20) => {
  const bookings = [];
  const today = getToday();

  for (let i = 0; i < count; i++) {
    const customer = randomItem(customers);
    const employee = randomItem(shop.employees);
    const selectedServices = randomSubset(shop.services, randomInt(1, 3));
    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

    // Determine date: 60% past, 30% future, 10% today
    let selectedDate;
    const dateType = Math.random();
    if (dateType < 0.6) {
      selectedDate = randomDate(-5, -1); // Past
    } else if (dateType < 0.9) {
      selectedDate = randomDate(1, 7); // Future
    } else {
      selectedDate = today; // Today
    }

    // Status based on date
    let status;
    if (selectedDate < today) {
      // Past bookings
      status = weightedRandom({
        completed: 70,
        cancelled: 20,
        rescheduled: 10
      });
    } else if (selectedDate === today) {
      // Today's bookings
      status = weightedRandom({
        confirmed: 60,
        pending: 30,
        completed: 10
      });
    } else {
      // Future bookings
      status = weightedRandom({
        confirmed: 50,
        pending: 40,
        cancelled: 10
      });
    }

    const selectedTime = randomTimeSlot('09:00', '17:00');
    const createdAtOffset = selectedDate < today ? randomInt(-10, -1) : randomInt(-7, -1);

    const booking = {
      id: generateId(20),
      shopId: shop.id,
      shopEmail: shop.email,

      userName: customer.displayName,
      userEmail: customer.email.toLowerCase(),
      userPhone: customer.phoneNumber,

      selectedDate,
      selectedTime,
      selectedServices: selectedServices.map(s => ({
        name: s.name,
        price: s.price,
        duration: s.duration
      })),
      customService: '',
      totalPrice,

      employeeId: employee.id,
      employeeName: employee.name,

      status,
      createdAt: generateTimestamp(createdAtOffset),
      lastModified: generateTimestamp(Math.min(createdAtOffset + 1, 0)),

      // Rating fields (will be populated by seedRatings for completed bookings)
      isRated: false,
      rating: 0,
      review: '',
      ratingId: null,
      ratingSubmittedAt: null,

      timeSlotId: generateId(20),
      notes: ''
    };

    // Add cancellation details if cancelled
    if (status === 'cancelled') {
      booking.cancellationReason = randomItem([
        'Schedule conflict',
        'Feeling unwell',
        'Emergency came up',
        'Need to reschedule',
        'Changed my mind'
      ]);
      booking.cancelledAt = generateTimestamp(createdAtOffset + 1);
      booking.cancelledBy = Math.random() > 0.7 ? 'shop' : 'customer';
    }

    // Add reschedule details if rescheduled
    if (status === 'rescheduled') {
      booking.previousDate = randomDate(-10, -6);
      booking.previousTime = randomTimeSlot('09:00', '17:00');
      booking.rescheduledAt = generateTimestamp(createdAtOffset + 1);
      booking.rescheduledBy = 'customer';
      booking.reschedulingReason = 'Time conflict';
    }

    bookings.push(booking);
  }

  return bookings;
};

/**
 * Generate bookings for the demo customer across multiple shops
 * @param {Array} shops - Array of shop objects
 * @param {Object} demoCustomer - Demo customer user object
 * @returns {Array} Array of booking objects
 */
const generateDemoCustomerBookings = (shops, demoCustomer) => {
  const bookings = [];
  const shopsToBook = randomSubset(shops, 5); // Book at 5 different shops

  shopsToBook.forEach((shop, shopIndex) => {
    const bookingCount = shopIndex === 0 ? 5 : randomInt(2, 3);

    for (let i = 0; i < bookingCount; i++) {
      const employee = randomItem(shop.employees);
      const selectedServices = randomSubset(shop.services, randomInt(1, 2));
      const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

      // Mix of statuses
      const statusOptions = ['completed', 'confirmed', 'pending', 'cancelled'];
      const status = statusOptions[i % statusOptions.length];

      let selectedDate;
      if (status === 'completed' || status === 'cancelled') {
        selectedDate = randomDate(-5, -1);
      } else {
        selectedDate = randomDate(1, 7);
      }

      const booking = {
        id: generateId(20),
        shopId: shop.id,
        shopEmail: shop.email,
        userName: demoCustomer.displayName,
        userEmail: demoCustomer.email.toLowerCase(),
        userPhone: demoCustomer.phoneNumber,
        selectedDate,
        selectedTime: randomTimeSlot('09:00', '17:00'),
        selectedServices: selectedServices.map(s => ({
          name: s.name,
          price: s.price,
          duration: s.duration
        })),
        customService: '',
        totalPrice,
        employeeId: employee.id,
        employeeName: employee.name,
        status,
        createdAt: generateTimestamp(-10 + i),
        lastModified: generateTimestamp(-5 + i),
        isRated: false,
        rating: 0,
        review: '',
        ratingId: null,
        ratingSubmittedAt: null,
        timeSlotId: generateId(20),
        notes: ''
      };

      if (status === 'cancelled') {
        booking.cancellationReason = 'Schedule conflict';
        booking.cancelledAt = generateTimestamp(-4);
        booking.cancelledBy = 'customer';
      }

      bookings.push(booking);
    }
  });

  return bookings;
};

module.exports = {
  generateShopBookings,
  generateDemoCustomerBookings
};
