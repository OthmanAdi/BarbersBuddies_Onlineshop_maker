import React, {useContext, useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {collection, doc, enableMultiTabIndexedDbPersistence, getDoc, getDocs, query, where} from 'firebase/firestore';
import {auth, db} from '../firebase';
import {Link} from 'react-router-dom';
import {
    Banknote,
    Book,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Mail,
    MapPin,
    Phone,
    Smartphone,
    Star,
    Users,
    WifiOff
} from 'lucide-react';
import LanguageContext from "./LanguageContext";
import '../App.css';
import OpeningTimeList from "./OpeningTimeList";
import ReviewTrigger from "./ReviewDialog";
import BiographyDialog from "./BiographyDialog";
import EmployeeDialog from "./EmployeeDialog";
import ShopLinkButton from "./ShopLinkButton";
import ServicesDropdown from "./ServicesDropdown";
import LocationBasedBarberSorting from "./LocationBasedBarberSorting";
import BarberShopsMap from "./BarberShopsMap";
import BeautifulBarbershopLoader from "./BeautifulBarbershopLoader";

// Enable offline persistence
try {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time
            console.warn('Multiple tabs open, persistence enabled in first tab only');
        } else if (err.code === 'unimplemented') {
            // The current browser doesn't support persistence
            console.warn('Browser does not support persistence');
        }
    });
} catch (err) {
    console.warn('Persistence already enabled');
}

// Simple translations object
const translations = {
    en: {
        loading: "Loading...",
        error: "Failed to fetch barbers. Please try again later.",
        noImageAvailable: "No image available",
        prev: "Prev",
        next: "Next",
        address: "Address:",
        phone: "Phone:",
        email: "Email:",
        biography: "Biography:",
        noBiographyAvailable: "No biography available",
        createdAt: "Created At:",
        availability: "Availability:",
        noAvailabilityInfo: "No availability information",
        noAvailableHoursSet: "No available hours set",
        services: "Services:",
        bookNow: "Book Now",
        '€': 'Budget',
        '€€': 'Mid-range',
        '€€€': 'Luxury',
        viewTeam: "Our Team",
        acceptedPayments: 'Accepted Payments',
    },
    tr: {
        loading: "Yükleniyor...",
        error: "Berberler getirilemedi. Lütfen daha sonra tekrar deneyin.",
        noImageAvailable: "Resim mevcut değil",
        prev: "Önceki",
        next: "Sonraki",
        address: "Adres:",
        phone: "Telefon:",
        email: "E-posta:",
        biography: "Biyografi:",
        noBiographyAvailable: "Biyografi mevcut değil",
        createdAt: "Oluşturulma Tarihi:",
        availability: "Müsaitlik:",
        noAvailabilityInfo: "Müsaitlik bilgisi yok",
        noAvailableHoursSet: "Müsait saat ayarlanmamış",
        services: "Hizmetler:",
        bookNow: "Şimdi Rezervasyon Yap",
        '€': 'Ekonomik',
        '€€': 'Orta Segment',
        '€€€': 'Lüks',
        viewTeam: "Ekibimiz",
        acceptedPayments: 'Kabul Edilen Ödemeler',
    },
    ar: {
        loading: "جاري التحميل...",
        error: "فشل في جلب الحلاقين. يرجى المحاولة مرة أخرى لاحقًا.",
        noImageAvailable: "لا تتوفر صورة",
        prev: "السابق",
        next: "التالي",
        address: "العنوان:",
        phone: "الهاتف:",
        email: "البريد الإلكتروني:",
        biography: "السيرة الذاتية:",
        noBiographyAvailable: "لا تتوفر سيرة ذاتية",
        createdAt: "تم الإنشاء في:",
        availability: "التوفر:",
        noAvailabilityInfo: "لا توجد معلومات عن التوفر",
        noAvailableHoursSet: "لم يتم تعيين ساعات متاحة",
        services: "الخدمات:",
        bookNow: "احجز الآن",
        '€': 'اقتصادي',
        '€€': 'متوسط',
        '€€€': 'فاخر',
        viewTeam: "فريقنا",
        acceptedPayments: 'طرق الدفع المقبولة',
    },
    de: {
        loading: "Wird geladen...",
        error: "Friseure konnten nicht abgerufen werden. Bitte versuchen Sie es später erneut.",
        noImageAvailable: "Kein Bild verfügbar",
        prev: "Zurück",
        next: "Weiter",
        address: "Adresse:",
        phone: "Telefon:",
        email: "E-Mail:",
        biography: "Biografie:",
        noBiographyAvailable: "Keine Biografie verfügbar",
        createdAt: "Erstellt am:",
        availability: "Verfügbarkeit:",
        noAvailabilityInfo: "Keine Verfügbarkeitsinformationen",
        noAvailableHoursSet: "Keine verfügbaren Stunden festgelegt",
        services: "Dienstleistungen:",
        bookNow: "Jetzt buchen",
        '€': 'Günstig',
        '€€': 'Mittelklasse',
        '€€€': 'Luxus',
        viewTeam: "Unser Team",
        acceptedPayments: 'Akzeptierte Zahlungen',
    }
};

