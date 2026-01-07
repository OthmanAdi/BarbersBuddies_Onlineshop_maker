/**
 * @fileoverview Auth Component
 *
 * A comprehensive authentication component supporting multiple auth methods
 * and user management features.
 *
 * Key Features:
 * - Email/password authentication
 * - Google OAuth integration
 * - User profile management
 * - Password reset functionality
 * - Email verification
 * - Form validation
 * - Responsive design
 *
 * Technical Features:
 * - Firebase Authentication integration
 * - Image upload and cropping
 * - Multi-language support
 * - Session management
 * - Security best practices
 *
 * @example
 * <Auth onAuthStateChange={handleAuthChange} />
 */

import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {actionCodeSettings, auth, db, storage} from '../firebase';
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    updateProfile
} from 'firebase/auth';
import {getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {useNavigate} from 'react-router-dom';
import {collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where} from "firebase/firestore";
import LanguageContext from "./LanguageContext";
import {ArrowRight, Globe, Image as ImageIcon, Mail, Monitor, Moon, Sun, User} from "lucide-react";
import UserTypeToggle from './UserTypeToggle';
import {AnimatePresence, motion} from 'framer-motion';
import PasswordStrengthField from "./PasswordStrengthField";
import ParticleField from "./ParticleField";
import AuthAlert from "./AuthAlert";
import {useDaisyTheme} from "../hooks/useDaisyTheme";
import ImageCropModal from "./ImageCropModal";
import AccountTypeWarning from "./AccountTypeWarning";
import "./Auth.css";
import {BrandLogo} from "./BrandLogo";
import {DE, GB, SA, TR} from "country-flag-icons/react/3x2";
import useStore from '../store';
import MobileAccountTypeHelp from "./MobileAccountTypeHelp";

const avatars = [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=ffdfbf`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Max&backgroundColor=c0aede`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia&backgroundColor=d1f4d7`,
];

// Demo accounts bypass email verification (for seed data testing)
const DEMO_EMAILS = [
    'demo-owner@barbersbuddies.com',
    'demo-customer@barbersbuddies.com'
];
const isDemoAccount = (email) => DEMO_EMAILS.includes(email?.toLowerCase());

const AuthForm = ({
                      showTypeWarning,
                      setShowTypeWarning,
                      handleSubmit,
                      email,
                      setEmail,
                      password,
                      setPassword,
                      name,
                      setName,
                      profileImage,
                      handleImageChange,
                      isSignUp,
                      setIsSignUp,
                      error,
                      isLoading,
                      handleGoogleSignIn,
                      setIsForgotPassword,
                      showPassword,
                      setShowPassword,
                      t,
                      avatars,
                      userType,
                      setUserType,
                      isCropModalOpen,
                      setIsCropModalOpen,
                      tempImage,
                      setTempImage,
                      handleCroppedImage,
                  }) => {

    const isDark = useDaisyTheme();
    const [showContent, setShowContent] = useState(false);
    const [isSliding, setIsSliding] = useState(false);
    const {language, changeLanguage} = useContext(LanguageContext);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
    const themeDropdownRef = useRef(null);
    const {theme, toggleTheme} = useStore();
    const [hasSeenAnimation, setHasSeenAnimation] = useState(false);
    const [isTextAnimating, setIsTextAnimating] = useState(true);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [showMobileHelp, setShowMobileHelp] = useState(false);
    const [helpDialogOpen, setHelpDialogOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const checkTouchDevice = () => {
            return (('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                (navigator.msMaxTouchPoints > 0));
        };

        setIsTouchDevice(checkTouchDevice());
    }, []);


    useEffect(() => {
        setShowContent(true);
    }, []);

    useEffect(() => {
        if (isTextAnimating) {
            const timer = setTimeout(() => setIsTextAnimating(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isTextAnimating]);

    useEffect(() => {
        if (userType !== null) {
            setIsTextAnimating(true);
            const timer = setTimeout(() => setIsTextAnimating(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [userType]);

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
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLoginClick = () => {
        setIsSliding(true);
        setTimeout(() => {
            setIsSignUp(false);
            setIsSliding(false);
        }, 100);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowContent(true);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    const getBgClass = () => {
        if (userType === 'customer') {
            return isDark
                ? 'bg-gradient-to-br from-gray-900 via-purple-900/20 to-indigo-900'
                : 'bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100';
        } else {
            return isDark
                ? 'bg-gradient-to-br from-gray-900 via-teal-900/20 to-emerald-900'
                : 'bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100';
        }
    };

    const FormSkeleton = () => (
        <motion.div
            initial={{opacity: 0}}
            animate={showContent ? {opacity: 1} : {}}
            transition={{duration: 0.3}} // Faster initial appearance
            className="space-y-6 animate-pulse"
        >
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="h-[70px]">
                    {/* Label placeholder - lighter for light theme */}
                    <div className="h-6 w-24 bg-gray-100 dark:bg-gray-700 rounded mb-2"/>
                    {/* Input placeholder - subtle gray for light theme */}
                    <div
                        className="h-10 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600"/>
                </div>
                <div className="h-[70px]">
                    <div className="h-6 w-32 bg-gray-100 dark:bg-gray-700 rounded mb-2"/>
                    <div
                        className="h-10 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600"/>
                </div>
                <div className="h-[70px]">
                    <div className="h-6 w-28 bg-gray-100 dark:bg-gray-700 rounded mb-2"/>
                    <div
                        className="h-10 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600"/>
                </div>
                <div className="h-[70px]">
                    <div className="h-6 w-28 bg-gray-100 dark:bg-gray-700 rounded mb-2"/>
                    <div
                        className="h-10 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600"/>
                </div>
            </div>
            {/* Submit button placeholder */}
            <div className="h-12 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600"/>
        </motion.div>
    );

    const [isMobile, setIsMobile] = useState(window.matchMedia('(max-width: 739px)').matches);
    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 739px)');
        const handler = (e) => setIsMobile(e.matches);

        mediaQuery.addListener(handler);
        return () => mediaQuery.removeListener(handler);
    }, []);

    const [hasSelectedType, setHasSelectedType] = useState(false);

    useEffect(() => {
        if (userType) {
            setHasSelectedType(true);
        }
    }, [userType]);

    const flagComponents = {
        tr: TR,
        en: GB,
        ar: SA,
        de: DE
    };

    const handleThemeChange = (newTheme) => {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'luxury' : 'emerald';
        document.documentElement.setAttribute('data-theme', newTheme === 'system' ? systemTheme : newTheme);
        toggleTheme(newTheme);
    };

    const headlineTexts = {
        initial: {
            title: "Transform Your Hair Journey",
            subtitle: "Where Style Meets Innovation",
            cta: "Join a community reimagining modern hair wellness"
        },
        customer: {
            title: "Find Your Perfect Style",
            subtitle: "Book, Chat, Transform",
            cta: "Join 10,000+ satisfied clients discovering their ideal look"
        },
        'shop-owner': {
            title: "Welcome to the Barbers Business Platform",
            subtitle: "Your Success, Our Platform",
            cta: "Join thousands of users who trust our platform for their business needs"
        }
    };

    return (
        <>
            <div className="relative">
                <ParticleField/>
                <motion.div
                    className="min-h-screen relative overflow-hidden"
                    initial={{opacity: 0}}
                    animate={{
                        opacity: 1,
                        background: !isSignUp
                            ? isDark
                                ? 'linear-gradient(to bottom right, rgb(88 28 135), rgb(190 24 93))' // dark passionate welcome back
                                : 'linear-gradient(to bottom right, rgb(233 213 255), rgb(251 207 232))' // light passionate welcome back
                            : !userType
                                ? isDark
                                    ? 'linear-gradient(to bottom right, rgb(30 41 59), rgb(124 58 237))' // dark serene welcome
                                    : 'linear-gradient(to bottom right, rgb(238 242 255), rgb(224 231 255))' // light serene welcome
                                : userType === 'customer'
                                    ? isDark
                                        ? 'linear-gradient(to bottom right, rgb(192 38 211), rgb(79 70 229))' // dark dreamy candy
                                        : 'linear-gradient(to bottom right, rgb(250 232 255), rgb(224 231 255))' // light dreamy candy
                                    : isDark
                                        ? 'linear-gradient(to bottom right, rgb(17 94 89), rgb(55 48 163))' // dark professional elegance
                                        : 'linear-gradient(to bottom right, rgb(209 250 229), rgb(224 231 255))' // light professional elegance
                    }}
                    transition={{duration: 0.5}}
                >
                    <div
                        className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,transparent)] dark:[mask-image:linear-gradient(0deg,black,transparent)]"/>
                    <div
                        className="absolute -top-20 -left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob"/>
                    <div
                        className="absolute -top-40 -right-20 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-2000"/>
                    <div
                        className="absolute -bottom-20 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-4000"/>

                    <div
                        className="relative min-h-screen flex flex-col lg:flex-row items-center justify-center p-4 lg:p-8 gap-8">
                        <motion.div
                            initial={{opacity: 0, y: -20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{duration: 0.6}}
                            className="lg:w-1/2 max-w-md lg:max-w-lg px-4 text-center lg:text-left"
                        >

                            <div className="flex items-center justify-center lg:justify-start gap-6 mb-8">
                                <BrandLogo/>
                                <button className="btn btn-ghost btn-circle btn-sm">
                                    <div className="dropdown dropdown-end" ref={themeDropdownRef}>
                                        <label
                                            tabIndex={0}
                                            className="btn btn-ghost btn-circle btn-sm pointer-events-auto"
                                            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                                        >
                                            <div className="pointer-events-none">
                                                {theme === 'luxury' ? <Moon className="w-5 h-5"/> :
                                                    theme === 'system' ? <Monitor className="w-5 h-5"/> :
                                                        <Sun className="w-5 h-5"/>}
                                            </div>
                                        </label>
                                        {isThemeDropdownOpen && (
                                            <ul className="dropdown-content menu shadow-lg bg-base-100 rounded-box w-48 mt-4">
                                                <li>
                                                    <button
                                                        onClick={() => {
                                                            handleThemeChange('emerald');
                                                            setIsThemeDropdownOpen(false);
                                                        }}
                                                        className="flex items-center space-x-2"
                                                    >
                                                        <Sun className="w-4 h-4"/>
                                                        <span>Light Mode ☀️</span>
                                                    </button>
                                                </li>
                                                <li>
                                                    <button
                                                        onClick={() => {
                                                            handleThemeChange('luxury');
                                                            setIsThemeDropdownOpen(false);
                                                        }}
                                                        className="flex items-center space-x-2"
                                                    >
                                                        <Moon className="w-4 h-4"/>
                                                        <span>Dark Mode 🌙</span>
                                                    </button>
                                                </li>
                                                <li>
                                                    <button
                                                        onClick={() => {
                                                            handleThemeChange('system');
                                                            setIsThemeDropdownOpen(false);
                                                        }}
                                                        className="flex items-center space-x-2"
                                                    >
                                                        <Monitor className="w-4 h-4"/>
                                                        <span>System Theme 💻</span>
                                                    </button>
                                                </li>
                                            </ul>
                                        )}
                                    </div>
                                </button>
                                <div className="dropdown dropdown-end" ref={dropdownRef}>
                                    <label
                                        tabIndex={0}
                                        className="btn btn-ghost btn-circle btn-sm"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    >
                                        <Globe className="w-5 h-5"/>
                                    </label>
                                    {isDropdownOpen && (
                                        <ul className="dropdown-content menu shadow-lg bg-base-100 rounded-box w-32 mt-4">
                                            {Object.entries({
                                                tr: {name: 'TR', flag: flagComponents.tr},
                                                en: {name: 'EN', flag: flagComponents.en},
                                                ar: {name: 'AR', flag: flagComponents.ar},
                                                de: {name: 'DE', flag: flagComponents.de}
                                            }).map(([code, {name, flag: FlagComponent}]) => (
                                                <li key={code}>
                                                    <button
                                                        onClick={() => {
                                                            changeLanguage(code);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className={`flex items-center space-x-2 ${
                                                            language === code ? 'bg-primary/10 text-primary' : ''
                                                        }`}
                                                    >
                                                        <FlagComponent className="w-4 h-3"/>
                                                        <span>{name}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <motion.div>
                                <motion.h1
                                    className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight"
                                    initial={isTextAnimating ? {opacity: 0, y: 20} : {}}
                                    animate={{opacity: 1, y: 0}}
                                    transition={{duration: 0.5}}
                                >
                                    {!isSignUp ? (
                                        <motion.div
                                            initial={isTextAnimating ? {opacity: 0} : {}}
                                            animate={{opacity: 1}}
                                            transition={{duration: 0.5, delay: 0.2}}
                                        >
                                            Welcome{' '}
                                            <span
                                                className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400">
                    Back!
                </span>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            initial={isTextAnimating ? {opacity: 0} : {}}
                                            animate={{opacity: 1}}
                                            transition={{duration: 0.5, delay: 0.4}}
                                        >
                                            {!userType ? (
                                                <>
                                                    <motion.span
                                                        initial={isTextAnimating ? {opacity: 0} : {}}
                                                        animate={{opacity: 1}}
                                                        transition={{duration: 0.5, delay: 0.6}}
                                                    >
                                                        {headlineTexts.initial.title}{' '}
                                                    </motion.span>
                                                    <motion.span
                                                        initial={isTextAnimating ? {opacity: 0} : {}}
                                                        animate={{opacity: 1}}
                                                        transition={{duration: 0.5, delay: 0.8}}
                                                        className={`text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400`}
                                                    >
                                                        {headlineTexts.initial.subtitle}
                                                    </motion.span>
                                                </>
                                            ) : (
                                                <>
                                                    {userType === 'customer' ? (
                                                        <span
                                                            className={`text-transparent bg-clip-text bg-gradient-to-r ${
                                                                !userType
                                                                    ? 'from-indigo-500 to-violet-500 [data-theme=luxury]:from-indigo-200 [data-theme=luxury]:to-violet-200'
                                                                    : userType === 'customer'
                                                                        ? 'from-fuchsia-500 to-indigo-500 [data-theme=luxury]:from-fuchsia-200 [data-theme=luxury]:to-indigo-200'
                                                                        : 'from-teal-600 to-blue-600 [data-theme=luxury]:from-teal-200 [data-theme=luxury]:to-blue-200'
                                                            }`}>
                Find Your Perfect Style
            </span>
                                                    ) : (
                                                        <>
                                                            Welcome to the{' '}
                                                            <span
                                                                className={`text-transparent bg-clip-text bg-gradient-to-r ${
                                                                    !userType
                                                                        ? 'from-indigo-500 to-violet-500 [data-theme=luxury]:from-indigo-200 [data-theme=luxury]:to-violet-200'
                                                                        : userType === 'customer'
                                                                            ? 'from-fuchsia-500 to-indigo-500 [data-theme=luxury]:from-fuchsia-200 [data-theme=luxury]:to-indigo-200'
                                                                            : 'from-teal-600 to-blue-600 [data-theme=luxury]:from-teal-200 [data-theme=luxury]:to-blue-200'
                                                                }`}>
                    Barbers Business Platform
                </span>
                                                        </>
                                                    )}

                                                    <span className={`text-transparent bg-clip-text bg-gradient-to-r ${
                                                        !userType
                                                            ? 'from-indigo-500 to-violet-500 [data-theme=luxury]:from-indigo-200 [data-theme=luxury]:to-violet-200'
                                                            : userType === 'customer'
                                                                ? 'from-fuchsia-500 to-indigo-500 [data-theme=luxury]:from-fuchsia-200 [data-theme=luxury]:to-indigo-200'
                                                                : 'from-teal-600 to-blue-600 [data-theme=luxury]:from-teal-200 [data-theme=luxury]:to-blue-200'
                                                    }`}>
        </span>
                                                </>
                                            )}
                                        </motion.div>
                                    )}
                                </motion.h1>
                                <motion.p
                                    className={`text-xl font-bold ${isDark ? 'text-gray-300' : 'text-gray-900'}`}
                                    initial={isTextAnimating ? {opacity: 0, y: 20} : {}}
                                    animate={{opacity: 1, y: 0}}
                                    transition={{duration: 0.5, delay: 1}}
                                >
                                    {!isSignUp
                                        ? "Let's get back to shaping the future of barbering, one cut at a time!"
                                        : !userType
                                            ? headlineTexts.initial.cta
                                            : userType === 'customer'
                                                ? headlineTexts.customer.cta
                                                : headlineTexts['shop-owner'].cta
                                    }
                                </motion.p>
                                <div className="mt-8 hidden lg:block">
                                    <div className="flex items-center gap-4">
                                        <div className="flex -space-x-4">
                                            {avatars.map((avatar, index) => (
                                                <img
                                                    key={index}
                                                    src={avatar}
                                                    alt={`User avatar ${index + 1}`}
                                                    className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 bg-white dark:bg-gray-800 shadow-lg transform hover:-translate-y-1 transition-transform duration-200"
                                                />
                                            ))}
                                        </div>
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {!isSignUp ? (
                                                <>Your trusted community of <span
                                                    className={`font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>10,000+</span> professionals</>
                                            ) : (
                                                <>Join <span
                                                    className={`font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>10,000+</span> other
                                                    businesses</>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>

                        <motion.div
                            initial={{opacity: 0, x: 20}}
                            animate={{opacity: 1, x: 0}}
                            transition={{duration: 0.6, delay: 0.3}}
                            className="w-full max-w-2xl"
                        >
                            <div className={`backdrop-blur-lg bg-white/80 dark:bg-gray-900/80 p-8 lg:p-12 rounded-2xl 
    shadow-2xl border border-gray-200 dark:border-gray-700
    transition-all duration-100 ease-in-out
    transform perspective-1000
    ${isSliding ? '-rotate-y-90 translate-x-full' : 'rotate-y-0 translate-x-0'}
`}>
                                <AnimatePresence>
                                    {!helpDialogOpen && (
                                        <button
                                            className={`absolute group z-[9999]
       transition-all duration-500 ease-in-out
       ${isSignUp && !userType ? 'opacity-100' : 'opacity-0 pointer-events-none'}
       ${window.matchMedia('(max-width: 739px)').matches ?
                                                '-top-8 left-1/2 -translate-x-1/2' :
                                                '-left-8 top-1/2 -translate-y-1/2'}`}
                                            onClick={handleLoginClick}
                                        >
                                            <div className="relative flex flex-col items-center justify-center w-16 h-16 rounded-full
       shadow-lg
       bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500
       before:absolute before:inset-0 before:rounded-full
       before:bg-gradient-to-r before:from-pink-500 before:via-purple-600 before:to-purple-500
       before:animate-[shimmer_2s_ease-in-out_infinite]
       before:opacity-0 before:hover:opacity-100
       before:transition-opacity before:duration-300
       hover:scale-105
       transition-all duration-300">
                                                <span
                                                    className="text-white text-sm font-medium mb-1 relative z-10">Login</span>
                                                <ArrowRight
                                                    className="w-5 h-5 text-white rotate-180 relative z-10
           transform group-hover:-translate-x-1
           transition-transform duration-300"
                                                />
                                            </div>
                                        </button>
                                    )}
                                </AnimatePresence>
                                {isSignUp && (
                                    <motion.div
                                        initial={{opacity: 0, y: -20}}
                                        animate={{opacity: 1, y: 0}}
                                        transition={{duration: 0.5}}
                                    >
                                        <div className="flex items-center justify-center gap-3">
                                            <motion.h3
                                                className="text-xl md:text-2xl font-bold text-center bg-clip-text text-transparent"
                                                style={{
                                                    backgroundImage: 'linear-gradient(to right, #9333EA, #DB2777)',
                                                    backgroundSize: '200% 100%'
                                                }}
                                                animate={{
                                                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                                                }}
                                                transition={{
                                                    duration: 8,
                                                    ease: "linear",
                                                    repeat: Infinity
                                                }}
                                            >
                                                Pick Account Type
                                            </motion.h3>
                                            {windowWidth <= 1258 && (
                                                <motion.button
                                                    onClick={() => {
                                                        setShowMobileHelp(true);
                                                        setHelpDialogOpen(true);
                                                    }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="text-sm text-gray-500 dark:text-gray-400 font-medium relative"
                                                >
                                                    <motion.span
                                                        className="relative"
                                                        animate={{
                                                            scale: [1, 1.05, 1],
                                                            opacity: [1, 0.8, 1]
                                                        }}
                                                        transition={{
                                                            duration: 2,
                                                            repeat: Infinity,
                                                            ease: "easeInOut"
                                                        }}
                                                    >
                                                        Help me choose
                                                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-300 dark:bg-gray-600" />
                                                    </motion.span>
                                                </motion.button>
                                            )}
                                        </div>
                                        <UserTypeToggle
                                            userType={userType}
                                            setUserType={setUserType}
                                            showTypeWarning={showTypeWarning}
                                            setIsTextAnimating={setIsTextAnimating}
                                        />
                                    </motion.div>
                                )}

                                <motion.div
                                    initial={{opacity: 0}}
                                    animate={{opacity: 1}}
                                    transition={{delay: 0.4, duration: 0.5}}
                                    className="mb-8 text-center"
                                >
                                    <motion.div className="mb-8 text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {isSignUp ? t.createAccount : t.signIn}
                                            </h2>
                                            {isSignUp && isTouchDevice && (
                                                <button
                                                    onClick={() => setShowMobileHelp(true)}
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
                                            )}
                                        </div>
                                    </motion.div>
                                </motion.div>

                                {isSignUp && isTouchDevice && (
                                    <MobileAccountTypeHelp
                                        isOpen={showMobileHelp}
                                        onClose={() => {
                                            setShowMobileHelp(false);
                                            setHelpDialogOpen(false);
                                        }}
                                        language={language}
                                        isDark={isDark}
                                    />
                                )}

                                <AccountTypeWarning show={showTypeWarning} onClose={() => setShowTypeWarning(false)}/>

                                <motion.div
                                    initial={{opacity: 0, y: 20}}
                                    animate={{opacity: 1, y: 0}}
                                    transition={{delay: 0.6, duration: 0.5}}
                                    className="mb-8"
                                >
                                    <button
                                        onClick={handleGoogleSignIn}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 group"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                                            />
                                        </svg>
                                        Continue with Google
                                    </button>
                                </motion.div>

                                <motion.div
                                    initial={{opacity: 0}}
                                    animate={{opacity: 1}}
                                    transition={{delay: 0.7, duration: 0.5}}
                                    className="relative mb-8"
                                >
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-200 dark:border-gray-700"/>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
        <span className="px-2 bg-white/80 dark:bg-gray-900/80 text-gray-500 dark:text-gray-400">
            or continue with email
        </span>
                                    </div>
                                </motion.div>

                                {(isSignUp && !userType) ? (
                                    <FormSkeleton/>
                                ) : (
                                    <motion.form
                                        initial={{opacity: 0}}
                                        animate={{opacity: 1}}
                                        transition={{delay: 0.1, duration: 0.4}}
                                        onSubmit={handleSubmit}
                                        className="space-y-6"
                                        autoComplete="off"
                                        spellCheck="false"
                                    >
                                        <>
                                            <motion.div
                                                initial={{y: 20}}
                                                animate={{y: 0}}
                                                transition={{
                                                    duration: 0.3,
                                                    delay: 0.2,
                                                    ease: "easeOut"
                                                }}
                                                className="space-y-6"
                                            >
                                                <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                                                    {isSignUp && (
                                                        <div>
                                                            <label
                                                                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                                                                {t.fullName}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                required
                                                                name="full-name"
                                                                autoComplete="off"
                                                                className="block w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white
                        bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                        focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400
                        placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                                                placeholder={t.fullNamePlaceholder}
                                                                value={name}
                                                                onChange={(e) => setName(e.target.value)}
                                                            />
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label
                                                            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                                                            {t.emailAddress}
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="email"
                                                                name="email-address"
                                                                required
                                                                autoComplete="off"
                                                                className="block w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white
        bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400
        placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                                                placeholder={t.emailPlaceholder}
                                                                value={email}
                                                                onChange={(e) => setEmail(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <label
                                                                className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                                                {t.password}
                                                            </label>
                                                            {!isSignUp && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setIsForgotPassword(true)}
                                                                    className="text-sm font-medium text-purple-600 hover:text-purple-500
                    dark:text-purple-400 dark:hover:text-purple-300"
                                                                >
                                                                    {t.forgotPassword}
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="relative">
                                                            {isSignUp ? (
                                                                <PasswordStrengthField
                                                                    password={password}
                                                                    onChange={setPassword}
                                                                    showPassword={showPassword}
                                                                    setShowPassword={setShowPassword}
                                                                    placeholder={t.passwordPlaceholder}
                                                                />
                                                            ) : (
                                                                <input
                                                                    type={showPassword ? "text" : "password"}
                                                                    name="new-password"
                                                                    required
                                                                    autoComplete="new-password"
                                                                    className="block w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white
                    bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                    focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400
                    placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                                                    placeholder={t.passwordPlaceholder}
                                                                    value={password}
                                                                    onChange={(e) => setPassword(e.target.value)}
                                                                />
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                            >
                                                                {showPassword ? (
                                                                    <svg xmlns="http://www.w3.org/2000/svg"
                                                                         className="h-5 w-5"
                                                                         viewBox="0 0 20 20" fill="currentColor">
                                                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                                                        <path fillRule="evenodd"
                                                                              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                                                              clipRule="evenodd"/>
                                                                    </svg>
                                                                ) : (
                                                                    <svg xmlns="http://www.w3.org/2000/svg"
                                                                         className="h-5 w-5"
                                                                         viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd"
                                                                              d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                                                                              clipRule="evenodd"/>
                                                                        <path
                                                                            d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isSignUp && (
                                                        <div>
                                                            <label
                                                                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                                                                {t.profileImage}
                                                            </label>
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-12 w-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800
   ring-2 ring-gray-200 dark:ring-gray-700">
                                                                    {profileImage ? (
                                                                        <img
                                                                            src={URL.createObjectURL(profileImage)}
                                                                            alt="Profile preview"
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <User
                                                                            className="h-full w-full p-2 text-gray-400 dark:text-gray-500"/>
                                                                    )}
                                                                </div>
                                                                <label
                                                                    htmlFor="profile-image-upload"
                                                                    className="flex items-center gap-2 px-4 py-2
           text-sm font-medium text-gray-700 dark:text-gray-200
           bg-gray-50 dark:bg-gray-800
           border border-gray-200 dark:border-gray-700
           rounded-xl cursor-pointer
           hover:bg-gray-100 dark:hover:bg-gray-700
           transition-colors duration-200"
                                                                >
                                                                    <ImageIcon className="w-5 h-5"/>
                                                                    {t.change}
                                                                </label>
                                                                <input
                                                                    id="profile-image-upload"
                                                                    type="file"
                                                                    className="hidden"
                                                                    accept="image/*"
                                                                    onChange={handleImageChange}
                                                                />
                                                            </div>
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
                                                        </div>
                                                    )}
                                                </div>

                                                {error && (
                                                    <div
                                                        className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                                                        {error}
                                                    </div>
                                                )}

                                                <button
                                                    type="submit"
                                                    disabled={isLoading}
                                                    className="relative w-full inline-flex items-center justify-center px-4 py-3 rounded-xl
text-sm font-semibold text-white dark:text-gray-900
bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400
hover:from-purple-700 hover:to-pink-700 dark:hover:from-purple-500 dark:hover:to-pink-500
focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
disabled:opacity-50 disabled:cursor-not-allowed
transition-all duration-200 group"
                                                >
                                                    {isLoading ? (
                                                        <svg className="animate-spin h-5 w-5"
                                                             xmlns="http://www.w3.org/2000/svg"
                                                             fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                                                    stroke="currentColor"
                                                                    strokeWidth="4"/>
                                                            <path className="opacity-75" fill="currentColor"
                                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                                        </svg>
                                                    ) : (
                                                        <>
                                                            <span>{isSignUp ? t.signUp : t.signInButton}</span>
                                                            <ArrowRight
                                                                className="ml-2 h-4 w-4 transform transition-transform group-hover:translate-x-1"/>
                                                        </>
                                                    )}
                                                </button>
                                            </motion.div>

                                            <motion.p
                                                initial={{opacity: 0}}
                                                animate={{opacity: 1}}
                                                transition={{delay: 1, duration: 0.5}}
                                                className="mt-6 text-center text-sm"
                                            >
   <span className="text-gray-500 dark:text-gray-400">
       {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}
   </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsSignUp(!isSignUp)}
                                                    className="ml-2 font-medium text-purple-600 hover:text-purple-500
       dark:text-purple-400 dark:hover:text-purple-300"
                                                >
                                                    {isSignUp ? t.signInButton : t.signUp}
                                                </button>
                                            </motion.p>
                                        </>
                                    </motion.form>
                                )}</div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </>
    );
};


const ForgotPasswordForm = ({
                                handleForgotPassword,
                                email,
                                setEmail,
                                error,
                                success,
                                isLoading,
                                setIsForgotPassword,
                                t,
                                userType
                            }) => {

    const isDark = useDaisyTheme();

    const getBgClass = () => {
        if (userType === 'customer') {
            return isDark
                ? 'bg-gradient-to-br from-gray-900 via-purple-900/20 to-indigo-900'
                : 'bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100';
        } else {
            return isDark
                ? 'bg-gradient-to-br from-gray-900 via-teal-900/20 to-emerald-900'
                : 'bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100';
        }
    };

    return (
        <>
            <ParticleField/>
            <motion.div className={`min-h-screen relative overflow-hidden ${getBgClass()}`}>
                {/* Decorative Elements */}
                <div
                    className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,transparent)] dark:[mask-image:linear-gradient(0deg,black,transparent)]"/>
                <div
                    className="absolute top-20 right-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob"/>
                <div
                    className="absolute -bottom-20 -left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-4000"/>

                <div className="relative min-h-screen flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className={`backdrop-blur-lg ${
                            isDark ? 'bg-gray-900/80' : 'bg-white/80'
                        } p-8 rounded-2xl shadow-2xl border ${
                            isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
                                {t.resetPassword}
                            </h2>

                            <form onSubmit={handleForgotPassword} className="space-y-6">
                                <div>
                                    <label
                                        className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                                        {t.emailAddress}
                                    </label>
                                    <input
                                        type="email"
                                        name="email-address"
                                        required
                                        autoComplete="off"
                                        className="block w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white
        bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400
        placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                        placeholder={t.emailPlaceholder}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>

                                {error && (
                                    <div
                                        className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div
                                        className="p-4 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm">
                                        {success}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="relative w-full inline-flex items-center justify-center px-4 py-3 rounded-xl
                                        text-sm font-semibold text-white dark:text-gray-900
                                        bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400
                                        hover:from-purple-700 hover:to-pink-700 dark:hover:from-purple-500 dark:hover:to-pink-500
                                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        transition-all duration-200 group"
                                    >
                                        {isLoading ? (
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg"
                                                 fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor"
                                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                            </svg>
                                        ) : (
                                            <>
                                                <span>{t.resetPassword}</span>
                                                <ArrowRight
                                                    className="ml-2 h-4 w-4 transform transition-transform group-hover:translate-x-1"/>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setIsForgotPassword(false)}
                                        className="w-full inline-flex items-center justify-center px-4 py-3 rounded-xl
                                        text-sm font-medium border border-gray-200 dark:border-gray-700
                                        bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
                                        hover:bg-gray-50 dark:hover:bg-gray-700
                                        transition-all duration-200"
                                    >
                                        {t.backToLogin}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    )
}

const VerificationView = ({
                              email,
                              onResend,
                              success,
                              error,
                              setError,
                              setSuccess,
                              userCredentials,
                              t,
                              resendCooldown
                          }) => {

    const isDark = useDaisyTheme();

    const getBgClass = () => {
        return isDark
            ? 'bg-gradient-to-br from-gray-900 via-purple-900/20 to-indigo-900'
            : 'bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100';
    };

    const navigate = useNavigate();
    const [cooldownTime, setCooldownTime] = useState(0);

    useEffect(() => {
        let timer;
        if (cooldownTime > 0) {
            timer = setInterval(() => {
                setCooldownTime(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cooldownTime]);

    const handleResend = async () => {
        if (cooldownTime > 0) return;

        try {
            await onResend();
            setCooldownTime(30); // Set local cooldown timer
        } catch (error) {
            console.error('Error resending verification:', error);
            setError?.(error.message || t.tooManyAttempts);
        }
    };

    const handleEmailConfirmed = async () => {
        try {
            // First try to sign in with the saved credentials
            if (userCredentials.email && userCredentials.password) {
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, userCredentials.email, userCredentials.password);
                    const user = userCredential.user;

                    // Now check if email is verified (demo accounts bypass)
                    await user.reload();
                    if (user.emailVerified || isDemoAccount(user.email)) {
                        // If verified (or demo account), proceed to home
                        navigate('/');
                    } else {
                        // If not verified, show alert
                        alert(t.pleaseVerifyFirst);
                        // Sign out again
                        await auth.signOut();
                    }
                } catch (error) {
                    console.error("Authentication error:", error);
                    alert(t.verificationError || "Please verify your email first");
                }
            } else {
                // If no credentials, go back to auth
                navigate('/auth');
            }
        } catch (error) {
            console.error("Error checking email verification:", error);
            alert(t.verificationError || "Error checking verification status");
            navigate('/auth');
        }
    };

    return (
        <><ParticleField/>
            <div className={`min-h-screen relative overflow-hidden ${getBgClass()}`}>
                {/* Decorative Elements */}
                <div
                    className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,transparent)] dark:[mask-image:linear-gradient(0deg,black,transparent)]"/>
                <div
                    className="absolute -top-20 -left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob"/>
                <div
                    className="absolute -bottom-20 right-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-4000"/>

                <div className="relative min-h-screen flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className={`backdrop-blur-lg ${
                            isDark ? 'bg-gray-900/80' : 'bg-white/80'
                        } p-8 rounded-2xl shadow-2xl border ${
                            isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded-full mx-auto mb-6
                            flex items-center justify-center">
                                <Mail className="h-8 w-8 text-purple-600 dark:text-purple-400"/>
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                                {t.checkEmail}
                            </h2>

                            <p className={`text-gray-600 ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                                {t.verificationInstructions}
                            </p>
                            <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {email}
                            </p>

                            <div className="space-y-4">
                                <a
                                    href="https://mail.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center w-full px-4 py-3 rounded-xl
                                    text-sm font-semibold text-white dark:text-gray-900
                                    bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400
                                    hover:from-purple-700 hover:to-pink-700 dark:hover:from-purple-500 dark:hover:to-pink-500
                                    transition-all duration-200"
                                >
                                    {t.openEmail}
                                </a>

                                <button
                                    onClick={handleEmailConfirmed}
                                    className="inline-flex items-center justify-center w-full px-4 py-3 rounded-xl
                                    text-sm font-semibold text-purple-600 dark:text-purple-400
                                    bg-purple-50 dark:bg-purple-900/30
                                    hover:bg-purple-100 dark:hover:bg-purple-900/50
                                    border border-purple-200 dark:border-purple-800
                                    transition-all duration-200"
                                >
                                    I've Confirmed My Email
                                </button>
                            </div>

                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-700"/>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white/80 dark:bg-gray-900/80 text-gray-500 dark:text-gray-400">
                                    {t.didntReceiveEmail}
                                </span>
                                </div>
                            </div>

                            <button
                                onClick={handleResend}
                                disabled={cooldownTime > 0}
                                className={`w-full inline-flex items-center justify-center px-4 py-3 rounded-xl
                                text-sm font-medium border transition-all duration-200 relative overflow-hidden
                                ${cooldownTime > 0
                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                } border-gray-200 dark:border-gray-700`}
                            >
                                {cooldownTime > 0 ? (
                                    <div className="flex items-center space-x-2">
                                        <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        <span>{`${t.resendEmail} (${cooldownTime}s)`}</span>
                                    </div>
                                ) : (
                                    t.resendEmail
                                )}
                                {cooldownTime > 0 && (
                                    <div
                                        className="absolute bottom-0 left-0 h-1 bg-purple-600 dark:bg-purple-400 transition-all duration-1000"
                                        style={{
                                            width: `${(cooldownTime / 30) * 100}%`,
                                        }}
                                    />
                                )}
                            </button>

                            {success && (
                                <div
                                    className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm">
                                    {success}
                                </div>
                            )}

                            {error && (
                                <div
                                    className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const Auth = () => {
    const [showTypeWarning, setShowTypeWarning] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(true);
    const navigate = useNavigate();
    const {language} = useContext(LanguageContext);
    const [success, setSuccess] = useState('');
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isVerificationSent, setIsVerificationSent] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [userCredentials, setUserCredentials] = useState({email: '', password: ''});
    const [resendCooldown, setResendCooldown] = useState(0);
    const COOLDOWN_TIME = 60;
    const [password, setPassword] = useState(''); // Make sure this is initialized as empty string
    const [showPassword, setShowPassword] = useState(false);
    const [cooldownTime, setCooldownTime] = useState(0);
    const [userType, setUserType] = useState(null);
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [tempImage, setTempImage] = useState(null);

    useEffect(() => {
        // Only reset the state values
        setEmail('');
        setPassword('');
        setName('');
    }, []);

    useEffect(() => {
        let timer;
        if (cooldownTime > 0) {
            timer = setInterval(() => {
                setCooldownTime(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldownTime]);

    const resendVerificationEmail = async (email, password) => {
        if (resendCooldown > 0) {
            throw new Error(t.pleaseWait.replace('%s', resendCooldown));
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await sendEmailVerification(user, actionCodeSettings);
            await auth.signOut();

            // Start cooldown
            setResendCooldown(COOLDOWN_TIME);
            const timer = setInterval(() => {
                setResendCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return true;
        } catch (error) {
            console.error('Error in resendVerificationEmail:', error);
            if (error.code === 'auth/too-many-requests') {
                throw new Error(t.tooManyAttempts);
            }
            throw error;
        }
    };


    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            if (!email) {
                throw new Error(t.emailRequired);
            }
            await sendPasswordResetEmail(auth, email);
            setSuccess(t.resetEmailSent);
            setIsEmailSent(true);
            setTimeout(() => {
                setIsForgotPassword(false);
                setIsEmailSent(false);
            }, 5000);
        } catch (error) {
            console.error("Password reset error:", error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Demo accounts bypass email verification
                if (!user.emailVerified && user.providerData[0].providerId === 'password' && !isDemoAccount(user.email)) {
                    setError(t.emailVerificationRequired);
                    await auth.signOut();
                    return;
                }
                console.log("User is signed in:", user);
                console.log("User UID:", user.uid);
                console.log("User email:", user.email);
                console.log("Is demo account:", isDemoAccount(user.email));

                // Get the user's document from Firestore to check userType
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                console.log("User doc exists:", userDoc.exists());

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    console.log("User data:", userData);
                    // Navigate based on userType
                    if (userData.userType === 'customer') {
                        navigate('/shops');
                    } else {
                        navigate('/create-shop');
                    }
                } else {
                    console.log("No user document found for UID:", user.uid);
                    // For demo accounts without docs, navigate based on email
                    if (isDemoAccount(user.email)) {
                        if (user.email.includes('owner')) {
                            navigate('/create-shop');
                        } else {
                            navigate('/shops');
                        }
                    }
                }
            } else {
                console.log("No user is signed in.");
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const handleAuth = async (e) => {
        e.preventDefault();
        console.log("=== handleAuth called ===");
        console.log("Email:", email);
        console.log("Password:", password ? "****" : "EMPTY!");
        console.log("isSignUp:", isSignUp);
        setError('');
        try {
            if (isSignUp) {
                console.log("Attempting to create new user");
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Upload profile image if provided
                let photoURL = '';
                if (profileImage) {
                    const imageRef = ref(storage, `profile_images/${user.uid}`);
                    await uploadBytes(imageRef, profileImage);
                    photoURL = await getDownloadURL(imageRef);
                }

                // Update user profile
                await updateProfile(user, {
                    displayName: name,
                    photoURL: photoURL
                });

                console.log("User created and profile updated successfully");
            } else {
                console.log("Attempting to sign in user with:", email);
                const result = await signInWithEmailAndPassword(auth, email, password);
                console.log("User signed in successfully:", result.user.uid);
            }
        } catch (error) {
            console.error("=== Authentication error ===");
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
            setError(error.message);
        }
    };

    const handleGoogleSignIn = async () => {
        if (isSignUp && !userType) {
            setShowTypeWarning(true);
            return;
        }

        setError('');
        setIsLoading(true);
        try {
            // Initialize provider with all necessary scopes
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
            provider.addScope('https://www.googleapis.com/auth/userinfo.email');
            provider.setCustomParameters({
                prompt: 'consent'
            });

            // Single sign-in attempt
            const result = await signInWithPopup(auth, provider);

            // Check if user exists in Firestore
            const userRef = doc(db, 'users', result.user.uid);
            const userSnap = await getDoc(userRef);

            if (!isSignUp && !userSnap.exists()) {
                // User trying to sign in but doesn't have an account
                await auth.signOut(); // Sign out the auth attempt
                setShowAlert(true);
                setAlertMessage(
                    <div className="flex flex-col items-center">
                        <div className="text-lg font-semibold mb-2">Account Not Found</div>
                        <div className="text-sm text-center">
                            This Google account isn't registered yet. Please use the Sign Up tab to create a new
                            account.
                        </div>
                        <button
                            onClick={() => {
                                setIsSignUp(true);
                                setShowAlert(false);
                            }}
                            className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
                        >
                            Go to Sign Up
                        </button>
                    </div>
                );
                setIsLoading(false);
                return;
            }

            if (!userSnap.exists()) {
                // New user signing up - create their document
                const userData = {
                    email: result.user.email,
                    displayName: result.user.displayName,
                    photoURL: result.user.photoURL,
                    createdAt: serverTimestamp(),
                    isSubscribed: false,
                    trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                    phoneNumber: result.user.phoneNumber || null,
                    lastLoginAt: serverTimestamp(),
                    userType: userType,
                    emailVerified: true,
                    providerId: 'google.com'
                };
                await setDoc(userRef, userData);

                // Navigate based on userType for new user
                navigate(userType === 'customer' ? '/shops' : '/create-shop');
            } else {
                // Existing user - update last login and navigate
                await updateDoc(userRef, {
                    lastLoginAt: serverTimestamp(),
                    photoURL: result.user.photoURL,
                    displayName: result.user.displayName,
                    phoneNumber: result.user.phoneNumber || userSnap.data().phoneNumber || null,
                });

                // Navigate based on existing userType
                navigate(userSnap.data().userType === 'customer' ? '/shops' : '/create-shop');
            }
        } catch (error) {
            console.error("Error during Google Sign-In:", error);
            // Reset loading state for popup-related errors
            if (error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request' ||
                error.code === 'auth/popup-blocked') {
                setIsLoading(false);
                return; // Don't show error message for user-initiated cancellations
            }

            // Handle other error types
            switch (error.code) {
                case 'auth/network-request-failed':
                    setError('Network error. Please check your internet connection.');
                    break;
                case 'auth/user-disabled':
                    setError('This account has been disabled.');
                    break;
                case 'auth/operation-not-allowed':
                    setError('Google sign-in is not enabled. Please contact support.');
                    break;
                case 'auth/invalid-credential':
                    setError('Invalid Google credentials. Please try again.');
                    break;
                default:
                    setError(error.message || 'An error occurred during Google sign-in. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageChange = (e) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setTempImage(URL.createObjectURL(file));
            setIsCropModalOpen(true);
        }
    };

    const handleCroppedImage = useCallback((croppedFile) => {
        setProfileImage(croppedFile);
        if (tempImage) {
            URL.revokeObjectURL(tempImage);
        }
    }, [tempImage]);

    const validatePassword = (password) => {
        const requirements = [
            {re: /.{8,}/, label: 'At least 8 characters'},
            {re: /[0-9]/, label: 'At least 1 number'},
            {re: /[a-z]/, label: 'At least 1 lowercase letter'},
            {re: /[A-Z]/, label: 'At least 1 uppercase letter'},
            {re: /[^A-Za-z0-9]/, label: 'At least 1 special character'}
        ];

        const failedRequirements = requirements.filter(req => !req.re.test(password));

        if (failedRequirements.length > 0) {
            throw new Error(`Password must contain: ${failedRequirements.map(r => r.label).join(', ')}`);
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSignUp && !userType) {
            setShowTypeWarning(true);
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');
        setShowAlert(false); // Reset alert state

        try {
            if (isSignUp) {
                // Existing signup validation
                try {
                    validatePassword(password);
                } catch (validationError) {
                    setError(validationError.message);
                    setIsLoading(false);
                    return;
                }

                // Create auth user
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                try {
                    // Send verification email
                    await sendEmailVerification(user);

                    // Handle profile image
                    let photoURL = '';
                    if (profileImage) {
                        const imageRef = ref(storage, `profile_images/${user.uid}`);
                        await uploadBytes(imageRef, profileImage);
                        photoURL = await getDownloadURL(imageRef);
                    }

                    // Update profile
                    await updateProfile(user, {
                        displayName: name,
                        photoURL: photoURL || ''
                    });

                    // Create user document
                    const trialEndDate = new Date();
                    trialEndDate.setDate(trialEndDate.getDate() + 14);

                    await setDoc(doc(db, 'users', user.uid), {
                        email: user.email,
                        displayName: name,
                        photoURL: photoURL || '',
                        userType: userType,
                        trialEndDate: trialEndDate,
                        isSubscribed: false,
                        emailVerified: false,
                        createdAt: serverTimestamp(),
                        lastUpdated: serverTimestamp()
                    });

                    // Sign out and set verification states
                    await auth.signOut();
                    setUserEmail(email);
                    setUserCredentials({email, password});
                    setIsVerificationSent(true);

                } catch (setupError) {
                    // Cleanup on setup failure
                    console.error('Setup error:', setupError);
                    try {
                        await user.delete();
                    } catch (deleteError) {
                        console.error('Error deleting user:', deleteError);
                    }
                    throw setupError;
                }
            } else {
                // Login flow with new alert system
                try {
                    // Demo accounts skip Firestore check (bypass permissions)
                    if (!isDemoAccount(email)) {
                        // First check if user exists in Firestore
                        const usersRef = collection(db, 'users');
                        const q = query(usersRef, where('email', '==', email));
                        const querySnapshot = await getDocs(q);

                        if (querySnapshot.empty) {
                            setShowAlert(true);
                            setAlertMessage(t.accountNotFound);
                            setIsLoading(false);
                            return;
                        }
                    }

                    // Attempt login
                    try {
                        await signInWithEmailAndPassword(auth, email, password);
                    } catch (loginError) {
                        if (loginError.code === 'auth/wrong-password') {
                            setShowAlert(true);
                            setAlertMessage(t.wrongPassword);
                        } else {
                            throw loginError;
                        }
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    setShowAlert(true);
                    setAlertMessage(t.generalError);
                }
            }
        } catch (error) {
            console.error('Authentication error:', error);
            const errorMessage = (
                <div className="rounded-lg bg-red-50 p-4 border-l-4 border-red-400">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                      clipRule="evenodd"/>
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">
                                {error.message}
                            </p>
                        </div>
                    </div>
                </div>
            );
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const translations = {
        en: {
            pleaseWait: 'Please wait %s seconds before trying again',
            checkEmail: "Check your email",
            verificationInstructions: "We've sent a verification link to",
            verificationSubText: "Click the link in the email to verify your account and start using our services.",
            closeWindow: "You can close this window",
            openEmail: "Open email app",
            didntReceiveEmail: "Didn't receive the email?",
            resendEmail: "Resend verification email",
            emailSent: "Email sent!",
            accountNotFound: "No account found with this email. Please check your email or sign up.",
            wrongPassword: "Incorrect password. Please try again.",
            createAccount: "Create your account",
            signIn: "Sign in to your account",
            emailAddress: "Email address",
            emailPlaceholder: "you@example.com",
            password: "Password",
            passwordPlaceholder: "••••••••",
            fullName: "Full Name",
            fullNamePlaceholder: "John Doe",
            profileImage: "Profile Image",
            change: "Change",
            signUp: "Sign Up",
            signInButton: "Sign In",
            orContinueWith: "Or continue with",
            signInWithGoogle: "Sign in with Google",
            alreadyHaveAccount: "Already have an account?",
            dontHaveAccount: "Don't have an account?",
            forgotPassword: "Forgot Password?",
            resetPassword: "Reset Password",
            backToLogin: "Back to Login",
            emailRequired: "Email is required",
            resetEmailSent: "Password reset email has been sent. Please check your inbox.",
            emailVerificationRequired: "Please verify your email before signing in.",
            verificationEmailSent: "Verification email has been sent. Please check your inbox.",
            processing: "Processing...",
            profileSetupError: "Error setting up profile. Please try again.",
            invalidEmail: "Invalid email address",
            tooManyAttempts: "Too many attempts. Please try again later.",
            generalError: "An error occurred during sign in. Please try again.",
            accountDisabled: "This account has been disabled.",
        },
        tr: {
            accountNotFound: "No account found with this email. Please check your email or sign up.",
            wrongPassword: "Incorrect password. Please try again.",
            createAccount: "Hesabınızı oluşturun",
            signIn: "Hesabınıza giriş yapın",
            emailAddress: "E-posta adresi",
            emailPlaceholder: "siz@ornek.com",
            password: "Şifre",
            passwordPlaceholder: "••••••••",
            fullName: "Tam Ad",
            fullNamePlaceholder: "Ahmet Yılmaz",
            profileImage: "Profil Resmi",
            change: "Değiştir",
            signUp: "Kayıt Ol",
            signInButton: "Giriş Yap",
            orContinueWith: "Veya şununla devam edin",
            signInWithGoogle: "Google ile giriş yap",
            alreadyHaveAccount: "Zaten bir hesabınız var mı?",
            dontHaveAccount: "Hesabınız yok mu?"
        },
        ar: {
            accountNotFound: "لم يتم العثور على حساب بهذا البريد الإلكتروني. يرجى التحقق من بريدك الإلكتروني أو التسجيل.",
            wrongPassword: "كلمة المرور غير صحيحة. حاول مرة اخرى.",
            createAccount: "إنشاء حسابك",
            signIn: "تسجيل الدخول إلى حسابك",
            emailAddress: "عنوان البريد الإلكتروني",
            emailPlaceholder: "أنت@مثال.com",
            password: "كلمة المرور",
            passwordPlaceholder: "••••••••",
            fullName: "الاسم الكامل",
            fullNamePlaceholder: "محمد علي",
            profileImage: "صورة الملف الشخصي",
            change: "تغيير",
            signUp: "التسجيل",
            signInButton: "تسجيل الدخول",
            orContinueWith: "أو تابع باستخدام",
            signInWithGoogle: "تسجيل الدخول باستخدام Google",
            alreadyHaveAccount: "هل لديك حساب بالفعل؟",
            dontHaveAccount: "ليس لديك حساب؟"
        },
        de: {
            accountNotFound: "Kein Konto mit dieser E-Mail gefunden. Bitte überprüfen Sie Ihre E-Mail oder registrieren Sie sich.",
            wrongPassword: "Falsches Passwort. Bitte versuche es erneut.",
            createAccount: "Erstellen Sie Ihr Konto",
            signIn: "Melden Sie sich bei Ihrem Konto an",
            emailAddress: "E-Mail-Adresse",
            emailPlaceholder: "sie@beispiel.de",
            password: "Passwort",
            passwordPlaceholder: "••••••••",
            fullName: "Vollständiger Name",
            fullNamePlaceholder: "Max Mustermann",
            profileImage: "Profilbild",
            change: "Ändern",
            signUp: "Registrieren",
            signInButton: "Anmelden",
            orContinueWith: "Oder fortfahren mit",
            signInWithGoogle: "Mit Google anmelden",
            alreadyHaveAccount: "Haben Sie bereits ein Konto?",
            dontHaveAccount: "Sie haben noch kein Konto?"
        }
    };

    const t = translations[language];

    return (
        <>
            <AuthAlert
                message={alertMessage}
                isVisible={showAlert}
                onClose={() => setShowAlert(false)}
            />
            {isVerificationSent ? (
                <VerificationView
                    email={userEmail}
                    userCredentials={userCredentials}
                    onResend={async () => {
                        try {
                            await resendVerificationEmail(userCredentials.email, userCredentials.password);
                            setSuccess(t.emailSent);
                            setTimeout(() => setSuccess(''), 3000);
                        } catch (error) {
                            console.error('Error resending verification:', error);
                            setError(error.message || t.tooManyAttempts);
                        }
                    }}
                    success={success}
                    error={error}
                    setError={setError}
                    setSuccess={setSuccess}
                    t={t}
                    resendCooldown={resendCooldown}
                />
            ) : isForgotPassword ? (
                <ForgotPasswordForm
                    handleForgotPassword={handleForgotPassword}
                    email={email}
                    setEmail={setEmail}
                    error={error}
                    success={success}
                    isLoading={isLoading}
                    setIsForgotPassword={setIsForgotPassword}
                    t={t}
                    userType={userType}
                />
            ) : (
                <AuthForm
                    showTypeWarning={showTypeWarning}
                    setShowTypeWarning={setShowTypeWarning}
                    handleSubmit={handleSubmit}
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    name={name}
                    setName={setName}
                    profileImage={profileImage}
                    handleImageChange={handleImageChange}
                    isSignUp={isSignUp}
                    setIsSignUp={setIsSignUp}
                    error={error}
                    isLoading={isLoading}
                    handleGoogleSignIn={handleGoogleSignIn}
                    setIsForgotPassword={setIsForgotPassword}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    t={t}
                    avatars={avatars}
                    userType={userType}
                    setUserType={setUserType}
                    isCropModalOpen={isCropModalOpen}
                    setIsCropModalOpen={setIsCropModalOpen}
                    tempImage={tempImage}
                    setTempImage={setTempImage}
                    handleCroppedImage={handleCroppedImage}
                />
            )}
        </>
    );
};

export default Auth;