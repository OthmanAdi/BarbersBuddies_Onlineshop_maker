import React, {useEffect, useRef, useState} from 'react';
import {Calendar as CalIcon, ChevronLeft, ChevronRight, Coffee, Star, Tag} from 'lucide-react';
import AnalyticsDashboard2 from "./AnalyticsDashboard2";
import SelectionList from "./CalendarInstructions";

const BarberCalendar = ({availability, specialDates, setSpecialDates, t}) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [dragEnd, setDragEnd] = useState(null);
    const [selectedDates, setSelectedDates] = useState([]);
    const [editMode, setEditMode] = useState('regular');
    const [selectionFields, setSelectionFields] = useState([]);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileSelection, setMobileSelection] = useState({start: null, end: null});
    const [showMobileConfirm, setShowMobileConfirm] = useState(false);
    const calendarRef = useRef(null);
    const today = new Date();
    const [isExpanded, setIsExpanded] = useState(false);

    if (typeof setSpecialDates !== 'function') {
        console.error('setSpecialDates must be a function');
        // Provide a no-op function as fallback
        setSpecialDates = () => {
        };
    }

    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const modeColors = {
        regular: 'bg-primary/20 hover:bg-primary/30',
        holiday: 'bg-red-200 hover:bg-red-300',
        special: 'bg-yellow-200 hover:bg-yellow-300',
        promo: 'bg-green-200 hover:bg-green-300'
    };

    const modeIcons = {
        regular: CalIcon,
        holiday: Coffee,
        special: Star,
        promo: Tag
    };

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const formatDate = (date) => {
        return date ? date.toISOString().split('T')[0] : '';
    };

    const isDateInRange = (date, start, end) => {
        if (!start || !end || !date) return false;
        const startTime = new Date(Math.min(start.getTime(), end.getTime()));
        const endTime = new Date(Math.max(start.getTime(), end.getTime()));
        return date >= startTime && date <= endTime;
    };

    // Mobile-specific date selection handler
    const handleMobileDateSelect = (date) => {
        if (!date || date < today) return;

        if (!mobileSelection.start) {
            setMobileSelection({start: date, end: null});
        } else if (!mobileSelection.end) {
            if (date < mobileSelection.start) {
                setMobileSelection(prev => ({...prev, end: prev.start, start: date}));
            } else {
                setMobileSelection(prev => ({...prev, end: date}));
            }
            setShowMobileConfirm(true);
        } else {
            setMobileSelection({start: date, end: null});
            setShowMobileConfirm(false);
        }
    };

    // Desktop drag selection handlers
    const handleMouseDown = (date) => {
        if (!date || date < today || isMobile) return;
        setIsDragging(true);
        setDragStart(date);
        setDragEnd(date);
    };

    const handleMouseMove = (date) => {
        if (isDragging && date) {
            setDragEnd(date);
        }
    };

    const handleSelectionComplete = (start, end) => {
        if (!start || !end) return;

        const startDate = new Date(Math.min(start.getTime(), end.getTime()));
        const endDate = new Date(Math.max(start.getTime(), end.getTime()));

        // Check for any date in the new range that's already selected
        const isOverlapping = selectionFields.some(field => {
            const rangeStart = field.start;
            const rangeEnd = field.end;
            return (
                (startDate <= rangeEnd && endDate >= rangeStart) || // Range overlap
                isDateInRange(startDate, rangeStart, rangeEnd) ||   // Start date in existing range
                isDateInRange(endDate, rangeStart, rangeEnd)        // End date in existing range
            );
        });

        if (!isOverlapping) {
            const newField = {
                start: startDate,
                end: endDate,
                type: editMode
            };

            setSelectionFields(prev => [...prev, newField]);
            setSpecialDates(prev => ({
                ...prev,
                [formatDate(newField.start)]: {
                    type: newField.type,
                    endDate: formatDate(newField.end)
                }
            }));
        }
    };

    const handleMouseUp = () => {
        if (isDragging && dragStart && dragEnd) {
            handleSelectionComplete(dragStart, dragEnd);
        }
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
    };

    // Handle mobile selection confirmation
    const handleMobileConfirm = () => {
        if (mobileSelection.start && mobileSelection.end) {
            handleSelectionComplete(mobileSelection.start, mobileSelection.end);
            setMobileSelection({start: null, end: null});
            setShowMobileConfirm(false);
        }
    };

    useEffect(() => {
        if (specialDates) {
            const fields = Object.entries(specialDates).map(([startDate, data]) => ({
                start: new Date(startDate),
                end: new Date(data.endDate),
                type: data.type
            }));
            setSelectionFields(fields);
        }

        // Add click outside listener for desktop
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                handleMouseUp();
            }
        };

        document.addEventListener('mouseup', handleClickOutside);
        return () => document.removeEventListener('mouseup', handleClickOutside);
    }, []);

    const handleRemoveSelection = (index, field) => {
        setSelectionFields(prev => prev.filter((_, i) => i !== index));
        setSpecialDates(prev => {
            const newDates = {...prev};
            delete newDates[formatDate(field.start)];
            return newDates;
        });
    };

    const getAnalytics = () => {
        const total = selectionFields.length;
        const byType = {
            holiday: selectionFields.filter(f => f.type === 'holiday').length,
            special: selectionFields.filter(f => f.type === 'special').length,
            promo: selectionFields.filter(f => f.type === 'promo').length
        };
        return {total, byType};
    };

    const analytics = getAnalytics();

    return (
        <div className="space-y-6 w-full max-w-4xl mx-auto">
            {/* Calendar Controls */}
            <div
                className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-base-100 p-4 rounded-lg shadow-lg">
                <div className="flex items-center gap-4">
                    <button
                        className="btn btn-circle btn-sm"
                        onClick={() => {
                            const newDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1);
                            if (newDate.getMonth() >= today.getMonth() && newDate.getFullYear() >= today.getFullYear()) {
                                setSelectedMonth(newDate);
                            }
                        }}
                        disabled={selectedMonth.getMonth() === today.getMonth() && selectedMonth.getFullYear() === today.getFullYear()}
                    >
                        <ChevronLeft className="w-4 h-4"/>
                    </button>
                    <h3 className="text-xl font-bold">
                        {months[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
                    </h3>
                    <button
                        className="btn btn-circle btn-sm"
                        onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                    >
                        <ChevronRight className="w-4 h-4"/>
                    </button>
                </div>

                <div className="join shadow-lg">
                    {Object.entries(modeIcons).map(([mode, Icon]) => (
                        <button
                            key={mode}
                            className={`join-item btn btn-sm gap-2 ${editMode === mode ? 'btn-primary' : 'btn-ghost'}
                            transition-all duration-300 hover:scale-105`}
                            onClick={() => setEditMode(mode)}
                        >
                            <Icon className="w-4 h-4"/>
                            <span className="capitalize">{mode}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile Selection Instructions */}
            {isMobile && (
                <div className="bg-base-100 p-4 rounded-lg shadow-lg text-center">
                    <p className="text-sm text-gray-600">
                        {!mobileSelection.start
                            ? "Tap to select start date"
                            : !mobileSelection.end
                                ? "Tap to select end date"
                                : "Confirm your selection"}
                    </p>
                </div>
            )}

            {/* Calendar Grid */}
            <div
                ref={calendarRef}
                className="select-none bg-base-100 rounded-lg shadow-xl p-4"
                onMouseLeave={!isMobile ? handleMouseUp : undefined}
            >
                <div className="grid grid-cols-7 gap-2 mb-4">
                    {weekDays.map(day => (
                        <div key={day} className="text-center font-semibold text-gray-500">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {getDaysInMonth(selectedMonth).map((date, index) => {
                        const isInDragRange = !isMobile && isDragging && date && isDateInRange(date, dragStart, dragEnd);
                        const isInMobileRange = isMobile && date && isDateInRange(date, mobileSelection.start, mobileSelection.end);
                        const existingSelections = selectionFields.filter(field =>
                            date && isDateInRange(date, field.start, field.end)
                        );
                        const isPast = date && date < today;
                        const isMobileStart = isMobile && date && mobileSelection.start &&
                            date.getTime() === mobileSelection.start.getTime();
                        const isMobileEnd = isMobile && date && mobileSelection.end &&
                            date.getTime() === mobileSelection.end.getTime();

                        return (
                            <div
                                key={index}
                                className={`
                                    relative aspect-square flex items-center justify-center
                                    transition-all duration-200 text-base
                                    ${date ? 'cursor-pointer hover:scale-105' : ''}
                                    ${isPast ? 'opacity-50 cursor-not-allowed' : ''}
                                    ${isInDragRange || isInMobileRange ? modeColors[editMode] : ''}
                                    ${existingSelections.length > 0 ? modeColors[existingSelections[0].type] : ''}
                                    ${isMobileStart || isMobileEnd ? 'ring-2 ring-primary' : ''}
                                    rounded-lg shadow-sm hover:shadow-md
                                    ${isMobile ? 'touch-manipulation' : ''}
                                `}
                                onMouseDown={() => !isMobile && handleMouseDown(date)}
                                onMouseMove={() => !isMobile && handleMouseMove(date)}
                                onMouseUp={() => !isMobile && handleMouseUp()}
                                onClick={() => isMobile && handleMobileDateSelect(date)}
                            >
                                {date && (
                                    <>
                                        <span className={`
                                            ${isPast ? 'text-gray-400' : ''}
                                            ${existingSelections.length > 0 ? 'font-bold' : ''}
                                        `}>
                                            {date.getDate()}
                                        </span>
                                        {existingSelections.length > 0 && (
                                            <div className="absolute -top-1 -right-1">
                                                {React.createElement(modeIcons[existingSelections[0].type], {
                                                    className: 'w-3 h-3'
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Confirmation Button */}
            {isMobile && showMobileConfirm && (
                <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50 px-4">
                    <button
                        className="btn btn-primary btn-lg w-full max-w-md shadow-lg"
                        onClick={handleMobileConfirm}
                    >
                        Confirm Selection
                    </button>
                </div>
            )}

            {/* Analytics Dashboard */}
            <AnalyticsDashboard2 analytics={analytics}/>

            {/* Selection List - Floating Panel */}
            <SelectionList
                selectionFields={selectionFields}
                isMobile={isMobile}
                mobileSelection={mobileSelection}
                isExpanded={isExpanded}
                setIsExpanded={setIsExpanded}
                handleRemoveSelection={handleRemoveSelection}
                modeColors={modeColors}
                modeIcons={modeIcons}
            />

            {/* Touch Event Styles for Mobile */}
            <style jsx>{`
                @media (max-width: 768px) {
                    .touch-manipulation {
                        touch-action: manipulation;
                        -webkit-tap-highlight-color: transparent;
                    }
                }

                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default BarberCalendar;