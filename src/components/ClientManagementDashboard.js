import React, {useEffect, useMemo, useState} from 'react';
import {collection, doc, getDocs, orderBy, query, updateDoc, where} from 'firebase/firestore';
import {auth, db} from '../firebase';
import {AlertCircle, ArrowDown, ArrowUp, CheckCircle, Eye, FileText, Scissors, Search, X, XCircle} from 'lucide-react';
import {motion} from 'framer-motion';
import EditAppointmentModal from './EditAppointmentModal';
import {getAvailableTimeSlots, updateBooking} from '../utils/bookingFunctions';
import Swal from 'sweetalert2';
import AnalyticsDashboard from "./AnalyticsDashboard";
import {onAuthStateChanged} from "firebase/auth";
import InvoiceDialog from "./InvoiceDialog";
import FooterPages from "./FooterPages";

// import * as dateMap from "date-fns";
import './ScissorsLoader.css';
import {createRoot} from 'react-dom/client';

export default function ClientManagementDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDateRange, setSelectedDateRange] = useState('week');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [currentShop, setCurrentShop] = useState(null);
    const [editingAppointment, setEditingAppointment] = useState(null);
    const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showingInvoice, setShowingInvoice] = useState(null);

    useEffect(() => {
        console.log('Setting up auth listener');
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            console.log('Auth state changed:', currentUser?.uid);
            if (currentUser) {
                try {
                    // Get the shop for this user
                    const shopsRef = collection(db, 'barberShops');
                    const q = query(shopsRef, where('ownerId', '==', currentUser.uid));
                    const shopSnapshot = await getDocs(q);

                    console.log('Found shops:', shopSnapshot.size);

                    if (!shopSnapshot.empty) {
                        const shopDoc = shopSnapshot.docs[0];
                        const userShopId = shopDoc.id;
                        setCurrentShop({id: userShopId, ...shopDoc.data()}); // Add this line
                        console.log('User shop ID:', userShopId);

                        // Get bookings for this shop
                        const bookingsRef = collection(db, 'bookings');
                        const bookingsQuery = query(
                            bookingsRef,
                            where('shopId', '==', userShopId),
                            orderBy('createdAt', 'desc')
                        );

                        // In ClientManagementDashboard after fetching bookings
                        const bookingsSnapshot = await getDocs(bookingsQuery);
                        const fetchedBookings = bookingsSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        console.log('RAW FETCHED BOOKINGS:', fetchedBookings); // Add this

                        console.log('Fetched bookings:', fetchedBookings);
                        setBookings(fetchedBookings);
                    } else {
                        console.log('No shops found for user');
                        setBookings([]);
                    }
                } catch (error) {
                    console.error('Error fetching data:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                console.log('No authenticated user');
                setBookings([]);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // const processBookingsData = (bookings, selectedDateRange) => {
    //     // Create date boundaries based on selected range
    //     const now = new Date();
    //     let startDate = new Date();
    //
    //     switch (selectedDateRange) {
    //         case 'week':
    //             startDate.setDate(now.getDate() - 7);
    //             break;
    //         case 'month':
    //             startDate.setMonth(now.getMonth() - 1);
    //             break;
    //         case 'year':
    //             startDate.setFullYear(now.getFullYear() - 1);
    //             break;
    //         default:
    //             startDate.setDate(now.getDate() - 7);
    //     }
    //
    //     // Create a map to store daily data
    //     const dailyData = new Map();  // CHANGE: Use dailyData consistently
    //
    //     // Initialize days in the range
    //     let currentDate = new Date(startDate);
    //     while (currentDate <= now) {
    //         const dateKey = currentDate.toISOString().split('T')[0];
    //         dailyData.set(dateKey, {  // CHANGE: Use dailyData instead of dateMap
    //             name: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    //             Completed: 0,
    //             Cancelled: 0,
    //             Pending: 0,
    //             Revenue: 0,
    //             Total: 0
    //         });
    //         currentDate.setDate(currentDate.getDate() + 1);
    //     }
    //
    //     // Process each booking
    //     bookings.forEach(booking => {
    //         console.log('Processing booking:', booking);
    //         const bookingDate = booking.selectedDate;
    //
    //         if (dailyData.has(bookingDate)) {  // CHANGE: Use dailyData instead of dateMap
    //             const dayData = dailyData.get(bookingDate);  // CHANGE: Use dailyData
    //
    //             // Update status counts based on all possible status values
    //             if (booking.status === 'completed' || booking.status === 'confirmed') {
    //                 dayData.Completed++;
    //             } else if (booking.status === 'cancelled' || booking.cancellationReason) {
    //                 dayData.Cancelled++;
    //             } else if (booking.status === 'rescheduled') {
    //                 dayData.Pending++;
    //             } else {
    //                 dayData.Pending++;
    //             }
    //
    //             // Update total bookings
    //             dayData.Total++;
    //
    //             // Calculate revenue if we have services and booking isn't cancelled
    //             if (booking.selectedServices && !booking.cancellationReason && booking.status !== 'cancelled') {
    //                 const revenue = booking.selectedServices.reduce((sum, service) =>
    //                     sum + (parseFloat(service.price) || 0), 0);
    //                 console.log(`Adding revenue for ${bookingDate}:`, revenue);
    //                 dayData.Revenue += revenue;
    //             }
    //
    //             dailyData.set(bookingDate, dayData);  // CHANGE: Use dailyData
    //             console.log(`Updated data for ${bookingDate}:`, dayData);
    //         }
    //     });
    //
    //     // Convert map to array and sort by date
    //     const processedData = Array.from(dailyData.values());  // CHANGE: Use dailyData
    //     console.log('Final processed data:', processedData);
    //     return processedData;
    // };

    // Stats calculations
    // Update these sections in your ClientManagementDashboard component

// Stats calculations
    const stats = useMemo(() => {
        if (!bookings.length) return null;

        // Get current date
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Get previous month's data
        const prevMonth = currentMonth - 1 < 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth - 1 < 0 ? currentYear - 1 : currentYear;

        // Filter bookings for current and previous month
        const currentMonthBookings = bookings.filter(b => {
            const date = new Date(b.selectedDate);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const prevMonthBookings = bookings.filter(b => {
            const date = new Date(b.selectedDate);
            return date.getMonth() === prevMonth && date.getFullYear() === prevYear;
        });

        // Calculate stats
        const total = currentMonthBookings.length;
        const prevTotal = prevMonthBookings.length;
        const completed = currentMonthBookings.filter(b => b.status === 'completed').length;
        const prevCompleted = prevMonthBookings.filter(b => b.status === 'completed').length;
        const cancelled = currentMonthBookings.filter(b => b.status === 'cancelled').length;
        const prevCancelled = prevMonthBookings.filter(b => b.status === 'cancelled').length;

        // Calculate revenue
        const totalRevenue = currentMonthBookings
            .filter(b => b.status === 'completed')
            .reduce((sum, b) => {
                const serviceTotal = b.selectedServices?.reduce((total, service) =>
                    total + (parseFloat(service.price) || 0), 0) || 0;
                return sum + serviceTotal;
            }, 0);

        const prevRevenue = prevMonthBookings
            .filter(b => b.status === 'completed')
            .reduce((sum, b) => {
                const serviceTotal = b.selectedServices?.reduce((total, service) =>
                    total + (parseFloat(service.price) || 0), 0) || 0;
                return sum + serviceTotal;
            }, 0);

        // Calculate growth percentages
        const bookingsGrowth = prevTotal === 0 ? 100 : ((total - prevTotal) / prevTotal) * 100;
        const completedGrowth = prevCompleted === 0 ? 100 : ((completed - prevCompleted) / prevCompleted) * 100;
        const cancelledGrowth = prevCancelled === 0 ? 0 : ((cancelled - prevCancelled) / prevCancelled) * 100;
        const revenueGrowth = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100;

        return {
            totalBookings: total,
            completedBookings: completed,
            cancelledBookings: cancelled,
            revenue: totalRevenue,
            bookingsGrowth: Math.round(bookingsGrowth),
            completedGrowth: Math.round(completedGrowth),
            cancelledGrowth: Math.round(cancelledGrowth),
            revenueGrowth: Math.round(revenueGrowth)
        };
    }, [bookings]);

// // Chart data preparation
//     const chartData = useMemo(() =>
//             processBookingsData(bookings, selectedDateRange),  // FIXED - matches the function name above
//         [bookings, selectedDateRange]
//     );;

    // Add this function to handle edit button click
    const handleEditClick = async (appointment) => {
        try {
            setLoading(true);
            if (!appointment.shopId) {
                throw new Error('No shop ID found for this booking');
            }

            // Fetch available time slots for the appointment date
            const slots = await getAvailableTimeSlots(
                appointment.shopId,
                new Date(appointment.selectedDate)
            );

            // Include the current appointment time if not already present
            if (!slots.includes(appointment.selectedTime)) {
                slots.push(appointment.selectedTime);
                slots.sort();
            }

            setAvailableTimeSlots(slots);
            setEditingAppointment(appointment);
        } catch (error) {
            console.error('Error fetching time slots:', error);
            // Still show the modal but with default time slots
            setAvailableTimeSlots([
                "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
                "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
                "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
            ]);
            setEditingAppointment(appointment);

            Swal.fire({
                title: 'Warning',
                text: 'Could not fetch shop hours. Using default time slots.',
                icon: 'warning',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } finally {
            setLoading(false);
        }
    };

// Add this function to handle appointment updates
    const handleAppointmentUpdate = async (updatedAppointment) => {
        try {
            await updateBooking(updatedAppointment.id, updatedAppointment);
            // Update the appointments list
            setBookings(bookings.map(booking =>
                booking.id === updatedAppointment.id ? updatedAppointment : booking
            ));
            setEditingAppointment(null);
        } catch (error) {
            console.error('Error updating appointment:', error);
        }
    };


    // Featured stat card component
    const StatCard = ({icon: Icon, title, value, change, changeType}) => (
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            className="card bg-base-100 shadow-xl"
        >
            <div className="card-body">
                <div className="flex items-center justify-between">
                    <div className="bg-primary/10 p-3 rounded-lg">
                        <Icon className="w-6 h-6 text-primary"/>
                    </div>
                    {change && (
                        <div className={`flex items-center gap-1 text-sm ${
                            changeType === 'increase' ? 'text-success' : 'text-error'
                        }`}>
                            {changeType === 'increase' ? <ArrowUp className="w-4 h-4"/> :
                                <ArrowDown className="w-4 h-4"/>}
                            {change}%
                        </div>
                    )}
                </div>
                <div className="mt-4">
                    <p className="text-sm text-base-content/60">{title}</p>
                    <h3 className="text-2xl font-bold mt-1">{value}</h3>
                </div>
            </div>
        </motion.div>
    );

    // Search and filter functions
    const filteredBookings = useMemo(() => {
        return bookings.filter(booking => {
            const matchesSearch =
                (booking.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    booking.userEmail?.toLowerCase().includes(searchQuery.toLowerCase())) ?? false;

            const matchesStatus =
                filterStatus === 'all' || booking.status === filterStatus;

            return matchesSearch && matchesStatus;
        });
    }, [bookings, searchQuery, filterStatus]);

    const paginatedBookings = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredBookings.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredBookings, currentPage]);

    const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterStatus]);

// View details modal
    const [viewingBooking, setViewingBooking] = useState(null);

// Booking cancellation
    const handleCancelBooking = async (booking) => {
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
                setLoading(true);

                // Add scissors loader
                const loadingContainer = document.createElement('div');
                document.body.appendChild(loadingContainer);
                const root = createRoot(loadingContainer);
                root.render(<ScissorsLoader message="Cancelling appointment..."/>);

                // Add this new code to update bookedTimeSlots
                const timeSlotQuery = query(
                    collection(db, 'bookedTimeSlots'),
                    where('shopId', '==', booking.shopId),
                    where('date', '==', booking.selectedDate),
                    where('time', '==', booking.selectedTime),
                    where('bookingId', '==', booking.id)
                );

                const timeSlotSnapshot = await getDocs(timeSlotQuery);
                if (!timeSlotSnapshot.empty) {
                    const timeSlotDoc = timeSlotSnapshot.docs[0];
                    await updateDoc(doc(db, 'bookedTimeSlots', timeSlotDoc.id), {
                        status: 'cancelled'
                    });
                }

                // Existing code continues unchanged
                await fetch(`${process.env.REACT_APP_CLOUD_FUNCTIONS_URL}/cancelBooking`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        bookingId: booking.id,
                        reason: result.value,
                        userEmail: booking.userEmail,
                        userName: booking.userName,
                        selectedDate: booking.selectedDate,
                        selectedTime: booking.selectedTime,
                        shopEmail: booking.shopEmail
                    }),
                });

                // Update local state
                setBookings(bookings.map(b =>
                    b.id === booking.id
                        ? {...b, status: 'cancelled', cancellationReason: result.value}
                        : b
                ));

                // Cleanup scissors loader
                root.unmount();
                document.body.removeChild(loadingContainer);

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
            setLoading(false);
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

// Viewing details modal component
    const ViewBookingModal = ({booking, isOpen, onClose}) => {
        if (!booking) return null;

        return (
            <dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
                <div className="modal-box">
                    <h3 className="font-bold text-lg mb-4">Booking Details</h3>

                    <div className="space-y-4">
                        {/* Client Info */}
                        <div className="flex items-center gap-4">
                            <div className="avatar">
                                <div className="w-16 h-16 rounded-full">
                                    <img
                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.userName}`}
                                        alt="Avatar"
                                    />
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold">{booking.userName}</h4>
                                <p className="text-sm text-base-content/60">{booking.userEmail}</p>
                                <p className="text-sm text-base-content/60">{booking.userPhone || 'No phone provided'}</p>
                            </div>
                        </div>

                        {/* Booking Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="card bg-base-200">
                                <div className="card-body p-4">
                                    <h3 className="card-title text-sm">Date & Time</h3>
                                    <p>{new Date(booking.selectedDate).toLocaleDateString()}</p>
                                    <p>{booking.selectedTime}</p>
                                </div>
                            </div>
                            <div className="card bg-base-200">
                                <div className="card-body p-4">
                                    <h3 className="card-title text-sm">Status</h3>
                                    <div className={`badge ${
                                        booking.status === 'confirmed' ? 'badge-success' :
                                            booking.status === 'cancelled' ? 'badge-error' :
                                                'badge-warning'
                                    }`}>
                                        {booking.status}
                                    </div>

                                    {booking.employeeName && (
                                        <div className="badge badge-outline badge-neutral">
                                            {booking.employeeName}
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>

                        {/* Services */}
                        <div className="card bg-base-200">
                            <div className="card-body p-4">
                                <h3 className="card-title text-sm mb-2">Services</h3>
                                <div className="space-y-2">
                                    {booking.selectedServices ? (
                                        <>
                                            {booking.selectedServices.map((service, index) => (
                                                <div key={index} className="flex justify-between">
                                                    <span>{service.name}</span>
                                                    <span>€{service.price}</span>
                                                </div>
                                            ))}
                                            <div className="divider my-2"></div>
                                            <div className="flex justify-between font-bold">
                                                <span>Total</span>
                                                <span>
                            €{booking.selectedServices.reduce((total, service) =>
                                                    total + (parseFloat(service.price) || 0), 0).toFixed(2)}
                        </span>
                                            </div>
                                        </>
                                    ) : (
                                        <div>No services selected</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {booking.cancellationReason && (
                            <div className="card bg-error/10">
                                <div className="card-body p-4">
                                    <h3 className="card-title text-sm text-error">Cancellation Reason</h3>
                                    <p className="text-error">{booking.cancellationReason}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-action">
                        <button className="btn" onClick={onClose}>Close</button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button onClick={onClose}>close</button>
                </form>
            </dialog>
        );
    };

    return (
        <>
            <div className="min-h-screen bg-base-200 p-4 lg:p-8">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Client Management</h1>
                        <p className="text-base-content/60 mt-1">Manage your bookings and client relationships</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="join">
                            <button
                                className={`join-item btn btn-sm ${selectedDateRange === 'week' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setSelectedDateRange('week')}
                            >
                                Week
                            </button>
                            <button
                                className={`join-item btn btn-sm ${selectedDateRange === 'month' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setSelectedDateRange('month')}
                            >
                                Month
                            </button>
                            <button
                                className={`join-item btn btn-sm ${selectedDateRange === 'year' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setSelectedDateRange('year')}
                            >
                                Year
                            </button>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <AnalyticsDashboard
                    stats={stats}
                    chartData={bookings.filter(booking => booking.selectedDate)}
                    selectedDateRange={selectedDateRange}
                    onRangeChange={setSelectedDateRange}  // Add this
                />

                {/* Bookings Table Section */}
                <div className="card mt-14 bg-base-100 shadow-xl">
                    <div className="card-body">
                        <div
                            className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                            <h3 className="card-title">Recent Bookings</h3>

                            <div className="flex flex-wrap gap-2">
                                <div className="join">
                                    <div className="join-item">
                                        <div className="form-control relative">
                                            <Search
                                                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/60"/>
                                            <input
                                                type="text"
                                                placeholder="Search bookings..."
                                                className="input input-bordered input-sm pl-9 w-full max-w-xs"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <select
                                        className="select select-bordered select-sm join-item"
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {/* Desktop View */}
                            <table className="table table-zebra hidden md:table">
                                <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>Service</th>
                                    <th>Date & Time</th>
                                    <th>Price</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {/* Your existing desktop table rows */}
                                {paginatedBookings.map((booking, index) => (
                                    <motion.tr
                                        key={booking.id}
                                        initial={{opacity: 0, y: 20}}
                                        animate={{opacity: 1, y: 0}}
                                        transition={{delay: index * 0.1}}
                                    >
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="avatar">
                                                    <div className="w-12 h-12 rounded-full">
                                                        <img
                                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.userName}`}
                                                            alt="Avatar"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="font-bold">{booking.userName}</div>
                                                    <div
                                                        className="text-sm text-base-content/60">{booking.userEmail}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="font-medium">
                                                {booking.selectedServices ?
                                                    booking.selectedServices.map(service =>
                                                        `${service.name} (${service.duration || 30}min)`
                                                    ).join(', ')
                                                    : 'No services'
                                                }
                                            </div>
                                            <div className="text-sm text-base-content/60">
                                                Total: {booking.selectedServices ?
                                                `${booking.selectedServices.reduce((total, service) =>
                                                    total + (parseInt(service.duration) || 30), 0)} min`
                                                : '0 min'
                                            }
                                            </div>
                                        </td>
                                        <td>
                                            <div className="font-medium">
                                                {new Date(booking.selectedDate).toLocaleDateString()}
                                            </div>
                                            <div className="text-sm text-base-content/60">{booking.selectedTime}</div>
                                        </td>
                                        <td>
                                            <div className="font-medium">
                                                €{booking.selectedServices ?
                                                booking.selectedServices.reduce((total, service) =>
                                                    total + (parseFloat(service.price) || 0), 0).toFixed(2)
                                                : '0.00'
                                            }
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`badge ${
                                                booking.status === 'confirmed' ? 'badge-success' :
                                                    booking.status === 'cancelled' ? 'badge-error' :
                                                        'badge-warning'
                                            } gap-1`}>
                                                {booking.status === 'confirmed' && <CheckCircle className="w-3 h-3"/>}
                                                {booking.status === 'cancelled' && <XCircle className="w-3 h-3"/>}
                                                {booking.status === 'pending' && <AlertCircle className="w-3 h-3"/>}
                                                {booking.status}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="join">
                                                {booking.status !== 'cancelled' && (  // Add this condition
                                                    <button
                                                        className="btn btn-sm btn-ghost join-item"
                                                        onClick={() => {
                                                            console.log('Opening invoice for booking:', booking);
                                                            console.log('Current shop details:', currentShop);
                                                            setShowingInvoice(booking);
                                                        }}
                                                    >
                                                        <FileText className="w-4 h-4"/>
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-sm btn-ghost join-item"
                                                    onClick={() => setViewingBooking(booking)}
                                                >
                                                    <Eye className="w-4 h-4"/>
                                                </button>
                                                {booking.status !== 'cancelled' && (
                                                    <button
                                                        className="btn btn-sm btn-ghost text-error join-item"
                                                        onClick={() => handleCancelBooking(booking)}
                                                    >
                                                        <X className="w-4 h-4"/>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}

                                </tbody>
                            </table>
                            {/* Mobile View */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {paginatedBookings.map((booking, index) => (
                                    <motion.div
                                        key={booking.id}
                                        initial={{opacity: 0, y: 20}}
                                        animate={{opacity: 1, y: 0}}
                                        transition={{delay: index * 0.1}}
                                        className="card bg-base-200 shadow-sm"
                                    >
                                        <div className="card-body p-4 space-y-4">
                                            {/* Client Info */}
                                            <div className="flex items-center gap-3">
                                                <div className="avatar">
                                                    <div className="w-12 h-12 rounded-full">
                                                        <img
                                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.userName}`}
                                                            alt="Avatar"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="font-bold">{booking.userName}</div>
                                                    <div
                                                        className="text-sm text-base-content/60">{booking.userEmail}</div>
                                                </div>
                                            </div>

                                            {/* Service Info */}
                                            <div className="divider my-0"></div>
                                            <div>
                                                <div className="text-sm font-semibold text-base-content/60">Services
                                                </div>
                                                <div className="font-medium">
                                                    {booking.selectedServices ?
                                                        booking.selectedServices.map(service =>
                                                            `${service.name} (${service.duration || 30}min)`
                                                        ).join(', ')
                                                        : 'No services'
                                                    }
                                                </div>
                                                <div className="text-sm text-base-content/60">
                                                    Total: {booking.selectedServices ?
                                                    `${booking.selectedServices.reduce((total, service) =>
                                                        total + (parseInt(service.duration) || 30), 0)} min`
                                                    : '0 min'
                                                }
                                                </div>
                                            </div>

                                            {/* Date and Price */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-sm font-semibold text-base-content/60">Date &
                                                        Time
                                                    </div>
                                                    <div className="font-medium">
                                                        {new Date(booking.selectedDate).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-sm text-base-content/60">
                                                        {booking.selectedTime}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-base-content/60">Price
                                                    </div>
                                                    <div className="font-medium">
                                                        €{booking.selectedServices ?
                                                        booking.selectedServices.reduce((total, service) =>
                                                            total + (parseFloat(service.price) || 0), 0).toFixed(2)
                                                        : '0.00'
                                                    }
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status and Actions */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`badge ${
                                                        booking.status === 'confirmed' ? 'badge-success' :
                                                            booking.status === 'cancelled' ? 'badge-error' :
                                                                'badge-warning'
                                                    } gap-1`}>
                                                        {booking.status === 'confirmed' &&
                                                            <CheckCircle className="w-3 h-3"/>}
                                                        {booking.status === 'cancelled' &&
                                                            <XCircle className="w-3 h-3"/>}
                                                        {booking.status === 'pending' &&
                                                            <AlertCircle className="w-3 h-3"/>}
                                                        {booking.status}
                                                    </div>

                                                    {booking.employeeName && (
                                                        <div className="badge badge-outline badge-neutral">
                                                            {booking.employeeName}
                                                        </div>
                                                    )}

                                                    <div className="join">
                                                        <button
                                                            className="btn btn-sm btn-ghost join-item"
                                                            onClick={() => {
                                                                console.log('Opening invoice for booking:', booking);
                                                                console.log('Current shop details:', currentShop);
                                                                setShowingInvoice(booking);
                                                            }}
                                                        >
                                                            <FileText className="w-4 h-4"/>
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-ghost join-item"
                                                            onClick={() => setViewingBooking(booking)}
                                                        >
                                                            <Eye className="w-4 h-4"/>
                                                        </button>
                                                        {booking.status !== 'cancelled' && (
                                                            <button
                                                                className="btn btn-sm btn-ghost text-error join-item"
                                                                onClick={() => handleCancelBooking(booking)}
                                                            >
                                                                <X className="w-4 h-4"/>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-4">
                            <div className="text-sm text-base-content/60">
                                Showing {filteredBookings.length ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                                {Math.min(currentPage * itemsPerPage, filteredBookings.length)} of {filteredBookings.length} bookings
                            </div>
                            <div className="join">
                                <button
                                    className="join-item btn btn-sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    «
                                </button>
                                {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        className={`join-item btn btn-sm ${currentPage === page ? 'btn-active' : ''}`}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    className="join-item btn btn-sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    »
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <ViewBookingModal
                    booking={viewingBooking}
                    isOpen={viewingBooking !== null}
                    onClose={() => setViewingBooking(null)}
                />

                <EditAppointmentModal
                    isOpen={editingAppointment !== null}
                    onClose={() => setEditingAppointment(null)}
                    appointment={editingAppointment}
                    onSave={handleAppointmentUpdate}
                    availableTimeSlots={availableTimeSlots}
                />

                <InvoiceDialog
                    isOpen={showingInvoice !== null}
                    onClose={() => {
                        console.log('Closing invoice dialog');
                        setShowingInvoice(null);
                    }}
                    booking={showingInvoice}
                    shopDetails={currentShop}
                />
            </div>

            <FooterPages/>
        </>
    );
}