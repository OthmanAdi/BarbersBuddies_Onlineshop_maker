/**
 * @fileoverview Account Component
 *
 * A comprehensive account management component for barbershop owners and users.
 *
 * Key Features:
 * - Profile management
 * - Shop management
 * - Employee management
 * - Service catalog management
 * - Image gallery management
 * - Account settings
 *
 * Technical Features:
 * - Real-time updates
 * - Firebase integration
 * - Image processing
 * - Data validation
 * - State persistence
 * - Multi-language support
 *
 * Props:
 * - None (Component uses internal state and context)
 *
 * @example
 * <Account />
 */

import React, {useContext, useEffect, useState} from 'react';
import {auth, db, storage} from '../firebase';
import { sanitizeHTML } from '../utils/sanitize';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import {deleteObject, getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {useNavigate} from 'react-router-dom';
import useStore from '../store';
import Swal from 'sweetalert2';
import LanguageContext from "./LanguageContext";
import {
    deleteUser,
    EmailAuthProvider,
    GoogleAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    sendPasswordResetEmail,
    updateEmail,
    updateProfile
} from 'firebase/auth';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import {Banknote, Camera, CreditCard, Edit3, MapPin, Plus, Save, Scissors, Smartphone, Trash2, X, Phone} from 'lucide-react';
import EditBarberShopModal from "./EditBarberShopModal";
import EditAvailabilityModal from "./EditAvailabilityModal";
import AvailabilityAccordion from "./AvailabilityDisplay";
import ShopCarousel from "./ShopCarousel";
import FooterPages from "./FooterPages";
import ShopLinkSection from "./ShopLinkSection";
import ActionButtonsGrid from "./GlassButton";
import {createRoot} from "react-dom/client";
import {motion} from 'framer-motion';
import ImageCropModal from "./ImageCropModal";
import PhoneVerificationModal from "./PhoneVerificationModal";
import ShopManagementButton from "./ShopManagementButton";

const translations = {
    en: {
        changePhoto: "Change Photo",
        cancelPhotoChange: "Cancel Photo Change",
        profileUpdated: "Profile updated successfully",
        phone: "Phone Number: ",
        loading: "Loading...",
        pleaseLogIn: "Please log in to view your account.",
        myAccount: "My Account",
        accountInfo: "Account Information",
        name: "Name:",
        email: "Email:",
        myBarberShops: "My Barber Shops",
        address: "Address:",
        services: "Services",
        availability: "Availability",
        shopImages: "Shop Images",
        uniqueShopLink: "Unique Shop Link",
        deleteShop: "Delete Shop",
        noShops: "You haven't created any barber shops yet.",
        createShop: "Create Barber Shop",
        copied: "Copied!",
        copiedText: "The shop link has been copied to your clipboard.",
        areYouSure: "Are you sure?",
        cantRevert: "You won't be able to revert this!",
        yesDelete: "Yes, delete it!",
        success: "Success",
        shopDeleted: "Your barber shop has been deleted.",
        error: "Error",
        deleteAccount: "Delete Account",
        deleteAccountWarning: "Are you absolutely sure you want to delete your account?",
        deleteAccountDescription: "This will permanently delete your account, all your barber shops, and all associated data. This action cannot be undone.",
        subscriptionWarning: "IMPORTANT: If you have an active subscription, please make sure to cancel it first from your subscription settings to avoid further charges.",
        enterPassword: "Please enter your password to confirm deletion:",
        // googleAuthNote: "As you're signed in with Google, you can delete your account directly without password confirmation.",
        passwordRequired: "Password is required to delete account",
        accountDeleted: "Your account has been successfully deleted",
        errorDeletingAccount: "Error deleting account. Please try again.",
        cancel: "Cancel",
        confirm: "Confirm Delete",
        confirmEmail: "Confirm Account Deletion",
        enterEmailToConfirm: "Please enter your email address to confirm deletion",
        emailDoesNotMatch: "Email address does not match your account email",
        authenticationFailed: "Authentication failed. Please try again.",
        processing: "Processing...",
        resetPasswordFirst: "Reset Password First",
        resetPasswordDescription: "To delete your account, you need to first reset your password. We'll send you a reset link.",
        resetPasswordSent: "Password reset email has been sent. Please check your inbox and try deleting your account again after resetting.",
    },
    tr: {
        changePhoto: "Fotoğrafı Değiştir",
        cancelPhotoChange: "Fotoğraf Değişimini İptal Et",
        profileUpdated: "Profil başarıyla güncellendi",
        phone: "Telefon Numara",
        loading: "Yükleniyor...",
        pleaseLogIn: "Hesabınızı görüntülemek için lütfen giriş yapın.",
        myAccount: "Hesabım",
        accountInfo: "Hesap Bilgileri",
        name: "İsim:",
        email: "E-posta:",
        myBarberShops: "Berber Dükkanlarım",
        address: "Adres:",
        services: "Hizmetler",
        availability: "Müsaitlik",
        shopImages: "Dükkan Görselleri",
        uniqueShopLink: "Benzersiz Dükkan Linki",
        deleteShop: "Dükkanı Sil",
        noShops: "Henüz bir berber dükkanı oluşturmadınız.",
        createShop: "Berber Dükkanı Oluştur",
        copied: "Kopyalandı!",
        copiedText: "Dükkan linki panonuza kopyalandı.",
        areYouSure: "Emin misiniz?",
        cantRevert: "Bu işlemi geri alamazsınız!",
        yesDelete: "Evet, sil!",
        success: "Başarılı",
        shopDeleted: "Berber dükkanınız silindi.",
        error: "Hata",
        deleteAccount: "Hesabı Sil",
        deleteAccountWarning: "Hesabınızı silmek istediğinizden emin misiniz?",
        deleteAccountDescription: "Bu işlem hesabınızı, tüm berber dükkanlarınızı ve ilgili tüm verileri kalıcı olarak silecektir. Bu işlem geri alınamaz.",
        subscriptionWarning: "ÖNEMLİ: Aktif bir aboneliğiniz varsa, ek ücretlendirmelerden kaçınmak için lütfen önce abonelik ayarlarınızdan iptal ettiğinizden emin olun.",
        enterPassword: "Silme işlemini onaylamak için lütfen şifrenizi girin:",
        // googleAuthNote: "Google ile giriş yaptığınız için, hesabınızı şifre onayı olmadan doğrudan silebilirsiniz.",
        passwordRequired: "Hesabı silmek için şifre gereklidir",
        accountDeleted: "Hesabınız başarıyla silindi",
        errorDeletingAccount: "Hesap silinirken hata oluştu. Lütfen tekrar deneyin.",
        cancel: "İptal",
        confirm: "Silmeyi Onayla",
        resetPasswordFirst: "Önce Şifreyi Sıfırla",
        resetPasswordDescription: "Hesabınızı silmek için önce şifrenizi sıfırlamanız gerekiyor. Size bir sıfırlama bağlantısı göndereceğiz.",
        resetPasswordSent: "Şifre sıfırlama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin ve sıfırladıktan sonra hesabınızı silmeyi tekrar deneyin.",
    },
    ar: {
        phone: "رقم الهاقف",
        loading: "جاري التحميل...",
        pleaseLogIn: "الرجاء تسجيل الدخول لعرض حسابك.",
        myAccount: "حسابي",
        accountInfo: "معلومات الحساب",
        name: "الاسم:",
        email: "البريد الإلكتروني:",
        myBarberShops: "محلات الحلاقة الخاصة بي",
        address: "العنوان:",
        services: "الخدمات",
        availability: "التوفر",
        shopImages: "صور المحل",
        uniqueShopLink: "رابط المحل الفريد",
        deleteShop: "حذف المحل",
        noShops: "لم تقم بإنشاء أي محل حلاقة بعد.",
        createShop: "إنشاء محل حلاقة",
        copied: "تم النسخ!",
        copiedText: "تم نسخ رابط المحل إلى الحافظة.",
        areYouSure: "هل أنت متأكد؟",
        cantRevert: "لن تتمكن من التراجع عن هذا!",
        yesDelete: "نعم، احذفه!",
        success: "نجاح",
        shopDeleted: "تم حذف محل الحلاقة الخاص بك.",
        error: "خطأ",
        deleteAccount: "حذف الحساب",
        deleteAccountWarning: "هل أنت متأكد تماماً من رغبتك في حذف حسابك؟",
        deleteAccountDescription: "سيؤدي هذا إلى حذف حسابك وجميع محلات الحلاقة الخاصة بك وجميع البيانات المرتبطة بها بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        subscriptionWarning: "هام: إذا كان لديك اشتراك نشط، يرجى التأكد من إلغائه أولاً من إعدادات الاشتراك لتجنب الرسوم الإضافية.",
        enterPassword: "يرجى إدخال كلمة المرور لتأكيد الحذف:",
        // googleAuthNote: "بما أنك مسجل الدخول باستخدام Google، يمكنك حذف حسابك مباشرة دون تأكيد كلمة المرور.",
        passwordRequired: "كلمة المرور مطلوبة لحذف الحساب",
        accountDeleted: "تم حذف حسابك بنجاح",
        errorDeletingAccount: "خطأ في حذف الحساب. يرجى المحاولة مرة أخرى.",
        cancel: "إلغاء",
        confirm: "تأكيد الحذف"
    },
    de: {
        phone: "Telefon Nummer: ",
        loading: "Laden...",
        pleaseLogIn: "Bitte melden Sie sich an, um Ihr Konto anzuzeigen.",
        myAccount: "Mein Konto",
        accountInfo: "Kontoinformationen",
        name: "Name:",
        email: "E-Mail:",
        myBarberShops: "Meine Friseursalons",
        address: "Adresse:",
        services: "Dienstleistungen",
        availability: "Verfügbarkeit",
        shopImages: "Salonbilder",
        uniqueShopLink: "Eindeutiger Salon-Link",
        deleteShop: "Salon löschen",
        noShops: "Sie haben noch keine Friseursalons erstellt.",
        createShop: "Friseursalon erstellen",
        copied: "Kopiert!",
        copiedText: "Der Salon-Link wurde in Ihre Zwischenablage kopiert.",
        areYouSure: "Sind Sie sicher?",
        cantRevert: "Sie können dies nicht rückgängig machen!",
        yesDelete: "Ja, löschen!",
        success: "Erfolg",
        shopDeleted: "Ihr Friseursalon wurde gelöscht.",
        error: "Fehler",
        deleteAccount: "Konto löschen",
        deleteAccountWarning: "Sind Sie absolut sicher, dass Sie Ihr Konto löschen möchten?",
        deleteAccountDescription: "Dies wird Ihr Konto, alle Ihre Friseursalons und alle zugehörigen Daten dauerhaft löschen. Diese Aktion kann nicht rückgängig gemacht werden.",
        subscriptionWarning: "WICHTIG: Wenn Sie ein aktives Abonnement haben, stellen Sie bitte sicher, dass Sie es zuerst in Ihren Abonnement-Einstellungen kündigen, um weitere Gebühren zu vermeiden.",
        enterPassword: "Bitte geben Sie Ihr Passwort ein, um die Löschung zu bestätigen:",
        // googleAuthNote: "Da Sie mit Google angemeldet sind, können Sie Ihr Konto direkt ohne Passwortbestätigung löschen.",
        passwordRequired: "Passwort ist erforderlich, um das Konto zu löschen",
        accountDeleted: "Ihr Konto wurde erfolgreich gelöscht",
        errorDeletingAccount: "Fehler beim Löschen des Kontos. Bitte versuchen Sie es erneut.",
        cancel: "Abbrechen",
        confirm: "Löschen bestätigen"
    }
};

const PayPalIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M20.1 6.34C19.95 5.55 19.46 4.88 18.76 4.38C18.06 3.88 17.19 3.62 16.29 3.62H11.13C10.95 3.62 10.79 3.71 10.71 3.86L7.47 14.62C7.41 14.82 7.57 15.02 7.78 15.02H10.39L11.21 11.31L11.19 11.41C11.25 11.18 11.46 11.03 11.69 11.03H13.02C16.02 11.03 18.35 9.45 19.01 5.95C19.02 5.89 19.02 5.83 19.03 5.77C18.98 5.77 18.98 5.77 19.03 5.77C19.12 5.94 19.19 6.13 19.24 6.34"
            fill="currentColor"/>
        <path
            d="M11.69 7.13C11.76 7.13 11.82 7.15 11.88 7.18C11.94 7.21 11.99 7.25 12.03 7.3C12.07 7.35 12.1 7.41 12.12 7.48C12.14 7.55 12.15 7.62 12.15 7.69C12.15 7.82 12.12 7.94 12.06 8.04C12 8.14 11.91 8.22 11.81 8.28C11.71 8.34 11.59 8.37 11.46 8.37C11.33 8.37 11.21 8.34 11.11 8.28C11.01 8.22 10.93 8.14 10.87 8.04C10.81 7.94 10.78 7.82 10.78 7.69C10.78 7.56 10.81 7.44 10.87 7.34C10.93 7.24 11.01 7.16 11.11 7.1C11.21 7.04 11.33 7.01 11.46 7.01C11.54 7.01 11.61 7.02 11.69 7.04V7.13Z"
            fill="currentColor"/>
    </svg>
);

