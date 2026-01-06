import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ShopCalendarTab from './ShopCalendarTab';
import ShopAnalyticsTab from './ShopAnalyticsTab';
import ShopServicesTab from './ShopServicesTab';
import { Store, AlertTriangle } from 'lucide-react';

const ShopTabContent = ({ tab, shops, user }) => {
    const [selectedShopId, setSelectedShopId] = useState(shops?.[0]?.id || null);
    const [selectedShop, setSelectedShop] = useState(shops?.[0] || null);

    // Update selected shop when shops change or shop ID changes
    useEffect(() => {
        if (shops.length > 0) {
            // If the current selected shop is no longer in the list, select the first shop
            if (!selectedShopId || !shops.find(shop => shop.id === selectedShopId)) {
                setSelectedShopId(shops[0].id);
                setSelectedShop(shops[0]);
            } else {
                // Update the selected shop data
                const shop = shops.find(shop => shop.id === selectedShopId);
                setSelectedShop(shop);
            }
        } else {
            setSelectedShopId(null);
            setSelectedShop(null);
        }
    }, [shops, selectedShopId]);

    // Handle shop selection change
    const handleShopChange = (e) => {
        const newShopId = e.target.value;
        setSelectedShopId(newShopId);
        const shop = shops.find(shop => shop.id === newShopId);
        setSelectedShop(shop);
    };

    if (shops.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center">
                <Store className="w-16 h-16 mb-4 text-base-content/30" />
                <h3 className="text-xl font-bold mb-2">No shops found</h3>
                <p className="text-base-content/70 mb-6 max-w-md">
                    You don't have any barbershops set up yet. Create your first shop to start managing your business.
                </p>
                <button
                    className="btn btn-primary"
                    onClick={() => window.location.href = '/create-shop'}
                >
                    Create Your First Shop
                </button>
            </div>
        );
    }

    if (!selectedShop) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="loading loading-spinner text-primary"></div>
            </div>
        );
    }

    // Render placeholder for unimplemented tabs
    const renderPlaceholder = (tabName) => (
        <div className="h-full flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-12 h-12 text-warning mb-4" />
            <h3 className="text-xl font-bold mb-2">{tabName} Coming Soon</h3>
            <p className="text-base-content/70 max-w-md">
                We're working hard to bring you this feature. It will be available soon!
            </p>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            {/* Shop Selector (if multiple shops) */}
            {shops.length > 1 && (
                <div className="mb-4">
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

            {/* Render selected tab */}
            <div className="flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={tab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1"
                    >
                        {tab === 'calendar' && <ShopCalendarTab shop={selectedShop} user={user} />}
                        {tab === 'analytics' && <ShopAnalyticsTab shop={selectedShop} user={user} />}
                        {tab === 'services' && <ShopServicesTab shop={selectedShop} user={user} />}
                        {tab === 'team' && renderPlaceholder('Team Management')}
                        {tab === 'payments' && renderPlaceholder('Payment Processing')}
                        {tab === 'availability' && renderPlaceholder('Availability Settings')}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ShopTabContent;