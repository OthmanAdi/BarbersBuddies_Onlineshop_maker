import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import LanguageContext from './LanguageContext';
import {collection, doc, getDoc, getDocs, onSnapshot, query, where} from 'firebase/firestore';
import {
    Calendar, ChevronDown, Globe, LogOut, Menu, Monitor,
    Moon, Plus, Search, Sun, User, Users, X
} from 'lucide-react';
import NotificationButton from "./NotificationButton";
import NavbarChatButton from "./ShopOwnerChatButton";
import MobileNotificationButton from "./MobileNotification";
import {BrandLogo} from "./BrandLogo";
import AgendaButton from "./AgendaButton";
import {DE, GB, SA, TR} from "country-flag-icons/react/3x2";

const BottomSheet = ({ isOpen, onClose, children, userType, user }) => (
    <AnimatePresence>
        {isOpen && (
            <>
                <motion.div
                    className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                />
                <motion.div
                    className="fixed left-0 right-0 bg-base-100 rounded-t-3xl z-50 overflow-hidden"
                    initial={{y: "100%"}}
                    animate={{y: 0}}
                    exit={{y: "100%"}}
                    transition={{type: "spring", damping: 25, stiffness: 300}}
                    style={{
                        minHeight: (!user || userType === 'customer' || userType === 'shop-owner') ? 'calc(100vh - 4rem)' : 'auto',
                        top: '4rem'  // This matches your header height of h-16 (4rem)
                    }}
                >
                    <div className="w-12 h-1.5 bg-base-content/20 rounded-full mx-auto my-3"/>
                    <div className="absolute top-2 right-2">
                        <motion.button
                            whileTap={{scale: 0.9}}
                            whileHover={{scale: 1.1}}
                            onClick={onClose}
                            className="p-2.5 rounded-full bg-base-300/50 hover:bg-error/20 hover:text-error transition-all duration-200 backdrop-blur-sm"
                        >
                            <X className="w-5 h-5"/>
                        </motion.button>
                    </div>
                    <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 pb-8">
                        {children}
                    </div>
                </motion.div>
            </>
        )}
    </AnimatePresence>
);

