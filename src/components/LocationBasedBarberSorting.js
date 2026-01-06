import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, XCircle, CheckCircle } from 'lucide-react';

const LocationBasedBarberSorting = ({ barbers, setBarbers, language, onLocationChange  }) => {
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationError, setLocationError] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [locationEnabled, setLocationEnabled] = useState(true);

    const translations = {
        en: {
            useLocation: "Show nearest barbershops",
            gettingLocation: "Getting your location...",
            locationError: "Unable to get your location",
            nearestShops: "Showing nearest barbershops first",
            allowLocation: "Allow location access",
            disableLocation: "Disable location sorting",
            enableLocation: "Enable location sorting"
        },
        tr: {
            useLocation: "En yakın berber dükkanlarını göster",
            gettingLocation: "Konumunuz alınıyor...",
            locationError: "Konumunuz alınamadı",
            nearestShops: "En yakın berber dükkanları önce gösteriliyor",
            allowLocation: "Konum erişimine izin ver",
            disableLocation: "Konum sıralamasını devre dışı bırak",
            enableLocation: "Konum sıralamasını etkinleştir"
        },
        ar: {
            useLocation: "عرض أقرب صالونات الحلاقة",
            gettingLocation: "جاري الحصول على موقعك...",
            locationError: "تعذر الحصول على موقعك",
            nearestShops: "عرض أقرب صالونات الحلاقة أولاً",
            allowLocation: "السماح بالوصول إلى الموقع",
            disableLocation: "تعطيل الترتيب حسب الموقع",
            enableLocation: "تمكين الترتيب حسب الموقع"
        },
        de: {
            useLocation: "Zeige nächstgelegene Friseursalons",
            gettingLocation: "Standort wird ermittelt...",
            locationError: "Standort konnte nicht ermittelt werden",
            nearestShops: "Nächstgelegene Friseursalons werden zuerst angezeigt",
            allowLocation: "Standortzugriff erlauben",
            disableLocation: "Standortsortierung deaktivieren",
            enableLocation: "Standortsortierung aktivieren"
        }
    };

    const t = translations[language] || translations.en;

    // Load saved preferences on component mount
    useEffect(() => {
        const savedLocation = localStorage.getItem('barbersBuddies_userLocation');
        const locationPreference = localStorage.getItem('barbersBuddies_locationEnabled');

        if (locationPreference !== null) {
            setLocationEnabled(locationPreference === 'true');
        }

        if (savedLocation && locationEnabled) {
            try {
                const parsedLocation = JSON.parse(savedLocation);
                setUserLocation(parsedLocation);
                sortBarbersByLocation(parsedLocation);
            } catch (e) {
                console.error('Error parsing saved location:', e);
            }
        }
    }, []);

    useEffect(() => {
        // Call the callback whenever userLocation changes
        if (onLocationChange) {
            onLocationChange(userLocation);
        }
    }, [userLocation, onLocationChange]);


    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const deg2rad = (deg) => deg * (Math.PI/180);

    // Updated to use Nominatim instead of Mapbox
    const geocodeAddress = async (address) => {
        console.log(`Geocoding address: "${address}"`);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
                { headers: { 'Accept-Language': language, 'User-Agent': 'BarbersBuddies/1.0' } }
            );
            const data = await response.json();

            if (data && data.length > 0) {
                console.log(`✅ Geocoded "${address}" to:`, {lat: data[0].lat, lon: data[0].lon});
                return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
            }
            console.log(`❌ Failed to geocode "${address}"`);
            return null;
        } catch (error) {
            console.error('Error geocoding address:', error);
            return null;
        }
    };

    const sortBarbersByLocation = async (location) => {
        if (!location || !barbers.length) return;

        const { latitude, longitude } = location;

        const barbersWithDistance = await Promise.all(
            barbers.map(async (barber) => {
                // Check if we already have calculated distance
                if (barber.distance !== undefined) {
                    return barber;
                }

                // Otherwise calculate distance
                const coords = await geocodeAddress(barber.address);
                // In the sortBarbersByLocation function, modify the return with coordinates:
                if (coords) {
                    const distance = calculateDistance(
                        latitude, longitude, coords.latitude, coords.longitude
                    );
                    return {
                        ...barber,
                        distance,
                        latitude: coords.latitude,  // Add this
                        longitude: coords.longitude // Add this
                    };
                }
                return { ...barber, distance: Infinity };
            })
        );

        const sortedBarbers = barbersWithDistance.sort((a, b) => a.distance - b.distance);
        setBarbers(sortedBarbers);
    };

    const getUserLocation = () => {
        setIsGettingLocation(true);
        setLocationError(null);

        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            setIsGettingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const locationData = { latitude, longitude };

                // Save to localStorage
                localStorage.setItem('barbersBuddies_userLocation', JSON.stringify(locationData));
                localStorage.setItem('barbersBuddies_locationEnabled', 'true');

                setUserLocation(locationData);
                setLocationEnabled(true);
                await sortBarbersByLocation(locationData);
                setIsGettingLocation(false);
            },
            (error) => {
                setLocationError(`Error: ${error.message}`);
                setIsGettingLocation(false);
            }
        );
    };

    const toggleLocationSorting = () => {
        const newState = !locationEnabled;
        setLocationEnabled(newState);
        localStorage.setItem('barbersBuddies_locationEnabled', newState.toString());

        if (newState && userLocation) {
            sortBarbersByLocation(userLocation);
        }
    };

    return (
        <div className="mb-4 flex flex-col sm:flex-row gap-2 items-start">
            {!userLocation ? (
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={getUserLocation}
                    disabled={isGettingLocation}
                    className="btn btn-sm btn-outline gap-2"
                >
                    <MapPin className="w-4 h-4" />
                    {isGettingLocation ? t.gettingLocation : t.useLocation}
                </motion.button>
            ) : (
                <div className="flex items-center gap-4 flex-wrap">
                    <div className={`text-sm flex items-center gap-2 ${locationEnabled ? "text-success" : "text-base-content/50"}`}>
                        <MapPin className="w-4 h-4" />
                        {locationEnabled ? t.nearestShops : t.useLocation}
                    </div>

                    <button
                        onClick={toggleLocationSorting}
                        className={`btn btn-sm ${locationEnabled ? "btn-ghost" : "btn-outline"} gap-2`}
                    >
                        {locationEnabled ? (
                            <>
                                <XCircle className="w-4 h-4" />
                                {t.disableLocation}
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                {t.enableLocation}
                            </>
                        )}
                    </button>
                </div>
            )}

            {locationError && (
                <div className="mt-2 text-sm text-error flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {locationError}
                </div>
            )}
        </div>
    );
};

export default LocationBasedBarberSorting;