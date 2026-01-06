import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {ChevronDown, ChevronUp, Copy, Search, Tag, Trash2, X, Scissors} from 'lucide-react';
import confetti from 'canvas-confetti';

// Reusable time picker that actually works
const TimePicker = ({value, onChange, className = ""}) => {
    const hours = Array.from({length: 24}, (_, i) => i);

    return (
        <select
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className={`select select-bordered w-full ${className}`}
        >
            {hours.map(hour => (
                <option key={hour} value={hour}>
                    {`${hour.toString().padStart(2, '0')}:00`}
                </option>
            ))}
        </select>
    );
};

// Quick time range selector that makes sense
const QuickTimeRange = ({onSelect, selected, label}) => (
    <motion.button
        whileHover={{scale: 1.02}}
        whileTap={{scale: 0.98}}
        onClick={onSelect}
        className={`
      px-4 py-2 rounded-lg transition-all duration-200
      ${selected ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300'}
    `}
    >
        {label}
    </motion.button>
);

// Searchable tag input that actually works
const SmartTagInput = ({value = "", onChange, onSubmit, suggestions = [], placeholder}) => {
    const [focused, setFocused] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState(suggestions);

    useEffect(() => {
        setFilteredSuggestions(
            suggestions.filter(s =>
                s.toLowerCase().includes(value.toLowerCase()) &&
                value.length > 0
            ).slice(0, 5)
        );
    }, [value, suggestions]);

    return (
        <div className="relative">
            <div
                className="flex items-center border rounded-lg bg-base-100 px-3 py-2 focus-within:ring-2 focus-within:ring-primary/50">
                <Search className="w-4 h-4 text-base-content/50 mr-2"/>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 200)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onSubmit(value);
                        }
                    }}
                    className="flex-1 bg-transparent border-none focus:outline-none"
                    placeholder={placeholder}
                />
            </div>

            <AnimatePresence>
                {focused && filteredSuggestions.length > 0 && (
                    <motion.div
                        initial={{opacity: 0, y: 10}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: 10}}
                        className="absolute z-50 w-full mt-1 bg-base-100 shadow-lg rounded-lg border border-base-300 py-1"
                    >
                        {filteredSuggestions.map(suggestion => (
                            <button
                                key={suggestion}
                                onClick={() => onSubmit(suggestion)}
                                className="w-full px-3 py-2 text-left hover:bg-base-200 transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ExpertiseTagSelector = ({selectedTags, onTagsChange, language = 'en'}) => {
    const [tagInput, setTagInput] = useState('');
    const [showHints, setShowHints] = useState(true);

    const translations = {
        en: {
            addTag: "Add expertise...",
        suggestions: "Example expertise",
        noTags: "No expertise added yet"
        },
        tr: {
            addTag: "Uzmanlık ekle...",
        suggestions: "Örnek uzmanlıklar",
        noTags: "Henüz uzmanlık eklenmedi"
        },
        ar: {
            addTag: "...إضافة خبرة",
        suggestions: "أمثلة على الخبرات",
        noTags: "لم تتم إضافة أي خبرة بعد"
        },
        de: {
            addTag: "Expertise hinzufügen...",
        suggestions: "Beispiel Expertise",
        noTags: "Noch keine Expertise hinzugefügt"
        }
    };

    const presetTags = {
        en: [
            // Classic Cuts
            'Men\'s Haircut', 'Fade', 'Taper', 'Buzz Cut', 'Crew Cut', 'Pompadour',
            'Undercut', 'Textured Crop', 'Slick Back', 'Quiff', 'Military Cut',
            // Beard Services
            'Beard Trim', 'Beard Sculpting', 'Beard Dyeing', 'Royal Shave',
            'Hot Towel Shave', 'Straight Razor Shave', 'Beard Design', 'Beard Conditioning',
            // Specialty Services
            'Hair Design', 'Hair Tattoo', 'Line Up', 'Shape Up', 'Edge Up',
            'Hair Coloring', 'Highlights', 'Gray Coverage', 'Scalp Treatment',
            'Kids Haircut', 'Senior Haircut', 'Face Massage', 'Scalp Massage',
            'Hair Treatment', 'Hair Restoration', 'Facial', 'Hair Spa'
        ],
        tr: [
            // Classic Cuts
            'Erkek Saç Kesimi', 'Fade Kesim', 'Kademeli Kesim', 'Kısa Kesim', 'Crew Kesim', 'Pompadour',
            'Undercut', 'Dokulu Kesim', 'Geriye Tarama', 'Quiff', 'Asker Tıraşı',
            // Beard Services
            'Sakal Tıraşı', 'Sakal Şekillendirme', 'Sakal Boyama', 'Royal Tıraş',
            'Sıcak Havlu Tıraş', 'Ustura Tıraş', 'Sakal Tasarım', 'Sakal Bakımı',
            // Specialty Services
            'Saç Tasarımı', 'Saç Dövmesi', 'Saç Çizgi', 'Şekillendirme', 'Kenar Düzeltme',
            'Saç Boyama', 'Röfle', 'Ak Kapatma', 'Saç Derisi Bakımı',
            'Çocuk Saç Kesimi', 'Yaşlı Tıraşı', 'Yüz Masajı', 'Saç Derisi Masajı',
            'Saç Bakımı', 'Saç Restorasyonu', 'Yüz Bakımı', 'Saç Spa'
        ],
        ar: [
            // Classic Cuts
            'قص شعر رجالي', 'فيد', 'تدريج', 'قص قصير', 'قصة كرو', 'بومبادور',
            'أندركت', 'قص منسق', 'تصفيف للخلف', 'كويف', 'قصة عسكرية',
            // Beard Services
            'تشذيب اللحية', 'نحت اللحية', 'صبغ اللحية', 'حلاقة ملكية',
            'حلاقة بالمنشفة الساخنة', 'حلاقة بالموس', 'تصميم اللحية', 'العناية باللحية',
            // Specialty Services
            'تصميم الشعر', 'وشم الشعر', 'تخطيط', 'تشكيل', 'تحديد الحواف',
            'صبغ الشعر', 'هاياليت', 'تغطية الشيب', 'علاج فروة الرأس',
            'قص شعر الأطفال', 'حلاقة كبار السن', 'مساج الوجه', 'مساج فروة الرأس',
            'علاج الشعر', 'ترميم الشعر', 'عناية بالوجه', 'سبا الشعر'
        ],
        de: [
            // Classic Cuts
            'Herrenhaarschnitt', 'Fade', 'Taper', 'Buzzcut', 'Crew Cut', 'Pompadour',
            'Undercut', 'Strukturierter Schnitt', 'Slick Back', 'Quiff', 'Militärschnitt',
            // Beard Services
            'Bartpflege', 'Bartskulptur', 'Bartfärben', 'Royal Rasur',
            'Warmtuch-Rasur', 'Rasiermesser-Rasur', 'Bart-Design', 'Bartpflege',
            // Specialty Services
            'Haar-Design', 'Haar-Tattoo', 'Konturenschnitt', 'Formschnitt', 'Kantenschnitt',
            'Haarfärben', 'Highlights', 'Grauabdeckung', 'Kopfhautbehandlung',
            'Kinderhaarschnitt', 'Seniorenhaarschnitt', 'Gesichtsmassage', 'Kopfhautmassage',
            'Haarbehandlung', 'Haarwiederherstellung', 'Gesichtsbehandlung', 'Haar-Spa'
        ]
    };

    const handleAddTag = (tag) => {
        if (tag && !selectedTags.includes(tag)) {
            onTagsChange([...selectedTags, tag]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        onTagsChange(selectedTags.filter(tag => tag !== tagToRemove));
    };

    return (
        <div className="space-y-4">
            <SmartTagInput
                value={tagInput}
                onChange={(val) => {
                    setTagInput(val);
                    setShowHints(true);
                }}
                onSubmit={handleAddTag}
                suggestions={presetTags[language].filter(tag => !selectedTags.includes(tag))}
                placeholder={translations[language].addTag}
            />

            {showHints && selectedTags.length === 0 && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 bg-base-200 rounded-lg"
                >
                    <h3 className="col-span-full text-sm font-medium mb-2">{translations[language].suggestions}</h3>
                    {presetTags[language].slice(0, 8).map(tag => (
                        <motion.button
                            key={tag}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleAddTag(tag)}
                            className="px-3 py-2 bg-base-100 rounded-lg text-sm hover:bg-primary/10 transition-colors text-left"
                        >
                            {tag}
                        </motion.button>
                    ))}
                </motion.div>
            )}

            <AnimatePresence>
                <motion.div className="flex flex-wrap gap-2">
                    {selectedTags.map(tag => (
                        <motion.span
                            key={tag}
                            initial={{scale: 0.8, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            exit={{scale: 0.8, opacity: 0}}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full"
                        >
                            <Tag className="w-3 h-3"/>
                            <span>{tag}</span>
                            <button
                                onClick={() => handleRemoveTag(tag)}
                                className="p-1 hover:bg-primary/20 rounded-full transition-colors"
                            >
                                <X className="w-3 h-3"/>
                            </button>
                        </motion.span>
                    ))}
                    {selectedTags.length === 0 && (
                        <motion.span
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            className="text-base-content/50 italic"
                        >
                            {translations[language].noTags}
                        </motion.span>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

const DaySchedule = ({day, hours, onChange, translations, commonSchedules}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [startHour, setStartHour] = useState(hours[0] || 9);
    const [endHour, setEndHour] = useState(hours[hours.length - 1] || 17);

    const updateSchedule = (start, end) => {
        const newHours = [];
        for (let i = start; i <= end; i++) {
            newHours.push(i);
        }
        onChange(newHours);
    };

    const handleQuickSelect = (schedule) => {
        if (schedule === 'closed') {
            onChange([]);
        } else {
            const [start, end] = commonSchedules[schedule].hours;
            updateSchedule(start, end);
        }
        setIsOpen(false);
    };

    return (
        <motion.div
            initial={false}
            animate={{height: isOpen ? 'auto' : 48}}
            className="border rounded-lg overflow-hidden bg-base-100"
        >
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-base-200"
            >
                <span className="font-medium">{day}</span>
                <div className="flex items-center gap-3">
                    {hours.length === 0 ? (
                        <span className="text-error">{translations.closed}</span>
                    ) : (
                        <span className="text-success">
              {`${hours[0]}:00 - ${hours[hours.length - 1]}:00`}
            </span>
                    )}
                    {isOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="p-4 border-t"
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(commonSchedules).map(([key, schedule]) => (
                                    <QuickTimeRange
                                        key={key}
                                        label={schedule.label}
                                        selected={hours.length > 0 &&
                                            hours[0] === schedule.hours[0] &&
                                            hours[hours.length - 1] === schedule.hours[1]}
                                        onSelect={() => handleQuickSelect(key)}
                                    />
                                ))}
                                <QuickTimeRange
                                    label={translations.closed}
                                    selected={hours.length === 0}
                                    onSelect={() => handleQuickSelect('closed')}
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-sm mb-1 block opacity-70">
                                        {translations.start}
                                    </label>
                                    <TimePicker
                                        value={startHour}
                                        onChange={(value) => {
                                            setStartHour(value);
                                            if (value <= endHour) {
                                                updateSchedule(value, endHour);
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm mb-1 block opacity-70">
                                        {translations.end}
                                    </label>
                                    <TimePicker
                                        value={endHour}
                                        onChange={(value) => {
                                            setEndHour(value);
                                            if (value >= startHour) {
                                                updateSchedule(startHour, value);
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="btn btn-ghost btn-sm"
                                >
                                    {translations.close}
                                </button>
                                <button
                                    onClick={() => {
                                        onChange(hours);
                                        setIsOpen(false);
                                    }}
                                    className="btn btn-primary btn-sm"
                                >
                                    {translations.save}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

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

    return (
        <div className="space-y-3">
            {translations[language].weekDays.map((day, index) => (
                <DaySchedule
                    key={day}
                    day={day}
                    hours={schedule[day] || []}
                    onChange={newHours => {
                        onScheduleChange({
                            ...schedule,
                            [day]: newHours
                        });
                    }}
                    translations={{
                        closed: translations[language].closed,
                        start: translations[language].start,
                        end: translations[language].end,
                        save: translations[language].save,
                        close: translations[language].close
                    }}
                    commonSchedules={commonSchedules}
                />
            ))}

            <motion.div className="flex justify-end gap-2 pt-4">
                <button
                    onClick={() => {
                        // Copy Monday's schedule to all days
                        const mondaySchedule = schedule[translations[language].weekDays[0]] || [];
                        const newSchedule = {};
                        translations[language].weekDays.forEach(day => {
                            newSchedule[day] = [...mondaySchedule];
                        });
                        onScheduleChange(newSchedule);
                    }}
                    className="btn btn-outline btn-sm gap-2"
                >
                    <Copy className="w-4 h-4"/>
                    Copy Monday to all days
                </button>
                <button
                    onClick={() => {
                        // Clear all schedules
                        const newSchedule = {};
                        translations[language].weekDays.forEach(day => {
                            newSchedule[day] = [];
                        });
                        onScheduleChange(newSchedule);
                    }}
                    className="btn btn-ghost btn-sm gap-2 text-error"
                >
                    <Trash2 className="w-4 h-4"/>
                    Clear All
                </button>
            </motion.div>
        </div>
    );
};

export default function EmployeeForm({employee, onUpdate, language = 'en'}) {
    const translations = {
        en: {
            expertise: "Areas of Expertise",
            availability: "Weekly Schedule"
        },
        tr: {
            expertise: "Uzmanlık Alanları",
            availability: "Haftalık Program"
        },
        ar: {
            expertise: "مجالات الخبرة",
            availability: "الجدول الأسبوعي"
        },
        de: {
            expertise: "Fachgebiete",
            availability: "Wochenplan"
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-4">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                className="space-y-8"
            >
                <section>
                    <motion.h2
                        initial={{opacity: 0, x: -20}}
                        animate={{opacity: 1, x: 0}}
                        className="text-2xl font-semibold mb-6"
                    >
                        {translations[language].expertise}
                    </motion.h2>
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        transition={{delay: 0.2}}
                    >
                        <ExpertiseTagSelector
                            selectedTags={employee.expertise}
                            onTagsChange={(tags) => onUpdate({...employee, expertise: tags})}
                            language={language}
                        />
                    </motion.div>
                </section>

                <section>
                    <motion.h2
                        initial={{opacity: 0, x: -20}}
                        animate={{opacity: 1, x: 0}}
                        className="text-2xl font-semibold mb-6"
                    >
                        {translations[language].availability}
                    </motion.h2>
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        transition={{delay: 0.2}}
                    >
                        <WeeklyScheduleSelector
                            schedule={employee.schedule}
                            onScheduleChange={(schedule) => onUpdate({...employee, schedule})}
                            language={language}
                        />
                    </motion.div>
                </section>
            </motion.div>
        </div>
    );
}