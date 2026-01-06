import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Calendar, Clock, User, DollarSign, CheckCircle, XCircle, MessageCircle, AlertTriangle } from 'lucide-react';

const ShopCalendarTab = ({ shop, user }) => {
    const [appointments, setAppointments] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState('day'); // 'day', 'week', 'month'
    const [showDetails, setShowDetails] = useState(null);

    useEffect(() => {
        if (!shop?.id) return;

        const fetchAppointments = async () => {
            setIsLoading(true);
            try {
                // Format date for Firestore query
                const startOfDay = new Date(selectedDate);
                startOfDay.setHours(0, 0, 0, 0);

                const endOfDay = new Date(selectedDate);
                endOfDay.setHours(23, 59, 59, 999);

                let startDate = startOfDay;
                let endDate = endOfDay;

                // Adjust query range based on view
                if (view === 'week') {
                    // Calculate start of week (Sunday)
                    const day = startOfDay.getDay();
                    startDate = new Date(startOfDay);
                    startDate.setDate(startDate.getDate() - day);

                    // Calculate end of week (Saturday)
                    endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 6);
                    endDate.setHours(23, 59, 59, 999);
                } else if (view === 'month') {
                    // Calculate start of month
                    startDate = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

                    // Calculate end of month
                    endDate = new Date(startOfDay.getFullYear(), startOfDay.getMonth() + 1, 0, 23, 59, 59, 999);
                }

                // Format dates for Firestore query
                const startDateStr = startDate.toISOString().split('T')[0];
                const endDateStr = endDate.toISOString().split('T')[0];

                // Query appointments for this shop within date range
                const appointmentsRef = collection(db, 'bookings');
                const q = query(
                    appointmentsRef,
                    where('shopId', '==', shop.id),
                    where('selectedDate', '>=', startDateStr),
                    where('selectedDate', '<=', endDateStr),
                    orderBy('selectedDate'),
                    orderBy('selectedTime')
                );

                const querySnapshot = await getDocs(q);
                const fetchedAppointments = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Convert timestamp to JS Date if needed
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                }));

                setAppointments(fetchedAppointments);
            } catch (error) {
                console.error('Error fetching appointments:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAppointments();
    }, [shop.id, selectedDate, view]);

    const changeAppointmentStatus = async (appointmentId, newStatus) => {
        try {
            const appointmentRef = doc(db, 'bookings', appointmentId);
            await updateDoc(appointmentRef, {
                status: newStatus,
                lastUpdated: Timestamp.now()
            });

            // Update local state
            setAppointments(prev =>
                prev.map(app =>
                    app.id === appointmentId
                        ? {...app, status: newStatus, lastUpdated: new Date()}
                        : app
                )
            );

            // Close details panel
            setShowDetails(null);
        } catch (error) {
            console.error('Error updating appointment status:', error);
        }
    };

    // Generate time slots for the day view
    const generateTimeSlots = () => {
        const slots = [];

        // Get opening hours from shop availability
        const dayOfWeek = selectedDate.toLocaleString('en-US', { weekday: 'long' });
        const availability = shop.availability?.[dayOfWeek];

        if (!availability || !availability.open || !availability.close) {
            return []; // Shop is closed or no availability info
        }

        // Parse opening hours
        const openHour = parseInt(availability.open.split(':')[0]);
        const openMinute = parseInt(availability.open.split(':')[1]);
        const closeHour = parseInt(availability.close.split(':')[0]);
        const closeMinute = parseInt(availability.close.split(':')[1]);

        // Generate 30-minute slots from opening to closing time
        let currentHour = openHour;
        let currentMinute = openMinute;

        while (
            currentHour < closeHour ||
            (currentHour === closeHour && currentMinute < closeMinute)
            ) {
            const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
            slots.push(timeString);

            // Increment by slot duration (default 30 minutes)
            currentMinute += 30;
            if (currentMinute >= 60) {
                currentHour += 1;
                currentMinute = 0;
            }
        }

        return slots;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    // Find appointments for a specific time slot
    const getAppointmentsForTimeSlot = (timeSlot) => {
        const selectedDateStr = selectedDate.toISOString().split('T')[0];
        return appointments.filter(
            appointment =>
                appointment.selectedDate === selectedDateStr &&
                appointment.selectedTime === timeSlot
        );
    };

    const timeSlots = generateTimeSlots();

    // Render day view
    const renderDayView = () => {
        if (timeSlots.length === 0) {
            return (
                <div className="p-4 text-center">
                    <p>No available hours set for this day.</p>
                </div>
            );
        }

        return (
            <div className="overflow-auto max-h-[calc(100vh-300px)]">
                {timeSlots.map(timeSlot => (
                    <motion.div
                        key={timeSlot}
                        className="mb-2 relative"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="flex items-center border-l-4 border-primary pl-2 py-2">
                            <Clock className="w-4 h-4 mr-2 text-primary" />
                            <span className="text-sm font-medium">{timeSlot}</span>
                        </div>

                        <div className="pl-8 space-y-2 mt-1">
                            {getAppointmentsForTimeSlot(timeSlot).map(appointment => (
                                <motion.div
                                    key={appointment.id}
                                    className={`
                    p-3 rounded-lg cursor-pointer
                    ${getStatusColor(appointment.status)}
                    hover:shadow-md transition-shadow
                  `}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => setShowDetails(appointment.id === showDetails ? null : appointment.id)}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="font-medium">{appointment.userName}</div>
                                        <div className="badge badge-sm">
                                            {appointment.status === 'pending' && 'Pending'}
                                            {appointment.status === 'confirmed' && 'Confirmed'}
                                            {appointment.status === 'cancelled' && 'Cancelled'}
                                            {appointment.status === 'completed' && 'Completed'}
                                        </div>
                                    </div>

                                    <div className="text-xs">
                                        {appointment.selectedServices?.map(service => service.name).join(", ")}
                                    </div>

                                    {showDetails === appointment.id && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-2 pt-2 border-t border-base-300"
                                        >
                                            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                                <div>
                                                    <span className="text-base-content/60">Phone:</span>{' '}
                                                    {appointment.userPhone || 'Not provided'}
                                                </div>
                                                <div>
                                                    <span className="text-base-content/60">Email:</span>{' '}
                                                    {appointment.userEmail}
                                                </div>
                                                <div>
                                                    <span className="text-base-content/60">Created:</span>{' '}
                                                    {new Date(appointment.createdAt).toLocaleString()}
                                                </div>
                                                <div>
                                                    <span className="text-base-content/60">Price:</span>{' '}
                                                    €{appointment.selectedServices?.reduce((sum, service) => sum + parseFloat(service.price), 0).toFixed(2)}
                                                </div>
                                            </div>

                                            <div className="flex gap-1 mt-2">
                                                {appointment.status === 'pending' && (
                                                    <button
                                                        className="btn btn-xs btn-success gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            changeAppointmentStatus(appointment.id, 'confirmed');
                                                        }}
                                                    >
                                                        <CheckCircle className="w-3 h-3" />
                                                        Confirm
                                                    </button>
                                                )}

                                                {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
                                                    <button
                                                        className="btn btn-xs btn-error gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            changeAppointmentStatus(appointment.id, 'cancelled');
                                                        }}
                                                    >
                                                        <XCircle className="w-3 h-3" />
                                                        Cancel
                                                    </button>
                                                )}

                                                {appointment.status === 'confirmed' && (
                                                    <button
                                                        className="btn btn-xs btn-info gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            changeAppointmentStatus(appointment.id, 'completed');
                                                        }}
                                                    >
                                                        <CheckCircle className="w-3 h-3" />
                                                        Complete
                                                    </button>
                                                )}

                                                <button
                                                    className="btn btn-xs btn-ghost gap-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Messaging functionality to be implemented
                                                    }}
                                                >
                                                    <MessageCircle className="w-3 h-3" />
                                                    Message
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            ))}

                            {getAppointmentsForTimeSlot(timeSlot).length === 0 && (
                                <div className="p-2 text-xs text-base-content/50 text-center bg-base-200/50 rounded">
                                    No appointments
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        );
    };

    // Helper function to get color based on status
    const getStatusColor = (status) => {
        switch(status) {
            case 'confirmed':
                return 'bg-success/10 border-l-2 border-success';
            case 'cancelled':
                return 'bg-error/10 border-l-2 border-error';
            case 'completed':
                return 'bg-info/10 border-l-2 border-info';
            case 'pending':
            default:
                return 'bg-warning/10 border-l-2 border-warning';
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Calendar Header */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <button
                        className="btn btn-sm btn-circle"
                        onClick={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setDate(selectedDate.getDate() - (view === 'day' ? 1 : view === 'week' ? 7 : 30));
                            setSelectedDate(newDate);
                        }}
                    >
                        &lt;
                    </button>

                    <h3 className="text-lg font-bold">
                        {view === 'day' && selectedDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        })}
                        {view === 'week' && `Week of ${new Date(selectedDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                        })}`}
                        {view === 'month' && selectedDate.toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric'
                        })}
                    </h3>

                    <button
                        className="btn btn-sm btn-circle"
                        onClick={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setDate(selectedDate.getDate() + (view === 'day' ? 1 : view === 'week' ? 7 : 30));
                            setSelectedDate(newDate);
                        }}
                    >
                        &gt;
                    </button>
                </div>

                <div className="join">
                    <button
                        className={`join-item btn btn-sm ${view === 'day' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setView('day')}
                    >
                        Day
                    </button>
                    <button
                        className={`join-item btn btn-sm ${view === 'week' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setView('week')}
                    >
                        Week
                    </button>
                    <button
                        className={`join-item btn btn-sm ${view === 'month' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setView('month')}
                    >
                        Month
                    </button>
                </div>
            </div>

            {/* Calendar Content */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="loading loading-spinner text-primary"></div>
                </div>
            ) : (
                <div className="flex-1">
                    {view === 'day' && renderDayView()}

                    {/* Week and Month views will be implemented in subsequent updates */}
                    {view !== 'day' && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-base-content/70">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-warning" />
                                <p className="font-medium mb-1">{view.charAt(0).toUpperCase() + view.slice(1)} view coming soon</p>
                                <p className="text-sm">Please use day view for now</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Stats Footer */}
            <div className="mt-4 p-2 bg-base-200 rounded-lg grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                    <div className="font-medium">Today's Appointments</div>
                    <div className="text-lg font-bold text-primary">
                        {appointments.filter(a =>
                            a.selectedDate === new Date().toISOString().split('T')[0]
                        ).length}
                    </div>
                </div>
                <div>
                    <div className="font-medium">Pending</div>
                    <div className="text-lg font-bold text-warning">
                        {appointments.filter(a => a.status === 'pending').length}
                    </div>
                </div>
                <div>
                    <div className="font-medium">Confirmed</div>
                    <div className="text-lg font-bold text-success">
                        {appointments.filter(a => a.status === 'confirmed').length}
                    </div>
                </div>
                <div>
                    <div className="font-medium">Revenue</div>
                    <div className="text-lg font-bold">
                        €{appointments
                        .filter(a => a.status !== 'cancelled')
                        .reduce((sum, appointment) => {
                            const serviceTotal = appointment.selectedServices?.reduce(
                                (total, service) => total + parseFloat(service.price), 0
                            ) || 0;
                            return sum + serviceTotal;
                        }, 0)
                        .toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopCalendarTab;