import React from 'react';
import { motion } from 'framer-motion';
import { Scissors, Clock, Users2, Image, Store } from 'lucide-react';

const BeautifulLoadingScreen = ({ language = 'en' }) => {
    const translations = {
        en: {
            loading: "Loading your barbershop",
            preparing: "Preparing your experience",
            wait: "Just a moment"
        },
        tr: {
            loading: "Berber dükkanınız yükleniyor",
            preparing: "Deneyiminiz hazırlanıyor",
            wait: "Bir saniye lütfen"
        },
        ar: {
            loading: "جاري تحميل صالون الحلاقة",
            preparing: "جاري تحضير تجربتك",
            wait: "لحظة من فضلك"
        },
        de: {
            loading: "Ihr Friseursalon wird geladen",
            preparing: "Wir bereiten Ihr Erlebnis vor",
            wait: "Einen Moment bitte"
        }
    };

    const t = translations[language] || translations.en;

    const containerVariants = {
        animate: {
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const iconVariants = {
        initial: { scale: 0, rotate: -30, opacity: 0 },
        animate: {
            scale: 1,
            rotate: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 260,
                damping: 20,
                duration: 0.6
            }
        }
    };

    const textVariants = {
        initial: { opacity: 0, y: 10 },
        animate: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                ease: "easeOut"
            }
        }
    };

    const progressVariants = {
        initial: { width: "0%" },
        animate: {
            width: "100%",
            transition: {
                duration: 2.5,
                ease: "easeInOut",
                repeat: Infinity
            }
        }
    };

    const icons = [
        { Icon: Store, color: "text-primary" },
        { Icon: Scissors, color: "text-secondary" },
        { Icon: Clock, color: "text-accent" },
        { Icon: Users2, color: "text-primary" },
        { Icon: Image, color: "text-secondary" }
    ];

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-base-100 bg-opacity-95 z-50">
            <div className="w-full max-w-sm px-4">
                {/* Logo/branding placeholder */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center mb-8"
                >
                    <div className="flex items-center gap-2">
                        <Scissors className="w-8 h-8 text-primary" />
                        <span className="text-2xl font-bold text-base-content">Barbers Buddies</span>
                    </div>
                </motion.div>

                {/* Icons animation */}
                <motion.div
                    className="flex justify-center gap-4 mb-8"
                    variants={containerVariants}
                    initial="initial"
                    animate="animate"
                >
                    {icons.map(({ Icon, color }, index) => (
                        <motion.div
                            key={index}
                            variants={iconVariants}
                            className={`w-10 h-10 flex items-center justify-center rounded-full bg-base-200 ${color}`}
                        >
                            <Icon className="w-5 h-5" />
                        </motion.div>
                    ))}
                </motion.div>

                {/* Loading text */}
                <motion.div
                    className="text-center mb-6"
                    variants={textVariants}
                    initial="initial"
                    animate="animate"
                >
                    <h3 className="text-xl font-semibold text-base-content mb-2">{t.loading}</h3>
                    <p className="text-base-content/70">{t.preparing}</p>
                </motion.div>

                {/* Loading bar */}
                <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden mb-4">
                    <motion.div
                        className="h-full bg-gradient-to-r from-primary via-secondary to-primary"
                        variants={progressVariants}
                        initial="initial"
                        animate="animate"
                    />
                </div>

                {/* Waiting text */}
                <motion.p
                    className="text-sm text-center text-base-content/50"
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: [0.5, 1, 0.5],
                        transition: {
                            duration: 2,
                            repeat: Infinity
                        }
                    }}
                >
                    {t.wait}
                </motion.p>
            </div>
        </div>
    );
};

export default BeautifulLoadingScreen;