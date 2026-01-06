import React, {useContext, useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    where,
    writeBatch
} from 'firebase/firestore';
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
import {format} from 'date-fns';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import LanguageContext from "./LanguageContext";
import LoadingOverlay from "./LoadingOverlay";
import EmployeeSelectionStep from "./EmployeeSelectionStep";
import FooterPages from "./FooterPages";

const BookNow = () => {
    const {language} = useContext(LanguageContext);
    const {shopId} = useParams();
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedServices, setSelectedServices] = useState([]);
    const [customService, setCustomService] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [bookingStatus, setBookingStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [selectedServiceCategory, setSelectedServiceCategory] = useState('all');
    const [statusType, setStatusType] = useState(null);
    const navigate = useNavigate();
    const [blockedTimeSlots, setBlockedTimeSlots] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const steps = ['Services', 'Employee', 'DateTime', 'Details'];

    useEffect(() => {
        if (!selectedDate || !shopId) return;

        const blockedSlotsRef = collection(db, 'bookedTimeSlots');
        const q = query(
            blockedSlotsRef,
            where('shopId', '==', shopId),
            where('date', '==', selectedDate),
            where('status', 'in', ['booked', 'pending']),
            // Add employee filter when an employee is selected
            ...(selectedEmployee ? [where('employeeId', '==', selectedEmployee.id)] : [])
        );

        // Replace getDocs with onSnapshot
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const blockedSlots = querySnapshot.docs.map(doc => doc.data().time);
            console.log('Currently blocked slots:', blockedSlots);
            setBlockedTimeSlots(blockedSlots);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [selectedDate, shopId]);

    // Add this right after your other useState declarations in BookNow component
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserEmail(user.email);  // Pre-populate email
                setUserName(user.displayName || '');  // Optional: also pre-populate name if available
            }
        });

        return () => unsubscribe();
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
                    // Generate time slots based on shop availability
                    if (selectedDate) {
                        generateTimeSlots(shopData.availability, selectedDate);
                    }
                }
            } catch (error) {
                console.error('Error fetching shop data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchShopData();
    }, [shopId]);

    useEffect(() => {
        const fetchShopData = async () => {
            try {
                const shopDoc = await getDoc(doc(db, 'barberShops', shopId));
                if (shopDoc.exists()) {
                    const shopData = {id: shopDoc.id, ...shopDoc.data()};
                    console.log("Shop data loaded:", shopData); // Add this log
                    console.log("Employees:", shopData.employees); // Add this log
                    setShop(shopData);
                    if (selectedDate) {
                        generateTimeSlots(shopData.availability, selectedDate);
                    }
                }
            } catch (error) {
                console.error('Error fetching shop data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchShopData();
    }, [shopId]);

    // Generate available time slots based on shop hours
    const generateTimeSlots = (availability, date) => {
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', {weekday: 'long'});
        const hours = availability[dayOfWeek];

        if (!hours) {
            setAvailableTimes([]);
            return;
        }

        const slots = [];
        const [startHour, startMinute] = hours.open.split(':').map(Number);
        const [endHour, endMinute] = hours.close.split(':').map(Number);

        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;
        const slotDuration = hours.slotDuration || 30; // Get the day's slotDuration or default to 30

        for (let time = startTime; time < endTime; time += slotDuration) {
            const hour = Math.floor(time / 60);
            const minute = time % 60;
            slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
        }

        setAvailableTimes(slots);
    };

    // Update time slots when date changes
    useEffect(() => {
        if (shop && selectedDate) {
            generateTimeSlots(shop.availability, selectedDate);
        }
    }, [selectedDate, shop]);

    // Handle service selection
    const handleServiceChange = (service) => {
        if (!selectedServices.some(s => s.name === service.name)) {
            setSelectedServices([...selectedServices, service]);
        }
    };

    // Remove service
    const removeService = (serviceName, e) => {
        e.preventDefault();
        setSelectedServices(selectedServices.filter(service => service.name !== serviceName));
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
            setStatusType('error');
            setBookingStatus({
                type: 'error',
                message: t.fillAllFields
            });
            return;
        }

        // Add phone number validation
        if (!userPhone || userPhone.replace(/\D/g, '').length < 6) {  // Remove non-digits and check length
            setStatusType('error');
            setBookingStatus({
                type: 'error',
                message: 'Please enter a valid phone number'
            });
            return;
        }

        setIsLoading(true);
        setBookingStatus('');

        // First, try to reserve the time slot
        let timeSlotDocRef;
        try {
            if (selectedEmployee) {
                // Add employee-specific availability check
                const employeeSchedule = selectedEmployee.schedule[new Date(selectedDate).toLocaleDateString('en-US', {weekday: 'long'})];
                const selectedHour = parseInt(selectedTime.split(':')[0]);

                if (!employeeSchedule || !employeeSchedule.includes(selectedHour)) {
                    throw new Error('Selected time is not available for this stylist');
                }
            }

            // Check if slot is already taken - now with employee-specific check
            const timeSlotQuery = query(
                collection(db, 'bookedTimeSlots'),
                where('shopId', '==', shop.id),
                where('date', '==', selectedDate),
                where('time', '==', selectedTime),
                where('status', 'in', ['booked', 'pending']),
                ...(selectedEmployee ? [where('employeeId', '==', selectedEmployee.id)] : [])
            );

            console.log("Checking availability with query:", {
                shopId: shop.id,
                date: selectedDate,
                time: selectedTime,
                employeeId: selectedEmployee?.id
            });

            const existingSlots = await getDocs(timeSlotQuery);

            console.log("Existing slots found:", existingSlots.docs.map(doc => doc.data()));

            if (!existingSlots.empty) {
                throw new Error('This time slot has just been taken. Please select another time.');
            }

            // Create the time slot reservation
            timeSlotDocRef = await addDoc(collection(db, 'bookedTimeSlots'), {
                shopId: shop.id,
                date: selectedDate,
                time: selectedTime,
                status: 'pending',
                createdAt: serverTimestamp(),
                employeeId: selectedEmployee?.id || null,
                employeeName: selectedEmployee?.name || null
            });
        } catch (slotError) {
            console.error("Slot booking error:", slotError, {
                selectedEmployee,
                selectedDate,
                selectedTime
            });
            setStatusType('error');
            setBookingStatus({
                type: 'error',
                message: slotError.message
            });
            setIsLoading(false);
            return;
        }

        const bookingData = {
            shopId: shop.id,
            shopEmail: shop.email,
            userName,
            userEmail,
            userPhone,
            selectedDate,
            selectedServices,
            customService,
            selectedTime,
            totalPrice,
            status: 'pending',
            timeSlotId: timeSlotDocRef.id,
            createdAt: new Date().toISOString(),
            employeeId: selectedEmployee?.id || null,
            employeeName: selectedEmployee?.name || null
        };

        try {
            bookingData.employeeId = selectedEmployee?.id || null;
            bookingData.employeeName = selectedEmployee?.name || null;
            const response = await fetch('${process.env.REACT_APP_CLOUD_FUNCTIONS_URL}/createBooking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData),
            });

            const responseData = await response.json();

            if (response.ok) {
                const bookingId = responseData.bookingId;

                // Update both the booking document and time slot
                const batch = writeBatch(db);

                // Update time slot
                const timeSlotRef = doc(db, 'bookedTimeSlots', timeSlotDocRef.id);
                batch.update(timeSlotRef, {
                    status: 'booked',
                    bookingId: bookingId,
                    employeeId: selectedEmployee?.id || null,
                    employeeName: selectedEmployee?.name || null
                });

                // Update booking document directly
                const bookingRef = doc(db, 'bookings', bookingId);
                batch.update(bookingRef, {
                    employeeId: selectedEmployee?.id || null,
                    employeeName: selectedEmployee?.name || null
                });

                // Commit both updates
                await batch.commit();

                // Create notification document
                try {
                    const formattedDate = format(new Date(selectedDate), 'MMM dd, yyyy');

                    const employeeInfo = selectedEmployee ? ` with ${selectedEmployee.name}` : '';

                    await addDoc(collection(db, 'notifications'), {
                        type: 'new_booking',
                        shopId: shop.id,
                        userEmail: userEmail,
                        customerName: userName,
                        title: 'New Booking',
                        message: `New booking from ${userName} for ${formattedDate} at ${selectedTime}${employeeInfo}`,
                        appointmentDate: selectedDate,
                        appointmentTime: selectedTime,
                        services: selectedServices.map(s => s.name).join(', '),
                        totalPrice: totalPrice,
                        createdAt: serverTimestamp(),
                        read: false,
                        bookingId: bookingId,
                        status: 'pending',
                        employeeId: selectedEmployee?.id || null,
                        employeeName: selectedEmployee?.name || null
                    });

                    console.log('Notification created successfully for booking:', bookingId);
                } catch (notificationError) {
                    console.error('Error creating notification:', notificationError);
                    // Continue with booking success even if notification fails
                }

                setStatusType('success');
                setBookingStatus({
                    type: 'success',
                    message: t.bookingSuccessful,
                    bookingId: bookingId
                });
                resetForm();
            } else {
                // If booking failed, delete the time slot reservation
                await deleteDoc(doc(db, 'bookedTimeSlots', timeSlotDocRef.id));

                setStatusType('error');
                setBookingStatus({
                    type: 'error',
                    message: t.bookingFailed
                });
            }
        } catch (error) {
            // If there's an error, clean up the time slot reservation
            if (timeSlotDocRef) {
                await deleteDoc(doc(db, 'bookedTimeSlots', timeSlotDocRef.id));
            }

            console.error('Error booking appointment:', error);
            setBookingStatus(`${t.errorOccurred} ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setUserName('');
        setUserEmail('');
        setUserPhone('');
        setSelectedDate('');
        setSelectedServices([]);
        setCustomService('');
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
            const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', {weekday: 'long'});
            if (!selectedEmployee.schedule[dayOfWeek]?.includes(hour)) {
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
        const fetchShopData = async () => {
            try {
                const shopDoc = await getDoc(doc(db, 'barberShops', shopId));
                if (shopDoc.exists()) {
                    setShop({id: shopDoc.id, ...shopDoc.data()});
                }
            } catch (error) {
                console.error('Error fetching shop data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchShopData();
    }, [shopId]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserEmail(user.email);  // Pre-populate email
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

    // const handleServiceChange = (e) => {
    //     const { value, checked } = e.target;
    //     if (checked) {
    //         setSelectedServices([...selectedServices, value]);
    //     } else {
    //         setSelectedServices(selectedServices.filter(service => service !== value));
    //     }
    // };

    // const handleServiceChange = (e) => {
    //     const selectedService = shop.services.find(service => service.name === e.target.value);
    //     if (selectedService && !selectedServices.some(s => s.name === selectedService.name)) {
    //         setSelectedServices([...selectedServices, selectedService]);
    //     }
    // };
    //
    // const removeService = (serviceName, e) => {
    //     e.preventDefault();
    //     setSelectedServices(selectedServices.filter(service => service.name !== serviceName));
    // };
    //
    // const totalPrice = useMemo(() => {
    //     return selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0).toFixed(2);
    // }, [selectedServices]);
    //
    // const handleBooking = async (e) => {
    //     e.preventDefault();
    //     if (!userName || !userEmail || !selectedDate || selectedServices.length === 0 || !selectedTime) {
    //         setBookingStatus(t.fillAllFields);
    //         return;
    //     }
    //
    //     setIsLoading(true);
    //     setBookingStatus('');
    //
    //     const bookingData = {
    //         shopId,
    //         shopEmail: shop.email, // Make sure this is correctly set
    //         userName,
    //         userEmail,
    //         userPhone,
    //         selectedDate,
    //         selectedServices,
    //         customService,
    //         selectedTime
    //     };
    //
    //     console.log('Sending booking data:', bookingData); // Log the data being sent
    //
    //     try {
    //         const response = await fetch('${process.env.REACT_APP_CLOUD_FUNCTIONS_URL}/createBooking', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //             body: JSON.stringify(bookingData),
    //         });
    //
    //         const responseData = await response.json();
    //
    //         if (response.ok) {
    //             setBookingStatus(`${t.bookingSuccessful} Booking ID: ${responseData.bookingId}`);
    //             // Reset form fields
    //             setUserName('');
    //             setUserEmail('');
    //             setUserPhone('');
    //             setSelectedDate('');
    //             setSelectedServices([]);
    //             setCustomService('');
    //             setSelectedTime('');
    //         } else {
    //             console.error('Booking failed:', responseData.error);
    //             setBookingStatus(`${t.bookingFailed} ${responseData.error || ''}`);
    //         }
    //     } catch (error) {
    //         console.error('Error booking appointment:', error);
    //         setBookingStatus(`${t.errorOccurred} ${error.message}`);
    //     } finally {
    //         setIsLoading(false);
    //     }
    // };

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!shop) {
        return <div className="text-center py-4">Shop not found.</div>;
    }

    const availableTimeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

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
            bookingSuccessful: "Booking successful! Confirmation emails have been sent.",
            bookingFailed: "Booking failed. Please try again.",
            errorOccurred: "An error occurred. Please try again.",
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
            bookingSuccessful: "Rezervasyon başarılı! Onay e-postaları gönderildi.",
            bookingFailed: "Rezervasyon başarısız oldu. Lütfen tekrar deneyin.",
            errorOccurred: "Bir hata oluştu. Lütfen tekrar deneyin."
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
            bookingSuccessful: "تم الحجز بنجاح! تم إرسال رسائل التأكيد عبر البريد الإلكتروني.",
            bookingFailed: "فشل الحجز. يرجى المحاولة مرة أخرى.",
            errorOccurred: "حدث خطأ. يرجى المحاولة مرة أخرى."
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
            bookingSuccessful: "Buchung erfolgreich! Bestätigungs-E-Mails wurden gesendet.",
            bookingFailed: "Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.",
            errorOccurred: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut."
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
                                                                    navigate('/dashboard/customers');
                                                                }}
                                                            >
                                                                Great! 🎉
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