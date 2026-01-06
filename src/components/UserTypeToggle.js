import React, {useState} from 'react';
import {motion} from 'framer-motion';
import AccountTypeInfo from "./AccountTypeInfo";

const UserTypeToggle = ({userType, setUserType, showTypeWarning, setIsTextAnimating}) => {
    const [hoveredType, setHoveredType] = useState(null);

    const handleTypeSelect = (type) => {
        setUserType(type);
        setIsTextAnimating(true);
    };

    return (
        <div className="w-full flex justify-center mb-8">
            <motion.div
                animate={showTypeWarning ? {
                    scale: [1, 1.02, 1],
                    borderColor: ['#ef4444', '#ef4444', 'transparent']
                } : {}}
                transition={{duration: 0.5, repeat: 3}}
                className="relative w-72 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 p-1"
            >
                {/* Background Pill */}
                <motion.div
                    className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg ${
                        userType === 'customer'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                            : userType === 'shop-owner'
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                                : 'opacity-0'
                    }`}
                    animate={{
                        x: userType === 'customer'
                            ? '4px'
                            : userType === 'shop-owner'
                                ? 'calc(100% + 4px)'
                                : '4px',
                        opacity: userType ? 1 : 0
                    }}
                    initial={{opacity: 0}}
                    transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30
                    }}
                />

                {/* Buttons Container */}
                <div className="relative flex w-full h-full">
                    <button
                        onClick={() => { setUserType('shop-owner'); handleTypeSelect('customer') }}
                        onMouseEnter={() => setHoveredType('customer')}
                        onMouseLeave={() => setHoveredType(null)}
                        className={`flex-1 flex items-center justify-center text-sm font-medium rounded-lg transition-colors duration-200 z-10 ${
                            userType === 'customer'
                                ? 'text-white dark:text-gray-900'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Customer
                    </button>
                    <button
                        onClick={() => { setUserType('shop-owner'); handleTypeSelect('shop-owner') }}
                        onMouseEnter={() => setHoveredType('shop-owner')}
                        onMouseLeave={() => setHoveredType(null)}
                        className={`flex-1 flex items-center justify-center text-sm font-medium rounded-lg transition-colors duration-200 z-10 ${
                            userType === 'shop-owner'
                                ? 'text-white dark:text-gray-900'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Shop Owner
                    </button>
                </div>

                <AccountTypeInfo
                    type={hoveredType}
                    isVisible={hoveredType !== null}
                />

                {/* Enhanced hover effect */}
                <div
                    className="absolute inset-0 rounded-xl transition-opacity duration-200 pointer-events-none"
                    style={{
                        background: `linear-gradient(120deg,
                            ${userType === 'shop-owner'
                            ? 'rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.05)'
                            : 'rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.05)'
                        })`,
                        opacity: 0.7
                    }}
                />
            </motion.div>
        </div>
    );
};

export default UserTypeToggle;
