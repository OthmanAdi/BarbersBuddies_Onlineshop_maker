// MobileAgenda.jsx
import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {
    addDays,
    addMonths,
    addWeeks,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    startOfMonth,
    startOfWeek
} from 'date-fns';
import {collection, getDocs, orderBy, query, where} from 'firebase/firestore';
import {db} from '../firebase';

// Reuse the same ViewOptions enum
const ViewOptions = {
    HOURS: 'hours',
    DAYS: 'days',
    WEEKS: 'weeks',
    MONTHS: 'months'
};

// First, add this helper function at the top with the other utility functions
const roundToNearestSlot = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const roundedMinutes = Math.round(minutes / 15) * 15;
    return `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
};

// Replace the current generateTimeSlots function with this one
const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 21; hour++) {
        for (let minutes = 0; minutes < 60; minutes += 15) {
            slots.push(`${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        }
    }
    return slots;
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
        <div className="bg-base-100 rounded-xl shadow-xl border border-base-300 p-4">
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

                <span className="text-lg font-semibold">
                    {format(selectedDate, 'MMMM yyyy')}
                </span>

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
                                : 'hover:bg-base-200'
                        }`}
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

// Mobile-optimized appointment card
const MobileAppointmentCard = ({appointment}) => {
    const totalCost = appointment.selectedServices?.reduce((sum, service) =>
        sum + (parseFloat(service.price) || 0), 0) || 0;

    const primaryService = appointment.selectedServices?.[0]?.name || 'No service';

    const totalDuration = appointment.selectedServices?.reduce((sum, service) =>
        sum + (parseInt(service.duration) || 0), 0) || 0;

    return (
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -20}}
            className="p-4 bg-base-200 rounded-xl space-y-3"
        >
            <div className="flex items-center space-x-3">
                <div className="avatar">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-medium">{appointment.userName.charAt(0)}</span>
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{appointment.userName}</h4>
                    <p className="text-sm text-base-content/60 truncate">{appointment.userEmail}</p>
                </div>
                <div className="badge badge-primary">€{totalCost}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-base-300 rounded-lg">
                    <span className="block text-xs text-base-content/60">Time</span>
                    <span className="font-medium">{appointment.selectedTime}</span>
                </div>
                <div className="p-2 bg-base-300 rounded-lg">
                    <span className="block text-xs text-base-content/60">Duration</span>
                    <span className="font-medium">{totalDuration} min</span>
                </div>
            </div>

            <div className="flex items-center justify-between text-sm">
                <span className="text-base-content/60">{primaryService}</span>
                <span className="badge badge-ghost">{appointment.employeeName || 'Any Available'}</span>
            </div>
        </motion.div>
    );
};

// Mobile view components
const MobileTimeSlotView = ({appointments, selectedDate}) => (
    <div className="relative">
        {/* Time axis */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-base-100 to-transparent" />
        
        <div className="pl-16 pr-4">
            {generateTimeSlots().map((time) => {
                const timeAppointments = appointments.filter(
                    app => roundToNearestSlot(app.selectedTime) === time && 
                           isSameDay(new Date(app.selectedDate), selectedDate)
                );

                return (
                    <div key={time} className="relative">
                        {/* Time marker */}
                        <div className="absolute left-0 transform -translate-x-16 w-16 px-2 py-3 text-sm font-medium text-base-content/60">
                            {time}
                        </div>

                        {/* Time slot row */}
                        <div className="border-l-2 border-l-base-300 pl-4 min-h-[3rem] relative group hover:bg-base-200/50 transition-colors">
                            {/* Visual time indicator */}
                            <div className="absolute left-0 top-1/2 -translate-x-[5px] w-2 h-2 rounded-full bg-base-300 group-hover:bg-primary transition-colors" />
                            
                            {/* Appointments */}
                            {timeAppointments.length > 0 ? (
                                <div className="py-2 space-y-2">
                                    {timeAppointments.map(appointment => (
                                        <MobileAppointmentCard 
                                            key={appointment.id} 
                                            appointment={appointment}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="h-1 w-full rounded-full bg-base-300/50" />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const MobileDayView = ({appointments, selectedDate}) => (
    <div className="space-y-4 p-4">
        {appointments
            .filter(app => isSameDay(new Date(app.selectedDate), selectedDate))
            .map(appointment => (
                <MobileAppointmentCard key={appointment.id} appointment={appointment}/>
            ))}
    </div>
);

const MobileWeekView = ({appointments, selectedDate}) => {
    const start = startOfWeek(selectedDate);
    const end = endOfWeek(selectedDate);
    const days = eachDayOfInterval({start, end});

    return (
        <div className="space-y-6 p-4">
            {days.map(day => (
                <div key={day.toString()} className="space-y-2">
                    <h3 className="text-sm font-medium sticky top-0 bg-base-100 py-2">
                        {format(day, 'EEEE, MMM d')}
                    </h3>
                    {appointments
                        .filter(app => isSameDay(new Date(app.selectedDate), day))
                        .map(appointment => (
                            <MobileAppointmentCard key={appointment.id} appointment={appointment}/>
                        ))}
                </div>
            ))}
        </div>
    );
};

const MobileMonthView = ({appointments, selectedDate}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDayAppointments, setSelectedDayAppointments] = useState([]);
    const [selectedDayDate, setSelectedDayDate] = useState(null);
    
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days = eachDayOfInterval({start, end});
    const today = new Date();
    
    const firstDayOffset = startOfMonth(selectedDate).getDay();
    const totalDays = days.length + firstDayOffset;
    const weeksInMonth = Math.ceil(totalDays / 7);

    const handleDayClick = (day, dayAppointments) => {
        setSelectedDayDate(day);
        setSelectedDayAppointments(dayAppointments);
        setIsModalOpen(true);
    };

    return (
        <>
            <div className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-base-content/60 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDayOffset }).map((_, index) => (
                        <div key={`empty-start-${index}`} className="aspect-square" />
                    ))}

                    {days.map(day => {
                        const dayAppointments = appointments.filter(
                            app => isSameDay(new Date(app.selectedDate), day)
                        );

                        return (
                            <motion.div 
                                key={day.toString()}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDayClick(day, dayAppointments)}
                                className={`aspect-square p-1 relative rounded-lg border transition-colors cursor-pointer
                                    ${isSameDay(day, selectedDate) ? 'border-primary bg-primary/5' : 
                                    isSameDay(day, today) ? 'border-primary/30' : 'border-base-200'}`}
                            >
                                <div className={`text-sm font-medium mb-1 
                                    ${isSameDay(day, selectedDate) ? 'text-primary' : 
                                    isSameDay(day, today) ? 'text-primary/80' : 'text-base-content'}`}>
                                    {format(day, 'd')}
                                </div>

                                <div className="absolute inset-1 top-7 overflow-hidden">
                                    {dayAppointments.length > 0 && (
                                        <div className="flex flex-col gap-1">
                                            {dayAppointments.slice(0, 3).map((appointment, idx) => (
                                                <div 
                                                    key={appointment.id}
                                                    className="h-1.5 rounded-full bg-primary/60"
                                                    style={{
                                                        opacity: 1 - (idx * 0.2),
                                                        width: `${85 - (idx * 15)}%`
                                                    }}
                                                />
                                            ))}
                                            {dayAppointments.length > 3 && (
                                                <div className="text-xs text-base-content/60 mt-0.5">
                                                    +{dayAppointments.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}

                    {Array.from({ length: (weeksInMonth * 7) - totalDays }).map((_, index) => (
                        <div key={`empty-end-${index}`} className="aspect-square" />
                    ))}
                </div>
            </div>

            {/* Appointments Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="fixed inset-0 bg-black/50 z-40"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            className="fixed inset-x-0 bottom-0 z-50 bg-base-100 rounded-t-3xl"
                        >
                            <div className="p-4 border-b border-base-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">
                                        {selectedDayDate && format(selectedDayDate, 'EEEE, MMMM d')}
                                    </h3>
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setIsModalOpen(false)}
                                        className="p-2 hover:bg-base-200 rounded-full"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </motion.button>
                                </div>
                                <p className="text-sm text-base-content/60">
                                    {selectedDayAppointments.length} appointment{selectedDayAppointments.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            
                            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
                                {selectedDayAppointments.length > 0 ? (
                                    selectedDayAppointments
                                        .sort((a, b) => a.selectedTime.localeCompare(b.selectedTime))
                                        .map(appointment => (
                                            <MobileAppointmentCard
                                                key={appointment.id}
                                                appointment={appointment}
                                            />
                                        ))
                                ) : (
                                    <div className="text-center py-8 text-base-content/60">
                                        No appointments for this day
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

const MobileAgenda = ({user}) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState(ViewOptions.HOURS);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
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
        const props = {appointments, selectedDate};

        if (loading) {
            return (
                <div className="flex items-center justify-center h-full p-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"/>
                </div>
            );
        }

        switch (view) {
            case ViewOptions.HOURS:
                return <MobileTimeSlotView {...props} />;
            case ViewOptions.DAYS:
                return <MobileDayView {...props} />;
            case ViewOptions.WEEKS:
                return <MobileWeekView {...props} />;
            case ViewOptions.MONTHS:
                return <MobileMonthView {...props} />;
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="border-b border-base-200 p-4 space-y-4">
                <div className="flex items-center">
                    <div className="flex items-center space-x-4">
                        <motion.button
                            whileTap={{scale: 0.95}}
                            onClick={() => {
                                const date = new Date(selectedDate);
                                switch (view) {
                                    case ViewOptions.MONTHS:
                                        setSelectedDate(addMonths(date, -1));
                                        break;
                                    case ViewOptions.WEEKS:
                                        setSelectedDate(addWeeks(date, -1));
                                        break;
                                    default:
                                        setSelectedDate(addDays(date, -1));
                                }
                            }}
                            className="p-2 rounded-full hover:bg-base-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                            </svg>
                        </motion.button>

                        <motion.button
                            whileTap={{scale: 0.95}}
                            onClick={() => setSelectedDate(new Date())}
                            className="px-3 py-1 rounded-lg text-sm font-medium hover:bg-base-200"
                        >
                            Today
                        </motion.button>

                        <motion.button
                            whileTap={{scale: 0.95}}
                            onClick={() => {
                                const date = new Date(selectedDate);
                                switch (view) {
                                    case ViewOptions.MONTHS:
                                        setSelectedDate(addMonths(date, 1));
                                        break;
                                    case ViewOptions.WEEKS:
                                        setSelectedDate(addWeeks(date, 1));
                                        break;
                                    default:
                                        setSelectedDate(addDays(date, 1));
                                }
                            }}
                            className="p-2 rounded-full hover:bg-base-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                            </svg>
                        </motion.button>
                    </div>

                    <motion.button
                        whileHover={{scale: 1.02}}
                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                        className="flex-1 text-lg font-semibold hover:text-primary transition-colors group relative"
                    >
    <span className="group-hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors">
        {format(selectedDate, view === ViewOptions.MONTHS ? 'MMMM yyyy' : 'MMMM d, yyyy')}
    </span>

                        <AnimatePresence>
                            {isCalendarOpen && (
                                <>
                                    <motion.div
                                        initial={{opacity: 0}}
                                        animate={{opacity: 1}}
                                        exit={{opacity: 0}}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsCalendarOpen(false);
                                        }}
                                        className="fixed inset-0 z-40 bg-black/20"
                                    />
                                    <motion.div
                                        initial={{opacity: 0, y: -10}}
                                        animate={{opacity: 1, y: 0}}
                                        exit={{opacity: 0, y: -10}}
                                        transition={{type: "spring", damping: 20}}
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            marginTop: '0.5rem',
                                            zIndex: 50,
                                            left: 'min(50%, calc(100% - 16rem))', // 16rem = calendar width
                                            transform: 'translateX(-50%)'
                                        }}
                                    >
                                        <Calendar
                                            selectedDate={selectedDate}
                                            onSelect={setSelectedDate}
                                            onClose={() => setIsCalendarOpen(false)}
                                        />
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </div>

                {/* View toggle section remains the same */}
                <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
                    {Object.values(ViewOptions).map((viewOption) => (
                        <motion.button
                            key={viewOption}
                            whileTap={{scale: 0.95}}
                            onClick={() => setView(viewOption)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${view === viewOption
                                ? 'bg-primary text-primary-content'
                                : 'bg-base-200 hover:bg-base-300'
                            }`}
                        >
                            {viewOption.charAt(0).toUpperCase() + viewOption.slice(1)}
                        </motion.button>
                    ))}
                </div>
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
    );
};

export default MobileAgenda;