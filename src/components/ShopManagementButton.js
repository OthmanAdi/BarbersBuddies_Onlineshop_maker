import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, BarChart3, Calendar, Scissors, Users2, CreditCard, Clock, X, ChevronRight } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import "./ShopManagementButton.css";
import ShopTabContent from './ShopTabContent'; // Import the actual component
import ShopCalendarTab from './ShopCalendarTab';
import ShopAnalyticsTab from './ShopAnalyticsTab';
import ShopServicesTab from './ShopServicesTab';

const ShopManagementButton = ({ user, userType }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [shops, setShops] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('calendar');
    const [selectedShopId, setSelectedShopId] = useState(null);
    const [selectedShop, setSelectedShop] = useState(null);
    const navigate = useNavigate();

    // Only render for shop owners
    if (!user || userType !== 'shop-owner') return null;

    const handleOpenDashboard = async () => {
        setIsOpen(true);
        setIsLoading(true);

        try {
            console.log('Fetching shops for user:', user.uid);
            // Fetch the user's shops
            const shopsQuery = query(
                collection(db, 'barberShops'),
                where('ownerId', '==', user.uid)
            );

            const shopsSnapshot = await getDocs(shopsQuery);
            const shopsList = shopsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`Found ${shopsList.length} shops for the user`);
            setShops(shopsList);

            // Auto-select the first shop
            if (shopsList.length > 0) {
                setSelectedShopId(shopsList[0].id);
                setSelectedShop(shopsList[0]);
                console.log('Auto-selected shop:', shopsList[0].id);
            }
        } catch (error) {
            console.error('Error fetching shops:', error);
        } finally {
            // Simulate loading for at least 1 second for better UX
            setTimeout(() => {
                setIsLoading(false);
            }, 1000);
        }
    };

    const handleShopChange = (e) => {
        const newShopId = e.target.value;
        setSelectedShopId(newShopId);
        const shop = shops.find(shop => shop.id === newShopId);
        setSelectedShop(shop);
        console.log('Selected shop changed to:', newShopId);
    };

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenDashboard}
                className="btn shop-management-btn"
            >
                <Store className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">Manage Shop</span>
                <span className="sm:hidden">Manage</span>
            </motion.button>

            {/* Shop Management Platform */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="fixed inset-0 z-50 overflow-hidden shop-management-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>

                        {/* Modal Content */}
                        <motion.div
                            className="absolute inset-0 sm:inset-8 bg-base-100 rounded-lg shadow-2xl flex flex-col overflow-hidden"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-base-300">
                                <h2 className="text-xl font-bold">Shop Management</h2>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="btn btn-sm btn-circle btn-ghost"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Loading State */}
                            {isLoading ? (
                                <ShopLoadingAnimation />
                            ) : (
                                <div className="flex flex-col h-full overflow-hidden">
                                    {/* Shop selector (if user has multiple shops) */}
                                    {shops.length > 1 && (
                                        <div className="px-4 pt-4">
                                            <select
                                                className="select select-bordered w-full max-w-xs"
                                                value={selectedShopId}
                                                onChange={handleShopChange}
                                            >
                                                {shops.map(shop => (
                                                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Tabs */}
                                    <div className="flex overflow-x-auto p-2 gap-2 bg-base-200">
                                        <TabButton
                                            icon={<Calendar className="w-4 h-4" />}
                                            label="Calendar"
                                            isActive={activeTab === 'calendar'}
                                            onClick={() => setActiveTab('calendar')}
                                        />
                                        <TabButton
                                            icon={<BarChart3 className="w-4 h-4" />}
                                            label="Analytics"
                                            isActive={activeTab === 'analytics'}
                                            onClick={() => setActiveTab('analytics')}
                                        />
                                        <TabButton
                                            icon={<Scissors className="w-4 h-4" />}
                                            label="Services"
                                            isActive={activeTab === 'services'}
                                            onClick={() => setActiveTab('services')}
                                        />
                                        <TabButton
                                            icon={<Users2 className="w-4 h-4" />}
                                            label="Team"
                                            isActive={activeTab === 'team'}
                                            onClick={() => setActiveTab('team')}
                                        />
                                        <TabButton
                                            icon={<CreditCard className="w-4 h-4" />}
                                            label="Payments"
                                            isActive={activeTab === 'payments'}
                                            onClick={() => setActiveTab('payments')}
                                        />
                                        <TabButton
                                            icon={<Clock className="w-4 h-4" />}
                                            label="Availability"
                                            isActive={activeTab === 'availability'}
                                            onClick={() => setActiveTab('availability')}
                                        />
                                    </div>

                                    {/* Tab Content */}
                                    <div className="flex-1 overflow-auto p-4">
                                        <AnimatePresence mode="wait">
                                            {selectedShop ? (
                                                <motion.div
                                                    key={activeTab + selectedShop.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="h-full"
                                                >
                                                    {/* Direct component rendering based on tab */}
                                                    {activeTab === 'calendar' && (
                                                        <ShopCalendarTab shop={selectedShop} user={user} />
                                                    )}
                                                    {activeTab === 'analytics' && (
                                                        <ShopAnalyticsTab shop={selectedShop} user={user} />
                                                    )}
                                                    {activeTab === 'services' && (
                                                        <ShopServicesTab shop={selectedShop} user={user} />
                                                    )}
                                                    {activeTab === 'team' && (
                                                        <ComingSoonTab title="Team Management" />
                                                    )}
                                                    {activeTab === 'payments' && (
                                                        <ComingSoonTab title="Payment Processing" />
                                                    )}
                                                    {activeTab === 'availability' && (
                                                        <ComingSoonTab title="Availability Settings" />
                                                    )}
                                                </motion.div>
                                            ) : (
                                                <NoShopsContent />
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

// Tab Button Component
const TabButton = ({ icon, label, isActive, onClick }) => (
    <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`btn btn-sm gap-2 whitespace-nowrap ${
            isActive
                ? 'btn-primary text-primary-content'
                : 'btn-ghost hover:bg-base-300'
        }`}
    >
        {icon}
        <span className="hidden md:inline">{label}</span>
    </motion.button>
);

// Loading Animation
const ShopLoadingAnimation = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center">
            <div className="shop-loader">
                <div className="scissors">
                    <div className="scissor-half scissor-left"></div>
                    <div className="scissor-half scissor-right"></div>
                </div>
                <div className="text-center mt-8">
                    <h3 className="text-xl font-bold mb-2 shimmer">Preparing your dashboard</h3>
                    <p className="text-base-content/70">Loading your appointments and shop data...</p>
                </div>
            </div>
        </div>
    );
};

// Component for "Coming Soon" tabs
const ComingSoonTab = ({ title }) => (
    <div className="h-full flex flex-col items-center justify-center text-center">
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                type: "spring",
                stiffness: 260,
                damping: 20
            }}
        >
            <Clock className="w-16 h-16 mb-4 text-primary/30" />
            <h3 className="text-xl font-bold mb-2">{title} Coming Soon</h3>
            <p className="text-base-content/70 max-w-md">
                We're working hard to bring you this feature. It will be available soon!
            </p>
        </motion.div>
    </div>
);

// Component for when no shops are found
const NoShopsContent = () => (
    <div className="h-full flex flex-col items-center justify-center text-center">
        <Store className="w-16 h-16 mb-4 text-base-content/30" />
        <h3 className="text-xl font-bold mb-2">No shops found</h3>
        <p className="text-base-content/70 mb-6 max-w-md">
            You don't have any barbershops set up yet. Create your first shop to start managing your business.
        </p>
        <motion.button
            className="btn btn-primary gap-2"
            onClick={() => window.location.href = '/create-shop'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            Create Barbershop
            <ChevronRight className="w-4 h-4" />
        </motion.button>
    </div>
);

export default ShopManagementButton;