import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EmployeeDialog = ({ isOpen, onClose, employees = [], language }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    const translations = {
        en: {
            employees: "Meet Our Team",
            expertise: "Expertise",
            schedule: "Working Hours",
            close: "Close",
            monday: "Monday",
            tuesday: "Tuesday",
            wednesday: "Wednesday",
            thursday: "Thursday",
            friday: "Friday",
            saturday: "Saturday",
            sunday: "Sunday",
            noSchedule: "No schedule available",
            nextEmployee: "Next",
            prevEmployee: "Previous",
            ofTotal: "of"
        },
        tr: {
            employees: "Ekibimizle Tanışın",
            expertise: "Uzmanlık",
            schedule: "Çalışma Saatleri",
            close: "Kapat",
            monday: "Pazartesi",
            tuesday: "Salı",
            wednesday: "Çarşamba",
            thursday: "Perşembe",
            friday: "Cuma",
            saturday: "Cumartesi",
            sunday: "Pazar",
            noSchedule: "Program mevcut değil",
            nextEmployee: "Sonraki",
            prevEmployee: "Önceki",
            ofTotal: "/"
        },
        ar: {
            employees: "تعرف على فريقنا",
            expertise: "الخبرات",
            schedule: "ساعات العمل",
            close: "إغلاق",
            monday: "الإثنين",
            tuesday: "الثلاثاء",
            wednesday: "الأربعاء",
            thursday: "الخميس",
            friday: "الجمعة",
            saturday: "السبت",
            sunday: "الأحد",
            noSchedule: "لا يوجد جدول متاح",
            nextEmployee: "التالي",
            prevEmployee: "السابق",
            ofTotal: "من"
        },
        de: {
            employees: "Unser Team kennenlernen",
            expertise: "Fachgebiete",
            schedule: "Arbeitszeiten",
            close: "Schließen",
            monday: "Montag",
            tuesday: "Dienstag",
            wednesday: "Mittwoch",
            thursday: "Donnerstag",
            friday: "Freitag",
            saturday: "Samstag",
            sunday: "Sonntag",
            noSchedule: "Kein Zeitplan verfügbar",
            nextEmployee: "Weiter",
            prevEmployee: "Zurück",
            ofTotal: "von"
        }
    };

    const t = translations[language] || translations.en;

    const formatHour = (hour) => `${hour}:00`;

    const handleNext = () => setActiveIndex((prev) => (prev + 1) % employees.length);
    const handlePrev = () => setActiveIndex((prev) => (prev - 1 + employees.length) % employees.length);

    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) handleNext();
        if (isRightSwipe) handlePrev();
    };

    if (!isOpen) return null;

    const currentEmployee = employees[activeIndex];

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                onClick={onClose}
            >
                <div className="min-h-screen w-full overflow-hidden"
                     style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        transition={{ type: "spring", damping: 25 }}
                        className="bg-base-100 w-full h-[90vh] md:h-auto md:max-h-[85vh] md:max-w-2xl
                                 mx-auto relative mt-16 md:mt-20 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-base-100 z-50 px-6 py-4 border-b border-base-200">
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-xl font-bold text-base-content">{t.employees}</h2>
                                <button
                                    onClick={onClose}
                                    className="btn btn-ghost btn-sm btn-circle"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex justify-between items-center text-sm text-base-content/70">
                                <span>{activeIndex + 1} {t.ofTotal} {employees.length}</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePrev}
                                        className="btn btn-ghost btn-sm btn-circle"
                                        disabled={activeIndex === 0}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        className="btn btn-ghost btn-sm btn-circle"
                                        disabled={activeIndex === employees.length - 1}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div
                            className="h-[calc(100%-5rem)] overflow-y-auto pb-safe px-6 py-4"
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                        >
                            <motion.div
                                key={activeIndex}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ type: "spring", damping: 25 }}
                                className="space-y-6"
                            >
                                {/* Employee Image and Basic Info */}
                                <div className="text-center space-y-4">
                                    <div className="relative w-32 h-32 mx-auto">
                                        <img
                                            src={currentEmployee?.photo || '/api/placeholder/128/128'}
                                            alt={currentEmployee?.name}
                                            className="w-full h-full rounded-full object-cover border-4 border-primary/10"
                                        />
                                    </div>
                                    <h3 className="text-xl font-bold text-base-content">
                                        {currentEmployee?.name}
                                    </h3>
                                </div>

                                {/* Expertise Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-base-content/70">
                                        <Award className="w-4 h-4"/>
                                        <span className="font-medium text-sm">{t.expertise}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 justify-center">
                                        {currentEmployee?.expertise?.map((skill, index) => (
                                            <span
                                                key={index}
                                                className="px-2.5 py-1 rounded-full bg-primary/10 text-primary
                                                         text-xs font-medium"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Schedule Section - Now More Compact */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-base-content/70">
                                        <Calendar className="w-4 h-4"/>
                                        <span className="font-medium text-sm">{t.schedule}</span>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto pr-2 -mr-2">
                                        <div className="space-y-1.5">
                                            {DAYS.map((day) => {
                                                const schedule = currentEmployee?.schedule?.[day];
                                                if (!schedule?.length) return null;

                                                return (
                                                    <div
                                                        key={day}
                                                        className="flex items-center justify-between py-1.5 px-3
                                                                 rounded bg-base-200 text-xs"
                                                    >
                                                        <span className="font-medium">
                                                            {t[day.toLowerCase()]}
                                                        </span>
                                                        <span className="text-base-content/80">
                                                            {formatHour(schedule[0])} - {formatHour(schedule[schedule.length - 1])}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {(!currentEmployee?.schedule || Object.keys(currentEmployee?.schedule).length === 0) && (
                                        <p className="text-center text-xs text-base-content/60 py-2">
                                            {t.noSchedule}
                                        </p>
                                    )}
                                </div>

                                {/* Progress Dots */}
                                <div className="flex justify-center gap-1.5 pt-4">
                                    {employees.map((_, index) => (
                                        <div
                                            key={index}
                                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                                index === activeIndex
                                                    ? 'w-6 bg-primary'
                                                    : 'w-1.5 bg-primary/30'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </AnimatePresence>
    );
};

export default EmployeeDialog;