const paymentMethodsConfig = {
    visa: {icon: CreditCard, label: 'Visa', color: '#1A1F71'},
    mastercard: {icon: CreditCard, label: 'Mastercard', color: '#EB001B'},
    paypal: {icon: PayPalIcon, label: 'PayPal', color: '#003087'},
    klarna: {icon: CreditCard, label: 'Klarna', color: '#FFB3C7'},
    sepa: {icon: Banknote, label: 'SEPA Transfer', color: '#0052FF'},
    cash: {icon: Banknote, label: 'Cash', color: '#00C805'},
    mobile: {icon: Smartphone, label: 'Mobile Pay', color: '#5F259F'}
};


const AccountPage = () => {
    const {language} = useContext(LanguageContext);
    const t = translations[language];
    const [user, setUser] = useState(null);
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const navigate = useNavigate();
    const {setUserShops, removeUserShop} = useStore();
    const [hasChanges, setHasChanges] = useState(false);
    const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');
    const [newProfileImage, setNewProfileImage] = useState(null);
    const [userType, setUserType] = useState(null);
    const [editingShop, setEditingShop] = useState(null);
    const [editingAvailability, setEditingAvailability] = useState(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [tempImage, setTempImage] = useState(null);
    const [openAccordion, setOpenAccordion] = useState(null);

    const PaymentMethodsAccordion = ({shop}) => {
        if (!shop.paymentMethods || shop.paymentMethods.length === 0) {
            return null;
        }

        return (
            <div className="collapse collapse-plus bg-base-300">
                <input type="checkbox" className="peer"
                       checked={openAccordion === `payment-${shop.id}`}
                       onChange={() => setOpenAccordion(openAccordion === `payment-${shop.id}` ? null : `payment-${shop.id}`)}
                />
                <div className="collapse-title font-medium flex items-center justify-between">
                    <span>Payment Methods</span>
                    <div className="badge badge-secondary">{shop.paymentMethods.length} methods</div>
                </div>
                <div className="collapse-content">
                    <div className="grid gap-3">
                        {shop.paymentMethods.map((methodId) => {
                            const method = paymentMethodsConfig[methodId];
                            if (!method) return null;

                            const Icon = method.icon;
                            return (
                                <div
                                    key={methodId}
                                    className="flex items-center gap-3 p-2 bg-base-200 rounded-lg"
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{backgroundColor: `${method.color}15`}}
                                    >
                                        <Icon
                                            className="w-5 h-5"
                                            style={{color: method.color}}
                                        />
                                    </div>
                                    <span className="font-medium">{method.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const handleRemoveEmployee = async (shopId, employeeId) => {
        try {
            const result = await Swal.fire({
                title: 'Remove Employee?',
                text: "Are you sure you want to remove this employee?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d81046',
                cancelButtonColor: '#168dd8',
                confirmButtonText: 'Yes, remove'
            });

            if (result.isConfirmed) {
                // Create and show loader only after confirmation
                let loadingContainer = document.createElement('div');
                document.body.appendChild(loadingContainer);
                const root = createRoot(loadingContainer);
                root.render(<ScissorsLoader message="Removing employee..." />);

                try {
                    // Get current shop data
                    const shopRef = doc(db, 'barberShops', shopId);
                    const shopDoc = await getDoc(shopRef);
                    const currentShop = shopDoc.data();

                    // Filter out the employee
                    const updatedEmployees = currentShop.employees.filter(
                        emp => emp.id !== employeeId
                    );

                    // Update the shop document
                    await updateDoc(shopRef, {
                        employees: updatedEmployees
                    });

                    // Update local state
                    setShops(shops.map(shop => {
                        if (shop.id === shopId) {
                            return {
                                ...shop,
                                employees: updatedEmployees
                            };
                        }
                        return shop;
                    }));

                    // Clean up loader
                    root.unmount();
                    document.body.removeChild(loadingContainer);

                    await Swal.fire(
                        'Removed!',
                        'The employee has been removed.',
                        'success'
                    );
                } catch (error) {
                    console.error('Error removing employee:', error);

                    // Clean up loader on error
                    root.unmount();
                    document.body.removeChild(loadingContainer);

                    await Swal.fire(
                        'Error',
                        'Failed to remove employee. Please try again.',
                        'error'
                    );
                }
            }
        } catch (error) {
            console.error('Error in employee removal process:', error);
            await Swal.fire(
                'Error',
                'An unexpected error occurred. Please try again.',
                'error'
            );
        }
    };

    const handleShopUpdate = (updatedShop) => {
        setShops(shops.map(shop =>
            shop.id === updatedShop.id ? updatedShop : shop
        ));
        setUserShops(prevShops =>
            prevShops.map(shop =>
                shop.id === updatedShop.id ? updatedShop : shop
            )
        );
    };

    const handleCroppedImage = (croppedFile) => {
        setNewProfileImage(croppedFile);
        setHasChanges(true);
        if (tempImage) {
            URL.revokeObjectURL(tempImage);
        }
        setTempImage(null);
    };

    const handleImageChange = (e) => {
        if (e.target.files?.[0]) {
            setTempImage(URL.createObjectURL(e.target.files[0]));
            setIsCropModalOpen(true);
        }
    };

    const phoneInputStyle = {
        width: '100%',
        height: '2.5rem',
        fontSize: '1rem',
        borderRadius: '0.375rem',
        border: '1px solid rgb(209, 213, 219)',
        padding: '0.5rem 0.75rem',
        paddingLeft: '60px', // Make room for the flag
    }

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                // Get user data from Firestore
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                const userData = userDoc.data();

                // Combine auth user with Firestore data
                setUser({
                    ...currentUser,
                    phoneNumber: userData?.phoneNumber || '',
                    userType: userData?.userType || ''  // Add userType here
                });
                setUserType(userData?.userType); // Set userType in state
                setName(currentUser.displayName || '');
                setEmail(currentUser.email || '');
                setPhone(userData?.phoneNumber || '');
                await fetchShopData(currentUser.uid);
            } else {
                navigate('/auth');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [navigate]);

    const handleDeleteAccount = async () => {
        const user = auth.currentUser;
        if (!user) {
            console.error('No user found');
            return;
        }

        try {
            // First step: Email confirmation
            const {value: confirmEmail} = await Swal.fire({
                title: t.confirmEmail,
                input: 'email',
                inputLabel: t.enterEmailToConfirm,
                inputPlaceholder: user.email,
                showCancelButton: true,
                confirmButtonColor: '#d81046',
                cancelButtonColor: '#168dd8',
                inputValidator: (value) => {
                    if (value !== user.email) {
                        return t.emailDoesNotMatch;
                    }
                }
            });

            if (!confirmEmail) return;

            // Second step: Password confirmation for non-Google users
            if (!isGoogleUser) {
                // Add reset password option
                const {value: action} = await Swal.fire({
                    title: t.deleteAccountWarning,
                    html: `
                <p class="mb-4">${t.deleteAccountDescription}</p>
                <p class="mb-4 text-red-500 font-bold">${t.subscriptionWarning}</p>
                <input type="password" id="password" class="swal2-input" placeholder="${t.enterPassword}">
                <p class="mt-4 text-sm text-gray-600">${t.resetPasswordDescription}</p>
            `,
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonColor: '#d81046',
                    denyButtonColor: '#4F46E5',
                    cancelButtonColor: '#168dd8',
                    confirmButtonText: t.confirm,
                    denyButtonText: t.resetPasswordFirst,
                    cancelButtonText: t.cancel,
                    preConfirm: async () => {
                        const password = document.getElementById('password')?.value;
                        if (!password) {
                            Swal.showValidationMessage(t.passwordRequired);
                            return false;
                        }
                        return {type: 'delete', password};
                    },
                    preDeny: () => {
                        return {type: 'reset'};
                    }
                });

                if (!action) return;

                if (action.type === 'reset') {
                    try {
                        await sendPasswordResetEmail(auth, user.email);
                        await Swal.fire({
                            title: t.success,
                            text: t.resetPasswordSent,
                            icon: 'success',
                            confirmButtonText: 'OK'
                        });
                        return;
                    } catch (error) {
                        console.error('Error sending reset email:', error);
                        throw error;
                    }
                }

                // Proceed with deletion if password was provided
                if (action.type === 'delete') {
                    try {
                        const credential = EmailAuthProvider.credential(user.email, action.password);
                        await reauthenticateWithCredential(user, credential);
                    } catch (error) {
                        throw new Error(t.authenticationFailed);
                    }
                }
            } else {
                try {
                    // First attempt Google reauthentication
                    await reauthenticateWithPopup(user, new GoogleAuthProvider());

                    // After successful reauthentication, show the confirmation dialog
                    const {isConfirmed} = await Swal.fire({
                        title: t.deleteAccountWarning,
                        html: `
                    <p class="mb-4">${t.deleteAccountDescription}</p>
                    <p class="mb-4 text-red-500 font-bold">${t.subscriptionWarning}</p>
                `,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d81046',
                        cancelButtonColor: '#168dd8',
                        confirmButtonText: t.confirm,
                        cancelButtonText: t.cancel,
                    });

                    if (!isConfirmed) return;
                } catch (error) {
                    console.error('Reauthentication error:', error);
                    if (error.code === 'auth/popup-blocked') {
                        throw new Error('Popup was blocked. Please allow popups for this site.');
                    }
                    if (error.code === 'auth/cancelled-popup-request') {
                        return; // User cancelled the popup, just exit quietly
                    }
                    throw new Error(t.authenticationFailed);
                }
            }

            // Show loading state
            Swal.fire({
                title: t.processing,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Delete all bookings associated with the user
            const bookingsRef = collection(db, 'bookings');
            const bookingsQuery = query(
                bookingsRef,
                where('userEmail', '==', user.email.toLowerCase())
            );
            const bookingsSnapshot = await getDocs(bookingsQuery);

            // Delete each booking
            const bookingDeletions = bookingsSnapshot.docs.map(doc =>
                deleteDoc(doc.ref)
            );
            await Promise.all(bookingDeletions);

            // Delete notifications associated with the user's email
            const notificationsRef = collection(db, 'notifications');
            const notificationsQuery = query(
                notificationsRef,
                where('userEmail', '==', user.email.toLowerCase())
            );
            const notificationsSnapshot = await getDocs(notificationsQuery);

            // Delete each notification
            const notificationDeletions = notificationsSnapshot.docs.map(doc =>
                deleteDoc(doc.ref)
            );
            await Promise.all(notificationDeletions);

            // Store user info before deletion
            const userInfo = {
                email: user.email,
                displayName: user.displayName,
                deletedAt: serverTimestamp(),
                uid: user.uid
            };

            // Create deletion record
            await setDoc(doc(db, 'deletedAccounts', user.uid), userInfo);

            // Clean up user data and shops
            if (shops && shops.length > 0) {
                for (const shop of shops) {
                    try {
                        await deleteDoc(doc(db, 'barberShops', shop.id));
                    } catch (error) {
                        console.error('Error deleting shop:', error);
                    }
                }
            }

            // Delete user document
            await deleteDoc(doc(db, 'users', user.uid));

            // Small delay to ensure cloud function is triggered
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Delete auth account
            await deleteUser(user);

            // Show success message
            await Swal.fire({
                title: t.success,
                text: t.accountDeleted,
                icon: 'success',
                confirmButtonText: 'OK'
            });

            navigate('/');

        } catch (error) {
            console.error('Error deleting account:', error);
            Swal.fire({
                title: t.error,
                text: error.message || t.errorDeletingAccount,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    };

    const formatAvailability = (availability) => {
        if (!availability || typeof availability !== 'object') {
            return 'No availability information';
        }

        const formattedAvailability = Object.entries(availability)
            .filter(([_, hours]) => hours !== null && typeof hours === 'object' && hours.open && hours.close)
            .map(([day, hours]) => `${day}: ${hours.open} - ${hours.close}`);

        return formattedAvailability.length > 0
            ? formattedAvailability.join(', ')
            : 'No available hours set';
    };

    const copyToClipboard = async (text) => {
        try {
            // For iOS compatibility
            if (navigator.userAgent.match(/ipad|iphone/i)) {
                // Create temporary input
                const textArea = document.createElement("textarea");
                textArea.value = text;
                // Make it iOS-friendly
                textArea.style.position = 'fixed';
                textArea.style.left = '0';
                textArea.style.top = '0';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);

                // Set up selection
                const range = document.createRange();
                range.selectNodeContents(textArea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textArea.setSelectionRange(0, text.length);

                // Execute copy
                document.execCommand('copy');
                document.body.removeChild(textArea);
            } else {
                // For non-iOS devices, use the modern API
                await navigator.clipboard.writeText(text);
            }

            // Show alert after successful copy
            Swal.fire({
                title: t.copied,
                text: t.copiedText,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                customClass: {
                    container: 'swal-mobile-container'
                }
            });
        } catch (err) {
            console.error('Could not copy text: ', err);
        }
    };

    const ScissorsLoader = ({message}) => (
        <div className="scissors-loader">
            <div className="loader-content">
                <Scissors className="animate-scissor"/>
                <p>{message}</p>
            </div>
        </div>
    );

    const deleteShop = async (shopId, imageUrls) => {
        let loadingContainer;
        let root;

        try {
            loadingContainer = document.createElement('div');
            document.body.appendChild(loadingContainer);
            root = createRoot(loadingContainer);
            root.render(<ScissorsLoader message="Deleting shop..."/>);

            // Get shop data first to get the name
            const shopDoc = await getDoc(doc(db, 'barberShops', shopId));
            const shopData = shopDoc.data();

            // Delete from shopNames collection
            const shopNamesRef = query(
                collection(db, 'shopNames'),
                where('nameSearch', '==', shopData.name.toLowerCase().trim())
            );
            const shopNamesSnapshot = await getDocs(shopNamesRef);
            const deletePromises = shopNamesSnapshot.docs.map(doc => deleteDoc(doc.ref));

            // Delete shop document
            deletePromises.push(deleteDoc(doc(db, 'barberShops', shopId)));

            // Delete images
            const imageDeletePromises = imageUrls.map(url => {
                const imageRef = ref(storage, url);
                return deleteObject(imageRef);
            });

            await Promise.all([...deletePromises, ...imageDeletePromises]);

            setShops(shops.filter(shop => shop.id !== shopId));
            removeUserShop(shopId);

            if (root && loadingContainer) {
                root.unmount();
                document.body.removeChild(loadingContainer);
            }

            await Swal.fire({
                title: t.success,
                text: t.shopDeleted,
                icon: 'success',
                confirmButtonText: 'OK'
            });
        } catch (error) {
            console.error('Error deleting shop:', error);

            if (root && loadingContainer) {
                root.unmount();
                document.body.removeChild(loadingContainer);
            }

            await Swal.fire({
                title: t.error,
                text: t.errorDeleting,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    };

    const handleDeleteShop = (shop) => {
        Swal.fire({
            title: t.areYouSure,
            text: t.cantRevert,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d81046',
            cancelButtonColor: '#168dd8',
            confirmButtonText: t.yesDelete
        }).then((result) => {
            if (result.isConfirmed) {
                deleteShop(shop.id, shop.imageUrls);
            }
        });
    };

    const fetchShopData = async (userId) => {
        try {
            const q = query(collection(db, 'barberShops'), where('ownerId', '==', userId));
            const querySnapshot = await getDocs(q);
            const shopList = [];
            for (const doc of querySnapshot.docs) {
                const shopData = doc.data();
                const imageUrls = await Promise.all(
                    shopData.imageUrls.map(async (imageRef) => {
                        try {
                            return await getDownloadURL(ref(storage, imageRef));
                        } catch (error) {
                            console.error('Error fetching image URL:', error);
                            return null;
                        }
                    })
                );
                shopList.push({id: doc.id, ...shopData, imageUrls: imageUrls.filter(url => url !== null)});
            }
            setShops(shopList);
            setUserShops(shopList);
        } catch (error) {
            console.error('Error fetching shop data:', error);
        }
    };

    const AvatarLoader = ({message}) => {
        const container = {
            show: {
                transition: {
                    staggerChildren: 0.1
                }
            }
        };

        const rays = {
            hidden: {scale: 0, opacity: 0},
            show: {
                scale: [1, 1.5, 1],
                opacity: [0.8, 0.3, 0.8],
                transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }
            }
        };

        const avatar = {
            hidden: {scale: 0.8, opacity: 0},
            show: {
                scale: 1,
                opacity: 1,
                transition: {
                    duration: 0.5,
                    type: "spring",
                    stiffness: 200
                }
            }
        };

        const sparkle = {
            hidden: {scale: 0, opacity: 0},
            show: {
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                transition: {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeOut",
                    times: [0, 0.5, 1]
                }
            }
        };

        const rotatingRing = {
            hidden: {rotate: 0},
            show: {
                rotate: 360,
                transition: {
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear"
                }
            }
        };

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-base-100 rounded-lg p-12 flex flex-col items-center gap-6">
                    <motion.div
                        className="relative"
                        variants={container}
                        initial="hidden"
                        animate="show"
                    >
                        {/* Rotating outer ring */}
                        <motion.div
                            variants={rotatingRing}
                            className="absolute inset-[-20px] border-4 border-dashed border-primary/30 rounded-full"
                        />

                        {/* Radiating rays */}
                        {[...Array(8)].map((_, i) => (
                            <motion.div
                                key={i}
                                variants={rays}
                                className="absolute inset-0 border-2 border-primary/20 rounded-full"
                                style={{
                                    transform: `rotate(${i * 45}deg)`,
                                }}
                            />
                        ))}

                        {/* Central avatar */}
                        <motion.div
                            variants={avatar}
                            className="relative w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
                        >
                            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                                <svg
                                    className="w-10 h-10 text-primary-content"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                            </div>

                            {/* Sparkling effects */}
                            {[...Array(4)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    variants={sparkle}
                                    className="absolute w-3 h-3 bg-primary"
                                    style={{
                                        borderRadius: '50%',
                                        top: `${Math.sin(i * Math.PI / 2) * 100 + 50}%`,
                                        left: `${Math.cos(i * Math.PI / 2) * 100 + 50}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                />
                            ))}
                        </motion.div>
                    </motion.div>
                    <p className="text-base-content text-lg font-medium">{message}</p>
                </div>
            </div>
        );
    };

    const handleSaveProfile = async () => {
        let loadingContainer;
        let root;

        try {
            loadingContainer = document.createElement('div');
            document.body.appendChild(loadingContainer);
            root = createRoot(loadingContainer);
            root.render(<AvatarLoader message="Updating profile..."/>);

            let photoURL = user.photoURL;

            if (newProfileImage) {
                const imageRef = ref(storage, `profile_images/${auth.currentUser.uid}`);
                await uploadBytes(imageRef, newProfileImage);
                photoURL = await getDownloadURL(imageRef);
            }

            await updateProfile(auth.currentUser, {
                displayName: name,
                photoURL: photoURL
            });

            if (email !== auth.currentUser.email && !isGoogleUser) {
                await updateEmail(auth.currentUser, email);
            }

            const formattedPhone = phone ? `+${phone.replace(/\D/g, '')}` : null;

            const userRef = doc(db, 'users', auth.currentUser.uid);
            await setDoc(userRef, {
                phoneNumber: formattedPhone,
                displayName: name,
                email: auth.currentUser.email,
                photoURL: photoURL,
                lastUpdated: serverTimestamp()
            }, {merge: true});

            setEditMode(false);
            setNewProfileImage(null);
            setUser({
                ...auth.currentUser,
                email: email,
                phoneNumber: formattedPhone,
                photoURL: photoURL
            });

            if (root && loadingContainer) {
                root.unmount();
                document.body.removeChild(loadingContainer);
            }

            await Swal.fire({
                title: t.success,
                text: t.profileUpdated,
                icon: 'success',
                confirmButtonText: 'OK'
            });
        } catch (error) {
            console.error('Error updating profile:', error);

            if (root && loadingContainer) {
                root.unmount();
                document.body.removeChild(loadingContainer);
            }

            let errorMessage = t.errorUpdatingProfile;
            if (isGoogleUser && email !== auth.currentUser.email) {
                errorMessage = "Cannot change email for Google-authenticated accounts";
            }

            await Swal.fire({
                title: t.error,
                text: errorMessage,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    };

    const handleEditShop = (shopId) => {
        console.log('Edit shop:', shopId);
        Swal.fire({
            title: t.comingSoon,
            text: t.shopEditingFunctionality,
            icon: 'info',
            confirmButtonText: 'OK'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="loading loading-spinner loading-lg text-primary"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="card bg-base-200 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title text-error">Access Denied</h2>
                        <p>{t.pleaseLogIn}</p>
                        <div className="card-actions justify-end">
                            <button className="btn btn-primary" onClick={() => navigate('/auth')}>
                                Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-100">
            {/* Modern Header */}
            {/* <div className="navbar bg-base-200 shadow-lg px-4 sm:px-8">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{t.myAccount}</h1>
                </div>
                <div className="flex-none gap-2">
                    <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                            <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                <img
                                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName || user.email}`}
                                    alt="Profile"
                                />
                            </div>
                        </label>
                    </div>
                </div>
            </div> */}

            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Profile Section */}
                <div className="card bg-base-200 shadow-xl mb-8">
                    <div className="card-body">
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Profile Image Section */}
                            <div className="flex flex-col items-center space-y-4">
                                <div className="relative group">
                                    <div
                                        className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-primary ring-offset-base-100 ring-offset-2">
                                        <img
                                            src={newProfileImage
                                                ? URL.createObjectURL(newProfileImage)
                                                : (user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName || user.email}`)}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {editMode && (
                                        <label
                                            htmlFor="profile-image-upload"
                                            className="absolute inset-0 flex items-center justify-center bg-black/50
                                                     text-white opacity-0 group-hover:opacity-100 rounded-full cursor-pointer
                                                     transition-all duration-200"
                                        >
                                            <Camera className="w-8 h-8"/>
                                        </label>
                                    )}
                                    <input
                                        id="profile-image-upload"
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                    />
                                </div>
                                {editMode && newProfileImage && (
                                    <button
                                        onClick={() => {
                                            setNewProfileImage(null);
                                            setHasChanges(name !== user.displayName ||
                                                (!isGoogleUser && email !== user.email) ||
                                                phone !== user.phoneNumber);
                                        }}
                                        className="btn btn-ghost btn-sm"
                                    >
                                        <X className="w-4 h-4 mr-2"/>
                                        Cancel Photo
                                    </button>
                                )}
                            </div>

                            {/* Profile Info Section */}
                            <div className="flex-1 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-bold">{t.accountInfo}</h2>
                                    {!editMode ? (
                                        <button
                                            onClick={() => setEditMode(true)}
                                            className="btn btn-primary btn-sm"
                                        >
                                            <Edit3 className="w-4 h-4 mr-2"/>
                                            Edit Profile
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveProfile}
                                                className="btn btn-primary btn-sm"
                                                disabled={!hasChanges}
                                            >
                                                <Save className="w-4 h-4 mr-2"/>
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditMode(false)}
                                                className="btn btn-ghost btn-sm"
                                            >
                                                <X className="w-4 h-4 mr-2"/>
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {editMode ? (
                                    <div className="grid gap-6">
                                        <div className="form-control">
                                            <label className="label">
                                                <span className="label-text">{t.name}</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => {
                                                    setName(e.target.value);
                                                    setHasChanges(true);
                                                }}
                                                className="input input-bordered w-full"
                                            />
                                        </div>

                                        <div className="form-control">
                                            <label className="label">
                                                <span className="label-text">{t.email}</span>
                                            </label>
                                            {isGoogleUser ? (
                                                <div className="input input-bordered flex items-center opacity-50">
                                                    {email}
                                                </div>
                                            ) : (
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => {
                                                        setEmail(e.target.value);
                                                        setHasChanges(true);
                                                    }}
                                                    className="input input-bordered w-full"
                                                />
                                            )}
                                        </div>

                                        <div className="form-control">
                                            <label className="label">
                                                <span className="label-text">{t.phone}</span>
                                            </label>
                                            <PhoneInput
                                                country={'tr'}
                                                value={phone}
                                                onChange={(value) => {
                                                    setPhone(value);
                                                    setHasChanges(true);
                                                }}
                                                containerClass="phone-input"
                                                inputClass="input input-bordered w-full"
                                                buttonClass="phone-input-button"
                                                dropdownClass="phone-input-dropdown"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="stats bg-base-300 shadow">
                                                <div className="stat">
                                                    <div className="stat-title">{t.name}</div>
                                                    <div className="stat-value text-lg">
                                                        {user.displayName || 'Not set'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="stats bg-base-300 shadow">
                                                <div className="stat">
                                                    <div className="stat-title">{t.email}</div>
                                                    <div className="stat-value text-lg">{user.email}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="stats bg-base-300 shadow">
                                            <div className="stat">
                                                <div className="stat-title">{t.phone}</div>
                                                {user.phoneNumber ? (
                                                    <div className="stat-value text-lg">
                                                        {user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber}`}
                                                    </div>
                                                ) : (
                                                    <PhoneVerificationModal
                                                        isDark={document.documentElement.getAttribute('data-theme') === 'dark'}
                                                        onNavigate={() => setEditMode(true)}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shops Section */}
                {userType !== 'customer' && (
                    <div className="space-y-6">
                        {/* Title and buttons header section */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <h2 className="text-2xl font-bold">{t.myBarberShops}</h2>

                            <div className="flex flex-wrap gap-3 ml-auto">
                                <button
                                    onClick={() => navigate('/create-shop')}
                                    className="btn btn-primary flex-1 sm:flex-none"
                                >
                                    <Plus className="w-4 h-4 mr-2 sm:mr-2" />
                                    <span className="sm:inline">{t.createShop}</span>
                                </button>

                                <div className="flex-1 sm:flex-none">
                                    <ShopManagementButton user={user} userType={userType} />
                                </div>
                            </div>
                        </div>

                        {shops.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {shops.map((shop) => (
                                    <div key={shop.id} className="card bg-base-200 shadow-xl">
                                        <figure className="px-4 pt-4">
                                            <ShopCarousel imageUrls={shop.imageUrls}/>
                                        </figure>
                                        <div className="card-body">
                                            <h3 className="card-title">
                                                {shop.name}
                                                <div className="badge badge-primary">{shop.services.length} services
                                                </div>
                                            </h3>

                                            <div className="space-y-4">
                                                <p className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4"/>
                                                    {shop.address}
                                                </p>

                                                <div className="collapse collapse-plus bg-base-300">
                                                    <input type="checkbox" className="peer"
                                                           checked={openAccordion === `services-${shop.id}`}
                                                           onChange={() => setOpenAccordion(openAccordion === `services-${shop.id}` ? null : `services-${shop.id}`)}
                                                    />
                                                    <div className="collapse-title font-medium">
                                                        Services & Pricing
                                                    </div>
                                                    <div className="collapse-content">
                                                        <ul className="space-y-2">
                                                            {shop.services.map((service, index) => (
                                                                <li key={index} className="flex justify-between">
                                                                    <span>{service.name}</span>
                                                                    <span
                                                                        className="font-semibold">€{service.price}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>

                                                {/*Collapsable for the shop date and time in the account page*/}
                                                <AvailabilityAccordion
                                                    shop={shop}
                                                    isOpen={openAccordion === `availability-${shop.id}`}
                                                    onToggle={() => setOpenAccordion(openAccordion === `availability-${shop.id}` ? null : `availability-${shop.id}`)}
                                                />
                                                {/*Collapsable for the shop date and time in the account page*/}

                                                <div className="collapse collapse-plus bg-base-300">
                                                    <input type="checkbox" className="peer"
                                                           checked={openAccordion === `description-${shop.id}`}
                                                           onChange={() => setOpenAccordion(openAccordion === `description-${shop.id}` ? null : `description-${shop.id}`)}
                                                    />
                                                    <div className="collapse-title font-medium">
                                                        Description
                                                    </div>
                                                    <div className="collapse-content">
                                                        <div
                                                            className="prose max-w-none" // Add this class for better typography
                                                            dangerouslySetInnerHTML={{
                                                                __html: sanitizeHTML(shop.biography || shop.description)
                                                            }}
                                                            style={{
                                                                // Add these styles to match your theme
                                                                '& h1': {color: 'hsl(var(--p))', marginBottom: '1rem'},
                                                                '& ul': {listStyle: 'disc', paddingLeft: '1.5rem'},
                                                                '& li': {marginBottom: '0.5rem'},
                                                                '& p': {marginBottom: '1rem'},
                                                                lineHeight: 1.6,
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <PaymentMethodsAccordion shop={shop}/>

                                                {/* Add this after the Description accordion in the shop card */}
                                                {(shop.employees && shop.employees.length > 0) && (
                                                    <div className="collapse collapse-plus bg-base-300">
                                                        <input type="checkbox" className="peer"
                                                               checked={openAccordion === `team-${shop.id}`}
                                                               onChange={() => setOpenAccordion(openAccordion === `team-${shop.id}` ? null : `team-${shop.id}`)}
                                                        />
                                                        <div
                                                            className="collapse-title font-medium flex items-center justify-between">
                                                            <span>Team Members</span>
                                                            <div className="flex gap-2">
                                                                <div
                                                                    className="badge badge-secondary">{shop.employees.length} employees
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="collapse-content">
                                                            <ul className="space-y-4">
                                                                {shop.employees.map((employee) => (
                                                                    <li key={employee.id}
                                                                        className="flex items-center gap-4 p-2 bg-base-200 rounded-lg group">
                                                                        <div className="avatar">
                                                                            <div className="w-12 h-12 rounded-full">
                                                                                <img
                                                                                    src={employee.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${employee.name}`}
                                                                                    alt={employee.name}
                                                                                    className="object-cover"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div
                                                                                className="flex items-center justify-between">
                                                                                <h4 className="font-semibold">{employee.name}</h4>
                                                                                <button
                                                                                    onClick={() => handleRemoveEmployee(shop.id, employee.id)}
                                                                                    className="btn btn-ghost btn-sm text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4"/>
                                                                                </button>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                {employee.expertise?.map((skill, index) => (
                                                                                    <span key={index}
                                                                                          className="badge badge-sm badge-outline">
                                        {skill}
                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                )}

                                                <ShopLinkSection
                                                    linkToCopy={`${window.location.origin}/shop/${shop.uniqueUrl}`}/>
                                            </div>

                                            <ActionButtonsGrid
                                                onManageHours={() => setEditingAvailability(shop)}
                                                onEditShop={() => setEditingShop(shop)}
                                                onCustomize={() => navigate(`/customize-shop/${shop.id}`)}
                                                onDelete={() => handleDeleteShop(shop)}
                                                deleteText={t.deleteShop}
                                            />

                                            <style jsx>{`
                                                .btn-animated {
                                                    position: relative;
                                                    overflow: hidden;
                                                    padding: 1rem 2rem;
                                                    font-size: 1rem;
                                                    font-weight: 600;
                                                    border-radius: 0.5rem;
                                                    transition: all 0.3s ease;
                                                }

                                                .btn-content {
                                                    display: flex;
                                                    align-items: center;
                                                    justify-content: center;
                                                    width: 100%;
                                                    height: 100%;
                                                    transition: all 0.3s ease;
                                                }

                                                .icon {
                                                    width: 1.5rem;
                                                    height: 1.5rem;
                                                    margin-right: 0.75rem;
                                                    transition: all 0.3s ease;
                                                }

                                                .btn-text {
                                                    white-space: nowrap;
                                                    transition: all 0.3s ease;
                                                }

                                                @media (max-width: 640px) {
                                                    .btn-animated {
                                                        padding: 0.75rem 1rem;
                                                    }

                                                    .btn-text {
                                                        display: none;
                                                    }

                                                    .icon {
                                                        margin-right: 0;
                                                        width: 2rem;
                                                        height: 2rem;
                                                    }
                                                }

                                                .btn-animated:before {
                                                    content: "";
                                                    position: absolute;
                                                    top: -50%;
                                                    left: -50%;
                                                    width: 200%;
                                                    height: 200%;
                                                    background-color: rgba(255, 255, 255, 0.2);
                                                    transform: rotate(45deg);
                                                    transition: all 0.5s ease;
                                                }

                                                .btn-animated:hover:before {
                                                    top: -20%;
                                                    left: -20%;
                                                }

                                                .btn-animated:after {
                                                    content: "";
                                                    position: absolute;
                                                    top: 0;
                                                    left: 0;
                                                    width: 100%;
                                                    height: 100%;
                                                    border: 2px solid rgba(255, 255, 255, 0.5);
                                                    border-radius: 0.5rem;
                                                    opacity: 0;
                                                    transition: all 0.3s ease;
                                                }

                                                .btn-animated:hover:after {
                                                    opacity: 1;
                                                    transform: scale(1.1);
                                                }
                                            `}</style>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="card bg-base-200 shadow-xl">
                                <div className="card-body text-center">
                                    <h3 className="text-xl font-bold mb-4">{t.noShops}</h3>
                                    <p className="text-base-content/70 mb-6">
                                        Create your first barber shop to start managing your business.
                                    </p>
                                    <button
                                        onClick={() => navigate('/create-shop')}
                                        className="btn btn-primary btn-wide mx-auto"
                                    >
                                        <Plus className="w-4 h-4 mr-2"/>
                                        {t.createShop}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Delete Account Section */}
                <div className="mt-16 card bg-base-200 shadow-xl">
                    <div className="card-body">
                        <h3 className="card-title text-error">Danger Zone</h3>
                        <p className="text-base-content/70">
                            Once you delete your account, there is no going back. Please be certain.
                        </p>
                        <div className="card-actions justify-end">
                            <button
                                onClick={handleDeleteAccount}
                                className="btn btn-error"
                            >
                                <Trash2 className="w-4 h-4 mr-2"/>
                                {t.deleteAccount}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Spacing */}
                <div className="h-24"></div>
            </div>

            {/* Custom Styles */}
            <style jsx>{`
                .phone-input {
                    width: 100%;
                }

                .phone-input input {
                    width: 100% !important;
                    height: 3rem !important;
                    padding-left: 3.5rem !important;
                    background-color: transparent !important;
                }

                .phone-input-button {
                    border: 1px solid hsl(var(--bc) / 0.2) !important;
                    border-right: none !important;
                    background-color: transparent !important;
                }

                .phone-input-dropdown {
                    background-color: hsl(var(--b1)) !important;
                    color: hsl(var(--bc)) !important;
                }

                .phone-input-dropdown:hover {
                    background-color: hsl(var(--b2)) !important;
                }
            `}</style>

            {/* Bottom Spacing */}
            <div className="h-24"></div>

            {/* Add the modal here, right before the style tag */}
            {editingShop && (
                <EditBarberShopModal
                    shop={editingShop}
                    isOpen={true}
                    onClose={() => setEditingShop(null)}
                    onSave={handleShopUpdate}
                />
            )}

            {/* Custom Styles */}
            <style jsx>{`
                .phone-input {
                    width: 100%;
                }

                .phone-input input {
                    width: 100% !important;
                    height: 3rem !important;
                    padding-left: 3.5rem !important;
                    background-color: transparent !important;
                }

                .phone-input-button {
                    border: 1px solid hsl(var(--bc) / 0.2) !important;
                    border-right: none !important;
                    background-color: transparent !important;
                }

                .phone-input-dropdown {
                    background-color: hsl(var(--b1)) !important;
                    color: hsl(var(--bc)) !important;
                }

                .phone-input-dropdown:hover {
                    background-color: hsl(var(--b2)) !important;
                }
            `}</style>

            {editingAvailability && (
                <EditAvailabilityModal
                    shop={editingAvailability}
                    isOpen={true}
                    onClose={() => setEditingAvailability(null)}
                    onSave={handleShopUpdate}
                />
            )}
            <style jsx global>{`
                .swal-mobile-container {
                    z-index: 10000 !important;
                }
            `}</style>


            {tempImage && (
                <ImageCropModal
                    isOpen={isCropModalOpen}
                    onClose={() => {
                        setIsCropModalOpen(false);
                        URL.revokeObjectURL(tempImage);
                        setTempImage(null);
                    }}
                    imageSrc={tempImage}
                    onCropComplete={handleCroppedImage}
                />
            )}

            <FooterPages/>
        </div>
    );
};

export default AccountPage;