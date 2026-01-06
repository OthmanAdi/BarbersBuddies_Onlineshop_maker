import React from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

/**
 * DistanceBadge - Displays the distance to a barbershop from user's location
 *
 * @param {number} distance - Distance in kilometers
 * @param {string} className - Additional CSS classes
 * @param {object} style - Additional inline styles
 * @returns {JSX.Element|null} - Badge component or null if no valid distance
 */
const DistanceBadge = ({ distance, className = '', style = {} }) => {
    // Return null if distance is undefined, null, or Infinity
    if (distance === undefined || distance === null || distance === Infinity) {
        return null;
    }

    // Format distance based on proximity
    const formatDistance = (km) => {
        if (km < 1) {
            // Convert to meters for distances less than 1km
            return `${Math.round(km * 1000)} m`;
        } else if (km < 10) {
            // Show one decimal place for distances under 10km
            return `${km.toFixed(1)} km`;
        } else {
            // Round to whole number for larger distances
            return `${Math.round(km)} km`;
        }
    };

    const formattedDistance = formatDistance(distance);

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`absolute top-2 right-2 px-2 py-1 rounded-full 
                 bg-primary/90 text-primary-content text-xs font-medium
                 backdrop-blur-sm shadow-sm z-10 flex items-center gap-1
                 ${className}`}
            style={style}
        >
            <MapPin className="w-3 h-3" />
            {formattedDistance}
        </motion.div>
    );
};

export default DistanceBadge;