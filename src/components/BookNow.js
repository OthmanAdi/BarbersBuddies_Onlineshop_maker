import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';
import {doc, getDoc} from 'firebase/firestore';
import {auth, db} from '../firebase';
import { sanitizeHTML } from '../utils/sanitize';
import {Swiper, SwiperSlide} from 'swiper/react';
import {Autoplay, Navigation, Pagination} from 'swiper/modules';
import ServiceSelectionStep from '../components/ServiceSelectionStep';
import DateTimeSelectionStep from '../components/DateTimeSelectionStep';
import PersonalDetailsStep from '../components/PersonalDetailsStep';
import ShopInfoCard from '../components/ShopInfoCard';
import AvailabilityCard from '../components/AvailabilityCard';
import ReactConfetti from 'react-confetti';
import {CheckCircleIcon, XCircleIcon} from '@heroicons/react/24/solid';
import {motion} from 'framer-motion';
import {onAuthStateChanged} from 'firebase/auth';
import {iterateCivilSlots, weekdayForCivilDate} from '../booking-v2/civilTime';
import {createPublicBookingV2Adapter} from '../booking-v2/createBookingAdapter';
import {appRuntime} from '../runtime/currentAppRuntime';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import LanguageContext from "./LanguageContext";
import LoadingOverlay from "./LoadingOverlay";
import EmployeeSelectionStep from "./EmployeeSelectionStep";
import FooterPages from "./FooterPages";

const buildAvailableTimes = (shop, localDate, selectedServices) => {
    if (!shop || !localDate || selectedServices.length === 0) return [];

    try {
        const weekday = weekdayForCivilDate(localDate);
        const legacyHours = shop.availability?.[weekday];
        const canonicalIntervals = shop.weeklyAvailability?.[weekday.toLowerCase()];
        const intervals = Array.isArray(canonicalIntervals)
            ? canonicalIntervals
            : legacyHours
                ? [{startLocalTime: legacyHours.open, endLocalTime: legacyHours.close}]
                : [];
        const durationMinutes = selectedServices.reduce(
            (sum, service) => sum + Number(service.durationMinutes ?? service.duration ?? 30),
            0
        );
        const bufferBeforeMinutes = selectedServices.reduce(
            (sum, service) => sum + Number(service.bufferBeforeMinutes ?? 0),
            0
        );
        const bufferAfterMinutes = selectedServices.reduce(
            (sum, service) => sum + Number(service.bufferAfterMinutes ?? 0),
            0
        );
        const incrementMinutes = Number(legacyHours?.slotDuration ?? 30);
        const slots = intervals.flatMap((interval) => iterateCivilSlots(
            interval.startLocalTime,
            interval.endLocalTime,
            incrementMinutes,
            durationMinutes,
            bufferBeforeMinutes,
            bufferAfterMinutes
        ));
        return [...new Set(slots)];
    } catch {
        return [];
    }
};

const bookingErrorMessage = (error, translations) => {
    const shopSetupCodes = new Set([
        'BOOKING_POLICY_REQUIRED',
        'STABLE_SERVICE_ID_REQUIRED',
        'STABLE_EMPLOYEE_ID_REQUIRED',
        'INVALID_BOOKING_IDENTIFIER',
        'INVALID_CLIENT_CONFIGURATION'
    ]);
    if (shopSetupCodes.has(error?.code) || String(error?.code || '').startsWith('BOOKING_V2_')) {
        return 'This shop is not ready for online booking yet.';
    }
    if (
        typeof error?.message === 'string' &&
        ['BookingCommandClientError', 'CreateBookingAdapterError'].includes(error?.name)
    ) {
        return error.message;
    }
    return translations.bookingFailed;
};

const serviceSelectionKey = (service) => service.id || `legacy:${service.name}`;

