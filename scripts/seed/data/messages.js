/**
 * Message Thread Generator for Seed Data
 */

const { generateId, randomInt, randomItem } = require('../utils/random');
const { generateTimestamp } = require('../utils/dates');

// Message templates for realistic conversations
const CUSTOMER_MESSAGES = {
  inquiry: [
    'Hi, I\'d like to confirm my appointment for tomorrow.',
    'What time slots do you have available this week?',
    'Can I reschedule my appointment to a later time?',
    'Do you offer beard grooming services?',
    'How long does a fade haircut usually take?',
    'Is parking available near your shop?'
  ],
  confirmation: [
    'Perfect, I\'ll see you then!',
    'Great, thanks for confirming!',
    'That works for me, thank you!',
    'Awesome, looking forward to it!'
  ],
  thanks: [
    'Thank you so much!',
    'Really appreciate it!',
    'Thanks for your help!',
    'You\'re the best, thanks!'
  ],
  followup: [
    'Just wanted to say I loved my haircut yesterday!',
    'Quick question - do you have any availability this weekend?',
    'Hey, I might be running 5 minutes late. Is that okay?'
  ]
};

const SHOP_MESSAGES = {
  response: [
    'Hello! Yes, your appointment is confirmed for tomorrow at the scheduled time.',
    'Hi there! We have several slots available. What time works best for you?',
    'Of course! We can reschedule you. What time would you prefer?',
    'Yes, we offer full beard grooming services. Would you like to add that to your appointment?',
    'A fade typically takes about 35-40 minutes depending on the style.',
    'Yes, there\'s street parking available and a parking garage nearby.'
  ],
  greeting: [
    'Thank you for reaching out!',
    'Great to hear from you!',
    'Thanks for your message!'
  ],
  closing: [
    'See you soon!',
    'Looking forward to seeing you!',
    'Let us know if you have any other questions!'
  ]
};

/**
 * Generate a conversation thread for a booking
 * @param {Object} booking - Booking object
 * @param {Object} shop - Shop object
 * @param {number} messageCount - Number of messages in thread
 * @returns {Array} Array of message objects
 */
const generateConversation = (booking, shop, messageCount = 4) => {
  const messages = [];
  const baseTimestamp = -randomInt(1, 5);

  for (let i = 0; i < messageCount; i++) {
    const isCustomer = i % 2 === 0;
    const messageOffset = baseTimestamp + (i * 0.1);

    let content;
    if (isCustomer) {
      if (i === 0) {
        content = randomItem(CUSTOMER_MESSAGES.inquiry);
      } else if (i === messageCount - 1) {
        content = randomItem(CUSTOMER_MESSAGES.thanks);
      } else {
        content = randomItem(CUSTOMER_MESSAGES.confirmation);
      }
    } else {
      if (i === 1) {
        content = randomItem(SHOP_MESSAGES.response);
      } else {
        content = randomItem(SHOP_MESSAGES.closing);
      }
    }

    messages.push({
      id: generateId(20),
      bookingId: booking.id,
      shopId: shop.id,
      customerId: isCustomer ? booking.userEmail : shop.id,
      customerName: booking.userName,
      shopName: shop.name,

      content,
      senderId: isCustomer ? booking.userEmail : shop.ownerId,
      senderType: isCustomer ? 'customer' : 'shop',

      appointmentDetails: {
        date: booking.selectedDate,
        time: booking.selectedTime,
        services: booking.selectedServices,
        totalPrice: booking.totalPrice
      },

      timestamp: generateTimestamp(messageOffset),
      read: i < messageCount - 1, // Last message unread
      receiverId: isCustomer ? shop.ownerId : booking.userEmail
    });
  }

  return messages;
};

/**
 * Generate conversations for demo shop
 * @param {Array} bookings - Bookings for the demo shop
 * @param {Object} shop - Demo shop object
 * @param {number} conversationCount - Number of conversations to create
 * @returns {Array} All messages from all conversations
 */
const generateDemoShopConversations = (bookings, shop, conversationCount = 20) => {
  const allMessages = [];
  const selectedBookings = bookings.slice(0, conversationCount);

  selectedBookings.forEach((booking, index) => {
    const messageCount = randomInt(3, 8);
    const conversation = generateConversation(booking, shop, messageCount);
    allMessages.push(...conversation);
  });

  return allMessages;
};

module.exports = {
  CUSTOMER_MESSAGES,
  SHOP_MESSAGES,
  generateConversation,
  generateDemoShopConversations
};
