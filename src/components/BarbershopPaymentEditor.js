import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Banknote, Smartphone } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const BarbershopPaymentEditor = ({ shopId, initialMethods = [], onSelect }) => {
    const [selectedMethods, setSelectedMethods] = useState(initialMethods);
    const [activeCategory, setActiveCategory] = useState('popular');

    // Update local state when initialMethods changes
    useEffect(() => {
        setSelectedMethods(initialMethods);
    }, [initialMethods]);

    const PayPalIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.1 6.34C19.95 5.55 19.46 4.88 18.76 4.38C18.06 3.88 17.19 3.62 16.29 3.62H11.13C10.95 3.62 10.79 3.71 10.71 3.86L7.47 14.62C7.41 14.82 7.57 15.02 7.78 15.02H10.39L11.21 11.31L11.19 11.41C11.25 11.18 11.46 11.03 11.69 11.03H13.02C16.02 11.03 18.35 9.45 19.01 5.95C19.02 5.89 19.02 5.83 19.03 5.77C18.98 5.77 18.98 5.77 19.03 5.77C19.12 5.94 19.19 6.13 19.24 6.34" fill="currentColor"/>
            <path d="M11.69 7.13C11.76 7.13 11.82 7.15 11.88 7.18C11.94 7.21 11.99 7.25 12.03 7.3C12.07 7.35 12.1 7.41 12.12 7.48C12.14 7.55 12.15 7.62 12.15 7.69C12.15 7.82 12.12 7.94 12.06 8.04C12 8.14 11.91 8.22 11.81 8.28C11.71 8.34 11.59 8.37 11.46 8.37C11.33 8.37 11.21 8.34 11.11 8.28C11.01 8.22 10.93 8.14 10.87 8.04C10.81 7.94 10.78 7.82 10.78 7.69C10.78 7.56 10.81 7.44 10.87 7.34C10.93 7.24 11.01 7.16 11.11 7.1C11.21 7.04 11.33 7.01 11.46 7.01C11.54 7.01 11.61 7.02 11.69 7.04V7.13Z" fill="currentColor"/>
        </svg>
    );

    const methods = {
        popular: [
            { id: 'visa', icon: CreditCard, label: 'Visa', color: '#1A1F71' },
            { id: 'mastercard', icon: CreditCard, label: 'Mastercard', color: '#EB001B' },
            { id: 'paypal', icon: PayPalIcon, label: 'PayPal', color: '#003087' },
            { id: 'klarna', icon: CreditCard, label: 'Klarna', color: '#FFB3C7' }
        ],
        other: [
            { id: 'sepa', icon: Banknote, label: 'SEPA Transfer', color: '#0052FF' },
            { id: 'cash', icon: Banknote, label: 'Cash', color: '#00C805' },
            { id: 'mobile', icon: Smartphone, label: 'Mobile Pay', color: '#5F259F' }
        ]
    };

    const toggleMethod = (methodId) => {
        const newMethods = selectedMethods.includes(methodId)
            ? selectedMethods.filter(m => m !== methodId)
            : [...selectedMethods, methodId];
        setSelectedMethods(newMethods);

        // Call onSelect with updated methods
        onSelect(newMethods);

        // Optionally update Firebase directly
        if (shopId) {
            const shopRef = doc(db, 'barberShops', shopId);
            updateDoc(shopRef, {
                paymentMethods: newMethods
            }).catch(error => {
                console.error('Error updating payment methods:', error);
            });
        }
    };

    const MethodCard = ({ method }) => (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-full"
        >
            <motion.button
                onClick={() => toggleMethod(method.id)}
                className={`
                    w-full p-6 rounded-2xl border-2 transition-colors
                    ${selectedMethods.includes(method.id)
                    ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-transparent'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }
                `}
                style={{
                    boxShadow: selectedMethods.includes(method.id)
                        ? `0 8px 32px ${method.color}33`
                        : '0 4px 12px rgba(0,0,0,0.05)'
                }}
            >
                <div className="flex items-center gap-4">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${method.color}15` }}
                    >
                        <method.icon
                            className="w-6 h-6"
                            style={{ color: method.color }}
                        />
                    </div>
                    <div className="flex-1 text-left">
                        <h3 className="font-semibold">{method.label}</h3>
                        <p className="text-sm text-gray-500">
                            {selectedMethods.includes(method.id) ? 'Selected' : 'Click to select'}
                        </p>
                    </div>
                    <motion.div
                        initial={false}
                        animate={{
                            scale: selectedMethods.includes(method.id) ? 1 : 0,
                            opacity: selectedMethods.includes(method.id) ? 1 : 0
                        }}
                        className="w-3 h-3 rounded-full bg-green-400"
                    />
                </div>
            </motion.button>
        </motion.div>
    );

    return (
        <motion.div
            className="p-4 md:p-8 max-w-4xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="text-center mb-12">
                <motion.h1
                    className="text-4xl font-bold mb-4"
                    initial={{ y: -20 }}
                    animate={{ y: 0 }}
                >
                    Payment Methods
                </motion.h1>
                <motion.p
                    className="text-gray-600"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    Update your accepted payment methods
                </motion.p>
            </div>

            <div className="flex gap-4 mb-8 justify-center">
                {['popular', 'other'].map((category) => (
                    <motion.button
                        key={category}
                        onClick={() => setActiveCategory(category)}
                        className={`
                            px-6 py-2 rounded-full text-sm font-medium
                            ${activeCategory === category
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }
                        `}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                    </motion.button>
                ))}
            </div>

            <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
                <AnimatePresence mode="wait">
                    {methods[activeCategory].map((method) => (
                        <MethodCard key={method.id} method={method} />
                    ))}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default BarbershopPaymentEditor;