/**
 * Rating/Review Generator for Seed Data
 */

const { generateId, randomInt, randomItem } = require('../utils/random');
const { generateTimestamp } = require('../utils/dates');

// Review templates for different star ratings
const REVIEW_TEMPLATES = {
  5: [
    'Absolutely amazing experience! Best haircut I\'ve ever had.',
    'Outstanding service from start to finish. Will definitely be back!',
    'The staff is incredibly skilled and friendly. Highly recommend!',
    'Perfect fade every time. These guys are true professionals.',
    'Best barbershop in the city, hands down. 10/10!',
    'Exceeded all my expectations. My new go-to spot!',
    'Clean shop, great atmosphere, and an even better haircut.',
    'The attention to detail here is unmatched. Love it!'
  ],
  4: [
    'Great haircut, very satisfied with the result.',
    'Good experience overall. Minor wait time but worth it.',
    'Professional service and quality cut. Would recommend.',
    'Really happy with my beard trim. Skilled barbers here.',
    'Nice atmosphere and friendly staff. Good value for money.',
    'Solid barbershop with consistent quality. Will return.',
    'Happy with my cut. Just wish they had more availability.'
  ],
  3: [
    'Decent haircut, but the wait was longer than expected.',
    'Average experience. The cut was okay but nothing special.',
    'Good service but a bit pricey for what you get.',
    'The barber was nice but rushed through the cut.',
    'Okay experience. Not bad, not great. Might try again.',
    'Satisfactory result but room for improvement.'
  ],
  2: [
    'Not what I asked for. Disappointed with the result.',
    'Long wait and mediocre cut. Expected better.',
    'The barber didn\'t listen to what I wanted.',
    'Overpriced for the quality. Won\'t be returning.'
  ],
  1: [
    'Very disappointing experience. Would not recommend.',
    'Terrible service. Had to fix it elsewhere.',
    'Complete waste of time and money. Avoid.'
  ]
};

// Shop owner response templates
const RESPONSE_TEMPLATES = [
  'Thank you so much for your kind words! We\'re thrilled you enjoyed your experience.',
  'We really appreciate your feedback! Looking forward to seeing you again soon.',
  'Thanks for taking the time to leave a review! Your satisfaction is our priority.',
  'We\'re so glad you had a great experience with us! See you next time!',
  'Thank you for your support! Our team works hard to deliver the best service.'
];

/**
 * Generate a rating for a completed booking
 * @param {Object} booking - Completed booking object
 * @param {Object} shop - Shop object
 * @returns {Object} Rating object
 */
const generateRating = (booking, shop) => {
  // Weighted towards positive reviews (realistic distribution)
  const ratingWeights = { 5: 45, 4: 30, 3: 15, 2: 7, 1: 3 };
  let ratingValue = 5;
  let random = Math.random() * 100;

  for (const [rating, weight] of Object.entries(ratingWeights)) {
    random -= weight;
    if (random <= 0) {
      ratingValue = parseInt(rating);
      break;
    }
  }

  const reviews = REVIEW_TEMPLATES[ratingValue];
  const review = randomItem(reviews);

  const rating = {
    id: generateId(20),
    shopId: shop.id,
    bookingId: booking.id,
    userId: booking.userEmail,
    userName: booking.userName,

    rating: ratingValue,
    review,

    services: booking.selectedServices,
    appointmentDate: booking.selectedDate,
    appointmentTime: booking.selectedTime,
    totalAmount: booking.totalPrice,

    status: 'active',
    helpful: randomInt(0, 15),

    shopName: shop.name,
    createdAt: generateTimestamp(randomInt(-5, -1))
  };

  // Add shop response for high ratings (50% chance)
  if (ratingValue >= 4 && Math.random() > 0.5) {
    rating.shopResponse = {
      content: randomItem(RESPONSE_TEMPLATES),
      timestamp: generateTimestamp(randomInt(-3, 0))
    };
  }

  return rating;
};

/**
 * Generate ratings for a shop's completed bookings
 * @param {Array} completedBookings - Array of completed booking objects
 * @param {Object} shop - Shop object
 * @param {number} ratingPercentage - Percentage of bookings to rate (0-100)
 * @returns {Object} { ratings: Array, updatedBookings: Array }
 */
const generateShopRatings = (completedBookings, shop, ratingPercentage = 70) => {
  const ratings = [];
  const updatedBookings = [];

  completedBookings.forEach(booking => {
    if (Math.random() * 100 < ratingPercentage) {
      const rating = generateRating(booking, shop);
      ratings.push(rating);

      // Update booking with rating info
      updatedBookings.push({
        ...booking,
        isRated: true,
        rating: rating.rating,
        review: rating.review,
        ratingId: rating.id,
        ratingSubmittedAt: rating.createdAt
      });
    } else {
      updatedBookings.push(booking);
    }
  });

  return { ratings, updatedBookings };
};

/**
 * Calculate shop rating aggregates
 * @param {Array} ratings - Array of rating objects for a shop
 * @returns {Object} Rating aggregates for shop update
 */
const calculateShopRatingAggregates = (ratings) => {
  if (ratings.length === 0) {
    return {
      ratings: [],
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      ratingIds: [],
      lastRatedAt: null
    };
  }

  const ratingValues = ratings.map(r => r.rating);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingValues.forEach(r => distribution[r]++);

  const sum = ratingValues.reduce((a, b) => a + b, 0);
  const average = parseFloat((sum / ratingValues.length).toFixed(1));

  return {
    ratings: ratingValues,
    averageRating: average,
    totalRatings: ratings.length,
    ratingDistribution: distribution,
    ratingIds: ratings.map(r => r.id),
    lastRatedAt: ratings[ratings.length - 1].createdAt
  };
};

module.exports = {
  REVIEW_TEMPLATES,
  generateRating,
  generateShopRatings,
  calculateShopRatingAggregates
};
