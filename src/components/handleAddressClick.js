import React from 'react';
import { MapPin } from 'lucide-react';

const MapLink = ({ address }) => {
    const handleAddressClick = () => {
        const encodedAddress = encodeURIComponent(address);

        // Check if device is iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        // Create appropriate map URL
        const mapUrl = isIOS
            ? `maps://?q=${encodedAddress}`
            : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

        window.open(mapUrl, '_blank');
    };

    return (
        <button
            onClick={handleAddressClick}
            className="group flex items-center gap-2 text-sm text-left text-base-content/70 hover:text-primary transition-colors duration-200 max-w-full truncate"
        >
            <MapPin className="w-4 h-4 shrink-0 group-hover:text-primary transition-colors duration-200" />
            <span className="truncate">{address}</span>
        </button>
    );
};

export default MapLink;