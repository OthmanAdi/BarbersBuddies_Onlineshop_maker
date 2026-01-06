import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, addWeeks, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const ViewOptions = {
    HOURS: 'hours',
    DAYS: 'days',
    WEEKS: 'weeks',
    MONTHS: 'months'
};

const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 21; hour++) {
        for (let minutes = 0; minutes < 60; minutes += 15) {
            slots.push(`${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        }
    }
    return slots;
};

const roundToNearestSlot = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const roundedMinutes = Math.round(minutes / 15) * 15;
    return `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
};

const TimeSlotView = ({ appointments, selectedDate }) => (
    <div className="grid grid-cols-1 gap-2 py-4">
        {generateTimeSlots().map((time) => (
            <motion.div
                key={time}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="relative"
            >
                <div className="sticky top-0 bg-gradient-to-r from-indigo-500/10 to-transparent p-2 rounded-l-lg">
                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{time}</span>
                </div>
                <div className="ml-16 space-y-2">
                    <AnimatePresence>
                    {appointments
    .filter(app => roundToNearestSlot(app.selectedTime) === time && 
           isSameDay(new Date(app.selectedDate), selectedDate))
    .map(appointment => (
        <AppointmentCard 
            key={appointment.id} 
            appointment={appointment} 
        />
    ))}
                    </AnimatePresence>
                </div>
            </motion.div>
        ))}
    </div>
);

const DayView = ({ appointments, selectedDate }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        <AnimatePresence>
            {appointments
                .filter(app => isSameDay(new Date(app.selectedDate), selectedDate))
                .map(appointment => (
                    <AppointmentCard key={appointment.id} appointment={appointment} expanded />
                ))}
        </AnimatePresence>
    </div>
);

const WeekView = ({ appointments, selectedDate }) => {
    const start = startOfWeek(selectedDate);
    const end = endOfWeek(selectedDate);
    const days = eachDayOfInterval({ start, end });

    return (
        <div className="grid grid-cols-7 gap-2 p-4">
            {days.map(day => (
                <div key={day.toString()} className="min-h-[200px]">
                    <div className="sticky top-0 bg-white dark:bg-gray-800 p-2 text-center border-b">
                        <span className="text-sm font-medium">
                            {format(day, 'EEE d')}
                        </span>
                    </div>
                    <div className="space-y-2 p-1">
                        <AnimatePresence>
                            {appointments
                                .filter(app => isSameDay(new Date(app.selectedDate), day))
                                .map(appointment => (
                                    <AppointmentCard
                                        key={appointment.id}
                                        appointment={appointment}
                                        compact
                                    />
                                ))}
                        </AnimatePresence>
                    </div>
                </div>
            ))}
        </div>
    );
};

const MonthView = ({ appointments, selectedDate }) => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start, end });

    return (
        <div className="grid grid-cols-7 gap-1 p-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center p-2 text-sm font-medium text-gray-500">
                    {day}
                </div>
            ))}
            {days.map(day => (
                <motion.div
                    key={day.toString()}
                    whileHover={{ scale: 1.02 }}
                    className="min-h-[100px] border rounded-lg p-1 relative"
                >
                    <span className="text-sm font-medium">{format(day, 'd')}</span>
                    <div className="space-y-1 mt-1 max-h-[80px] overflow-y-auto">
                        {appointments
                            .filter(app => isSameDay(new Date(app.selectedDate), day))
                            .map(appointment => (
                                <motion.div
                                    key={appointment.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-xs p-1 rounded bg-gradient-to-r from-blue-500/10 to-purple-500/10 truncate"
                                >
                                    {appointment.selectedTime} - {appointment.userName}
                                </motion.div>
                            ))}
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

const AppointmentCard = ({ appointment, compact = false, expanded = false }) => {
    const variants = {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.95, opacity: 0 },
        hover: { scale: 1.02 }
    };

    // Calculate total cost from selectedServices
    const totalCost = appointment.selectedServices?.reduce((sum, service) =>
        sum + (parseFloat(service.price) || 0), 0) || 0;

    // Get the first service name for display
    const primaryService = appointment.selectedServices?.[0]?.name || 'No service';

    // Calculate total duration
    const totalDuration = appointment.selectedServices?.reduce((sum, service) =>
        sum + (parseInt(service.duration) || 0), 0) || 0;

    return (
        <motion.div
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            whileHover="hover"
            className={`rounded-lg p-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border backdrop-blur-sm
                ${compact ? 'text-sm' : ''} ${expanded ? 'p-4' : ''}`}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                        {appointment.userName.charAt(0)}
                    </div>
                    <div>
                        <h4 className="font-medium truncate">{appointment.userName}</h4>
                        {!compact && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {primaryService}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        €{totalCost}
                    </span>
                </div>
            </div>

            {expanded && (
                <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p>With: {appointment.employeeName || 'Any Available'}</p>
                    <p>Duration: {totalDuration} min</p>
                    <div className="flex items-center justify-between mt-2">
                        <span>{appointment.selectedTime}</span>
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                            {appointment.status || 'pending'}
                        </span>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

const Calendar = ({ selectedDate, onSelect }) => {
    const today = new Date();
    const daysInMonth = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate)
    });
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = startOfMonth(selectedDate).getDay();
    const endDay = 6 - endOfMonth(selectedDate).getDay();

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-base-300 p-4 min-w-[320px]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onSelect(addMonths(selectedDate, -1))}
                        className="btn btn-ghost btn-sm btn-circle"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onSelect(today)}
                        className="btn btn-ghost btn-xs"
                    >
                        Today
                    </motion.button>
                </div>
                <span className="text-lg font-semibold">{format(selectedDate, 'MMMM yyyy')}</span>
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onSelect(addMonths(selectedDate, 1))}
                    className="btn btn-ghost btn-sm btn-circle"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </motion.button>
            </div>

            <div className="grid grid-cols-7 gap-1">
                {daysOfWeek.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                        {day}
                    </div>
                ))}

                {Array(startDay).fill(null).map((_, index) => (
                    <div key={`empty-start-${index}`} className="aspect-square" />
                ))}

                {daysInMonth.map(day => (
                    <motion.button
                        key={day.toString()}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onSelect(day)}
                        className={`aspect-square rounded-lg flex items-center justify-center text-sm transition-colors
                            ${isSameDay(day, selectedDate)
                            ? 'bg-primary text-white'
                            : isSameDay(day, today)
                                ? 'bg-primary/20'
                                : 'hover:bg-base-200'}`}
                    >
                        {format(day, 'd')}
                    </motion.button>
                ))}

                {Array(endDay).fill(null).map((_, index) => (
                    <div key={`empty-end-${index}`} className="aspect-square" />
                ))}
            </div>
        </div>
    );
};

