import React, {useContext, useEffect, useState} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageContext from './LanguageContext';
import {useDaisyTheme} from "../hooks/useDaisyTheme";

const AccountTypeInfo = ({ type, isVisible }) => {
    const { language } = useContext(LanguageContext);
    const isDark = useDaisyTheme();
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Don't render if width <= 1258px
    if (windowWidth <= 1258) {
        return null;
    }


    const translations = {
        en: {
            customer: [
                "Seamless booking experience with instant chat support for real-time coordination",
                "Build community trust through detailed reviews and ratings of your experiences",
                "Discover your ideal barber with our advanced employee-specific booking system"
            ],
            owner: [
                "Comprehensive business toolkit: Smart agenda, real-time analytics, and instant notifications",
                "Perfect for freelancers with automated invoicing and financial management",
                "Launch your professional website instantly - save €1000s on development costs"
            ]
        },
        de: {
            customer: [
                "Nahtloses Buchungserlebnis mit sofortigem Chat-Support für Echtzeitkoordination",
                "Schaffen Sie Vertrauen durch detaillierte Bewertungen Ihrer Erfahrungen",
                "Finden Sie Ihren idealen Barbier mit unserem mitarbeiterspezifischen Buchungssystem"
            ],
            owner: [
                "Umfassendes Business-Toolkit: Smart-Agenda, Echtzeit-Analysen und Sofortbenachrichtigungen",
                "Perfekt für Freiberufler mit automatisierter Rechnungsstellung",
                "Starten Sie sofort Ihre professionelle Website - sparen Sie Tausende € an Entwicklungskosten"
            ]
        },
        tr: {
            customer: [
                "Anlık sohbet desteğiyle sorunsuz rezervasyon deneyimi",
                "Deneyimlerinizi detaylı değerlendirmelerle paylaşarak güven oluşturun",
                "Gelişmiş çalışana özel rezervasyon sistemiyle ideal berberinizi bulun"
            ],
            owner: [
                "Kapsamlı iş araç seti: Akıllı ajanda, gerçek zamanlı analiz ve anlık bildirimler",
                "Otomatik faturalama ile serbest çalışanlar için mükemmel",
                "Profesyonel websitenizi hemen başlatın - geliştirme maliyetlerinden binlerce € tasarruf edin"
            ]
        },
        ar: {
            customer: [
                "تجربة حجز سلسة مع دعم الدردشة الفوري للتنسيق في الوقت الحقيقي",
                "بناء ثقة المجتمع من خلال المراجعات والتقييمات المفصلة لتجاربك",
                "اكتشف الحلاق المثالي مع نظام الحجز المتقدم الخاص بالموظفين"
            ],
            owner: [
                "مجموعة أدوات شاملة للأعمال: جدول أعمال ذكي وتحليلات فورية وإشعارات فورية",
                "مثالي للمستقلين مع الفواتير الآلية والإدارة المالية",
                "أطلق موقعك الاحترافي على الفور - وفر آلاف اليورو في تكاليف التطوير"
            ]
        }
    };

    const t = translations[language];
    const features = type === 'customer' ? t.customer : t.owner;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`absolute z-50 w-72 p-4 rounded-xl shadow-xl 
                        ${isDark
                        ? 'bg-gray-900/80 backdrop-blur-lg border border-gray-700'
                        : 'bg-white/80 backdrop-blur-lg border border-gray-200'}`}
                    style={{
                        top: '120%',
                        left: '50%',
                        transform: 'translateX(-50%)'
                    }}
                >
                    <ul className="space-y-4">
                        {features.map((feature, index) => (
                            <motion.li
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start gap-3"
                            >
                                <span className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                                    isDark
                                        ? 'bg-yellow-400'
                                        : type === 'customer'
                                            ? 'bg-sky-400'
                                            : 'bg-emerald-400'
                                }`} />
                                <span className={`text-sm font-medium ${
                                    isDark ? 'text-gray-200' : 'text-gray-700'
                                }`}>
                                    {feature}
                                </span>
                            </motion.li>
                        ))}
                    </ul>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AccountTypeInfo;