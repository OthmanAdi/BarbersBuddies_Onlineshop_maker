import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom marker icons
const createIcon = (color, iconUrl) => new L.Icon({
    iconUrl: iconUrl || `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const userIcon = createIcon('red');
const shopIcon = createIcon('blue');

const BarberShopsMap = ({ barbers, userLocation, language, onShopSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedShop, setSelectedShop] = useState(null);
    const [mapCenter, setMapCenter] = useState([51.505, -0.09]); // Default center
    const [mapZoom, setMapZoom] = useState(3); // Default world view

    React.useEffect(() => {
        // Create style element
        const styleEl = document.createElement('style');
        styleEl.innerHTML = `
      .custom-popup .leaflet-popup-content {
        margin: 0;
        min-width: 200px;
      }
      .custom-popup .leaflet-popup-content-wrapper {
        padding: 0;
        border-radius: 8px;
        overflow: hidden;
      }
    `;
        document.head.appendChild(styleEl);

        // Cleanup
        return () => {
            document.head.removeChild(styleEl);
        };
    }, []);


    // Set map center based on user location or first shop
    useEffect(() => {
        if (userLocation) {
            setMapCenter([userLocation.latitude, userLocation.longitude]);
            setMapZoom(12);
        } else if (barbers.length > 0) {
            const firstShopWithCoords = barbers.find(shop => shop.latitude && shop.longitude);
            if (firstShopWithCoords) {
                setMapCenter([firstShopWithCoords.latitude, firstShopWithCoords.longitude]);
                setMapZoom(12);
            }
        }
    }, [userLocation, barbers]);

    // Function to geocode addresses to coordinates
    const geocodeShops = async () => {
        const geocodedBarbers = await Promise.all(
            barbers.map(async (barber) => {
                if (barber.latitude && barber.longitude) return barber;

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(barber.address)}&format=json&limit=1`,
                        { headers: { 'Accept-Language': language, 'User-Agent': 'BarbersBuddies/1.0' } }
                    );
                    const data = await response.json();

                    if (data && data.length > 0) {
                        return {
                            ...barber,
                            latitude: parseFloat(data[0].lat),
                            longitude: parseFloat(data[0].lon)
                        };
                    }
                    return barber;
                } catch (error) {
                    console.error('Error geocoding address:', error);
                    return barber;
                }
            })
        );

        return geocodedBarbers.filter(shop => shop.latitude && shop.longitude);
    };

    // Component to fly to a location
    const FlyToLocation = ({ center, zoom }) => {
        const map = useMap();
        useEffect(() => {
            map.flyTo(center, zoom, { duration: 2 });
        }, [center, zoom, map]);
        return null;
    };

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="btn btn-primary gap-2"
            >
                <MapPin className="w-4 h-4" />
                View Map
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="relative w-[90vw] h-[80vh] bg-base-100 rounded-xl overflow-hidden shadow-2xl"
                        >
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-2 right-2 z-[9999] btn btn-sm btn-circle bg-base-100 shadow-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {selectedShop && (
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="absolute bottom-4 left-4 right-4 z-[1000] bg-base-100 rounded-lg shadow-xl p-4 max-w-md mx-auto"
                                    style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
                                >
                                    <div className="flex items-start gap-3">
                                        {selectedShop.imageUrls?.[0] && (
                                            <img
                                                src={selectedShop.imageUrls[0]}
                                                alt={selectedShop.name}
                                                className="w-16 h-16 object-cover rounded-md"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold truncate">{selectedShop.name}</h3>
                                            <p className="text-sm text-base-content/70 truncate">{selectedShop.address}</p>
                                            {selectedShop.distance !== undefined && (
                                                <p className="text-xs text-primary">
                                                    {selectedShop.distance < 1
                                                        ? `${Math.round(selectedShop.distance * 1000)} m away`
                                                        : `${selectedShop.distance.toFixed(1)} km away`}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsOpen(false); // Add this line to close the map
                                                onShopSelect?.(selectedShop.id);
                                            }}
                                            className="btn btn-sm btn-primary"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            <MapContainer
                                center={mapCenter}
                                zoom={mapZoom}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                <FlyToLocation center={mapCenter} zoom={mapZoom} />

                                {userLocation && (
                                    <Marker
                                        position={[userLocation.latitude, userLocation.longitude]}
                                        icon={userIcon}
                                    >
                                        <Popup>
                                            <b>Your Location</b>
                                        </Popup>
                                    </Marker>
                                )}

                                <MarkerClusterGroup>
                                    {barbers.filter(b => b.latitude && b.longitude).map(shop => (
                                        <Marker
                                            key={shop.id}
                                            position={[shop.latitude, shop.longitude]}
                                            icon={shopIcon}
                                            eventHandlers={{
                                                click: () => {
                                                    setSelectedShop(shop);
                                                    setMapCenter([shop.latitude, shop.longitude]);
                                                    setMapZoom(15);
                                                }
                                            }}
                                        >
                                            <Popup className="custom-popup" maxWidth="300">
                                                <div className="p-3 bg-base-100 shadow-inner">
                                                    <h3 className="font-bold text-lg text-primary">{shop.name}</h3>

                                                    <div className="grid gap-2 mt-2">
                                                        <div className="flex items-start gap-2">
                                                            <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                                            <span className="text-sm">{shop.address}</span>
                                                        </div>

                                                        {shop.distance !== undefined && (
                                                            <div className="flex gap-1 text-sm text-primary font-medium">
                                                                <Navigation className="w-4 h-4" />
                                                                {shop.distance === Infinity
                                                                    ? "Distance unknown"
                                                                    : shop.distance < 1
                                                                        ? `${Math.round(shop.distance * 1000)}m away`
                                                                        : `${shop.distance.toFixed(1)}km away`}
                                                            </div>
                                                        )}

                                                        {shop.services && shop.services.length > 0 && (
                                                            <div className="border-t border-base-200 pt-2 mt-1">
                                                                <p className="text-xs font-semibold mb-1">Popular services:</p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {shop.services.slice(0, 3).map((service, i) => (
                                                                        <span key={i} className="badge badge-sm">{service.name}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => {
                                                            // 2. Close map when View Details is clicked
                                                            setIsOpen(false);
                                                            onShopSelect(shop.id);
                                                        }}
                                                        className="btn btn-sm btn-primary w-full mt-3"
                                                    >
                                                        View Details
                                                    </button>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}
                                </MarkerClusterGroup>

                                {userLocation && (
                                    <div className="absolute bottom-20 right-4 z-400">
                                        <button
                                            onClick={() => {
                                                setMapCenter([userLocation.latitude, userLocation.longitude]);
                                                setMapZoom(14);
                                                setSelectedShop(null);
                                            }}
                                            className="btn btn-circle shadow-lg"
                                        >
                                            <Navigation className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </MapContainer>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default BarberShopsMap;