const BarberList = ({selectedCategories, selectedPricing}) => {
    const [barbers, setBarbers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [currentImageIndices, setCurrentImageIndices] = useState({});
    const [shopRatings, setShopRatings] = useState({});
    const {language} = useContext(LanguageContext);
    const t = translations[language] || translations.en;
    const [selectedBiography, setSelectedBiography] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedShopName, setSelectedShopName] = useState('');
    const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
    const [selectedShopEmployees, setSelectedShopEmployees] = useState(null);

    const [currentUser, setCurrentUser] = useState(null);
    const [userType, setUserType] = useState(null);

    const [userLocation, setUserLocation] = useState(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            setCurrentUser(user);
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserType(userDoc.data().userType);
                }
            } else {
                setUserType(null);
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Combined data fetching
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch barbers
                const barbersCollection = collection(db, 'barberShops');
                const barberSnapshot = await getDocs(barbersCollection);
                const barberList = barberSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Fetch ratings
                const ratingsCollection = collection(db, 'ratings');
                const ratingsSnapshot = await getDocs(
                    query(ratingsCollection, where('status', '==', 'active'))
                );

                // Calculate ratings
                const ratings = {};
                ratingsSnapshot.docs.forEach(doc => {
                    const ratingData = doc.data();
                    const shopId = ratingData.shopId;

                    if (!ratings[shopId]) {
                        ratings[shopId] = {
                            totalRating: 0,
                            count: 0,
                            distribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
                        };
                    }

                    ratings[shopId].totalRating += ratingData.rating;
                    ratings[shopId].count += 1;
                    ratings[shopId].distribution[ratingData.rating] += 1;
                });

                // Calculate averages and percentages
                Object.keys(ratings).forEach(shopId => {
                    const shopRating = ratings[shopId];
                    shopRating.averageRating = (shopRating.totalRating / shopRating.count).toFixed(1);
                    Object.keys(shopRating.distribution).forEach(stars => {
                        shopRating.distribution[stars] =
                            ((shopRating.distribution[stars] / shopRating.count) * 100).toFixed(1);
                    });
                });

                // Set states
                setShopRatings(ratings);
                setBarbers(barberList);

                // Set initial image indices
                const initialIndices = {};
                barberList.forEach(barber => {
                    initialIndices[barber.id] = 0;
                });
                setCurrentImageIndices(initialIndices);

            } catch (error) {
                console.error("Error fetching data: ", error);
                if (!navigator.onLine) {
                    setError("offline");
                } else {
                    setError("Failed to fetch data");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []); // Single useEffect for all data fetching

    const handleAddressClick = (address) => {
        const encodedAddress = encodeURIComponent(address);
        // Check if it's mobile
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            window.location.href = `https://maps.google.com?q=${encodedAddress}`;
        } else {
            window.open(`https://maps.google.com?q=${encodedAddress}`, '_blank');
        }
    };

    const toggleImage = (barberId, direction) => {
        setCurrentImageIndices(prevIndices => {
            const barber = barbers.find(b => b.id === barberId);
            if (!barber?.imageUrls?.length) return prevIndices;

            const currentIndex = prevIndices[barberId];
            const imageCount = barber.imageUrls.length;
            let newIndex;
            if (direction === 'next') {
                newIndex = (currentIndex + 1) % imageCount;
            } else {
                newIndex = (currentIndex - 1 + imageCount) % imageCount;
            }
            return {...prevIndices, [barberId]: newIndex};
        });
    };

    const handlePhoneClick = (phoneNumber) => {
        window.location.href = `tel:${phoneNumber}`;
    };

    const handleEmailClick = (email) => {
        window.location.href = `mailto:${email}`;
    };

    const formatAvailability = (availability) => {
        if (!availability || typeof availability !== 'object') {
            return t.noAvailability;
        }
        return Object.entries(availability)
            .filter(([_, hours]) => hours?.open && hours?.close)
            .map(([day, hours]) => `${day}: ${hours.open}-${hours.close}`)
            .join(', ');
    };

    const renderRatingStars = (shopId) => {
        const shopRating = shopRatings[shopId];
        const rating = shopRating ? parseFloat(shopRating.averageRating) : 0;
        const reviewCount = shopRating ? shopRating.count : 0;

        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                        <Star
                            key={i}
                            className={`w-4 h-4 ${
                                i < Math.round(rating)
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-base-300'
                            }`}
                        />
                    ))}
                </div>
                {reviewCount > 0 && (
                    <span className="text-sm text-base-content/70">
                        ({rating} • {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                    </span>
                )}
            </div>
        );
    };

    const filteredBarbers = barbers.filter(barber => {
        const matchesCategory = selectedCategories.length === 0 ||
            selectedCategories.some(cat => barber.categories?.includes(cat));
        const matchesPricing = !selectedPricing || barber.pricingTier === selectedPricing;
        return matchesCategory && matchesPricing;
    });

    const renderBookingButton = (barber) => {
        if (!currentUser || userType === 'shop-owner') {
            return null;
        }

        return (
            <Link to={`/book/${barber.id}`} className="flex-shrink-0">
                <motion.button
                    whileHover={{scale: 1.02}}
                    whileTap={{scale: 0.98}}
                    className="btn btn-md bg-primary hover:bg-primary/90 dark:bg-primary/90
                    dark:hover:bg-primary text-primary-content shadow-sm hover:shadow-md
                    transition-all duration-300 border-none font-medium px-4 whitespace-nowrap"
                >
                    {t.bookNow}
                </motion.button>
            </Link>
        );
    };


    const getPaymentMethodStyle = (method) => {
        switch (method.toLowerCase()) {
            case 'visa':
                return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            case 'mastercard':
                return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
            case 'cash':
                return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300';
            case 'mobile':
                return 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
            case 'paypal':
                return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
            case 'klarna':
                return 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300';
            case 'sepa':
                return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
            default:
                return 'bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
        }
    };

    const getPaymentMethodIcon = (method) => {
        const iconProps = {className: "w-3 h-3"};
        switch (method.toLowerCase()) {
            case 'visa':
                return <CreditCard {...iconProps} />;
            case 'mastercard':
                return <CreditCard {...iconProps} />;
            case 'cash':
                return <Banknote {...iconProps} />;
            case 'mobile':
                return <Smartphone {...iconProps} />;
            case 'paypal':
                return <CreditCard {...iconProps} />;
            case 'klarna':
                return <CreditCard {...iconProps} />;
            case 'sepa':
                return <Banknote {...iconProps} />;
            default:
                return <CreditCard {...iconProps} />;
        }
    };

    const getPaymentMethodLabel = (method, language) => {
        const labels = {
            en: {
                visa: 'Visa',
                mastercard: 'Mastercard',
                cash: 'Cash',
                mobile: 'Mobile Pay',
                paypal: 'PayPal',
                klarna: 'Klarna',
                sepa: 'SEPA'
            },
            tr: {
                visa: 'Visa',
                mastercard: 'Mastercard',
                cash: 'Nakit',
                mobile: 'Mobil Ödeme',
                paypal: 'PayPal',
                klarna: 'Klarna',
                sepa: 'SEPA'
            },
            ar: {
                visa: 'فيزا',
                mastercard: 'ماستركارد',
                cash: 'نقداً',
                mobile: 'دفع موبايل',
                paypal: 'باي بال',
                klarna: 'كلارنا',
                sepa: 'سيبا'
            },
            de: {
                visa: 'Visa',
                mastercard: 'Mastercard',
                cash: 'Bargeld',
                mobile: 'Mobile Zahlung',
                paypal: 'PayPal',
                klarna: 'Klarna',
                sepa: 'SEPA'
            }
        };

        return labels[language]?.[method.toLowerCase()] || method;
    };

    return (
        <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            className="w-full"
        >

            {isOffline && (
                <motion.div
                    initial={{opacity: 0, y: -20}}
                    animate={{opacity: 1, y: 0}}
                    className="mb-4 p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2"
                >
                    <WifiOff className="w-5 h-5 text-warning"/>
                    <span className="text-warning">{t.offline}</span>
                </motion.div>
            )}


            {loading ? (
                <BeautifulBarbershopLoader language={language} />
            ) : error ? (
                <div className="text-center p-4 bg-error/10 text-error rounded-lg">
                    {error}
                </div>
            ) : (
                <>
                    <LocationBasedBarberSorting
                        barbers={barbers}
                        setBarbers={setBarbers}
                        language={language}
                        onLocationChange={setUserLocation}  // Add this prop
                    />

                    <div className="mb-4 flex justify-between items-center">
                        <div>
                <span className="text-sm text-base-content/70">
                    Found {filteredBarbers.length} barbershops
                </span>
                        </div>
                        <BarberShopsMap
                            barbers={filteredBarbers}
                            userLocation={userLocation}
                            language={language}
                            onShopSelect={(shopId) => {
                                const element = document.getElementById(`shop-${shopId}`);
                                if (element) element.scrollIntoView({behavior: 'smooth'});
                            }}
                        />
                    </div>

                    <motion.div layout className="grid gap-6 auto-rows-auto...">
                        <AnimatePresence>
                            {filteredBarbers.map((barber) => (
                                <motion.div
                                    id={`shop-${barber.id}`}
                                    key={barber.id}
                                    initial={{opacity: 0}}
                                    animate={{opacity: 1}}
                                    exit={{opacity: 0}}
                                    transition={{duration: 0.3}}
                                    className="rounded-xl bg-base-100 shadow-sm hover:shadow-lg
                                    transition-all duration-300 overflow-hidden border border-base-300
                                    hover:border-base-content/10"
                                >
                                    {/* Image Section */}
                                    {barber.imageUrls?.length > 0 && (
                                        <div className="relative h-56 overflow-hidden">
                                            <motion.img
                                                src={barber.imageUrls[currentImageIndices[barber.id]]}
                                                alt={barber.name}
                                                className="w-full h-full object-cover"
                                            />
                                            {barber.imageUrls.length > 1 && (
                                                <div className="absolute inset-x-0 bottom-0 flex justify-between p-2">
                                                    <motion.button
                                                        whileHover={{scale: 1.1}}
                                                        whileTap={{scale: 0.9}}
                                                        onClick={() => toggleImage(barber.id, 'prev')}
                                                        className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                                                    >
                                                        <ChevronLeft className="w-5 h-5 text-white"/>
                                                    </motion.button>
                                                    <motion.button
                                                        whileHover={{scale: 1.1}}
                                                        whileTap={{scale: 0.9}}
                                                        onClick={() => toggleImage(barber.id, 'next')}
                                                        className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                                                    >
                                                        <ChevronRight className="w-5 h-5 text-white"/>
                                                    </motion.button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Content Section */}
                                    <div className="p-5 space-y-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-1 flex-1 min-w-0"> {/* Added flex-1 and min-w-0 */}
                                                <h2 className="text-xl font-semibold text-base-content truncate">
                                                    {barber.name}
                                                </h2>

                                                {barber.distance !== undefined && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1
                 bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary-content
                 text-xs font-medium rounded-full shadow-sm">
    <MapPin className="w-3 h-3" />
                                                        {barber.distance === Infinity
                                                            ? "Unknown"
                                                            : barber.distance < 1
                                                                ? `${Math.round(barber.distance * 1000)}m`
                                                                : `${barber.distance.toFixed(1)}km`}
  </span>
                                                )}

                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {barber.categories?.map((category, index) => {
                                                        // Pastel color mapping for your specific categories stored in Firebase
                                                        const getCategoryColor = (category) => {
                                                            switch (category.toLowerCase()) {
                                                                case 'traditional':
                                                                    return 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
                                                                case 'african':
                                                                    return 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300';
                                                                case 'kids':
                                                                    return 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300';
                                                                case 'women':
                                                                    return 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300';
                                                                case 'luxury':
                                                                    return 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300';
                                                                case 'modern':
                                                                    return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300';
                                                                case 'beard':
                                                                    return 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300';
                                                                case 'unisex':
                                                                    return 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300';
                                                                default:
                                                                    return 'bg-slate-50 text-slate-600 dark:bg-slate-900/30 dark:text-slate-300';
                                                            }
                                                        };

                                                        const CATEGORY_LABELS = {
                                                            traditional: 'Traditional Barbering',
                                                            african: 'African & Textured Hair',
                                                            kids: 'Kids Specialist',
                                                            women: "Women's Services",
                                                            luxury: 'Luxury Experience',
                                                            modern: 'Modern & Trendy',
                                                            beard: 'Beard Specialist',
                                                            unisex: 'Unisex Salon'
                                                        };

                                                        return (
                                                            <span
                                                                key={index}
                                                                className={`text-sm px-2 py-1 rounded-full font-medium
                ${getCategoryColor(category)}`}
                                                            >
            {CATEGORY_LABELS[category] || category}
        </span>
                                                        );
                                                    })}
                                                    {barber.pricingTier && (
                                                        <span
                                                            className="text-sm text-primary bg-primary/10 px-2 py-1 rounded-full">
        {barber.pricingTier} • {translations[language][barber.pricingTier] || barber.pricingTier}
    </span>
                                                    )}
                                                </div>
                                                {renderRatingStars(barber.id)}
                                                <div className="flex gap-2">
                                                    <ReviewTrigger
                                                        shopId={barber.id}
                                                        initialRating={shopRatings[barber.id]?.averageRating || 0}
                                                        reviewCount={shopRatings[barber.id]?.count || 0}
                                                        distribution={shopRatings[barber.id]?.distribution}
                                                    />
                                                    <motion.button
                                                        whileHover={{scale: 1.02}}
                                                        whileTap={{scale: 0.98}}
                                                        onClick={() => {
                                                            setSelectedBiography(barber.biography);
                                                            setSelectedShopName(barber.name);
                                                            setIsDialogOpen(true);
                                                        }}
                                                        className="btn btn-sm btn-ghost gap-2"
                                                    >
                                                        <Book className="w-4 h-4"/>
                                                        {language === 'tr' ? 'Hakkında' :
                                                            language === 'ar' ? 'نبذة' :
                                                                language === 'de' ? 'Über uns' :
                                                                    'About'}
                                                    </motion.button>
                                                    {barber.employees && barber.employees.length > 0 && (
                                                        <motion.button
                                                            whileHover={{scale: 1.02}}
                                                            whileTap={{scale: 0.98}}
                                                            onClick={() => {
                                                                setSelectedShopEmployees(barber.employees);
                                                                setIsEmployeeDialogOpen(true);
                                                            }}
                                                            className="btn btn-sm btn-ghost gap-2"
                                                        >
                                                            <Users className="w-4 h-4"/>
                                                            {t.viewTeam}
                                                        </motion.button>
                                                    )}
                                                </div>
                                            </div>

                                            <Link to={`/book/${barber.id}`} className="flex-shrink-0">
                                                {renderBookingButton(barber)}
                                            </Link>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <motion.button
                                                    whileHover={{scale: 1.02}}
                                                    onClick={() => handlePhoneClick(barber.phoneNumber)}
                                                    className="flex items-center gap-2 text-base-content/70 hover:text-primary
                        transition-colors w-full"
                                                >
                                                    <Phone className="w-4 h-4"/>
                                                    <span className="text-sm">{barber.phoneNumber}</span>
                                                </motion.button>

                                                <motion.button
                                                    whileHover={{scale: 1.02}}
                                                    onClick={() => handleEmailClick(barber.email)}
                                                    className="flex items-center gap-2 text-base-content/70 hover:text-primary
                        transition-colors w-full"
                                                >
                                                    <Mail className="w-4 h-4"/>
                                                    <span className="text-sm truncate">{barber.email}</span>
                                                </motion.button>

                                                <motion.div
                                                    whileHover={{scale: 1.02}}
                                                    onClick={() => handleAddressClick(barber.address)}
                                                    className="flex items-center gap-2 text-base-content/70 cursor-pointer hover:text-primary transition-colors"
                                                >
                                                    <MapPin className="w-4 h-4 flex-shrink-0"/>
                                                    <span className="text-sm truncate">{barber.address}</span>
                                                </motion.div>
                                            </div>

                                            <div className="space-y-2">
                                                <ServicesDropdown services={barber.services}/>
                                            </div>

                                            <div className="col-span-2 flex flex-wrap gap-2 mt-2">
                                                {barber.paymentMethods?.map((method, index) => (
                                                    <motion.div
                                                        key={method}
                                                        initial={{opacity: 0, scale: 0.8}}
                                                        animate={{opacity: 1, scale: 1}}
                                                        transition={{
                                                            delay: index * 0.1,
                                                            duration: 0.2,
                                                            type: "spring",
                                                            stiffness: 300
                                                        }}
                                                        className={`
                inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                ${getPaymentMethodStyle(method)}
                transition-all duration-300 hover:scale-105
            `}
                                                    >
                                                        {getPaymentMethodIcon(method)}
                                                        {getPaymentMethodLabel(method, language)}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>

                                        {console.log('barber data:', barber)}
                                        <ShopLinkButton uniqueUrl={barber.uniqueUrl || barber.id}/>

                                        <OpeningTimeList shop={barber}/>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}

            <BiographyDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                biography={selectedBiography}
                shopName={selectedShopName}
            />

            <EmployeeDialog
                isOpen={isEmployeeDialogOpen}
                onClose={() => setIsEmployeeDialogOpen(false)}
                employees={selectedShopEmployees}
                language={language}
            />
        </motion.div>
    );
};

export default BarberList;