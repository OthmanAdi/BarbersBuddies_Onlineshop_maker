import React, {useState} from 'react';
import {motion} from 'framer-motion';
import {AlertCircle, Calendar, Clock} from 'lucide-react';

const DateTimeSelectionStep = ({
                                   selectedDate,
                                   setSelectedDate,
                                   selectedTime,
                                   setSelectedTime,
                                   availableTimes,
                                   isTimeSlotAvailable,
                                   t,
                                   step,
                                   setStep,
                                   shop,
                                   blockedTimeSlots
                               }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showError, setShowError] = useState(false);
    const [hoveredDate, setHoveredDate] = useState(null);

    // Generate calendar days
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayIndex = new Date(year, month, 1).getDay();
        const days = [];


        // Add empty slots for days before the first of the month
        for (let i = 0; i < firstDayIndex; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const days = getDaysInMonth(currentMonth);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const isToday = (date) => {
        const today = new Date();
        return date && date.toDateString() === today.toDateString();
    };

    const isPastDate = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date && date < today;
    };

    const isSelectedDate = (date) => {
        if (!date || !selectedDate) return false;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        return formattedDate === selectedDate;
    };

    const getDateStyle = (date) => {
        if (!date || !shop?.specialDates) return {style: '', isHoliday: false};

        const dateStr = date.toISOString().split('T')[0];
        const commonStyles = 'relative overflow-hidden';

        // First check exact date match
        const exactMatch = shop.specialDates[dateStr];
        if (exactMatch) {
            return getStyleForType(exactMatch.type, commonStyles);
        }

        // Then check if date falls within any ranges
        const currentDate = date.getTime();
        for (const [startDateStr, data] of Object.entries(shop.specialDates)) {
            if (data.endDate) {
                const startDate = new Date(startDateStr).getTime();
                const endDate = new Date(data.endDate).getTime();

                // Check if current date is within range
                if (currentDate >= startDate && currentDate <= endDate) {
                    return getStyleForType(data.type, commonStyles);
                }
            }
        }

        return {style: '', isHoliday: false};
    };

    // Add this with other function definitions
    const isTimeSlotPast = (time) => {
        if (!selectedDate || !isToday(new Date(selectedDate))) return false;
        const [hour, minute] = time.split(':').map(Number);
        const now = new Date();
        const slotTime = new Date();
        slotTime.setHours(hour, minute);
        return now.getTime() > slotTime.getTime() - 15 * 60000;
    };

