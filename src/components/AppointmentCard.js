import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, Calendar, CheckCircle, Clock, MessageCircle, Scissors, Star, XCircle} from 'lucide-react';
import {
    addDoc,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import {db} from '../firebase';
import '../App.css';
import './CardStyle.css'
import Swal from "sweetalert2";
import AppointmentRescheduleModal from "./AppointmentRescheduleModal";
import './ScissorsLoader.css';
import {createRoot} from 'react-dom/client';
import CountdownTimer from "./CountdownTimer";
import MapLink from "./handleAddressClick";


const AppointmentCard = ({appointment, onReschedule, onRate, onMessage, setAppointments, setActiveFilter}) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isRatingOpen, setIsRatingOpen] = useState(false);
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [messages, setMessages] = useState([]);
    const [shopIsTyping, setShopIsTyping] = useState(false);
    const chatEndRef = useRef(null);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [lastMessageTime, setLastMessageTime] = useState(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    // Load messages when chat is open
    // Replace your existing message loading effect with this:
    useEffect(() => {
        if (!appointment.id) return;  // Remove isChatOpen check so it always listens

        const messagesRef = collection(db, 'messages');
        const q = query(
            messagesRef,
            where('bookingId', '==', appointment.id),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate() || new Date()
                };
            });

            setMessages(newMessages);

            // Handle notifications for new shop messages
            if (newMessages.length > 0) {
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.senderType === 'shop' &&
                    (!lastMessageTime || lastMessage.timestamp > lastMessageTime)) {
                    if (!isChatOpen) {
                        setHasNewMessage(true);
                    }
                    setLastMessageTime(lastMessage.timestamp);
                }
            }

            // Only mark as read if chat is open
            if (isChatOpen) {
                snapshot.docs.forEach(async (doc) => {
                    const messageData = doc.data();
                    if (!messageData.read && messageData.senderType === 'shop') {
                        await updateDoc(doc.ref, {read: true});
                    }
                });
            }
        });

        return () => unsubscribe();
    }, [appointment.id, isChatOpen, lastMessageTime]);

// Keep this effect to clear notification when chat opens
    useEffect(() => {
        if (isChatOpen) {
            setHasNewMessage(false);
        }
    }, [isChatOpen]);

// Watch for shop typing
    useEffect(() => {
        if (!isChatOpen || !appointment.id) return;

        const typingRef = doc(db, 'typing', appointment.id);
        const unsubscribe = onSnapshot(typingRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setShopIsTyping(data?.shop_typing || false);
            }
        });

        return () => unsubscribe();
    }, [isChatOpen, appointment.id]);

// Scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({behavior: 'smooth'});
        }
    }, [messages]);

    // Add this effect to handle new message notifications
    // useEffect(() => {
    //     if (!messages.length) return;
    //
    //     const lastMessage = messages[messages.length - 1];
    //
    //     if (lastMessage?.senderType === 'shop' &&
    //         (!lastMessageTime || lastMessage.timestamp > lastMessageTime)) {
    //         // Only show notification if chat is closed
    //         if (!isChatOpen) {
    //             setHasNewMessage(true);
    //             // Subtle notification sound (optional)
    //             new Audio('/message.mp3')?.play().catch(() => {});
    //         }
    //         setLastMessageTime(lastMessage.timestamp);
    //     }
    // }, [messages, isChatOpen]);

