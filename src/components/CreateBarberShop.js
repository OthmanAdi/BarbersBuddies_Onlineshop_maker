/**
 * @fileoverview CreateBarberShop Component
 *
 * A comprehensive multi-step form for creating and configuring a barbershop.
 *
 * Key Features:
 * - Multi-step wizard interface
 * - Form state persistence
 * - Image upload and management
 * - Service configuration
 * - Business hours setup
 * - Employee management
 * - Google Business Profile integration
 * - Advanced validation
 *
 * Technical Features:
 * - Firebase integration
 * - Image processing and storage
 * - Geolocation services
 * - OAuth2 authentication
 * - Real-time updates
 * - Data synchronization
 *
 * @example
 * <CreateBarberShop />
 */

import React, {useContext, useEffect, useRef, useState} from 'react';
import {useDropzone} from 'react-dropzone';
import Swal from 'sweetalert2';
import {addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, where} from 'firebase/firestore';
import {getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {auth, db, storage} from '../firebase';
import {useLocation, useNavigate} from 'react-router-dom';
import {onAuthStateChanged} from 'firebase/auth';
import useStore from '../store';
import {nanoid} from 'nanoid';
import PresetServiceSelector from './PresetServiceSelector';
import TrialStatus from "./TrialStatus";
import LanguageContext from "./LanguageContext";
// import {PhoneInput} from "react-international-phone";
// import {handlePhoneChange} from "react-international-phone/dist/utils/handlePhoneChange";
import {Building2, Check, Clock, CreditCard, Image, Info, Lock, Scissors, Send, Store, Users2, Building, Home, MapPin} from 'lucide-react';
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import GoogleBusinessStep from "./GoogleBusinessStep";
import CustomSwal from "./CustomSwal";
import EnhancedAvailabilitySelector from './EnhancedAvailabilitySelector';
import {AnimatePresence, motion} from 'framer-motion';
import {useMediaQuery} from 'react-responsive'
import BarbershopEditor from "./BarbershopEditor";
import ShopCategorySelector from "./ShopCategorySelector";
import EmployeeManagementStep from "./EmployeeManagementStep";
import FooterPages from "./FooterPages";
import {useBarberShopPersistence} from "./useBarberShopPersistence";
import SelectedServicesGrid from "./SelectedServicesGrid";
import ImageUploadSection from "./ImageUploadSection";
import PaymentMethodsStep from "./PaymentMethodsStep";
import SuccessView from "./SuccessView";
import ShopNameValidator from "./ShopNameValidator";
import DesktopNavbar from './DesktopNavbar';
import Footer from './Footer';
import PhoneNumberAlert from "./PhoneNumberAlert";
import BeautifulLoadingScreen from "./BeautifulLoadingScreen";

const CreationSteps = ({currentStep = 1, onStepClick, isPublished = false}) => {

    const isMobile = useMediaQuery({maxWidth: 768});

    const steps = [
        {id: 1, title: 'Salon', icon: Store},
        {id: 2, title: 'Availability', icon: Clock},
        {id: 3, title: 'Images', icon: Image},
        {id: 4, title: 'Services', icon: Scissors},
        {id: 5, title: 'Team', icon: Users2},
        {id: 6, title: 'Payment', icon: CreditCard},
        {id: 7, title: 'Business', icon: Building2},
        {id: 8, title: 'Publish', icon: Send, protected: true}
    ];

    const getStepStatus = (stepId) => {
        if (stepId < currentStep) return 'completed';
        if (stepId === currentStep) return 'current';
        return 'upcoming';
    };

    const handleStepClick = (stepId, isProtected) => {
        // Prevent skipping steps forward
        if (stepId > currentStep + 1) {
            return;
        }

        // If the step is the publish step (id: 8) or business step (id: 7), prevent direct navigation
        if ((stepId === 7 || stepId === 8) && currentStep < 6) {
            return;
        }

        // Otherwise, proceed with normal navigation
        if (!isPublished) {
            onStepClick(stepId);
        }
    };

    if (isMobile) {
        const currentStepData = steps[currentStep - 1];
        const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

        return (
            <div className="w-full px-4 py-6">
                {/* Progress Bar */}
                <div className="relative h-2 mb-8 bg-base-200 rounded-full overflow-hidden">
                    <motion.div
                        className="absolute top-0 left-0 h-full bg-primary"
                        initial={{width: `${((currentStep - 2) / (steps.length - 1)) * 100}%`}}
                        animate={{width: `${progress}%`}}
                        transition={{duration: 0.5, ease: "easeInOut"}}
                    />
                    <div
                        className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                        style={{backgroundSize: '200% 100%'}}/>
                </div>

                {/* Step Counter */}
                <div className="text-sm text-base-content/60 mb-2 text-center">
                    Step {currentStep} of {steps.length}
                </div>

                {/* Current Step Display */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -20}}
                        transition={{duration: 0.3}}
                        className="flex flex-col items-center"
                    >
                        {/* Icon Circle */}
                        <motion.div
                            className={`
                                relative w-16 h-16 rounded-full mb-4
                                flex items-center justify-center
                                ${currentStepData.protected && currentStep < 6 ? 'bg-base-200' : 'bg-primary'}
                                shadow-lg
                            `}
                            initial={{scale: 0.8}}
                            animate={{scale: 1}}
                            transition={{type: "spring", stiffness: 200, damping: 15}}
                        >
                            {currentStepData.protected && currentStep < 6 ? (
                                <Lock className="w-8 h-8 text-base-content/40"/>
                            ) : (
                                <currentStepData.icon className="w-8 h-8 text-primary-content"/>
                            )}

                            {/* Pulse Effect */}
                            <div className="absolute inset-0 rounded-full animate-ping bg-primary opacity-20"/>

                            {/* Rotating Highlight */}
                            <div
                                className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-rotate"/>
                        </motion.div>

                        {/* Step Title */}
                        <motion.h3
                            className="text-xl font-semibold text-center mb-2"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            transition={{delay: 0.2}}
                        >
                            {currentStepData.title}
                        </motion.h3>

                        {/* Steps Navigation */}
                        <div className="flex justify-center space-x-2 mt-4">
                            {steps.map((step) => (
                                <motion.button
                                    key={step.id}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                        step.id === currentStep
                                            ? 'w-4 bg-primary'
                                            : step.id < currentStep
                                                ? 'bg-primary/40'
                                                : 'bg-base-300'
                                    }`}
                                    onClick={() => handleStepClick(step.id, step.protected)}
                                    whileTap={{scale: 0.9}}
                                />
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="w-full px-4 py-8">
            <div className="relative">
                {/* Progress Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2"/>
                <div
                    className="absolute top-1/2 left-0 h-1 bg-primary transition-all duration-500 -translate-y-1/2"
                    style={{width: `${(Math.max(0, currentStep - 1) / (steps.length - 1)) * 100}%`}}
                />

                {/* Steps */}
                <div className="relative flex justify-between">
                    {steps.map((step) => {
                        const status = getStepStatus(step.id);
                        const Icon = step.icon;
                        const isPublishStep = step.id === 8;  // Changed from 6 to 8
                        const isBusinessStep = step.id === 7;  // Added this check
                        const isProtectedStep = (isPublishStep || isBusinessStep) && currentStep < 6;

                        return (
                            <div
                                key={step.id}
                                className={`flex flex-col items-center ${
                                    isProtectedStep ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}
                                onClick={() => handleStepClick(step.id, step.protected)}
                            >
                                <div className={`
                  relative flex items-center justify-center w-12 h-12 rounded-full
                  transition-all duration-300
                  ${status === 'completed' ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                                    status === 'current' ? 'bg-primary text-white scale-110 shadow-xl shadow-primary/40' :
                                        isProtectedStep ? 'bg-gray-100 border-2 border-gray-300 text-gray-400' :
                                            'bg-white border-2 border-gray-200 text-gray-400'}
                  ${isPublished ? 'opacity-80' : ''}
                  ${!isProtectedStep && !isPublished ? 'hover:scale-105' : ''}
                `}>
                                    {status === 'completed' ? (
                                        <Check className="w-6 h-6 text-black z-10 relative animate-appear"/>
                                    ) : isProtectedStep ? (
                                        <Lock className="w-5 h-5"/>
                                    ) : (
                                        <Icon className={`w-6 h-6 ${
                                            status === 'current'
                                                ? 'text-black z-10 relative'
                                                : 'text-gray-400'
                                        }`}/>
                                    )}

                                    {/* Pulse Effect for Current Step */}
                                    {status === 'current' && !isProtectedStep && (
                                        <div
                                            className="absolute w-full h-full rounded-full animate-ping bg-primary opacity-20"/>
                                    )}
                                </div>

                                {/* Step Title */}
                                <span className={`
                  mt-2 text-sm font-medium transition-colors duration-300
                  ${status === 'completed' ? 'text-primary' :
                                    status === 'current' ? 'text-primary font-semibold' :
                                        isProtectedStep ? 'text-gray-400' :
                                            'text-gray-400'}
                `}>
                  {step.title}
                </span>

                                {/* Lock indicator for protected step */}
                                {isProtectedStep && (
                                    <span className="text-xs text-gray-400 mt-1">
                    Complete previous steps first
                  </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <style jsx>{`
                @keyframes appear {
                    from {
                        transform: scale(0);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @keyframes bounce-subtle {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-2px);
                    }
                }

                .animate-appear {
                    animation: appear 0.3s ease-out;
                }

                .animate-bounce-subtle {
                    animation: bounce-subtle 2s infinite;
                }
            `}</style>
        </div>
    );
};

const BARBERSHOP_TEMPLATES = [
    {
        title: 'Professional Barbershop',
        description: 'A clean, professional template',
        content: `<div class="shop-description">
      <h2>Welcome to [Your Shop Name]</h2>
      <p>With [X] years of experience in the art of barbering, we take pride in delivering exceptional grooming services to our clients.</p>
      <h3>Our Expertise</h3>
      <ul>
        <li>Classic and modern haircuts</li>
        <li>Precise beard trimming and styling</li>
        <li>Hot towel shaves</li>
        <li>Hair styling and treatments</li>
      </ul>
      <h3>Why Choose Us?</h3>
      <ul>
        <li>Experienced and skilled barbers</li>
        <li>Clean and modern facility</li>
        <li>Relaxed, friendly atmosphere</li>
        <li>Attention to detail</li>
      </ul>
      <p>Visit us today for a premium grooming experience!</p>
    </div>`
    },
    {
        title: 'Traditional Barbershop',
        description: 'A classic, traditional style',
        content: `<div class="shop-description">
      <h2>Traditional Craftsmanship at [Your Shop Name]</h2>
      <p>Step into a world where traditional barbering meets modern style. Our classic barbershop brings timeless grooming techniques to the modern gentleman.</p>
      <h3>Our Services</h3>
      <ul>
        <li>Traditional hot towel shaves</li>
        <li>Classic gentleman's haircuts</li>
        <li>Father & son haircuts</li>
        <li>Beard grooming</li>
      </ul>
      <h3>The Experience</h3>
      <ul>
        <li>Old-school barbershop atmosphere</li>
        <li>Traditional techniques</li>
        <li>Quality grooming products</li>
        <li>Experienced barbers</li>
      </ul>
      <p>Experience the art of traditional barbering!</p>
    </div>`
    },
    {
        title: 'Modern Style Studio',
        description: 'A contemporary, trendy approach',
        content: `<div class="shop-description">
      <h2>[Your Shop Name] - Modern Style Studio</h2>
      <p>We're not just a barbershop - we're a modern grooming destination where style meets precision.</p>
      <h3>Signature Services</h3>
      <ul>
        <li>Contemporary fade techniques</li>
        <li>Modern beard design</li>
        <li>Hair color and highlights</li>
        <li>Skin fade specialists</li>
      </ul>
      <h3>The Experience</h3>
      <ul>
        <li>Trendsetting styles</li>
        <li>Premium products</li>
        <li>Skilled style consultants</li>
        <li>Modern atmosphere</li>
      </ul>
      <p>Transform your look with us!</p>
    </div>`
    }
];


const CUSTOM_STYLES = `
  .shop-description {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #333;
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
  }
  .shop-description li {
    margin-bottom: 8px;
  }
  .shop-description p {
    margin-bottom: 16px;
  }
`;

const CreateBarberShop = () => {
    const {language} = useContext(LanguageContext);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const [shopName, setShopName] = useState('');
    const [address, setAddress] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuggestionSelected, setIsSuggestionSelected] = useState(false);
    const [images, setImages] = useState([]);
    const [services, setServices] = useState([{name: '', price: '', duration: ''}]);
    const [currentStep, setCurrentStep] = useState(1);
    const editorRef = useRef(null);
    const setUserShops = useStore(state => state.setUserShops);
    const userShops = useStore(state => state.userShops);
    // const [phoneNumber, setPhoneNumber] = useState('');
    // const [countryCode, setCountryCode] = useState('+90');
    const [email, setEmail] = useState(auth.currentUser?.email || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const location = useLocation();
    const [isPublished, setIsPublished] = useState(false);
    const [trialStatus, setTrialStatus] = useState(null);

    useEffect(() => {
        const fetchUserPhone = async () => {
            if (auth.currentUser?.uid) {
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDoc.exists() && userDoc.data().phoneNumber) {
                    // Strip '+' prefix if present for phone input component
                    const rawNumber = userDoc.data().phoneNumber.replace('+', '');
                    setPhoneNumber(rawNumber);
                }
            }
        };

        fetchUserPhone();
    }, []);

    const [paymentMethods, setPaymentMethods] = useState([]);

    // const [phoneNumber, setPhoneNumber] = useState(() => {
    //     // Fetch the phone number from the current user's data in Firestore
    //     const docRef = doc(db, 'users', auth.currentUser?.uid);
    //     getDoc(docRef).then(docSnap => {
    //         if (docSnap.exists() && docSnap.data().phoneNumber) {
    //             setPhoneNumber(docSnap.data().phoneNumber);
    //         }
    //     });
    //     return '';
    // });

    const [phoneNumber, setPhoneNumber] = useState('');

    useEffect(() => {
        console.log('Phone number changed:', phoneNumber);
    }, [phoneNumber]);

    const [editorKey, setEditorKey] = useState(0);
    const [editorContent, setEditorContent] = useState('');
    const [specialDates, setSpecialDates] = useState({});
    const [isAddingCustomAddress, setIsAddingCustomAddress] = useState(false);
    const addressInputRef = useRef(null);
    const [categories, setCategories] = useState([]);
    const [formTouched, setFormTouched] = useState(false);
    const [tempShopId, setTempShopId] = useState(null);
    const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);

    const [slotDuration, setSlotDuration] = useState(30);

    const MAPBOX_TOKEN = 'pk.eyJ1Ijoib3RobWFuYWRpYmVyc2hvcCIsImEiOiJjbHk5NTR1aWgwZW0yMm5xdzE2dmliZWZvIn0.XS8JZjdd1O8YIs_VXuUcPA';

    const [hideUI, setHideUI] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    const [isImageUploading, setIsImageUploading] = useState(false);

    const [shopNameStatus, setShopNameStatus] = useState({
        isChecking: false,
        isAvailable: null,
        suggestions: [],
        similar: []
    });

    useEffect(() => {
        if (currentStep === 7) {
            setTimeout(() => {
                setFadeOut(true);
                setTimeout(() => {
                    setHideUI(true);
                }, 300);
            }, 3000);
        }
    }, [currentStep]);

    // const shopNameCheckTimeout = useRef(null);
    //
    const handleShopNameChange = (e) => {
        const newName = e.target.value;
        setShopName(newName);
        setFormTouched(true);
        setShopNameStatus({
            isChecking: false,
            isAvailable: null,
            suggestions: [],
            similar: []
        });

        // if (shopNameCheckTimeout.current) {
        //     clearTimeout(shopNameCheckTimeout.current);
        // }
        //
        // shopNameCheckTimeout.current = setTimeout(() => {
        //     checkShopName(newName);
        // }, 500);
    };

    // Modify checkShopName to return the validation result
    // const checkShopName = async (name) => {
    //     if (!name.trim()) {
    //         setShopNameStatus({
    //             isChecking: false,
    //             isAvailable: null,
    //             suggestions: [],
    //             similar: []
    //         });
    //         return false;
    //     }
    //
    //     setShopNameStatus(prev => ({...prev, isChecking: true}));
    //
    //     try {
    //         // Create a search-friendly version of the name
    //         const nameSearch = name.toLowerCase().trim();
    //
    //         // Check exact matches in shopNames collection
    //         const exactQuery = query(
    //             collection(db, 'shopNames'),
    //             where('nameSearch', '==', nameSearch)
    //         );
    //
    //         // Check similar names
    //         const similarQuery = query(
    //             collection(db, 'shopNames'),
    //             orderBy('nameSearch'),
    //             where('nameSearch', '>=', nameSearch),
    //             where('nameSearch', '<=', nameSearch + '\uf8ff'),
    //             limit(5)
    //         );
    //
    //         const [exactMatch, similarMatches] = await Promise.all([
    //             getDocs(exactQuery),
    //             getDocs(similarQuery)
    //         ]);
    //
    //         const isAvailable = exactMatch.empty;
    //         const similarShops = similarMatches.docs.map(doc => doc.data().name);
    //
    //         // Generate alternative suggestions if name is taken
    //         let suggestions = [];
    //         if (!isAvailable) {
    //             suggestions = generateNameSuggestions(name);
    //
    //             // Filter out suggestions that might already exist
    //             const suggestionChecks = await Promise.all(
    //                 suggestions.map(async (suggestion) => {
    //                     const suggestionQuery = query(
    //                         collection(db, 'shopNames'),
    //                         where('nameSearch', '==', suggestion.toLowerCase().trim())
    //                     );
    //                     const suggestionDoc = await getDocs(suggestionQuery);
    //                     return {suggestion, exists: !suggestionDoc.empty};
    //                 })
    //             );
    //
    //             suggestions = suggestionChecks
    //                 .filter(result => !result.exists)
    //                 .map(result => result.suggestion);
    //         }
    //
    //         setShopNameStatus({
    //             isChecking: false,
    //             isAvailable,
    //             suggestions,
    //             similar: similarShops
    //         });
    //
    //         return isAvailable; // Return the validation result
    //
    //     } catch (error) {
    //         console.error('Error checking shop name:', error);
    //         setShopNameStatus({
    //             isChecking: false,
    //             isAvailable: null,
    //             suggestions: [],
    //             similar: []
    //         });
    //         return false;
    //     }
    // };

    /**
     * Generates intelligent name suggestions for barbershops using NLP-inspired techniques
     * Employs semantic analysis patterns and common business naming conventions
     *
     * @param {string} name - Base name to generate suggestions from
     * @returns {string[]} Array of unique name suggestions
     */
    // const generateNameSuggestions = (name) => {
    //     // Normalize and sanitize input
    //     const base = name.trim().replace(/\s+/g, ' ');
    //     const tokens = base.split(' ');
    //
    //     const suggestions = new Set();
    //
    //     // Business entity patterns
    //     const entities = ['Barbershop', 'Barbers', 'Grooming', 'Salon'];
    //     entities.forEach(entity => suggestions.add(`${base} ${entity}`));
    //
    //     // Semantic modifiers for brand positioning
    //     const modifiers = {
    //         premium: ['Elite', 'Prime', 'Select', 'Luxury'],
    //         traditional: ['Classic', 'Heritage', 'Traditional', 'Authentic'],
    //         modern: ['Modern', 'Urban', 'Contemporary', 'Fresh'],
    //         professional: ['Pro', 'Expert', 'Master', 'Skilled']
    //     };
    //
    //     // Generate positional variants
    //     Object.values(modifiers).flat().forEach(mod => {
    //         suggestions.add(`${mod} ${base}`);
    //         suggestions.add(`${base} ${mod}`);
    //     });
    //
    //     // Business structure patterns
    //     const structures = ['& Co', '& Sons', 'Bros', 'House of'];
    //     structures.forEach(struct => suggestions.add(`${base} ${struct}`));
    //
    //     // Numeric differentiators (limit to avoid confusion)
    //     for (let i = 2; i <= 3; i++) {
    //         suggestions.add(`${base} ${i}`);
    //     }
    //
    //     // Location/Geographic patterns
    //     const locations = ['Corner', 'Square', 'Street', 'Boulevard'];
    //     locations.forEach(loc => suggestions.add(`${base} ${loc}`));
    //
    //     // Article prefixing (The/A) with semantic validation
    //     if (!base.toLowerCase().startsWith('the ')) {
    //         suggestions.add(`The ${base}`);
    //     }
    //
    //     // Filter suggestions
    //     return Array.from(suggestions)
    //         .filter(suggestion =>
    //             suggestion.length <= 30 && // Practical length limit
    //             suggestion.split(' ').length <= 4 // Cognitive load limit
    //         )
    //         .sort((a, b) =>
    //             // Prioritize simpler names
    //             (a.split(' ').length - b.split(' ').length) ||
    //             (a.length - b.length)
    //         )
    //         .slice(0, 12); // Limit total suggestions to prevent choice paralysis
    // };

    const handleAddressChange = (e) => {
        setAddress(e.target.value);
        setFormTouched(true);
        setIsSuggestionSelected(false);
        setIsAddingCustomAddress(false);
    };

    // const handlePhoneChange = (value) => {
    //     setPhoneNumber(value);
    //     setFormTouched(true);
    // };

    // const handleEmailChange = (e) => {
    //     setEmail(e.target.value);
    //     setFormTouched(true);
    // };

    const handleEditorChange = (content) => {
        setEditorContent(content);
        setFormTouched(true);
    };

    const [availability, setAvailability] = useState({
        Monday: null,
        Tuesday: null,
        Wednesday: null,
        Thursday: null,
        Friday: null,
        Saturday: null,
        Sunday: null
    });

    const {
        persistedData,
        saveData,
        isLoading: isDraftLoading,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        clearDraft,
        initialFormState
    } = useBarberShopPersistence(user?.uid, language);

    useEffect(() => {
        if (persistedData?.shopData) {
            console.log('Loading persisted data:', persistedData);
            // Check other setters here
        }
    }, [persistedData]);

    const [isPhoneLoaded, setIsPhoneLoaded] = useState(false);

    useEffect(() => {
        const fetchUserPhone = async () => {
            if (auth.currentUser?.uid && isFirebaseInitialized) {
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDoc.exists() && userDoc.data().phoneNumber) {
                    const rawNumber = userDoc.data().phoneNumber.replace('+', '');
                    setPhoneNumber(rawNumber);
                    setIsPhoneLoaded(true); // Add this
                }
            }
        };

        fetchUserPhone();
    }, [isFirebaseInitialized]);

    const [isBusinessStepCompleted, setIsBusinessStepCompleted] = useState(false);

    useEffect(() => {
        setEditorKey(prev => prev + 1);
    }, [language]);

    const {getRootProps, getInputProps} = useDropzone({
        accept: 'image/*',
        onDrop: (acceptedFiles) => {
            setImages([...images, ...acceptedFiles.map(file => Object.assign(file, {
                preview: URL.createObjectURL(file)
            }))]);
        }
    });

    // Initialize state from persisted data
    useEffect(() => {
        const loadPersistedData = async () => {
            if (persistedData?.shopData && !isPublished && isPhoneLoaded) {
                const shopName = persistedData.shopData?.name || '';
                // if (shopName) {
                //     const isNameValid = await checkShopName(shopName);
                //     if (isNameValid) {
                //         setShopName(shopName);
                //     }
                // }

                // Load all other persisted data regardless of name validation
                setAddress(persistedData.shopData?.address || '');
                setPhoneNumber(persistedData.shopData?.phoneNumber || phoneNumber);
                setEmail(persistedData.shopData?.email || auth.currentUser?.email || '');
                setEditorContent(persistedData.shopData?.description || '');
                setServices(persistedData.shopData?.services || [{name: '', price: '', duration: ''}]);
                setCurrentStep(persistedData?.currentStep || 1);
                setImages(persistedData.shopData?.images || []);
                setAvailability(persistedData.shopData?.availability || {});
                setSpecialDates(persistedData.shopData?.specialDates || {});
                setCategories(persistedData.shopData?.categories || []);
            }
        };

        loadPersistedData();
    }, [persistedData, isPublished, isPhoneLoaded, phoneNumber]);

    // Save form data when it changes
    useEffect(() => {
        if (!isPublished && formTouched) {
            const formData = {
                currentStep,
                shopData: {
                    name: shopNameStatus.isAvailable === true ? shopName : '',
                    address,
                    phoneNumber,
                    email,
                    description: editorContent,
                    services,
                    availability,
                    images,
                    specialDates,
                    categories,
                    pricingTier: calculatePricingTier(services)
                },
                shopNameStatus,
                isPublished: false
            };
            saveData(formData);
        }
    }, [
        shopName,
        address,
        phoneNumber,
        email,
        editorContent,
        services,
        availability,
        images,
        specialDates,
        categories,
        currentStep,
        formTouched
    ]);

    useEffect(() => {
        const checkTrialStatus = async () => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const userData = userDoc.data();
                    if (userData) {
                        const now = new Date();
                        const trialEndDate = userData.trialEndDate.toDate();
                        const isSubscribed = userData.isSubscribed;

                        if (isSubscribed) {
                            setTrialStatus('subscribed');
                        } else if (now < trialEndDate) {
                            setTrialStatus('active');
                        } else {
                            setTrialStatus('expired');
                        }
                    }
                } catch (error) {
                    console.error('Error checking trial status:', error);
                }
            }
        };

        checkTrialStatus();
    }, [user]);

    useEffect(() => {
        // Reset form when navigating to this component
        if (location.pathname === '/create-shop') {
            resetForm();
        }
    }, [location]);

    useEffect(() => {
        let timeoutId;
        if (address.length > 3 && !isSuggestionSelected) {
            setIsLoadingSuggestions(true);
            timeoutId = setTimeout(() => {
                fetchAddressSuggestions(address);
            }, 500); // Increased debounce time
        } else {
            setAddressSuggestions([]);
        }

        return () => clearTimeout(timeoutId);
    }, [address, isSuggestionSelected]);

    const fetchAddressSuggestions = async (input) => {
        try {
            setIsLoadingSuggestions(true);

            // Get user's location for contextual results (if available)
            let userLocation = "";
            if (navigator.geolocation) {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 3000});
                }).catch(() => null);

                if (position) {
                    userLocation = `&lon=${position.coords.longitude}&lat=${position.coords.latitude}`;
                }
            }

            // Enhanced API call with additional parameters
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `q=${encodeURIComponent(input)}` +
                `&format=json` +
                `&addressdetails=1` +
                `&limit=5` +
                `&countrycodes=de,tr` + // Limit to specific countries
                `${userLocation}` +      // Prioritize results near user
                `&extratags=1` +         // Get additional tags like opening hours
                `&namedetails=1` +       // Get alternative names
                `&featuretype=building`, // Focus on buildings rather than roads
                {
                    headers: {
                        'Accept-Language': language,
                        'User-Agent': 'BarbersBuddies/1.0' // Recommended by OSM
                    }
                }
            );

            const data = await response.json();

            // Enhanced result processing
            const enhancedSuggestions = data.map(item => ({
                display_name: item.display_name,
                full_address: item.display_name,
                street: item.address.road || item.address.street || '',
                city: item.address.city || item.address.town || item.address.village || '',
                postcode: item.address.postcode || '',
                country: item.address.country || '',
                latitude: item.lat,
                longitude: item.lon,
                type: item.type,
                icon: getAddressTypeIcon(item.type)
            }));

            setAddressSuggestions(enhancedSuggestions);
        } catch (error) {
            console.error('Error fetching address suggestions:', error);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

// Helper to determine icon based on address type
    const getAddressTypeIcon = (type) => {
        switch (type) {
            case 'building': return <Building className="w-4 h-4" />;
            case 'amenity': return <Store className="w-4 h-4" />;
            case 'house': return <Home className="w-4 h-4" />;
            default: return <MapPin className="w-4 h-4" />;
        }
    };

    const calculatePricingTier = (services) => {
        const totalPricing = services.reduce((sum, service) =>
            sum + parseInt(service.price || 0, 10), 0);

        if (totalPricing <= 100) return '€';
        if (totalPricing <= 200) return '€€';
        return '€€€';
    };

    useEffect(() => {
        setShopData({
            name: shopName,
            address: address,
            phoneNumber: phoneNumber,
            email: email,
            description: editorContent,
            services: services,
            availability: availability,
            images: images,
            specialDates: specialDates,
            categories: categories,
            pricingTier: calculatePricingTier(services),
            paymentMethods: paymentMethods
        });
    }, [
        shopName,
        address,
        phoneNumber,
        email,
        editorContent,
        services,
        availability,
        images,
        specialDates,
        categories,
        paymentMethods
    ]);

    useEffect(() => {
        const checkUserPhone = async () => {
            if (isFirebaseInitialized && auth.currentUser?.uid) {
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDoc.exists() && !userDoc.data().phoneNumber) {
                    setTimeout(() => {
                        setShowPhoneAlert(true);
                    }, 1000);
                }
            }
        };
        checkUserPhone();
    }, [isFirebaseInitialized]);

    const [showPhoneAlert, setShowPhoneAlert] = useState(false);

    const [shopData, setShopData] = useState({
        name: '',
        address: '',
        phoneNumber: '',
        email: auth.currentUser?.email || '',
        description: '',
        services: [],
        availability: {},
        images: [],
        specialDates: {},
        categories: [],
        pricingTier: '€',
        paymentMethods: []
    });

    const resetForm = () => {
        setShopName('');
        setAddress('');
        setAddressSuggestions([]);
        setIsSuggestionSelected(false);
        setImages([]);
        setServices([{name: '', price: ''}]);
        setCurrentStep(1);
        setPhoneNumber('');
        setEmail('');
        setIsSubmitting(false);
        setIsPublished(false);
        if (editorRef.current) {
            editorRef.current.setContent('');
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setEmail(currentUser.email);
                setIsFirebaseInitialized(true);
            } else {
                navigate('/auth');
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    if (!isFirebaseInitialized) {
        return <BeautifulLoadingScreen language={language} />;
    }

    if (trialStatus === 'expired') {
        return (
            <div className="container mx-auto mt-10">
                <h1 className="text-2xl font-bold mb-4">Create Your Barber Shop</h1>
                <TrialStatus/>
                <p className="mt-4">Your trial has expired. Please subscribe to create a barber shop.</p>
                <button
                    onClick={() => navigate('/subscribe')}
                    className="mt-4 bg-blue-500 text-white p-2 rounded"
                >
                    Subscribe Now
                </button>
            </div>
        );
    }


    const handleServiceChange = (index, field, value) => {
        setFormTouched(true);
        const updatedServices = services.map((service, i) => {
            if (i === index) {
                if (field === 'price') {
                    // Only allow numbers for price
                    value = value.replace(/[^0-9]/g, '');
                }
                if (field === 'duration') {
                    // Only allow numbers between 0-999
                    value = value.replace(/[^0-9]/g, '').slice(0, 3);
                }
                return {...service, [field]: value};
            }
            return service;
        });
        setServices(updatedServices);
    };

    // const handlePhoneChange = (value) => {
    //     setPhoneNumber(value);
    // };

    // const countryCodes = [
    //     {code: '+93', country: 'AF'}, {code: '+355', country: 'AL'}, {code: '+213', country: 'DZ'},
    //     {code: '+1684', country: 'AS'}, {code: '+376', country: 'AD'}, {code: '+244', country: 'AO'},
    //     {code: '+1264', country: 'AI'}, {code: '+672', country: 'AQ'}, {code: '+1268', country: 'AG'},
    //     {code: '+54', country: 'AR'}, {code: '+374', country: 'AM'}, {code: '+297', country: 'AW'},
    //     {code: '+61', country: 'AU'}, {code: '+43', country: 'AT'}, {code: '+994', country: 'AZ'},
    //     {code: '+1242', country: 'BS'}, {code: '+973', country: 'BH'}, {code: '+880', country: 'BD'},
    //     {code: '+1246', country: 'BB'}, {code: '+375', country: 'BY'}, {code: '+32', country: 'BE'},
    //     {code: '+501', country: 'BZ'}, {code: '+229', country: 'BJ'}, {code: '+1441', country: 'BM'},
    //     {code: '+975', country: 'BT'}, {code: '+591', country: 'BO'}, {code: '+387', country: 'BA'},
    //     {code: '+267', country: 'BW'}, {code: '+55', country: 'BR'}, {code: '+246', country: 'IO'},
    //     {code: '+1284', country: 'VG'}, {code: '+673', country: 'BN'}, {code: '+359', country: 'BG'},
    //     {code: '+226', country: 'BF'}, {code: '+257', country: 'BI'}, {code: '+855', country: 'KH'},
    //     {code: '+237', country: 'CM'}, {code: '+1', country: 'CA'}, {code: '+238', country: 'CV'},
    //     {code: '+1345', country: 'KY'}, {code: '+236', country: 'CF'}, {code: '+235', country: 'TD'},
    //     {code: '+56', country: 'CL'}, {code: '+86', country: 'CN'}, {code: '+61', country: 'CX'},
    //     {code: '+61', country: 'CC'}, {code: '+57', country: 'CO'}, {code: '+269', country: 'KM'},
    //     {code: '+242', country: 'CG'}, {code: '+243', country: 'CD'}, {code: '+682', country: 'CK'},
    //     {code: '+506', country: 'CR'}, {code: '+385', country: 'HR'}, {code: '+53', country: 'CU'},
    //     {code: '+599', country: 'CW'}, {code: '+357', country: 'CY'}, {code: '+420', country: 'CZ'},
    //     {code: '+45', country: 'DK'}, {code: '+253', country: 'DJ'}, {code: '+1767', country: 'DM'},
    //     {code: '+1849', country: 'DO'}, {code: '+593', country: 'EC'}, {code: '+20', country: 'EG'},
    //     {code: '+503', country: 'SV'}, {code: '+240', country: 'GQ'}, {code: '+291', country: 'ER'},
    //     {code: '+372', country: 'EE'}, {code: '+251', country: 'ET'}, {code: '+500', country: 'FK'},
    //     {code: '+298', country: 'FO'}, {code: '+679', country: 'FJ'}, {code: '+358', country: 'FI'},
    //     {code: '+33', country: 'FR'}, {code: '+594', country: 'GF'}, {code: '+689', country: 'PF'},
    //     {code: '+241', country: 'GA'}, {code: '+220', country: 'GM'}, {code: '+995', country: 'GE'},
    //     {code: '+49', country: 'DE'}, {code: '+233', country: 'GH'}, {code: '+350', country: 'GI'},
    //     {code: '+30', country: 'GR'}, {code: '+299', country: 'GL'}, {code: '+1473', country: 'GD'},
    //     {code: '+590', country: 'GP'}, {code: '+1671', country: 'GU'}, {code: '+502', country: 'GT'},
    //     {code: '+44', country: 'GG'}, {code: '+224', country: 'GN'}, {code: '+245', country: 'GW'},
    //     {code: '+592', country: 'GY'}, {code: '+509', country: 'HT'}, {code: '+504', country: 'HN'},
    //     {code: '+852', country: 'HK'}, {code: '+36', country: 'HU'}, {code: '+354', country: 'IS'},
    //     {code: '+91', country: 'IN'}, {code: '+62', country: 'ID'}, {code: '+98', country: 'IR'},
    //     {code: '+964', country: 'IQ'}, {code: '+353', country: 'IE'}, {code: '+44', country: 'IM'},
    //     {code: '+972', country: 'IL'}, {code: '+39', country: 'IT'}, {code: '+225', country: 'CI'},
    //     {code: '+1876', country: 'JM'}, {code: '+81', country: 'JP'}, {code: '+44', country: 'JE'},
    //     {code: '+962', country: 'JO'}, {code: '+7', country: 'KZ'}, {code: '+254', country: 'KE'},
    //     {code: '+686', country: 'KI'}, {code: '+383', country: 'XK'}, {code: '+965', country: 'KW'},
    //     {code: '+996', country: 'KG'}, {code: '+856', country: 'LA'}, {code: '+371', country: 'LV'},
    //     {code: '+961', country: 'LB'}, {code: '+266', country: 'LS'}, {code: '+231', country: 'LR'},
    //     {code: '+218', country: 'LY'}, {code: '+423', country: 'LI'}, {code: '+370', country: 'LT'},
    //     {code: '+352', country: 'LU'}, {code: '+853', country: 'MO'}, {code: '+389', country: 'MK'},
    //     {code: '+261', country: 'MG'}, {code: '+265', country: 'MW'}, {code: '+60', country: 'MY'},
    //     {code: '+960', country: 'MV'}, {code: '+223', country: 'ML'}, {code: '+356', country: 'MT'},
    //     {code: '+692', country: 'MH'}, {code: '+596', country: 'MQ'}, {code: '+222', country: 'MR'},
    //     {code: '+230', country: 'MU'}, {code: '+262', country: 'YT'}, {code: '+52', country: 'MX'},
    //     {code: '+691', country: 'FM'}, {code: '+373', country: 'MD'}, {code: '+377', country: 'MC'},
    //     {code: '+976', country: 'MN'}, {code: '+382', country: 'ME'}, {code: '+1664', country: 'MS'},
    //     {code: '+212', country: 'MA'}, {code: '+258', country: 'MZ'}, {code: '+95', country: 'MM'},
    //     {code: '+264', country: 'NA'}, {code: '+674', country: 'NR'}, {code: '+977', country: 'NP'},
    //     {code: '+31', country: 'NL'}, {code: '+687', country: 'NC'}, {code: '+64', country: 'NZ'},
    //     {code: '+505', country: 'NI'}, {code: '+227', country: 'NE'}, {code: '+234', country: 'NG'},
    //     {code: '+683', country: 'NU'}, {code: '+672', country: 'NF'}, {code: '+850', country: 'KP'},
    //     {code: '+1670', country: 'MP'}, {code: '+47', country: 'NO'}, {code: '+968', country: 'OM'},
    //     {code: '+92', country: 'PK'}, {code: '+680', country: 'PW'}, {code: '+970', country: 'PS'},
    //     {code: '+507', country: 'PA'}, {code: '+675', country: 'PG'}, {code: '+595', country: 'PY'},
    //     {code: '+51', country: 'PE'}, {code: '+63', country: 'PH'}, {code: '+48', country: 'PL'},
    //     {code: '+351', country: 'PT'}, {code: '+1', country: 'PR'}, {code: '+974', country: 'QA'},
    //     {code: '+262', country: 'RE'}, {code: '+40', country: 'RO'}, {code: '+7', country: 'RU'},
    //     {code: '+250', country: 'RW'}, {code: '+590', country: 'BL'}, {code: '+290', country: 'SH'},
    //     {code: '+1869', country: 'KN'}, {code: '+1758', country: 'LC'}, {code: '+590', country: 'MF'},
    //     {code: '+508', country: 'PM'}, {code: '+1784', country: 'VC'}, {code: '+685', country: 'WS'},
    //     {code: '+378', country: 'SM'}, {code: '+239', country: 'ST'}, {code: '+966', country: 'SA'},
    //     {code: '+221', country: 'SN'}, {code: '+381', country: 'RS'}, {code: '+248', country: 'SC'},
    //     {code: '+232', country: 'SL'}, {code: '+65', country: 'SG'}, {code: '+1721', country: 'SX'},
    //     {code: '+421', country: 'SK'}, {code: '+386', country: 'SI'}, {code: '+677', country: 'SB'},
    //     {code: '+252', country: 'SO'}, {code: '+27', country: 'ZA'}, {code: '+82', country: 'KR'},
    //     {code: '+211', country: 'SS'}, {code: '+34', country: 'ES'}, {code: '+94', country: 'LK'},
    //     {code: '+249', country: 'SD'}, {code: '+597', country: 'SR'}, {code: '+47', country: 'SJ'},
    //     {code: '+268', country: 'SZ'}, {code: '+46', country: 'SE'}, {code: '+41', country: 'CH'},
    //     {code: '+963', country: 'SY'}, {code: '+886', country: 'TW'}, {code: '+992', country: 'TJ'},
    //     {code: '+255', country: 'TZ'}, {code: '+66', country: 'TH'}, {code: '+670', country: 'TL'},
    //     {code: '+228', country: 'TG'}, {code: '+690', country: 'TK'}, {code: '+676', country: 'TO'},
    //     {code: '+1868', country: 'TT'}, {code: '+216', country: 'TN'}, {code: '+90', country: 'TR'},
    //     {code: '+993', country: 'TM'}, {code: '+1649', country: 'TC'}, {code: '+688', country: 'TV'},
    //     {code: '+1340', country: 'VI'}, {code: '+256', country: 'UG'}, {code: '+380', country: 'UA'},
    //     {code: '+971', country: 'AE'}, {code: '+44', country: 'GB'}, {code: '+1', country: 'US'},
    //     {code: '+598', country: 'UY'}, {code: '+998', country: 'UZ'}, {code: '+678', country: 'VU'},
    //     {code: '+379', country: 'VA'}, {code: '+58', country: 'VE'}, {code: '+84', country: 'VN'},
    //     {code: '+681', country: 'WF'}, {code: '+212', country: 'EH'}, {code: '+967', country: 'YE'},
    //     {code: '+260', country: 'ZM'}, {code: '+263', country: 'ZW'}
    // ];

    const phoneInputStyle = {
        width: '100%',
        height: '2.5rem',
        fontSize: '1rem',
        borderRadius: '0.375rem',
        border: '1px solid rgb(209, 213, 219)',
        padding: '0.5rem 0.75rem',
        paddingLeft: '60px', // Make room for the flag
    }

    const addService = () => {
        setServices([...services, {name: '', price: '', duration: ''}]);
    };

    const removeService = (index) => {
        setServices(services.filter((_, i) => i !== index));
    };

    const handlePresetServiceSelect = (presetService, isUpdate = false) => {
        // First, strip out any non-serializable data
        const cleanService = {
            name: presetService.name,
            price: presetService.price,
            duration: presetService.duration,
            description: presetService.description || '',
            images: presetService.images || [],
            imageUrls: presetService.imageUrls || []
        };

        if (isUpdate) {
            setServices(prevServices => prevServices.map(service =>
                service.name === cleanService.name ? {...service, ...cleanService} : service
            ));
            return;
        }

        const existingServiceIndex = services.findIndex(service =>
            service.name === cleanService.name &&
            service.price === cleanService.price
        );

        if (existingServiceIndex >= 0) {
            setServices(prevServices => prevServices.filter((_, index) => index !== existingServiceIndex));
        } else {
            // Find if there's any existing service with same name (from previous selection)
            const existingService = services.find(service => service.name === cleanService.name);

            setServices(prevServices => [...prevServices, {
                ...cleanService,
                description: existingService?.description || cleanService.description || '',
                images: existingService?.images || [],
                imageUrls: existingService?.imageUrls || []
            }]);
        }
    };

    const validateStep = (step) => {
        switch (step) {
            case 1:
                if (shopNameStatus.isAvailable === false || shopNameStatus.isChecking) {
                    CustomSwal.fire({
                        title: 'Invalid Shop Name',
                        text: 'Please choose a different shop name that is not already taken.',
                        icon: 'error',
                        confirmButtonText: 'OK'
                    });
                    return false;
                }

                if (!shopName.trim() || !address.trim() || !phoneNumber.trim() || !email.trim() || !editorContent.trim() || !categories.length) {
                    CustomSwal.fire({
                        title: 'Missing Information',
                        text: language === 'tr' ? 'Lütfen tüm zorunlu alanları doldurun: Dükkan Adı, Adres, Telefon Numarası, E-posta ve Açıklama.' :
                            language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة: اسم المتجر، العنوان، رقم الهاتف، البريد الإلكتروني والوصف.' :
                                language === 'de' ? 'Bitte füllen Sie alle Pflichtfelder aus: Geschäftsname, Adresse, Telefonnummer, E-Mail und Beschreibung.' :
                                    'Please fill in all required fields: Shop Name, Address, Phone Number, Email, and Description.',
                        icon: 'info',
                        confirmButtonText: language === 'tr' ? 'Tamam' :
                            language === 'ar' ? 'حسناً' :
                                language === 'de' ? 'OK' : 'OK'
                    });

                    // Highlight empty fields for better UX
                    if (!shopName.trim()) document.getElementById('shopName')?.classList.add('input-error');
                    if (!address.trim()) document.getElementById('address')?.classList.add('input-error');
                    if (!phoneNumber.trim()) document.querySelector('.react-phone-input-2')?.classList.add('error');
                    if (!email.trim()) document.getElementById('email')?.classList.add('input-error');
                    if (!editorContent.trim()) document.querySelector('.tox-tinymce')?.classList.add('border-error');

                    // Remove error highlights after 3 seconds
                    setTimeout(() => {
                        document.querySelectorAll('.input-error, .error').forEach(el => {
                            el.classList.remove('input-error', 'error');
                        });
                        document.querySelector('.tox-tinymce')?.classList.remove('border-error');
                    }, 3000);

                    return false;
                }
                return true;
            case 2:
                if (Object.values(availability).every(day => day === null)) {
                    Swal.fire({
                        title: 'Store Hours Required',
                        text: 'Please set your store hours for at least one day of the week.',
                        icon: 'info',
                        confirmButtonText: 'OK'
                    });
                    return false;
                }
                return true;
            case 3:
                if (images.length === 0) {
                    Swal.fire({
                        title: 'No Images Uploaded',
                        text: 'Adding photos of your shop can attract more customers. Would you like to continue without images?',
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Continue without images',
                        cancelButtonText: 'I\'ll add images'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            setCurrentStep(4);
                        }
                    });
                    return false;
                }
                return true;
            case 4:
                const servicesWithoutDuration = services.filter(service =>
                    service.name.trim() && service.price.trim() && !service.duration
                );

                if (servicesWithoutDuration.length > 0) {
                    // Show warning for services without duration
                    const invalidServices = servicesWithoutDuration.map(service => service.name).join(", ");

                    Swal.fire({
                        title: 'Missing Duration',
                        html: `
                        <div class="animate-pulse">
                            <p class="mb-2">Please set a duration for the following services:</p>
                            <p class="font-semibold text-primary">${invalidServices}</p>
                        </div>
                    `,
                        icon: 'warning',
                        showConfirmButton: true,
                        confirmButtonText: 'OK',
                        customClass: {
                            popup: 'animate__animated animate__fadeIn'
                        }
                    });

                    // Highlight the services that need duration
                    const updatedServices = services.map(service => ({
                        ...service,
                        showDurationWarning: service.name.trim() && service.price.trim() && !service.duration
                    }));
                    setServices(updatedServices);

                    return false;
                }

                const validServices = services.filter(service =>
                    service.name.trim() &&
                    service.price.trim() &&
                    service.duration
                );

                if (validServices.length === 0) {
                    Swal.fire({
                        title: 'No Services Added',
                        text: 'Please add at least one service with name, price, and duration.',
                        icon: 'info',
                        confirmButtonText: 'OK'
                    });
                    return false;
                }

                setServices(validServices);
                return true;

            case 6:
                if (paymentMethods.length === 0) {
                    Swal.fire({
                        title: 'No Payment Methods Selected',
                        text: 'Please select at least one payment method to continue.',
                        icon: 'info',
                        confirmButtonText: 'OK'
                    });
                    return false;
                }
                return true;

            default:
                return true;
        }
    };

    const createTempShop = async () => {
        const docRef = await addDoc(collection(db, 'tempShops'), {
            temporary: true,
            createdAt: new Date(),
            ownerId: user.uid
        });
        setTempShopId(docRef.id);
        return docRef.id;
    };

    const handleStepChange = async (step) => {
        // Don't allow step changes if published
        if (isPublished) return;

        // Payment to Google Business transition
        if (step === 7 && currentStep === 6) {
            setCurrentStep(7);
            window.scrollTo({top: 0, behavior: 'smooth'});
            return;
        }

        // Run validation for step 3 first
        if (step === 4 && currentStep < 4) {
            if (!validateStep(3)) {
                return;
            }
        }

        // Then do tempShopId logic
        if (step === 4) {
            if (!tempShopId) {
                try {
                    const id = await createTempShop();
                    setCurrentStep(step);
                } catch (error) {
                    console.error('Error creating temporary shop:', error);
                    return;
                }
                return;
            }
            setCurrentStep(step);
            return;
        }

        // Don't allow skipping steps forward
        if (step > currentStep + 1) {
            return;
        }

        // Prevent direct navigation to business or publish steps
        if ((step === 7 || step === 8) && currentStep < 6) {
            return;
        }

        // Prevent going to publish step if business step not completed
        if (step === 8 && !isBusinessStepCompleted) {
            return;
        }

        // Always allow going backward
        if (step < currentStep) {
            setCurrentStep(step);
            window.scrollTo({top: 0, behavior: 'smooth'});
            return;
        }

        // Check if current step is valid before proceeding
        if (!validateStep(currentStep)) {
            return;
        }

        // Special handling for team step
        // Create temp shop before step 4 (services) or step 5 (employees)
        if ((currentStep === 4 || currentStep === 5) && !tempShopId) {
            try {
                const id = await createTempShop();
                setTempShopId(id);
            } catch (error) {
                console.error('Error creating temporary shop:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'There was an error preparing the services step. Please try again.',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
                return;
            }
        }

        setCurrentStep(step);
        window.scrollTo({top: 0, behavior: 'smooth'});
    };

    // useEffect(() => {
    //     const checkTrialStatus = async () => {
    //         if (user) {
    //             try {
    //                 const userData = await getUserData(user.uid);
    //                 const now = new Date();
    //                 const trialEndDate = userData.trialEndDate.toDate();
    //
    //                 if (now > trialEndDate && !userData.isSubscribed) {
    //                     setTrialStatus('expired');
    //                 } else if (userData.isSubscribed) {
    //                     setTrialStatus('subscribed');
    //                 } else {
    //                     setTrialStatus('active');
    //                 }
    //             } catch (error) {
    //                 console.error('Error checking trial status:', error);
    //             }
    //         }
    //     };
    //
    //     checkTrialStatus();
    // }, [user]);

    // const cleanPhoneNumber = (countryCode, phoneNumber) => {
    //     // Remove any non-digit characters from the phone number
    //     const digitsOnly = phoneNumber.replace(/\D/g, '');
    //
    //     // Remove the country code from the beginning of the phone number if it's present
    //     const phoneWithoutCountryCode = digitsOnly.startsWith(countryCode.slice(1))
    //         ? digitsOnly.slice(countryCode.length - 1)
    //         : digitsOnly;
    //
    //     // Remove any leading zeros
    //     const cleanedNumber = phoneWithoutCountryCode.replace(/^0+/, '');
    //
    //     return cleanedNumber;
    // };

    const handleGoogleBusinessCreation = async (profileData) => {
        setIsBusinessStepCompleted(true);
        if (!profileData.wantsToCreate) {
            setCurrentStep(8);
            setIsPublished(true);
            return;
        }

        try {
            // Initialize Google API client and handle authorization
            // Make API calls to create the business profile
            // Handle verification process
            // Update local database with Google Business Profile ID

            // Navigate to success page or account dashboard
            setCurrentStep(8);
            setIsPublished(true);
        } catch (error) {
            console.error('Error creating Google Business Profile:', error);
            Swal.fire({
                title: 'Error',
                text: 'There was an error creating your Google Business Profile. You can try again later from your account dashboard.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            // Still move to final step even if Google Business creation fails
            setCurrentStep(8);
            setIsPublished(true);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (currentStep !== 6) {
            return;
        }

        if (trialStatus === 'expired') {
            Swal.fire({
                title: 'Trial Expired',
                text: 'Your trial has expired. Please subscribe to continue using our services.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Subscribe Now',
                cancelButtonText: 'Cancel'
            }).then((result) => {
                if (result.isConfirmed) {
                    navigate('/subscribe');
                }
            });
            return;
        }

        if (validateStep(4) && user) {
            setIsSubmitting(true);
            setIsLoading(true);
            // const validServices = services.filter(service => service.name.trim() && service.price.trim());

            try {

                const tempShopDoc = await getDoc(doc(db, 'tempShops', tempShopId));
                const tempShopData = tempShopDoc.exists() ? tempShopDoc.data() : {};

                const imageUrls = await Promise.all(images.map(async (image) => {
                    const imageRef = ref(storage, `shops/${user.uid}/${image.name}`);
                    await uploadBytes(imageRef, image);
                    return getDownloadURL(imageRef);
                }));

                const uniqueUrl = nanoid(10);
                const uniqueImageUrls = [...new Set(imageUrls)];
                const validServices = await Promise.all(services.filter(service =>
                    service.name.trim() && service.price.trim()
                ).map(async service => {
                    // Handle service images if they exist
                    let serviceImageUrls = [];
                    if (service.images && service.images.length > 0) {
                        serviceImageUrls = await Promise.all(service.images.map(async (image) => {
                            // Create a specific folder for service images
                            const imageRef = ref(storage, `shops/${user.uid}/services/${service.name}/${image.name}`);
                            await uploadBytes(imageRef, image);
                            return getDownloadURL(imageRef);
                        }));
                    }

                    return {
                        name: service.name,
                        price: service.price,
                        duration: service.duration || '30',
                        description: service.description || '',
                        imageUrls: serviceImageUrls
                    };
                }));
                const pricingTier = calculatePricingTier(validServices);

                const shopData = {
                    name: shopName,
                    nameSearch: shopName.toLowerCase().trim(), // Add this line
                    employees: tempShopData.employees || [],
                    employeeRegistrationTokens: tempShopData.employeeRegistrationTokens || {},
                    address: address,
                    phoneNumber: phoneNumber,
                    email: email,
                    biography: editorRef.current ? editorRef.current.getContent() : '',
                    services: validServices,
                    ownerId: user.uid,
                    createdAt: new Date(),
                    uniqueUrl: uniqueUrl,
                    availability: availability,
                    imageUrls: uniqueImageUrls,
                    pricingTier: pricingTier,
                    // Add theme configuration
                    theme: {
                        colors: {
                            primary: '#2563eb',
                            secondary: '#7c3aed',
                            accent: '#f59e0b',
                            background: '#ffffff'
                        },
                        typography: {
                            headingFont: 'Inter',
                            bodyFont: 'Inter',
                            fontSize: 'base'
                        },
                        animations: {
                            enabled: true,
                            duration: 0.3,
                            type: 'fade'
                        }
                    },
                    // Add blocks configuration
                    blocks: [
                        {id: 'header', type: 'header', active: true},
                        {id: 'services', type: 'services', active: true},
                        {id: 'gallery', type: 'gallery', active: true},
                        {id: 'team', type: 'team', active: true},
                        {id: 'contact', type: 'contact', active: true},
                        {id: 'reviews', type: 'reviews', active: true},
                        {id: 'availability', type: 'availability', active: true},
                        {id: 'cta', type: 'cta', active: true},
                        {id: 'features', type: 'features', active: true},
                        {id: 'footer', type: 'footer', active: true}
                    ]
                };

                const docRef = await addDoc(collection(db, 'barberShops'), shopData);

                console.log('Barber shop created with ID: ', docRef.id);

                // Clear the draft after successful creation
                await clearDraft();
                setHasUnsavedChanges(false);

                setUserShops(prevShops => [...prevShops, {id: docRef.id, ...shopData}]);

                setIsPublished(true);
                setCurrentStep(6);

                Swal.fire({
                    title: 'Shop Created Successfully',
                    html: `Your shop has been created! Share this link with your clients:<br>
                <strong>${window.location.origin}/shop/${uniqueUrl}</strong>`,
                    icon: 'success',
                    confirmButtonText: 'OK'
                });
            } catch (error) {
                console.error('Error creating barber shop: ', error);
                Swal.fire({
                    title: 'Error',
                    text: 'There was an error creating your barber shop. Please try again.',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            } finally {
                setIsSubmitting(false);
                setIsLoading(false);
            }
        }
    };

    const translations = {
        en: {
            enterBiography: "Describe your barbershop...",
            biographyHelp: "Use the template button to start with a professional layout",
            viewCreatedShops: "View Created Shops",
            createYourBarberShop: "Create Your Barber Shop",
            trialExpired: "Trial Expired",
            trialExpiredMessage: "Your trial has expired. Please subscribe to continue using our services.",
            trialActive: "Trial Active",
            trialActiveMessage: "You are currently in your 14-day trial period.",
            salon: "Salon",
            availability: "Availability",
            images: "Images",
            services: "Services",
            publish: "Publish",
            barberShopName: "Barber Shop Name",
            enterShopName: "Enter your barber shop name",
            address: "Address",
            enterAddress: "Enter your shop's address",
            phoneNumber: "Phone Number",
            enterPhoneNumber: "Enter your phone number",
            email: "Email",
            enterEmail: "Enter your email address",
            biography: "Biography",
            next: "Next",
            back: "Back",
            setYourAvailability: "Set Your Availability",
            dropzoneText: "Drag 'n' drop some images here, or click to select files",
            quickAddServices: "Quick Add Services",
            serviceName: "Service name",
            price: "Price",
            addService: "Add Service",
            creating: "Creating...",
            success: "Success!",
            shopCreatedMessage: "Your barber shop has been created. To activate your shop, please subscribe to our service.",
            subscribeNow: "Subscribe Now - €25/month",
            uniqueLinkMessage: "Your unique shop link will be generated after subscription.",
            createAnotherShop: "Create Another Shop",
            missingInformation: "Missing Information",
            fillAllFields: "Please fill in all required fields: Shop Name, Address, Phone Number, Email, and Biography.",
            storeHoursRequired: "Store Hours Required",
            setStoreHours: "Please set your store hours for at least one day of the week.",
            noImagesUploaded: "No Images Uploaded",
            addImagesAttractCustomers: "Adding photos of your shop can attract more customers. Would you like to continue without images?",
            continueWithoutImages: "Continue without images",
            addImages: "I'll add images",
            noServicesAdded: "No Services Added",
            addAtLeastOneService: "Please add at least one service with both a name and price.",
            shopCreatedSuccessfully: "Shop Created Successfully",
            shopCreatedShareLink: "Your shop has been created! Share this link with your clients:",
            error: "Error",
            creatingShop: "Creating your shop...",
            errorCreatingShop: "There was an error creating your barber shop. Please try again.",
            subscribeToCreate: "Please subscribe to create a barber shop.",
            subscribeNowButton: "Subscribe Now",
            paymentMethods: "Payment Methods",
            selectPaymentMethods: "Select the payment methods your shop accepts",
            cash: "Cash",
            creditCard: "Credit Card",
            mobilePayment: "Mobile Payment",
            other: "Other",
            managedInSettings: "✨ Managed in account settings",
            editInSettings: "Edit this in your account settings"
        },
        tr: {
            enterBiography: "Berber dükkanınızı tanımlayın...",
            biographyHelp: "Profesyonel bir düzen ile başlamak için şablon düğmesini kullanın",
            viewCreatedShops: "Oluşturulan Dükkanları Görüntüle",
            createYourBarberShop: "Berber Dükkanınızı Oluşturun",
            trialExpired: "Deneme Süresi Sona Erdi",
            trialExpiredMessage: "Deneme süreniz sona erdi. Hizmetlerimizi kullanmaya devam etmek için lütfen abone olun.",
            trialActive: "Deneme Süresi Aktif",
            trialActiveMessage: "Şu anda 14 günlük deneme sürecindesiniz.",
            salon: "Salon",
            availability: "Müsaitlik",
            images: "Görseller",
            services: "Hizmetler",
            publish: "Yayınla",
            barberShopName: "Berber Dükkanı Adı",
            enterShopName: "Berber dükkanınızın adını girin",
            address: "Adres",
            enterAddress: "Dükkanınızın adresini girin",
            phoneNumber: "Telefon Numarası",
            enterPhoneNumber: "Telefon numaranızı girin",
            email: "E-posta",
            enterEmail: "E-posta adresinizi girin",
            biography: "Biyografi",
            next: "İleri",
            back: "Geri",
            setYourAvailability: "Müsaitlik Durumunuzu Ayarlayın",
            dropzoneText: "Resimleri buraya sürükleyip bırakın veya dosya seçmek için tıklayın",
            quickAddServices: "Hızlı Hizmet Ekle",
            serviceName: "Hizmet adı",
            price: "Fiyat",
            addService: "Hizmet Ekle",
            creating: "Oluşturuluyor...",
            success: "Başarılı!",
            shopCreatedMessage: "Berber dükkanınız oluşturuldu. Dükkanınızı aktifleştirmek için lütfen hizmetimize abone olun.",
            subscribeNow: "Şimdi Abone Ol - Aylık €25",
            uniqueLinkMessage: "Benzersiz dükkan linkiniz abonelik sonrası oluşturulacaktır.",
            createAnotherShop: "Başka Bir Dükkan Oluştur",
            missingInformation: "Eksik Bilgi",
            fillAllFields: "Lütfen tüm gerekli alanları doldurun: Dükkan Adı, Adres, Telefon Numarası, E-posta ve Biyografi.",
            storeHoursRequired: "Çalışma Saatleri Gerekli",
            setStoreHours: "Lütfen haftanın en az bir günü için çalışma saatlerinizi ayarlayın.",
            noImagesUploaded: "Resim Yüklenmedi",
            addImagesAttractCustomers: "Dükkanınızın fotoğraflarını eklemek daha fazla müşteri çekebilir. Resimsiz devam etmek ister misiniz?",
            continueWithoutImages: "Resimsiz devam et",
            addImages: "Resim ekleyeceğim",
            noServicesAdded: "Hizmet Eklenmedi",
            addAtLeastOneService: "Lütfen en az bir hizmet ekleyin ve hem adını hem de fiyatını belirtin.",
            shopCreatedSuccessfully: "Dükkan Başarıyla Oluşturuldu",
            shopCreatedShareLink: "Dükkanınız oluşturuldu! Bu linki müşterilerinizle paylaşın:",
            error: "Hata",
            creatingShop: "Dükkanınız oluşturuluyor...",
            errorCreatingShop: "Berber dükkanınızı oluştururken bir hata oluştu. Lütfen tekrar deneyin.",
            subscribeToCreate: "Berber dükkanı oluşturmak için lütfen abone olun.",
            subscribeNowButton: "Şimdi Abone Ol",
            paymentMethods: "Ödeme Yöntemleri",
            selectPaymentMethods: "Dükkanınızın kabul ettiği ödeme yöntemlerini seçin",
            cash: "Nakit",
            creditCard: "Kredi Kartı",
            mobilePayment: "Mobil Ödeme",
            other: "Diğer",
            managedInSettings: "✨ Hesap ayarlarında yönetilir",
            editInSettings: "Bunu hesap ayarlarında düzenleyin"
        },
        ar: {
            enterBiography: "صف صالون الحلاقة الخاص بك...",
            biographyHelp: "استخدم زر القالب للبدء بتخطيط احترافي",
            viewCreatedShops: "عرض المحلات المنشأة",
            createYourBarberShop: "أنشئ صالون الحلاقة الخاص بك",
            trialExpired: "انتهت الفترة التجريبية",
            trialExpiredMessage: "انتهت فترتك التجريبية. يرجى الاشتراك للاستمرار في استخدام خدماتنا.",
            trialActive: "الفترة التجريبية نشطة",
            trialActiveMessage: "أنت حاليًا في فترتك التجريبية لمدة 14 يومًا.",
            salon: "الصالون",
            availability: "التوفر",
            images: "الصور",
            services: "الخدمات",
            publish: "نشر",
            barberShopName: "اسم صالون الحلاقة",
            enterShopName: "أدخل اسم صالون الحلاقة الخاص بك",
            address: "العنوان",
            enterAddress: "أدخل عنوان صالونك",
            phoneNumber: "رقم الهاتف",
            enterPhoneNumber: "أدخل رقم هاتفك",
            email: "البريد الإلكتروني",
            enterEmail: "أدخل عنوان بريدك الإلكتروني",
            biography: "السيرة الذاتية",
            next: "التالي",
            back: "السابق",
            setYourAvailability: "حدد أوقات توفرك",
            dropzoneText: "اسحب وأفلت بعض الصور هنا، أو انقر لتحديد الملفات",
            quickAddServices: "إضافة خدمات سريعة",
            serviceName: "اسم الخدمة",
            price: "السعر",
            addService: "إضافة خدمة",
            creating: "جاري الإنشاء...",
            success: "تم بنجاح!",
            shopCreatedMessage: "تم إنشاء صالون الحلاقة الخاص بك. لتفعيل صالونك، يرجى الاشتراك في خدمتنا.",
            subscribeNow: "اشترك الآن - €25/شهريًا",
            uniqueLinkMessage: "سيتم إنشاء رابط صالونك الفريد بعد الاشتراك.",
            createAnotherShop: "إنشاء صالون آخر",
            missingInformation: "معلومات ناقصة",
            fillAllFields: "يرجى ملء جميع الحقول المطلوبة: اسم الصالون، العنوان، رقم الهاتف، البريد الإلكتروني، والسيرة الذاتية.",
            storeHoursRequired: "ساعات العمل مطلوبة",
            setStoreHours: "يرجى تحديد ساعات عملك ليوم واحد على الأقل من أيام الأسبوع.",
            noImagesUploaded: "لم يتم تحميل صور",
            addImagesAttractCustomers: "إضافة صور لصالونك يمكن أن يجذب المزيد من العملاء. هل ترغب في المتابعة بدون صور؟",
            continueWithoutImages: "المتابعة بدون صور",
            addImages: "سأضيف صورًا",
            noServicesAdded: "لم تتم إضافة خدمات",
            addAtLeastOneService: "يرجى إضافة خدمة واحدة على الأقل مع ذكر الاسم والسعر.",
            shopCreatedSuccessfully: "تم إنشاء الصالون بنجاح",
            shopCreatedShareLink: "تم إنشاء صالونك! شارك هذا الرابط مع عملائك:",
            error: "خطأ",
            creatingShop: "جاري إنشاء متجرك...",
            errorCreatingShop: "حدث خطأ أثناء إنشاء صالون الحلاقة الخاص بك. يرجى المحاولة مرة أخرى.",
            subscribeToCreate: "يرجى الاشتراك لإنشاء صالون حلاقة.",
            subscribeNowButton: "اشترك الآن",
            paymentMethods: "طرق الدفع",
            selectPaymentMethods: "حدد طرق الدفع التي يقبلها متجرك",
            cash: "نقداً",
            creditCard: "بطاقة ائتمان",
            mobilePayment: "دفع عبر الهاتف",
            other: "أخرى",
            managedInSettings: "✨ تتم إدارته في إعدادات الحساب",
            editInSettings: "قم بتحرير هذا في إعدادات حسابك"
        },
        de: {
            enterBiography: "Beschreiben Sie Ihren Friseursalon...",
            biographyHelp: "Verwenden Sie die Vorlagenschaltfläche, um mit einem professionellen Layout zu beginnen",
            viewCreatedShops: "Erstellte Läden anzeigen",
            createYourBarberShop: "Erstellen Sie Ihren Friseursalon",
            trialExpired: "Testphase abgelaufen",
            trialExpiredMessage: "Ihre Testphase ist abgelaufen. Bitte abonnieren Sie, um unsere Dienste weiterhin zu nutzen.",
            trialActive: "Testphase aktiv",
            trialActiveMessage: "Sie befinden sich derzeit in Ihrer 14-tägigen Testphase.",
            salon: "Salon",
            availability: "Verfügbarkeit",
            images: "Bilder",
            services: "Dienstleistungen",
            publish: "Veröffentlichen",
            barberShopName: "Name des Friseursalons",
            enterShopName: "Geben Sie den Namen Ihres Friseursalons ein",
            address: "Adresse",
            enterAddress: "Geben Sie die Adresse Ihres Salons ein",
            phoneNumber: "Telefonnummer",
            enterPhoneNumber: "Geben Sie Ihre Telefonnummer ein",
            email: "E-Mail",
            enterEmail: "Geben Sie Ihre E-Mail-Adresse ein",
            biography: "Biografie",
            next: "Weiter",
            back: "Zurück",
            setYourAvailability: "Legen Sie Ihre Verfügbarkeit fest",
            dropzoneText: "Ziehen Sie einige Bilder hierher oder klicken Sie, um Dateien auszuwählen",
            quickAddServices: "Schnelle Dienstleistungen hinzufügen",
            serviceName: "Name der Dienstleistung",
            price: "Preis",
            addService: "Dienstleistung hinzufügen",
            creating: "Wird erstellt...",
            success: "Erfolg!",
            shopCreatedMessage: "Ihr Friseursalon wurde erstellt. Um Ihren Salon zu aktivieren, abonnieren Sie bitte unseren Service.",
            subscribeNow: "Jetzt abonnieren - €25/Monat",
            uniqueLinkMessage: "Ihr einzigartiger Salon-Link wird nach dem Abonnement generiert.",
            createAnotherShop: "Einen weiteren Salon erstellen",
            missingInformation: "Fehlende Informationen",
            fillAllFields: "Bitte füllen Sie alle erforderlichen Felder aus: Salonname, Adresse, Telefonnummer, E-Mail und Biografie.",
            storeHoursRequired: "Öffnungszeiten erforderlich",
            setStoreHours: "Bitte legen Sie Ihre Öffnungszeiten für mindestens einen Tag der Woche fest.",
            noImagesUploaded: "Keine Bilder hochgeladen",
            addImagesAttractCustomers: "Das Hinzufügen von Fotos Ihres Salons kann mehr Kunden anziehen. Möchten Sie ohne Bilder fortfahren?",
            continueWithoutImages: "Ohne Bilder fortfahren",
            addImages: "Ich werde Bilder hinzufügen",
            noServicesAdded: "Keine Dienstleistungen hinzugefügt",
            addAtLeastOneService: "Bitte fügen Sie mindestens eine Dienstleistung mit Namen und Preis hinzu.",
            shopCreatedSuccessfully: "Salon erfolgreich erstellt",
            shopCreatedShareLink: "Ihr Salon wurde erstellt! Teilen Sie diesen Link mit Ihren Kunden:",
            error: "Fehler",
            creatingShop: "Ihr Laden wird erstellt...",
            errorCreatingShop: "Beim Erstellen Ihres Friseursalons ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
            subscribeToCreate: "Bitte abonnieren Sie, um einen Friseursalon zu erstellen.",
            subscribeNowButton: "Jetzt abonnieren",
            paymentMethods: "Zahlungsmethoden",
            selectPaymentMethods: "Wählen Sie die Zahlungsmethoden aus, die Ihr Geschäft akzeptiert",
            cash: "Bargeld",
            creditCard: "Kreditkarte",
            mobilePayment: "Mobile Zahlung",
            other: "Andere",
            managedInSettings: "✨ Wird in den Kontoeinstellungen verwaltet",
            editInSettings: "Bearbeiten Sie dies in Ihren Kontoeinstellungen"
        }
    };

    const t = translations[language];

    const editorConfig = {
        height: 500,
        menubar: true,
        // Include language packs and language_url
        language: language === 'tr' ? 'tr' :
            language === 'ar' ? 'ar' :
                language === 'de' ? 'de' : 'en',
        // language_url: language === 'tr' ? 'https://cdn.tiny.cloud/1/6eke8w2nyjpg9rotzvxhe9klva3y1xetkxmbp50pjy5klfjb/tinymce/6/langs/tr_TR.js' :
        //     language === 'ar' ? 'https://cdn.tiny.cloud/1/6eke8w2nyjpg9rotzvxhe9klva3y1xetkxmbp50pjy5klfjb/tinymce/6/langs/ar.js' :
        //         language === 'de' ? 'https://cdn.tiny.cloud/1/6eke8w2nyjpg9rotzvxhe9klva3y1xetkxmbp50pjy5klfjb/tinymce/6/langs/de.js' : '',
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'help', 'wordcount',
            'emoticons'
        ],
        toolbar: [
            'undo redo | styles | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent',
            'template | removeformat | help | emoticons'
        ].join(' | '),
        style_formats: [
            {
                title: 'Headers', items: [
                    {title: 'Header 1', format: 'h1'},
                    {title: 'Header 2', format: 'h2'},
                    {title: 'Header 3', format: 'h3'}
                ]
            },
            {
                title: 'Inline', items: [
                    {title: 'Bold', format: 'bold'},
                    {title: 'Italic', format: 'italic'},
                    {title: 'Underline', format: 'underline'}
                ]
            },
            {
                title: 'Blocks', items: [
                    {title: 'Paragraph', format: 'p'},
                    {title: 'Service List', format: 'div', classes: 'service-list'},
                    {title: 'Highlight Box', format: 'div', classes: 'highlight-box'}
                ]
            }
        ],
        templates: BARBERSHOP_TEMPLATES,
        content_style: CUSTOM_STYLES,
        placeholder: t.enterBiography || 'Describe your barbershop...',
        branding: false,
        promotion: false,
        directionality: language === 'ar' ? 'rtl' : 'ltr',
        paste_data_images: true,
        automatic_uploads: true,
        images_upload_handler: async (blobInfo) => {
            return new Promise((resolve) => {
                resolve('');
            });
        }
    };

    const LoadingScreen = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                <span className="loading loading-bars loading-lg"></span>
                <p className="mt-4 text-lg font-semibold">{t.creatingShop}</p>
            </div>
        </div>
    );

    // Determine if Navbar and Footer should be shown. They are hidden only when the shop is published and in the publish step (assumed step 8).
    const showNavFooter = !(currentStep === 8);

    return (
        <>
            {/*{showNavFooter && <DesktopNavbar />}*/}

            {showPhoneAlert && (
                <PhoneNumberAlert
                    language={language}
                    isDark={document.documentElement.getAttribute('data-theme') === 'dark'}
                    onNavigate={() => {
                        navigate('/account');
                        setShowPhoneAlert(false);
                    }}
                />
            )}


            <div className="container mx-auto px-4 py-8">
                <div className={`transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
                    {!hideUI && (
                        <>
                            <h1 className="text-3xl font-bold text-center mb-8">{t.createYourBarberShop}</h1>

                            {trialStatus === 'expired' && (
                                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4"
                                     role="alert">
                                    <p className="font-bold">{t.trialExpired}</p>
                                    <p>{t.trialExpiredMessage}</p>
                                </div>
                            )}

                            {trialStatus === 'active' && (
                                <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4"
                                     role="alert">
                                    <p className="font-bold">{t.trialActive}</p>
                                    <p>{t.trialActiveMessage}</p>
                                </div>
                            )}

                            <CreationSteps
                                currentStep={currentStep}
                                onStepClick={handleStepChange}
                                isPublished={isPublished}
                            />
                        </>
                    )}
                </div>

                {isLoading && <LoadingScreen/>}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {currentStep === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="shopName" className="block text-sm font-medium text-gray-700">
                                    {t.barberShopName}
                                </label>
                                <ShopNameValidator
                                    onNameValidated={({ name, isAvailable }) => {
                                        setShopName(name);
                                        setShopNameStatus(prev => ({
                                            ...prev,
                                            isAvailable,
                                            isChecking: false
                                        }));
                                        setFormTouched(true);
                                    }}
                                    initialName={shopName}
                                />
                                <AnimatePresence>
                                    {shopName && shopNameStatus.isAvailable === true && (
                                        <motion.p
                                            initial={{opacity: 0}}
                                            animate={{opacity: 1}}
                                            exit={{opacity: 0}}
                                            className="text-success text-sm mt-2"
                                        >
                                            This name is available!
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="relative">
                                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                                    {t.address}
                                </label>
                                <div className="text-xs text-base-content/50 mt-2">
                                    Powered by OpenStreetMap
                                </div>
                                <div className="relative mt-1">
                                    <input
                                        ref={addressInputRef}
                                        type="text"
                                        id="address"
                                        className="block w-full input input-bordered pr-10"
                                        value={address}
                                        onChange={handleAddressChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (address.trim()) {
                                                    setIsSuggestionSelected(true);
                                                    setAddressSuggestions([]);
                                                    setIsAddingCustomAddress(false);
                                                    // Move focus to next input
                                                    const form = e.target.form;
                                                    const index = Array.prototype.indexOf.call(form, e.target);
                                                    form.elements[index + 1]?.focus();
                                                }
                                            } else if (e.key === 'Escape') {
                                                setAddressSuggestions([]);
                                                setIsAddingCustomAddress(false);
                                            }
                                        }}
                                        required
                                        placeholder={t.enterAddress}
                                    />
                                    {address && !isSuggestionSelected && !isAddingCustomAddress && (
                                        <button
                                            type="button"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-content hover:text-primary transition-colors"
                                            onClick={() => {
                                                setIsSuggestionSelected(true);
                                                setAddressSuggestions([]);
                                            }}
                                        >
                                            <Check className="w-5 h-5"/>
                                        </button>
                                    )}
                                </div>

                                {/* Suggestions Dropdown */}
                                {(addressSuggestions.length > 0 || (address.length > 3 && !isSuggestionSelected)) && (
                                    <div
                                        className="absolute z-[2001] w-full bg-base-100 border border-base-300 mt-1 rounded-lg shadow-xl overflow-hidden">
                                        {addressSuggestions.map((suggestion, index) => (
                                            <button
                                                key={index}
                                                className="w-full px-4 py-2 text-left hover:bg-base-200 group"
                                                onClick={() => {
                                                    setShopData({...shopData,
                                                        address: suggestion.full_address,
                                                        latitude: suggestion.latitude,
                                                        longitude: suggestion.longitude
                                                    });
                                                    setIsSuggestionSelected(true);
                                                    setAddressSuggestions([]);
                                                }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {suggestion.icon}
                                                    <div className="flex-1">
                                                        <p className="font-medium">{suggestion.street}</p>
                                                        <p className="text-xs text-base-content/70">
                                                            {[suggestion.city, suggestion.postcode, suggestion.country].filter(Boolean).join(", ")}
                                                        </p>
                                                    </div>
                                                    <Check className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                                                </div>
                                            </button>
                                        ))}

                                        {/* "Use Custom Address" Option */}
                                        {!isAddingCustomAddress && address.length > 3 && (
                                            <>
                                                {addressSuggestions.length > 0 && (
                                                    <div className="border-t border-base-300"/>
                                                )}
                                                <button
                                                    type="button"
                                                    className="w-full px-4 py-2 text-left hover:bg-base-200 transition-colors duration-150
                                 flex items-center justify-between group text-primary"
                                                    onClick={() => {
                                                        setIsSuggestionSelected(true);
                                                        setAddressSuggestions([]);
                                                        setIsAddingCustomAddress(false);
                                                        addressInputRef.current?.blur();
                                                    }}
                                                >
                        <span className="flex items-center gap-2">
                            <Store className="w-4 h-4"/>
                            {language === 'tr' ? 'Bu adresi kullan' :
                                language === 'ar' ? 'استخدم هذا العنوان' :
                                    language === 'de' ? 'Diese Adresse verwenden' :
                                        'Use this address'}: "{address}"
                        </span>
                                                    <Check
                                                        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Mobile Hint */}
                                {!isSuggestionSelected && address.length > 3 && (
                                    <div className="mt-1 text-sm text-base-content/70 flex items-center gap-1">
                                        <Info className="w-4 h-4"/>
                                        {language === 'tr' ? 'Adresinizi seçin veya özel adres girin' :
                                            language === 'ar' ? 'اختر عنوانك أو أدخل عنوانًا مخصصًا' :
                                                language === 'de' ? 'Wählen Sie Ihre Adresse aus oder geben Sie eine benutzerdefinierte Adresse ein' :
                                                    'Select your address or enter a custom one'}
                                    </div>
                                )}

                                {isLoadingSuggestions && (
                                    <div
                                        className="absolute z-[2001] w-full bg-base-100 border border-base-300 mt-1 rounded-lg shadow-xl p-4 flex items-center justify-center">
                                        <span className="loading loading-spinner loading-sm mr-2"></span>
                                        {language === 'tr' ? 'Adresler yükleniyor...' :
                                            language === 'ar' ? 'جارٍ تحميل العناوين...' :
                                                language === 'de' ? 'Adressen werden geladen...' :
                                                    'Loading addresses...'}
                                    </div>
                                )}
                            </div>
                            <div className="relative mt-4 mb-4">
                                <label htmlFor="phoneNumber"
                                       className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                                    {t.phoneNumber}
                                    <span className="text-xs text-primary animate-pulse">
    {t.managedInSettings}
</span>
                                </label>
                                <div className="relative z-[2] group">
                                    <PhoneInput
                                        country={'tr'}
                                        value={phoneNumber}
                                        // onChange={handlePhoneChange}
                                        inputStyle={{
                                            ...phoneInputStyle,
                                            opacity: 0.7,
                                            cursor: 'not-allowed',
                                            backgroundColor: 'rgba(var(--b2) / 0.1)'
                                        }}
                                        containerStyle={{
                                            width: '100%',
                                            marginTop: '0.25rem'
                                        }}
                                        dropdownStyle={{
                                            display: 'none'
                                        }}
                                        buttonStyle={{
                                            border: '1px solid rgb(209, 213, 219)',
                                            borderRight: 'none',
                                            borderRadius: '0.375rem 0 0 0.375rem',
                                            backgroundColor: 'white',
                                            opacity: 0.7,
                                            cursor: 'not-allowed'
                                        }}
                                        disabled={true}
                                    />
                                    <div
                                        className="absolute inset-0 bg-base-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-lg">
                                        <div
                                            className="bg-base-100 shadow-lg px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                                            <Info className="w-4 h-4 text-primary"/>
                                            {t.editInSettings}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <label htmlFor="email"
                                       className="block text-sm font-medium text-gray-700 flex items-center justify-between">
                                    {t.email}
                                    <span className="text-xs text-primary animate-pulse">
    {t.managedInSettings}
</span>
                                </label>
                                <div className="relative group">
                                    <input
                                        type="email"
                                        id="email"
                                        className="mt-1 block w-full input input-bordered opacity-70 cursor-not-allowed bg-base-200/10"
                                        value={email}
                                        disabled
                                        placeholder={t.enterEmail}
                                    />
                                    <div
                                        className="absolute inset-0 bg-base-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-lg">
                                        <div
                                            className="bg-base-100 shadow-lg px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                                            <Info className="w-4 h-4 text-primary"/>
                                            {t.editInSettings}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <ShopCategorySelector
                                    value={categories}
                                    onChange={setCategories}
                                    error={!categories.length && formTouched ? 'Please select at least one category' : null}
                                />
                            </div>

                            <div>
                                <label htmlFor="biography" className="block text-sm font-medium text-gray-700">
                                    {t.biography}
                                </label>
                                <div className="mt-1">
                                    {/*<Editor*/}
                                    {/*    key={editorKey}*/}
                                    {/*    apiKey='6eke8w2nyjpg9rotzvxhe9klva3y1xetkxmbp50pjy5klfjb'*/}
                                    {/*    onInit={(_evt, editor) => editorRef.current = editor}*/}
                                    {/*    initialValue=""*/}
                                    {/*    init={editorConfig}*/}
                                    {/*    onEditorChange={(content) => {*/}
                                    {/*        console.log('Content changed:', content);*/}
                                    {/*        setEditorContent(content); // Add this line*/}
                                    {/*    }}*/}
                                    {/*/>*/}
                                    <BarbershopEditor
                                        language={language}
                                        value={editorContent}
                                        onChange={handleEditorChange}
                                        trialStatus={trialStatus}
                                        user={user}
                                    />
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    {t.biographyHelp || 'Use the template button to start with a professional layout'}
                                </p>
                            </div>

                            <button
                                type="button"
                                className={`btn btn-primary ${
                                    (shopNameStatus.isAvailable === false || shopNameStatus.isChecking)
                                        ? 'btn-disabled opacity-50 cursor-not-allowed'
                                        : ''
                                }`}
                                onClick={() => handleStepChange(currentStep + 1)}
                                disabled={shopNameStatus.isAvailable === false || shopNameStatus.isChecking}
                            >
                                {shopNameStatus.isChecking ? (
                                    <span className="loading loading-spinner loading-sm"></span>
                                ) : t.next}
                            </button>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-4">
                            <EnhancedAvailabilitySelector
                                availability={availability}
                                setAvailability={setAvailability}
                                specialDates={specialDates}
                                setSpecialDates={setSpecialDates}
                                slotDuration={slotDuration}
                                setSlotDuration={setSlotDuration}
                                t={t}
                                setFormTouched={setFormTouched}
                            />
                            <div className="flex justify-between">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => handleStepChange(currentStep - 1)}
                                >
                                    {t.back}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleStepChange(3)}
                                >
                                    {t.next}
                                </button>
                            </div>
                        </div>
                    )}

                    {
                        currentStep === 3 && (
                            <div className="space-y-4">
                                <ImageUploadSection
                                    images={images}
                                    setImages={setImages}
                                    language={language}
                                    setFormTouched={setFormTouched}
                                />
                                {/*<div {...getRootProps()} className="dropzone">*/}
                                {/*    <input {...getInputProps()} />*/}
                                {/*    <p className="text-center p-20 border-2 border-dashed border-gray-300 rounded-lg">*/}
                                {/*        {t.dropzoneText}*/}
                                {/*    </p>*/}
                                {/*</div>*/}
                                {/*<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">*/}
                                {/*    {images.map((file, index) => (*/}
                                {/*        <div key={file.name} className="relative">*/}
                                {/*            <img*/}
                                {/*                src={file.preview}*/}
                                {/*                alt={`${t.imagePreview} ${index + 1}`}*/}
                                {/*                className="w-full h-40 object-cover rounded-lg"*/}
                                {/*            />*/}
                                {/*            <button*/}
                                {/*                type="button"*/}
                                {/*                onClick={() => {*/}
                                {/*                    const newImages = [...images];*/}
                                {/*                    newImages.splice(index, 1);*/}
                                {/*                    setImages(newImages);*/}
                                {/*                }}*/}
                                {/*                className="absolute top-1 right-1 bg-white bg-opacity-70 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-opacity-100 transition-colors"*/}
                                {/*                aria-label={t.removeImage}*/}
                                {/*            >*/}
                                {/*                <span className="text-xl font-bold">×</span>*/}
                                {/*            </button>*/}
                                {/*        </div>*/}
                                {/*    ))}*/}
                                {/*</div>*/}
                                <div className="flex justify-between">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => handleStepChange(2)}
                                    >
                                        {t.back}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => handleStepChange(4)}
                                    >
                                        {t.next}
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    {currentStep === 4 && (
                        <div className="space-y-8">
                            <h2 className="text-2xl font-semibold">{t.services}</h2>

                            {/* Service Selection Section */}
                            <div className="bg-base-200 p-4 rounded-xl">
                                <h3 className="text-lg font-medium mb-4">{t.quickAddServices}</h3>
                                <PresetServiceSelector
                                    onServiceSelect={handlePresetServiceSelect}
                                    selectedServices={services}
                                    setFormTouched={setFormTouched}
                                    userId={user?.uid}
                                    shopId={tempShopId}
                                    isImageUploading={isImageUploading}
                                    setIsImageUploading={setIsImageUploading}
                                />
                            </div>

                            {/* Selected Services Grid */}
                            <AnimatePresence mode="wait">
                                {services.length > 0 && (
                                    <motion.div
                                        initial={{opacity: 0, y: 20}}
                                        animate={{opacity: 1, y: 0}}
                                        exit={{opacity: 0, y: -20}}
                                        className="bg-base-100 p-6 rounded-xl shadow-sm"
                                    >
                                        <SelectedServicesGrid
                                            services={services}
                                            onRemoveService={(serviceToRemove) => {
                                                setServices(services.filter(service =>
                                                    service.name !== serviceToRemove.name ||
                                                    service.price !== serviceToRemove.price
                                                ));
                                                setFormTouched(true);
                                            }}
                                            onEditService={(serviceToEdit) => {
                                                // Handle editing service (you can implement a modal or expandable form)
                                                console.log('Edit service:', serviceToEdit);
                                            }}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Navigation Buttons */}
                            <div className="flex justify-between mt-8">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => handleStepChange(3)}
                                    disabled={isImageUploading} // Add this
                                >
                                    {t.back}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleStepChange(5)}
                                    disabled={isSubmitting || isImageUploading} // Add isImageUploading
                                >
                                    {isSubmitting ? t.creating : t.next}
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 5 && (
                        <EmployeeManagementStep
                            shopId={tempShopId}
                            shopData={shopData}
                            onBack={() => handleStepChange(4)}
                            onNext={(teamData) => {
                                handleStepChange(6);
                            }}
                            language={language}
                            setFormTouched={setFormTouched}
                        />
                    )}

                    {currentStep === 6 && (
                        <PaymentMethodsStep
                            paymentMethods={paymentMethods}
                            onSelect={setPaymentMethods}
                            setFormTouched={setFormTouched}
                            handleStepChange={handleStepChange}
                            t={t}
                        />
                    )}

                    {currentStep === 7 && (
                        <GoogleBusinessStep
                            onBack={() => handleStepChange(6)}
                            onNext={handleGoogleBusinessCreation}
                            tempShopId={tempShopId}
                            shopData={{
                                name: shopName,
                                address: address,
                                phoneNumber: phoneNumber,
                                email: email,
                                description: editorContent,
                                services: services,
                                availability: availability,
                                slotDuration: slotDuration,
                                images: images,
                                specialDates: specialDates,
                                categories: categories,
                                pricingTier: calculatePricingTier(services),
                                paymentMethods: paymentMethods
                            }}
                        />
                    )}

                    {currentStep === 8 && (
                        <SuccessView
                            shopData={shopData}
                            onViewShop={() => navigate('/account')}
                        />
                    )}
                </form>
            </div>

            {showNavFooter && <Footer />}
        </>
    )
        ;
};

export default CreateBarberShop;