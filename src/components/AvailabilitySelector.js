import React, {useContext, useEffect, useState} from 'react';
import {Clock} from 'lucide-react';
import TimePicker from './TimePicker';
import LanguageContext from "./LanguageContext";

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const AvailabilitySelector = ({availability, setAvailability}) => {
    const [useGeneralHours, setUseGeneralHours] = useState(true);
    const [generalHours, setGeneralHours] = useState({open: '09:00', close: '17:00'});
    const [customWeekdays, setCustomWeekdays] = useState({});
    const {language} = useContext(LanguageContext);

    useEffect(() => {
        if (useGeneralHours) {
            const updatedAvailability = {...availability};
            weekdays.forEach(day => {
                if (!customWeekdays[day]) {
                    updatedAvailability[day] = {...generalHours};
                }
            });
            setAvailability(updatedAvailability);
        }
    }, [useGeneralHours, generalHours]);

    const handleGeneralHoursChange = (type, value) => {
        setGeneralHours(prev => ({...prev, [type]: value}));
    };

    const handleDayToggle = (day) => {
        setAvailability(prev => ({
            ...prev,
            [day]: prev[day] ? null : (weekdays.includes(day) && useGeneralHours && !customWeekdays[day] ? generalHours : {
                open: '09:00',
                close: '17:00'
            })
        }));
    };

    const handleHourChange = (day, type, value) => {
        setAvailability(prev => ({
            ...prev,
            [day]: {...prev[day], [type]: value}
        }));
        if (weekdays.includes(day)) {
            setCustomWeekdays(prev => ({...prev, [day]: true}));
        }
    };

    const toggleGeneralHours = () => {
        setUseGeneralHours(prev => !prev);
    };

    const resetToGeneralHours = (day) => {
        setAvailability(prev => ({
            ...prev,
            [day]: {...generalHours}
        }));
        setCustomWeekdays(prev => ({...prev, [day]: false}));
    };

    const translations = {
        en: {
            storeHours: "Store Hours",
            useGeneralWeekdayHours: "Use general weekday hours",
            generalWeekdayHours: "General Weekday Hours (Mon-Fri)",
            open: "Open:",
            close: "Close:",
            monday: "Monday",
            tuesday: "Tuesday",
            wednesday: "Wednesday",
            thursday: "Thursday",
            friday: "Friday",
            saturday: "Saturday",
            sunday: "Sunday",
            resetToGeneralHours: "Reset to General Hours",
            usingGeneralWeekdayHours: "Using general weekday hours"
        },
        tr: {
            storeHours: "Çalışma Saatleri",
            useGeneralWeekdayHours: "Genel hafta içi saatlerini kullan",
            generalWeekdayHours: "Genel Hafta İçi Saatleri (Pzt-Cum)",
            open: "Açılış:",
            close: "Kapanış:",
            monday: "Pazartesi",
            tuesday: "Salı",
            wednesday: "Çarşamba",
            thursday: "Perşembe",
            friday: "Cuma",
            saturday: "Cumartesi",
            sunday: "Pazar",
            resetToGeneralHours: "Genel Saatlere Sıfırla",
            usingGeneralWeekdayHours: "Genel hafta içi saatleri kullanılıyor"
        },
        ar: {
            storeHours: "ساعات العمل",
            useGeneralWeekdayHours: "استخدام ساعات العمل العامة للأيام العادية",
            generalWeekdayHours: "ساعات العمل العامة للأيام العادية (الاثنين-الجمعة)",
            open: "الفتح:",
            close: "الإغلاق:",
            monday: "الاثنين",
            tuesday: "الثلاثاء",
            wednesday: "الأربعاء",
            thursday: "الخميس",
            friday: "الجمعة",
            saturday: "السبت",
            sunday: "الأحد",
            resetToGeneralHours: "إعادة تعيين إلى الساعات العامة",
            usingGeneralWeekdayHours: "استخدام ساعات العمل العامة للأيام العادية"
        },
        de: {
            storeHours: "Öffnungszeiten",
            useGeneralWeekdayHours: "Allgemeine Wochentagszeiten verwenden",
            generalWeekdayHours: "Allgemeine Wochentagszeiten (Mo-Fr)",
            open: "Öffnen:",
            close: "Schließen:",
            monday: "Montag",
            tuesday: "Dienstag",
            wednesday: "Mittwoch",
            thursday: "Donnerstag",
            friday: "Freitag",
            saturday: "Samstag",
            sunday: "Sonntag",
            resetToGeneralHours: "Auf allgemeine Zeiten zurücksetzen",
            usingGeneralWeekdayHours: "Verwendung allgemeiner Wochentagszeiten"
        }
    };

    const t = translations[language];

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t.storeHours}</h3>

            <div className="flex items-center space-x-4 mb-4">
                <label className="cursor-pointer label">
                    <span className="label-text mr-2">{t.useGeneralWeekdayHours}</span>
                    <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={useGeneralHours}
                        onChange={toggleGeneralHours}
                    />
                </label>
            </div>

            {useGeneralHours && (
                <div className="card bg-base-200 shadow-xl p-4 mb-4">
                    <h4 className="font-semibold mb-2">{t.generalWeekdayHours}</h4>
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                        <div className="flex items-center space-x-2">
                            <Clock size={20}/>
                            <span>{t.open}</span>
                            <TimePicker
                                value={generalHours.open}
                                onChange={(value) => handleGeneralHoursChange('open', value)}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Clock size={20}/>
                            <span>{t.close}</span>
                            <TimePicker
                                value={generalHours.close}
                                onChange={(value) => handleGeneralHoursChange('close', value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {days.map(day => (
                    <div key={day} className="card bg-base-100 shadow-xl">
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="card-title text-lg">{t[day.toLowerCase()]}</h2>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-primary"
                                    checked={!!availability[day]}
                                    onChange={() => handleDayToggle(day)}
                                />
                            </div>
                            {availability[day] && (
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Clock size={20}/>
                                        <span>{t.open}</span>
                                        <TimePicker
                                            value={availability[day].open}
                                            onChange={(value) => handleHourChange(day, 'open', value)}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Clock size={20}/>
                                        <span>{t.close}</span>
                                        <TimePicker
                                            value={availability[day].close}
                                            onChange={(value) => handleHourChange(day, 'close', value)}
                                        />
                                    </div>
                                    {useGeneralHours && weekdays.includes(day) && customWeekdays[day] && (
                                        <button
                                            className="btn btn-sm btn-outline mt-2"
                                            onClick={() => resetToGeneralHours(day)}
                                        >
                                            {t.resetToGeneralHours}
                                        </button>
                                    )}
                                </div>
                            )}
                            {availability[day] && useGeneralHours && weekdays.includes(day) && !customWeekdays[day] && (
                                <p className="text-sm text-gray-500">{t.usingGeneralWeekdayHours}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AvailabilitySelector;