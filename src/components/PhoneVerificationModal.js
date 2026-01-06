import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';

const translations = {
    en: {
        phoneRequired: "Phone Number Required",
        phoneRequiredDesc: "Add a phone number to enable customer contact",
        addPhoneNumber: "Add Phone Number",
        remindLater: "Maybe Later"
    },
    tr: {
        phoneRequired: "Telefon Numarası Gerekli",
        phoneRequiredDesc: "Müşterilerin iletişim kurabilmesi için telefon numarası ekleyin",
        addPhoneNumber: "Telefon Numarası Ekle",
        remindLater: "Belki Daha Sonra"
    },
    ar: {
        phoneRequired: "رقم الهاتف مطلوب",
        phoneRequiredDesc: "أضف رقم هاتف لتمكين الاتصال بالعملاء",
        addPhoneNumber: "إضافة رقم الهاتف",
        remindLater: "ربما لاحقا"
    },
    de: {
        phoneRequired: "Telefonnummer erforderlich",
        phoneRequiredDesc: "Fügen Sie eine Telefonnummer hinzu, um den Kundenkontakt zu ermöglichen",
        addPhoneNumber: "Telefonnummer hinzufügen",
        remindLater: "Vielleicht später"
    }
};

const NoPhoneNumberNotice = ({ isDark, onNavigate }) => {
    const [isHovered, setIsHovered] = useState(false);

    const containerVariants = {
        initial: { y: 20, opacity: 0 },
        animate: { y: 0, opacity: 1, transition: { duration: 0.3 } },
        hover: { scale: 1.02, transition: { duration: 0.2 } }
    };

    const iconVariants = {
        initial: { rotate: -15 },
        animate: { rotate: 0 },
        hover: {
            rotate: [0, -15, 15, -15, 0],
            transition: { duration: 0.5, times: [0, 0.2, 0.5, 0.8, 1] }
        }
    };

    const shimmerVariants = {
        initial: { x: '-100%' },
        animate: {
            x: '100%',
            transition: {
                repeat: Infinity,
                duration: 2,
                ease: 'linear'
            }
        }
    };

    const t = translations.en;

    return (
        <motion.div
            variants={containerVariants}
            initial="initial"
            animate="animate"
            whileHover="hover"
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            className={`relative overflow-hidden rounded-xl p-4 ${
                isDark ? 'bg-base-300' : 'bg-white'
            } shadow-lg`}
        >
            <div className="flex items-center gap-3">
                <motion.div
                    variants={iconVariants}
                    className={`w-12 h-12 rounded-full flex items-center justify-center
           ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}
                >
                    <Phone className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                </motion.div>

                <div className="flex-1 min-w-0">
                    <h3 className={`text-base font-semibold truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        {t.phoneRequired}
                    </h3>
                    <p className={`text-sm truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                        {t.phoneRequiredDesc}
                    </p>
                </div>

                <button
                    onClick={onNavigate}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium
           text-white dark:text-gray-900
           bg-gradient-to-r from-purple-600 to-pink-600
           dark:from-purple-400 dark:to-pink-400
           hover:from-purple-700 hover:to-pink-700
           dark:hover:from-purple-500 dark:hover:to-pink-500
           transition-all duration-200"
                >
                    {t.addPhoneNumber}
                </button>
            </div>

            <motion.div
                variants={shimmerVariants}
                className="absolute inset-0
         bg-gradient-to-r from-transparent via-white/10 to-transparent
         pointer-events-none"
            />
        </motion.div>
    );
};

export default NoPhoneNumberNotice;