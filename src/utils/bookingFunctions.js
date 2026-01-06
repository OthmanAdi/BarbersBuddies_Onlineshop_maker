// src/utils/bookingFunctions.js
import {db} from '../firebase';
import {collection, doc, getDoc, getDocs, query, updateDoc, where} from 'firebase/firestore';

export const updateBooking = async (bookingId, updatedData) => {
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
            ...updatedData,
            lastModified: new Date()
        });
        return true;
    } catch (error) {
        console.error('Error updating booking:', error);
        throw error;
    }
};

export const getAvailableTimeSlots = async (shopId, date) => {
    try {
        // First check if shopId exists
        if (!shopId) {
            throw new Error('Shop ID is required');
        }

        // Get shop document
        const shopDoc = await getDoc(doc(db, 'barberShops', shopId));

        if (!shopDoc.exists()) {
            throw new Error('Shop not found');
        }

        const shopData = shopDoc.data();

        // Check if availability exists
        if (!shopData.availability) {
            // Return default time slots if no availability is set
            return [
                "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
                "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
                "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
            ];
        }

        const dayOfWeek = date.toLocaleDateString('en-US', {weekday: 'long'});
        const workingHours = shopData.availability[dayOfWeek];

        if (!workingHours || !workingHours.open || !workingHours.close) {
            // Return default time slots if no specific hours are set
            return [
                "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
                "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
                "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
            ];
        }

        // Generate slots based on working hours
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
            where('selectedDate', '==', date.toISOString().split('T')[0]),
            where('status', 'in', ['confirmed', 'pending'])
        );

        const bookings = await getDocs(q);
        const bookedSlots = bookings.docs.map(doc => doc.data().selectedTime);

        // Filter out booked slots
        return slots.filter(slot => !bookedSlots.includes(slot));
    } catch (error) {
        console.error('Error getting available slots:', error);
        // Return default time slots on error
        return [
            "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
            "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
            "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
        ];
    }
};