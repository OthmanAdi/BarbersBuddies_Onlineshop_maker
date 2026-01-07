/**
 * Employee Templates for Barbershops
 */

const { generateId, randomName, nameToEmail, randomInt } = require('../utils/random');
const { getAvatarUrl } = require('../utils/images');

// Predefined employee roles/specialties
const SPECIALTIES = [
  'Master Barber',
  'Senior Stylist',
  'Barber',
  'Junior Barber',
  'Beard Specialist',
  'Color Specialist'
];

/**
 * Generate employees for a shop
 * @param {number} count - Number of employees
 * @param {number} shopIndex - Shop index for unique avatars
 * @returns {Array} Array of employee objects
 */
const generateEmployees = (count = 3, shopIndex = 0) => {
  const employees = [];

  for (let i = 0; i < count; i++) {
    const name = randomName();
    const gender = Math.random() > 0.2 ? 'men' : 'women';

    employees.push({
      id: generateId(10),
      name,
      email: nameToEmail(name),
      photoURL: getAvatarUrl((shopIndex * 10) + i + 500, gender),
      role: SPECIALTIES[i % SPECIALTIES.length],
      yearsExperience: randomInt(1, 15),
      isActive: true
    });
  }

  return employees;
};

/**
 * Generate employees for the demo shop (more detailed)
 * @returns {Array} Array of employee objects with extra details
 */
const generateDemoShopEmployees = () => [
  {
    id: 'emp-demo-1',
    name: 'Marcus Johnson',
    email: 'marcus@demobarbershop.com',
    photoURL: getAvatarUrl(601, 'men'),
    role: 'Master Barber',
    yearsExperience: 12,
    bio: 'Specializing in classic cuts and hot towel shaves',
    isActive: true
  },
  {
    id: 'emp-demo-2',
    name: 'Carlos Rodriguez',
    email: 'carlos@demobarbershop.com',
    photoURL: getAvatarUrl(602, 'men'),
    role: 'Senior Stylist',
    yearsExperience: 8,
    bio: 'Expert in modern fades and textured styles',
    isActive: true
  },
  {
    id: 'emp-demo-3',
    name: 'Ahmed Hassan',
    email: 'ahmed@demobarbershop.com',
    photoURL: getAvatarUrl(603, 'men'),
    role: 'Beard Specialist',
    yearsExperience: 6,
    bio: 'Beard grooming and shaping specialist',
    isActive: true
  },
  {
    id: 'emp-demo-4',
    name: 'Tyler Williams',
    email: 'tyler@demobarbershop.com',
    photoURL: getAvatarUrl(604, 'men'),
    role: 'Barber',
    yearsExperience: 4,
    bio: 'Skilled in all classic and modern styles',
    isActive: true
  }
];

module.exports = {
  SPECIALTIES,
  generateEmployees,
  generateDemoShopEmployees
};
