import React, {useContext, useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {collection, getDocs, query, where} from 'firebase/firestore';
import {db, storage} from '../firebase';
import { sanitizeHTML } from '../utils/sanitize';
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import LanguageContext from "./LanguageContext";
import {
    Award,
    Banknote,
    Calendar,
    ChevronRight,
    Clock,
    CreditCard,
    Mail,
    MapPin,
    Phone,
    Scissors,
    Smartphone,
    Star
} from 'lucide-react';
import {AnimatePresence, motion} from 'framer-motion';
import TabNavigation from "./TabNavigation";
import ServiceModal from './ServiceModal';
import {getDownloadURL, listAll, ref} from 'firebase/storage';

const ThemeProvider = ({theme, children}) => {
    const themeStyles = {
        '--primary-color': theme?.colors?.primary || '#2563eb',
        '--secondary-color': theme?.colors?.secondary || '#7c3aed',
        '--accent-color': theme?.colors?.accent || '#f59e0b',
        '--background-color': theme?.colors?.background || '#ffffff',
        '--heading-font': theme?.typography?.headingFont || 'Inter',
        '--body-font': theme?.typography?.bodyFont || 'Inter'
    };

    return (<div style={themeStyles}>
        {children}
    </div>);
};

const ShopLandingPage = () => {
    const {uniqueUrl} = useParams();
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('about');
    const [selectedService, setSelectedService] = useState(null);
    const {language} = useContext(LanguageContext);
    const [theme, setTheme] = useState('light');
    const [allServices, setAllServices] = useState([]);
    const [customServiceImages, setCustomServiceImages] = useState({});

    useEffect(() => {
        const fetchCustomServices = async () => {
            if (!shop?.ownerId) return;

            try {
                // Reference to the services folder
                const servicesRef = ref(storage, `shops/${shop.ownerId}/services`);

                // List all service folders
                const serviceFolders = await listAll(servicesRef);

                // Process each service folder
                for (const folder of serviceFolders.prefixes) {
                    console.log('Found service folder:', folder.name);

                    // List all images in the service folder
                    const images = await listAll(folder);
                    const imageUrls = await Promise.all(
                        images.items.map(async (imageRef) => {
                            const url = await getDownloadURL(imageRef);
                            return {
                                url,
                                path: imageRef.fullPath,
                                name: imageRef.name
                            };
                        })
                    );

                    console.log(`Service: ${folder.name}`, {
                        imageCount: imageUrls.length,
                        urls: imageUrls
                    });

                    // Store in state
                    setCustomServiceImages(prev => ({
                        ...prev,
                        [folder.name]: imageUrls
                    }));
                }
            } catch (error) {
                console.error('Error fetching custom services:', error);
            }
        };

        fetchCustomServices();
    }, [shop?.ownerId]);

    useEffect(() => {
        const fetchShopData = async () => {
            try {
                const shopsRef = collection(db, 'barberShops');
                const q = query(shopsRef, where("uniqueUrl", "==", uniqueUrl));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const shopDoc = querySnapshot.docs[0];
                    const shopData = shopDoc.data();
                    // console.log("SHOP DOC ID:", shopDoc.id);
                    // console.log("FULL SHOP DATA:", shopData);
                    // console.log("OWNER ID:", shopData.ownerId);
                    // console.log("TEMP SHOP:", shopData.tempShopId);

                    // Get tempShop if we have owner ID
                    if (shopData.ownerId) {
                        const tempShopsRef = collection(db, 'tempShops');
                        const tempQuery = query(tempShopsRef, where("ownerId", "==", shopData.ownerId));
                        const tempSnapshot = await getDocs(tempQuery);
                        // console.log("TEMP SHOPS FOUND:", tempSnapshot.docs.map(d => ({id: d.id, ...d.data()})));
                    }

                    const uniqueImageUrls = Array.from(new Set(shopData.imageUrls || []));
                    setShop({
                        id: shopDoc.id,
                        ...shopData,
                        imageUrls: uniqueImageUrls
                    });
                }
            } catch (error) {
                // console.error('Error fetching shop data:', error);
            } finally {
                setLoading(false);
            }
        };

        // Theme detection and persistence
        const savedTheme = localStorage.getItem('preferred-theme');
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('preferred-theme', 'dark');
        }

        // Theme change listener
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (e) => {
            const newTheme = e.matches ? 'dark' : 'light';
            setTheme(newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('preferred-theme', newTheme);
        };

        mediaQuery.addEventListener('change', handleThemeChange);

        // Fetch shop data
        fetchShopData();

        // Cleanup
        return () => {
            mediaQuery.removeEventListener('change', handleThemeChange);
        };
    }, [uniqueUrl]);

    useEffect(() => {
        const fetchShopData = async () => {
            try {
                const shopsRef = collection(db, 'barberShops');
                const q = query(shopsRef, where("uniqueUrl", "==", uniqueUrl));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const shopDoc = querySnapshot.docs[0];
                    const shopData = shopDoc.data();
                    console.log("SHOP DOC ID:", shopDoc.id);
                    console.log("FULL SHOP DATA:", shopData);
                    console.log("OWNER ID:", shopData.ownerId);

                    // Get tempShop if we have owner ID
                    if (shopData.ownerId) {
                        const tempShopsRef = collection(db, 'tempShops');
                        const tempQuery = query(tempShopsRef, where("ownerId", "==", shopData.ownerId));
                        const tempSnapshot = await getDocs(tempQuery);
                        console.log("TEMP SHOPS DETAILS:", tempSnapshot.docs.map(d => {
                            return {
                                id: d.id,
                                createdAt: d.data().createdAt?.toDate?.(),
                                ownerId: d.data().ownerId
                            }
                        }).sort((a, b) => b.createdAt - a.createdAt));
                    }

                    const uniqueImageUrls = Array.from(new Set(shopData.imageUrls || []));
                    setShop({
                        id: shopDoc.id,
                        ...shopData,
                        imageUrls: uniqueImageUrls
                    });
                }
            } catch (error) {
                console.error('Error fetching shop data:', error);
            } finally {
                setLoading(false);
            }
        };
    });

    useEffect(() => {
        const fetchShopData = async () => {
            try {
                const shopsRef = collection(db, 'barberShops');
                const q = query(shopsRef, where("uniqueUrl", "==", uniqueUrl));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const shopDoc = querySnapshot.docs[0];
                    const shopData = shopDoc.data();
                    // Ensure imageUrls is an array and remove any duplicate URLs
                    const uniqueImageUrls = Array.from(new Set(shopData.imageUrls || []));
                    setShop({
                        id: shopDoc.id, ...shopData, imageUrls: uniqueImageUrls
                    });
                }
            } catch (error) {
                console.error('Error fetching shop data:', error);
            } finally {
                setLoading(false);
            }
        };

        // Theme detection and persistence
        const savedTheme = localStorage.getItem('preferred-theme');
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('preferred-theme', 'dark');
        }

        // Theme change listener
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (e) => {
            const newTheme = e.matches ? 'dark' : 'light';
            setTheme(newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('preferred-theme', newTheme);
        };

        mediaQuery.addEventListener('change', handleThemeChange);

        // Fetch shop data
        fetchShopData();

        // Cleanup
        return () => {
            mediaQuery.removeEventListener('change', handleThemeChange);
        };
    }, [uniqueUrl]);

