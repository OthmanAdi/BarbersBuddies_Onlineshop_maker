import {db} from '../firebase';
import {collection, doc, getDoc, getDocs, orderBy, query, Timestamp, updateDoc, where} from 'firebase/firestore';

// Function to fetch bookings for a shop
export const fetchBookings = async (shopId) => {
    try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('shopId', '==', shopId),
            orderBy('date', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate()
        }));
    } catch (error) {
        console.error('Error fetching bookings:', error);
        throw error;
    }
};

// Function to update a booking
export const updateBooking = async (bookingId, updatedData) => {
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
            ...updatedData,
            lastModified: Timestamp.now()
        });

        // Send email notification
        await fetch('https://your-cloud-function-url/sendUpdateEmail', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bookingId,
                ...updatedData
            })
        });

        return true;
    } catch (error) {
        console.error('Error updating booking:', error);
        throw error;
    }
};

// Function to cancel a booking
export const cancelBooking = async (bookingId, reason) => {
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
            status: 'cancelled',
            cancellationReason: reason,
            cancelledAt: Timestamp.now()
        });

        // Send cancellation email
        await fetch('https://your-cloud-function-url/sendCancellationEmail', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bookingId,
                reason
            })
        });

        return true;
    } catch (error) {
        console.error('Error cancelling booking:', error);
        throw error;
    }
};

// Function to get available time slots
export const getAvailableTimeSlots = async (shopId, date) => {
    try {
        // First get shop's working hours
        const shopDoc = await getDoc(doc(db, 'barberShops', shopId));
        const shopData = shopDoc.data();
        const dayOfWeek = date.toLocaleDateString('en-US', {weekday: 'long'});
        const workingHours = shopData.availability[dayOfWeek];

        if (!workingHours) return [];

        // Generate all possible time slots
        const slots = [];
        let [startHour] = workingHours.open.split(':');
        let [endHour] = workingHours.close.split(':');

        for (let hour = parseInt(startHour); hour < parseInt(endHour); hour++) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
            slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }

        // Get existing bookings for that date
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('shopId', '==', shopId),
            where('date', '==', Timestamp.fromDate(date)),
            where('status', 'in', ['confirmed', 'pending'])
        );

        const bookings = await getDocs(q);
        const bookedSlots = bookings.docs.map(doc => doc.data().time);

        // Filter out booked slots
        return slots.filter(slot => !bookedSlots.includes(slot));
    } catch (error) {
        console.error('Error getting available slots:', error);
        throw error;
    }
};