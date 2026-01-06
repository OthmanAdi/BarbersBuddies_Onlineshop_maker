import React from 'react';
import { motion } from 'framer-motion';
import { Scissors, Clock, Calendar, User } from 'lucide-react';

const AppointmentSkeleton = () => (
    <div className="card bg-white shadow-xl rounded-2xl h-full relative overflow-hidden dark:bg-gray-800">
        <div className="card-body">
            {/* Status Tags */}
            <div className="absolute top-4 right-4 flex gap-2">
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            </div>

            {/* Barber Profile */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <Scissors className="absolute bottom-0 right-0 text-gray-400 w-6 h-6" />
                </div>
                <div className="flex-1">
                    <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                    <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
            </div>

            {/* Appointment Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <Calendar className="text-gray-400 w-4 h-4" />
                    <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="text-gray-400 w-4 h-4" />
                    <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
            </div>

            {/* Service Details */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <User className="text-gray-400 w-4 h-4" />
                    <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>

            {/* Action Buttons */}
            <div className="card-actions justify-end mt-4">
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
        </div>
    </div>
);

const AppointmentSkeletonGrid = () => {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.5,
                                delay: index * 0.2,
                                ease: "easeOut"
                            }}
                            className="relative"
                        >
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent dark:via-gray-700"
                                animate={{
                                    x: ['-200%', '200%']
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "linear",
                                    repeatDelay: 0.5
                                }}
                                style={{ opacity: 0.7 }}
                            />
                            <AppointmentSkeleton />
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AppointmentSkeletonGrid;