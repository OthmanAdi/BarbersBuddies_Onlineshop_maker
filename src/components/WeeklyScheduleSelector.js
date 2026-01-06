import React from 'react';
import {Copy, Trash2} from 'lucide-react';

const WeeklyScheduleSelector = ({schedule, onScheduleChange, language = 'en'}) => {
    const translations = {
        en: {
            weekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            closed: 'Closed',
            start: 'Start Time',
            end: 'End Time',
            save: 'Save',
            close: 'Close',
            schedules: {
                fullDay: 'Full Day',
                morning: 'Morning',
                afternoon: 'Afternoon',
                evening: 'Evening'
            }
        },
        tr: {
            weekDays: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
            closed: 'Kapalı',
            start: 'Başlangıç',
            end: 'Bitiş',
            save: 'Kaydet',
            close: 'Kapat',
            schedules: {
                fullDay: 'Tam Gün',
                morning: 'Sabah',
                afternoon: 'Öğleden Sonra',
                evening: 'Akşam'
            }
        },
        ar: {
            weekDays: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
            closed: 'مغلق',
            start: 'وقت البدء',
            end: 'وقت الانتهاء',
            save: 'حفظ',
            close: 'إغلاق',
            schedules: {
                fullDay: 'يوم كامل',
                morning: 'صباحاً',
                afternoon: 'ظهراً',
                evening: 'مساءً'
            }
        },
        de: {
            weekDays: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
            closed: 'Geschlossen',
            start: 'Startzeit',
            end: 'Endzeit',
            save: 'Speichern',
            close: 'Schließen',
            schedules: {
                fullDay: 'Ganztags',
                morning: 'Morgens',
                afternoon: 'Nachmittags',
                evening: 'Abends'
            }
        }
    };

    const commonSchedules = {
        fullDay: {
            label: translations[language].schedules.fullDay,
            hours: [9, 17]
        },
        morning: {
            label: translations[language].schedules.morning,
            hours: [9, 13]
        },
        afternoon: {
            label: translations[language].schedules.afternoon,
            hours: [13, 17]
        },
        evening: {
            label: translations[language].schedules.evening,
            hours: [17, 21]
        }
    };

    const generateHoursArray = (start, end) => {
        const hours = [];
        for (let i = start; i <= end; i++) {
            hours.push(i);
        }
        return hours;
    };

    const updateDaySchedule = (day, newHours) => {
        onScheduleChange({
            ...schedule,
            [day]: newHours
        });
    };

    return (
        <div className="space-y-4">
            {translations[language].weekDays.map((day) => (
                <div key={day} className="collapse collapse-plus bg-base-200">
                    <input type="checkbox"/>
                    <div className="collapse-title flex items-center justify-between">
                        <span className="font-medium">{day}</span>
                        <span className="text-sm opacity-70">
                            {schedule[day]?.length > 0
                                ? `${Math.min(...schedule[day])}:00 - ${Math.max(...schedule[day])}:00`
                                : translations[language].closed}
                        </span>
                    </div>
                    <div className="collapse-content">
                        <div className="pt-4 space-y-4">
                            {/* Quick schedules */}
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(commonSchedules).map(([key, {label, hours}]) => (
                                    <button
                                        key={key}
                                        onClick={() => updateDaySchedule(day, generateHoursArray(...hours))}
                                        className={`btn btn-sm ${
                                            schedule[day]?.length > 0 &&
                                            Math.min(...schedule[day]) === hours[0] &&
                                            Math.max(...schedule[day]) === hours[1]
                                                ? 'btn-primary'
                                                : 'btn-outline'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => updateDaySchedule(day, [])}
                                    className={`btn btn-sm ${
                                        !schedule[day]?.length ? 'btn-error' : 'btn-outline'
                                    }`}
                                >
                                    {translations[language].closed}
                                </button>
                            </div>

                            {/* Custom time selector */}
                            <div className="flex items-center gap-4">
                                <select
                                    className="select select-bordered flex-1"
                                    value={schedule[day]?.[0] || ''}
                                    onChange={(e) => {
                                        const start = parseInt(e.target.value);
                                        const end = schedule[day]?.[schedule[day].length - 1] || start + 1;
                                        updateDaySchedule(day, generateHoursArray(start, end));
                                    }}
                                >
                                    {Array.from({length: 24}, (_, i) => (
                                        <option key={i} value={i}>
                                            {`${i.toString().padStart(2, '0')}:00`}
                                        </option>
                                    ))}
                                </select>
                                <span>to</span>
                                <select
                                    className="select select-bordered flex-1"
                                    value={schedule[day]?.[schedule[day]?.length - 1] || ''}
                                    onChange={(e) => {
                                        const end = parseInt(e.target.value);
                                        const start = schedule[day]?.[0] || end - 1;
                                        updateDaySchedule(day, generateHoursArray(start, end));
                                    }}
                                >
                                    {Array.from({length: 24}, (_, i) => (
                                        <option key={i} value={i}>
                                            {`${i.toString().padStart(2, '0')}:00`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            <div className="flex justify-end gap-2">
                <button
                    onClick={() => {
                        const mondaySchedule = schedule['Monday'] || [];
                        const updatedSchedule = {};
                        translations[language].weekDays.forEach(day => {
                            updatedSchedule[day] = [...mondaySchedule];
                        });
                        onScheduleChange(updatedSchedule);
                    }}
                    className="btn btn-outline btn-sm gap-2"
                >
                    <Copy className="w-4 h-4"/>
                    Copy Monday to all days
                </button>
                <button
                    onClick={() => {
                        const clearedSchedule = {};
                        translations[language].weekDays.forEach(day => {
                            clearedSchedule[day] = [];
                        });
                        onScheduleChange(clearedSchedule);
                    }}
                    className="btn btn-ghost btn-sm gap-2 text-error"
                >
                    <Trash2 className="w-4 h-4"/>
                    Clear All
                </button>
            </div>
        </div>
    );
};

export default WeeklyScheduleSelector;