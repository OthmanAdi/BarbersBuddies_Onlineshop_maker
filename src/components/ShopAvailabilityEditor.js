import React, {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Calendar as CalendarIcon, ChevronDown, Clock, Sunrise, Sunset} from 'lucide-react';
import {doc, serverTimestamp, updateDoc} from 'firebase/firestore';
import {db} from '../firebase';
import {format, parse, startOfToday} from 'date-fns';
import BarberCalendar from './BarberCalendar';
import Swal from "sweetalert2";

export default function ShopAvailabilityEditor({shop, onSave}) {
    React.useEffect(() => {
        if (!shop || !shop.id) {
            console.error('Shop object:', shop);
            throw new Error('Shop must have an ID');
        }
    }, [shop]);

    const [availability, setAvailability] = useState(shop.availability || {});
    const [expandedDay, setExpandedDay] = useState(null);
    const [view, setView] = useState('weekly');
    const [specialDates, setSpecialDates] = useState(shop.specialDates || {});
    const [selectedDate, setSelectedDate] = useState(startOfToday());
    const [currentMonth, setCurrentMonth] = useState(format(startOfToday(), 'MMM-yyyy'));
    const firstDayCurrentMonth = parse(currentMonth, 'MMM-yyyy', new Date());
    const [isLoading, setIsLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const timeSlots = Array.from({length: 48}, (_, i) => {
        const hour = Math.floor(i / 2);
        const minute = i % 2 === 0 ? '00' : '30';
        return {
            value: `${String(hour).padStart(2, '0')}:${minute}`,
            display: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${minute} ${hour < 12 ? 'AM' : 'PM'}`
        };
    });

    const [slotDurations, setSlotDurations] = useState(() => {
        const durations = {};
        weekDays.forEach(day => {
            durations[day] = shop.availability?.[day]?.slotDuration || 30;
        });
        return durations;
    });

    const timePresets = {
        morning: {open: '08:00', close: '12:00'},
        afternoon: {open: '12:00', close: '17:00'},
        evening: {open: '17:00', close: '22:00'},
        fullDay: {open: '09:00', close: '18:00'}
    };

    const specialDateTypes = {
        holiday: {label: 'Holiday', color: 'bg-red-500'},
        promotion: {label: 'Promotion', color: 'bg-green-500'},
        event: {label: 'Special Event', color: 'bg-purple-500'},
        closed: {label: 'Closed', color: 'bg-gray-500'}
    };

    const handleTimeChange = (day, type, value) => {
        setAvailability(prev => ({
            ...prev, [day]: {
                ...(prev[day] || {}), [type]: value, slotDuration: slotDurations[day]
            }
        }));
    };

    const handleSpecialDateAdd = async (date, type) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const newSpecialDates = {
            ...specialDates, [dateStr]: {
                type, endDate: dateStr, created: new Date().toISOString(), lastModified: new Date().toISOString()
            }
        };
        setSpecialDates(newSpecialDates);
    };

    const handleSpecialDateRemove = async (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const newSpecialDates = {...specialDates};
        delete newSpecialDates[dateStr];
        setSpecialDates(newSpecialDates);
    };

    const handleSave = async () => {
        try {
            setIsLoading(true);
            if (!shop || !shop.id) {
                throw new Error('Invalid shop reference');
            }

            const shopRef = doc(db, 'barberShops', shop.id);
            const cleanedAvailability = Object.entries(availability).reduce((acc, [day, hours]) => {
                if (hours && hours.open && hours.close) {
                    acc[day] = {
                        open: hours.open, close: hours.close, slotDuration: hours.slotDuration || 30
                    };
                }
                return acc;
            }, {});

            const updatePayload = {
                availability: cleanedAvailability, specialDates: specialDates, lastUpdated: serverTimestamp()
            };

            await updateDoc(shopRef, updatePayload);
            await Swal.fire({
                title: 'Saved!', icon: 'success', timer: 2000, showConfirmButton: false
            });

            onSave({
                ...shop, availability: cleanedAvailability, specialDates: specialDates
            });
        } catch (error) {
            console.error('Error saving:', error);
            await Swal.fire({
                title: 'Error', text: error.message, icon: 'error', confirmButtonText: 'OK'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSlotDurationChange = (day, duration) => {
        setSlotDurations(prev => ({
            ...prev, [day]: duration
        }));

        setAvailability(prev => ({
            ...prev, [day]: {
                ...(prev[day] || {}), slotDuration: duration
            }
        }));
    };

    const copyToAllDays = (sourceDay) => {
        const sourceTimes = availability[sourceDay];
        if (!sourceTimes) return;

        setAvailability(prev => {
            const newAvailability = {...prev};
            weekDays.forEach(day => {
                newAvailability[day] = {
                    ...sourceTimes, slotDuration: prev[day]?.slotDuration || sourceTimes.slotDuration || 30
                };
            });
            return newAvailability;
        });
    };

    return (<div className="w-full space-y-6 px-4 py-6 bg-base-100">
            <div className="flex justify-end mb-6">
                <div className="join">
                    <button
                        className={`join-item btn btn-sm ${view === 'weekly' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setView('weekly')}
                    >
                        <Clock className="w-4 h-4 mr-2"/>
                        Weekly Hours
                    </button>
                    <button
                        className={`join-item btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setView('calendar')}
                    >
                        <CalendarIcon className="w-4 h-4 mr-2"/>
                        Special Dates
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {view === 'weekly' ? (<motion.div
                        key="weekly"
                        initial={{opacity: 0, x: -20}}
                        animate={{opacity: 1, x: 0}}
                        exit={{opacity: 0, x: 20}}
                        className="grid gap-4"
                    >
                        {weekDays.map((day) => (<motion.div
                                key={day}
                                layout
                                className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <motion.div
                                    className="p-4 flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedDay(expandedDay === day ? null : day)}
                                >
                                    <div className="flex items-center gap-4">
                                        <label className="cursor-pointer label compact">
                                            <input
                                                type="checkbox"
                                                className="toggle toggle-primary toggle-sm"
                                                checked={!!availability[day]?.open}
                                                onChange={() => {
                                                    if (availability[day]?.open) {
                                                        setAvailability(prev => ({
                                                            ...prev, [day]: null
                                                        }));
                                                    } else {
                                                        setAvailability(prev => ({
                                                            ...prev,
                                                            [day]: {open: '09:00', close: '17:00', slotDuration: 30}
                                                        }));
                                                    }
                                                }}
                                            />
                                            <span className="label-text ml-2 font-medium">{day}</span>
                                        </label>
                                    </div>
                                    <motion.div
                                        animate={{rotate: expandedDay === day ? 180 : 0}}
                                        transition={{duration: 0.2}}
                                    >
                                        <ChevronDown className="w-4 h-4"/>
                                    </motion.div>
                                </motion.div>

                                <AnimatePresence>
                                    {expandedDay === day && availability[day]?.open && (<motion.div
                                            initial={{height: 0, opacity: 0}}
                                            animate={{height: "auto", opacity: 1}}
                                            exit={{height: 0, opacity: 0}}
                                            transition={{duration: 0.2}}
                                            className="px-4 pb-4"
                                        >
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="form-control">
                                                        <label className="label">
                                                            <span className="label-text flex items-center gap-2">
                                                                <Sunrise className="w-4 h-4"/>
                                                                Opening Time
                                                            </span>
                                                        </label>
                                                        <select
                                                            className="select select-bordered w-full"
                                                            value={availability[day]?.open || '09:00'}
                                                            onChange={(e) => handleTimeChange(day, 'open', e.target.value)}
                                                        >
                                                            {timeSlots.map(({value, display}) => (
                                                                <option key={value} value={value}>{display}</option>))}
                                                        </select>
                                                    </div>

                                                    <div className="form-control">
                                                        <label className="label">
                                                            <span className="label-text flex items-center gap-2">
                                                                <Sunset className="w-4 h-4"/>
                                                                Closing Time
                                                            </span>
                                                        </label>
                                                        <select
                                                            className="select select-bordered w-full"
                                                            value={availability[day]?.close || '17:00'}
                                                            onChange={(e) => handleTimeChange(day, 'close', e.target.value)}
                                                        >
                                                            {timeSlots.map(({value, display}) => (
                                                                <option key={value} value={value}>{display}</option>))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-medium flex items-center gap-2">
                                                            <Clock className="w-4 h-4"/>
                                                            Appointment Duration
                                                        </span>
                                                        <span
                                                            className="text-sm font-bold">{slotDurations[day]}min</span>
                                                    </div>

                                                    <motion.div
                                                        className="relative h-12 bg-base-300 rounded-lg"
                                                        whileHover={{scale: 1.01}}
                                                        whileTap={{scale: 0.99}}
                                                    >
                                                        <motion.div
                                                            className="absolute inset-y-0 left-0 bg-primary rounded-lg"
                                                            style={{
                                                                width: `${((slotDurations[day] - 15) / 45) * 100}%`
                                                            }}
                                                            layout
                                                        />
                                                        <input
                                                            type="range"
                                                            min="15"
                                                            max="60"
                                                            step="15"
                                                            value={slotDurations[day]}
                                                            onChange={(e) => handleSlotDurationChange(day, parseInt(e.target.value))}
                                                            className="range range-primary range-sm absolute inset-0 opacity-0 cursor-pointer"
                                                        />
                                                        <div
                                                            className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none text-sm">
                                                            <span>15m</span>
                                                            <span>60m</span>
                                                        </div>
                                                    </motion.div>

                                                    <div className="grid grid-cols-4 gap-2">
                                                        {[15, 30, 45, 60].map((duration) => (<motion.button
                                                                key={duration}
                                                                onClick={() => handleSlotDurationChange(day, duration)}
                                                                className={`btn btn-sm ${slotDurations[day] === duration ? 'btn-primary' : 'btn-ghost'}`}
                                                                whileHover={{scale: 1.05}}
                                                                whileTap={{scale: 0.95}}
                                                            >
                                                                {duration}m
                                                            </motion.button>))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    {Object.entries(timePresets).map(([key, times]) => (<motion.button
                                                            key={key}
                                                            onClick={() => {
                                                                handleTimeChange(day, 'close', times.close);
                                                            }}
                                                            className="btn btn-sm btn-outline capitalize"
                                                            whileHover={{scale: 1.02}}
                                                            whileTap={{scale: 0.98}}
                                                        >
                                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                                        </motion.button>))}
                                                </div>

                                                <motion.button
                                                    onClick={() => copyToAllDays(day)}
                                                    className="btn btn-secondary btn-sm w-full"
                                                    whileHover={{scale: 1.02}}
                                                    whileTap={{scale: 0.98}}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2"
                                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                        <path
                                                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                    </svg>
                                                    Copy to all days
                                                </motion.button>
                                            </div>
                                        </motion.div>)}
                                </AnimatePresence>
                            </motion.div>))}
                    </motion.div>) : (<motion.div
                        key="calendar"
                        initial={{opacity: 0, x: 20}}
                        animate={{opacity: 1, x: 0}}
                        exit={{opacity: 0, x: -20}}
                    >
                        <BarberCalendar
                            specialDates={specialDates}
                            onAddSpecialDate={handleSpecialDateAdd}
                            onRemoveSpecialDate={handleSpecialDateRemove}
                        />
                    </motion.div>)}
            </AnimatePresence>

            <motion.div
                className="flex gap-2 justify-end sticky bottom-0 bg-base-100 pt-4"
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
            >
                <motion.button
                    onClick={handleSave}
                    className="btn btn-primary"
                    disabled={isLoading}
                    whileHover={{scale: 1.02}}
                    whileTap={{scale: 0.98}}
                >
                    {isLoading ? (<span className="loading loading-spinner loading-sm"/>) : ('Save Changes')}
                </motion.button>
            </motion.div>
        </div>);
}