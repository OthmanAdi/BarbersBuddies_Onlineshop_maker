const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { shopNameTriggers } = require('./triggers');

admin.initializeApp();

const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

// Use Firebase Functions config for secrets
// Set with: firebase functions:config:set mailgun.key="xxx" mailgun.domain="xxx"
const mailgunConfig = functions.config().mailgun || {};
const mg = mailgun.client({
    username: 'api',
    key: mailgunConfig.key || process.env.MAILGUN_API_KEY,
    url: 'https://api.eu.mailgun.net'
});

const DOMAIN = mailgunConfig.domain || process.env.MAILGUN_DOMAIN || 'barbersbuddies.com';

// CORS configuration - only allow trusted origins
const ALLOWED_ORIGINS = [
    'https://barbersbuddies.com',
    'https://www.barbersbuddies.com',
    'http://localhost:3000'  // For development
];

const setCorsHeaders = (req, res) => {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
};

exports.createBooking = functions.https.onRequest(async (req, res) => {
    console.log('Function started');

    // Enable CORS
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        console.log('Method not allowed:', req.method);
        res.status(405).json({error: 'Method Not Allowed'});
        return;
    }

    console.log('Request body:', JSON.stringify(req.body));

    const {
        shopId,
        shopEmail,
        userName,
        userEmail,
        userPhone,
        selectedDate,
        selectedServices,
        customService,
        selectedTime
    } = req.body;

    // Validate input
    if (!shopId || !shopEmail || !userName || !userEmail || !selectedDate || !selectedServices || selectedServices.length === 0 || !selectedTime) {
        console.log('Missing required fields');
        res.status(400).json({error: 'Missing required fields'});
        return;
    }

    // Additional check for email addresses
    if (!isValidEmail(shopEmail) || !isValidEmail(userEmail)) {
        console.log('Invalid email address');
        res.status(400).json({error: 'Invalid email address'});
        return;
    }

    try {
        console.log('Saving booking to Firestore');
        // 1. Save booking to Firestore
        const bookingRef = await admin.firestore().collection('bookings').add({
            shopId,
            shopEmail,
            userName,
            userEmail,
            userPhone,
            selectedDate,
            selectedServices,
            customService,
            selectedTime,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const bookingId = bookingRef.id;
        console.log('Booking saved with ID:', bookingId);

        console.log('Sending email to shop');
        // 2. Send email to shop
        await sendEmailToShop(shopEmail, {bookingId, ...req.body});
        console.log('Email sent to shop');

        console.log('Sending email to user');
        // 3. Send confirmation email to user
        await sendEmailToUser(userEmail, {bookingId, ...req.body});
        console.log('Email sent to user');

        console.log('Booking process completed successfully');
        res.status(200).json({message: 'Booking created successfully', bookingId});
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({error: 'Error creating booking', details: error.message});
    }
});

exports.onShopCreate = require('./triggers').onShopCreate;
exports.onShopDelete = require('./triggers').onShopDelete;
exports.onShopUpdate = require('./triggers').onShopUpdate;

async function sendEmailToShop(shopEmail, bookingData) {
    console.log('Preparing email for shop');
    if (!isValidEmail(shopEmail)) {
        console.error('Invalid shop email:', shopEmail);
        throw new Error('Invalid shop email address');
    }

    const {
        bookingId,
        userName,
        userEmail,
        userPhone,
        selectedDate,
        selectedServices,
        customService,
        selectedTime
    } = bookingData;

    const servicesHtml = selectedServices.map(service => `<li>${service.name} - €${service.price}</li>`).join('');
    const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0).toFixed(2);

    try {
        await mg.messages.create(DOMAIN, {
            from: "BarbersBuddies <bookings@barbersbuddies.com>",
            to: shopEmail,
            subject: `New Booking - ID: ${bookingId}`,
            html: `
        <h1>New Booking</h1>
        <p>Booking ID: ${bookingId}</p>
        <p>Customer: ${userName}</p>
        <p>Email: ${userEmail}</p>
        <p>Phone: ${userPhone || 'Not provided'}</p>
        <p>Date: ${selectedDate}</p>
        <p>Time: ${selectedTime}</p>
        <h2>Services:</h2>
        <ul>${servicesHtml}</ul>
        ${customService ? `<p>Custom Service: ${customService}</p>` : ''}
        <p><strong>Total: €${totalPrice}</strong></p>
      `
        });
        console.log('Email sent to shop successfully');
    } catch (error) {
        console.error('Error sending email to shop:', error);
        throw error;
    }
}

