import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useStore from '../store';
import { GB, TR, SA, DE } from 'country-flag-icons/react/3x2';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import LanguageContext from './LanguageContext';
import {
    Calendar,
    ChevronDown,
    Globe,
    LogOut,
    Monitor,
    Moon,
    Plus,
    Search,
    Sun,
    User,
    Users,
} from 'lucide-react';
import {collection, doc, getDoc, onSnapshot, query, where, getDocs} from 'firebase/firestore';
import NotificationButton from "./NotificationButton";
import NavbarChatButton from "./ShopOwnerChatButton";
import {BrandLogo} from "./BrandLogo";
import AgendaButton from "./AgendaButton";

const ShopOwnerButtons = ({user, userType, t}) => {
    const [hasShops, setHasShops] = useState(false);

    useEffect(() => {
        if (!user?.uid) return;

        // Using the same query as in AccountPage
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

        // Set up real-time listener
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
    }, [user?.uid]);

    if (!user || !userType || userType === 'customer' || userType === '') return null;

    return (
        <>
            <Link
                to="/dashboard/clients"
                className="btn btn-ghost btn-sm rounded-full hover:bg-primary/10 hover:text-primary transition-colors duration-200"
            >
                <Users className="w-4 h-4 mr-2"/>
                {t.clientManagement}
            </Link>
            {!hasShops && (
                <Link to="/create-shop" className="btn btn-primary btn-sm rounded-full">
                    <Plus className="w-4 h-4 mr-2"/>
                    {t.createBarberShop}
                </Link>
            )}
        </>
    );
};

const CustomerButtons = ({user, userType, t}) => {
    if (!user || !userType || userType !== 'customer') return null;

    return (
        <Link to="/dashboard/customers" className="btn btn-ghost btn-sm rounded-full">
            <Calendar className="w-4 h-4 mr-2"/>
            {t.appointments}
        </Link>
    );
};

const DesktopNavbar = () => {
    const {theme, toggleTheme} = useStore();
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const {language, changeLanguage} = useContext(LanguageContext);
    const [isScrolled, setIsScrolled] = useState(false);
    const [userType, setUserType] = useState(null);
    const [isLoadingUserType, setIsLoadingUserType] = useState(true);
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);
    const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
    const languageDropdownRef = useRef(null);
    const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
    const themeDropdownRef = useRef(null);

    const handleThemeChange = (newTheme) => {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'luxury' : 'emerald';
        document.documentElement.setAttribute('data-theme', newTheme === 'system' ? systemTheme : newTheme);
        toggleTheme(newTheme);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target)) {
                setIsLanguageDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target)) {
                setIsThemeDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const setTheme = () => {
            const effectiveTheme = theme === 'system'
                ? (mediaQuery.matches ? 'luxury' : 'emerald')
                : theme;
            document.documentElement.setAttribute('data-theme', effectiveTheme);
        };

        setTheme();
        mediaQuery.addEventListener('change', setTheme);
        return () => mediaQuery.removeEventListener('change', setTheme);
    }, [theme]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const scrollDifference = currentScrollY - lastScrollY.current;
            const scrollThreshold = 5;

            if (Math.abs(scrollDifference) > scrollThreshold) {
                setIsVisible(scrollDifference < 0 || currentScrollY < 20);
                lastScrollY.current = currentScrollY;
            }
        };

        window.addEventListener('scroll', handleScroll, {passive: true});
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleUserTypeUpdate = (event) => {
            setUserType(event.detail.userType);
            setIsLoadingUserType(false);
        };

        window.addEventListener('userTypeUpdated', handleUserTypeUpdate);

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setIsLoadingUserType(true);
            if (currentUser) {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    setUserType(userDoc.data().userType);
                }
            } else {
                setUserType(null);
            }
            setIsLoadingUserType(false);
        });

        return () => {
            window.removeEventListener('userTypeUpdated', handleUserTypeUpdate);
            unsubscribe();
        };
    }, []);


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

    if (location.pathname === '/auth') {
        return null;
    }

    return (
        <nav
            id="main-navbar"
            className={`fixed top-0 w-full z-[9999] transition-all duration-300
                ${isScrolled ? 'bg-base-100/95 backdrop-blur-md shadow-md' : 'bg-base-100'}
                ${!isVisible ? '-translate-y-full' : 'translate-y-0'}`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <BrandLogo />

                    <div className="flex items-center space-x-2">
                        <Link to="/shops" className="btn btn-ghost btn-sm rounded-full">
                            <Search className="w-4 h-4 mr-2"/>
                            {userType && userType !== 'customer' ? t.allShops : t.findBarber}
                        </Link>

                        <CustomerButtons user={user} userType={userType} t={t}/>
                        <ShopOwnerButtons user={user} userType={userType} t={t}/>
                        <NotificationButton user={user} userType={userType} theme={theme}/>
                        <AgendaButton user={user} userType={userType} isMobile={false} t={t} />
                        <NavbarChatButton user={user} userType={userType} theme={theme}/>

                        <div className="dropdown dropdown-end" ref={languageDropdownRef}>
                            <label
                                tabIndex={0}
                                className="btn btn-ghost btn-sm rounded-full"
                                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                            >
                                <Globe className="w-4 h-4 mr-2"/>
                                <ChevronDown className="w-4 h-4 ml-1"/>
                            </label>
                            {isLanguageDropdownOpen && (
                                <ul className="dropdown-content menu shadow-lg bg-base-100 rounded-box w-52 mt-4">
                                    {Object.entries(languages).map(([code, {name, flag}]) => (
                                        <li key={code}>
                                            <button
                                                onClick={() => {
                                                    changeLanguage(code);
                                                    setIsLanguageDropdownOpen(false);
                                                }}
                                                className={`flex items-center space-x-2 ${
                                                    language === code ? 'bg-primary/10 text-primary' : ''
                                                }`}
                                            >
                                                <span>{flag}</span>
                                                <span>{name}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="dropdown dropdown-end" ref={themeDropdownRef}>
                            <label
                                tabIndex={0}
                                className="btn btn-ghost btn-sm rounded-full"
                                onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                            >
                                {theme === 'emerald' ? (
                                    <Sun className="w-4 h-4"/>
                                ) : theme === 'luxury' ? (
                                    <Moon className="w-4 h-4"/>
                                ) : (
                                    <Monitor className="w-4 h-4"/>
                                )}
                                <ChevronDown className="w-4 h-4 ml-1"/>
                            </label>
                            {isThemeDropdownOpen && (
                                <ul className="dropdown-content menu shadow-lg bg-base-100 rounded-box w-48 mt-4">
                                    <li>
                                        <button
                                            onClick={() => {
                                                handleThemeChange('emerald');
                                                setIsThemeDropdownOpen(false);
                                            }}
                                            className={`flex items-center space-x-2 ${
                                                theme === 'emerald' ? 'bg-primary/10 text-primary' : ''
                                            }`}
                                        >
                                            <Sun className="w-4 h-4"/>
                                            <span>{t.lightMode}</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => {
                                                handleThemeChange('luxury');
                                                setIsThemeDropdownOpen(false);
                                            }}
                                            className={`flex items-center space-x-2 ${
                                                theme === 'luxury' ? 'bg-primary/10 text-primary' : ''
                                            }`}
                                        >
                                            <Moon className="w-4 h-4"/>
                                            <span>{t.darkMode}</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => {
                                                handleThemeChange('system');
                                                setIsThemeDropdownOpen(false);
                                            }}
                                            className={`flex items-center space-x-2 ${
                                                theme === 'system' ? 'bg-primary/10 text-primary' : ''
                                            }`}
                                        >
                                            <Monitor className="w-4 h-4"/>
                                            <span>{t.systemTheme}</span>
                                        </button>
                                    </li>
                                </ul>
                            )}
                        </div>

                        {user ? (
                            <div className="dropdown dropdown-end">
                                <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                                    <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                        <img
                                            alt="User avatar"
                                            src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"}
                                        />
                                    </div>
                                </label>
                                <ul tabIndex={0} className="dropdown-content menu shadow-lg bg-base-100 rounded-box w-52 mt-4">
                                    <li>
                                        <Link to="/account" className="flex items-center p-3 hover:bg-base-200">
                                            <User className="w-4 h-4 mr-2"/>
                                            {t.myAccount}
                                            <span className="badge badge-primary badge-sm ml-2">New</span>
                                        </Link>
                                    </li>
                                    <li>
                                        <button
                                            onClick={handleSignOut}
                                            className="flex items-center p-3 text-error hover:bg-base-200"
                                        >
                                            <LogOut className="w-4 h-4 mr-2"/>
                                            {t.signOut}
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        ) : (
                            <Link to="/auth" className="btn btn-primary btn-sm rounded-full">
                                {t.signIn}
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default DesktopNavbar;