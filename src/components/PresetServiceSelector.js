import React, {useContext, useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import LanguageContext from "./LanguageContext";
import {ChevronDown, Clock, Plus, Scissors, Search, Sparkles, X} from 'lucide-react';
import AddServiceCard from "./AddServiceCard";
import ServiceImageUploader from "./ServiceImageUploader";

// Service categories with icons
const serviceCategories = {
    haircuts: [0, 1, 4], // indices of haircut services
    facial: [2, 3],      // indices of facial services
    styling: [6, 7, 8],  // indices of styling services
    treatments: [5, 9]   // indices of treatment services
};

const presetServices = [{
    name: 'Herrenhaarschnitt',
    price: '25',
    icon: <Scissors className="w-5 h-5"/>,
    duration: '30'
}, {
    name: 'Maschinenhaarschnitt',
    price: '20',
    icon: <Scissors className="w-5 h-5"/>,
    duration: '20'
}, {name: 'Bartpflege', price: '15', icon: <Scissors className="w-5 h-5"/>, duration: '15'}, {
    name: 'Rasur',
    price: '20',
    icon: <Scissors className="w-5 h-5"/>,
    duration: '20'
}, {name: 'Kinderhaarschnitt', price: '18', icon: <Scissors className="w-5 h-5"/>, duration: '25'}, {
    name: 'Färben',
    price: '45',
    icon: <Sparkles className="w-5 h-5"/>,
    duration: '60'
}, {name: 'Strähnchen', price: '55', icon: <Sparkles className="w-5 h-5"/>, duration: '90'}, {
    name: 'Waschen & Föhnen',
    price: '15',
    icon: <Sparkles className="w-5 h-5"/>,
    duration: '20'
}, {name: 'Styling', price: '10', icon: <Sparkles className="w-5 h-5"/>, duration: '15'}, {
    name: 'Kopfmassage',
    price: '12',
    icon: <Sparkles className="w-5 h-5"/>,
    duration: '15'
},];

const ServiceCard = ({service, index, t, onClick, isSelected, onServiceUpdate, userId, shopId, setIsImageUploading}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [description, setDescription] = useState(service.description || '');
    const [images, setImages] = useState(service.images || []);
    const [isEditing, setIsEditing] = useState(false);
    const [hasDescription, setHasDescription] = useState(false);

    useEffect(() => {
        setIsExpanded(isSelected);
    }, [isSelected]);

    const handleDescriptionSave = () => {
        onServiceUpdate({...service, description});
        setIsEditing(false);
        setHasDescription(true);
    };

    const getServiceName = () => {
        if (!t || !service) return '';
        const keys = Object.keys(t);
        return (keys[index] && t[keys[index]]) || service.name || '';
    };

    return (
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3, delay: index * 0.05}}
            className={`relative rounded-xl transition-all duration-200 overflow-hidden
                     border shadow-sm hover:shadow-md
                     ${isSelected ? 'bg-primary/10 border-primary' : 'bg-base-100 hover:bg-primary/5 border-base-200 hover:border-primary/20'}`}
        >
            <div className="p-4">
                {/* Main card content remains unchanged */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-left line-clamp-1">
                            {service.name}
                        </span>
                        <div className="flex items-center gap-2 text-sm opacity-70">
                            <Clock className="w-4 h-4"/>
                            <span>{service.duration} min</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                            {service.icon}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-2">
                    <span className="text-lg font-bold text-primary">€{service.price}</span>
                    <motion.button
                        whileTap={{scale: 0.95}}
                        onClick={onClick}
                        className={`px-3 py-1 rounded-full text-xs 
                        ${isSelected ? 'bg-primary text-primary-content' : 'bg-primary/10 text-primary'}`}
                    >
                        {isSelected ? 'Selected' : 'Select'}
                    </motion.button>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{height: 0, opacity: 0}}
                        animate={{height: 'auto', opacity: 1}}
                        exit={{height: 0, opacity: 0}}
                        transition={{duration: 0.2}}
                        className="border-t border-base-200"
                    >
                        <div className="p-4 space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium">Description</label>
                                    <button
                                        onClick={() => {
                                            if (isEditing) {
                                                handleDescriptionSave();
                                            } else {
                                                setIsEditing(true);
                                            }
                                        }}
                                        className={`text-xs px-2 py-1 rounded-full transition-all duration-300 
                                            ${isSelected && !hasDescription
                                            ? 'bg-primary/10 text-primary hover:bg-primary/20 animate-pulse shadow-lg ring-2 ring-primary/30'
                                            : isSelected
                                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                        disabled={!isSelected}
                                    >
                                        {isEditing ? 'Save' : 'Edit'}
                                    </button>
                                </div>
                                {isEditing ? (
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Add a description..."
                                        className="w-full p-2 rounded-lg border border-base-200 bg-base-100 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        autoFocus
                                    />
                                ) : (
                                    <p className="text-sm text-base-content/70">
                                        {description || 'No description available'}
                                    </p>
                                )}
                            </div>

                            <div className={`transition-all duration-300 ${hasDescription ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <label className="text-sm font-medium block mb-2">Images</label>
                                <ServiceImageUploader
                                    setIsImageUploading={setIsImageUploading}
                                    serviceName={service.name}
                                    userId={userId}
                                    shopId={shopId}
                                    initialImages={images}
                                    onImagesUpdate={(newImages) => {
                                        setImages(newImages);
                                        onServiceUpdate({...service, images: newImages, description});
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

/**
 * @fileoverview PresetServiceSelector Component
 * 
 * A sophisticated component for managing preset service selections in a barbershop
 * application with advanced features for service customization and management.
 * 
 * Key Features:
 * - Pre-configured service templates
 * - Dynamic service customization
 * - Real-time price and duration management
 * - Category-based filtering
 * - Search functionality
 * - Image management for services
 * - Multi-language support
 * 
 * Infrastructure:
 * - Integrates with Firebase for data persistence
 * - Handles image uploads and storage
 * - Manages service metadata
 * - Implements sophisticated state management
 * 
 * Props:
 * @param {Function} onServiceSelect - Handler for service selection
 * @param {Array} selectedServices - Currently selected services
 * @param {Function} setFormTouched - Form state handler
 * @param {string} userId - Current user identifier
 * @param {string} shopId - Current shop identifier
 * 
 * @example
 * <PresetServiceSelector
 *   onServiceSelect={handleServiceSelection}
 *   selectedServices={currentServices}
 *   setFormTouched={updateFormState}
 *   userId="user123"
 *   shopId="shop456"
 * />
 */

const PresetServiceSelector = ({ onServiceSelect, selectedServices, setFormTouched, userId, shopId, setIsImageUploading }) => {
    const {language} = useContext(LanguageContext);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");

    // Helper function to check if a service is selected
    const isServiceSelected = (service) => {
        return selectedServices?.some(s => s.name === service.name && s.price === service.price) ?? false;
    };

    const translations = {
        en: {
            menHaircut: "Men's Haircut",
            machineHaircut: "Machine Haircut",
            beardGrooming: "Beard Grooming",
            shave: "Shave",
            kidsHaircut: "Kids Haircut",
            coloring: "Coloring",
            highlights: "Highlights",
            washAndBlow: "Wash & Blow Dry",
            styling: "Styling",
            headMassage: "Head Massage",
            searchPlaceholder: "Search services...",
            categories: {
                all: "All Services",
                haircuts: "Haircuts",
                facial: "Facial Care",
                styling: "Styling",
                treatments: "Treatments"
            }
        }, tr: {
            menHaircut: "Erkek Saç Kesimi",
            machineHaircut: "Makine ile Saç Kesimi",
            beardGrooming: "Sakal Bakımı",
            shave: "Tıraş",
            kidsHaircut: "Çocuk Saç Kesimi",
            coloring: "Boyama",
            highlights: "Röfle",
            washAndBlow: "Yıkama ve Fön",
            styling: "Şekillendirme",
            headMassage: "Kafa Masajı",
            searchPlaceholder: "Hizmet ara...",
            categories: {
                all: "Tüm Hizmetler",
                haircuts: "Saç Kesimi",
                facial: "Yüz Bakımı",
                styling: "Şekillendirme",
                treatments: "Bakımlar"
            }
        }, ar: {
            menHaircut: "قص شعر رجالي",
            machineHaircut: "قص الشعر بالماكينة",
            beardGrooming: "تهذيب اللحية",
            shave: "حلاقة",
            kidsHaircut: "قص شعر الأطفال",
            coloring: "صبغ الشعر",
            highlights: "هايلايت",
            washAndBlow: "غسيل وتجفيف",
            styling: "تصفيف",
            headMassage: "تدليك الرأس",
            searchPlaceholder: "البحث عن الخدمات...",
            categories: {
                all: "جميع الخدمات",
                haircuts: "قص الشعر",
                facial: "العناية بالوجه",
                styling: "التصفيف",
                treatments: "العلاجات"
            }
        }, de: {
            menHaircut: "Herrenhaarschnitt",
            machineHaircut: "Maschinenhaarschnitt",
            beardGrooming: "Bartpflege",
            shave: "Rasur",
            kidsHaircut: "Kinderhaarschnitt",
            coloring: "Färben",
            highlights: "Strähnchen",
            washAndBlow: "Waschen & Föhnen",
            styling: "Styling",
            headMassage: "Kopfmassage",
            searchPlaceholder: "Dienste suchen...",
            categories: {
                all: "Alle Dienste",
                haircuts: "Haarschnitte",
                facial: "Gesichtspflege",
                styling: "Styling",
                treatments: "Behandlungen"
            }
        }
    };

    const t = translations[language];

    const filteredServices = presetServices.filter((service, index) => {
        const serviceName = t[Object.keys(t)[index]] || service.name;
        const matchesSearch = serviceName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === "all" || (serviceCategories[selectedCategory] || []).includes(index);
        return matchesSearch && matchesCategory;
    });

    const handleServiceSelect = (service) => {
        setFormTouched(true); // Add this
        onServiceSelect(service);
    };

    const handleServiceUpdate = (updatedService) => {
        setFormTouched(true);
        onServiceSelect(updatedService);
    };

    return (<div className="space-y-6">
            {/* Search and Categories */}
            <div className="space-y-4">
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50 w-5 h-5"/>
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-base-200 bg-base-100
                                 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {Object.entries(t.categories).map(([key, value]) => (<button
                            key={key}
                            onClick={() => setSelectedCategory(key)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all
                                ${selectedCategory === key ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300'}`}
                        >
                            {value}
                        </button>))}
                </div>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <AddServiceCard
                    setIsImageUploading={setIsImageUploading}
                    onServiceAdd={(newService) => {
                        setFormTouched(true);
                        onServiceSelect(newService);
                    }}
                    t={t}
                    userId={userId}
                    shopId={shopId}  // Add this line only
                />
                {filteredServices.map((service, index) => (
                    <ServiceCard
                        setIsImageUploading={setIsImageUploading}
                        key={index}
                        service={service}
                        index={index}
                        t={t}
                        isSelected={isServiceSelected(service)}
                        onClick={(e) => {
                            e.preventDefault();
                            setFormTouched(true);
                            onServiceSelect(service);  // For selection only
                        }}
                        onServiceUpdate={(updatedService) => {
                            setFormTouched(true);
                            const updatedServices = selectedServices.map(s =>
                                s.name === updatedService.name ? updatedService : s
                            );
                            onServiceSelect(updatedService, true);
                        }}
                        userId={userId}
                        shopId={shopId}  // Add this line only
                    />
                ))}
            </div>
        </div>);
};

export default PresetServiceSelector;