async function sendEmailToUser(userEmail, bookingData) {
    console.log('Preparing email for user');
    if (!isValidEmail(userEmail)) {
        console.error('Invalid user email:', userEmail);
        throw new Error('Invalid user email address');
    }

    const {bookingId, userName, selectedDate, selectedServices, customService, selectedTime} = bookingData;

    const servicesHtml = selectedServices.map(service => `<li>${service.name} - €${service.price}</li>`).join('');
    const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0).toFixed(2);

    try {
        await mg.messages.create(DOMAIN, {
            from: "BarbersBuddies <bookings@barbersbuddies.com>",
            to: userEmail,
            subject: 'Booking Confirmation',
            html: `
        <h1>Your Booking is Confirmed</h1>
        <p>Dear ${userName},</p>
        <p>Your booking (ID: ${bookingId}) has been confirmed for ${selectedDate} at ${selectedTime}.</p>
        <h2>Services:</h2>
        <ul>${servicesHtml}</ul>
        ${customService ? `<p>Custom Service: ${customService}</p>` : ''}
        <p><strong>Total: €${totalPrice}</strong></p>
        <p>If you need to make any changes, please contact us with your booking ID.</p>
      `
        });
        console.log('Email sent to user successfully');
    } catch (error) {
        console.error('Error sending email to user:', error);
        throw error;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Function to handle appointment updates
exports.updateBooking = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({error: 'Method Not Allowed'});
        return;
    }

    const {
        bookingId,
        date,
        time,
        services,
        notes,
        totalPrice
    } = req.body;

    try {
        // Get the existing booking
        const bookingRef = admin.firestore().collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists) {
            res.status(404).json({error: 'Booking not found'});
            return;
        }

        const bookingData = bookingDoc.data();

        // Update the booking
        await bookingRef.update({
            selectedDate: date,
            selectedTime: time,
            selectedServices: services,
            notes,
            totalPrice,
            lastModified: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send update emails
        await sendUpdateEmailToUser(bookingData.userEmail, {
            ...bookingData,
            selectedDate: date,
            selectedTime: time,
            selectedServices: services,
            totalPrice
        });

        await sendUpdateEmailToShop(bookingData.shopEmail, {
            ...bookingData,
            selectedDate: date,
            selectedTime: time,
            selectedServices: services,
            totalPrice
        });

        res.status(200).json({message: 'Booking updated successfully'});
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({error: 'Error updating booking'});
    }
});

// Function to handle appointment cancellations
exports.cancelBooking = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const {bookingId, reason} = req.body;

    try {
        const bookingRef = admin.firestore().collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists) {
            res.status(404).json({error: 'Booking not found'});
            return;
        }

        const bookingData = bookingDoc.data();

        // Update booking status
        await bookingRef.update({
            status: 'cancelled',
            cancellationReason: reason,
            cancelledAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send cancellation emails
        await sendCancellationEmailToUser(bookingData.userEmail, {
            ...bookingData,
            reason
        });

        await sendCancellationEmailToShop(bookingData.shopEmail, {
            ...bookingData,
            reason
        });

        res.status(200).json({message: 'Booking cancelled successfully'});
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({error: 'Error cancelling booking'});
    }
});