const AgendaNavigation = ({ selectedDate, onDateChange, view }) => {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const today = new Date();

    const handlePrevious = () => {
        switch (view) {
            case ViewOptions.MONTHS:
                onDateChange(addMonths(selectedDate, -1));
                break;
            case ViewOptions.WEEKS:
                onDateChange(addWeeks(selectedDate, -1));
                break;
            default:
                onDateChange(addDays(selectedDate, -1));
        }
    };

    const handleNext = () => {
        switch (view) {
            case ViewOptions.MONTHS:
                onDateChange(addMonths(selectedDate, 1));
                break;
            case ViewOptions.WEEKS:
                onDateChange(addWeeks(selectedDate, 1));
                break;
            default:
                onDateChange(addDays(selectedDate, 1));
        }
    };

    return (
        <div className="flex items-center p-4">
            <div className="flex items-center space-x-4">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePrevious}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </motion.button>

                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onDateChange(today)}
                    className="px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                    Today
                </motion.button>

                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNext}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </motion.button>
            </div>

            <div className="flex-1 text-center relative">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                    className="text-lg font-semibold hover:text-primary cursor-pointer transition-colors relative group"
                >
                    <span className="group-hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors">
                        {format(selectedDate, view === ViewOptions.MONTHS ? 'MMMM yyyy' : 'MMMM d, yyyy')}
                    </span>
                </motion.button>

                <AnimatePresence>
                    {isCalendarOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsCalendarOpen(false)}
                                className="fixed inset-0 z-40"
                            />
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ type: "spring", damping: 20 }}
                                className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50"
                            >
                                <div className="relative">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setIsCalendarOpen(false)}
                                        className="absolute -top-2 -right-2 btn btn-circle btn-ghost btn-sm z-10"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </motion.button>
                                    <Calendar
                                        selectedDate={selectedDate}
                                        onSelect={onDateChange}
                                    />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const ViewToggle = ({ view, onViewChange }) => (
    <div className="flex space-x-2 p-4">
        {Object.values(ViewOptions).map((viewOption) => (
            <motion.button
                key={viewOption}
                whileTap={{ scale: 0.95 }}
                onClick={() => onViewChange(viewOption)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${view === viewOption
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
            >
                {viewOption.charAt(0).toUpperCase() + viewOption.slice(1)}
            </motion.button>
        ))}
    </div>
);

const CustomAgenda = ({ user }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState(ViewOptions.HOURS);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAppointments = async () => {
            if (!user) return;

            try {
                setLoading(true);

                // First get all shops owned by the user
                const shopsRef = collection(db, 'barberShops');
                const shopsQuery = query(shopsRef, where('ownerId', '==', user.uid));
                const shopsSnapshot = await getDocs(shopsQuery);

                if (shopsSnapshot.empty) {
                    console.log('No shops found for user');
                    setAppointments([]);
                    return;
                }

                // Get all shop IDs
                const shopIds = shopsSnapshot.docs.map(doc => doc.id);

                // Then get all bookings for all shops
                const bookingsRef = collection(db, 'bookings');
                const bookingsQuery = query(
                    bookingsRef,
                    where('shopId', 'in', shopIds),
                    orderBy('createdAt', 'desc')
                );

                const bookingsSnapshot = await getDocs(bookingsQuery);

                const fetchedAppointments = bookingsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setAppointments(fetchedAppointments);
            } catch (error) {
                console.error('Error fetching appointments:', error);
                setAppointments([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
    }, [user]);

    const renderView = () => {
        const props = { appointments, selectedDate };

        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            );
        }

        switch (view) {
            case ViewOptions.HOURS:
                return <TimeSlotView {...props} />;
            case ViewOptions.DAYS:
                return <DayView {...props} />;
            case ViewOptions.WEEKS:
                return <WeekView {...props} />;
            case ViewOptions.MONTHS:
                return <MonthView {...props} />;
            default:
                return null;
        }
    };

    return (
        <div
            className="max-w-[calc(100vw-2rem)] h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 rounded-xl shadow-xl overflow-hidden">
            <div className="flex flex-col h-full">
                <header className="border-b dark:border-gray-800">
                    <AgendaNavigation
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                        view={view}
                    />
                    <ViewToggle view={view} onViewChange={setView}/>
                </header>

                <main className="flex-1 overflow-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={view}
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.2}}
                        >
                            {renderView()}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default CustomAgenda;