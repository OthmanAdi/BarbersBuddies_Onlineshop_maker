// utils/addressUtils.js
export const extractAddressComponents = (components) => {
    const componentMap = {
        street_number: '',
        route: '',
        locality: '',
        sublocality: '',
        administrative_area_level_1: '',
        administrative_area_level_2: '',
        country: '',
        postal_code: ''
    };

    // Helper to get both long and short names
    const addComponent = (component, types) => {
        types.forEach(type => {
            if (componentMap.hasOwnProperty(type)) {
                componentMap[type] = {
                    long_name: component.long_name,
                    short_name: component.short_name
                };
            }
        });
    };

    // Process each component
    components.forEach(component => {
        addComponent(component, component.types);
    });

    // Format the final result ensuring required fields
    return {
        street_number: componentMap.street_number || null,
        route: componentMap.route || null,
        locality: componentMap.locality || componentMap.sublocality || null,
        sublocality: componentMap.sublocality || null,
        administrative_area_level_1: componentMap.administrative_area_level_1 || null,
        administrative_area_level_2: componentMap.administrative_area_level_2 || null,
        country: componentMap.country || null,
        postal_code: componentMap.postal_code || null,
        // Add formatted address helpers
        getFullStreet: () => {
            const number = componentMap.street_number?.long_name || '';
            const street = componentMap.route?.long_name || '';
            return `${number} ${street}`.trim();
        },
        getCity: () => componentMap.locality?.long_name ||
            componentMap.sublocality?.long_name || '',
        getState: () => componentMap.administrative_area_level_1?.short_name || '',
        getCountry: () => componentMap.country?.long_name || '',
        getPostalCode: () => componentMap.postal_code?.long_name || '',
        // Get formatted address according to Google's format
        getFormattedAddress: () => {
            const parts = [
                componentMap.street_number?.long_name,
                componentMap.route?.long_name,
                componentMap.locality?.long_name || componentMap.sublocality?.long_name,
                componentMap.administrative_area_level_1?.short_name,
                componentMap.postal_code?.long_name,
                componentMap.country?.long_name
            ].filter(Boolean);
            return parts.join(', ');
        }
    };
};

export const validateAddress = (components) => {
    const required = ['route', 'locality', 'country'];
    const extracted = extractAddressComponents(components);

    const missing = required.filter(field => !extracted[field]);

    if (missing.length) {
        throw new Error(`Missing required address components: ${missing.join(', ')}`);
    }

    return true;
};

// Helper function to format hours for Places API
export const formatBusinessHours = (availability) => {
    const dayMapping = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 7
    };

    return Object.entries(availability)
        .filter(([_, hours]) => hours && hours.open && hours.close)
        .map(([day, hours]) => ({
            day: dayMapping[day],
            hours: {
                open: hours.open.replace(':', ''),
                close: hours.close.replace(':', '')
            }
        }))
        .sort((a, b) => a.day - b.day);
};

// Helper to format phone numbers for Places API
export const formatPhoneNumber = (phoneNumber) => {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Ensure it starts with a country code
    if (!cleaned.startsWith('90')) {
        return `+90${cleaned}`;
    }

    return `+${cleaned}`;
};