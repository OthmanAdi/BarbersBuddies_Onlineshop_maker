/**
 * Image URL Generators for Seed Data
 * Using free, open-source image sources
 */

// Barbershop interior/exterior images from Unsplash (free commercial use)
const SHOP_IMAGES = [
  'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800',
  'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800',
  'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800',
  'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800',
  'https://images.unsplash.com/photo-1521490683712-35a1cb235d1c?w=800',
  'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800',
  'https://images.unsplash.com/photo-1493256338651-d82f7acb2b38?w=800',
  'https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?w=800',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800',
  'https://images.unsplash.com/photo-1596362601603-76d5e3fdbcb0?w=800'
];

// Service images from Unsplash
const SERVICE_IMAGES = {
  haircut: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400',
  beard: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400',
  shave: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400',
  styling: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400',
  coloring: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
  kids: 'https://images.unsplash.com/photo-1596362601603-76d5e3fdbcb0?w=400',
  treatment: 'https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?w=400',
  default: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400'
};

/**
 * Get shop images for a specific shop index
 * @param {number} shopIndex - Index of the shop (0-11)
 * @returns {string[]} Array of 3 image URLs
 */
const getShopImages = (shopIndex) => {
  const baseIndex = shopIndex % SHOP_IMAGES.length;
  return [
    SHOP_IMAGES[baseIndex],
    SHOP_IMAGES[(baseIndex + 1) % SHOP_IMAGES.length],
    SHOP_IMAGES[(baseIndex + 2) % SHOP_IMAGES.length]
  ];
};

/**
 * Get avatar URL for a person
 * @param {number|string} seed - Unique seed for consistent avatars
 * @param {string} gender - 'men' or 'women'
 * @returns {string} Avatar URL
 */
const getAvatarUrl = (seed, gender = 'men') => {
  const numericSeed = typeof seed === 'string'
    ? seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : seed;
  const index = Math.abs(numericSeed) % 100;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
};

/**
 * Get service image by type
 * @param {string} serviceType - Type of service
 * @returns {string} Image URL
 */
const getServiceImage = (serviceType) => {
  const type = serviceType.toLowerCase();
  for (const [key, url] of Object.entries(SERVICE_IMAGES)) {
    if (type.includes(key)) return url;
  }
  return SERVICE_IMAGES.default;
};

/**
 * Get a random shop image
 * @returns {string} Image URL
 */
const getRandomShopImage = () => {
  return SHOP_IMAGES[Math.floor(Math.random() * SHOP_IMAGES.length)];
};

module.exports = {
  SHOP_IMAGES,
  SERVICE_IMAGES,
  getShopImages,
  getAvatarUrl,
  getServiceImage,
  getRandomShopImage
};
