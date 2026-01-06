// messaging.js (Cloud Functions)
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Message Functions
exports.sendMessage = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const {
        bookingId,
        senderId,
        receiverId,
        content,
        senderType // 'shop' or 'customer'
    } = req.body;

    try {
        const messageRef = await admin.firestore().collection('messages').add({
            bookingId,
            senderId,
            receiverId,
            content,
            senderType,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        // Send notification to receiver
        const receiverDoc = await admin.firestore()
            .collection('users')
            .doc(receiverId)
            .get();

        if (receiverDoc.exists && receiverDoc.data().fcmToken) {
            await admin.messaging().send({
                token: receiverDoc.data().fcmToken,
                notification: {
                    title: 'New Message',
                    body: `New message regarding booking #${bookingId}`
                },
                data: {
                    type: 'message',
                    bookingId: bookingId
                }
            });
        }

        res.status(200).json({messageId: messageRef.id});
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({error: 'Error sending message'});
    }
});

// Rating Functions
exports.createRating = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const {
        bookingId,
        shopId,
        userId,
        rating,
        review,
        photos = []
    } = req.body;

    try {
        const ratingRef = await admin.firestore().collection('ratings').add({
            bookingId,
            shopId,
            userId,
            rating,
            review,
            photos,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });

        // Update shop average rating
        const shopRef = admin.firestore().collection('barberShops').doc(shopId);
        const shopDoc = await shopRef.get();

        if (shopDoc.exists) {
            const currentRatings = shopDoc.data().ratings || [];
            const newAvgRating = calculateAverageRating([...currentRatings, rating]);

            await shopRef.update({
                ratings: admin.firestore.FieldValue.arrayUnion(rating),
                averageRating: newAvgRating
            });
        }

        // Send notification to shop owner
        const shopData = shopDoc.data();
        if (shopData.ownerId) {
            const ownerDoc = await admin.firestore()
                .collection('users')
                .doc(shopData.ownerId)
                .get();

            if (ownerDoc.exists && ownerDoc.data().fcmToken) {
                await admin.messaging().send({
                    token: ownerDoc.data().fcmToken,
                    notification: {
                        title: 'New Rating',
                        body: `A customer has left a ${rating}-star rating`
                    },
                    data: {
                        type: 'rating',
                        bookingId: bookingId
                    }
                });
            }
        }

        res.status(200).json({ratingId: ratingRef.id});
    } catch (error) {
        console.error('Error creating rating:', error);
        res.status(500).json({error: 'Error creating rating'});
    }
});

// Rescheduling Functions
exports.rescheduleBooking = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const {
        bookingId,
        newDate,
        newTime,
        reason
    } = req.body;

    try {
        const bookingRef = admin.firestore().collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists) {
            res.status(404).json({error: 'Booking not found'});
            return;
        }

        const bookingData = bookingDoc.data();

        // Update booking
        await bookingRef.update({
            selectedDate: newDate,
            selectedTime: newTime,
            rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
            reschedulingReason: reason,
            previousDate: bookingData.selectedDate,
            previousTime: bookingData.selectedTime,
            status: 'rescheduled'
        });

        // Send emails
        await sendReschedulingEmail(bookingData.userEmail, {
            ...bookingData,
            newDate,
            newTime,
            reason
        });

        await sendReschedulingEmailToShop(bookingData.shopEmail, {
            ...bookingData,
            newDate,
            newTime,
            reason
        });

        // Send push notifications
        const userDoc = await admin.firestore()
            .collection('users')
            .where('email', '==', bookingData.userEmail)
            .limit(1)
            .get();

        if (!userDoc.empty && userDoc.docs[0].data().fcmToken) {
            await admin.messaging().send({
                token: userDoc.docs[0].data().fcmToken,
                notification: {
                    title: 'Appointment Rescheduled',
                    body: `Your appointment has been rescheduled to ${newDate} at ${newTime}`
                },
                data: {
                    type: 'reschedule',
                    bookingId: bookingId
                }
            });
        }

        res.status(200).json({message: 'Booking rescheduled successfully'});
    } catch (error) {
        console.error('Error rescheduling booking:', error);
        res.status(500).json({error: 'Error rescheduling booking'});
    }
});

// Helper function to calculate average rating
function calculateAverageRating(ratings) {
    if (!ratings.length) return 0;
    const sum = ratings.reduce((acc, curr) => acc + curr, 0);
    return (sum / ratings.length).toFixed(1);
}