const QuickActions = ({user, userType, t, theme, handleThemeChange}) => {
    const navigate = useNavigate();
    const [hasShops, setHasShops] = useState(false);

    useEffect(() => {
        if (!user?.uid || userType === 'customer') return;

        const fetchShops = async () => {
            try {
                const q = query(
                    collection(db, 'barberShops'),
                    where('ownerId', '==', user.uid)
                );
                const querySnapshot = await getDocs(q);
                setHasShops(!querySnapshot.empty);
            } catch (error) {
                console.error('Error checking shops:', error);
            }
        };

        fetchShops();

        const unsubscribe = onSnapshot(
            query(
                collection(db, 'barberShops'),
                where('ownerId', '==', user.uid)
            ),
            (snapshot) => {
                setHasShops(!snapshot.empty);
            },
            (error) => {
                console.error('Error listening to shop updates:', error);
            }
        );

        return () => unsubscribe();
    }, [user?.uid, userType]);

    const themeOptions = [
        { value: 'emerald', icon: <Sun className="w-6 h-6"/>, label: "Light" },
        { value: 'luxury', icon: <Moon className="w-6 h-6"/>, label: "Dark" },
        { value: 'system', icon: <Monitor className="w-6 h-6"/>, label: "System" }
    ];

    const items = [
        {
            icon: <Search className="w-6 h-6"/>,
            label: userType && userType !== 'customer' ? t.allShops : t.findBarber,
            onClick: () => navigate('/shops'),
            show: true
        },
        {
            icon: <Calendar className="w-6 h-6" />,
            label: t.appointments,
            onClick: () => navigate('/dashboard/customers'),
            show: userType === 'customer'
        },
        {
            icon: <Users className="w-6 h-6" />,
            label: t.clientManagement,
            onClick: () => navigate('/dashboard/clients'),
            show: userType && userType !== 'customer'
        },
        // Theme Quick Action replaces Create Shop when hasShops is true
        ...(hasShops && userType && userType !== 'customer' ? [{
            isThemeToggle: true,
            icon: theme === 'emerald' ? <Sun className="w-6 h-6"/> :
                theme === 'luxury' ? <Moon className="w-6 h-6"/> :
                    <Monitor className="w-6 h-6"/>,
            label: "Theme",
            options: themeOptions,
            currentValue: theme,
            onChange: handleThemeChange,
            show: true
        }] : [{
            icon: <Plus className="w-6 h-6" />,
            label: t.createBarberShop,
            onClick: () => navigate('/create-shop'),
            show: userType && userType !== 'customer'
        }])
    ];

    return (
        <div className="grid grid-cols-2 gap-4 p-4">
            {items.filter(item => item.show).map((item, index) => (
                item.isThemeToggle ? (
                    <motion.div
                        key={index}
                        className="relative"
                        whileHover={{scale: 1.02}}
                        whileTap={{scale: 0.98}}
                    >
                        <motion.button
                            className="w-full h-full bg-base-200 rounded-2xl p-4 overflow-hidden group relative"
                            onClick={() => {
                                const themes = ['emerald', 'luxury', 'system'];
                                const currentIndex = themes.indexOf(item.currentValue);
                                const nextIndex = (currentIndex + 1) % themes.length;
                                item.onChange(themes[nextIndex]);
                            }}
                        >
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                                initial={false}
                                animate={{opacity: [0, 1, 0], scale: [1, 1.02, 1]}}
                                transition={{duration: 2, repeat: Infinity}}
                            />

                            <div className="flex flex-col items-center justify-center space-y-3">
                                <motion.div
                                    className="relative w-12 h-12 flex items-center justify-center"
                                    initial={false}
                                    animate={{
                                        rotate: item.currentValue === 'system' ? 360 : 0,
                                        scale: 1
                                    }}
                                    transition={{type: "spring", stiffness: 300, damping: 20}}
                                >
                                    {/* Light Icon */}
                                    <motion.div
                                        initial={false}
                                        animate={{
                                            opacity: item.currentValue === 'emerald' ? 1 : 0,
                                            scale: item.currentValue === 'emerald' ? 1 : 0.5,
                                            y: item.currentValue === 'emerald' ? 0 : 20
                                        }}
                                        transition={{type: "spring", stiffness: 300, damping: 20}}
                                        className="absolute inset-0 flex items-center justify-center text-yellow-500"
                                    >
                                        <Sun className="w-8 h-8"/>
                                    </motion.div>

                                    {/* Dark Icon */}
                                    <motion.div
                                        initial={false}
                                        animate={{
                                            opacity: item.currentValue === 'luxury' ? 1 : 0,
                                            scale: item.currentValue === 'luxury' ? 1 : 0.5,
                                            y: item.currentValue === 'luxury' ? 0 : 20
                                        }}
                                        transition={{type: "spring", stiffness: 300, damping: 20}}
                                        className="absolute inset-0 flex items-center justify-center text-indigo-400"
                                    >
                                        <Moon className="w-8 h-8"/>
                                    </motion.div>

                                    {/* System Icon */}
                                    <motion.div
                                        initial={false}
                                        animate={{
                                            opacity: item.currentValue === 'system' ? 1 : 0,
                                            scale: item.currentValue === 'system' ? 1 : 0.5,
                                            y: item.currentValue === 'system' ? 0 : 20
                                        }}
                                        transition={{type: "spring", stiffness: 300, damping: 20}}
                                        className="absolute inset-0 flex items-center justify-center text-primary"
                                    >
                                        <Monitor className="w-8 h-8"/>
                                    </motion.div>
                                </motion.div>

                                <motion.span
                                    className="text-sm font-medium text-center"
                                    animate={{
                                        opacity: [0.7, 1, 0.7],
                                    }}
                                    transition={{duration: 2, repeat: Infinity}}
                                >
                                    {item.currentValue === 'emerald' ? 'Light' :
                                        item.currentValue === 'luxury' ? 'Dark' : 'Auto'}
                                </motion.span>
                            </div>

                            <motion.div
                                className="absolute bottom-0 left-0 right-0 h-1 bg-primary"
                                initial={{scaleX: 0}}
                                animate={{
                                    scaleX: 1,
                                    background: item.currentValue === 'emerald'
                                        ? 'linear-gradient(to right, #10B981, #34D399)'
                                        : item.currentValue === 'luxury'
                                            ? 'linear-gradient(to right, #6366F1, #A855F7)'
                                            : 'linear-gradient(to right, #3B82F6, #60A5FA)'
                                }}
                                transition={{duration: 0.3}}
                            />
                        </motion.button>
                    </motion.div>
                ) : (
                    <motion.button
                        key={index}
                        whileTap={{scale: 0.95}}
                        onClick={item.onClick}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-base-200 hover:bg-base-300 transition-colors"
                    >
                        {item.icon}
                        <span className="mt-2 text-sm font-medium">{item.label}</span>
                    </motion.button>
                )
            ))}
            <AgendaButton user={user} userType={userType} isMobile={true} t={t}/>
        </div>
    );
};

