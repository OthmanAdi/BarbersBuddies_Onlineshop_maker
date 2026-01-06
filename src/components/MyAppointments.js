import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDoc, getDocs, onSnapshot, orderBy, query, where, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, X, XCircle } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import Swal from 'sweetalert2';
import AppointmentCard from './AppointmentCard';
import NotificationPreferences from "./NotificationPreferences";
import AppointmentSkeletonGrid from "./AppointmentSkeleton";

export default function MyAppointments() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('upcoming');
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [user, setUser] = useState(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [isReschedulingModalOpen, setIsReschedulingModalOpen] = useState(false);
    const [newDate, setNewDate] = useState(null);
    const [newTime, setNewTime] = useState('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
    const [isCancelledModalOpen, setIsCancelledModalOpen] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        const unsubMessages = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) setDataLoading(false);
        });

        return () => unsubMessages();
    }, []);

    useEffect(() => {
        if (!user) return;

        const messagesRef = collection(db, 'messages');
        const q = query(
            messagesRef,
            where('customerId', '==', user.uid),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(newMessages);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        async function fetchAppointments() {
            if (!user) return;

            setDataLoading(true);
            try {
                const appointmentsRef = collection(db, 'bookings');
                const q = query(
                    appointmentsRef,
                    where('userEmail', '==', user.email.toLowerCase())
                );

                const querySnapshot = await getDocs(q);
                const fetchedAppointments = await Promise.all(
                    querySnapshot.docs.map(async docSnapshot => {
                        const data = docSnapshot.data();
                        const shopDocRef = doc(db, 'barberShops', data.shopId);
                        const shopDoc = await getDoc(shopDocRef);
                        const shopData = shopDoc.exists() ? shopDoc.data() : {};

                        return {
                            id: docSnapshot.id,
                            ...data,
                            selectedDate: data.selectedDate,
                            createdAt: data.createdAt?.toDate() || new Date(),
                            isRated: Boolean(data.isRated),
                            rating: data.rating || 0,
                            review: data.review || '',
                            ratingSubmittedAt: data.ratingSubmittedAt?.toDate() || null,
                            ratingId: data.ratingId || null,
                            shopAddress: shopData.address || ''
                        };
                    })
                );

                const sortedAppointments = fetchedAppointments.sort((a, b) =>
                    new Date(b.selectedDate) - new Date(a.selectedDate)
                );
                setAppointments(sortedAppointments);
            } catch (error) {
                console.error('Error fetching appointments:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Could not load your appointments',
                    icon: 'error'
                });
            } finally {
                setDataLoading(false);
                setLoading(false);
            }
        }

        fetchAppointments();
    }, [user]);

    const filteredAppointments = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return appointments.filter(appointment => {
            const appointmentDate = new Date(appointment.selectedDate);
            appointmentDate.setHours(0, 0, 0, 0);

            switch (activeFilter) {
                case 'upcoming':
                    return appointmentDate >= now && appointment.status !== 'cancelled';
                case 'past':
                    return appointmentDate < now && appointment.status !== 'cancelled';
                case 'cancelled':
                    return appointment.status === 'cancelled';
                default:
                    return true;
            }
        });
    }, [appointments, activeFilter]);

    const handleReschedule = async (appointmentId, {newDate, newTime}) => {
        try {
            const response = await fetch(`${process.env.REACT_APP_CLOUD_FUNCTIONS_URL}/rescheduleAppointment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: appointmentId,
                    newDate,
                    newTime,
                    userId: user.uid
                }),
            });

            if (!response.ok) throw new Error('Failed to reschedule');

            Swal.fire({
                title: 'Success!',
                text: 'Appointment rescheduled successfully',
                icon: 'success'
            });
        } catch (error) {
            console.error('Error rescheduling:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to reschedule appointment',
                icon: 'error'
            });
        }
    };

    const handleSendMessage = async (appointmentId, message) => {
        try {
            await fetch(`${process.env.REACT_APP_CLOUD_FUNCTIONS_URL}/shopMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: appointmentId,
                    content: message,
                    senderId: user.uid,
                    senderType: 'customer'
                }),
            });
        } catch (error) {
            console.error('Error sending message:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to send message',
                icon: 'error'
            });
        }
    };

    const handleSubmitRating = async (appointmentId, {rating, review, ratingId, success}) => {
        if (!success) return;

        setAppointments(prevAppointments =>
            prevAppointments.map(appointment => {
                if (appointment.id === appointmentId) {
                    return {
                        ...appointment,
                        isRated: true,
                        rating,
                        review,
                        ratingId,
                        ratingSubmittedAt: new Date()
                    };
                }
                return appointment;
            })
        );
    };

    if (dataLoading || loading) {
        return (
            <AppointmentSkeletonGrid/>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-base-100 to-base-200">
                <div className="text-center space-y-4">
                    <p className="text-lg font-medium">Please sign in to view your appointments</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-base-100 to-base-200 p-4 lg:p-8">
            <motion.div
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                className="text-center mb-8"
            >
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                    My Appointments
                </h1>
                <p className="text-base-content/60 mt-2">
                    Manage and track your appointments
                </p>
            </motion.div>

            <div className="flex justify-center mb-8">
                <div className="join">
                    {['upcoming', 'past', 'cancelled'].map((filter) => (
                        <button
                            key={filter}
                            className={`join-item btn btn-sm capitalize ${
                                activeFilter === filter ? 'btn-primary' : 'btn-ghost'
                            }`}
                            onClick={() => setActiveFilter(filter)}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setIsCancelledModalOpen(true)}
                    className="btn btn-sm btn-ghost ml-4 gap-2"
                >
                    <XCircle className="w-4 h-4 text-error"/>
                    View Cancelled
                </button>
            </div>

            {activeFilter === 'upcoming' && (
                <motion.div
                    initial={{opacity: 0, y: 20}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.2}}
                    className="mb-8"
                >
                    <NotificationPreferences
                        userId={user?.uid}
                        userEmail={user?.email}
                    />
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode='popLayout'>
                    {filteredAppointments.map((appointment, index) => (
                        <motion.div
                            key={appointment.id}
                            layout
                            initial={{opacity: 0, scale: 0.9}}
                            animate={{opacity: 1, scale: 1}}
                            exit={{opacity: 0, scale: 0.9}}
                            transition={{duration: 0.3, delay: index * 0.1}}
                        >
                            <AppointmentCard
                                appointment={appointment}
                                onReschedule={handleReschedule}
                                onRate={handleSubmitRating}
                                onMessage={handleSendMessage}
                                setAppointments={setAppointments}
                                setActiveFilter={setActiveFilter}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {filteredAppointments.length === 0 && (
                <motion.div
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    className="text-center py-12"
                >
                    <div className="max-w-sm mx-auto">
                        <Calendar className="w-16 h-16 mx-auto text-base-content/20 mb-4"/>
                        <h3 className="text-xl font-bold mb-2">No appointments found</h3>
                        <p className="text-base-content/60">
                            {activeFilter === 'upcoming'
                                ? "You don't have any upcoming appointments."
                                : activeFilter === 'past'
                                    ? "You don't have any past appointments."
                                    : "You don't have any cancelled appointments."}
                        </p>
                    </div>
                </motion.div>
            )}

            <AnimatePresence>
                {isCancelledModalOpen && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setIsCancelledModalOpen(false)}
                    >
                        <motion.div
                            initial={{scale: 0.95, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            exit={{scale: 0.95, opacity: 0}}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-base-100 rounded-box shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="p-4 border-b border-base-200 flex items-center justify-between">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <XCircle className="w-5 h-5 text-error"/>
                                    Cancelled Appointments
                                </h3>
                                <button
                                    onClick={() => setIsCancelledModalOpen(false)}
                                    className="btn btn-sm btn-ghost btn-circle"
                                >
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="overflow-y-auto p-4 space-y-4 max-h-[60vh]">
                                {appointments
                                    .filter(app => app.status === 'cancelled')
                                    .map((appointment, index) => (
                                        <motion.div
                                            key={appointment.id}
                                            initial={{opacity: 0, y: 20}}
                                            animate={{opacity: 1, y: 0}}
                                            transition={{delay: index * 0.1}}
                                            className="card bg-base-200"
                                        >
                                            <div className="card-body p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="avatar">
                                                            <div
                                                                className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center">
                                                                <Calendar className="w-6 h-6 text-base-content/70"/>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold">
                                                                {new Date(appointment.selectedDate).toLocaleDateString()}
                                                            </h4>
                                                            <p className="text-sm text-base-content/70">
                                                                {appointment.selectedTime}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="badge badge-error gap-1">
                                                            <XCircle className="w-3 h-3"/>
                                                            Cancelled
                                                        </div>
                                                        {appointment.cancelledBy === 'customer' && (
                                                            <div className="badge badge-outline badge-sm">
                                                                Cancelled by you
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Services */}
                                                <div className="mt-4">
                                                    <h5 className="text-sm font-semibold mb-2">Services</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {appointment.selectedServices.map((service, idx) => (
                                                            <span key={idx} className="badge badge-ghost">
                                    {service.name}
                                </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {appointment.cancellationReason && (
                                                    <div
                                                        className="mt-4 p-3 bg-error/10 rounded-lg border border-error/20">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h5 className="text-sm font-semibold text-error">
                                                                Cancellation Reason
                                                            </h5>
                                                            {appointment.cancelledAt && (
                                                                <span className="text-xs text-error/60">
                    {appointment.cancelledAt?.toDate
                        ? new Date(appointment.cancelledAt.toDate()).toLocaleString()
                        : new Date(appointment.cancelledAt).toLocaleString()
                    }
                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-error/80">
                                                            {appointment.cancellationReason}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}