// Helper functions for sending emails
async function sendUpdateEmailToUser(userEmail, bookingData) {
    const servicesHtml = bookingData.selectedServices
        .map(service => `<li>${service.name} - €${service.price}</li>`)
        .join('');

    await mg.messages.create(DOMAIN, {
        from: "BarbersBuddies <bookings@barbersbuddies.com>",
        to: userEmail,
        subject: 'Your Appointment Has Been Updated',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Appointment Update</h1>
                <p>Dear ${bookingData.userName},</p>
                <p>Your appointment has been updated with the following details:</p>
                <h2>New Appointment Details:</h2>
                <p>Date: ${bookingData.selectedDate}</p>
                <p>Time: ${bookingData.selectedTime}</p>
                <h3>Services:</h3>
                <ul>${servicesHtml}</ul>
                <p><strong>Total: €${bookingData.totalPrice}</strong></p>
                <p>If you have any questions, please contact us.</p>
            </div>
        `
    });
}

async function sendUpdateEmailToShop(shopEmail, bookingData) {
    const servicesHtml = bookingData.selectedServices
        .map(service => `<li>${service.name} - €${service.price}</li>`)
        .join('');

    await mg.messages.create(DOMAIN, {
        from: "BarbersBuddies <bookings@barbersbuddies.com>",
        to: shopEmail,
        subject: `Booking Updated - ID: ${bookingData.bookingId}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Booking Update</h1>
                <p>Booking ID: ${bookingData.bookingId}</p>
                <p>Customer: ${bookingData.userName}</p>
                <p>Email: ${bookingData.userEmail}</p>
                <p>Phone: ${bookingData.userPhone || 'Not provided'}</p>
                <h2>Updated Details:</h2>
                <p>Date: ${bookingData.selectedDate}</p>
                <p>Time: ${bookingData.selectedTime}</p>
                <h3>Services:</h3>
                <ul>${servicesHtml}</ul>
                <p><strong>Total: €${bookingData.totalPrice}</strong></p>
            </div>
        `
    });
}

async function sendCancellationEmailToUser(userEmail, bookingData) {
    await mg.messages.create(DOMAIN, {
        from: "BarbersBuddies <bookings@barbersbuddies.com>",
        to: userEmail,
        subject: 'Your Appointment Has Been Cancelled',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Appointment Cancellation</h1>
                <p>Dear ${bookingData.userName},</p>
                <p>Your appointment has been cancelled.</p>
                <p><strong>Reason:</strong> ${bookingData.reason}</p>
                <h2>Cancelled Appointment Details:</h2>
                <p>Date: ${bookingData.selectedDate}</p>
                <p>Time: ${bookingData.selectedTime}</p>
                <p>We apologize for any inconvenience. Feel free to book another appointment.</p>
            </div>
        `
    });
}

async function sendCancellationEmailToShop(shopEmail, bookingData) {
    await mg.messages.create(DOMAIN, {
        from: "BarbersBuddies <bookings@barbersbuddies.com>",
        to: shopEmail,
        subject: `Booking Cancelled - ID: ${bookingData.bookingId}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Booking Cancellation</h1>
                <p>Booking ID: ${bookingData.bookingId}</p>
                <p>Customer: ${bookingData.userName}</p>
                <p>Email: ${bookingData.userEmail}</p>
                <p>Reason: ${bookingData.reason}</p>
                <h2>Cancelled Booking Details:</h2>
                <p>Date: ${bookingData.selectedDate}</p>
                <p>Time: ${bookingData.selectedTime}</p>
            </div>
        `
    });
}

exports.onNewMessage = functions.firestore
    .document('messages/{messageId}')
    .onCreate(async (snap, context) => {
        const message = snap.data();

        try {
            // Get receiver's FCM token
            const receiverDoc = await admin.firestore()
                .collection('users')
                .doc(message.receiverId)
                .get();

            if (receiverDoc.exists && receiverDoc.data().fcmToken) {
                // Send push notification
                await admin.messaging().send({
                    token: receiverDoc.data().fcmToken,
                    notification: {
                        title: `New message from ${message.senderType === 'shop' ? 'Shop' : 'Customer'}`,
                        body: message.content.slice(0, 100)
                    },
                    data: {
                        type: 'message',
                        bookingId: message.bookingId,
                        messageId: context.params.messageId
                    }
                });
            }

            // Send email notification
            const receiverEmail = receiverDoc.data().email;
            await mg.messages.create(DOMAIN, {
                from: "BarbersBuddies <noreply@barbersbuddies.com>",
                to: receiverEmail,
                subject: 'New Message Regarding Your Appointment',
                html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>New Message</h2>
    <p>You have a new message regarding your appointment.</p>
    <p><strong>Message:</strong> ${message.content}</p>
    <p>Please log in to respond.</p>
</div>
    `
            });

            return null;
        } catch (error) {
            console.error('Error processing new message:', error);
            throw error;
        }
    });

// Ratings Collection Trigger
exports.onNewRating = functions.firestore
    .document('ratings/{ratingId}')
    .onCreate(async (snap, context) => {
        const rating = snap.data();

        try {
            // Update shop's average rating
            const shopRef = admin.firestore().collection('barberShops').doc(rating.shopId);
            const shopDoc = await shopRef.get();

            if (shopDoc.exists) {
                const shopData = shopDoc.data();
                const ratings = shopData.ratings || [];
                ratings.push(rating.rating);

                const averageRating = ratings.reduce((a, b) => a + b) / ratings.length;

                await shopRef.update({
                    ratings,
                    averageRating: parseFloat(averageRating.toFixed(1)),
                    totalRatings: ratings.length
                });

                // Send notification to shop owner
                const ownerDoc = await admin.firestore()
                    .collection('users')
                    .doc(shopData.ownerId)
                    .get();

                if (ownerDoc.exists && ownerDoc.data().fcmToken) {
                    await admin.messaging().send({
                        token: ownerDoc.data().fcmToken,
                        notification: {
                            title: 'New Rating Received',
                            body: `You received a ${rating.rating}-star rating with a review`
                        },
                        data: {
                            type: 'rating',
                            ratingId: context.params.ratingId,
                            shopId: rating.shopId
                        }
                    });
                }
            }

            return null;
        } catch (error) {
            console.error('Error processing new rating:', error);
            throw error;
        }
    });

function sendRescheduleEmailToShop(shopEmail, param2) {
    return undefined;
}

// Rescheduling Function
exports.rescheduleAppointment = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const {
            bookingId,
            newDate,
            newTime,
            reason,
            userId
        } = req.body;

        // Get booking
        const bookingRef = admin.firestore().collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists) {
            return res.status(404).json({error: 'Booking not found'});
        }

        const bookingData = bookingDoc.data();

        // Verify availability
        const shopRef = admin.firestore().collection('barberShops').doc(bookingData.shopId);
        const shopDoc = await shopRef.get();

        if (!shopDoc.exists) {
            return res.status(404).json({error: 'Shop not found'});
        }

        const shopData = shopDoc.data();

        // Check if time slot is available
        const existingBookingsQuery = await admin.firestore()
            .collection('bookings')
            .where('shopId', '==', bookingData.shopId)
            .where('selectedDate', '==', newDate)
            .where('selectedTime', '==', newTime)
            .where('status', 'in', ['confirmed', 'pending'])
            .get();

        if (!existingBookingsQuery.empty) {
            return res.status(400).json({error: 'Time slot is not available'});
        }

        // Update booking
        await bookingRef.update({
            selectedDate: newDate,
            selectedTime: newTime,
            previousDate: bookingData.selectedDate,
            previousTime: bookingData.selectedTime,
            rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
            rescheduledBy: userId,
            reschedulingReason: reason,
            status: 'rescheduled'
        });

        // Create notification
        await admin.firestore().collection('notifications').add({
            userId: bookingData.userEmail,
            type: 'reschedule',
            title: 'Appointment Rescheduled',
            message: `Your appointment has been rescheduled to ${newDate} at ${newTime}`,
            bookingId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        // Send emails
        await Promise.all([
            sendRescheduleEmailToCustomer(bookingData.userEmail, {
                ...bookingData,
                newDate,
                newTime,
                reason,
                shopName: shopData.name
            }),
            sendRescheduleEmailToShop(bookingData.shopEmail, {
                ...bookingData,
                newDate,
                newTime,
                reason
            })
        ]);

        return res.status(200).json({message: 'Appointment rescheduled successfully'});
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        return res.status(500).json({error: 'Internal server error'});
    }
});

exports.sendAppointmentNotifications = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
        try {
            const now = new Date();
            const db = admin.firestore();

            // Get all active appointments
            const appointmentsSnapshot = await db
                .collection('bookings')
                .where('status', '==', 'confirmed')
                .get();

            // Get all user notification preferences
            const preferencesSnapshot = await db
                .collection('notificationPreferences')
                .where('enabled', '==', true)
                .get();

            // Create a map of user preferences for quick lookup
            const userPreferences = {};
            preferencesSnapshot.forEach(doc => {
                userPreferences[doc.id] = doc.data();
            });

            for (const appointmentDoc of appointmentsSnapshot.docs) {
                const appointment = appointmentDoc.data();
                const appointmentDate = new Date(appointment.selectedDate + 'T' + appointment.selectedTime);
                const userPrefs = userPreferences[appointment.userEmail];

                if (!userPrefs) continue;

                const timeUntilAppointment = appointmentDate.getTime() - now.getTime();
                const hoursUntilAppointment = timeUntilAppointment / (1000 * 60 * 60);

                // Check each notification threshold
                const shouldSendNotification = (
                    (userPrefs.preferences.oneHourBefore && hoursUntilAppointment <= 1 && hoursUntilAppointment > 0) ||
                    (userPrefs.preferences.oneDayBefore && hoursUntilAppointment <= 24 && hoursUntilAppointment > 23) ||
                    (userPrefs.preferences.threeDaysBefore && hoursUntilAppointment <= 72 && hoursUntilAppointment > 71) ||
                    (userPrefs.preferences.oneWeekBefore && hoursUntilAppointment <= 168 && hoursUntilAppointment > 167)
                );

                if (shouldSendNotification) {
                    // Get shop details
                    const shopDoc = await db
                        .collection('barberShops')
                        .doc(appointment.shopId)
                        .get();

                    const shopData = shopDoc.data();

                    // Send email notification
                    await mg.messages.create(DOMAIN, {
                        from: "BarbersBuddies <reminders@barbersbuddies.com>",
                        to: appointment.userEmail,
                        subject: `Upcoming Appointment Reminder - ${shopData.name}`,
                        html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Appointment Reminder</h1>
                <p>Dear ${appointment.userName},</p>
                <p>This is a reminder about your upcoming appointment:</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="margin-top: 0;">${shopData.name}</h2>
                  <p><strong>Date:</strong> ${appointment.selectedDate}</p>
                  <p><strong>Time:</strong> ${appointment.selectedTime}</p>
                  <p><strong>Location:</strong> ${shopData.address}</p>
                  
                  <h3>Services:</h3>
                  <ul>
                    ${appointment.selectedServices.map(service =>
                            `<li>${service.name} - €${service.price}</li>`
                        ).join('')}
                  </ul>
                  
                  <p><strong>Total Price:</strong> €${appointment.selectedServices.reduce(
                            (sum, service) => sum + parseFloat(service.price),
                            0
                        ).toFixed(2)}</p>
                </div>

                <p>Need to make changes? You can reschedule or cancel through our app or website.</p>
                
                <div style="margin-top: 20px; font-size: 0.8em; color: #666;">
                  <p>You received this email because you enabled appointment reminders. 
                  To adjust your notification preferences, visit your account settings.</p>
                </div>
              </div>
            `
                    });

                    // Log successful notification
                    await db.collection('notificationLogs').add({
                        appointmentId: appointmentDoc.id,
                        userId: appointment.userEmail,
                        type: 'reminder',
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                        status: 'sent',
                        timeUntilAppointment: hoursUntilAppointment
                    });
                }
            }

            return null;
        } catch (error) {
            console.error('Error sending notifications:', error);
            throw error;
        }
    });

