import React, { useContext, useState, useEffect } from 'react';
import { Camera, Info, Scissors, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageContext from "./LanguageContext";

const TabNavigation = ({ activeTab, setActiveTab, hasTeamMembers }) => {
    const { language } = useContext(LanguageContext);
    const [showArrow, setShowArrow] = useState(true);

    useEffect(() => {
        if (!hasTeamMembers || activeTab !== 'about') return;

        const handleScroll = () => {
            const teamSection = document.getElementById('team-section');
            if (!teamSection) return;
            const teamSectionTop = teamSection.getBoundingClientRect().top;
            setShowArrow(teamSectionTop > window.innerHeight);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasTeamMembers, activeTab]);

    const translations = {
        en: {
            about: "About",
            services: "Services",
            gallery: "Gallery",
            meetTeam: "Meet Our Team"
        },
        tr: {
            about: "Hakkında",
            services: "Hizmetler",
            gallery: "Galeri",
            meetTeam: "Ekibimizle Tanışın"
        },
        ar: {
            about: "معلومات",
            services: "خدمات",
            gallery: "معرض",
            meetTeam: "تعرف على فريقنا"
        },
        de: {
            about: "Über",
            services: "Dienste",
            gallery: "Galerie",
            meetTeam: "Unser Team kennenlernen"
        }
    };

    const t = translations[language];

    const tabs = [
        { id: 'about', icon: Info, label: t.about },
        { id: 'services', icon: Scissors, label: t.services },
        { id: 'gallery', icon: Camera, label: t.gallery }
    ];

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex flex-col items-center gap-3">
                {/* Scroll Indicator */}
                <AnimatePresence>
                    {showArrow && activeTab === 'about' && hasTeamMembers && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                transition: { duration: 0.3 }
                            }}
                            exit={{
                                opacity: 0,
                                y: 10,
                                transition: { duration: 0.2 }
                            }}
                        >
                            <motion.div
                                animate={{
                                    y: [0, 5, 0],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="flex items-center gap-2 bg-base-100/80 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-lg"
                            >
                                <span className="text-sm font-medium text-base-content/70">
                                    {t.meetTeam}
                                </span>
                                <ChevronDown className="w-4 h-4 text-primary" />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tab Buttons */}
                <div className="flex gap-2 bg-base-100/80 p-2 rounded-full shadow-xl backdrop-blur-lg border border-base-200">
                    {tabs.map(({ id, icon: Icon, label }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300
                                ${activeTab === id ? 'bg-primary text-primary-content shadow-lg scale-105' : 'hover:bg-base-200 text-base-content'}`}
                        >
                            <Icon className={`w-5 h-5 ${activeTab === id ? '' : 'group-hover:text-primary'}`} />
                            <span className={`${activeTab === id ? 'opacity-100' : 'opacity-0 w-0'} 
                                overflow-hidden transition-all duration-300 whitespace-nowrap
                                ${activeTab === id ? 'max-w-24' : 'max-w-0'}`}>
                                {label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TabNavigation;