// Add this effect to clear notification when chat is opened
    useEffect(() => {
        if (isChatOpen) {
            setHasNewMessage(false);
        }
    }, [isChatOpen]);

    // Add this useEffect right after your existing useEffects:
    // useEffect(() => {
    //     if (!appointment.id) return;
    //
    //     const messagesRef = collection(db, 'messages');
    //     const q = query(
    //         messagesRef,
    //         where('bookingId', '==', appointment.id),
    //         where('senderType', '==', 'shop'),
    //         orderBy('timestamp', 'desc'),
    //         limit(1)
    //     );
    //
    //     const unsubscribe = onSnapshot(q, (snapshot) => {
    //         snapshot.docChanges().forEach(change => {
    //             if (change.type === 'added' || change.type === 'modified') {
    //                 const messageData = change.doc.data();
    //                 const messageTime = messageData.timestamp?.toDate();
    //
    //                 if (!isChatOpen && messageTime &&
    //                     (!lastMessageTime || messageTime > lastMessageTime)) {
    //                     setHasNewMessage(true);
    //                     setLastMessageTime(messageTime);
    //                 }
    //             }
    //         });
    //     });
    //
    //     return () => unsubscribe();
    // }, [appointment.id, lastMessageTime, isChatOpen]);

    const handleCancelAppointment = async () => {
        try {
            const result = await Swal.fire({
                title: 'Cancel Appointment?',
                text: "Please provide a reason for cancellation:",
                input: 'text',
                inputPlaceholder: 'Cancellation reason...',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, cancel it!',
                inputValidator: (value) => {
                    if (!value) {
                        return 'You need to provide a reason!';
                    }
                }
            });

            if (result.isConfirmed) {
                setIsCancelling(true);

                // Create and show loader
                const loadingContainer = document.createElement('div');
                document.body.appendChild(loadingContainer);
                const root = createRoot(loadingContainer);
                root.render(<ScissorsLoader message="Cancelling appointment..."/>);

                // Add this new code to update bookedTimeSlots
                const timeSlotQuery = query(
                    collection(db, 'bookedTimeSlots'),
                    where('shopId', '==', appointment.shopId),
                    where('date', '==', appointment.selectedDate),
                    where('time', '==', appointment.selectedTime),
                    where('bookingId', '==', appointment.id)
                );

                const timeSlotSnapshot = await getDocs(timeSlotQuery);
                if (!timeSlotSnapshot.empty) {
                    const timeSlotDoc = timeSlotSnapshot.docs[0];
                    await updateDoc(doc(db, 'bookedTimeSlots', timeSlotDoc.id), {
                        status: 'cancelled'
                    });
                }

                // Rest of your existing code...
                await fetch(`${process.env.REACT_APP_CLOUD_FUNCTIONS_URL}/cancelBooking`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        bookingId: appointment.id,
                        reason: result.value,
                        userEmail: appointment.userEmail,
                        userName: appointment.userName,
                        selectedDate: appointment.selectedDate,
                        selectedTime: appointment.selectedTime,
                        shopEmail: appointment.shopEmail
                    }),
                });

                const notificationRef = collection(db, 'notifications');
                await addDoc(notificationRef, {
                    type: 'booking_cancelled',
                    title: 'Appointment Cancelled',
                    message: `${appointment.userName} cancelled their appointment for ${new Date(appointment.selectedDate).toLocaleDateString()} at ${appointment.selectedTime}. Reason: ${result.value}`,
                    shopId: appointment.shopId,
                    read: false,
                    createdAt: serverTimestamp(),
                    bookingId: appointment.id,
                    totalPrice: appointment.selectedServices.reduce(
                        (total, service) => total + parseFloat(service.price), 0
                    ).toFixed(2),
                    customerName: appointment.userName,
                    appointmentDate: appointment.selectedDate,
                    appointmentTime: appointment.selectedTime,
                    cancelledBy: 'customer',
                    cancellationReason: result.value
                });

                // Update the booking in Firestore
                const bookingRef = doc(db, 'bookings', appointment.id);
                await updateDoc(bookingRef, {
                    status: 'cancelled',
                    cancellationReason: result.value,
                    cancelledBy: 'customer',
                    cancelledAt: serverTimestamp()
                });

                // Update local appointments state
                setAppointments(prevAppointments =>
                    prevAppointments.map(app =>
                        app.id === appointment.id
                            ? {
                                ...app,
                                status: 'cancelled',
                                cancellationReason: result.value,
                                cancelledBy: 'customer',
                                cancelledAt: new Date()
                            }
                            : app
                    )
                );

                // Update active filter to show cancelled appointment
                setActiveFilter('cancelled');

                // Cleanup loader
                root.unmount();
                document.body.removeChild(loadingContainer);

                setIsCancelModalOpen(false);

                Swal.fire(
                    'Cancelled!',
                    'The appointment has been cancelled.',
                    'success'
                );
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            Swal.fire(
                'Error!',
                'Failed to cancel the appointment.',
                'error'
            );
        } finally {
            setIsCancelling(false);
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim()) return;

        try {
            // First fetch shop details to get the name
            const shopDoc = await getDoc(doc(db, 'barberShops', appointment.shopId));
            const shopName = shopDoc.exists() ? shopDoc.data().name : 'Shop Name';

            const messageData = {
                bookingId: appointment.id,
                content: message.trim(),
                senderId: appointment.userEmail,
                senderType: 'customer',
                shopId: appointment.shopId,
                customerId: appointment.userEmail,
                customerName: appointment.userName,
                shopName: shopName,
                timestamp: serverTimestamp(),
                read: false,
                appointmentDetails: {
                    date: appointment.selectedDate,
                    time: appointment.selectedTime,
                    services: appointment.selectedServices,
                    totalPrice: appointment.selectedServices.reduce(
                        (sum, service) => sum + parseFloat(service.price),
                        0
                    ).toFixed(2)
                }
            };

            const docRef = await addDoc(collection(db, 'messages'), messageData);
            console.log('MESSAGE SENT WITH ID:', docRef.id);

            // Force refresh messages
            const messagesRef = collection(db, 'messages');
            const q = query(
                messagesRef,
                where('bookingId', '==', appointment.id),
                orderBy('timestamp', 'asc')
            );

            const snapshot = await getDocs(q);
            const refreshedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            }));

            setMessages(refreshedMessages);
            setMessage('');

            // Force scroll
            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
            }, 100);

        } catch (error) {
            console.error('SEND MESSAGE ERROR:', error);
            alert('Failed to send message. Please try again.');
        }
    };

    const handleTyping = async () => {
        if (!appointment.id) return;

        try {
            const typingRef = doc(db, 'typing', appointment.id);

            // First check if document exists
            const typingDoc = await getDoc(typingRef);

            if (!typingDoc.exists()) {
                // Create the document if it doesn't exist
                await setDoc(typingRef, {
                    customer_typing: true,
                    shop_typing: false,
                    lastTypingUpdate: serverTimestamp(),
                    bookingId: appointment.id,
                    shopId: appointment.shopId,
                    customerId: appointment.userEmail
                });
            } else {
                // Update existing document
                await updateDoc(typingRef, {
                    customer_typing: true,
                    lastTypingUpdate: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error updating typing status:', error);
        }
    };

    useEffect(() => {
        return () => {
            // Cleanup typing status when component unmounts or chat closes
            if (appointment.id) {
                const typingRef = doc(db, 'typing', appointment.id);
                updateDoc(typingRef, {
                    customer_typing: false,
                    lastTypingUpdate: serverTimestamp()
                }).catch(error => {
                    // Ignore error if document doesn't exist during cleanup
                    if (error.code !== 'not-found') {
                        console.error('Error cleaning up typing status:', error);
                    }
                });
            }
        };
    }, [appointment.id]);

    const handleSubmitRating = async () => {
        try {
            // Validate required data
            if (!appointment?.id || !appointment?.shopId || !appointment?.userEmail) {
                throw new Error('Missing required appointment data');
            }

            if (!rating || rating < 1 || rating > 5) {
                throw new Error('Please select a rating');
            }

            if (!review.trim()) {
                throw new Error('Please write a review');
            }

            // Get shop details
            const shopRef = doc(db, 'barberShops', appointment.shopId);
            const shopDoc = await getDoc(shopRef);
            const shopData = shopDoc.exists() ? shopDoc.data() : null;

            if (!shopData) {
                throw new Error('Shop not found');
            }

            // Create rating document
            const ratingData = {
                shopId: appointment.shopId,
                userId: appointment.userEmail,
                userName: appointment.userName,
                bookingId: appointment.id,
                rating: Number(rating),
                review: review.trim(),
                services: appointment.selectedServices,
                appointmentDate: appointment.selectedDate,
                appointmentTime: appointment.selectedTime,
                totalAmount: appointment.selectedServices.reduce(
                    (sum, service) => sum + parseFloat(service.price),
                    0
                ).toFixed(2),
                createdAt: serverTimestamp(),
                status: 'active',
                helpful: 0,
                shopResponse: null,
                shopName: shopData.name
            };

            // Batch write to ensure atomicity
            const batch = writeBatch(db);

            // 1. Add rating document
            const ratingRef = doc(collection(db, 'ratings'));
            batch.set(ratingRef, ratingData);

            // 2. Update shop's rating statistics
            const currentRatings = shopData.ratings || [];
            currentRatings.push(rating);

            const averageRating = currentRatings.reduce((a, b) => a + b, 0) / currentRatings.length;
            const ratingCounts = currentRatings.reduce((acc, curr) => {
                acc[curr] = (acc[curr] || 0) + 1;
                return acc;
            }, {});

            batch.update(shopRef, {
                ratings: currentRatings,
                averageRating: parseFloat(averageRating.toFixed(1)),
                totalRatings: currentRatings.length,
                ratingDistribution: ratingCounts,
                lastRatedAt: serverTimestamp(),
                ratingIds: arrayUnion(ratingRef.id)
            });

            // 3. Update booking
            const bookingRef = doc(db, 'bookings', appointment.id);
            batch.update(bookingRef, {
                isRated: true,
                ratingId: ratingRef.id,
                ratingSubmittedAt: serverTimestamp(),
                rating: Number(rating),
                review: review.trim()
            });

            // Commit the batch
            await batch.commit();

            // Reset state
            setRating(0);
            setReview('');

            // Close the modal by unchecking the checkbox
            const modalCheckbox = document.getElementById(`rating-modal-${appointment.id}`);
            if (modalCheckbox) {
                modalCheckbox.checked = false;
            }

            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'Thank you for your rating!',
                showConfirmButton: false,
                timer: 1500
            });

            // Notify parent component AFTER successful submission
            if (onRate) {
                onRate(appointment.id, {
                    rating,
                    review,
                    ratingId: ratingRef.id,
                    success: true
                });
            }

        } catch (error) {
            console.error('Error submitting rating:', error);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: error.message || 'Failed to submit rating. Please try again.'
            });

            // Notify parent component of failure
            if (onRate) {
                onRate(appointment.id, {
                    rating,
                    review,
                    success: false,
                    error: error.message
                });
            }
        }
    };

    const handleReschedule = async (appointmentId, {newDate, newTime}) => {
        try {
            // Let the parent know about the reschedule
            await onReschedule(appointmentId, {newDate, newTime});

            // Update local state
            setNewDate('');
            setNewTime('');
            setIsRescheduleOpen(false);

        } catch (error) {
            console.error('Error in handleReschedule:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'There was an error rescheduling your appointment.',
            });
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed':
                return 'badge-success';
            case 'cancelled':
                return 'badge-error';
            case 'pending':
                return 'badge-warning';
            default:
                return 'badge-ghost';
        }
    };

    console.log("APPOINTMENT DATA:", {
        id: appointment.id,
        employee: {
            id: appointment.employeeId,
            name: appointment.employeeName
        },
        status: appointment.status
    });

    const ScissorsLoader = ({message}) => (
        <div className="scissors-loader">
            <div className="loader-content">
                <Scissors className="animate-scissor"/>
                <p>{message}</p>
            </div>
        </div>
    );


    return (
        <div className="relative p-1 rounded-2xl">
            <div
                className={`card bg-base-100 shadow-xl rounded-2xl h-full relative ${hasNewMessage ? 'card-new-message' : ''}`}>
                {hasNewMessage && (
                    <>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-content
                     px-4 py-1 rounded-full shadow-lg z-10 flex items-center gap-2 animate-bounce">
                            <span className="text-sm font-bold whitespace-nowrap">New message!</span>
                        </div>

                        <div className="absolute -top-2 -right-2 z-20">
                            <div className="notification-dot">
                                <div className="notification-ripple opacity-75"></div>
                            </div>
                        </div>
                    </>
                )}
                <div className="card-body relative">
                    {/* Status Badge */}
                    {/* Status and Employee Badges */}
                    <div className="absolute top-4 right-4 flex flex-wrap gap-2">
                        <div className={`badge ${getStatusColor(appointment.status)}`}>
                            {appointment.status}
                        </div>
                        {/* Nuclear debug version */}
                        <div className="badge badge-neutral badge-outline">
                            {appointment.employeeName || appointment.employeeId || 'No Stylist'}
                        </div>
                        {/* Show all employee-related fields for debugging */}
                        <div className="text-xs opacity-50 absolute top-full right-0 mt-1">
                            ID: {appointment.employeeId || 'none'}
                        </div>
                    </div>

                    {/* Shop Info */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="avatar">
                            <div className="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                <img
                                    src={appointment.shopImage || `/api/placeholder/64/64`}
                                    alt={appointment.shopName}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <h3 className="text-lg font-bold truncate">{appointment.shopName}</h3>
                            <MapLink address={appointment.shopAddress} />
                        </div>
                    </div>

                    {/* Appointment Details */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary"/>
                            <span>{new Date(appointment.selectedDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-[774px]:flex-col min-[1316px]:flex-row">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary"/>
                                <span>{appointment.selectedTime}</span>
                            </div>
                            {appointment.status !== 'cancelled' && (
                                <div className="ml-0 sm:ml-auto min-[774px]:ml-0 min-[1316px]:ml-auto">
                                    <CountdownTimer
                                        appointmentDate={appointment.selectedDate}
                                        appointmentTime={appointment.selectedTime}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Services */}
                    <div className="space-y-2">
                        <div className="text-sm font-semibold opacity-60">Services</div>
                        {appointment.selectedServices?.map((service, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <div className="flex-1">
                                    <span>{service.name}</span>
                                    <span className="text-sm text-base-content/60 ml-2">
                        ({service.duration || '30'} min)
                    </span>
                                </div>
                                <span className="font-medium">€{service.price}</span>
                            </div>
                        ))}
                        <div className="divider my-2"></div>
                        <div className="flex justify-between items-center font-bold">
                            <div className="flex flex-col text-sm">
                                <span>Total Price</span>
                                <span className="text-base-content/60">
                    Total Duration: {appointment.selectedServices?.reduce(
                                    (total, service) => total + (parseInt(service.duration) || 30), 0
                                )} min
                </span>
                            </div>
                            <span>
                €{appointment.selectedServices?.reduce(
                                (total, service) => total + parseFloat(service.price), 0
                            ).toFixed(2)}
            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="card-actions justify-end mt-4">
                        <label
                            htmlFor={`chat-modal-${appointment.id}`}
                            className={`btn btn-outline btn-sm relative ${hasNewMessage ? 'border-primary text-primary hover:bg-primary hover:text-primary-content' : ''}`}
                        >
                            <MessageCircle className={`w-4 h-4 mr-2 ${hasNewMessage ? 'animate-pulse' : ''}`}/>
                            Chat
                            {hasNewMessage && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full">
                    <span className="absolute inset-0 rounded-full bg-primary animate-ping"></span>
                </span>
                            )}
                        </label>
                        {appointment.status !== 'cancelled' && (
                            <>
                                {(() => {
                                    const now = new Date();
                                    const appointmentDateTime = new Date(
                                        appointment.selectedDate + 'T' + appointment.selectedTime
                                    );
                                    const isPast = appointmentDateTime < now;

                                    if (isPast) {
                                        // Show review button only for past appointments
                                        return appointment.isRated ? (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const ratingData = {
                                                            rating: appointment.rating,
                                                            review: appointment.review,
                                                            ratingSubmittedAt: appointment.ratingSubmittedAt
                                                        };

                                                        if (!ratingData.rating || !ratingData.review) {
                                                            const ratingDoc = await getDoc(doc(db, 'ratings', appointment.ratingId));
                                                            if (ratingDoc.exists()) {
                                                                const data = ratingDoc.data();
                                                                ratingData.rating = data.rating;
                                                                ratingData.review = data.review;
                                                                ratingData.ratingSubmittedAt = data.createdAt?.toDate();
                                                            }
                                                        }

                                                        Swal.fire({
                                                            title: 'Your Review',
                                                            html: `
                                        <div class="space-y-4">
                                            <div class="flex justify-center gap-1">
                                                ${Array(5).fill(0).map((_, i) =>
                                                                `<span class="${i < ratingData.rating ? 'text-warning' : 'text-base-300'} text-xl">★</span>`
                                                            ).join('')}
                                            </div>
                                            <div class="mt-4 text-left">
                                                <p class="text-sm text-base-content/70">Your review:</p>
                                                <p class="text-base mt-2">${ratingData.review}</p>
                                            </div>
                                            <div class="text-xs text-base-content/50 mt-2">
                                                Submitted on ${ratingData.ratingSubmittedAt ?
                                                                ratingData.ratingSubmittedAt.toLocaleDateString() :
                                                                new Date().toLocaleDateString()}
                                            </div>
                                        </div>
                                    `,
                                                            showConfirmButton: true,
                                                            confirmButtonText: 'Close',
                                                            customClass: {
                                                                container: 'review-modal'
                                                            }
                                                        });
                                                    } catch (error) {
                                                        console.error('Error fetching rating:', error);
                                                        Swal.fire({
                                                            icon: 'error',
                                                            title: 'Error',
                                                            text: 'Failed to load review data'
                                                        });
                                                    }
                                                }}
                                                className="btn btn-outline btn-sm gap-2"
                                            >
                                                <Star className="w-4 h-4 fill-warning text-warning"/>
                                                View Review
                                            </button>
                                        ) : (
                                            <label
                                                htmlFor={`rating-modal-${appointment.id}`}
                                                className="btn btn-outline btn-sm"
                                            >
                                                <Star className="w-4 h-4 mr-2"/>
                                                Rate
                                            </label>
                                        );
                                    } else {
                                        // Show reschedule and cancel only for future appointments
                                        return (
                                            <>
                                                <label
                                                    htmlFor={`reschedule-modal-${appointment.id}`}
                                                    className="btn btn-outline btn-sm"
                                                >
                                                    <Calendar className="w-4 h-4 mr-2"/>
                                                    Reschedule
                                                </label>
                                                <button
                                                    onClick={handleCancelAppointment}
                                                    className="btn btn-error btn-outline btn-sm gap-2"
                                                    disabled={isCancelling}
                                                >
                                                    <XCircle className="w-4 h-4"/>
                                                    {isCancelling ? 'Cancelling...' : 'Cancel'}
                                                </button>
                                            </>
                                        );
                                    }
                                })()}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Modal */}
            {/* Update the chat modal toggle */}
            <input
                type="checkbox"
                id={`chat-modal-${appointment.id}`}
                className="modal-toggle"
                checked={isChatOpen}
                onChange={(e) => {
                    setIsChatOpen(e.target.checked);
                    if (e.target.checked) {
                        console.log('Opening chat for appointment:', appointment.id);
                    }
                }}
            />
            <div className="modal">
                <div className="modal-box max-w-2xl">
                    {/* Appointment Info Header */}
                    <div className="bg-base-200 -mx-6 -mt-6 p-4 mb-4">
                        <h3 className="font-bold text-lg mb-2">Chat with {appointment.shopName}</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-base-content/60">Date:</span>
                                <br/>
                                {new Date(appointment.selectedDate).toLocaleDateString()}
                            </div>
                            <div>
                                <span className="text-base-content/60">Time:</span>
                                <br/>
                                {appointment.selectedTime}
                            </div>
                            <div>
                                <span className="text-base-content/60">Services:</span>
                                <br/>
                                {appointment.selectedServices.map(s =>
                                    `${s.name} (${s.duration || '30'}min)`
                                ).join(', ')}
                            </div>
                            <div>
                                <span className="text-base-content/60">Duration:</span>
                                <br/>
                                {appointment.selectedServices.reduce(
                                    (total, service) => total + (parseInt(service.duration) || 30), 0
                                )} min
                            </div>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="h-52 overflow-y-auto mb-4 p-4 bg-base-200/50 rounded-lg">
                        {messages.length === 0 ? (
                            <div className="text-center text-base-content/60 py-4">
                                No messages yet. Start the conversation!
                            </div>
                        ) : (
                            <>
                                {messages.map((msg) => {
                                    if (!msg) return null;

                                    console.log('Rendering message:', msg);

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'} mb-3`}
                                        >
                                            <div
                                                className={`max-w-[75%] break-words rounded-lg px-4 py-2 ${
                                                    msg.senderType === 'customer'
                                                        ? 'bg-primary text-primary-content'
                                                        : 'bg-base-200'
                                                }`}
                                            >
                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                                <div
                                                    className="flex items-center justify-end gap-1 mt-1 text-xs opacity-70">
                            <span>
                                {msg.timestamp ?
                                    msg.timestamp.toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }) : 'Just now'}
                            </span>
                                                    {msg.senderType === 'customer' && msg.read && (
                                                        <CheckCircle className="w-3 h-3"/>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef}/>
                            </>
                        )}
                    </div>

                    {/* Message Input */}
                    {/* At the top of your messages area */}
                    <div className="text-xs text-base-content/50 mb-2">
                        Messages loaded: {messages.length}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="input input-bordered flex-1"
                            value={message}
                            onChange={(e) => {
                                setMessage(e.target.value);
                                handleTyping();
                            }}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Type your message..."
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleSendMessage}
                            disabled={!message.trim()}
                        >
                            Send
                        </button>
                    </div>

                    <div className="modal-action">
                        <label htmlFor={`chat-modal-${appointment.id}`} className="btn">
                            Close
                        </label>
                    </div>
                </div>
            </div>

            {/* Rating Modal */}
            <input type="checkbox" id={`rating-modal-${appointment.id}`} className="modal-toggle"/>
            <div className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-lg mb-4">Rate your experience</h3>
                    <div className="space-y-4">
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`text-2xl ${star <= rating ? 'text-warning' : 'text-base-300'}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                        <textarea
                            className="textarea textarea-bordered w-full"
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            placeholder="Write your review..."
                            rows={4}
                        />
                        <div className="modal-action">
                            <button className="btn btn-primary" onClick={handleSubmitRating}>
                                Submit Rating
                            </button>
                            <label htmlFor={`rating-modal-${appointment.id}`} className="btn">Cancel</label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reschedule Modal */}
            <input
                type="checkbox"
                id={`reschedule-modal-${appointment.id}`}
                className="modal-toggle z-[99999]"
                checked={isRescheduleOpen}
                onChange={(e) => setIsRescheduleOpen(e.target.checked)}
            />
            <div className="modal modal-bottom sm:modal-middle z-[99999]">
                <div className="modal-box max-w-2xl p-0">
                    <AppointmentRescheduleModal
                        appointmentId={appointment.id}
                        shopId={appointment.shopId}
                        onReschedule={handleReschedule}
                        onClose={() => setIsRescheduleOpen(false)}
                        isOpen={isRescheduleOpen}
                    />
                </div>
            </div>
            <input
                type="checkbox"
                id={`cancel-modal-${appointment.id}`}
                className="modal-toggle"
                checked={isCancelModalOpen}
                onChange={(e) => setIsCancelModalOpen(e.target.checked)}
            />
            <div className="modal">
                <div className="modal-box">
                    <div className="flex items-center gap-3 mb-6">
                        <AlertTriangle className="w-6 h-6 text-error"/>
                        <h3 className="font-bold text-lg">Cancel Appointment</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-base-200 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-base-content/60">Date:</span>
                                    <p className="font-medium">
                                        {new Date(appointment.selectedDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-base-content/60">Time:</span>
                                    <p className="font-medium">{appointment.selectedTime}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-base-content/60">Services:</span>
                                    <p className="font-medium">
                                        {appointment.selectedServices.map(s => s.name).join(', ')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Cancellation Reason</span>
                            </label>
                            <textarea
                                className="textarea textarea-bordered h-24"
                                placeholder="Please provide a reason for cancellation..."
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="alert alert-warning">
                            <AlertTriangle className="w-5 h-5"/>
                            <span>This action cannot be undone.</span>
                        </div>
                    </div>

                    <div className="modal-action">
                        <button
                            className={`btn btn-error ${isCancelling ? 'loading' : ''}`}
                            onClick={handleCancelAppointment}
                            disabled={isCancelling || !cancellationReason.trim()}
                        >
                            {isCancelling ? 'Cancelling...' : 'Cancel Appointment'}
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={() => setIsCancelModalOpen(false)}
                            disabled={isCancelling}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppointmentCard;