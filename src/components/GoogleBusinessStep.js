/**
 * @fileoverview GoogleBusinessStep Component
 * 
 * A comprehensive component for integrating a barbershop with Google Business Profile.
 * Handles the complete flow of creating and managing a Google Business listing.
 * 
 * Key Features:
 * - Google Business Profile API integration
 * - Automated business listing creation
 * - Location verification handling
 * - Business hours synchronization
 * - Service catalog management
 * - Photo upload and management
 * - Review management integration
 * 
 * Technical Capabilities:
 * - OAuth2 authentication flow
 * - Geocoding integration
 * - Places API integration
 * - Retry mechanism with exponential backoff
 * - Error handling and recovery
 * - Rate limiting compliance
 * 
 * Props:
 * @param {Function} onBack - Navigation handler for previous step
 * @param {Function} onNext - Navigation handler for next step
 * @param {string} shopId - Shop identifier
 * @param {Object} shopData - Complete shop information
 * 
 * @example
 * <GoogleBusinessStep
 *   onBack={handleBack}
 *   onNext={handleNext}
 *   shopId="shop123"
 *   shopData={shopInformation}
 * />
 */

import React, {useEffect, useState} from 'react';
import {BarChart3, Building2, ChevronRight, Globe2, Medal, Search, Star, Users2} from 'lucide-react';
import Swal from 'sweetalert2';
import {getDownloadURL, ref, uploadBytes} from "firebase/storage";
import {nanoid} from "nanoid";
import {db, storage} from "../firebase";
import {addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc} from "firebase/firestore";
import {getAuth, onAuthStateChanged} from "firebase/auth";
import {useNavigate} from "react-router-dom";
import SuccessCelebration from "./SuccessCelebration";
import ReactDOM from 'react-dom/client';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const GOOGLE_API_SCOPE = [
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/userinfo.profile'
].join(' '); // Removed invalid scope

const GOOGLE_BUSINESS_API_ENDPOINT = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const getDomain = () => {
    // Check if we're in development
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3000';
    }

    // In production, use the current domain
    return window.location.origin;
};

const GoogleBusinessStep = ({onNext, onBack, shopData, tempShopId}) => {
    const [gapiLoaded, setGapiLoaded] = useState(false);
    const [wantsToCreate, setWantsToCreate] = useState(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [googleClient, setGoogleClient] = useState(null);
    const [user, setUser] = useState(null); // Add this state
    const navigate = useNavigate();
    const [loadingButton, setLoadingButton] = useState(null); // 'skip-now', 'skip', or 'publish'
    // const tempShopDoc = getDoc(doc(db, 'barberShops', tempShopId));

    const auth = getAuth(); // Add this

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                navigate('/auth');
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const getGeocode = async (address) => {
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
            );
            const data = await response.json();

            if (data.results && data.results[0]) {
                const location = data.results[0].geometry.location;
                const addressComponents = data.results[0].address_components;

                // Extract address components
                const locality = addressComponents.find(c => c.types.includes('locality'))?.long_name || '';
                const administrative_area = addressComponents.find(c => c.types.includes('administrative_area_level_1'))?.long_name || '';
                const postal_code = addressComponents.find(c => c.types.includes('postal_code'))?.long_name || '';

                return {
                    latitude: location.lat,
                    longitude: location.lng,
                    locality,
                    administrative_area,
                    postal_code
                };
            }
            throw new Error('No results found');
        } catch (error) {
            console.error('Geocoding error:', error);
            return {
                latitude: 0,
                longitude: 0,
                locality: '',
                administrative_area: '',
                postal_code: ''
            };
        }
    };

    // Load Google's Identity Services library
    useEffect(() => {
        const loadGoogleIdentity = () => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (window.google) {
                    initializeGoogleClient();
                    setGapiLoaded(true);
                }
            };
            script.onerror = () => {
                console.error('Failed to load Google Identity Services');
                Swal.fire({
                    title: 'Error',
                    text: 'Failed to load Google services. Please refresh and try again.',
                    icon: 'error'
                });
            };
            document.body.appendChild(script);

            return () => {
                document.body.removeChild(script);
            };
        };

        loadGoogleIdentity();
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                // Handle not authenticated state
                navigate('/auth');
            }
        });

        return () => unsubscribe();
    }, []);

    const handleStoreCreation = async (skipGoogle = true, buttonId) => {
        try {
            setLoadingButton(buttonId);
            if (!user) {
                throw new Error('User not authenticated');
            }

            setIsCreating(true);

            const tempShopDoc = await getDoc(doc(db, 'tempShops', tempShopId));
            const tempShopData = tempShopDoc.exists() ? tempShopDoc.data() : {};

            // Get the temporary employee document if it exists
            // const tempShopDoc = await getDoc(doc(db, 'barberShops', tempShopId));

            // Move employeeData initialization here, before it's used
            let employeeData = [];
            if (tempShopDoc.exists()) {
                const selfRegisteredEmployees = tempShopDoc.data().employees || [];
                const manuallyAddedEmployees = tempShopDoc.data().manualEmployees || [];
                console.log('Self Registered Employees:', selfRegisteredEmployees);
                console.log('Manually Added Employees:', manuallyAddedEmployees);
                employeeData = [...selfRegisteredEmployees, ...manuallyAddedEmployees];
                console.log('Combined Employee Data:', employeeData);
            }

            const validServices = shopData.services.filter(service =>
                service.name.trim() &&
                service.price.trim() &&
                service.duration?.trim()
            ).map(service => ({
                name: service.name,
                price: service.price,
                duration: service.duration || '30',
                description: service.description || '',
                // The images are being saved with the full Firebase download URL in service.images[].url
                imageUrls: service.images ? service.images.map(img => img.url) : []
            }));

            console.log('Services validation:', {
                original: shopData.services,
                valid: validServices,
                invalidCount: shopData.services.length - validServices.length
            });

            console.log('Shop Data Before Processing:', shopData);
            console.log('Valid Services:', validServices);

            const imageUrls = await Promise.all(shopData.images.map(async (image) => {
                const imageRef = ref(storage, `shops/${user.uid}/${image.name}`);
                await uploadBytes(imageRef, image);
                return getDownloadURL(imageRef);
            }));

            console.log('Image URLs:', imageUrls);

            const uniqueUrl = nanoid(10);
            const uniqueImageUrls = [...new Set(imageUrls)];

            const cleanAvailability = {};
            Object.entries(shopData.availability).forEach(([day, hours]) => {
                if (hours && hours.open && hours.close) {
                    cleanAvailability[day] = {
                        open: hours.open,
                        close: hours.close,
                        slotDuration: hours.slotDuration || 30
                    };
                }
            });

            console.log('Cleaned Availability:', cleanAvailability);
            console.log('Shop Data Before Processing:', shopData);
            console.log('Shop Description:', shopData.description);
            console.log('Shop Biography:', shopData.biography);

            const completeShopData = {
                name: shopData.name,
                address: shopData.address,
                phoneNumber: shopData.phoneNumber,
                email: shopData.email,
                biography: shopData.description || '',
                services: validServices.map(service => ({
                    name: service.name,
                    price: service.price,
                    duration: service.duration || '30',
                    description: service.description || '',
                    imageUrls: service.imageUrls || []
                })),
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                uniqueUrl: uniqueUrl,
                availability: cleanAvailability,
                imageUrls: uniqueImageUrls,
                specialDates: shopData.specialDates || {},
                categories: shopData.categories || [],
                paymentMethods: shopData.paymentMethods || [],
                pricingTier: shopData.pricingTier,
                // employees: employeeData,
                employees: tempShopData.employees || [],
                employeeRegistrationTokens: tempShopData.employeeRegistrationTokens || {},
                // employeeRegistrationTokens: tempShopDoc.exists() ?
                //     tempShopDoc.data().employeeRegistrationTokens || {} : {},
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
                blocks: [
                    { id: 'header', type: 'header', active: true },
                    { id: 'services', type: 'services', active: true },
                    { id: 'gallery', type: 'gallery', active: true },
                    { id: 'team', type: 'team', active: true },
                    { id: 'contact', type: 'contact', active: true },
                    { id: 'reviews', type: 'reviews', active: true },
                    { id: 'availability', type: 'availability', active: true },
                    { id: 'cta', type: 'cta', active: true },
                    { id: 'features', type: 'features', active: true },
                    { id: 'footer', type: 'footer', active: true }
                ]
            };

            console.log('Special Dates being saved:', shopData.specialDates);
            console.log('Complete Shop Data:', completeShopData);
            console.log('Data Types:', {
                name: typeof completeShopData.name,
                address: typeof completeShopData.address,
                phoneNumber: typeof completeShopData.phoneNumber,
                email: typeof completeShopData.email,
                biography: typeof completeShopData.biography,
                services: Array.isArray(completeShopData.services),
                ownerId: typeof completeShopData.ownerId,
                uniqueUrl: typeof completeShopData.uniqueUrl,
                availability: typeof completeShopData.availability
            });

            console.log('Editor Content being saved:', completeShopData.biography);

            const docRef = await addDoc(collection(db, 'barberShops'), {
                ...completeShopData,
                employeeRegistrationTokens: tempShopData.employeeRegistrationTokens || {} // Add this line
            });

            // Add this code to update tempShop with the new barberShop ID
            await updateDoc(doc(db, 'tempShops', tempShopId), {
                publishedShopId: docRef.id,
                isPublished: true
            });

            localStorage.removeItem('barbershop_draft');
            await deleteDoc(doc(db, 'shopDrafts', user.uid));

            console.log('Barber shop created with ID: ', docRef.id);

            setIsCreating(false);
            setLoadingButton(null);

            if (skipGoogle) {
                await Swal.fire({
                    title: 'Success!',
                    text: 'Your shop has been created successfully!',
                    icon: 'success',
                    confirmButtonText: 'OK',
                    didOpen: () => {
                        const celebrationDiv = document.createElement('div');
                        celebrationDiv.id = 'success-celebration';
                        document.body.appendChild(celebrationDiv);

                        const root = ReactDOM.createRoot(celebrationDiv);
                        root.render(<SuccessCelebration />);
                    },
                    willClose: () => {
                        const element = document.getElementById('success-celebration');
                        if (element) {
                            const root = ReactDOM.createRoot(element);
                            root.unmount();
                            element.remove();
                        }
                    }
                });

                onNext({
                    wantsToCreate: false,
                    storeData: {
                        id: docRef.id,
                        ...completeShopData
                    }
                });
            }

            return {
                id: docRef.id,
                ...completeShopData
            };

        } catch (error) {
            console.error('Detailed Error:', error);
            console.error('Error Stack:', error.stack);
            throw error;
        } finally {
            if (skipGoogle) {
                setLoadingButton(null);
                setIsCreating(false);
            }
        }
    };

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const getRetryDelay = (retryCount, retryAfter = null) => {
        if (retryAfter) {
            // Google API sometimes returns decimal seconds
            return Math.ceil(parseFloat(retryAfter) * 1000);
        }
        // Implement proper exponential backoff
        const baseDelay = Math.min(1000 * Math.pow(2, retryCount), 32000); // Max 32 seconds
        const jitter = Math.random() * Math.min(1000 * Math.pow(2, retryCount - 1), 1000);
        return baseDelay + jitter;
    };

    const fetchWithRetry = async (url, options, maxRetries = 3) => {
        let retryCount = 0;
        let lastError = null;

        while (retryCount < maxRetries) {
            try {
                console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries} for ${url}`);
                console.log('Request options:', {
                    method: options.method,
                    headers: options.headers,
                    body: options.body ? JSON.parse(options.body) : undefined
                });

                const response = await fetch(url, options);
                const responseText = await response.text(); // Get raw response text first

                console.log(`📥 Response status: ${response.status}`);
                console.log('Response headers:', Object.fromEntries([...response.headers]));
                console.log('Raw response:', responseText);

                let responseData;
                try {
                    responseData = responseText ? JSON.parse(responseText) : null;
                } catch (e) {
                    console.error('Failed to parse response as JSON:', responseText);
                    throw new Error(`Invalid JSON response: ${responseText}`);
                }

                if (!response.ok) {
                    const errorDetails = {
                        status: response.status,
                        statusText: response.statusText,
                        error: responseData?.error,
                        raw: responseText
                    };
                    console.error('API Error Details:', errorDetails);
                    throw new Error(JSON.stringify(errorDetails));
                }

                return {response, data: responseData};

            } catch (error) {
                lastError = error;
                console.error(`❌ Attempt ${retryCount + 1} failed:`, {
                    message: error.message,
                    stack: error.stack
                });

                if (error.message.includes('401') || error.message.includes('403')) {
                    console.error('🚫 Authentication error - not retrying');
                    throw new Error(`Authentication failed: ${error.message}`);
                }

                if (retryCount < maxRetries - 1) {
                    const delay = getRetryDelay(retryCount);
                    console.log(`⏳ Waiting ${delay / 1000} seconds before retry...`);
                    await wait(delay);
                    retryCount++;
                } else {
                    console.error('❌ All retry attempts failed');
                    throw new Error(`All retry attempts failed: ${error.message}`);
                }
            }
        }

        throw lastError || new Error('Operation failed after maximum retries');
    };

    // Initialize Google OAuth client
    // const initializeGoogleClient = () => {
    //     const client = window.google.accounts.oauth2.initTokenClient({
    //         client_id: GOOGLE_CLIENT_ID,
    //         scope: GOOGLE_API_SCOPE,
    //         callback: handleAuthResponse,
    //         error_callback: (error) => {
    //             console.error('Google Auth Error:', error);
    //             setIsCreating(false);
    //             Swal.fire({
    //                 title: 'Authentication Error',
    //                 text: 'Failed to authenticate with Google. Please try again.',
    //                 icon: 'error'
    //             });
    //         }
    //     });
    //     setGoogleClient(client);
    // };

    const createPlaceListing = async (shopData, accessToken) => {
        try {
            console.log('🏪 Starting place creation process...');

            // 1. First geocode the address to get coordinates
            const geocodeResponse = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(shopData.address)}&key=${GOOGLE_MAPS_API_KEY}`
            );
            const geocodeData = await geocodeResponse.json();

            if (!geocodeData.results?.length) {
                throw new Error('Could not geocode address');
            }

            const location = geocodeData.results[0].geometry.location;
            const addressComponents = extractAddressComponents(geocodeData.results[0].address_components);

            // 2. Format the business hours
            const businessHours = Object.entries(shopData.availability)
                .filter(([_, hours]) => hours && hours.open && hours.close)
                .map(([day, hours]) => ({
                    day: day.toUpperCase(),
                    time: `${hours.open.replace(':', '')}–${hours.close.replace(':', '')}`
                }));

            // 3. Prepare the place data
            const placeData = {
                location: {
                    lat: location.lat,
                    lng: location.lng
                },
                accuracy: 50,
                name: shopData.name,
                address: shopData.address,
                phone_number: shopData.phoneNumber,
                types: ["beauty_salon", "hair_care", "point_of_interest", "establishment"],
                language: "en",
                opening_hours: {
                    periods: businessHours
                },
                // Add address components
                address_components: {
                    street_number: addressComponents.street_number,
                    route: addressComponents.route,
                    locality: addressComponents.locality,
                    sublocality: addressComponents.sublocality,
                    administrative_area_level_1: addressComponents.administrative_area_level_1,
                    administrative_area_level_2: addressComponents.administrative_area_level_2,
                    country: addressComponents.country,
                    postal_code: addressComponents.postal_code
                },
                // Add primary category
                primary_type: "beauty_salon",
                // Add website URL if available
                website: `${window.location.origin}/shop/${shopData.uniqueUrl}`,
                // Add formatted phone number
                international_phone_number: shopData.phoneNumber
            };

            console.log('📦 Place payload:', placeData);

            // 4. Create the place using Places API
            const response = await fetch('https://maps.googleapis.com/maps/api/place/add/json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(placeData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(JSON.stringify(data.error || 'Failed to create place'));
            }

            console.log('✅ Place created successfully:', data);

            // 5. If successful, try to add photos
            if (data.place_id && shopData.imageUrls?.length) {
                console.log('📸 Adding photos to place...');

                for (const imageUrl of shopData.imageUrls) {
                    try {
                        const imageResponse = await fetch(imageUrl);
                        const imageBlob = await imageResponse.blob();

                        const formData = new FormData();
                        formData.append('photo', imageBlob);
                        formData.append('place_id', data.place_id);

                        await fetch('https://maps.googleapis.com/maps/api/place/photo/add', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`
                            },
                            body: formData
                        });
                    } catch (photoError) {
                        console.error('Error adding photo:', photoError);
                        // Continue with other photos even if one fails
                    }
                }
            }

            // 6. Update Firestore with place_id
            await updateDoc(doc(db, 'barberShops', shopData.id), {
                google_place_id: data.place_id,
                google_place_created: serverTimestamp()
            });

            return data;

        } catch (error) {
            console.error('❌ Error creating place:', error);
            throw error;
        }
    };

// Utility function to extract address components
    const extractAddressComponents = (components) => {
        const result = {};
        components.forEach(component => {
            component.types.forEach(type => {
                result[type] = component.long_name;
            });
        });
        return result;
    };

    // Handle the authentication response
    // Modify handleAuthResponse to wait for Firebase auth
    const handleAuthResponse = async (response) => {
        try {
            const storeData = await handleStoreCreation(true, 'skip');

            if (response.access_token) {
                try {
                    const placeData = await createPlaceListing(storeData, response.access_token);

                    await Swal.fire({
                        title: 'Success!',
                        html: `Your shop has been created successfully and added to Google Maps!`,
                        icon: 'success',
                        confirmButtonText: 'OK'
                    });

                } catch (googleError) {
                    await Swal.fire({
                        title: 'Shop Created!',
                        html: `Your shop was created successfully, but couldn't be added to Google Maps.<br>You can add it manually later at business.google.com`,
                        icon: 'success',
                        confirmButtonText: 'OK'
                    });
                }
            }

            // Additional cleanup after successful creation
            localStorage.removeItem('barbershop_draft');
            await deleteDoc(doc(db, 'shopDrafts', user.uid));

            onNext({
                wantsToCreate: false,
                storeData: {
                    id: storeData.id,
                    ...storeData
                }
            });

        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to create your shop. Please try again.',
                icon: 'error'
            });
            setLoadingButton(null);
            setIsCreating(false);
        }
    };

    const initializeGoogleClient = () => {
        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_API_SCOPE,
            callback: handleAuthResponse
        });
        setGoogleClient(client);
    };

    // Format availability data for Google's API
    const formatAvailabilityForGoogle = (availability) => {
        const dayMapping = {
            'Monday': 'MONDAY',
            'Tuesday': 'TUESDAY',
            'Wednesday': 'WEDNESDAY',
            'Thursday': 'THURSDAY',
            'Friday': 'FRIDAY',
            'Saturday': 'SATURDAY',
            'Sunday': 'SUNDAY'
        };

        const periods = [];
        const slotDuration = shopData.slotDuration || 30;
        for (const [day, hours] of Object.entries(availability)) {
            if (hours && hours.open && hours.close) {
                // Convert time strings to minutes
                const startMinutes = parseInt(hours.open.split(':')[0]) * 60 + parseInt(hours.open.split(':')[1]);
                const endMinutes = parseInt(hours.close.split(':')[0]) * 60 + parseInt(hours.close.split(':')[1]);

                // Generate slots based on duration
                for (let time = startMinutes; time < endMinutes; time += slotDuration) {
                    const openTime = `${Math.floor(time/60).toString().padStart(2, '0')}${(time%60).toString().padStart(2, '0')}`;
                    const closeTime = `${Math.floor((time+slotDuration)/60).toString().padStart(2, '0')}${((time+slotDuration)%60).toString().padStart(2, '0')}`;

                    periods.push({
                        openDay: dayMapping[day],
                        openTime: openTime,
                        closeDay: dayMapping[day],
                        closeTime: closeTime
                    });
                }
            }
        }

        return { periods };
    };

    // Clean HTML from description
    const stripHtmlTags = (html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || '';
    };

    // Create the business profile
    const createBusinessProfile = async (accessToken) => {
        try {
            console.log('📝 Starting business profile creation process...');
            console.log('Access token available:', !!accessToken);

            if (!accessToken) {
                throw new Error('No access token provided');
            }

            // Test the token first
            console.log('🔑 Testing access token...');
            const {data: tokenInfo} = await fetchWithRetry(
                'https://www.googleapis.com/oauth2/v3/tokeninfo',
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );
            console.log('Token info:', tokenInfo);

            // Get or create account
            console.log('📚 Fetching accounts...');
            const {data: accountsResponse} = await fetchWithRetry(
                `${GOOGLE_BUSINESS_API_ENDPOINT}/accounts`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    }
                }
            );

            console.log('Accounts response:', accountsResponse);

            let accountName;
            if (accountsResponse?.accounts?.length > 0) {
                accountName = accountsResponse.accounts[0].name;
                console.log('✅ Using existing account:', accountName);
            } else {
                console.log('🆕 Creating new account...');
                const {data: newAccount} = await fetchWithRetry(
                    `${GOOGLE_BUSINESS_API_ENDPOINT}/accounts`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            primaryOwner: 'people/me',
                            accountName: shopData.name,
                            type: 'BUSINESS'
                        })
                    }
                );
                accountName = newAccount.name;
                console.log('✅ Created new account:', accountName);
            }

            const formattedServices = shopData.services.map(service => ({
                displayName: `${service.name} (${service.duration || '30'} min)`,
                price: {
                    currencyCode: 'EUR',
                    units: parseInt(service.price, 10) || 0,
                },
                duration: `PT${service.duration || '30'}M` // ISO 8601 duration format
            }));

            // Prepare location payload
            console.log('📍 Creating business location...');
            const cleanDescription = stripHtmlTags(shopData.description || '').substring(0, 750);
            const locationPayload = {
                attributes: [
                    {
                        name: "services",
                        values: formattedServices.map(service => service.displayName)
                    },
                    {
                        name: "service_duration",
                        values: formattedServices.map(service => service.duration)
                    }
                ],
                additionalMetadata: {
                    services: formattedServices.map(service => ({
                        name: service.displayName,
                        price: service.price,
                        duration: service.duration
                    }))
                },
                languageCode: "en",
                locationName: shopData.name,
                primaryPhone: shopData.phoneNumber,
                categories: [{
                    displayName: "Barber Shop",
                    categoryId: "gcid:barber_shop",
                    primary: true
                }],
                storefrontAddress: {
                    businessType: "PHYSICAL",
                    address: {
                        regionCode: "TR",
                        addressLines: [shopData.address]
                    }
                },
                websiteUrl: `${window.location.origin}/shop/${shopData.uniqueUrl}`,
                regularHours: formatAvailabilityForGoogle(shopData.availability),
                serviceArea: {
                    businessType: "CUSTOMER_AND_BUSINESS_LOCATION",
                    places: {
                        placeInfos: [{
                            address: {
                                regionCode: "TR",
                                addressLines: [shopData.address]
                            }
                        }]
                    }
                },
                profile: {
                    description: cleanDescription
                }
            };

            console.log('📦 Location payload:', locationPayload);

            // Create the business location
            const locationEndpoint = `${GOOGLE_BUSINESS_API_ENDPOINT}/${accountName}/locations`;
            console.log('🔗 Creating location at:', locationEndpoint);

            const {data: locationData} = await fetchWithRetry(
                locationEndpoint,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(locationPayload)
                }
            );

            console.log('✅ Location created successfully:', locationData);

            // Try to initiate verification
            if (locationData?.name) {
                try {
                    console.log('📱 Requesting verification...');
                    await fetchWithRetry(
                        `${GOOGLE_BUSINESS_API_ENDPOINT}/${locationData.name}:verify`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                method: 'SMS',
                                phoneNumber: shopData.phoneNumber
                            })
                        }
                    );
                    console.log('✅ Verification requested successfully');
                } catch (verifyError) {
                    console.error('⚠️ Verification request failed:', verifyError);
                    // Continue even if verification fails - we can try again later
                }
            }

            await Swal.fire({
                title: 'Success!',
                text: 'Your Google Business Profile has been created successfully!',
                icon: 'success',
                confirmButtonText: 'OK'
            });

            return locationData;

        } catch (error) {
            console.error('❌ Detailed error in business profile creation:', {
                message: error.message,
                stack: error.stack,
                raw: error
            });

            let errorMessage = 'Failed to create business profile';
            try {
                const errorDetails = JSON.parse(error.message);
                errorMessage += `: ${errorDetails.error?.message || errorDetails.statusText || error.message}`;
            } catch (e) {
                errorMessage += `: ${error.message}`;
            }

            // Show error to user
            await Swal.fire({
                title: 'Error',
                text: errorMessage,
                icon: 'error',
                confirmButtonText: 'OK'
            });

            throw new Error(errorMessage);
        } finally {
            console.log('🏁 Business profile creation process completed');
        }
    };

    // Handle the publish button click
    const handlePublishClick = async () => {
        if (!gapiLoaded || !googleClient) {
            Swal.fire({
                title: 'Error',
                text: 'Google services are not yet initialized. Please wait a moment and try again.',
                icon: 'error'
            });
            return;
        }

        setLoadingButton('publish');
        setIsCreating(true);
        try {
            googleClient.requestAccessToken();
        } catch (error) {
            console.error('Error requesting access token:', error);
            setLoadingButton(null);
            setIsCreating(false);
            Swal.fire({
                title: 'Error',
                text: 'Failed to start Google authentication. Please try again.',
                icon: 'error'
            });
        }
    };

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8 space-y-8">
            {/* Header Section */}
            <div className="text-center space-y-3">
                <h2 className="text-2xl font-bold">Enhance Your Online Presence</h2>
                <p className="text-gray-600">
                    Create a free Business Profile on Google to help customers find your barbershop
                </p>
            </div>

            {/* Benefits Cards */}
            <div className="grid md:grid-cols-3 gap-4">
                <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="card-body">
                        <Search className="w-8 h-8 text-primary mb-4"/>
                        <h3 className="card-title text-lg">Be Found Easily</h3>
                        <p className="text-sm text-gray-600">
                            Appear in Google Search and Maps where customers are looking for services like yours
                        </p>
                    </div>
                </div>

                <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="card-body">
                        <Users2 className="w-8 h-8 text-primary mb-4"/>
                        <h3 className="card-title text-lg">Connect with Customers</h3>
                        <p className="text-sm text-gray-600">
                            Interact through reviews, posts, and messages directly from your Business Profile
                        </p>
                    </div>
                </div>

                <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="card-body">
                        <BarChart3 className="w-8 h-8 text-primary mb-4"/>
                        <h3 className="card-title text-lg">Get Insights</h3>
                        <p className="text-sm text-gray-600">
                            Learn how customers find and interact with your business
                        </p>
                    </div>
                </div>
            </div>

            {/* What's Included Section */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title mb-6">Your Business Profile Includes:</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="flex items-start gap-3">
                            <Globe2 className="w-5 h-5 text-success mt-1"/>
                            <div>
                                <p className="font-medium">Business Website Link</p>
                                <p className="text-sm text-gray-600">Direct customers to your online booking</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Building2 className="w-5 h-5 text-success mt-1"/>
                            <div>
                                <p className="font-medium">Complete Business Info</p>
                                <p className="text-sm text-gray-600">Hours, services, photos, and more</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Star className="w-5 h-5 text-success mt-1"/>
                            <div>
                                <p className="font-medium">Review Management</p>
                                <p className="text-sm text-gray-600">Respond to customer reviews</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Medal className="w-5 h-5 text-success mt-1"/>
                            <div>
                                <p className="font-medium">Verified Status</p>
                                <p className="text-sm text-gray-600">Official Google verification badge</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Requirements Alert */}
            <div className="alert alert-info shadow-lg">
                <div>
                    <div className="flex flex-col">
                        <h4 className="font-bold mb-2">What you'll need:</h4>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>A Google Account</li>
                            <li>Physical business address</li>
                            <li>Phone number that can receive verification code</li>
                            <li>Basic business information already provided in previous steps</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Decision Buttons */}
            <div className="space-y-4">
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => setWantsToCreate(true)}
                        className={`btn btn-lg w-full ${wantsToCreate === true ? 'btn-primary' : 'btn-outline'}`}
                        disabled={!gapiLoaded}
                    >
                        {!gapiLoaded ? (
                            <>
                                <span className="loading loading-spinner"></span>
                                Loading...
                            </>
                        ) : (
                            <>
                                Yes, create my Business Profile
                                <ChevronRight className="w-5 h-5 ml-2"/>
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => handleStoreCreation(true, 'skip-now')}
                        className={`btn btn-lg w-full ${wantsToCreate === true ? 'btn-primary' : 'btn-outline'}`}
                        disabled={isCreating}
                    >
                        {!gapiLoaded ? (
                            <>
                                <span className="loading loading-spinner"></span>
                                Loading...
                            </>
                        ) : loadingButton === 'skip-now' ? (
                            <>
                                <span className="loading loading-spinner"></span>
                                Creating...
                            </>
                        ) : (
                            <>
                                Skip for now
                                <ChevronRight className="w-5 h-5 ml-2"/>
                            </>
                        )}
                    </button>
                </div>

                {wantsToCreate === true && (
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-3">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                            />
                            <span className="label-text text-sm text-gray-600">
                                I understand that by proceeding, my business information will be used to create a Google Business Profile,
                                and I agree to Google's terms of service and privacy policy.
                            </span>
                        </label>
                    </div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
                <button onClick={onBack} className="btn btn-outline">
                    Back
                </button>
                <div className="space-x-2">
                    {/* This Skip button creates the store and moves to the final step */}
                    <button
                        onClick={() => handleStoreCreation(true, 'skip')}
                        className="btn btn-ghost"
                        disabled={isCreating}
                    >
                        {loadingButton === 'skip' ? (
                            <>
                                <span className="loading loading-spinner"></span>
                                Creating...
                            </>
                        ) : (
                            'Skip'
                        )}
                    </button>
                    {/* This button initiates both store creation and Google Business creation */}
                    <button
                        onClick={handlePublishClick}
                        className="btn btn-primary"
                        disabled={!gapiLoaded || !wantsToCreate || !acceptedTerms || isCreating} // Modified this line
                    >
                        {loadingButton === 'publish' ? (
                            <>
                                <span className="loading loading-spinner"></span>
                                Creating...
                            </>
                        ) : (
                            'Publish'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GoogleBusinessStep;