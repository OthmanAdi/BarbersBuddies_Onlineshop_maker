import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle, Calendar, User, MapPin, Clock, DollarSign, X, Send } from 'lucide-react';
import LanguageContext from './LanguageContext';
import ThemeContext from './ThemeContext';

const BookingConfirmation = ({ appointmentId, onClose, onConfirm }) => {
    const [booking, setBooking] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [message, setMessage] = useState('');
    const [showMessageForm, setShowMessageForm] = useState(false);
    const { language, t } = useContext(LanguageContext);
    const { theme } = useContext(ThemeContext);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        const fetchBookingDetails = async () => {
            if (!appointmentId) return;

            try {
                setIsLoading(true);
                console.log('Fetching booking details for:', appointmentId);

                const bookingRef = doc(db, 'bookings', appointmentId);
                const bookingSnap = await getDoc(bookingRef);

                if (bookingSnap.exists()) {
                    const bookingData = {
                        id: bookingSnap.id,
                        ...bookingSnap.data()
                    };

                    console.log('Booking details fetched successfully:', bookingData.id);
                    setBooking(bookingData);
                } else {
                    console.error('No booking found with ID:', appointmentId);
                }
            } catch (error) {
                console.error('Error fetching booking details:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBookingDetails();
    }, [appointmentId]);

    const handleConfirm = async () => {
        if (!booking) return;

        try {
            setIsSending(true);
            console.log('Confirming booking:', booking.id);

            // Update booking status
            const bookingRef = doc(db, 'bookings', booking.id);
            await updateDoc(bookingRef, {
                status: 'confirmed',
                lastUpdated: serverTimestamp()
            });
            console.log('Booking status updated to confirmed');

            // Add notification for customer
            const notificationData = {
                type: 'booking_confirmed',
                bookingId: booking.id,
                shopId: booking.shopId,
                userEmail: booking.userEmail,
                title: 'Booking Confirmed',
                message: message || `Your booking for ${new Date(booking.selectedDate).toLocaleDateString()} at ${booking.selectedTime} has been confirmed.`,
                read: false,
                createdAt: serverTimestamp()
            };

            const notificationRef = await addDoc(collection(db, 'notifications'), notificationData);
            console.log('Customer notification created:', notificationRef.id);

            // Add message if provided
            if (message.trim()) {
                const messageData = {
                    bookingId: booking.id,
                    senderId: booking.shopId,
                    senderType: 'shop',
                    content: message,
                    timestamp: serverTimestamp(),
                    read: false,
                    shopId: booking.shopId,
                    customerId: booking.userEmail,
                    customerName: booking.userName,
                    shopName: booking.shopName
                };

                const messageRef = await addDoc(collection(db, 'messages'), messageData);
                console.log('Message sent to customer:', messageRef.id);
            }

            setSuccess(true);

            // Notify parent component
            if (onConfirm) {
                onConfirm({
                    id: booking.id,
                    status: 'confirmed',
                    message: message || ''
                });
            }

            // Close after delay
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (error) {
            console.error('Error confirming booking:', error);
            setSuccess(false);
        } finally {
            setIsSending(false);
        }
    };

    // Enhanced animations
    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                when: "beforeChildren"
            }
        },
        exit: {
            opacity: 0,
            transition: {
                when: "afterChildren"
            }
        }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 50, scale: 0.9 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: 0.1
            }
        },
        exit: {
            opacity: 0,
            y: 50,
            scale: 0.9,
            transition: { duration: 0.2 }
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString(language === 'en' ? 'en-US' :
            language === 'tr' ? 'tr-TR' :
                language === 'ar' ? 'ar-EG' : 'de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    className="card bg-base-100 shadow-2xl w-full max-w-md overflow-hidden"
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                >
                    {isLoading ? (
                        <div className="card-body items-center text-center p-8">
                            <motion.div
                                className="loading loading-spinner loading-lg text-primary"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                            <p className="mt-4">{t('calendar.loading')}</p>
                        </div>
                    ) : booking ? (
                        <div className="card-body p-0">
                            {/* Header with colorful gradient */}
                            <div className="bg-gradient-to-r from-primary to-secondary p-6 text-primary-content">
                                <h2 className="card-title text-xl font-bold">
                                    {t('calendar.appointmentDetails')}
                                </h2>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <User className="w-5 h-5 text-primary" />
                                    <div>
                                        <div className="text-xs text-base-content/60">{t('calendar.customer')}</div>
                                        <div className="font-medium">{booking.userName}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-primary" />
                                    <div>
                                        <div className="text-xs text-base-content/60">{t('calendar.date')}</div>
                                        <div className="font-medium">{formatDate(booking.selectedDate)}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-primary" />
                                    <div>
                                        <div className="text-xs text-base-content/60">{t('calendar.time')}</div>
                                        <div className="font-medium">{booking.selectedTime}</div>
                                    </div>
                                </div>

                                <motion.div
                                    className="divider my-2"
                                    initial={{ width: 0 }}
                                    animate={{ width: '100%' }}
                                    transition={{ delay: 0.3, duration: 0.5 }}
                                />

                                <div>
                                    <div className="text-xs text-base-content/60 mb-2">{t('calendar.services')}</div>
                                    <div className="space-y-2">
                                        {booking.selectedServices?.map((service, index) => (
                                            <motion.div
                                                key={index}
                                                className="flex justify-between items-center"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 * index }}
                                            >
                                                <span>{service.name}</span>
                                                <span className="font-medium">€{service.price}</span>
                                            </motion.div>
                                        ))}
                                    </div>

                                    <motion.div
                                        className="divider my-2"
                                        initial={{ width: 0 }}
                                        animate={{ width: '100%' }}
                                        transition={{ delay: 0.5, duration: 0.5 }}
                                    />

                                    <motion.div
                                        className="flex justify-between items-center font-bold"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.6 }}
                                    >
                                        <span>{t('calendar.total')}</span>
                                        <span>€{booking.selectedServices?.reduce((sum, service) =>
                                            sum + parseFloat(service.price), 0).toFixed(2)}</span>
                                    </motion.div>
                                </div>

                                {/* Message form */}
                                <AnimatePresence>
                                    {showMessageForm && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="mt-4"
                                        >
                                            <textarea
                                                className="textarea textarea-bordered w-full"
                                                placeholder={t('calendar.messagePrompt')}
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                rows={3}
                                            ></textarea>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Success message */}
                                <AnimatePresence>
                                    {success === true && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            className="alert alert-success"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            <span>{t('calendar.confirmed')}</span>
                                        </motion.div>
                                    )}

                                    {success === false && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            className="alert alert-error"
                                        >
                                            <X className="w-5 h-5" />
                                            <span>{t('calendar.failed')}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Actions */}
                            <div className="card-actions justify-end gap-2 p-6 pt-0">
                                {!showMessageForm && (
                                    <motion.button
                                        className="btn btn-ghost btn-sm gap-2"
                                        onClick={() => setShowMessageForm(true)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Send className="w-4 h-4" />
                                        {t('calendar.addMessage')}
                                    </motion.button>
                                )}

                                <motion.button
                                    className="btn btn-ghost"
                                    onClick={onClose}
                                    disabled={isSending}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {t('common.cancel')}
                                </motion.button>

                                <motion.button
                                    className="btn btn-primary gap-2"
                                    onClick={handleConfirm}
                                    disabled={isSending || success !== null}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {isSending ? (
                                        <>
                                            <motion.span
                                                className="loading loading-spinner loading-xs"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            />
                                            {t('calendar.confirming')}
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            {t('calendar.confirm')}
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    ) : (
                        <div className="card-body items-center text-center p-8">
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <X className="w-12 h-12 text-error" />
                            </motion.div>
                            <p className="mt-4 text-error">Appointment not found</p>
                            <motion.button
                                className="btn btn-sm btn-ghost mt-4"
                                onClick={onClose}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {t('common.close')}
                            </motion.button>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
};

export default BookingConfirmation;