// Email helper functions
async function sendRescheduleEmailToCustomer(email, data) {
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Appointment Rescheduled</h1>
            <p>Dear ${data.userName},</p>
            <p>Your appointment at ${data.shopName} has been rescheduled:</p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                <h3>New Appointment Details:</h3>
                <p>Date: ${data.newDate}</p>
                <p>Time: ${data.newTime}</p>
                <p>Reason: ${data.reason}</p>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                <h3>Previous Appointment Details:</h3>
                <p>Date: ${data.previousDate}</p>
                <p>Time: ${data.previousTime}</p>
            </div>
            
            <p>If this new time doesn't work for you, please contact us or reschedule through the app.</p>
        </div>
    `;

    await mg.messages.create(DOMAIN, {
        from: "BarbersBuddies <bookings@barbersbuddies.com>",
        to: email,
        subject: 'Your Appointment Has Been Rescheduled',
        html: emailHtml
    });
}

exports.sendDeletionConfirmationEmail = functions.firestore
    .document('deletedAccounts/{userId}')
    .onCreate(async (snap, context) => {
        const userData = snap.data();

        // Use the same transporter that's already configured at the top
        const emailTemplates = {
            en: {
                subject: 'Account Deletion Confirmation - BarbersBuddies',
                body: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Account Deletion Confirmation</h2>
                        <p>Dear ${userData.displayName || 'Customer'},</p>
                        <p>Your BarbersBuddies account has been successfully deleted.</p>
                        <p>If you did not request this deletion, please contact our support immediately.</p>
                        <p>Thank you for using BarbersBuddies.</p>
                    </div>
                `
            },
            tr: {
                subject: 'Hesap Silme Onayı - BarbersBuddies',
                body: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Hesap Silme Onayı</h2>
                        <p>Sayın ${userData.displayName || 'Müşterimiz'},</p>
                        <p>BarbersBuddies hesabınız başarıyla silinmiştir.</p>
                        <p>Bu silme işlemini siz talep etmediyseniz, lütfen derhal destek ekibimizle iletişime geçin.</p>
                        <p>BarbersBuddies'ı kullandığınız için teşekkür ederiz.</p>
                    </div>
                `
            }
        };

        const template = emailTemplates[userData.language] || emailTemplates.en;

        try {
            await mg.messages.create(DOMAIN, {
                from: "BarbersBuddies <bookings@barbersbuddies.com>",
                to: userData.email,
                subject: template.subject,
                html: template.body
            });

            console.log('Deletion confirmation email sent');
            await snap.ref.delete(); // Clean up the deletion record
            return null;
        } catch (error) {
            console.error('Error sending deletion confirmation email:', error);
            throw new functions.https.HttpsError('internal', 'Error sending deletion confirmation email');
        }
    });

// Handle shop responses to ratings
exports.respondToRating = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(204).send('');

    const {ratingId, response, shopId} = req.body;

    try {
        const ratingRef = admin.firestore().collection('ratings').doc(ratingId);
        const rating = await ratingRef.get();

        if (!rating.exists) {
            return res.status(404).json({error: 'Rating not found'});
        }

        await ratingRef.update({
            shopResponse: {
                content: response,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }
        });

        // Notify customer
        await admin.firestore().collection('notifications').add({
            userId: rating.data().userId,
            type: 'rating_response',
            title: 'Shop Responded to Your Review',
            message: response.slice(0, 100) + '...',
            ratingId,
            shopId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        res.status(200).json({message: 'Response added successfully'});
    } catch (error) {
        console.error('Error responding to rating:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

// Shop-to-customer messaging (updated version)
exports.shopMessage = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(204).send('');

    const {
        bookingId,
        content,
        senderId,
        senderType, // 'customer' or 'shop'
        shopId,
        customerId,
        customerName,
        shopName,
        appointmentDetails  // Contains date, time, services, totalPrice
    } = req.body;

    try {
        // Validate required fields
        if (!bookingId || !content || !senderId || !shopId || !customerId) {
            return res.status(400).json({error: 'Missing required fields'});
        }

        // Create message
        const messageRef = await admin.firestore().collection('messages').add({
            bookingId,
            content,
            senderId,
            senderType,
            shopId,
            customerId,
            customerName,
            shopName,
            appointmentDetails: {
                date: appointmentDetails?.date,
                time: appointmentDetails?.time,
                services: appointmentDetails?.services || [],
                totalPrice: appointmentDetails?.totalPrice || 0
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        // Create notification for the recipient
        await admin.firestore().collection('notifications').add({
            userId: senderType === 'customer' ? shopId : customerId,
            type: 'new_message',
            title: `New message from ${senderType === 'customer' ? customerName : shopName}`,
            message: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
            bookingId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        // Send FCM if available
        const receiverId = senderType === 'customer' ? shopId : customerId;
        const receiverDoc = await admin.firestore()
            .collection('users')
            .doc(receiverId)
            .get();

        if (receiverDoc.exists && receiverDoc.data().fcmToken) {
            await admin.messaging().send({
                token: receiverDoc.data().fcmToken,
                notification: {
                    title: `New message from ${senderType === 'customer' ? customerName : shopName}`,
                    body: content.slice(0, 100)
                },
                data: {
                    type: 'message',
                    bookingId,
                    messageId: messageRef.id
                }
            });
        }

        // Send email notification
        const receiverEmail = receiverDoc.data().email;
        if (receiverEmail) {
            await mg.messages.create(DOMAIN, {
                from: "BarbersBuddies <bookings@barbersbuddies.com>",
                to: receiverEmail,
                subject: 'New Message Regarding Your Appointment',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>New Message</h2>
                        <p>You have a new message regarding booking #${bookingId}.</p>
                        <p><strong>From:</strong> ${senderType === 'customer' ? customerName : shopName}</p>
                        <p><strong>Message:</strong> ${content}</p>
                        <p>Please log in to respond.</p>
                    </div>
                `
            });
        }

        res.status(200).json({
            success: true,
            messageId: messageRef.id
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

// Real-time status updates trigger
exports.onStatusChange = functions.firestore
    .document('bookings/{bookingId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const previousData = change.before.data();

        // Only proceed if status changed
        if (newData.status === previousData.status) {
            return null;
        }

        try {
            // Create notification
            await admin.firestore().collection('notifications').add({
                userId: newData.userEmail,
                type: 'status_update',
                title: 'Appointment Status Updated',
                message: `Your appointment status has been updated to ${newData.status}`,
                bookingId: context.params.bookingId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            // Send email notification
            await mg.messages.create(DOMAIN, {
                from: "BarbersBuddies <bookings@barbersbuddies.com>",
                to: newData.userEmail,
                subject: 'Appointment Status Update',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1>Appointment Status Update</h1>
                        <p>Dear ${newData.userName},</p>
                        <p>Your appointment status has been updated to: <strong>${newData.status}</strong></p>
                        <p>Appointment Details:</p>
                        <ul>
                            <li>Date: ${newData.selectedDate}</li>
                            <li>Time: ${newData.selectedTime}</li>
                        </ul>
                    </div>
                `
            });

            return null;
        } catch (error) {
            console.error('Error processing status change:', error);
            throw error;
        }
    });

// Handle FCM token updates
exports.updateFCMToken = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(204).send('');

    const {userId, token} = req.body;

    try {
        await admin.firestore()
            .collection('users')
            .doc(userId)
            .update({
                fcmToken: token,
                tokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

        res.status(200).json({message: 'Token updated successfully'});
    } catch (error) {
        console.error('Error updating FCM token:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});