/**
 * Shop Definitions for Seed Data
 * 12 unique barbershops with realistic data
 */

const { generateId, randomInt, randomItem } = require('../utils/random');
const { getShopImages } = require('../utils/images');
const { generateTimestamp } = require('../utils/dates');
const { generateShopServices, getPriceMultiplier } = require('./services');
const { generateEmployees, generateDemoShopEmployees } = require('./employees');

// Shop templates with unique identities
const SHOP_TEMPLATES = [
  {
    name: 'Demo Barbershop',
    uniqueUrl: 'demo-barbershop',
    address: '123 Main Street, Berlin, 10115',
    biography: 'Welcome to Demo Barbershop - your premier destination for classic cuts and modern styles. Our experienced team delivers exceptional grooming services in a relaxed, friendly atmosphere.',
    categories: ['Barbershop', 'Classic'],
    pricingTier: '€€',
    isDemo: true
  },
  {
    name: 'Urban Cuts Studio',
    uniqueUrl: 'urban-cuts-studio',
    address: '45 Fashion Avenue, Munich, 80331',
    biography: 'Urban Cuts brings the latest trends from the streets to your style. We specialize in modern fades, creative designs, and contemporary looks.',
    categories: ['Barbershop', 'Modern'],
    pricingTier: '€€€'
  },
  {
    name: 'The Gentleman\'s Corner',
    uniqueUrl: 'gentlemans-corner',
    address: '78 Oak Lane, Hamburg, 20095',
    biography: 'A traditional barbershop experience with a modern twist. Hot towel shaves, classic cuts, and timeless grooming in an elegant setting.',
    categories: ['Barbershop', 'Classic', 'Luxury'],
    pricingTier: '€€€'
  },
  {
    name: 'Fresh Fades Barbers',
    uniqueUrl: 'fresh-fades-barbers',
    address: '22 Park Road, Frankfurt, 60311',
    biography: 'Home of the freshest fades in town! Our skilled barbers specialize in skin fades, tapers, and precision line work.',
    categories: ['Barbershop', 'Modern'],
    pricingTier: '€€'
  },
  {
    name: 'Classic Clips',
    uniqueUrl: 'classic-clips',
    address: '99 Heritage Street, Cologne, 50667',
    biography: 'Keeping the classic barbershop tradition alive. No frills, just quality cuts at honest prices.',
    categories: ['Barbershop', 'Budget-Friendly'],
    pricingTier: '€'
  },
  {
    name: 'Blade & Brush',
    uniqueUrl: 'blade-and-brush',
    address: '156 Arts District, Dusseldorf, 40213',
    biography: 'Where artistry meets grooming. Our creative team pushes boundaries with innovative styles and techniques.',
    categories: ['Barbershop', 'Creative'],
    pricingTier: '€€€'
  },
  {
    name: 'The Shave Lab',
    uniqueUrl: 'the-shave-lab',
    address: '33 Science Park, Stuttgart, 70173',
    biography: 'Precision grooming with a scientific approach. We use premium products and proven techniques for the perfect shave.',
    categories: ['Barbershop', 'Shave Specialist'],
    pricingTier: '€€'
  },
  {
    name: 'Kings Crown Barbers',
    uniqueUrl: 'kings-crown-barbers',
    address: '88 Royal Mile, Leipzig, 04109',
    biography: 'Feel like royalty with every visit. Premium services, luxurious atmosphere, and impeccable attention to detail.',
    categories: ['Barbershop', 'Luxury'],
    pricingTier: '€€€'
  },
  {
    name: 'Quick Cuts Express',
    uniqueUrl: 'quick-cuts-express',
    address: '12 Station Road, Dresden, 01067',
    biography: 'Quality cuts, quick service, great prices. No appointment needed - walk in and walk out looking sharp.',
    categories: ['Barbershop', 'Express'],
    pricingTier: '€'
  },
  {
    name: 'Beard Brothers',
    uniqueUrl: 'beard-brothers',
    address: '67 Hipster Lane, Nuremberg, 90402',
    biography: 'The beard experts. From grooming to sculpting, we specialize in all things facial hair.',
    categories: ['Barbershop', 'Beard Specialist'],
    pricingTier: '€€'
  },
  {
    name: 'Fade Factory',
    uniqueUrl: 'fade-factory',
    address: '44 Trend Street, Hannover, 30159',
    biography: 'Manufacturing the perfect fade since 2015. Our barbers are trained in every fade variation imaginable.',
    categories: ['Barbershop', 'Fade Specialist'],
    pricingTier: '€€'
  },
  {
    name: 'Old School Barber Co',
    uniqueUrl: 'old-school-barber-co',
    address: '200 Vintage Avenue, Bremen, 28195',
    biography: 'Step back in time to when barbershops were a community institution. Classic service, timeless style.',
    categories: ['Barbershop', 'Classic', 'Vintage'],
    pricingTier: '€€'
  }
];

