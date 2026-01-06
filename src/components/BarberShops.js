import React, {useContext, useEffect, useState} from 'react';
import BarberList from './BarberList';
import LanguageContext from "./LanguageContext";
import {Filter, X, Search} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import FooterPages from "./FooterPages";

const Shops = () => {
    const {language} = useContext(LanguageContext);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedPricing, setSelectedPricing] = useState(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState(0);
    const translations = {
        en: {
            findABarber: "Find a Barber",
            filters: "Filters",
            categories: "Categories",
            pricing: "Pricing",
            clearFilters: "Clear Filters",
            traditional: "Traditional",
            african: "African & Textured Hair",
            kids: "Kids Specialist",
            women: "Women's Services",
            luxury: "Luxury",
            modern: "Modern & Trendy",
            beard: "Beard Specialist",
            unisex: "Unisex",
            budget: "Budget Friendly",
            midRange: "Mid Range",
            premium: "Premium"
        },
        tr: {
            findABarber: "Berber Bul",
            filters: "Filtreler",
            categories: "Kategoriler",
            pricing: "Fiyatlandırma",
            clearFilters: "Filtreleri Temizle",
            traditional: "Geleneksel",
            african: "Afrika & Dokulu Saç",
            kids: "Çocuk Uzmanı",
            women: "Kadın Hizmetleri",
            luxury: "Lüks",
            modern: "Modern & Trend",
            beard: "Sakal Uzmanı",
            unisex: "Unisex",
            budget: "Ekonomik",
            midRange: "Orta Segment",
            premium: "Premium"
        },
        ar: {
            findABarber: "ابحث عن حلاق",
            filters: "الفلاتر",
            categories: "الفئات",
            pricing: "التسعير",
            clearFilters: "مسح الفلاتر",
            traditional: "تقليدي",
            african: "شعر أفريقي ومجعد",
            kids: "متخصص أطفال",
            women: "خدمات نسائية",
            luxury: "فاخر",
            modern: "عصري وحديث",
            beard: "متخصص لحى",
            unisex: "للجنسين",
            budget: "اقتصادي",
            midRange: "متوسط السعر",
            premium: "مميز"
        },
        de: {
            findABarber: "Finde einen Friseur",
            filters: "Filter",
            categories: "Kategorien",
            pricing: "Preisgestaltung",
            clearFilters: "Filter zurücksetzen",
            traditional: "Traditionell",
            african: "Afrikanisches & strukturiertes Haar",
            kids: "Kinderspezialist",
            women: "Damenfriseur",
            luxury: "Luxus",
            modern: "Modern & Trendig",
            beard: "Bartspezialist",
            unisex: "Unisex",
            budget: "Preiswert",
            midRange: "Mittleres Preissegment",
            premium: "Premium"
        }
    };

    const t = translations[language];

    const categoryOptions = [
        {id: 'traditional', label: t.traditional},
        {id: 'african', label: t.african},
        {id: 'kids', label: t.kids},
        {id: 'women', label: t.women},
        {id: 'luxury', label: t.luxury},
        {id: 'modern', label: t.modern},
        {id: 'beard', label: t.beard},
        {id: 'unisex', label: t.unisex}
    ];

    const pricingOptions = [
        {id: '€', label: t.budget},
        {id: '€€', label: t.midRange},
        {id: '€€€', label: t.premium}
    ];

    const handleCategoryChange = (categoryId) => {
        setSelectedCategories(prev => {
            if (prev.includes(categoryId)) {
                return prev.filter(id => id !== categoryId);
            } else {
                return [...prev, categoryId];
            }
        });
    };

    const handlePricingChange = (pricing) => {
        setSelectedPricing(prev => prev === pricing ? null : pricing);
    };

    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedPricing(null);
    };

    useEffect(() => {
        const count = selectedCategories.length + (selectedPricing ? 1 : 0);
        setActiveFilters(count);
    }, [selectedCategories, selectedPricing]);

    return (
        <div className="min-h-screen bg-base-200">
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col gap-4 mb-6">
                    <div className="w-full flex flex-col gap-4">
                        <h1 className="text-3xl font-bold text-base-content">{t.findABarber}</h1>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search barbers..."
                                    className="input input-bordered w-full pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <motion.button
                                className="btn btn-primary relative"
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Filter className="w-4 h-4 mr-2"/>
                                {t.filters}
                                {activeFilters > 0 && (
                                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-secondary text-secondary-content text-xs flex items-center justify-center">
                                        {activeFilters}
                                    </div>
                                )}
                            </motion.button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {isFilterOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{
                                    height: "auto",
                                    opacity: 1,
                                    transition: {
                                        height: { duration: 0.3 },
                                        opacity: { duration: 0.2 }
                                    }
                                }}
                                exit={{
                                    height: 0,
                                    opacity: 0,
                                    transition: {
                                        height: { duration: 0.3 },
                                        opacity: { duration: 0.1 }
                                    }
                                }}
                                className="w-full overflow-hidden"
                            >
                                <motion.div
                                    className="bg-base-100 rounded-lg p-4 shadow-lg space-y-4"
                                    initial={{ y: -20 }}
                                    animate={{ y: 0 }}
                                    exit={{ y: -20 }}
                                >
                                    <div className="space-y-2">
                                        <h3 className="font-medium">{t.categories}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {categoryOptions.map(category => (
                                                <motion.button
                                                    key={category.id}
                                                    onClick={() => handleCategoryChange(category.id)}
                                                    className={`btn btn-sm ${
                                                        selectedCategories.includes(category.id)
                                                            ? 'btn-primary'
                                                            : 'btn-ghost'
                                                    }`}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    layout
                                                >
                                                    {category.label}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="font-medium">{t.pricing}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {pricingOptions.map(option => (
                                                <motion.button
                                                    key={option.id}
                                                    onClick={() => handlePricingChange(option.id)}
                                                    className={`btn btn-sm ${
                                                        selectedPricing === option.id
                                                            ? 'btn-secondary'
                                                            : 'btn-ghost'
                                                    }`}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    layout
                                                >
                                                    {option.id} {option.label}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {(selectedCategories.length > 0 || selectedPricing) && (
                                            <motion.button
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                onClick={clearFilters}
                                                className="btn btn-sm btn-ghost text-error w-full"
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <X className="w-4 h-4 mr-1"/>
                                                {t.clearFilters}
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <BarberList
                    selectedCategories={selectedCategories}
                    selectedPricing={selectedPricing}
                    searchQuery={searchQuery}
                />
            </div>
            <FooterPages/>
        </div>
    );
};

export default Shops;