import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown } from 'lucide-react';

const OpeningTimeList = ({shop}) => {
    const [isOpen, setIsOpen] = useState(false);
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const today = new Date().toLocaleString('en-US', {weekday: 'long'});

    const isDayHoliday = (day) => {
        const date = new Date();
        const currentWeekDay = date.getDay();
        const targetDayIndex = daysOrder.indexOf(day);
        const daysDiff = targetDayIndex - (currentWeekDay === 0 ? 6 : currentWeekDay - 1);

        const targetDate = new Date(date);
        targetDate.setDate(date.getDate() + daysDiff);
        const formattedDate = targetDate.toISOString().split('T')[0];

        const specialDate = shop.specialDates?.[formattedDate];
        return specialDate?.type === 'holiday' || specialDate?.type === 'special' || specialDate?.type === 'promo' || specialDate?.type === 'regular';
    };

    // Get today's data
    const todayData = shop.availability?.[today];
    const isOpenToday = todayData?.open && todayData?.close;
    const isHolidayToday = isDayHoliday(today);
    const todayDate = new Date();
    const formattedTodayDate = todayDate.toISOString().split('T')[0];
    const specialDateToday = shop.specialDates?.[formattedTodayDate];

    return (
        <div className="w-full">
            {/* Preview Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full p-3 rounded-lg
                    transition-all duration-300 
                    flex flex-col gap-1.5
                    ${specialDateToday?.type === 'holiday' ? 'bg-orange-200/40' :
                    specialDateToday?.type === 'special' ? 'bg-blue-200/40' :
                        specialDateToday?.type === 'promo' ? 'bg-green-200/40' :
                            specialDateToday?.type === 'regular' ? 'bg-gray-200/40' :
                                'bg-base-300/30'
                }
                    hover:filter hover:brightness-95
                `}
            >
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 text-primary">
                        <Clock className="w-4 h-4"/>
                        <span className="text-sm font-medium">Opening Hours</span>
                    </div>
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <ChevronDown className="w-5 h-5 text-base-content/70" />
                    </motion.div>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className={`
                            w-1.5 h-1.5 rounded-full
                            ${isOpenToday && !isHolidayToday ? 'bg-success animate-pulse' : 'bg-error/50'}
                        `}/>
                        <span>{today}</span>
                    </div>
                    <span className="font-medium tabular-nums">
                        {isOpenToday ? `${todayData.open}-${todayData.close}` : 'Closed'}
                        {specialDateToday?.type &&
                            <span className="ml-1 text-[10px] opacity-75">
                                ({specialDateToday.type.charAt(0).toUpperCase() + specialDateToday.type.slice(1)})
                            </span>
                        }
                    </span>
                </div>
            </motion.button>

            {/* Expandable Content */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-2">
                            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-1.5 text-xs">
                                {daysOrder.map((day, index) => {
                                    const dayData = shop.availability?.[day];
                                    const isOpen = dayData?.open && dayData?.close;
                                    const isToday = day === today;
                                    const isHoliday = isDayHoliday(day);
                                    const date = new Date();
                                    const targetDate = new Date(date);
                                    const daysDiff = daysOrder.indexOf(day) - (date.getDay() === 0 ? 6 : date.getDay() - 1);
                                    targetDate.setDate(date.getDate() + daysDiff);
                                    const formattedDate = targetDate.toISOString().split('T')[0];
                                    const specialDate = shop.specialDates?.[formattedDate];

                                    return (
                                        <motion.div
                                            key={day}
                                            initial={{x: -10, opacity: 0}}
                                            animate={{x: 0, opacity: 1}}
                                            transition={{delay: index * 0.05}}
                                            className={`
                                                grid grid-cols-1
                                                min-h-[2.5rem]
                                                p-1.5 rounded
                                                ${isToday ? 'bg-primary/10 ring-1 ring-primary/20' : ''}
                                                ${specialDate?.type === 'holiday' ? 'bg-orange-200/40' : ''}
                                                ${specialDate?.type === 'special' ? 'bg-blue-200/40' : ''}
                                                ${specialDate?.type === 'promo' ? 'bg-green-200/40' : ''}
                                                ${specialDate?.type === 'regular' ? 'bg-gray-200/40' : ''}
                                                ${isOpen ? 'text-base-content' : 'text-base-content/50'}
                                            `}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <div className={`
                                                    w-1.5 h-1.5 rounded-full flex-shrink-0
                                                    ${isOpen && !isHoliday ? 'bg-success animate-pulse' : 'bg-error/50'}
                                                `}/>
                                                <span className="flex-shrink-0 w-8">{day.slice(0, 3)}</span>
                                            </div>

                                            <span className={`
                                                flex flex-col
                                                font-medium
                                                max-[1572px]:min-[1024px]:mt-1
                                                max-[1572px]:min-[1024px]:pl-4
                                                max-[1114px]:ml-auto
                                                min-[1572px]:ml-auto
                                                flex-shrink-0
                                            `}>
                                                <span className="tabular-nums">
                                                    {isOpen ? `${dayData.open}-${dayData.close}` : 'Closed'}
                                                </span>
                                                {specialDate?.type &&
                                                    <span className="text-[10px] opacity-75">
                                                        ({specialDate.type.charAt(0).toUpperCase() + specialDate.type.slice(1)})
                                                    </span>
                                                }
                                            </span>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default OpeningTimeList;