import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const ServicesDropdown = ({ services = [] }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!services.length) return null;

    const initialServices = services.slice(0, 3);
    const remainingServices = services.slice(3);
    const hasMoreServices = services.length > 3;

    return (
        <div className="w-full space-y-2">
            {/* Initial services (always visible) */}
            <div className="space-y-3">
                {initialServices.map((service, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative"
                    >
                        <div className={`
              flex justify-between items-center text-sm
              ${index === 2 && !isExpanded && hasMoreServices ? 'relative' : ''}
            `}>
                            <span className="truncate font-medium text-base-content/80">{service.name}</span>
                            <span className="flex-shrink-0 font-semibold px-2 py-0.5 rounded-full
                bg-primary/10 text-primary
                dark:bg-primary/20 dark:text-primary-content">
                €{service.price}
              </span>
                        </div>

                        {/* Separator line with gradient ends */}
                        {index !== 2 && (
                            <div className="absolute bottom-0 left-4 right-4 h-px mt-3 bg-gradient-to-r
                from-transparent via-base-content/10 to-transparent" />
                        )}

                        {/* Enhanced gradient overlay for the third item when collapsed */}
                        {index === 2 && !isExpanded && hasMoreServices && (
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 bg-gradient-to-t from-base-100 to-transparent opacity-90" />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-base-100 opacity-90" />
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Expandable section */}
            {hasMoreServices && (
                <div className="relative">
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="space-y-3 pt-2"
                            >
                                {remainingServices.map((service, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="relative"
                                    >
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="truncate font-medium text-base-content/80">{service.name}</span>
                                            <span className="flex-shrink-0 font-semibold px-2 py-0.5 rounded-full
                        bg-primary/10 text-primary
                        dark:bg-primary/20 dark:text-primary-content">
                        €{service.price}
                      </span>
                                        </div>

                                        {/* Separator line with gradient ends */}
                                        {index !== remainingServices.length - 1 && (
                                            <div className="absolute bottom-0 left-4 right-4 h-px mt-3 bg-gradient-to-r
                        from-transparent via-base-content/10 to-transparent" />
                                        )}
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Toggle button */}
                    <motion.button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-center gap-2 mt-3 py-1
              text-xs font-medium text-base-content/50 hover:text-base-content
              transition-colors duration-200"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <ChevronDown className="w-4 h-4" />
                        </motion.div>
                        {isExpanded ? 'Show less' : 'Show all services'}
                    </motion.button>
                </div>
            )}
        </div>
    );
};

export default ServicesDropdown;