// Default availability schedule
const DEFAULT_AVAILABILITY = {
  Monday: { open: '09:00', close: '18:00' },
  Tuesday: { open: '09:00', close: '18:00' },
  Wednesday: { open: '09:00', close: '18:00' },
  Thursday: { open: '09:00', close: '20:00' },
  Friday: { open: '09:00', close: '20:00' },
  Saturday: { open: '10:00', close: '16:00' },
  Sunday: null // Closed
};

/**
 * Generate a complete shop object
 * @param {Object} template - Shop template
 * @param {number} index - Shop index
 * @param {string} ownerId - Owner user ID
 * @returns {Object} Complete shop object
 */
const generateShop = (template, index, ownerId) => {
  const priceMultipliers = { '€': 0.8, '€€': 1.0, '€€€': 1.3 };
  const multiplier = priceMultipliers[template.pricingTier] || 1.0;

  const employeeCount = template.isDemo ? 4 : randomInt(2, 5);
  const serviceCount = template.isDemo ? 10 : randomInt(5, 10);

  return {
    id: template.isDemo ? 'demo-shop-id' : generateId(20),
    ownerId,
    name: template.name,
    uniqueUrl: template.uniqueUrl,
    address: template.address,
    email: `contact@${template.uniqueUrl.replace(/-/g, '')}.com`,
    phoneNumber: `+49${1500000000 + index * 1111111}`,
    biography: template.biography,
    categories: template.categories,
    pricingTier: template.pricingTier,

    services: template.isDemo
      ? generateShopServices(serviceCount, multiplier)
      : generateShopServices(serviceCount, multiplier),

    employees: template.isDemo
      ? generateDemoShopEmployees()
      : generateEmployees(employeeCount, index),

    availability: { ...DEFAULT_AVAILABILITY },
    slotDuration: 30,

    imageUrls: getShopImages(index),

    // Ratings will be populated by seedRatings
    ratings: [],
    averageRating: 0,
    totalRatings: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    ratingIds: [],
    lastRatedAt: null,

    paymentMethods: ['cash', 'card'],
    businessProfileUrl: '',

    theme: {
      colors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#f59e0b' },
      typography: { font: 'Inter', size: 'normal' },
      animations: { enabled: true }
    },
    blocks: [],

    createdAt: generateTimestamp(-90 + index * 5)
  };
};

/**
 * Generate all 12 shops
 * @param {Array} ownerIds - Array of owner user IDs
 * @returns {Array} Array of shop objects
 */
const generateAllShops = (ownerIds) => {
  return SHOP_TEMPLATES.map((template, index) => {
    const ownerId = index === 0 ? 'demo-owner-uid' : ownerIds[index - 1];
    return generateShop(template, index, ownerId);
  });
};

module.exports = {
  SHOP_TEMPLATES,
  DEFAULT_AVAILABILITY,
  generateShop,
  generateAllShops
};