const BookNow = () => {
    const {language} = useContext(LanguageContext);
    const {shopId} = useParams();
    const [searchParams] = useSearchParams();
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedServices, setSelectedServices] = useState([]);
    const [selectedTime, setSelectedTime] = useState('');
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [bookingStatus, setBookingStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [selectedServiceCategory, setSelectedServiceCategory] = useState('all');
    const blockedTimeSlots = useMemo(() => [], []);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const bookingRequestInFlight = useRef(false);

    const steps = ['Services', 'Employee', 'DateTime', 'Details'];

    const bookingAdapter = useMemo(() => {
        try {
            return createPublicBookingV2Adapter({
                runtime: appRuntime,
                environment: process.env,
                fetchImpl: window.fetch.bind(window),
                storage: window.localStorage,
                cryptoImpl: window.crypto,
                TextEncoderImpl: window.TextEncoder,
                getIdToken: async () => {
                    if (!auth.currentUser) throw new Error('No authenticated booking session.');
                    return auth.currentUser.getIdToken();
                },
                createAuthMode: 'guest'
            });
        } catch (error) {
            console.error('Booking v2 runtime is unavailable:', error?.code || 'configuration-error');
            return null;
        }
    }, []);

    const [windowSize, setWindowSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
    });

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        // Add event listener
        window.addEventListener('resize', handleResize);

        // Initial size set
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate total price with useMemo
    const totalPrice = useMemo(() => {
        return selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0).toFixed(2);
    }, [selectedServices]);

    // Fetch shop data useEffect
    useEffect(() => {
        const fetchShopData = async () => {
            try {
                const shopDoc = await getDoc(doc(db, 'barberShops', shopId));
                if (shopDoc.exists()) {
                    const shopData = {id: shopDoc.id, ...shopDoc.data()};
                    setShop(shopData);
                }
            } catch (error) {
                console.error('Error fetching shop data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchShopData();
    }, [shopId]);

    // Update time slots when date changes
    useEffect(() => {
        if (shop && selectedDate) {
            setAvailableTimes(buildAvailableTimes(shop, selectedDate, selectedServices));
        }
    }, [selectedDate, selectedServices, shop]);

    useEffect(() => {
        if (!shop) return;
        const serviceParam = searchParams.get('service');
        const employeeParam = searchParams.get('employee');

        if (serviceParam) {
            const requestedService = shop.services?.find(
                (service) => service.id === serviceParam || service.name === serviceParam
            );
            if (requestedService) {
                setSelectedServices((current) => current.length === 0 ? [requestedService] : current);
            }
        }
        if (employeeParam) {
            const requestedEmployee = shop.employees?.find((employee) => employee.id === employeeParam);
            if (requestedEmployee) {
                setSelectedEmployee((current) => current || requestedEmployee);
            }
        }
    }, [searchParams, shop]);

    useEffect(() => {
        if (step === 2 && Array.isArray(shop?.employees) && shop.employees.length === 0) {
            setStep(3);
        }
    }, [shop, step]);

    // Handle service selection
    const handleServiceChange = (service) => {
        if (!selectedServices.some(s => serviceSelectionKey(s) === serviceSelectionKey(service))) {
            setSelectedServices([...selectedServices, service]);
        }
    };

    // Remove service
    const removeService = (serviceId, e) => {
        e.preventDefault();
        setSelectedServices(selectedServices.filter(service => serviceSelectionKey(service) !== serviceId));
    };

    // Form submission
    const handleBooking = async (e) => {
        e.preventDefault();

        // Only process if we're on the final step
        if (step !== 4) {
            return;
        }

        // Check for required fields including phone
        if (!userName || !userEmail || !selectedDate || selectedServices.length === 0 || !selectedTime) {
            setBookingStatus({
                type: 'error',
                message: t.fillAllFields
            });
            return;
        }

        // Add phone number validation
        if (!userPhone || userPhone.replace(/\D/g, '').length < 6) {  // Remove non-digits and check length
            setBookingStatus({
                type: 'error',
                message: 'Please enter a valid phone number'
            });
            return;
        }

        if (bookingRequestInFlight.current) return;
        if (!bookingAdapter) {
            setBookingStatus({
                type: 'error',
                message: 'Online booking is not configured for this environment.'
            });
            return;
        }

        bookingRequestInFlight.current = true;
        setIsLoading(true);
        setBookingStatus('');

        try {
            const response = await bookingAdapter.create({
                shop,
                selectedServices,
                selectedDate,
                selectedTime,
                userName,
                userEmail,
                userPhone,
                selectedEmployee
            });
            setBookingStatus({
                type: 'success',
                message: t.bookingSuccessful,
                bookingId: response.booking.bookingId
            });
            resetForm();
        } catch (error) {
            console.error('Booking v2 command failed:', error?.code || 'unknown-error');
            setBookingStatus({
                type: 'error',
                message: bookingErrorMessage(error, t)
            });
        } finally {
            bookingRequestInFlight.current = false;
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setUserName('');
        setUserEmail('');
        setUserPhone('');
        setSelectedDate('');
        setSelectedServices([]);
        setSelectedEmployee(null);
        setSelectedTime('');
        setStep(1);
    };

    // Helper function to check if a time slot is available
    const isTimeSlotAvailable = (time) => {
        // First check if it's within available times
        if (!availableTimes.includes(time)) return false;

        // Check if slot is blocked
        if (blockedTimeSlots.includes(time)) return false;

        // Add employee schedule check
        if (selectedEmployee) {
            const hour = parseInt(time.split(':')[0]);
            const dayOfWeek = weekdayForCivilDate(selectedDate);
            if (selectedEmployee.schedule && !selectedEmployee.schedule[dayOfWeek]?.includes(hour)) {
                return false;
            }
        }

        return true;
    };

    // Group services by category
    const serviceCategories = useMemo(() => {
        if (!shop) return {};
        return shop.services.reduce((acc, service) => {
            const category = service.category || 'Other';
            if (!acc[category]) acc[category] = [];
            acc[category].push(service);
            return acc;
        }, {});
    }, [shop]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserEmail(user.email || '');  // Anonymous demo users have no email claim.
                setUserName(user.displayName || '');  // Pre-populate name if available

                // Fetch user document to get phone number
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.phoneNumber) {
                            setUserPhone(userData.phoneNumber); // Pre-populate phone number
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!shop) {
        return <div className="text-center py-4">Shop not found.</div>;
    }

    const translations = {
        en: {
            pickMoreServices: "Pick more services",
            removeService: "Remove",
            loading: "Loading...",
            shopNotFound: "Shop not found.",
            total: "Total",
            aboutUs: "About Us",
            address: "Address:",
            phone: "Phone:",
            email: "Email:",
            ourServices: "Our Services",
            bookYourAppointment: "Book Your Appointment",
            name: "Name (required)",
            emailRequired: "Email (required)",
            phoneOptional: "Phone (required)",
            selectDate: "Select a Date",
            selectService: "Select a Service",
            chooseService: "Choose a service",
            selectTime: "Select a Time",
            chooseTimeSlot: "Choose a time slot",
            bookAppointment: "Book Appointment",
            availability: "Availability",
            closed: "Closed",
            fillAllFields: "Please fill in all required fields and select at least one service.",
            bookingSuccessful: "Booking successful! Your appointment has been saved.",
            bookingFailed: "Booking failed. Please try again.",
            errorOccurred: "An error occurred. Please try again.",
            selectedServices: "Selected services",
            next: "Continue",
            personalDetails: "Personal details",
            bookingSummary: "Booking summary",
            date: "Date",
            time: "Time",
            processing: "Saving...",
            confirmBooking: "Confirm booking",
            selectEmployee: "Select Your Stylist",
            noPreferenceTitle: "No Preference?",
            noPreferenceDescription: "Skip stylist selection if you don't have a preference",
            skipSelection: "Skip Selection",
            availableToday: "Available Today",
            nextAvailable: "Next Available",
            expertIn: "Expert in",
            back: "Back",
            continue: "Continue"
        },
        tr: {
            loading: "Yükleniyor...",
            pickMoreServices: "Daha fazla hizmet seç",
            removeService: "Kaldır",
            shopNotFound: "Dükkan bulunamadı.",
            aboutUs: "Hakkımızda",
            address: "Adres:",
            phone: "Telefon:",
            total: "Toplam",
            email: "E-posta:",
            ourServices: "Hizmetlerimiz",
            bookYourAppointment: "Randevunuzu Alın",
            name: "İsim (gerekli)",
            emailRequired: "E-posta (gerekli)",
            phoneOptional: "Telefon (gerekli)",
            selectDate: "Bir Tarih Seçin",
            selectService: "Bir Hizmet Seçin",
            chooseService: "Bir hizmet seçin",
            selectTime: "Bir Saat Seçin",
            chooseTimeSlot: "Bir zaman dilimi seçin",
            bookAppointment: "Randevu Al",
            availability: "Müsaitlik",
            closed: "Kapalı",
            fillAllFields: "Lütfen tüm gerekli alanları doldurun ve en az bir hizmet seçin.",
            bookingSuccessful: "Rezervasyon başarılı! Randevunuz kaydedildi.",
            bookingFailed: "Rezervasyon başarısız oldu. Lütfen tekrar deneyin.",
            errorOccurred: "Bir hata oluştu. Lütfen tekrar deneyin.",
            selectedServices: "Seçilen hizmetler",
            next: "Devam et",
            personalDetails: "Kişisel bilgiler",
            bookingSummary: "Rezervasyon özeti",
            date: "Tarih",
            time: "Saat",
            processing: "Kaydediliyor...",
            confirmBooking: "Rezervasyonu onayla"
        },
        ar: {
            loading: "جاري التحميل...",
            shopNotFound: "لم يتم العثور على المحل.",
            pickMoreServices: "اختر المزيد من الخدمات",
            removeService: "إزالة",
            aboutUs: "معلومات عنا",
            total: "المجموع",
            address: "العنوان:",
            phone: "الهاتف:",
            email: "البريد الإلكتروني:",
            ourServices: "خدماتنا",
            bookYourAppointment: "احجز موعدك",
            name: "الاسم (مطلوب)",
            emailRequired: "البريد الإلكتروني (مطلوب)",
            phoneOptional: "الهاتف (مطلوب)",
            selectDate: "اختر تاريخًا",
            selectService: "اختر خدمة",
            chooseService: "اختر خدمة",
            selectTime: "اختر وقتًا",
            chooseTimeSlot: "اختر فترة زمنية",
            bookAppointment: "احجز الموعد",
            availability: "الأوقات المتاحة",
            closed: "مغلق",
            fillAllFields: "يرجى ملء جميع الحقول المطلوبة واختيار خدمة واحدة على الأقل.",
            bookingSuccessful: "تم الحجز بنجاح! تم حفظ موعدك.",
            bookingFailed: "فشل الحجز. يرجى المحاولة مرة أخرى.",
            errorOccurred: "حدث خطأ. يرجى المحاولة مرة أخرى.",
            selectedServices: "الخدمات المحددة",
            next: "متابعة",
            personalDetails: "البيانات الشخصية",
            bookingSummary: "ملخص الحجز",
            date: "التاريخ",
            time: "الوقت",
            processing: "جارٍ الحفظ...",
            confirmBooking: "تأكيد الحجز"
        },
        de: {
            loading: "Wird geladen...",
            shopNotFound: "Geschäft nicht gefunden.",
            aboutUs: "Über uns",
            address: "Adresse:",
            phone: "Telefon:",
            email: "E-Mail:",
            ourServices: "Unsere Dienstleistungen",
            pickMoreServices: "Wählen Sie weitere Dienstleistungen",
            removeService: "Entfernen",
            bookYourAppointment: "Buchen Sie Ihren Termin",
            name: "Name (erforderlich)",
            emailRequired: "E-Mail (erforderlich)",
            phoneOptional: "Telefon (erforderlich)",
            selectDate: "Wählen Sie ein Datum",
            total: "Gesamt",
            selectService: "Wählen Sie einen Service",
            chooseService: "Wählen Sie einen Service",
            selectTime: "Wählen Sie eine Uhrzeit",
            chooseTimeSlot: "Wählen Sie einen Zeitslot",
            bookAppointment: "Termin buchen",
            availability: "Verfügbarkeit",
            closed: "Geschlossen",
            fillAllFields: "Bitte füllen Sie alle erforderlichen Felder aus und wählen Sie mindestens einen Service.",
            bookingSuccessful: "Buchung erfolgreich! Ihr Termin wurde gespeichert.",
            bookingFailed: "Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.",
            errorOccurred: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
            selectedServices: "Ausgewählte Services",
            next: "Weiter",
            personalDetails: "Persönliche Angaben",
            bookingSummary: "Buchungsübersicht",
            date: "Datum",
            time: "Uhrzeit",
            processing: "Wird gespeichert...",
            confirmBooking: "Buchung bestätigen"
        }
    };

    const t = translations[language];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-200">
                <div className="text-center">
                    <div className="loading loading-spinner loading-lg text-primary"></div>
                    <p className="mt-4 text-lg font-medium">{t.loading}</p>
                </div>
            </div>
        );
    }

    if (!shop) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-200">
                <div className="alert alert-error shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none"
                         viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>{t.shopNotFound}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-200">
            {/* Loading State */}
            {loading && (
                <div className="fixed inset-0 bg-base-200 z-50 flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="loading loading-spinner loading-lg text-primary"></div>
                        <p className="mt-4 text-lg font-medium">{t.loading}</p>
                    </div>
                </div>
            )}

            {!loading && !shop ? (
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="alert alert-error shadow-lg max-w-md">
                        <div className="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                            <span>{t.shopNotFound}</span>
                        </div>
                    </div>
                </div>
            ) : !loading && shop && (
                <>
                    {/* Hero Section */}
                    <div className="bg-base-100 shadow-lg mb-8">
                        <div className="relative h-[40vh] md:h-[50vh] overflow-hidden">
                            <Swiper
                                modules={[Navigation, Pagination, Autoplay]}
                                spaceBetween={0}
                                slidesPerView={1}
                                // navigation
                                pagination={{clickable: true}}
                                autoplay={{delay: 3000}}
                                className="h-full"
                            >
                                {shop.imageUrls.map((url, index) => (
                                    <SwiperSlide key={index}>
                                        <div className="w-full h-full bg-cover bg-center relative"
                                             style={{backgroundImage: `url(${url})`}}>
                                            <div
                                                className="absolute inset-0 bg-gradient-to-b from-base-300/50 via-base-300/70 to-base-300/90 backdrop-blur-sm"/>
                                        </div>
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                            <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
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
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="container mx-auto px-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Booking Progress */}
                            {/* Booking Progress */}
                            <div className="lg:col-span-3">
                                <div className="card bg-base-100 shadow-xl overflow-hidden">
                                    <div className="card-body">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
                                            <h2 className="card-title text-2xl font-bold text-green-600">
                                                {t.bookYourAppointment}
                                            </h2>

                                            <div className="w-full md:w-auto">
                                                {/* Original desktop layout - visible on lg and up */}
                                                <div className="hidden lg:flex items-center justify-center gap-4 relative">
                                                    {steps.map((stepName, idx) => (
                                                        <div key={stepName} className="flex items-center">
                                                            <div className="relative">
                                                                <div className={`
                                        w-12 h-12 rounded-full flex items-center justify-center 
                                        transition-all duration-300 transform
                                        ${step > idx ? 'bg-primary text-primary-content scale-90'
                                                                    : step === idx + 1 ? 'bg-primary text-primary-content scale-100 ring-4 ring-primary/20'
                                                                        : 'bg-base-200 text-base-content scale-90'
                                                                }
                                    `}>
                                                                    {step > idx ? (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                                                        </svg>
                                                                    ) : (
                                                                        <span className="text-lg font-semibold">{idx + 1}</span>
                                                                    )}

                                                                    <span className={`
                                            absolute -bottom-6 text-sm font-medium whitespace-nowrap
                                            transition-all duration-300
                                            ${step === idx + 1 ? 'text-primary' : 'text-base-content/70'}
                                        `}>
                                            {stepName}
                                        </span>

                                                                    {step === idx + 1 && (
                                                                        <div className="absolute inset-0 rounded-full animate-ping bg-primary/20"/>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {idx < steps.length - 1 && (
                                                                <div className="w-24 h-[2px] mx-2 relative">
                                                                    <div className={`
                                            absolute inset-0 
                                            transition-all duration-500 ease-out
                                            ${step > idx ? 'bg-primary w-full' : 'bg-base-200 w-full'}
                                        `}/>
                                                                    {step === idx + 1 && (
                                                                        <div className="absolute inset-0 bg-primary w-1/2 animate-progressLine"/>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Mobile layout - visible only on smaller than lg screens */}
                                                <div className="lg:hidden flex justify-center px-4">
                                                    <div className="flex flex-col space-y-4 w-full max-w-sm">
                                                        {steps.map((stepName, idx) => (
                                                            <div key={stepName}
                                                                 className={`flex items-center ${step === idx + 1 ? 'scale-105 transform transition-all duration-300' : ''}`}>
                                                                <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center shrink-0
                                        transition-all duration-300
                                        ${step > idx ? 'bg-primary text-primary-content'
                                                                    : step === idx + 1 ? 'bg-primary text-primary-content ring-4 ring-primary/20'
                                                                        : 'bg-base-200 text-base-content'
                                                                }
                                    `}>
                                                                    {step > idx ? (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                                                        </svg>
                                                                    ) : (
                                                                        <span className="text-base font-semibold">{idx + 1}</span>
                                                                    )}
                                                                </div>

                                                                <div className="ml-3 flex-1">
                                        <span className={`
                                            text-sm font-medium
                                            ${step === idx + 1 ? 'text-primary' : 'text-base-content/70'}
                                        `}>
                                            {stepName}
                                        </span>

                                                                    {idx < steps.length - 1 && (
                                                                        <div className="mt-2 h-[2px] bg-base-200 relative">
                                                                            <div className={`
                                                    absolute inset-0 bg-primary origin-left transition-all duration-500
                                                    ${step > idx ? 'scale-x-100' : step === idx + 1 ? 'scale-x-50' : 'scale-x-0'}
                                                `}/>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Booking Form */}
                            <div className="lg:col-span-2">
                                <div className="space-y-6">
                                    {step === 1 && (
                                        <ServiceSelectionStep
                                            services={shop.services}
                                            selectedServices={selectedServices}
                                            handleServiceChange={handleServiceChange}
                                            removeService={removeService}
                                            totalPrice={totalPrice}
                                            setStep={setStep}
                                            t={t}
                                            serviceCategories={serviceCategories}
                                            selectedServiceCategory={selectedServiceCategory}
                                            setSelectedServiceCategory={setSelectedServiceCategory}
                                        />
                                    )}

                                    {step === 2 && shop?.employees && (
                                        <EmployeeSelectionStep
                                            employees={shop.employees}
                                            selectedServices={selectedServices}
                                            selectedEmployee={selectedEmployee}
                                            setSelectedEmployee={setSelectedEmployee}
                                            setStep={setStep}
                                            t={t}
                                            onSkip={() => setStep(3)}
                                        />
                                    )}

                                    {step === 3 && (
                                        <DateTimeSelectionStep
                                            selectedDate={selectedDate}
                                            setSelectedDate={setSelectedDate}
                                            selectedTime={selectedTime}
                                            setSelectedTime={setSelectedTime}
                                            availableTimes={availableTimes}
                                            isTimeSlotAvailable={isTimeSlotAvailable}
                                            selectedEmployee={selectedEmployee}
                                            setStep={setStep}
                                            t={t}
                                            shop={shop}
                                            blockedTimeSlots={blockedTimeSlots}
                                        />
                                    )}

                                    {step === 4 && (
                                        <PersonalDetailsStep
                                            userName={userName}
                                            setUserName={setUserName}
                                            userEmail={userEmail}
                                            setUserEmail={setUserEmail}
                                            userPhone={userPhone}
                                            setUserPhone={setUserPhone}
                                            selectedServices={selectedServices}
                                            selectedDate={selectedDate}
                                            selectedTime={selectedTime}
                                            totalPrice={totalPrice}
                                            isLoading={isLoading}
                                            setStep={setStep}
                                            t={t}
                                            isAuthenticated={!!auth.currentUser}
                                            onSubmit={handleBooking}
                                        />
                                    )}
                                </div>

                                {isLoading && <LoadingOverlay/>}
                                {bookingStatus && (
                                    <motion.div
                                        initial={{opacity: 0, scale: 0.5}}
                                        animate={{opacity: 1, scale: 1}}
                                        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/30"
                                    >
                                        <div className="relative">
                                            {bookingStatus.type === 'success' ? (
                                                <>
                                                    <ReactConfetti
                                                        width={windowSize.width}
                                                        height={windowSize.height}
                                                        recycle={false}
                                                        numberOfPieces={200}
                                                        gravity={0.2}
                                                        tweenDuration={4000}
                                                        onConfettiComplete={(confetti) => {
                                                            confetti.reset(); // Stop confetti after animation
                                                        }}
                                                        style={{
                                                            position: 'fixed',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            pointerEvents: 'none'
                                                        }}
                                                        colors={['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107']}
                                                        confettiSource={{
                                                            x: windowSize.width / 2,
                                                            y: windowSize.height / 2,
                                                            w: 0,
                                                            h: 0
                                                        }}
                                                    />
                                                    <motion.div
                                                        initial={{y: 20}}
                                                        animate={{y: 0}}
                                                        className="card bg-base-100 shadow-2xl max-w-md w-full overflow-hidden"
                                                    >
                                                        <div
                                                            className="card-body items-center text-center p-6 space-y-4">
                                                            <motion.div
                                                                initial={{scale: 0}}
                                                                animate={{scale: 1}}
                                                                transition={{type: "spring", bounce: 0.5}}
                                                                className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-2"
                                                            >
                                                                <CheckCircleIcon className="w-16 h-16 text-success"/>
                                                            </motion.div>

                                                            <motion.h2
                                                                initial={{opacity: 0, y: 20}}
                                                                animate={{opacity: 1, y: 0}}
                                                                transition={{delay: 0.2}}
                                                                className="text-2xl md:text-3xl font-bold text-success"
                                                            >
                                                                {bookingStatus.message}
                                                            </motion.h2>

                                                            {bookingStatus.bookingId && (
                                                                <motion.div
                                                                    initial={{opacity: 0}}
                                                                    animate={{opacity: 1}}
                                                                    transition={{delay: 0.3}}
                                                                    className="space-y-4"
                                                                >
                                                                    <div className="bg-base-200 p-4 rounded-xl">
                                                                        <p className="text-sm font-medium text-base-content/60">Booking
                                                                            ID</p>
                                                                        <p className="text-lg font-mono font-bold text-primary">
                                                                            {bookingStatus.bookingId}
                                                                        </p>
                                                                    </div>
                                                                </motion.div>
                                                            )}

                                                            <motion.button
                                                                initial={{opacity: 0, y: 20}}
                                                                animate={{opacity: 1, y: 0}}
                                                                transition={{delay: 0.4}}
                                                                className="btn btn-primary btn-block mt-6"
                                                                onClick={() => {
                                                                    setBookingStatus(null);
                                                                }}
                                                            >
                                                                Done
                                                            </motion.button>
                                                        </div>

                                                        <motion.div
                                                            initial={{width: "0%"}}
                                                            animate={{width: "100%"}}
                                                            transition={{delay: 0.5, duration: 1.5}}
                                                            className="h-1 bg-success"
                                                        />
                                                    </motion.div>
                                                </>
                                            ) : (
                                                <motion.div
                                                    initial={{y: 20}}
                                                    animate={{y: 0}}
                                                    className="card bg-base-100 shadow-2xl max-w-md w-full"
                                                >
                                                    <div className="card-body items-center text-center p-6 space-y-4">
                                                        <motion.div
                                                            initial={{scale: 0}}
                                                            animate={{scale: 1}}
                                                            transition={{type: "spring", bounce: 0.5}}
                                                            className="w-20 h-20 rounded-full bg-error/20 flex items-center justify-center mb-2"
                                                        >
                                                            <XCircleIcon className="w-16 h-16 text-error"/>
                                                        </motion.div>

                                                        <h2 className="text-2xl font-bold text-error">{bookingStatus.message}</h2>

                                                        <button
                                                            className="btn btn-error btn-block mt-4"
                                                            onClick={() => setBookingStatus(null)}
                                                        >
                                                            Try Again
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">
                                <ShopInfoCard shop={shop} t={t}/>
                                <AvailabilityCard shop={shop} t={t}/>
                            </div>
                        </div>
                    </div>
                </>
            )}
            <FooterPages/>
        </div>
    );
};

export default BookNow;
