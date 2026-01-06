import React, {useContext, useEffect, useRef, useState} from 'react';
import {Editor} from '@tinymce/tinymce-react';
import {useDropzone} from 'react-dropzone';
import PhoneInput from 'react-phone-input-2';
import {
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import {deleteObject, getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {db, storage} from '../firebase';
import {Camera, Check, Clock, CreditCard, Image, Scissors, Store, TagIcon, Trash2, Users2, X, Info, Building, Home, MapPin} from 'lucide-react';
import PresetServiceSelector from './PresetServiceSelector';
import LanguageContext from './LanguageContext';
import ShopCategorySelector from "./ShopCategorySelector";
import {nanoid} from "nanoid";
import WeeklyScheduleSelector from "./WeeklyScheduleSelector";
import ShopAvailabilityEditor from "./ShopAvailabilityEditor";
import {AnimatePresence, motion} from 'framer-motion';
import Swal from "sweetalert2";
import TemplateSelector from "./TemplateSelector";
import FullscreenEditorWrapper from "./toggleFullscreen";
import ImageCropModal from "./ImageCropModal";
import {createRoot} from "react-dom/client";
import BarbershopPaymentEditor from "./BarbershopPaymentEditor";

const EditBarberShopModal = ({shop, isOpen, onClose, onSave}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [shopData, setShopData] = useState({
        name: shop.name,
        address: shop.address,
        phoneNumber: shop.phoneNumber,
        email: shop.email,
        // description: shop.biography,
        biography: shop.biography,
        services: shop.services,
        availability: shop.availability,
        imageUrls: shop.imageUrls,
        categories: shop.categories || [],
        employees: shop.employees || [],
        specialDates: shop.specialDates || {},
        paymentMethods: shop.paymentMethods || []
    });
    const [images, setImages] = useState([]);
    const [deletedImages, setDeletedImages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const editorRef = useRef(null);
    const {language} = useContext(LanguageContext);

    const [generatedLinks, setGeneratedLinks] = useState({});
    const [copiedLinks, setCopiedLinks] = useState({});
    const [linkStatuses, setLinkStatuses] = useState({});

    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const addressInputRef = useRef(null);
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [isSuggestionSelected, setIsSuggestionSelected] = useState(true);
    const [isAddingCustomAddress, setIsAddingCustomAddress] = useState(false);

    const handleAddressChange = (e) => {
        const newAddress = e.target.value;
        setShopData({...shopData, address: newAddress});
        setIsSuggestionSelected(false);
        setIsAddingCustomAddress(false);
    };

// Add this useEffect for fetching address suggestions
    useEffect(() => {
        let timeoutId;
        if (shopData.address.length > 3 && !isSuggestionSelected) {
            setIsLoadingSuggestions(true);
            timeoutId = setTimeout(() => {
                fetchAddressSuggestions(shopData.address);
            }, 500);
        } else {
            setAddressSuggestions([]);
        }

        return () => clearTimeout(timeoutId);
    }, [shopData.address, isSuggestionSelected]);

// Add this function to fetch address suggestions using Nominatim (OpenStreetMap)
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

    const generateNameSuggestions = (name) => {
        // Normalize and sanitize input
        const base = name.trim().replace(/\s+/g, ' ');
        const tokens = base.split(' ');

        const suggestions = new Set();

        // Business entity patterns 
        const entities = ['Barbershop', 'Barbers', 'Grooming', 'Salon'];
        entities.forEach(entity => suggestions.add(`${base} ${entity}`));

        // Semantic modifiers for brand positioning
        const modifiers = {
            premium: ['Elite', 'Prime', 'Select', 'Luxury'],
            traditional: ['Classic', 'Heritage', 'Traditional', 'Authentic'],
            modern: ['Modern', 'Urban', 'Contemporary', 'Fresh'],
            professional: ['Pro', 'Expert', 'Master', 'Skilled']
        };

        // Generate positional variants
        Object.values(modifiers).flat().forEach(mod => {
            suggestions.add(`${mod} ${base}`);
            suggestions.add(`${base} ${mod}`);
        });

        // Business structure patterns
        const structures = ['& Co', '& Sons', 'Bros', 'House of'];
        structures.forEach(struct => suggestions.add(`${base} ${struct}`));

        // Numeric differentiators (limit to avoid confusion)
        for (let i = 2; i <= 3; i++) {
            suggestions.add(`${base} ${i}`);
        }

        // Location/Geographic patterns
        const locations = ['Corner', 'Square', 'Street', 'Boulevard'];
        locations.forEach(loc => suggestions.add(`${base} ${loc}`));

        // Article prefixing (The/A) with semantic validation
        if (!base.toLowerCase().startsWith('the ')) {
            suggestions.add(`The ${base}`);
        }

        // Filter suggestions
        return Array.from(suggestions)
            .filter(suggestion =>
                suggestion.length <= 30 && // Practical length limit
                suggestion.split(' ').length <= 4 // Cognitive load limit
            )
            .sort((a, b) =>
                // Prioritize simpler names
                (a.split(' ').length - b.split(' ').length) ||
                (a.length - b.length)
            )
            .slice(0, 12); // Limit total suggestions to prevent choice paralysis
    };

    const [shopNameStatus, setShopNameStatus] = useState({
        isChecking: false,
        isAvailable: null,
        suggestions: [],
        similar: []
    });

    const shopNameCheckTimeout = useRef(null);

    const handleShopNameChange = (e) => {
        const newName = e.target.value;
        setShopData({...shopData, name: e.target.value});
        setShopNameStatus({
            isChecking: false,
            isAvailable: null,
            suggestions: [],
            similar: []
        });

        if (shopNameCheckTimeout.current) {
            clearTimeout(shopNameCheckTimeout.current);
        }

        shopNameCheckTimeout.current = setTimeout(() => {
            checkShopName(newName);
        }, 500);
    };

    const checkShopName = async (name) => {
        if (!name.trim() || name.trim() === shop.name) {
            setShopNameStatus({
                isChecking: false,
                isAvailable: null,
                suggestions: [],
                similar: []
            });
            return;
        }

        setShopNameStatus(prev => ({...prev, isChecking: true}));

        try {
            const nameSearch = name.toLowerCase().trim();

            const exactQuery = query(
                collection(db, 'shopNames'),
                where('nameSearch', '==', nameSearch)
            );

            const similarQuery = query(
                collection(db, 'shopNames'),
                orderBy('nameSearch'),
                where('nameSearch', '>=', nameSearch),
                where('nameSearch', '<=', nameSearch + '\uf8ff'),
                limit(5)
            );

            const [exactMatch, similarMatches] = await Promise.all([
                getDocs(exactQuery),
                getDocs(similarQuery)
            ]);

            const isAvailable = exactMatch.empty;
            const similarShops = similarMatches.docs
                .map(doc => doc.data().name)
                .filter(name => name !== shop.name);

            let suggestions = [];
            if (!isAvailable) {
                suggestions = generateNameSuggestions(name);
                const suggestionChecks = await Promise.all(
                    suggestions.map(async (suggestion) => {
                        const suggestionQuery = query(
                            collection(db, 'shopNames'),
                            where('nameSearch', '==', suggestion.toLowerCase().trim())
                        );
                        const suggestionDoc = await getDocs(suggestionQuery);
                        return {suggestion, exists: !suggestionDoc.empty};
                    })
                );

                suggestions = suggestionChecks
                    .filter(result => !result.exists)
                    .map(result => result.suggestion);
            }

            setShopNameStatus({
                isChecking: false,
                isAvailable,
                suggestions,
                similar: similarShops
            });

        } catch (error) {
            console.error('Error checking shop name:', error);
            setShopNameStatus({
                isChecking: false,
                isAvailable: null,
                suggestions: [],
                similar: []
            });
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

    const onDrop = acceptedFiles => {
        const file = acceptedFiles[0];
        if (file) {
            setSelectedImage(URL.createObjectURL(file));
            setCropModalOpen(true);
        }
    };

    const handleCropComplete = (croppedFile) => {
        if (currentStep === 6) {
            setNewEmployee(prev => ({
                ...prev,
                photo: croppedFile
            }));
        }
        setCropModalOpen(false);
    };

    const [newEmployee, setNewEmployee] = useState({
        name: '',
        photo: null,
        expertise: [],
        schedule: {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        }
    });

    // Add translations object
    const translations = {
        en: {
            setYourAvailability: "Set Your Availability",
            next: "Next",
            previous: "Previous",
            saving: "Saving...",
            saveChanges: "Save Changes",
            dropImagesHere: "Drop images here or click to select",
            serviceName: "Service name",
            price: "Price",
            quickAddServices: "Quick Add Services",
            addService: "Add Service",
            categories: "Categories",
            selectCategories: "Select Categories",
            categoriesRequired: "Please select at least one category",
            services: {
                haircut: "Haircut",
                beardTrim: "Beard Trim",
                shave: "Shave",
                hairColoring: "Hair Coloring",
                hairTreatment: "Hair Treatment",
                kidsHaircut: "Kids Haircut",
                facial: "Facial",
                waxing: "Waxing",
                massage: "Massage",
                nailCare: "Nail Care",
                makeup: "Makeup",
                threading: "Threading",
                extensions: "Hair Extensions",
                braiding: "Hair Braiding",
                highlights: "Highlights",
                balayage: "Balayage",
                perm: "Perm",
                straightening: "Hair Straightening",
                scaleTreatment: "Scale Treatment",
                hotTowelService: "Hot Towel Service",
                eyebrowShaping: "Eyebrow Shaping",
                headMassage: "Head Massage"
            }
        },
        tr: {
            setYourAvailability: "Müsaitlik Durumunuzu Ayarlayın",
            next: "İleri",
            previous: "Geri",
            saving: "Kaydediliyor...",
            saveChanges: "Değişiklikleri Kaydet",
            dropImagesHere: "Resimleri buraya sürükleyip bırakın veya dosya seçmek için tıklayın",
            serviceName: "Hizmet adı",
            price: "Fiyat",
            quickAddServices: "Hızlı Hizmet Ekle",
            addService: "Hizmet Ekle",
            categories: "Kategoriler",
            selectCategories: "Kategori Seçin",
            categoriesRequired: "Lütfen en az bir kategori seçin",
            services: {
                haircut: "Saç Kesimi",
                beardTrim: "Sakal Kesimi",
                shave: "Tıraş",
                hairColoring: "Saç Boyama",
                hairTreatment: "Saç Bakımı",
                kidsHaircut: "Çocuk Saç Kesimi",
                facial: "Yüz Bakımı",
                waxing: "Ağda",
                massage: "Masaj",
                nailCare: "Tırnak Bakımı",
                makeup: "Makyaj",
                threading: "İplikle Epilasyon",
                extensions: "Saç Kaynak",
                braiding: "Saç Örgüsü",
                highlights: "Röfle",
                balayage: "Balyaj",
                perm: "Perma",
                straightening: "Saç Düzleştirme",
                scaleTreatment: "Saç Derisi Bakımı",
                hotTowelService: "Sıcak Havlu Servisi",
                eyebrowShaping: "Kaş Şekillendirme",
                headMassage: "Kafa Masajı"
            }
        },
        ar: {
            setYourAvailability: "حدد أوقات توفرك",
            next: "التالي",
            previous: "السابق",
            saving: "جاري الحفظ...",
            saveChanges: "حفظ التغييرات",
            dropImagesHere: "اسحب الصور هنا أو انقر للتحديد",
            serviceName: "اسم الخدمة",
            price: "السعر",
            quickAddServices: "إضافة خدمات سريعة",
            addService: "إضافة خدمة",
            categories: "الفئات",
            selectCategories: "اختر الفئات",
            categoriesRequired: "الرجاء اختيار فئة واحدة على الأقل",
            services: {
                haircut: "قص شعر",
                beardTrim: "تشذيب اللحية",
                shave: "حلاقة",
                hairColoring: "صبغ الشعر",
                hairTreatment: "علاج الشعر",
                kidsHaircut: "قص شعر للأطفال",
                facial: "عناية بالوجه",
                waxing: "إزالة الشعر بالشمع",
                massage: "تدليك",
                nailCare: "العناية بالأظافر",
                makeup: "مكياج",
                threading: "إزالة الشعر بالخيط",
                extensions: "وصلات شعر",
                braiding: "ضفر الشعر",
                highlights: "ميش",
                balayage: "بالياج",
                perm: "بيرم",
                straightening: "فرد الشعر",
                scaleTreatment: "علاج فروة الرأس",
                hotTowelService: "خدمة المنشفة الساخنة",
                eyebrowShaping: "تشكيل الحواجب",
                headMassage: "تدليك الرأس"
            }
        },
        de: {
            setYourAvailability: "Verfügbarkeit festlegen",
            next: "Weiter",
            previous: "Zurück",
            saving: "Wird gespeichert...",
            saveChanges: "Änderungen speichern",
            dropImagesHere: "Bilder hier ablegen oder klicken zum Auswählen",
            serviceName: "Name der Dienstleistung",
            price: "Preis",
            quickAddServices: "Schnelle Dienstleistungen hinzufügen",
            addService: "Dienstleistung hinzufügen",
            categories: "Kategorien",
            selectCategories: "Kategorien auswählen",
            categoriesRequired: "Bitte wählen Sie mindestens eine Kategorie",
            services: {
                haircut: "Haarschnitt",
                beardTrim: "Bartschnitt",
                shave: "Rasur",
                hairColoring: "Haarfärbung",
                hairTreatment: "Haarbehandlung",
                kidsHaircut: "Kinderhaarschnitt",
                facial: "Gesichtsbehandlung",
                waxing: "Waxing",
                massage: "Massage",
                nailCare: "Nagelpflege",
                makeup: "Make-up",
                threading: "Threading",
                extensions: "Haarverlängerung",
                braiding: "Flechtfrisuren",
                highlights: "Strähnchen",
                balayage: "Balayage",
                perm: "Dauerwelle",
                straightening: "Haarglättung",
                scaleTreatment: "Kopfhautbehandlung",
                hotTowelService: "Heißtuch-Service",
                eyebrowShaping: "Augenbrauenformung",
                headMassage: "Kopfmassage"
            }
        }
    };

    const t = translations[language];


    const steps = [
        {id: 1, title: 'Salon', icon: Store},
        {id: 2, title: 'Availability', icon: Clock},
        {id: 3, title: 'Images', icon: Image},
        {id: 4, title: 'Categories', icon: TagIcon},
        {id: 5, title: 'Services', icon: Scissors},
        {id: 6, title: 'Team', icon: Users2},
        {id: 7, title: 'Payment', icon: CreditCard},
    ];

    const BARBERSHOP_TEMPLATES = [
        {
            id: 'classic',
            content: `
      <div class="shop-description">
        <h2 class="main-title">Welcome to [Your Shop Name]</h2>
        <p class="intro">Step into a world of timeless grooming and professional service. With [X] years of expertise, we blend traditional barbering with modern style.</p>
        
        <h3 class="section-title">Our Expertise</h3>
        <ul class="feature-list">
          <li>✂️ Traditional haircuts & modern styles</li>
          <li>✂️ Expert beard grooming & shaping</li>
          <li>✂️ Professional hot towel shaves</li>
          <li>✂️ Premium hair treatments</li>
        </ul>

        <h3 class="section-title">The Experience</h3>
        <ul class="highlight-list">
          <li>✓ Master barbers with years of experience</li>
          <li>✓ Premium products and tools</li>
          <li>✓ Clean, comfortable environment</li>
          <li>✓ Attention to detail</li>
        </ul>

        <div class="location-section">
          <h3 class="section-title">Visit Us</h3>
          <p>Located in [your area], we offer a welcoming atmosphere where you can relax and trust in expert care.</p>
        </div>
      </div>
    `
        },
        {
            id: 'modern',
            content: `
      <div class="shop-description">
        <h2 class="main-title">Experience [Your Shop Name]</h2>
        <p class="intro">Your destination for contemporary style and expert grooming. We're not just barbers - we're style consultants dedicated to your look.</p>

        <h3 class="section-title">Signature Services</h3>
        <ul class="feature-list">
          <li>🔥 Custom fade techniques</li>
          <li>🔥 Modern beard design</li>
          <li>🔥 Precision haircuts</li>
          <li>🔥 Style consultation</li>
        </ul>

        <div class="experience-section">
          <h3 class="section-title">Premium Experience</h3>
          <ul class="highlight-list">
            <li>✓ Personal style consultation</li>
            <li>✓ Relaxing scalp massage</li>
            <li>✓ Professional styling</li>
            <li>✓ Grooming advice</li>
          </ul>
        </div>

        <div class="commitment-section">
          <h3 class="section-title">Our Commitment</h3>
          <p>We stay ahead of trends while maintaining the highest standards of service.</p>
        </div>
      </div>
    `
        },
        {
            id: 'family',
            content: `
      <div class="shop-description">
        <h2 class="main-title">[Your Shop Name] - Family Barbershop</h2>
        <p class="intro">A trusted neighborhood barbershop serving families and clients of all ages. We create a welcoming environment where everyone feels at home.</p>

        <h3 class="section-title">Services for Everyone</h3>
        <ul class="feature-list">
          <li>👨 Men's haircuts</li>
          <li>👦 Children's haircuts</li>
          <li>👴 Senior styling</li>
          <li>👨‍👦 Family packages</li>
        </ul>

        <div class="promise-section">
          <h3 class="section-title">Our Promise</h3>
          <ul class="highlight-list">
            <li>✓ Patient, friendly service</li>
            <li>✓ Family-friendly atmosphere</li>
            <li>✓ Affordable prices</li>
            <li>✓ Convenient scheduling</li>
          </ul>
        </div>

        <div class="welcome-section">
          <h3 class="section-title">Visit Us</h3>
          <p>Bring the whole family to [Your Shop Name]. We ensure everyone leaves looking and feeling their best.</p>
        </div>
      </div>
    `
        }
    ];

    const {getRootProps, getInputProps} = useDropzone({
        accept: 'image/*',
        onDrop,
        multiple: false
    });

    const handleSave = async () => {
        if (shopData.categories.length === 0) {
            await Swal.fire({
                title: 'Error',
                text: translations[language].categoriesRequired,
                icon: 'error'
            });
            setCurrentStep(4);
            return;
        }

        if (!shopData.services.some(s => s.price && s.price !== '0')) {
            await Swal.fire({
                title: 'Error',
                text: 'Set at least one service price',
                icon: 'error'
            });
            setCurrentStep(8);
            return;
        }

        if (shopData.name !== shop.name && !shopNameStatus.isAvailable) {
            await Swal.fire({
                title: 'Error',
                text: 'Please choose an available shop name',
                icon: 'error'
            });
            setCurrentStep(1);
            return;
        }

        if (!shopData.paymentMethods?.length) {
            await Swal.fire({
                title: 'Error',
                text: 'Please select at least one payment method',
                icon: 'error'
            });
            setCurrentStep(7);
            return;
        }

        setIsLoading(true);
        try {
            // Arrays to hold promises for image deletions and uploads
            const imagePromises = [];
            // Initialize newImageUrls with existing image URLs
            const newImageUrls = [...shopData.imageUrls];

            // Handle image deletions
            for (const url of deletedImages) {
                const imageRef = ref(storage, url);
                imagePromises.push(deleteObject(imageRef));
                const index = newImageUrls.indexOf(url);
                if (index > -1) {
                    newImageUrls.splice(index, 1); // Remove the deleted URL from the array
                }
            }

            // Function to upload a single image and return its URL
            const uploadImage = async (image) => {
                const imageRef = ref(storage, `shops/${shop.ownerId}/${image.file.name}`);
                await uploadBytes(imageRef, image.file);
                const url = await getDownloadURL(imageRef);
                return url;
            };

            // Collect upload promises for new images (only those with a file property)
            const uploadPromises = images
                .filter(image => image.file) // Only images with a file need to be uploaded
                .map(image => uploadImage(image));

            // Wait for all image uploads to complete
            const uploadedUrls = await Promise.all(uploadPromises);

            // Append the newly uploaded URLs to the newImageUrls array
            newImageUrls.push(...uploadedUrls);

            // Wait for all image deletion promises to resolve
            await Promise.all(imagePromises);

            // Now, newImageUrls contains only string URLs
            // Proceed to update Firestore
            const shopRef = doc(db, 'barberShops', shop.id);
            await updateDoc(shopRef, {
                name: shopData.name,
                address: shopData.address,
                phoneNumber: shopData.phoneNumber,
                email: shopData.email,
                // biography: editorRef.current.getContent(),
                biography: shopData.biography,
                services: shopData.services,
                availability: shopData.availability,
                // Removed the spread operator to prevent unintended Promise inclusion
                imageUrls: newImageUrls, // This now contains only resolved URLs
                categories: shopData.categories,
                employees: shopData.employees,
                paymentMethods: shopData.paymentMethods,
                lastUpdated: serverTimestamp(),
            });

            // Notify parent component of the save
            onSave({
                ...shopData,
                id: shop.id,
                imageUrls: newImageUrls,
            });
            onClose();
        } catch (error) {
            console.error('Error updating shop:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const uploadNewImage = async (file) => {
        const imageRef = ref(storage, `shops/${shop.ownerId}/${file.name}`);
        await uploadBytes(imageRef, file);
        return getDownloadURL(imageRef);
    };


    const [draggingIndex, setDraggingIndex] = useState(null);

    // Load existing images into `images` state when the component mounts
    useEffect(() => {
        setImages(shopData.imageUrls.map((url) => ({url})));
    }, [shopData.imageUrls]);

    const handleDragStart = (index) => {
        setDraggingIndex(index);
    };

    const handleDragOver = (event, index) => {
        event.preventDefault();
        if (draggingIndex === index) return;

        const reorderedImages = [...images];
        const [draggedItem] = reorderedImages.splice(draggingIndex, 1);
        reorderedImages.splice(index, 0, draggedItem);

        setDraggingIndex(index);
        setImages(reorderedImages);
    };

    const handleDragEnd = () => {
        setDraggingIndex(null);
    };

    const handleDeleteImage = (index) => {
        const imageToDelete = images[index];
        if (imageToDelete.url) {
            // If it's an existing image, add it to deletedImages
            setDeletedImages([...deletedImages, imageToDelete.url]);
            setShopData({
                ...shopData,
                imageUrls: shopData.imageUrls.filter((url) => url !== imageToDelete.url),
            });
        }
        setImages(images.filter((_, i) => i !== index));
    };

    const generateRegistrationLink = async () => {
        const token = nanoid(16);
        const registrationLink = `${window.location.origin}/employee-register/${shop.id}/${token}`;

        try {
            // Store token in Firebase with metadata
            const shopRef = doc(db, 'barberShops', shop.id);
            await updateDoc(shopRef, {
                [`employeeRegistrationTokens.${token}`]: {
                    created: serverTimestamp(),
                    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                    used: false,
                    usedBy: null,
                    status: 'pending'
                }
            });

            // Update local state
            setGeneratedLinks(prev => ({
                ...prev,
                [token]: registrationLink
            }));

            // Show success message
            await Swal.fire({
                title: translations[language].linkGenerated || 'Link Generated',
                text: translations[language].linkExpiry || 'Link expires in 7 days',
                icon: 'success',
                timer: 2000
            });

            return registrationLink;
        } catch (error) {
            console.error('Error generating registration link:', error);
            await Swal.fire({
                title: 'Error',
                text: 'Failed to generate registration link',
                icon: 'error'
            });
        }
    };

    const revokeRegistrationLink = async (token) => {
        try {
            const shopRef = doc(db, 'barberShops', shop.id);
            await updateDoc(shopRef, {
                [`employeeRegistrationTokens.${token}.status`]: 'revoked',
                [`employeeRegistrationTokens.${token}.revokedAt`]: serverTimestamp()
            });

            // Remove from local state
            setGeneratedLinks(prev => {
                const newLinks = {...prev};
                delete newLinks[token];
                return newLinks;
            });

            await Swal.fire({
                title: 'Link Revoked',
                text: 'The registration link has been disabled',
                icon: 'success',
                timer: 2000
            });
        } catch (error) {
            console.error('Error revoking link:', error);
            await Swal.fire({
                title: 'Error',
                text: 'Failed to revoke registration link',
                icon: 'error'
            });
        }
    };

// Add this effect to listen for link status changes
    useEffect(() => {
        if (!shop.id) return;

        const shopRef = doc(db, 'barberShops', shop.id);
        const unsubscribe = onSnapshot(shopRef, (doc) => {
            const data = doc.data();
            if (data?.employeeRegistrationTokens) {
                setLinkStatuses(data.employeeRegistrationTokens);
            }
        });

        return () => unsubscribe();
    }, [shop.id]);

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="label">Shop Name</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className={`input input-bordered w-full ${
                                        shopNameStatus.isAvailable === false ? 'input-error' :
                                            shopNameStatus.isAvailable === true ? 'input-success' : ''
                                    }`}
                                    value={shopData.name}
                                    onChange={handleShopNameChange}
                                />
                                <AnimatePresence>
                                    {shopNameStatus.isChecking && (
                                        <motion.div
                                            initial={{opacity: 0, y: 10}}
                                            animate={{opacity: 1, y: 0}}
                                            exit={{opacity: 0, y: -10}}
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                        >
                                            <span className="loading loading-spinner loading-sm text-primary"/>
                                        </motion.div>
                                    )}

                                    {shopData.name !== shop.name && shopNameStatus.isAvailable === false && (
                                        <motion.div
                                            initial={{opacity: 0, height: 0}}
                                            animate={{opacity: 1, height: 'auto'}}
                                            exit={{opacity: 0, height: 0}}
                                            className="mt-2 space-y-2"
                                        >
                                            <p className="text-error text-sm">This name is already taken.</p>
                                            {shopNameStatus.suggestions.length > 0 && (
                                                <div className="bg-base-200 p-3 rounded-lg">
                                                    <p className="text-sm font-medium mb-2">Available alternatives:</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {shopNameStatus.suggestions.map((suggestion, index) => (
                                                            <motion.button
                                                                key={index}
                                                                onClick={() => {
                                                                    setShopData({...shopData, name: suggestion});
                                                                    setShopNameStatus({
                                                                        isChecking: false,
                                                                        isAvailable: true,
                                                                        suggestions: [],
                                                                        similar: []
                                                                    });
                                                                }}
                                                                whileHover={{scale: 1.02}}
                                                                whileTap={{scale: 0.98}}
                                                                className="btn btn-sm btn-ghost text-left w-full"
                                                            >
                                                                {suggestion}
                                                            </motion.button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {shopData.name !== shop.name && shopNameStatus.isAvailable === true && (
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
                        </div>
                        <div className="relative">
                            <label className="label">Address</label>
                            <div className="relative mt-1">
                                <input
                                    ref={addressInputRef}
                                    type="text"
                                    className="block w-full input input-bordered pr-10"
                                    value={shopData.address}
                                    onChange={handleAddressChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (shopData.address.trim()) {
                                                setIsSuggestionSelected(true);
                                                setAddressSuggestions([]);
                                                setIsAddingCustomAddress(false);
                                            }
                                        } else if (e.key === 'Escape') {
                                            setAddressSuggestions([]);
                                            setIsAddingCustomAddress(false);
                                        }
                                    }}
                                    placeholder="Enter your shop's address"
                                />
                                {shopData.address && !isSuggestionSelected && !isAddingCustomAddress && (
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
                            {(addressSuggestions.length > 0 || (shopData.address.length > 3 && !isSuggestionSelected)) && (
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
                                    {!isAddingCustomAddress && shopData.address.length > 3 && (
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
                            'Use this address'}: "{shopData.address}"
            </span>
                                                <Check
                                                    className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Mobile Hint */}
                            {!isSuggestionSelected && shopData.address.length > 3 && (
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
                        <div>
                            <label className="label">Phone Number</label>
                            <PhoneInput
                                country="tr"
                                value={shopData.phoneNumber}
                                onChange={(value) => setShopData({...shopData, phoneNumber: value})}
                                inputClass="input input-bordered w-full"
                            />
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input input-bordered w-full"
                                value={shopData.email}
                                onChange={(e) => setShopData({...shopData, email: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="label">Description</label>
                            <div className="space-y-4">
                                <TemplateSelector
                                    onTemplateSelect={(template) => {
                                        if (editorRef.current) {
                                            const content = BARBERSHOP_TEMPLATES.find(t => t.id === template.id).content;
                                            editorRef.current.setContent(content);
                                            // Store in shopData to preserve between fullscreen toggles
                                            setShopData(prev => ({
                                                ...prev,
                                                description: content,
                                                selectedTemplate: template.id
                                            }));
                                        }
                                    }}
                                    selectedTemplate={shopData.selectedTemplate}
                                    language={language}
                                />
                                <FullscreenEditorWrapper editorRef={editorRef}>
                                    <Editor
                                        apiKey='6eke8w2nyjpg9rotzvxhe9klva3y1xetkxmbp50pjy5klfjb'
                                        onInit={(evt, editor) => {
                                            editorRef.current = editor;
                                        }}
                                        initialValue={shop.biography}
                                        onEditorChange={(content) => {
                                            setShopData(prev => ({
                                                ...prev,
                                                biography: content  // Update this to match
                                            }));
                                        }}
                                        init={{
                                            height: 300,
                                            menubar: false,
                                            plugins: [
                                                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                                                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                                                'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                                            ],
                                            toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | help',
                                            setup: (editor) => {
                                                editor.on('init', () => {
                                                    editor.execCommand('mceAutoResize');
                                                });
                                            }
                                        }}
                                    />
                                </FullscreenEditorWrapper>
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return <ShopAvailabilityEditor
                    shop={{
                        ...shopData,
                        id: shop.id, // Explicitly ensure ID is passed
                        ownerId: shop.ownerId // Include this if needed
                    }}
                    onSave={(updatedShop) => {
                        setShopData(updatedShop);
                        setCurrentStep(3);
                    }}
                />;

            case 3:
                return (
                    <div className="space-y-4">
                        <div
                            {...getRootProps()}
                            className="border-2 border-dashed p-8 text-center rounded-lg"
                        >
                            <input {...getInputProps()} />
                            <p>Drop images here or click to select</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <AnimatePresence>
                                {images.map((image, index) => (
                                    <motion.div
                                        key={image.url || image.preview} // Use URL for existing or preview for new images
                                        drag
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(event) => handleDragOver(event, index)}
                                        onDragEnd={handleDragEnd}
                                        layout
                                        className="relative cursor-grab active:cursor-grabbing"
                                    >
                                        <img
                                            src={image.url || image.preview} // Display correct source
                                            alt={`Image ${index + 1}`}
                                            className="w-full h-32 object-cover rounded-lg"
                                        />
                                        <button
                                            onClick={() => handleDeleteImage(index)}
                                            className="absolute top-2 right-2 btn btn-circle btn-error btn-sm"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3-10a1 1 0 00-1-1H8a1 1 0 000 2h4a1 1 0 001-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <ShopCategorySelector
                        value={shopData.categories}
                        onChange={(newCategories) => {
                            setShopData({
                                ...shopData,
                                categories: newCategories
                            });
                        }}
                        error={null}
                    />
                );

            case 5:
                return (
                    <div className="space-y-4">
                        <div className="bg-base-200 p-4 rounded-lg">
                            <h3 className="font-medium mb-2">Quick Add Services</h3>
                            <PresetServiceSelector
                                onServiceSelect={(service) => {
                                    if (!shopData.services.some(s =>
                                        s.name === service.name && s.price === service.price
                                    )) {
                                        setShopData({
                                            ...shopData,
                                            services: [...shopData.services, service]
                                        });
                                    }
                                }}
                            />
                        </div>

                        {shopData.services.map((service, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    className="input input-bordered flex-grow"
                                    value={service.name}
                                    onChange={(e) => {
                                        const newServices = [...shopData.services];
                                        newServices[index].name = e.target.value;
                                        setShopData({...shopData, services: newServices});
                                    }}
                                    placeholder="Service name"
                                />
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="input input-bordered w-24 pl-6"
                                        value={service.price}
                                        onChange={(e) => {
                                            const newServices = [...shopData.services];
                                            newServices[index].price = e.target.value.replace(/[^0-9]/g, '');
                                            setShopData({...shopData, services: newServices});
                                        }}
                                        placeholder="Price"
                                    />
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2">€</span>
                                </div>
                                <button
                                    onClick={() => {
                                        const newServices = shopData.services.filter((_, i) => i !== index);
                                        setShopData({...shopData, services: newServices});
                                    }}
                                    className="btn btn-circle btn-sm"
                                >
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={() => setShopData({
                                ...shopData,
                                services: [...shopData.services, {name: '', price: ''}]
                            })}
                            className="btn btn-secondary btn-sm"
                        >
                            Add Service
                        </button>
                    </div>
                );

            case 6:
                return (
                    <>
                        <div className="card bg-base-200 mt-6">
                            <div className="card-body">
                                <h3 className="card-title">Generate Registration Links</h3>
                                <p className="text-sm text-base-content/70">
                                    Generate links for employees to register themselves
                                </p>

                                {/* Generated Links List */}
                                <div className="space-y-4 mt-4">
                                    {Object.entries(generatedLinks).map(([token, link]) => {
                                        const status = linkStatuses[token]?.status || 'pending';
                                        const isUsed = status === 'used';
                                        const isRevoked = status === 'revoked';
                                        const isExpired = linkStatuses[token]?.expires?.toDate() < new Date();

                                        return (
                                            <div key={token} className={`flex flex-col p-4 bg-base-100 rounded-lg break-words
                ${isUsed || isRevoked || isExpired ? 'opacity-50' : ''}`}>
                                                <div className="w-full">
                                                    <code
                                                        className="text-sm whitespace-pre-wrap break-all">{link}</code>
                                                </div>

                                                <div
                                                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-2 gap-2">
                    <span className={`text-xs ${
                        isUsed ? 'text-success' :
                            isRevoked ? 'text-error' :
                                isExpired ? 'text-warning' :
                                    'text-info'
                    }`}>
                        {isUsed ? '✓ Used' :
                            isRevoked ? '× Revoked' :
                                isExpired ? '⚠ Expired' :
                                    '○ Active'}
                    </span>

                                                    {!isUsed && !isRevoked && !isExpired && (
                                                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                                            <button
                                                                className={`btn btn-sm flex-1 sm:flex-none ${copiedLinks[token] ? 'btn-success' : 'btn-primary'}`}
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(link);
                                                                    setCopiedLinks(prev => ({
                                                                        ...prev,
                                                                        [token]: true
                                                                    }));
                                                                    setTimeout(() => {
                                                                        setCopiedLinks(prev => ({
                                                                            ...prev,
                                                                            [token]: false
                                                                        }));
                                                                    }, 2000);
                                                                }}
                                                            >
                                                                {copiedLinks[token] ? (
                                                                    <>
                                                                        <Check className="w-4 h-4 mr-1"/>
                                                                        Copied!
                                                                    </>
                                                                ) : (
                                                                    'Copy Link'
                                                                )}
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-error flex-1 sm:flex-none"
                                                                onClick={() => revokeRegistrationLink(token)}
                                                            >
                                                                Revoke
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Generate Link Button */}
                                <button
                                    onClick={generateRegistrationLink}
                                    className="btn btn-primary mt-4"
                                >
                                    Generate New Registration Link
                                </button>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {/* Current Employees List */}
                            {shopData.employees?.length > 0 && (
                                <div className="bg-base-200 p-4 rounded-lg">
                                    <h3 className="font-medium mb-4">Current Team Members</h3>
                                    <div className="space-y-4">
                                        {shopData.employees.map((employee, index) => (
                                            <div key={employee.id}
                                                 className="flex items-center gap-4 p-3 bg-base-100 rounded-lg shadow group">
                                                <div className="avatar">
                                                    <div className="w-16 h-16 rounded-full">
                                                        <img
                                                            src={employee.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${employee.name}`}
                                                            alt={employee.name}
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-lg">{employee.name}</h4>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {employee.expertise?.map((skill, idx) => (
                                                            <span key={idx}
                                                                  className="badge badge-sm">{skill}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const updatedEmployees = shopData.employees.filter(
                                                            (_, i) => i !== index
                                                        );
                                                        setShopData({
                                                            ...shopData,
                                                            employees: updatedEmployees
                                                        });
                                                    }}
                                                    className="btn btn-ghost btn-sm text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Add New Employee Form */}
                            <div className="card bg-base-200">
                                <div className="card-body">
                                    <h3 className="card-title">Add New Team Member</h3>

                                    {/* Name Input */}
                                    <div className="form-control">
                                        <label className="label">Name</label>
                                        <input
                                            type="text"
                                            className="input input-bordered"
                                            value={newEmployee.name}
                                            onChange={(e) => setNewEmployee({
                                                ...newEmployee,
                                                name: e.target.value
                                            })}
                                        />
                                    </div>

                                    {/* Photo Upload */}
                                    <div className="form-control">
                                        <label className="label">Photo</label>
                                        <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    if (e.target.files[0]) {
                                                        setSelectedImage(URL.createObjectURL(e.target.files[0]));
                                                        setCropModalOpen(true);
                                                    }
                                                }}
                                                className="hidden"
                                                id="employee-photo"
                                            />
                                            <label htmlFor="employee-photo" className="cursor-pointer">
                                                {newEmployee.photo ? (
                                                    <div className="relative inline-block">
                                                        <img
                                                            src={URL.createObjectURL(newEmployee.photo)}
                                                            alt="Preview"
                                                            className="w-32 h-32 rounded-lg object-cover"
                                                        />
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setNewEmployee({
                                                                    ...newEmployee,
                                                                    photo: null
                                                                });
                                                            }}
                                                            className="absolute -top-2 -right-2 btn btn-error btn-circle btn-xs"
                                                        >
                                                            <X className="w-3 h-3"/>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-base-content/50">
                                                        <Camera className="w-10 h-10 mx-auto mb-2"/>
                                                        <p>Click to upload photo</p>
                                                    </div>
                                                )}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Expertise Tags */}
                                    {/* Expertise Selection */}
                                    <div className="form-control">
                                        <label className="label font-medium text-base">
                                            {t.expertise || "Expertise"}
                                        </label>
                                        <div className="dropdown w-full">
                                            <motion.div
                                                tabIndex={0}
                                                className="border-2 rounded-xl p-4 w-full cursor-pointer hover:border-primary transition-colors flex flex-wrap gap-2 min-h-[4rem]"
                                                whileHover={{scale: 1.01}}
                                                whileTap={{scale: 0.99}}
                                            >
                                                {newEmployee.expertise.length > 0 ? (
                                                    newEmployee.expertise.map(skill => (
                                                        <motion.span
                                                            key={skill}
                                                            initial={{opacity: 0, scale: 0.8}}
                                                            animate={{opacity: 1, scale: 1}}
                                                            exit={{opacity: 0, scale: 0.8}}
                                                            className="badge badge-primary badge-lg gap-1 px-3 py-3"
                                                        >
                                                            {translations[language]?.services?.[skill] || skill}
                                                            <motion.button
                                                                whileHover={{scale: 1.2}}
                                                                whileTap={{scale: 0.9}}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const updatedExpertise = newEmployee.expertise.filter(t => t !== skill);
                                                                    setNewEmployee({
                                                                        ...newEmployee,
                                                                        expertise: updatedExpertise
                                                                    });
                                                                }}
                                                                className="ml-1"
                                                            >
                                                                ×
                                                            </motion.button>
                                                        </motion.span>
                                                    ))
                                                ) : (
                                                    <span
                                                        className="text-base-content/50 text-lg">Select expertise</span>
                                                )}
                                            </motion.div>
                                            <div tabIndex={0}
                                                 className="dropdown-content z-50 w-full p-3 shadow-2xl bg-base-100 rounded-xl max-h-[70vh] overflow-auto mt-2">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {[
                                                        'haircut', 'beardTrim', 'shave', 'hairColoring', 'hairTreatment',
                                                        'kidsHaircut', 'facial', 'waxing', 'massage', 'nailCare',
                                                        'makeup', 'threading', 'extensions', 'braiding', 'highlights',
                                                        'balayage', 'perm', 'straightening', 'scaleTreatment',
                                                        'hotTowelService', 'eyebrowShaping', 'headMassage'
                                                    ].map(skill => (
                                                        <motion.label
                                                            key={skill}
                                                            className="flex items-center p-3 hover:bg-base-200 rounded-xl cursor-pointer transition-colors"
                                                            whileHover={{backgroundColor: 'hsl(var(--b2))'}}
                                                            whileTap={{scale: 0.98}}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="checkbox checkbox-primary checkbox-md mr-4"
                                                                checked={newEmployee.expertise.includes(skill)}
                                                                onChange={(e) => {
                                                                    const updatedExpertise = e.target.checked
                                                                        ? [...newEmployee.expertise, skill]
                                                                        : newEmployee.expertise.filter(t => t !== skill);
                                                                    setNewEmployee({
                                                                        ...newEmployee,
                                                                        expertise: updatedExpertise
                                                                    });
                                                                }}
                                                            />
                                                            <span
                                                                className="text-lg">{translations[language]?.services?.[skill] || skill}</span>
                                                        </motion.label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Schedule */}
                                    <div className="form-control">
                                        <label className="label">Working Hours</label>
                                        <WeeklyScheduleSelector
                                            schedule={newEmployee.schedule}
                                            onScheduleChange={(newSchedule) =>
                                                setNewEmployee({
                                                    ...newEmployee,
                                                    schedule: newSchedule
                                                })
                                            }
                                            language={language}
                                        />
                                    </div>

                                    {/* Add Employee Button */}
                                    <button
                                        onClick={async () => {
                                            if (!newEmployee.name || !newEmployee.photo || newEmployee.expertise.length === 0) {
                                                return;
                                            }

                                            // Create loading overlay
                                            const loadingContainer = document.createElement('div');
                                            document.body.appendChild(loadingContainer);
                                            const root = createRoot(loadingContainer);
                                            root.render(<ScissorsLoader message="Adding team member..."/>);

                                            try {
                                                const photoRef = ref(storage, `shops/${shop.id}/employees/${newEmployee.name}-${nanoid(6)}`);
                                                await uploadBytes(photoRef, newEmployee.photo);
                                                const photoUrl = await getDownloadURL(photoRef);

                                                const employeeData = {
                                                    id: nanoid(),
                                                    name: newEmployee.name,
                                                    photo: photoUrl,
                                                    expertise: newEmployee.expertise,
                                                    schedule: newEmployee.schedule
                                                };

                                                setShopData({
                                                    ...shopData,
                                                    employees: [...shopData.employees, employeeData]
                                                });

                                                // Reset form state
                                                setNewEmployee({
                                                    name: '',
                                                    photo: null,
                                                    expertise: [],
                                                    schedule: {
                                                        Monday: [],
                                                        Tuesday: [],
                                                        Wednesday: [],
                                                        Thursday: [],
                                                        Friday: [],
                                                        Saturday: [],
                                                        Sunday: []
                                                    }
                                                });

                                                // Remove loading overlay
                                                root.unmount();
                                                document.body.removeChild(loadingContainer);

                                                await Swal.fire({
                                                    title: 'Success',
                                                    text: 'Team member added successfully',
                                                    icon: 'success',
                                                    timer: 2000
                                                });
                                            } catch (error) {
                                                console.error('Error adding employee:', error);
                                                root.unmount();
                                                document.body.removeChild(loadingContainer);
                                                await Swal.fire({
                                                    title: 'Error',
                                                    text: 'Failed to add team member',
                                                    icon: 'error'
                                                });
                                            }
                                        }}
                                        className="btn btn-primary mt-4"
                                    >
                                        Add Team Member
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                );

            case 7:
                return (
                    <BarbershopPaymentEditor
                        shopId={shop.id}
                        initialMethods={shopData.paymentMethods || []}
                        onSelect={(methods) => setShopData({...shopData, paymentMethods: methods})}
                    />
                );
            default:
                return null;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-base-100 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Edit {shop.name}</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-circle">
                        <X className="w-6 h-6"/>
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="flex justify-between mb-8">
                    {steps.map((step) => (
                        <button
                            key={step.id}
                            onClick={() => setCurrentStep(step.id)}
                            className={`flex flex-col items-center ${
                                currentStep === step.id
                                    ? 'text-primary'
                                    : currentStep > step.id
                                        ? 'text-success'
                                        : 'text-base-content/50'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                                currentStep === step.id
                                    ? 'bg-primary text-primary-content'
                                    : currentStep > step.id
                                        ? 'bg-success text-success-content'
                                        : 'bg-base-300'
                            }`}>
                                {currentStep > step.id ? <Check className="w-6 h-6"/> :
                                    <step.icon className="w-6 h-6"/>}
                            </div>
                            <span className="text-sm font-medium">{step.title}</span>
                        </button>
                    ))}
                </div>

                {/* Step Content */}
                <div className="mb-8">
                    {renderStepContent()}
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-8">
                    <button
                        onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                        className="btn btn-ghost"
                        disabled={currentStep === 1}
                    >
                        {t.previous}
                    </button>

                    {currentStep < steps.length ? (
                        <button
                            onClick={() => {
                                // Add validation for categories step
                                if (currentStep === 4 && shopData.categories.length === 0) {
                                    Swal.fire({
                                        title: 'Error',
                                        text: translations[language].categoriesRequired,
                                        icon: 'error'
                                    });
                                    return;
                                }
                                setCurrentStep(currentStep + 1);
                            }}
                            className="btn btn-primary"
                        >
                            {t.next}
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            className="btn btn-primary"
                            disabled={
                                isLoading ||
                                shopData.categories.length === 0 ||
                                !shopData.services.some(s => s.price && s.price !== '0') ||
                                !shopData.paymentMethods?.length  // Add this line
                            }
                        >
                            {isLoading ? t.saving : t.saveChanges}
                        </button>
                    )}
                </div>
            </div>

            <ImageCropModal
                isOpen={cropModalOpen}
                onClose={() => setCropModalOpen(false)}
                imageSrc={selectedImage}
                onCropComplete={handleCropComplete}
            />
        </div>
    );
};

export default EditBarberShopModal;