/**
 * Service Templates for Barbershops
 */

const { generateId, randomInt, randomSubset } = require('../utils/random');
const { getServiceImage } = require('../utils/images');

// Master service catalog
const SERVICE_CATALOG = [
  // Haircuts
  { name: 'Classic Haircut', price: 25, duration: 30, category: 'haircut', description: 'Traditional scissor cut with styling' },
  { name: 'Buzz Cut', price: 15, duration: 15, category: 'haircut', description: 'Clean clipper cut all around' },
  { name: 'Fade Haircut', price: 30, duration: 35, category: 'haircut', description: 'Modern fade with sharp lines' },
  { name: 'Skin Fade', price: 35, duration: 40, category: 'haircut', description: 'Seamless skin fade transition' },
  { name: 'Scissor Cut', price: 35, duration: 45, category: 'haircut', description: 'Precision scissor work for longer styles' },
  { name: 'Textured Crop', price: 30, duration: 35, category: 'haircut', description: 'Modern textured crop with movement' },

  // Beard
  { name: 'Beard Trim', price: 15, duration: 20, category: 'beard', description: 'Shape and trim your beard' },
  { name: 'Beard Shaping', price: 20, duration: 25, category: 'beard', description: 'Detailed beard sculpting and lining' },
  { name: 'Full Beard Grooming', price: 30, duration: 35, category: 'beard', description: 'Complete beard care with oil treatment' },

  // Shave
  { name: 'Hot Towel Shave', price: 35, duration: 40, category: 'shave', description: 'Luxurious straight razor shave' },
  { name: 'Head Shave', price: 25, duration: 30, category: 'shave', description: 'Clean head shave with care' },
  { name: 'Neck Shave', price: 10, duration: 10, category: 'shave', description: 'Clean up the neck line' },

  // Combo
  { name: 'Haircut + Beard', price: 40, duration: 50, category: 'combo', description: 'Complete grooming package' },
  { name: 'Haircut + Hot Towel Shave', price: 55, duration: 70, category: 'combo', description: 'The ultimate refresh' },
  { name: 'The Works', price: 75, duration: 90, category: 'combo', description: 'Haircut, beard, shave, and facial' },

  // Kids
  { name: 'Kids Haircut (Under 12)', price: 18, duration: 25, category: 'kids', description: 'Gentle cuts for young ones' },
  { name: 'Teen Haircut', price: 22, duration: 30, category: 'kids', description: 'Trendy cuts for teenagers' },

  // Styling
  { name: 'Hair Styling', price: 15, duration: 20, category: 'styling', description: 'Blow dry and style' },
  { name: 'Special Occasion Style', price: 40, duration: 45, category: 'styling', description: 'Wedding or event styling' },

  // Treatment
  { name: 'Scalp Treatment', price: 25, duration: 30, category: 'treatment', description: 'Nourishing scalp massage' },
  { name: 'Hair Coloring', price: 50, duration: 60, category: 'coloring', description: 'Professional hair coloring' },
  { name: 'Grey Blending', price: 35, duration: 30, category: 'coloring', description: 'Natural grey coverage' }
];

/**
 * Generate services for a shop with price variation
 * @param {number} count - Number of services
 * @param {number} priceMultiplier - Price tier multiplier (0.8 for budget, 1.0 for normal, 1.3 for premium)
 * @returns {Array} Array of service objects
 */
const generateShopServices = (count = 8, priceMultiplier = 1.0) => {
  // Always include at least one from each core category
  const coreCategories = ['haircut', 'beard', 'combo'];
  const coreServices = coreCategories.map(cat =>
    SERVICE_CATALOG.find(s => s.category === cat)
  );

  // Fill remaining with random services
  const remainingCount = Math.max(0, count - coreServices.length);
  const otherServices = SERVICE_CATALOG.filter(s => !coreCategories.includes(s.category));
  const additionalServices = randomSubset(otherServices, remainingCount);

  const allServices = [...coreServices, ...additionalServices];

  return allServices.map(service => ({
    id: generateId(10),
    name: service.name,
    price: Math.round(service.price * priceMultiplier),
    duration: service.duration,
    description: service.description,
    imageUrl: getServiceImage(service.category)
  }));
};

/**
 * Get price tier multiplier
 * @param {string} tier - Price tier ('budget', 'normal', 'premium')
 * @returns {number} Multiplier
 */
const getPriceMultiplier = (tier) => {
  const multipliers = {
    'budget': 0.8,
    'normal': 1.0,
    'premium': 1.3,
    'luxury': 1.6
  };
  return multipliers[tier] || 1.0;
};

module.exports = {
  SERVICE_CATALOG,
  generateShopServices,
  getPriceMultiplier
};