// Theme toggle function
    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('preferred-theme', newTheme);
    };

    if (loading) {
        return (<div className="min-h-screen flex items-center justify-center bg-base-200">
            <Scissors className="w-16 h-16 animate-spin text-primary"/>
        </div>);
    }

    if (!shop) {
        return (<div className="min-h-screen flex items-center justify-center bg-base-200">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                className="alert alert-error shadow-lg"
            >
                <span>{t.shopNotFound}</span>
            </motion.div>
        </div>);
    }

    const sliderSettings = {
        dots: true,
        infinite: shop.imageUrls.length > 1,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: shop.imageUrls.length > 1,
        autoplaySpeed: 3000,
    };

    const getCurrentDay = () => {
        return new Date().toLocaleDateString('en-US', {weekday: 'long'});
    };

    const isWorkingToday = (employee) => {
        const today = getCurrentDay();
        return employee.schedule && employee.schedule[today] && employee.schedule[today].length > 0;
    };

    const formatWorkingHours = (hours) => {
        if (!hours || hours.length === 0) return '';
        const start = hours[0];
        const end = hours[hours.length - 1] + 1;
        return `${start}:00 - ${end}:00`;
    };

    const translations = {
        en: {
            loading: "Loading...",
            shopNotFound: "Shop not found.",
            noImagesAvailable: "No images available",
            aboutUs: "About Us",
            address: "Address:",
            phone: "Phone:",
            email: "Email:",
            ourServices: "Our Services",
            availability: "Availability",
            closed: "Closed",
            bookNow: "Book Now",
            ourTeam: "Our Team",
            notWorkingToday: "Not working today",
            today: "today",
            payments: {
                title: "Accepted Payments",
                visa: "Visa",
                mastercard: "Mastercard",
                paypal: "PayPal",
                klarna: "Klarna",
                sepa: "SEPA Transfer",
                cash: "Cash",
                mobile: "Mobile Pay"
            }
        }, tr: {
            loading: "Yükleniyor...",
            shopNotFound: "Dükkan bulunamadı.",
            noImagesAvailable: "Resim mevcut değil",
            aboutUs: "Hakkımızda",
            address: "Adres:",
            phone: "Telefon:",
            email: "E-posta:",
            ourServices: "Hizmetlerimiz",
            availability: "Müsaitlik",
            closed: "Kapalı",
            bookNow: "Şimdi Rezervasyon Yap",
            ourTeam: "Ekibimiz",
            notWorkingToday: "Bugün çalışmıyor",
            today: "bugün",
            noEmployeesYet: "Henüz ekip üyesi yok",
            payments: {
                title: "Kabul Edilen Ödemeler",
                visa: "Visa",
                mastercard: "Mastercard",
                paypal: "PayPal",
                klarna: "Klarna",
                sepa: "SEPA Transferi",
                cash: "Nakit",
                mobile: "Mobil Ödeme"
            }
        }, ar: {
            loading: "جاري التحميل...",
            shopNotFound: "لم يتم العثور على المحل.",
            noImagesAvailable: "لا تتوفر صور",
            aboutUs: "معلومات عنا",
            address: "العنوان:",
            phone: "الهاتف:",
            email: "البريد الإلكتروني:",
            ourServices: "خدماتنا",
            availability: "الأوقات المتاحة",
            closed: "مغلق",
            bookNow: "احجز الآن",
            ourTeam: "فريقنا",
            notWorkingToday: "لا يعمل اليوم",
            today: "اليوم",
            noEmployeesYet: "لا يوجد أعضاء في الفريق حتى الآن",
            payments: {
                title: "طرق الدفع المقبولة",
                visa: "فيزا",
                mastercard: "ماستركارد",
                paypal: "باي بال",
                klarna: "كلارنا",
                sepa: "تحويل سيبا",
                cash: "نقداً",
                mobile: "دفع عبر الجوال"
            }
        }, de: {
            loading: "Wird geladen...",
            shopNotFound: "Geschäft nicht gefunden.",
            noImagesAvailable: "Keine Bilder verfügbar",
            aboutUs: "Über uns",
            address: "Adresse:",
            phone: "Telefon:",
            email: "E-Mail:",
            ourServices: "Unsere Dienstleistungen",
            availability: "Verfügbarkeit",
            closed: "Geschlossen",
            bookNow: "Jetzt buchen",
            ourTeam: "Unser Team",
            notWorkingToday: "Heute nicht im Dienst",
            today: "heute",
            noEmployeesYet: "Noch keine Teammitglieder",
            payments: {
                title: "Akzeptierte Zahlungsarten",
                visa: "Visa",
                mastercard: "Mastercard",
                paypal: "PayPal",
                klarna: "Klarna",
                sepa: "SEPA-Überweisung",
                cash: "Bargeld",
                mobile: "Mobile Zahlung"
            }
        }
    };

    const t = translations[language];

    const getPaymentMethodStyle = (method) => {
        switch (method.toLowerCase()) {
            case 'visa':
                return 'bg-[#1A1F71]/10 text-[#1A1F71] dark:bg-[#1A1F71]/20 dark:text-[#1A1F71]/90';
            case 'mastercard':
                return 'bg-[#EB001B]/10 text-[#EB001B] dark:bg-[#EB001B]/20 dark:text-[#EB001B]/90';
            case 'paypal':
                return 'bg-[#003087]/10 text-[#003087] dark:bg-[#003087]/20 dark:text-[#003087]/90';
            case 'klarna':
                return 'bg-[#FFB3C7]/10 text-[#FFB3C7] dark:bg-[#FFB3C7]/20 dark:text-[#FFB3C7]/90';
            case 'sepa':
                return 'bg-[#0052FF]/10 text-[#0052FF] dark:bg-[#0052FF]/20 dark:text-[#0052FF]/90';
            case 'cash':
                return 'bg-[#00C805]/10 text-[#00C805] dark:bg-[#00C805]/20 dark:text-[#00C805]/90';
            case 'mobile':
                return 'bg-[#5F259F]/10 text-[#5F259F] dark:bg-[#5F259F]/20 dark:text-[#5F259F]/90';
            default:
                return 'bg-base-200 text-base-content dark:bg-base-200/10';
        }
    };

    const getPaymentMethodIcon = (method) => {
        const iconProps = {className: "w-4 h-4"};
        switch (method.toLowerCase()) {
            case 'visa':
            case 'mastercard':
            case 'klarna':
                return <CreditCard {...iconProps} />;
            case 'paypal':
                return (
                    <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor">
                        <path
                            d="M20.1 6.34C19.95 5.55 19.46 4.88 18.76 4.38C18.06 3.88 17.19 3.62 16.29 3.62H11.13C10.95 3.62 10.79 3.71 10.71 3.86L7.47 14.62C7.41 14.82 7.57 15.02 7.78 15.02H10.39L11.21 11.31L11.19 11.41C11.25 11.18 11.46 11.03 11.69 11.03H13.02C16.02 11.03 18.35 9.45 19.01 5.95C19.02 5.89 19.02 5.83 19.03 5.77C18.98 5.77 18.98 5.77 19.03 5.77C19.12 5.94 19.19 6.13 19.24 6.34"/>
                    </svg>
                );
            case 'sepa':
            case 'cash':
                return <Banknote {...iconProps} />;
            case 'mobile':
                return <Smartphone {...iconProps} />;
            default:
                return <CreditCard {...iconProps} />;
        }
    };

    return (<ThemeProvider theme={shop.theme}>
        <div className="min-h-screen bg-base-200 transition-colors duration-300">
            {/* Theme Toggle */}
            {/*<button*/}
            {/*    onClick={toggleTheme}*/}
            {/*    className="fixed top-4 right-4 btn btn-circle btn-ghost z-50"*/}
            {/*>*/}
            {/*    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}*/}
            {/*</button>*/}

            {/* Hero Section */}
            {(!shop.blocks || shop.blocks.find(b => b.id === 'header')?.active) && (
                <div className="relative min-h-[80vh] bg-base-100">
                    <Slider {...sliderSettings}>
                        {shop.imageUrls.map((url, index) => (<div key={index} className="relative h-[80vh]">
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{backgroundImage: `url(${url})`}}
                            >
                                <div
                                    className="absolute inset-0 bg-gradient-to-b from-base-100/60 to-base-100/90"/>
                            </div>
                        </div>))}
                    </Slider>

                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        className="absolute inset-0 flex items-center justify-center z-10"
                    >
                        <div className="text-center space-y-6 p-4">
                            <h1 className="text-6xl md:text-7xl font-bold text-base-content">
                                {shop.name}
                            </h1>
                            <style>
                                {`
            .shop-description-hero {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: inherit;
            }
            .shop-description-hero h1 {
                font-size: 28px;
                margin-bottom: 16px;
            }
            .shop-description-hero h2 {
                font-size: 24px;
                margin-bottom: 16px;
            }
            .shop-description-hero h3 {
                font-size: 20px;
                margin: 16px 0 8px 0;
            }
            .shop-description-hero ul {
                margin-left: 20px;
                margin-bottom: 16px;
                list-style-type: disc;
            }
            .shop-description-hero li {
                margin-bottom: 8px;
            }
            .shop-description-hero p {
                margin-bottom: 16px;
            }
        `}
                            </style>
                            <div
                                className="shop-description-hero prose max-w-2xl mx-auto text-xl md:text-2xl text-base-content/80"
                                dangerouslySetInnerHTML={{
                                    __html: sanitizeHTML(shop.biography.split('</p>')[0] + '</p>') // This will take first paragraph only
                                }}
                            />
                            <div className="flex gap-4 justify-center">
                                <Link
                                    to={`/book/${shop.id}`}
                                    className="btn btn-primary btn-lg gap-2 rounded-full hover:gap-4 transition-all"
                                >
                                    <Calendar className="w-5 h-5"/>
                                    {t.bookNow}
                                    <ChevronRight className="w-5 h-5"/>
                                </Link>
                            </div>
                        </div>
                    </motion.div>

                    {/* Quick Info Bar */}
                    <motion.div
                        initial={{opacity: 0, y: 50}}
                        animate={{opacity: 1, y: 0}}
                        className="absolute bottom-0 left-0 right-0 bg-base-100/80 backdrop-blur-lg"
                    >
                        <div className="container mx-auto px-4 py-6">
                            <div className="flex flex-wrap justify-around gap-8 text-base-content">
                                <div className="flex items-center gap-3">
                                    <Clock className="text-primary w-6 h-6"/>
                                    <div>
                                        <p className="font-semibold">Today</p>
                                        <p>{shop.availability[new Date().toLocaleDateString('en-US', {weekday: 'long'})]?.open || t.closed}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="text-primary w-6 h-6"/>
                                    <div>
                                        <p className="font-semibold">{t.phone}</p>
                                        <p>{shop.phoneNumber}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="text-primary w-6 h-6"/>
                                    <div>
                                        <p className="font-semibold">{t.address}</p>
                                        <p>{shop.address.split(',')[0]}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>)}

            {/* Main Content */}
            <div className="container mx-auto px-4 py-16">
                <TabNavigation
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    hasTeamMembers={shop.employees?.length > 0}
                />

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -20}}
                        transition={{duration: 0.3}}
                    >
                        {activeTab === 'about' && (
                            <div className="space-y-8">
                                {/* About & Availability Row */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                                        <div className="card-body">
                                            <h3 className="text-2xl font-bold mb-4">{t.aboutUs}</h3>
                                            <style>
                                                {`
              .shop-description {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .shop-description h1 {
                color: #2c5282;
                font-size: 28px;
                margin-bottom: 16px;
              }
              .shop-description h2 {
                color: #2c5282;
                font-size: 24px;
                margin-bottom: 16px;
              }
              .shop-description h3 {
                color: #4a5568;
                font-size: 20px;
                margin: 16px 0 8px 0;
              }
              .shop-description ul {
                margin-left: 20px;
                margin-bottom: 16px;
                list-style-type: disc;
              }
              .shop-description li {
                margin-bottom: 8px;
              }
              .shop-description p {
                margin-bottom: 16px;
              }
            `}
                                            </style>
                                            <div
                                                className="shop-description prose max-w-none"
                                                dangerouslySetInnerHTML={{__html: sanitizeHTML(shop.biography)}}
                                            />
                                            <div className="divider"></div>
                                            <div className="space-y-4">
                                                <a
                                                    href={`tel:${shop.phoneNumber}`}
                                                    className="flex items-center gap-3 hover:text-primary transition-colors"
                                                >
                                                    <Phone className="w-5 h-5"/>
                                                    <span>{shop.phoneNumber}</span>
                                                </a>
                                                <a
                                                    href={`mailto:${shop.email}`}
                                                    className="flex items-center gap-3 hover:text-primary transition-colors"
                                                >
                                                    <Mail className="w-5 h-5"/>
                                                    <span>{shop.email}</span>
                                                </a>
                                                <a
                                                    href={`https://maps.google.com/?q=${shop.address}`}
                                                    target="_blank"
                                                    className="flex items-center gap-3 hover:text-primary transition-colors"
                                                    rel="noreferrer"
                                                >
                                                    <MapPin className="w-5 h-5"/>
                                                    <span>{shop.address}</span>
                                                </a>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                                        <div className="card-body">
                                            <h3 className="text-2xl font-bold mb-4">{t.availability}</h3>
                                            <div className="space-y-4">
                                                {Object.entries(shop.availability).map(([day, hours]) => (
                                                    <div
                                                        key={day}
                                                        className={`flex items-center justify-between p-3 rounded-lg transition-colors
                  ${day === new Date().toLocaleDateString('en-US', {weekday: 'long'}) ? 'bg-primary text-primary-content' : 'bg-base-200'}`}
                                                    >
                                                        <span className="font-medium">{day}</span>
                                                        <span>{hours ? `${hours.open} - ${hours.close}` : t.closed}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Team Section */}
                                {shop.employees && shop.employees.length > 0 && (
                                    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                                        <div className="card-body">
                                            <div id="team-section"
                                                 className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                                                <h3 className="text-2xl font-bold mb-4">{t.ourTeam}</h3>
                                                {shop.employees && shop.employees.length > 0 ? (
                                                    <div className="space-y-4">
                                                        {shop.employees.map((employee, index) => (
                                                            <motion.div
                                                                key={employee.id}
                                                                initial={{opacity: 0, y: 20}}
                                                                animate={{opacity: 1, y: 0}}
                                                                transition={{delay: index * 0.1}}
                                                                className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-lg bg-base-200 hover:bg-base-300 transition-all"
                                                            >
                                                                {/* Employee Photo */}
                                                                <div className="relative w-20 h-20">
                                                                    <img
                                                                        src={employee.photo || '/default-avatar.png'}
                                                                        alt={employee.name}
                                                                        className="w-full h-full object-cover rounded-full ring-2 ring-primary"
                                                                    />
                                                                    <div
                                                                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full flex items-center justify-center">
                                                                        <Scissors
                                                                            className="w-3 h-3 text-success-content"/>
                                                                    </div>
                                                                </div>

                                                                {/* Employee Info */}
                                                                <div className="flex-1 text-center sm:text-left">
                                                                    <h4 className="font-bold text-lg">{employee.name}</h4>
                                                                    {/* Expertise Tags */}
                                                                    <div
                                                                        className="flex flex-wrap gap-2 my-2 justify-center sm:justify-start">
                                                                        {employee.expertise.map((skill, i) => (
                                                                            <span
                                                                                key={i}
                                                                                className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                                                                            >
                        {skill}
                      </span>
                                                                        ))}
                                                                    </div>
                                                                    {/* Working Hours Today */}
                                                                    {employee.schedule && (
                                                                        <div className="text-sm text-base-content/70">
                                                                            <p className="flex items-center gap-2 justify-center sm:justify-start">
                                                                                <Clock className="w-4 h-4"/>
                                                                                {isWorkingToday(employee) ? (
                                                                                    `${formatWorkingHours(employee.schedule[getCurrentDay()])} ${t.today}`
                                                                                ) : (
                                                                                    t.notWorkingToday
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Book Button */}
                                                                <div className="mt-2 sm:mt-0">
                                                                    <Link
                                                                        to={`/book/${shop.id}?employee=${employee.id}`}
                                                                        className="btn btn-primary btn-sm gap-2 rounded-full"
                                                                    >
                                                                        <Calendar className="w-4 h-4"/>
                                                                        {t.bookNow}
                                                                    </Link>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-base-content/60 py-4">
                                                        {t.noEmployeesYet}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'services' && (
                            <div className="space-y-8">
                                {/* Payment Methods Section */}
                                <motion.div
                                    initial={{opacity: 0, y: 20}}
                                    animate={{opacity: 1, y: 0}}
                                    className="w-full"
                                >
                                    <div className="card bg-base-100 shadow-lg p-4">
                                        <div className="text-sm font-medium text-base-content/70 mb-3">
                                            {t.payments?.title || "Accepted Payments"}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {shop.paymentMethods?.map((method, index) => (
                                                <motion.div
                                                    key={method}
                                                    initial={{opacity: 0, scale: 0.8}}
                                                    animate={{opacity: 1, scale: 1}}
                                                    transition={{
                                                        delay: index * 0.1,
                                                        type: "spring",
                                                        stiffness: 300,
                                                        damping: 20
                                                    }}
                                                    className={`
                                inline-flex items-center gap-2 px-3 py-1.5 
                                rounded-full text-sm font-medium
                                ${getPaymentMethodStyle(method)}
                                transition-all duration-300 hover:scale-105
                                shadow-sm hover:shadow-md
                            `}
                                                >
                                                    {getPaymentMethodIcon(method)}
                                                    <span className="hidden sm:inline">
                                {translations[language]?.payments?.[method.toLowerCase()] || method}
                            </span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {shop.services.map((service, index) => {
                                        const imageUrl = customServiceImages[service.name]?.[0]?.url;

                                        return (
                                            <motion.div
                                                key={service.name}
                                                initial={{opacity: 0, y: 20}}
                                                animate={{opacity: 1, y: 0}}
                                                transition={{delay: index * 0.1}}
                                                className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all cursor-pointer"
                                                onClick={() => setSelectedService({
                                                    ...service,
                                                    imageUrl: imageUrl // Add the image URL to the modal data
                                                })}
                                            >
                                                {imageUrl && (
                                                    <div className="w-full h-48 overflow-hidden">
                                                        <img
                                                            src={imageUrl}
                                                            alt={service.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}
                                                <div className="card-body">
                                                    <h3 className="card-title">{service.name}</h3>
                                                    <p className="text-2xl font-bold text-primary">€{service.price}</p>
                                                    <p>{service.duration} min</p>
                                                    <p>{service.description}</p>
                                                    <div className="card-actions justify-end">
                                                        <Link
                                                            to={`/book/${shop.id}?service=${service.name}`}
                                                            className="btn btn-primary btn-sm gap-2 rounded-full hover:gap-3 transition-all"
                                                        >
                                                            <Calendar className="w-4 h-4"/>
                                                            {t.bookNow}
                                                        </Link>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'gallery' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {shop.imageUrls.map((url, index) => (<motion.div
                                    key={index}
                                    initial={{opacity: 0, scale: 0.9}}
                                    animate={{opacity: 1, scale: 1}}
                                    transition={{delay: index * 0.1}}
                                    className="aspect-square rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all"
                                >
                                    <img
                                        src={url}
                                        alt={`${shop.name} - Image ${index + 1}`}
                                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                                    />
                                </motion.div>))}
                            </div>)}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Service Modal */}
            {selectedService && (
                <ServiceModal
                    service={selectedService}
                    shopId={shop.id}
                    onClose={() => setSelectedService(null)}
                    t={t}
                />
            )}

            {/* Floating Action Button */}
            <motion.div
                initial={{opacity: 0, scale: 0}}
                animate={{opacity: 1, scale: 1}}
                className="fixed bottom-8 right-8 z-50 hidden lg:block" // Changed this line
            >
                <Link
                    to={`/book/${shop.id}`}
                    className="btn btn-primary btn-lg shadow-lg rounded-full gap-2 hover:gap-3 transition-all hover:shadow-2xl"
                >
                    <Calendar className="w-6 h-6"/>
                    {t.bookNow}
                    <ChevronRight className="w-6 h-6"/>
                </Link>
            </motion.div>

            {/* Quick Service Booking Drawer */}
            <div className="drawer drawer-end">
                <input id="quick-book-drawer" type="checkbox" className="drawer-toggle"/>
                <div className="drawer-content">
                    {/* Page content here */}
                </div>
                <div className="drawer-side">
                    <label htmlFor="quick-book-drawer" className="drawer-overlay"></label>
                    <div className="menu p-4 w-80 min-h-full bg-base-200 text-base-content">
                        <h3 className="text-2xl font-bold mb-4">{t.quickBook}</h3>
                        <div className="space-y-4">
                            {shop.services.map((service, index) => (<motion.div
                                key={index}
                                initial={{opacity: 0, x: 20}}
                                animate={{opacity: 1, x: 0}}
                                transition={{delay: index * 0.1}}
                                className="card bg-base-100 shadow hover:shadow-lg transition-all"
                            >
                                <div className="card-body p-4">
                                    <h4 className="card-title text-lg">{service.name}</h4>
                                    <p className="text-xl font-bold text-primary">€{service.price}</p>
                                    <div className="card-actions justify-end">
                                        <Link
                                            to={`/book/${shop.id}?service=${service.name}`}
                                            className="btn btn-primary btn-sm"
                                        >
                                            {t.select}
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            {(!shop.blocks || shop.blocks.find(b => b.id === 'features')?.active) && (
                <div className="bg-base-200 py-16">
                    {(!shop.blocks || shop.blocks.find(b => b.id === 'services')?.active) && (
                        <div className="container mx-auto px-4">
                            <motion.div
                                initial={{opacity: 0, y: 20}}
                                animate={{opacity: 1, y: 0}}
                                className="grid grid-cols-1 md:grid-cols-3 gap-8"
                            >
                                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all">
                                    <div className="card-body items-center text-center">
                                        <Award className="w-12 h-12 text-primary mb-4"/>
                                        <h3 className="card-title">Premium Service</h3>
                                        <p className="text-base-content/80">Experience the highest quality hair care
                                            with
                                            our
                                            expert stylists</p>
                                    </div>
                                </div>
                                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all">
                                    <div className="card-body items-center text-center">
                                        <Clock className="w-12 h-12 text-primary mb-4"/>
                                        <h3 className="card-title">Easy Booking</h3>
                                        <p className="text-base-content/80">Book your appointment online 24/7 with
                                            our
                                            convenient system</p>
                                    </div>
                                </div>
                                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all">
                                    <div className="card-body items-center text-center">
                                        <Scissors className="w-12 h-12 text-primary mb-4"/>
                                        <h3 className="card-title">Expert Stylists</h3>
                                        <p className="text-base-content/80">Our team of professionals is here to
                                            make
                                            you
                                            look
                                            your best</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>)}
                </div>)}

            {/* Reviews Section */}
            {shop.reviews && shop.reviews.length > 0 && (!shop.blocks || shop.blocks.find(b => b.id === 'reviews')?.active) && (
                <div className="bg-base-100 py-16">
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl font-bold text-center mb-12">{t.clientReviews}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {shop.reviews.map((review, index) => (<motion.div
                                key={index}
                                initial={{opacity: 0, y: 20}}
                                animate={{opacity: 1, y: 0}}
                                transition={{delay: index * 0.1}}
                                className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all"
                            >
                                <div className="card-body">
                                    <div className="flex items-center gap-2 mb-4">
                                        {[...Array(5)].map((_, i) => (<Star
                                            key={i}
                                            className={`w-5 h-5 ${i < review.rating ? 'text-primary fill-primary' : 'text-base-content/20'}`}
                                        />))}
                                    </div>
                                    <p className="text-base-content/80 italic">"{review.comment}"</p>
                                    <div className="mt-4">
                                        <p className="font-semibold">{review.name}</p>
                                        <p className="text-sm text-base-content/60">{review.date}</p>
                                    </div>
                                </div>
                            </motion.div>))}
                        </div>
                    </div>
                </div>)}

            {/* Bottom CTA */}
            {(!shop.blocks || shop.blocks.find(b => b.id === 'cta')?.active) && (
                <div className="bg-primary text-primary-content py-16">
                    <div className="container mx-auto px-4 text-center">
                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            className="space-y-6"
                        >
                            <h2 className="text-4xl font-bold">{t.readyToBook}</h2>
                            <p className="text-xl max-w-2xl mx-auto">{t.bookingPrompt}</p>
                            <Link
                                to={`/book/${shop.id}`}
                                className="btn btn-lg btn-secondary gap-2 hover:gap-3 transition-all"
                            >
                                <Calendar className="w-6 h-6"/>
                                {t.bookNow}
                                <ChevronRight className="w-6 h-6"/>
                            </Link>
                        </motion.div>
                    </div>
                </div>)}

            {/* Footer */}
            {(!shop.blocks || shop.blocks.find(b => b.id === 'footer')?.active) && (
                <footer className="footer footer-center p-10 bg-base-200 text-base-content">
                    <div>
                        <h2 className="text-2xl font-bold">{shop.name}</h2>
                        <p>{shop.address}</p>
                        <p>{shop.phoneNumber}</p>
                    </div>
                    <div>
                        <div className="grid grid-flow-col gap-4">
                            <a className="link link-hover">{t.privacyPolicy}</a>
                            <a className="link link-hover">{t.termsOfService}</a>
                            <a className="link link-hover">{t.contact}</a>
                        </div>
                    </div>
                </footer>)}
        </div>
    </ThemeProvider>);
};

export default ShopLandingPage;