// Helper function to get style based on type
    const getStyleForType = (type, commonStyles) => {
        switch (type) {
            case 'holiday':
                return {
                    style: `${commonStyles} bg-red-200/80 cursor-not-allowed opacity-60`,
                    isHoliday: true
                };
            case 'special':
                return {
                    style: `${commonStyles} bg-yellow-200/80 hover:bg-yellow-300/80`,
                    isHoliday: false
                };
            case 'promo':
                return {
                    style: `${commonStyles} bg-green-200/80 hover:bg-green-300/80`,
                    isHoliday: false
                };
            case 'regular':
                return {
                    style: `${commonStyles} bg-blue-200/80 hover:bg-blue-300/80`,
                    isHoliday: false
                };
            default:
                return {style: '', isHoliday: false};
        }
    };

    const legendItems = [
        {type: 'holiday', color: 'bg-red-200', label: 'Holiday - Closed', icon: AlertCircle},
        {
            type: 'special',
            color: 'bg-yellow-200',
            label: 'Special Day',
            description: 'Special events or extended hours'
        },
        {type: 'promo', color: 'bg-green-200', label: 'Promo Day', description: 'Special offers available'}
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            {/* Calendar Section */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body p-4">
                    <div className="flex items-center justify-between mb-6">
                        <button
                            className="btn btn-ghost btn-circle"
                            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24"
                                 stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                            </svg>
                        </button>
                        <h2 className="text-xl font-bold">
                            {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </h2>
                        <button
                            className="btn btn-ghost btn-circle"
                            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24"
                                 stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {weekDays.map(day => (
                            <div key={day} className="text-center text-sm font-medium text-base-content/60 py-2">
                                {day}
                            </div>
                        ))}

                        {days.map((date, index) => {
                            const dateStyle = date ? getDateStyle(date) : {style: '', isHoliday: false};
                            return (
                                <motion.div
                                    key={index}
                                    initial={{opacity: 0, y: 10}}
                                    animate={{opacity: 1, y: 0}}
                                    transition={{delay: index * 0.02}}
                                >
                                    {date ? (
                                        <button
                                            onClick={() => {
                                                const dateStyle = date ? getDateStyle(date) : {
                                                    style: '',
                                                    isHoliday: false
                                                };
                                                if (dateStyle.isHoliday) return;
                                                const year = date.getFullYear();
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const day = String(date.getDate()).padStart(2, '0');
                                                setSelectedDate(`${year}-${month}-${day}`);
                                            }}
                                            disabled={isPastDate(date) || dateStyle.isHoliday}
                                            className={`
        w-full aspect-square rounded-lg text-sm font-medium
        transition-all duration-200 relative group
        ${dateStyle.style}
        ${isSelectedDate(date)
                                                ? 'bg-primary text-primary-content shadow-lg'
                                                : isToday(date)
                                                    ? 'bg-secondary/20 hover:bg-secondary/30'
                                                    : isPastDate(date)
                                                        ? 'bg-base-200 text-base-content/30 cursor-not-allowed'
                                                        : 'hover:bg-base-200'
                                            }
    `}
                                        >
                                            <span className="relative z-10">{date.getDate()}</span>
                                            {isSelectedDate(date) && (
                                                <motion.div
                                                    initial={{scale: 0}}
                                                    animate={{scale: 1}}
                                                    className="absolute inset-0 bg-primary animate-pulse rounded-lg opacity-20"
                                                />
                                            )}
                                        </button>
                                    ) : (
                                        <div className="w-full aspect-square"/>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        transition={{delay: 0.3}}
                        className="mt-6 space-y-2 bg-base-200 p-4 rounded-lg"
                    >
                        <h4 className="font-semibold text-sm mb-3">Calendar Legend</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {legendItems.map(item => (
                                <div
                                    key={item.type}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <div className={`w-4 h-4 rounded ${item.color}`}/>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Time Slots Section */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body p-4">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary"/>
                        {t.selectTime}
                    </h3>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableTimes.map((time, index) => {
                            const isBlocked = blockedTimeSlots?.includes(time);
                            return (
                                <motion.button
                                    key={time}
                                    initial={{opacity: 0, scale: 0.9}}
                                    animate={{opacity: 1, scale: 1}}
                                    transition={{delay: index * 0.05}}
                                    onClick={() => !isBlocked && setSelectedTime(time)}
                                    disabled={isBlocked || !isTimeSlotAvailable(time) || isTimeSlotPast(time)}
                                    className={`
                            relative btn btn-lg normal-case font-medium
                            transition-all duration-300
                            ${selectedTime === time
                                        ? 'btn-primary shadow-lg'
                                        : isBlocked
                                            ? 'btn-ghost bg-base-300 opacity-50 cursor-not-allowed'
                                            : isTimeSlotAvailable(time)
                                                ? 'btn-ghost hover:btn-primary hover:shadow-md hover:scale-105'
                                                : 'btn-ghost opacity-40 cursor-not-allowed'
                                    }
                        `}
                                >
                                    {time}
                                    {selectedTime === time && (
                                        <div
                                            className="absolute inset-0 bg-primary animate-pulse rounded-lg opacity-20"/>
                                    )}
                                    {isBlocked && (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center bg-base-300/50 rounded-lg">
                                            <span className="text-xs text-base-content/50">Booked</span>
                                        </div>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Selected DateTime Summary */}
            {(selectedDate || selectedTime) && (
                <motion.div
                    initial={{opacity: 0, y: 20}}
                    animate={{opacity: 1, y: 0}}
                    className="lg:col-span-2 card bg-primary text-primary-content shadow-xl"
                >
                    <div className="card-body">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {selectedDate && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5"/>
                                        <span className="font-medium">
                                            {new Date(selectedDate).toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                )}
                                {selectedTime && (
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5"/>
                                        <span className="font-medium">{selectedTime}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="lg:col-span-2 flex justify-between mt-6">
                <button
                    type="button"
                    onClick={() => setStep(2)}  // Explicitly set to go back to Employee step
                    className="btn btn-outline btn-lg gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                    </svg>
                    {t.back}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        if (!selectedDate || !selectedTime) {
                            setShowError(true);
                            setTimeout(() => setShowError(false), 3000);
                            return;
                        }
                        setStep(4);  // Explicitly set to go to Details step
                    }}
                    className="btn btn-primary btn-lg gap-2"
                >
                    {t.next}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>

            <motion.div
                initial={{opacity: 0, y: -100}}
                animate={{opacity: showError ? 1 : 0, y: showError ? 0 : -100}}
                className="fixed top-4 left-1/3 -translate-x-1/2 z-50"
            >
                <div className="alert alert-error shadow-lg">
                    <span>{t.fillAllFields}</span>
                </div>
            </motion.div>
        </div>
    );
};

export default DateTimeSelectionStep;