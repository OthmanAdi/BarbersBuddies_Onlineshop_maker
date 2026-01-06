import React, {useState} from 'react';
import {Calendar, ChevronDown, Clock, Copy, Moon, Store, Sunrise, Sunset, X} from 'lucide-react';
import BarberCalendar from "./BarberCalendar";
import {motion} from 'framer-motion';

const EnhancedAvailabilitySelector = ({availability, setAvailability, t, specialDates, setSpecialDates, setFormTouched }) => {
    const [expandedDay, setExpandedDay] = useState(null);
    const [view, setView] = useState('weekly');
    const [animatingCard, setAnimatingCard] = useState(null);
    const [slotDuration, setSlotDuration] = useState(30);

    const days = [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];

    const handleQuickPreset = (day, times) => {
        setFormTouched(true); // Add this line
        setAvailability(prev => ({
            ...prev,
            [day]: {
                open: times.open,
                close: times.close,
                slotDuration: prev[day]?.slotDuration || 30
            }
        }));

        setAnimatingCard(day);
        setTimeout(() => setAnimatingCard(null), 500);
    };

    const handleSlotDurationChange = (day, duration) => {
        setFormTouched(true); // Add this line
        setAvailability(prev => ({
            ...prev,
            [day]: {
                ...(prev[day] || {}),
                slotDuration: duration
            }
        }));
    };

    const clearDay = (day) => {
        setFormTouched(true); // Add this line
        setAvailability(prev => ({
            ...prev,
            [day]: null
        }));
        setAnimatingCard(day);
        setTimeout(() => setAnimatingCard(null), 500);
    };

    // Generate time slots with pretty display
    const timeSlots = Array.from({length: 48}, (_, i) => {
        const hour = Math.floor(i / 2);
        const minute = i % 2 === 0 ? '00' : '30';
        const time = `${String(hour).padStart(2, '0')}:${minute}`;
        const period = hour < 12 ? 'AM' : 'PM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return {
            value: time,
            display: `${displayHour}:${minute} ${period}`
        };
    });

    // Quick time presets
    const timePresets = {
        morning: {open: '08:00', close: '12:00'},
        afternoon: {open: '12:00', close: '17:00'},
        evening: {open: '17:00', close: '22:00'},
        fullDay: {open: '09:00', close: '18:00'},
        lateNight: {open: '18:00', close: '23:00'}
    };

    const handleTimeChange = (day, type, time) => {
        setFormTouched(true); // Add this line
        setAvailability(prev => ({
            ...prev,
            [day]: {
                ...(prev[day] || { slotDuration: prev[day]?.slotDuration || 30 }),
                [type]: time,
                slotDuration: prev[day]?.slotDuration || 30
            }
        }));

        setAnimatingCard(day);
        setTimeout(() => setAnimatingCard(null), 500);
    };

    const getTimeOfDayIcon = (time) => {
        if (!time) return null;
        const hour = parseInt(time.split(':')[0]);
        if (hour >= 5 && hour < 12) return <Sunrise className="w-4 h-4"/>;
        if (hour >= 12 && hour < 17) return <Store className="w-4 h-4"/>;
        if (hour >= 17 && hour < 21) return <Sunset className="w-4 h-4"/>;
        return <Moon className="w-4 h-4"/>;
    };

    const copyToAllDays = (sourceDay) => {
        const sourceTimes = availability[sourceDay];
        if (!sourceTimes) return;

        days.forEach(day => {
            if (day !== sourceDay) {
                setTimeout(() => {
                    setAnimatingCard(day);
                    setTimeout(() => setAnimatingCard(null), 500);
                }, days.indexOf(day) * 100);
            }
        });

        setAvailability(prev => {
            const newAvailability = {...prev};
            days.forEach(day => {
                newAvailability[day] = {
                    ...sourceTimes,
                    slotDuration: prev[day]?.slotDuration || sourceTimes.slotDuration || 30
                };
            });
            return newAvailability;
        });
    };

    const getSlotDuration = (day) => {
        return availability[day]?.slotDuration || 30;
    };

    // const handleSlotDurationChange = (day, duration) => {
    //     setAvailability(prev => ({
    //         ...prev,
    //         [day]: {
    //             ...(prev[day] || {}),
    //             slotDuration: duration
    //         }
    //     }));
    // };
    //
    // const clearDay = (day) => {
    //     setAvailability(prev => ({
    //         ...prev,
    //         [day]: null
    //     }));
    //     setAnimatingCard(day);
    //     setTimeout(() => setAnimatingCard(null), 500);
    // };

    return (
        <div className="w-full space-y-6">
            {/* View Toggle */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-primary">{t.setYourAvailability}</h2>
                <div className="join shadow-lg">
                    <button
                        className={`join-item btn ${view === 'weekly' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setView('weekly')}
                    >
                        <Clock className="w-4 h-4 mr-2"/>
                        Weekly
                    </button>
                    <motion.button
                        className={`join-item btn ${view === 'calendar' ? 'btn-primary' : 'btn-ghost'} relative`}
                        onClick={() => setView('calendar')}
                        whileHover={{scale: 1.02}}
                        whileTap={{scale: 0.98}}
                    >
                        <Calendar className="w-4 h-4 mr-2"/>
                        Calendar

                        <motion.div
                            className="absolute inset-0 rounded-[inherit] border-[3px]"
                            animate={{
                                borderColor: [
                                    "rgb(59 130 246)", // blue-500
                                    "rgb(6 182 212)",  // cyan-500
                                    "rgb(99 102 241)", // indigo-500
                                    "rgb(139 92 246)", // violet-500
                                    "rgb(59 130 246)"  // back to blue-500
                                ],
                            }}
                            transition={{
                                duration: 2,
                                ease: "easeInOut",
                                repeat: Infinity,
                                repeatType: "loop"
                            }}
                        />
                    </motion.button>
                </div>
            </div>

            {/* Quick Presets */}
            {view === 'weekly' && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
                    {Object.entries(timePresets).map(([key, times]) => (
                        <button
                            key={key}
                            className="btn btn-sm btn-outline capitalize hover:scale-105 transition-transform"
                            onClick={() => {
                                if (expandedDay) {
                                    handleQuickPreset(expandedDay, times);
                                }
                            }}
                            disabled={!expandedDay}
                        >
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                        </button>
                    ))}
                </div>
            )}

            {view === 'weekly' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {days.map((day) => (
                        <div
                            key={day}
                            className={`card bg-base-100 shadow-lg transition-all duration-300 
                ${expandedDay === day ? 'ring-2 ring-primary' : 'hover:shadow-xl'}
                ${animatingCard === day ? 'animate-pulse' : ''}
              `}
                        >
                            <div className="card-body p-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="card-title text-lg font-bold">{day}</h3>
                                    <div className="flex gap-2">
                                        {availability[day] && (
                                            <>
                                                <button
                                                    onClick={() => copyToAllDays(day)}
                                                    className="btn btn-ghost btn-sm btn-circle tooltip tooltip-left"
                                                    data-tip="Copy to all days"
                                                >
                                                    <Copy className="w-4 h-4"/>
                                                </button>
                                                <button
                                                    onClick={() => clearDay(day)}
                                                    className="btn btn-ghost btn-sm btn-circle tooltip tooltip-left"
                                                    data-tip="Clear day"
                                                >
                                                    <X className="w-4 h-4"/>
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => setExpandedDay(expandedDay === day ? null : day)}
                                            className={`btn btn-ghost btn-sm btn-circle transition-transform duration-300
                        ${expandedDay === day ? 'rotate-180' : ''}`}
                                        >
                                            <ChevronDown className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>

                                {/* Time Display */}
                                <div className="mt-2">
                                    {availability[day] ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <div className="flex items-center gap-1">
                                                {getTimeOfDayIcon(availability[day].open)}
                                                <span className="font-semibold">{availability[day].open}</span>
                                            </div>
                                            <span>-</span>
                                            <div className="flex items-center gap-1">
                                                {getTimeOfDayIcon(availability[day].close)}
                                                <span className="font-semibold">{availability[day].close}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-500 italic">Closed</div>
                                    )}
                                </div>

                                {/* Expanded Time Selection */}
                                <div className={`
                  overflow-hidden transition-all duration-300
                  ${expandedDay === day ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}
                `}>
                                    <div className="space-y-4">
                                        {/* Time Selection Sliders */}
                                        <div className="space-y-6">
                                            <div className="form-control">
                                                <label className="label">
                          <span className="label-text flex items-center gap-2">
                            <Sunrise className="w-4 h-4"/>
                            Opening Time
                          </span>
                                                </label>
                                                <div className="join w-full">
                                                    <select
                                                        className="select select-bordered join-item w-full"
                                                        value={availability[day]?.open || ''}
                                                        onChange={(e) => handleTimeChange(day, 'open', e.target.value)}
                                                    >
                                                        <option value="">Select time</option>
                                                        {timeSlots.map(({value, display}) => (
                                                            <option key={`open-${value}`} value={value}>
                                                                {display}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-control">
                                                <label className="label">
                          <span className="label-text flex items-center gap-2">
                            <Sunset className="w-4 h-4"/>
                            Closing Time
                          </span>
                                                </label>
                                                <div className="join w-full">
                                                    <select
                                                        className="select select-bordered join-item w-full"
                                                        value={availability[day]?.close || ''}
                                                        onChange={(e) => handleTimeChange(day, 'close', e.target.value)}
                                                    >
                                                        <option value="">Select time</option>
                                                        {timeSlots.map(({value, display}) => (
                                                            <option key={`close-${value}`} value={value}>
                                                                {display}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Hours Toggle */}
                                        <div className="divider text-xs">or choose quick hours</div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(timePresets).map(([key, times]) => (
                                                <button
                                                    key={key}
                                                    className="btn btn-sm btn-outline capitalize"
                                                    onClick={() => {
                                                        handleTimeChange(day, 'open', times.open);
                                                        handleTimeChange(day, 'close', times.close);
                                                    }}
                                                >
                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="form-control mt-6">
                                            <label className="label">
        <span className="label-text flex items-center gap-2">
            <Clock className="w-4 h-4"/>
            Time Slot Duration
        </span>
                                            </label>
                                            <motion.div
                                                className="relative h-12 bg-base-200 rounded-lg"
                                                whileHover={{scale: 1.02}}
                                                whileTap={{scale: 0.98}}
                                            >
                                                <motion.div
                                                    className="absolute inset-y-0 left-0 bg-primary rounded-lg"
                                                    style={{width: `${(getSlotDuration(day) - 15) / 45 * 100}%`}}
                                                    layoutId={`slider-${day}`}
                                                />
                                                <input
                                                    type="range"
                                                    min="15"
                                                    max="60"
                                                    step="15"
                                                    value={getSlotDuration(day)}
                                                    onChange={(e) => handleSlotDurationChange(day, parseInt(e.target.value))}
                                                    className="range range-primary range-sm absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                                <div
                                                    className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none">
                                                    <span className="text-sm font-medium">15m</span>
                                                    <motion.span
                                                        className="text-sm font-bold"
                                                        animate={{scale: [1, 1.1, 1]}}
                                                        transition={{duration: 0.3}}
                                                    >
                                                        {getSlotDuration(day)}m
                                                    </motion.span>
                                                    <span className="text-sm font-medium">60m</span>
                                                </div>
                                            </motion.div>

                                            <motion.div
                                                className="grid grid-cols-4 gap-2 mt-2"
                                                initial={{opacity: 0}}
                                                animate={{opacity: 1}}
                                                transition={{delay: 0.2}}
                                            >
                                                {[15, 30, 45, 60].map((duration) => (
                                                    <motion.button
                                                        key={duration}
                                                        onClick={() => handleSlotDurationChange(day, duration)}
                                                        className={`btn btn-sm ${getSlotDuration(day) === duration ? 'btn-primary' : 'btn-ghost'}`}
                                                        whileHover={{scale: 1.05}}
                                                        whileTap={{scale: 0.95}}
                                                    >
                                                        {duration}m
                                                    </motion.button>
                                                ))}
                                            </motion.div>
                                        </div>

                                        {/*<motion.div*/}
                                        {/*    className="grid grid-cols-4 gap-2 mt-2"*/}
                                        {/*    initial={{opacity: 0}}*/}
                                        {/*    animate={{opacity: 1}}*/}
                                        {/*    transition={{delay: 0.2}}*/}
                                        {/*>*/}
                                        {/*    {[15, 30, 45, 60].map((duration) => (*/}
                                        {/*        <motion.button*/}
                                        {/*            key={duration}*/}
                                        {/*            onClick={() => handleSlotDurationChange(day, duration)}*/}
                                        {/*            className={`btn btn-sm ${getSlotDuration(day) === duration ? 'btn-primary' : 'btn-ghost'}`}*/}
                                        {/*            whileHover={{scale: 1.05}}*/}
                                        {/*            whileTap={{scale: 0.95}}*/}
                                        {/*        >*/}
                                        {/*            {duration}m*/}
                                        {/*        </motion.button>*/}
                                        {/*    ))}*/}
                                        {/*</motion.div>*/}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <BarberCalendar
                    availability={availability}
                    specialDates={specialDates}
                    setSpecialDates={setSpecialDates}
                    t={t}
                />
            )}

            {/* Quick Actions */}
            {view === 'weekly' && (
                <div className="flex flex-wrap gap-2 mt-6">
                <button
                        className="btn btn-outline btn-sm hover:scale-105 transition-transform"
                        onClick={() => {
                            setFormTouched(true);
                            const standardHours = {open: '09:00', close: '17:00', slotDuration: 30};
                            const newAvailability = {};
                            days.forEach((day, index) => {
                                if (day !== 'Saturday' && day !== 'Sunday') {
                                    setTimeout(() => {
                                        setAnimatingCard(day);
                                        setTimeout(() => setAnimatingCard(null), 500);
                                    }, index * 100);
                                    newAvailability[day] = {
                                        ...standardHours,
                                        slotDuration: availability[day]?.slotDuration || 30
                                    };
                                }
                            });
                            setAvailability(newAvailability);
                        }}
                    >
                        <Store className="w-4 h-4 mr-2"/>
                        Set Standard Business Hours
                    </button>

                    <button
                        className="btn btn-outline btn-sm hover:scale-105 transition-transform"
                        onClick={() => {
                            setFormTouched(true);
                            days.forEach((day, index) => {
                                setTimeout(() => {
                                    setAnimatingCard(day);
                                    setTimeout(() => setAnimatingCard(null), 500);
                                }, index * 100);
                            });
                            const newAvailability = {};
                            days.forEach(day => {
                                newAvailability[day] = null;
                            });
                            setAvailability(newAvailability);
                        }}
                    >
                        <X className="w-4 h-4 mr-2"/>
                        Clear All Hours
                    </button>
                </div>
            )}
        </div>
    );
};

export default EnhancedAvailabilitySelector;