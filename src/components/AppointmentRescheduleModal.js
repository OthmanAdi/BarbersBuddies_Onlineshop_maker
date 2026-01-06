import React, {useEffect, useState} from 'react';
import {AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock, Scissors} from 'lucide-react';
import {addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where} from 'firebase/firestore';
import {db} from '../firebase';
import Swal from "sweetalert2";
import * as appointment from "date-fns/locale";
import {createRoot} from 'react-dom/client';
import {root} from "postcss";

const AppointmentRescheduleModal = ({appointmentId, shopId, onReschedule, onClose, isOpen}) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState('');
    const [shopAvailability, setShopAvailability] = useState(null);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Fetch shop availability and booked slots
    useEffect(() => {
        const fetchShopData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // 1. Fetch shop details for availability
                const shopDoc = await getDoc(doc(db, 'barberShops', shopId));
                if (!shopDoc.exists()) {
                    throw new Error('Shop not found');
                }
                setShopAvailability(shopDoc.data().availability);

                // 2. If a date is selected, fetch all bookings for that date
                if (selectedDate) {
                    const formattedDate = selectedDate.getFullYear() + '-' +
                        String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' +
                        String(selectedDate.getDate()).padStart(2, '0');
                    console.log('Checking availability for:', formattedDate, selectedTime);

                    const bookedTimes = new Set();

                    // First check bookings collection
                    const bookingsRef = collection(db, 'bookings');
                    const bookingsQuery = query(
                        bookingsRef,
                        where('shopId', '==', shopId),
                        where('selectedDate', '==', formattedDate)
                    );

                    const bookingsSnap = await getDocs(bookingsQuery);
                    bookingsSnap.forEach(doc => {
                        const bookingData = doc.data();
                        if (doc.id !== appointment.id && // Skip current appointment
                            bookingData.status !== 'cancelled' &&
                            bookingData.status !== 'rejected') {
                            console.log('Found booking:', bookingData);
                            bookedTimes.add(bookingData.selectedTime);
                        }
                    });

                    // Then check bookedTimeSlots collection
                    const timeSlotRef = collection(db, 'bookedTimeSlots');
                    const timeSlotQuery = query(
                        timeSlotRef,
                        where('shopId', '==', shopId),
                        where('date', '==', formattedDate),
                        where('status', '==', 'booked')
                    );

                    const timeSlotSnap = await getDocs(timeSlotQuery);
                    timeSlotSnap.forEach(doc => {
                        console.log('Found booked slot:', doc.data());
                        bookedTimes.add(doc.data().time);
                    });

                    console.log('All booked times:', Array.from(bookedTimes));
                    setBookedSlots(Array.from(bookedTimes));
                }

                setIsLoading(false);
            } catch (err) {
                console.error('Error fetching shop data:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        if (shopId) {
            fetchShopData();
        }
    }, [shopId, selectedDate, appointment.id]);

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const generateTimeSlots = () => {
        if (!selectedDate || !shopAvailability) return [];

        const dayOfWeek = selectedDate.toLocaleString('en-US', {weekday: 'long'});
        const dayAvailability = shopAvailability[dayOfWeek];

        if (!dayAvailability) return [];

        const {open, close} = dayAvailability;
        const slots = [];
        const [openHour, openMinute] = open.split(':').map(Number);
        const [closeHour, closeMinute] = close.split(':').map(Number);

        let currentHour = openHour;
        let currentMinute = openMinute;

        while (currentHour < closeHour || (currentHour === closeHour && currentMinute <= closeMinute)) {
            const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
            slots.push(timeString);

            currentMinute += 30;
            if (currentMinute >= 60) {
                currentHour += 1;
                currentMinute = 0;
            }
        }

        return slots;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const handleDateSelect = (date) => {
        if (date && date >= today) {
            setSelectedDate(date);
            setSelectedTime('');
        }
    };

    const handleSubmit = async () => {
        if (selectedDate && selectedTime) {
            let loadingContainer;
            let root;

            try {
                setIsLoading(true);
                onClose();

                loadingContainer = document.createElement('div');
                document.body.appendChild(loadingContainer);
                root = createRoot(loadingContainer);
                root.render(<ScissorsLoader message="Rescheduling appointment..."/>);

                console.log('Starting reschedule process...');

                // First check if the time slot is available
                const formattedDate = selectedDate.toISOString().split('T')[0];
                console.log('Checking availability for:', formattedDate, selectedTime);

                const timeSlotRef = collection(db, 'bookedTimeSlots');
                const timeSlotQuery = query(
                    timeSlotRef,
                    where('shopId', '==', shopId),
                    where('date', '==', formattedDate),
                    where('time', '==', selectedTime),
                    where('status', '==', 'booked')
                );

                const timeSlotSnap = await getDocs(timeSlotQuery);
                if (!timeSlotSnap.empty) {
                    throw new Error('This time slot is already booked');
                }

                // Get the appointment details
                console.log('Fetching appointment details for:', appointmentId);
                const appointmentRef = doc(db, 'bookings', appointmentId);
                const appointmentSnap = await getDoc(appointmentRef);

                if (!appointmentSnap.exists()) {
                    throw new Error('Appointment not found');
                }

                const appointmentData = appointmentSnap.data();
                console.log('Appointment data:', appointmentData);

                // Prepare the request data
                const requestData = {
                    bookingId: appointmentId,
                    newDate: formattedDate,
                    newTime: selectedTime,
                    reason: 'Customer requested reschedule',
                    userId: appointmentData.userEmail,
                    shopId: shopId,
                    userName: appointmentData.userName,
                    userEmail: appointmentData.userEmail,
                    shopEmail: appointmentData.shopEmail,
                    services: appointmentData.selectedServices,
                    previousDate: appointmentData.selectedDate,
                    previousTime: appointmentData.selectedTime,
                    totalPrice: appointmentData.selectedServices.reduce(
                        (sum, service) => sum + parseFloat(service.price),
                        0
                    ).toFixed(2)
                };

                console.log('Sending request to cloud function:', requestData);

                // Update the booking in Firestore first
                await updateDoc(appointmentRef, {
                    selectedDate: formattedDate,
                    selectedTime: selectedTime,
                    status: 'rescheduled',
                    lastModified: serverTimestamp(),
                    previousDate: appointmentData.selectedDate,
                    previousTime: appointmentData.selectedTime
                });

                console.log('Booking updated in Firestore');

                await addDoc(collection(db, 'notifications'), {
                    type: 'booking_modified',
                    title: 'Appointment Rescheduled',
                    message: `${appointmentData.userName} rescheduled their appointment from ${appointmentData.selectedTime} on ${appointmentData.selectedDate} to ${selectedTime} on ${formattedDate}`,
                    shopId: shopId,
                    userId: appointmentData.userEmail,
                    createdAt: serverTimestamp(),
                    read: false,
                    bookingId: appointmentId,
                    totalPrice: appointmentData.selectedServices.reduce(
                        (sum, service) => sum + parseFloat(service.price),
                        0
                    ).toFixed(2)
                });

                console.log('Notification created for rescheduling');

                // Then call the cloud function for email notifications
                const response = await fetch(`${process.env.REACT_APP_CLOUD_FUNCTIONS_URL}/rescheduleAppointment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData)
                });

                console.log('Cloud function response:', response.status);

                if (!response.ok) {
                    // Even if cloud function fails, booking is updated
                    console.warn('Cloud function failed but booking was updated');
                    console.log('Response status:', response.status);
                    const errorData = await response.json().catch(() => ({}));
                    console.log('Error data:', errorData);
                }

                // Call the onReschedule callback
                await onReschedule(appointmentId, {
                    newDate: formattedDate,
                    newTime: selectedTime
                });

                if (root && loadingContainer) {
                    root.unmount();
                    document.body.removeChild(loadingContainer);
                }

                // Show success message
                await Swal.fire({
                    icon: 'success',
                    title: 'Appointment Rescheduled',
                    text: 'Your appointment has been rescheduled successfully.',
                    showConfirmButton: false,
                    timer: 2000
                });

                if (root && loadingContainer) {
                    root.unmount();
                    document.body.removeChild(loadingContainer);
                }

                onClose();
            } catch (error) {
                console.error('Error in reschedule process:', error);

                if (root && loadingContainer) {
                    root.unmount();
                    document.body.removeChild(loadingContainer);
                }

                if (root && loadingContainer) {
                    root.unmount();
                    document.body.removeChild(loadingContainer);
                }

                await Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: error.message || 'Failed to reschedule appointment. Please try again.',
                    confirmButtonText: 'OK'
                });
            } finally {
                setIsLoading(false);
            }
        }
    };

    const ScissorsLoader = ({message}) => (
        <div className="scissors-loader">
            <div className="loader-content">
                <Scissors className="animate-scissor"/>
                <p>{message}</p>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-xl mx-auto bg-base-100 rounded-lg shadow-xl p-6">
            {/* Header */}
            <div className="mb-6">
                <h3 className="text-2xl font-bold text-center mb-2">Reschedule Appointment</h3>
                <p className="text-base-content/60 text-center">
                    Select a new date and time for your appointment
                </p>
            </div>

            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <button
                        className="btn btn-circle btn-sm"
                        onClick={() => {
                            const newDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1);
                            if (newDate >= today) {
                                setSelectedMonth(newDate);
                            }
                        }}
                        disabled={selectedMonth.getMonth() === today.getMonth() && selectedMonth.getFullYear() === today.getFullYear()}
                    >
                        <ChevronLeft className="w-4 h-4"/>
                    </button>
                    <h3 className="text-lg font-semibold">
                        {months[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
                    </h3>
                    <button
                        className="btn btn-circle btn-sm"
                        onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                    >
                        <ChevronRight className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="mb-6">
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center font-medium text-base-content/60 text-sm">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {getDaysInMonth(selectedMonth).map((date, index) => {
                        const isSelected = date && selectedDate &&
                            date.toDateString() === selectedDate.toDateString();
                        const isPast = date && date < today;
                        const isToday = date && date.toDateString() === today.toDateString();

                        return (
                            <div
                                key={index}
                                onClick={() => handleDateSelect(date)}
                                className={`
                  aspect-square flex items-center justify-center rounded-lg
                  transition-all duration-200 text-sm
                  ${date ? 'cursor-pointer hover:bg-primary/20' : ''}
                  ${isPast ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isSelected ? 'bg-primary text-primary-content' : ''}
                  ${isToday ? 'ring-2 ring-primary ring-offset-2' : ''}
                  ${!date ? '' : 'hover:scale-105'}
                `}
                            >
                                {date?.getDate()}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Time Selection */}
            {selectedDate && (
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <label className="label-text flex items-center gap-2 font-medium">
                            <Clock className="w-4 h-4"/>
                            Available Time Slots
                        </label>
                        {!isLoading && (
                            <span className="text-xs text-base-content/60">
                {generateTimeSlots().length - bookedSlots.length} slots available
              </span>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center p-4">
                            <span className="loading loading-spinner loading-md"></span>
                        </div>
                    ) : error ? (
                        <div className="alert alert-error">
                            <AlertCircle className="w-5 h-5"/>
                            <span>{error}</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {generateTimeSlots().map((time) => {
                                const isBooked = bookedSlots.includes(time);
                                return (
                                    <button
                                        key={time}
                                        onClick={() => !isBooked && setSelectedTime(time)}
                                        className={`
                      btn btn-sm relative
                      ${selectedTime === time ? 'btn-primary' : 'btn-outline'}
                      ${isBooked ? 'btn-disabled opacity-50' : ''}
                      transition-all duration-200 hover:scale-105
                    `}
                                        disabled={isBooked}
                                    >
                                        {time}
                                        {isBooked && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div
                                                    className="w-full h-0.5 bg-base-content/50 rotate-45 transform origin-center"></div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Selected Date/Time Display */}
            {selectedDate && selectedTime && (
                <div className="alert alert-info mb-6">
                    <CalendarDays className="w-5 h-5"/>
                    <span>
            Selected: {selectedDate.toLocaleDateString()} at {selectedTime}
          </span>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
                <button className="btn btn-ghost" onClick={onClose}>
                    Cancel
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={!selectedDate || !selectedTime || isLoading}
                >
                    Confirm Reschedule
                </button>
            </div>
        </div>
    );
};

export default AppointmentRescheduleModal;