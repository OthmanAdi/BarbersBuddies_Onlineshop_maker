import React from 'react';
import { motion } from 'framer-motion';
import { Phone, ArrowRight } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';

const translations = {
    en: {
        title: "Phone Number Required",
        description: "Add a phone number to your account to create a barbershop. Your customers need a way to contact you.",
        action: "Add Phone Number",
        remindLater: "Remind Me Later"
    },
    tr: {
        title: "Telefon Numarası Gerekli",
        description: "Berber dükkanı oluşturmak için hesabınıza telefon numarası ekleyin. Müşterilerinizin sizinle iletişime geçebilmesi gerekiyor.",
        action: "Telefon Numarası Ekle",
        remindLater: "Daha Sonra Hatırlat"
    },
    ar: {
        title: "رقم الهاتف مطلوب",
        description: "أضف رقم هاتف إلى حسابك لإنشاء صالون حلاقة. يحتاج عملاؤك إلى وسيلة للاتصال بك.",
        action: "إضافة رقم الهاتف",
        remindLater: "ذكرني لاحقاً"
    },
    de: {
        title: "Telefonnummer Erforderlich",
        description: "Fügen Sie Ihrem Konto eine Telefonnummer hinzu, um einen Friseursalon zu erstellen. Ihre Kunden brauchen eine Möglichkeit, Sie zu kontaktieren.",
        action: "Telefonnummer Hinzufügen",
        remindLater: "Später Erinnern"
    }
};

const PhoneNumberAlert = ({ language = 'en', onNavigate, isDark }) => {
    const isMobile = useMediaQuery({ maxWidth: 640 });
    const isTablet = useMediaQuery({ minWidth: 641, maxWidth: 1024 });
    const isDesktop = useMediaQuery({ minWidth: 1025 });

    const t = translations[language];

    const containerVariants = {
        hidden: {
            opacity: 0,
            y: 20,
            scale: 0.95
        },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                duration: 0.4,
                ease: "easeOut"
            }
        },
        hover: {
            scale: 1.02,
            transition: {
                duration: 0.2
            }
        }
    };

    const iconVariants = {
        hidden: { rotate: -15, scale: 0.8 },
        visible: {
            rotate: 0,
            scale: 1,
            transition: {
                delay: 0.2,
                type: "spring",
                stiffness: 200
            }
        },
        hover: {
            rotate: [0, -15, 15, -15, 0],
            transition: {
                duration: 0.6,
                times: [0, 0.2, 0.5, 0.8, 1],
                repeat: Infinity,
                repeatDelay: 1
            }
        }
    };

    const buttonVariants = {
        hover: {
            scale: 1.05,
            transition: {
                duration: 0.2,
                ease: "easeInOut"
            }
        },
        tap: {
            scale: 0.95
        }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
        >
            <div className={`rounded-2xl overflow-hidden backdrop-blur-lg shadow-2xl 
                ${isDark ? 'bg-gray-900/90 border border-gray-700' : 'bg-white/90 border border-gray-200'}`}>
                <div className="relative p-4 sm:p-6">
                    <div className="flex items-start gap-4">
                        <motion.div
                            variants={iconVariants}
                            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 
                                ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}
                        >
                            <Phone className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                        </motion.div>

                        <div className="flex-1 min-w-0">
                            <h3 className={`text-lg font-semibold mb-1 
                                ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t.title}
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                {t.description}
                            </p>

                            <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                <motion.button
                                    variants={buttonVariants}
                                    whileHover="hover"
                                    whileTap="tap"
                                    onClick={onNavigate}
                                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl
                                       text-sm font-semibold text-white dark:text-gray-900
                                       bg-gradient-to-r from-purple-600 to-pink-600
                                       dark:from-purple-400 dark:to-pink-400
                                       hover:from-purple-700 hover:to-pink-700
                                       dark:hover:from-purple-500 dark:hover:to-pink-500
                                       transition-all duration-200 shadow-lg"
                                >
                                    {t.action}
                                    <ArrowRight className="w-4 h-4" />
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
                    animate-[shimmer_2s_infinite] opacity-30" />
                </div>
            </div>
        </motion.div>
    );
};

export default PhoneNumberAlert;