import React from 'react';
import {motion} from 'framer-motion';
import {AlertCircle, Clock} from 'lucide-react';

const AvailabilityCard = ({shop, t}) => {
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const today = new Date().toLocaleString('en-US', {weekday: 'long'});

    const isHoliday = (date) => {
        if (!shop.specialDates) return false;
        return Object.entries(shop.specialDates).some(([dateStr, details]) => {
            if (details.type !== 'holiday') return false;
            const [holidayStart, holidayEnd] = [new Date(dateStr), new Date(details.endDate)];
            const checkDate = new Date(date);
            return checkDate >= holidayStart && checkDate <= holidayEnd;
        });
    };

    const getCurrentDateForDay = (day) => {
        const date = new Date();
        const currentDay = date.getDay();
        const targetDay = daysOrder.indexOf(day);
        const diff = targetDay - (currentDay === 0 ? 7 : currentDay);
        date.setDate(date.getDate() + diff);
        return date.toISOString().split('T')[0];
    };

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="bg-base-200/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-primary">
                        <Clock className="w-4 h-4"/>
                        <span className="text-sm font-medium">{t.availability}</span>
                    </div>
                    {Object.keys(shop.specialDates || {}).length > 0 && (
                        <div className="flex items-center gap-1 text-warning text-xs">
                            <AlertCircle className="w-3 h-3"/>
                            <span>Holiday periods marked</span>
                        </div>
                    )}
                </div>

                <div className="space-y-1.5">
                    {daysOrder.map((day) => {
                        const hours = shop.availability?.[day];
                        const isOpen = hours?.open && hours?.close;
                        const isToday = day === today;
                        const dateStr = getCurrentDateForDay(day);
                        const dayHoliday = isHoliday(dateStr);

                        return (
                            <motion.div
                                key={day}
                                initial={{opacity: 0, x: -5}}
                                animate={{opacity: 1, x: 0}}
                                className={`
                                flex justify-between items-center px-3 py-2 rounded-md
                                ${isToday ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-base-300/30'}
                                ${dayHoliday ? 'bg-warning/10 ring-1 ring-warning/20' : ''}
                                hover:bg-base-300/50 transition-all duration-200
                            `}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`
                                    w-1.5 h-1.5 rounded-full 
                                    ${isOpen && !dayHoliday ? 'bg-success animate-pulse' : ''}
                                    ${dayHoliday ? 'bg-warning' : ''}
                                    ${!isOpen && !dayHoliday ? 'bg-error/50' : ''}
                                `}/>
                                    <div className="flex flex-col">
                                    <span className="text-sm font-medium flex items-center gap-2">
                                        {day}
                                        {isToday && (
                                            <span
                                                className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                                                Today
                                            </span>
                                        )}
                                    </span>
                                        {dayHoliday && (
                                            <span className="text-xs text-warning">Holiday Period</span>
                                        )}
                                    </div>
                                </div>
                                <span className={`
                                text-sm font-medium 
                                ${isOpen && !dayHoliday ? 'text-base-content' : ''} 
                                ${dayHoliday ? 'text-warning' : ''} 
                                ${!isOpen && !dayHoliday ? 'text-base-content/50' : ''}
                            `}>
                                {dayHoliday ? 'Closed for Holiday' :
                                    isOpen ? `${hours.open} - ${hours.close}` :
                                        t.closed}
                            </span>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AvailabilityCard;