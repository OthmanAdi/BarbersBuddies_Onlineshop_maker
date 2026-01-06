import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Edit2, Scissors, Trash2 } from 'lucide-react';

const SelectedServicesGrid = ({ services, onRemoveService, onEditService }) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    // Filter out invalid services
    const validServices = services.filter(service =>
        service &&
        typeof service === 'object' &&
        service.name?.trim() &&
        typeof service.price !== 'undefined' &&
        !isNaN(Number(service.price)) &&
        typeof service.duration !== 'undefined' &&
        !isNaN(Number(service.duration)) &&
        Number(service.duration) > 0
    );

    // Group valid services by category
    const groupedServices = validServices.reduce((acc, service) => {
        const category = service.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push({
            ...service,
            price: Number(service.price),
            duration: Number(service.duration)
        });
        return acc;
    }, {});

    // Calculate statistics only from valid services
    const totalServices = validServices.length;
    const averagePrice = validServices.length
        ? (validServices.reduce((acc, service) => acc + Number(service.price), 0) / validServices.length).toFixed(2)
        : '0.00';
    const totalDuration = validServices.reduce((acc, service) => acc + Number(service.duration), 0);

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="stat bg-primary/10 rounded-xl p-4"
                >
                    <div className="stat-title text-base-content/60">Total Services</div>
                    <div className="stat-value text-primary">{totalServices}</div>
                    <div className="stat-desc">Active services in your menu</div>
                </motion.div>

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="stat bg-secondary/10 rounded-xl p-4"
                >
                    <div className="stat-title text-base-content/60">Average Price</div>
                    <div className="stat-value text-secondary">
                        €{averagePrice}
                    </div>
                    <div className="stat-desc">Per service</div>
                </motion.div>

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="stat bg-accent/10 rounded-xl p-4"
                >
                    <div className="stat-title text-base-content/60">Total Duration</div>
                    <div className="stat-value text-accent">
                        {totalDuration}min
                    </div>
                    <div className="stat-desc">Combined service time</div>
                </motion.div>
            </div>

            {/* Services Grid */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-8"
            >
                {Object.entries(groupedServices).map(([category, categoryServices]) => (
                    <div key={category} className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <BookOpen className="w-5 h-5" />
                            {category}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {categoryServices.map((service, index) => (
                                <motion.div
                                    key={`${service.name}-${index}`}
                                    variants={itemVariants}
                                    layoutId={`service-${service.name}`}
                                    className="group relative bg-base-100 rounded-xl border border-base-200 hover:border-primary/50 shadow-sm hover:shadow-md transition-all duration-300"
                                >
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-base-content group-hover:text-primary transition-colors line-clamp-1">
                                                    {service.name}
                                                </h4>
                                                <div className="flex items-center gap-2 text-sm text-base-content/70">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{service.duration} min</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                                                {service.icon || <Scissors className="w-5 h-5" />}
                                            </div>
                                        </div>

                                        {service.description && (
                                            <p className="text-sm text-base-content/60 line-clamp-2">
                                                {service.description}
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between pt-2">
                                            <span className="text-lg font-bold text-primary">
                                                €{service.price}
                                            </span>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => onEditService(service)}
                                                    className="btn btn-circle btn-ghost btn-sm"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </motion.button>
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => onRemoveService(service)}
                                                    className="btn btn-circle btn-ghost btn-sm text-error"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </motion.button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-base-content/5 to-transparent pointer-events-none" />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ))}
            </motion.div>
        </div>
    );
};

export default SelectedServicesGrid;