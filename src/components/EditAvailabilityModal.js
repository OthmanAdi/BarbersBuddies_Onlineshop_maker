import React, {useEffect, useState} from 'react';
import {doc, updateDoc} from 'firebase/firestore';
import {db} from '../firebase';
import BarberCalendar from './BarberCalendar';
import {Calendar as CalIcon, ChevronDown, Clock, Save, X} from 'lucide-react';

const EditAvailabilityModal = ({shop, isOpen, onClose, onSave}) => {
    const [availability, setAvailability] = useState(shop.availability || {});
    const [specialDates, setSpecialDates] = useState(shop.specialDates || {});
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('hours');
    const [expandedDay, setExpandedDay] = useState(null);
    const [isMobile, setIsMobile] = useState(false);

    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const isDayEnabled = (day) => {
        return availability[day] && availability[day].open && availability[day].close;
    };

    const handleTimeChange = (day, type, value) => {
        setAvailability(prev => ({
            ...prev,
            [day]: {
                ...(prev[day] || {}),
                [type]: value,
                slotDuration: slotDurations[day] // Include slot duration in availability
            }
        }));
    };

    const handleSlotDurationChange = (day, duration) => {
        setSlotDurations(prev => ({
            ...prev,
            [day]: duration
        }));

        // Also update the availability state to include the new duration
        setAvailability(prev => ({
            ...prev,
            [day]: {
                ...(prev[day] || {}),
                slotDuration: duration
            }
        }));
    };

    const toggleDayOff = (day) => {
        setAvailability(prev => ({
            ...prev,
            [day]: isDayEnabled(day) ? null : {open: '09:00', close: '17:00'}
        }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const cleanedAvailability = Object.entries(availability).reduce((acc, [day, hours]) => {
                if (hours && hours.open && hours.close) {
                    acc[day] = hours;
                }
                return acc;
            }, {});

            const shopRef = doc(db, 'barberShops', shop.id);
            await updateDoc(shopRef, {
                availability: cleanedAvailability,
                specialDates
            });
            onSave({...shop, availability: cleanedAvailability, specialDates});
            onClose();
        } catch (error) {
            console.error('Error updating availability:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderTimeSelectors = (day) => (
            <>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center flex-1 animate-slideDown">
                    <select
                        className="select select-bordered w-full md:w-auto"
                        value={availability[day]?.open || '09:00'}
                        onChange={(e) => handleTimeChange(day, 'open', e.target.value)}
                    >
                        {Array.from({length: 24}, (_, i) => (
                            <option key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                                {`${i.toString().padStart(2, '0')}:00`}
                            </option>
                        ))}
                    </select>
                    <span className="hidden md:block">to</span>
                    <select
                        className="select select-bordered w-full md:w-auto"
                        value={availability[day]?.close || '17:00'}
                        onChange={(e) => handleTimeChange(day, 'close', e.target.value)}
                    >
                        {Array.from({length: 24}, (_, i) => (
                            <option key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                                {`${i.toString().padStart(2, '0')}:00`}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="w-full space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Slot Duration</span>
                        <span className="text-sm font-bold">{slotDurations[day]}min</span>
                    </div>
                    <div className="relative h-12 bg-base-200 rounded-lg">
                        <div
                            className="absolute inset-y-0 left-0 bg-primary rounded-lg transition-all duration-200"
                            style={{width: `${((slotDurations[day] - 15) / 45) * 100}%`}}
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
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[15, 30, 45, 60].map((duration) => (
                            <button
                                key={duration}
                                onClick={() => handleSlotDurationChange(day, duration)}
                                className={`btn btn-sm ${
                                    slotDurations[day] === duration ? 'btn-primary' : 'btn-ghost'
                                }`}
                            >
                                {duration}m
                            </button>
                        ))}
                    </div>
                </div>
            </>
        )
    ;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [slotDurations, setSlotDurations] = useState(() => {
        // Initialize with the shop's existing slot durations or default to 30
        const durations = {};
        weekDays.forEach(day => {
            durations[day] = shop.availability?.[day]?.slotDuration || 30;
        });
        return durations;
    });

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-0 md:p-4">
            <div
                className="modal-box max-w-4xl w-full h-full md:h-auto bg-base-100 rounded-none md:rounded-lg shadow-xl flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-base-100 z-[70]">
                    <h3 className="text-lg font-bold">Edit Availability</h3>
                    <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
                        <X className="w-4 h-4"/>
                    </button>
                </div>

                {/* Mobile Tabs */}
                {isMobile && (
                    <div className="flex border-b sticky top-16 bg-base-100 z-[65]">
                        <button
                            className={`flex-1 p-4 text-center relative ${activeTab === 'hours' ? 'text-primary' : ''}`}
                            onClick={() => setActiveTab('hours')}
                        >
                            <Clock className="w-4 h-4 mx-auto mb-1"/>
                            Regular Hours
                            {activeTab === 'hours' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"/>
                            )}
                        </button>
                        <button
                            className={`flex-1 p-4 text-center relative ${activeTab === 'special' ? 'text-primary' : ''}`}
                            onClick={() => setActiveTab('special')}
                        >
                            <CalIcon className="w-4 h-4 mx-auto mb-1"/>
                            Special Dates
                            {activeTab === 'special' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"/>
                            )}
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto pb-24">
                    <div className="p-4 md:p-6 space-y-6">
                        {/* Regular Hours Section */}
                        <div className={`space-y-4 ${isMobile && activeTab !== 'hours' ? 'hidden' : ''}`}>
                            {!isMobile && (
                                <h4 className="text-base font-semibold flex items-center gap-2">
                                    <Clock className="w-4 h-4"/>
                                    Regular Hours
                                </h4>
                            )}
                            <div className="grid gap-4">
                                {weekDays.map((day) => (
                                    <div key={day} className="card bg-base-200 shadow-sm">
                                        <div
                                            className="p-4 flex items-center justify-between cursor-pointer"
                                            onClick={() => isMobile && setExpandedDay(expandedDay === day ? null : day)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <label className="cursor-pointer label compact">
                                                    <input
                                                        type="checkbox"
                                                        className="toggle toggle-primary toggle-sm"
                                                        checked={isDayEnabled(day)}
                                                        onChange={() => toggleDayOff(day)}
                                                    />
                                                    <span className="label-text ml-2">{day}</span>
                                                </label>
                                            </div>
                                            {isMobile && isDayEnabled(day) && (
                                                <ChevronDown
                                                    className={`w-4 h-4 transition-transform duration-200 
                                                    ${expandedDay === day ? 'rotate-180' : ''}`}
                                                />
                                            )}
                                        </div>
                                        {isDayEnabled(day) && (!isMobile || expandedDay === day) && (
                                            <div className="px-4 pb-4">
                                                {renderTimeSelectors(day)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Special Dates Section */}
                        <div className={`space-y-4 relative ${isMobile && activeTab !== 'special' ? 'hidden' : ''}`}>
                            {!isMobile && (
                                <h4 className="text-base font-semibold">Special Dates</h4>
                            )}
                            <div className="relative pb-20">
                                <BarberCalendar
                                    availability={availability}
                                    specialDates={specialDates}
                                    setSpecialDates={setSpecialDates}
                                    t={{}}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="modal-action p-4 border-t mt-auto fixed bottom-0 left-0 right-0 bg-base-100 z-[80] md:relative">
                    <div className="max-w-4xl w-full mx-auto flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="btn btn-ghost"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="loading loading-spinner loading-sm"/>
                            ) : (
                                <Save className="w-4 h-4 mr-2"/>
                            )}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-slideDown {
                    animation: slideDown 0.2s ease-out;
                }

                @media (max-width: 768px) {
                    .modal-box {
                        margin: 0;
                        max-height: 100vh;
                        border-radius: 0;
                    }
                }

                /* Custom scrollbar */
                .overflow-auto {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
                }

                .overflow-auto::-webkit-scrollbar {
                    width: 6px;
                }

                .overflow-auto::-webkit-scrollbar-track {
                    background: transparent;
                }

                .overflow-auto::-webkit-scrollbar-thumb {
                    background-color: rgba(0, 0, 0, 0.2);
                    border-radius: 3px;
                }
            `}</style>
        </div>
    );
};

export default EditAvailabilityModal;