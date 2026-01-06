import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight } from 'lucide-react';

const AccountTypeWarning = ({ show, onClose }) => {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-6 w-full"
                >
                    <motion.div
                        className="backdrop-blur-sm bg-gradient-to-r from-red-50/90 to-orange-50/90 dark:from-red-950/90 dark:to-orange-950/90
                       rounded-2xl shadow-lg border border-red-200/50 dark:border-red-800/50 overflow-hidden"
                        initial={{ scale: 0.95, rotateX: -10 }}
                        animate={{ scale: 1, rotateX: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 25
                        }}
                    >
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 dark:from-red-500/5 dark:to-orange-500/5"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />

                        <div className="relative p-4">
                            <div className="flex items-center">
                                <motion.div
                                    initial={{ rotate: 0 }}
                                    animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                    className="flex-shrink-0 bg-red-100 dark:bg-red-900/30 rounded-full p-2"
                                >
                                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </motion.div>

                                <div className="ml-4 flex-1">
                                    <h3 className="text-base font-semibold text-red-900 dark:text-red-100">
                                        Account Type Required
                                    </h3>
                                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                                        Please select whether you're a Customer or Shop Owner to continue
                                    </p>
                                </div>

                                <motion.button
                                    onClick={onClose}
                                    className="ml-4 flex items-center justify-center rounded-full w-8 h-8
                           bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400
                           hover:bg-red-200 dark:hover:bg-red-800/30 transition-colors"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </motion.button>
                            </div>

                            <motion.div
                                className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-red-500 to-orange-500"
                                initial={{ width: "100%" }}
                                animate={{ width: "0%" }}
                                transition={{ duration: 5, ease: "linear" }}
                                onAnimationComplete={onClose}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AccountTypeWarning;