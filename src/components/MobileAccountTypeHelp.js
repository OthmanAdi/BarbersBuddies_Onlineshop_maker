import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const MobileAccountTypeHelp = ({
                                   isOpen,
                                   onClose,
                                   language,
                                   isDark
                               }) => {

    console.log('MobileAccountTypeHelp render:', {isOpen, language, isDark});

    const translations = {
        en: {
            helpButton: "Help me Choose",
            dialogTitle: "Account Types",
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
            helpButton: "Hilf mir wählen",
            dialogTitle: "Kontotypen",
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
            helpButton: "Seçmeme yardım et",
            dialogTitle: "Hesap Türleri",
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
            helpButton: "ساعدني في الاختيار",
            dialogTitle: "أنواع الحسابات",
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

    // Help Button with gradient text
    const HelpButton = ({ onClick }) => (
        <button
            onClick={onClick}
            className="inline-flex items-center text-sm font-medium"
        >
            <span className={`bg-gradient-to-r ${
                isDark
                    ? 'from-purple-400 to-pink-400'
                    : 'from-purple-600 to-pink-600'
            } bg-clip-text text-transparent`}
            >
                {t.helpButton}
            </span>
        </button>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 touch-none"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}  // Changed from y: -100 to y: 0
                        exit={{ opacity: 0, y: 100 }}
                        transition={{ type: "spring", damping: 25 }}
                        className={`fixed bottom-0 inset-x-0 z-[9999] ${
                            isDark
                                ? 'bg-gray-900 border-t border-gray-800'
                                : 'bg-white border-t border-gray-200'
                        } rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto pb-8`}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className={`absolute right-4 top-4 p-2 rounded-full ${
                                isDark
                                    ? 'hover:bg-gray-800 text-gray-400'
                                    : 'hover:bg-gray-100 text-gray-600'
                            }`}
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Content */}
                        <div className="space-y-6">
                            <h3 className={`text-xl font-semibold ${
                                isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                                {t.dialogTitle}
                            </h3>

                            {/* Customer Section */}
                            <div className="space-y-4">
                                <h4 className={`text-lg font-medium ${
                                    isDark ? 'text-gray-200' : 'text-gray-800'
                                }`}>
                                    Customer
                                </h4>
                                <ul className="space-y-3">
                                    {t.customer.map((feature, index) => (
                                        <motion.li
                                            key={index}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="flex items-start gap-3"
                                        >
                                            <span className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                                                isDark ? 'bg-sky-400' : 'bg-sky-500'
                                            }`} />
                                            <span className={`text-sm ${
                                                isDark ? 'text-gray-300' : 'text-gray-600'
                                            }`}>
                                                {feature}
                                            </span>
                                        </motion.li>
                                    ))}
                                </ul>
                            </div>

                            {/* Owner Section */}
                            <div className="space-y-4">
                                <h4 className={`text-lg font-medium ${
                                    isDark ? 'text-gray-200' : 'text-gray-800'
                                }`}>
                                    Shop Owner
                                </h4>
                                <ul className="space-y-3">
                                    {t.owner.map((feature, index) => (
                                        <motion.li
                                            key={index}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 + 0.3 }}
                                            className="flex items-start gap-3"
                                        >
                                            <span className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                                                isDark ? 'bg-emerald-400' : 'bg-emerald-500'
                                            }`} />
                                            <span className={`text-sm ${
                                                isDark ? 'text-gray-300' : 'text-gray-600'
                                            }`}>
                                                {feature}
                                            </span>
                                        </motion.li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default MobileAccountTypeHelp;