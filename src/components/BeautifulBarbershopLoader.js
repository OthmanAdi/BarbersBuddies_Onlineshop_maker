import React from 'react';
import { motion } from 'framer-motion';
import { Scissors, Store, Clock, MapPin, Users2 } from 'lucide-react';

const BeautifulBarbershopLoader = ({ language = 'en' }) => {
    const translations = {
        en: {
            loading: "Finding the best barbershops",
            nearYou: "near you",
            loadingServices: "Loading services and schedules"
        },
        tr: {
            loading: "En iyi berber dükkanlarını buluyoruz",
            nearYou: "yakınınızda",
            loadingServices: "Hizmetler ve programlar yükleniyor"
        },
        ar: {
            loading: "البحث عن أفضل صالونات الحلاقة",
            nearYou: "بالقرب منك",
            loadingServices: "تحميل الخدمات والجداول"
        },
        de: {
            loading: "Die besten Friseursalons finden",
            nearYou: "in Ihrer Nähe",
            loadingServices: "Dienste und Zeitpläne werden geladen"
        }
    };

    const t = translations[language] || translations.en;

    const iconContainerVariants = {
        animate: {
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const bounceVariants = {
        initial: { y: 0 },
        animate: {
            y: [-8, 0, -8],
            transition: {
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    const fadeVariants = {
        initial: { opacity: 0 },
        animate: {
            opacity: [0.4, 1, 0.4],
            transition: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    const scissorsVariants = {
        initial: { rotate: 0 },
        animate: {
            rotate: [-10, 10, -10],
            transition: {
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    const progressVariants = {
        initial: { width: "0%" },
        animate: {
            width: "100%",
            transition: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    return (
        <div className="w-full flex flex-col items-center justify-center py-16 px-4">
            <div className="w-full max-w-md">
                {/* Icons */}
                <motion.div
                    className="flex justify-center items-center gap-5 mb-8"
                    variants={iconContainerVariants}
                    initial="initial"
                    animate="animate"
                >
                    <motion.div
                        className="relative"
                        variants={bounceVariants}
                    >
                        <motion.div
                            className="absolute -inset-3 bg-primary/20 rounded-full blur-md"
                            variants={fadeVariants}
                        />
                        <Store className="w-8 h-8 text-primary relative z-10" />
                    </motion.div>

                    <motion.div
                        variants={scissorsVariants}
                        className="relative"
                    >
                        <motion.div
                            className="absolute -inset-3 bg-secondary/20 rounded-full blur-md"
                            variants={fadeVariants}
                        />
                        <Scissors className="w-10 h-10 text-secondary relative z-10" />
                    </motion.div>

                    <motion.div
                        className="relative"
                        variants={bounceVariants}
                    >
                        <motion.div
                            className="absolute -inset-3 bg-accent/20 rounded-full blur-md"
                            variants={fadeVariants}
                        />
                        <Clock className="w-8 h-8 text-accent relative z-10" />
                    </motion.div>

                    <motion.div
                        className="relative"
                        variants={bounceVariants}
                    >
                        <motion.div
                            className="absolute -inset-3 bg-primary/20 rounded-full blur-md"
                            variants={fadeVariants}
                        />
                        <MapPin className="w-8 h-8 text-primary relative z-10" />
                    </motion.div>

                    <motion.div
                        className="relative"
                        variants={bounceVariants}
                    >
                        <motion.div
                            className="absolute -inset-3 bg-secondary/20 rounded-full blur-md"
                            variants={fadeVariants}
                        />
                        <Users2 className="w-8 h-8 text-secondary relative z-10" />
                    </motion.div>
                </motion.div>

                {/* Text */}
                <div className="text-center mb-8">
                    <motion.h3
                        className="text-xl font-semibold mb-1 text-base-content"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {t.loading}
                    </motion.h3>

                    <motion.p
                        className="text-base-content/70"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {t.nearYou}
                    </motion.p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-primary via-secondary to-primary"
                        variants={progressVariants}
                        initial="initial"
                        animate="animate"
                    />
                </div>

                {/* Loading text */}
                <motion.p
                    className="text-sm text-center mt-4 text-base-content/50"
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: [0.5, 1, 0.5],
                        transition: {
                            duration: 2,
                            repeat: Infinity
                        }
                    }}
                >
                    {t.loadingServices}
                </motion.p>
            </div>
        </div>
    );
};

export default BeautifulBarbershopLoader;