const MobileNavbar = () => {
    const {theme, toggleTheme} = useStore();
    const [user, setUser] = useState(null);
    const [userType, setUserType] = useState(null);
    const {language, changeLanguage} = useContext(LanguageContext);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [hasShops, setHasShops] = useState(false);

    useEffect(() => {
        const handleAuthChange = async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // When user logs in, fetch and set their type
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    setUserType(userDoc.data().userType);
                }
            } else {
                // When user logs out, clear states
                setUserType(null);
                setIsOpen(false);
            }
        };

        // Set up the auth state listener
        const unsubscribe = onAuthStateChanged(auth, handleAuthChange);

        // Cleanup on unmount
        return () => unsubscribe();
    }, []); // Empty dependency array since we want this to run once on mount

    useEffect(() => {
        if (!user?.uid || userType === 'customer') return;

        const q = query(
            collection(db, 'barberShops'),
            where('ownerId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHasShops(!snapshot.empty);
        });

        return () => unsubscribe();
    }, [user?.uid, userType]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) setUserType(userDoc.data().userType);
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const languages = {
        tr: {
            name: 'Türkçe',
            flag: <TR className="w-4 h-3" />
        },
        en: {
            name: 'English',
            flag: <GB className="w-4 h-3" />
        },
        ar: {
            name: 'العربية',
            flag: <SA className="w-4 h-3" />
        },
        de: {
            name: 'Deutsch',
            flag: <DE className="w-4 h-3" />
        }
    };

    const translations = {
        en: {
            allShops: "All Shops",
            systemTheme: "System Theme 💻",
            findBarber: "Find a Barber",
            createBarberShop: "Create Barber Shop",
            myAccount: "My Account",
            darkMode: "Dark Mode 🌙",
            lightMode: "Light Mode ☀️",
            signOut: "Sign Out",
            signIn: "Sign In",
            clientManagement: "Client Management",
            appointments: "My Appointments"
        },
        tr: {
            allShops: "Tüm Dükkanlar",
            systemTheme: "Sistem Teması 💻",
            findBarber: "Berber Bul",
            createBarberShop: "Berber Dükkanı Oluştur",
            myAccount: "Hesabım",
            darkMode: "Karanlık Mod 🌙",
            lightMode: "Aydınlık Mod ☀️",
            signOut: "Çıkış Yap",
            signIn: "Giriş Yap",
            clientManagement: "Müşteri Yönetimi",
            appointments: "Randevularım"
        },
        ar: {
            allShops: "جميع المحلات",
            systemTheme: "سمة النظام 💻",
            findBarber: "ابحث عن حلاق",
            createBarberShop: "إنشاء صالون حلاقة",
            myAccount: "حسابي",
            darkMode: "الوضع المظلم 🌙",
            lightMode: "الوضع المضيء ☀️",
            signOut: "تسجيل الخروج",
            signIn: "تسجيل الدخول",
            clientManagement: "إدارة العملاء",
            appointments: "مواعيدي"
        },
        de: {
            allShops: "Alle Salons",
            systemTheme: "System-Theme 💻",
            findBarber: "Friseur finden",
            createBarberShop: "Friseursalon erstellen",
            myAccount: "Mein Konto",
            darkMode: "Dunkelmodus 🌙",
            lightMode: "Hellmodus ☀️",
            signOut: "Abmelden",
            signIn: "Anmelden",
            clientManagement: "Kundenverwaltung",
            appointments: "Meine Termine"
        }
    };
    const t = translations[language];

    const handleThemeChange = (newTheme) => {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'luxury' : 'emerald';
        document.documentElement.setAttribute('data-theme', newTheme === 'system' ? systemTheme : newTheme);
        toggleTheme(newTheme);
    };

    if (location.pathname === '/auth') {
        return null;
    }

    return (
        <nav className="fixed inset-x-0 top-0 z-50">
            <motion.div
                className="bg-base-100/95 backdrop-blur-md"
                initial={false}
                animate={{ height: isOpen ? '100vh' : 'auto' }}
            >
                <div className="flex items-center justify-between px-4 h-16">
                    <BrandLogo />

                    <div className="flex items-center space-x-3">
                        {user && (
                            <motion.div
                                whileTap={{ scale: 0.95 }}
                                className="relative"
                            >
                                <img
                                    src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"}
                                    className="w-10 h-10 rounded-full ring-2 ring-primary"
                                    alt="Profile"
                                />
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full ring-2 ring-base-100" />
                            </motion.div>
                        )}

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 rounded-full hover:bg-base-200"
                        >
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={isOpen ? 'close' : 'menu'}
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                                </motion.div>
                            </AnimatePresence>
                        </motion.button>
                    </div>
                </div>

                <BottomSheet
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    userType={userType}
                    user={user}
                >
                    <QuickActions
                        user={user}
                        userType={userType}
                        t={t}
                        theme={theme}
                        handleThemeChange={handleThemeChange}
                        hasShops={hasShops}  // Add this
                    />

                    <div className="space-y-6 px-4">
                        <div className="flex justify-end items-center gap-4">
                            <MobileNotificationButton user={user} userType={userType} theme={theme}/>
                            <NavbarChatButton user={user} userType={userType} theme={theme}/>
                        </div>

                        {!hasShops && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-base-content/60">Theme</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {['emerald', 'luxury', 'system'].map(themeOption => (
                                        <motion.button
                                            key={themeOption}
                                            whileTap={{scale: 0.95}}
                                            onClick={() => handleThemeChange(themeOption)}
                                            className={`p-4 rounded-xl flex flex-col items-center ${
                                                theme === themeOption ? 'bg-primary/10 text-primary' : 'bg-base-200'
                                            }`}
                                        >
                                            {themeOption === 'emerald' ? <Sun className="w-5 h-5"/> :
                                                themeOption === 'luxury' ? <Moon className="w-5 h-5"/> :
                                                    <Monitor className="w-5 h-5"/>}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-base-content/60">Language</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(languages).map(([code, {name, flag}]) => (
                                    <motion.button
                                        key={code}
                                        whileTap={{scale: 0.95}}
                                        onClick={() => changeLanguage(code)}
                                        className={`p-3 rounded-xl flex items-center space-x-3 ${
                                            language === code ? 'bg-primary/10 text-primary' : 'bg-base-200'
                                        }`}
                                    >
                                        <span className="text-xl">{flag}</span>
                                        <span>{name}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {user ? (
                            <div className="space-y-2">
                                <Link
                                    to="/account"
                                    className="block w-full p-4 text-center rounded-xl bg-base-200 font-medium"
                                >
                                    {t.myAccount}
                                </Link>
                                <button
                                    onClick={handleSignOut}
                                    className="block w-full p-4 text-center rounded-xl bg-error/10 text-error font-medium"
                                >
                                    {t.signOut}
                                </button>
                            </div>
                        ) : (
                            <Link
                                to="/auth"
                                className="block w-full p-4 text-center rounded-xl bg-primary text-primary-content font-medium"
                            >
                                {t.signIn}
                            </Link>
                        )}
                    </div>
                </BottomSheet>
            </motion.div>
        </nav>
    );
};

export default MobileNavbar;