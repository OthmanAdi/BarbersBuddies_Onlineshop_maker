/**
 * @fileoverview AddServiceCard Component
 * 
 * A form component for adding new services to a barbershop's catalog.
 * Features an expandable card interface with comprehensive service details management.
 * 
 * Key Features:
 * - Animated expand/collapse transitions
 * - Form validation with error handling
 * - Image upload and management
 * - Duration and pricing controls
 * - Service description editor
 * - Real-time preview
 * 
 * Props:
 * @param {Function} onServiceAdd - Callback when a new service is added
 * @param {Object} t - Translation object for internationalization
 * @param {string} userId - Current user's identifier
 * @param {string} shopId - Current shop's identifier
 * 
 * @example
 * <AddServiceCard
 *   onServiceAdd={handleNewService}
 *   t={translations}
 *   userId="user123"
 *   shopId="shop456"
 * />
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Scissors, Plus, X } from 'lucide-react';
import ServiceImageUploader from "./ServiceImageUploader";

const AddServiceCard = ({ onServiceAdd, t, userId, shopId, setIsImageUploading }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isReadyToSave, setIsReadyToSave] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);
    const [hasDescription, setHasDescription] = useState(false);
    const [hasImage, setHasImage] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        price: '',
        duration: '',
        description: '',
        images: [],
        icon: <Scissors className="w-5 h-5" />
    });
    const [errors, setErrors] = useState({});
    const [isFormVisible, setIsFormVisible] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        const newFormData = {
            ...formData,
            [name]: value
        };
        setFormData(newFormData);

        if (name === 'description' && value.trim() !== '') {
            setHasDescription(true);
        }

        setIsFormValid(
            newFormData.name.trim() !== '' &&
            newFormData.price.trim() !== '' &&
            newFormData.duration.trim() !== ''
        );
    };

    const handleServiceUpdate = useCallback((updatedData) => {
        setFormData(prev => ({
            ...prev,
            ...updatedData
        }));
    }, []);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.price.trim()) newErrors.price = 'Price is required';
        if (!formData.duration.trim()) newErrors.duration = 'Duration is required';
        return newErrors;
    }, [formData]);

    const handleSubmit = useCallback(() => {
        const newErrors = validateForm();
        if (Object.keys(newErrors).length === 0) {
            onServiceAdd(formData);
            setFormData({
                name: '',
                price: '',
                duration: '',
                description: '',
                images: [],
                icon: <Scissors className="w-5 h-5" />
            });
            setIsFormVisible(false);
            setIsExpanded(false);
            setIsEditing(false);
            setHasDescription(false);
        } else {
            setErrors(newErrors);
        }
    }, [formData, onServiceAdd, validateForm]);

    const handleDescriptionSave = useCallback(() => {
        setIsEditing(false);
        setHasDescription(!!formData.description);
    }, [formData.description]);

    if (!isFormVisible) {
        return (
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsFormVisible(true)}
                className="w-full h-full p-4 flex flex-col items-center justify-center gap-2 min-h-[160px] rounded-xl border border-dashed border-base-200 hover:border-primary bg-base-100 hover:bg-primary/5"
            >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-primary" />
                </div>
                <span className="font-medium text-base-content/70">Add New Service</span>
            </motion.button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-xl border shadow-sm hover:shadow-md bg-base-100"
        >
            <div className="p-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-4 w-full">
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="Service Name"
                            className={`w-full text-lg font-semibold bg-transparent border-b ${
                                errors.name ? 'border-error' : 'border-base-200'
                            } focus:outline-none focus:border-primary pb-1`}
                        />
                        {errors.name && <span className="text-xs text-error">{errors.name}</span>}

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleInputChange}
                                        placeholder="Price"
                                        className={`w-full pl-6 py-1 bg-transparent border-b ${
                                            errors.price ? 'border-error' : 'border-base-200'
                                        } focus:outline-none focus:border-primary`}
                                    />
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2">€</span>
                                </div>
                                {errors.price && <span className="text-xs text-error">{errors.price}</span>}
                            </div>
                            <div className="flex-1">
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="duration"
                                        value={formData.duration}
                                        onChange={handleInputChange}
                                        placeholder="Duration"
                                        className={`w-full pr-8 py-1 bg-transparent border-b ${
                                            errors.duration ? 'border-error' : 'border-base-200'
                                        } focus:outline-none focus:border-primary`}
                                    />
                                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm text-base-content/70">min</span>
                                </div>
                                {errors.duration && <span className="text-xs text-error">{errors.duration}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-base-200 mt-4"
                        >
                            <div className="p-4 space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium">Description</label>
                                        <button
                                            onClick={() => {
                                                if (isEditing) {
                                                    handleDescriptionSave();
                                                } else {
                                                    setIsEditing(true);
                                                }
                                            }}
                                            className={`text-xs px-2 py-1 rounded-full transition-all duration-300 
                                                ${!hasDescription
                                                ? 'bg-primary/10 text-primary hover:bg-primary/20 animate-pulse shadow-lg ring-2 ring-primary/30'
                                                : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                                        >
                                            {isEditing ? 'Save' : 'Edit'}
                                        </button>
                                    </div>
                                    {isEditing ? (
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            placeholder="Add a description..."
                                            className="w-full p-2 rounded-lg border border-base-200 bg-base-100 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                            autoFocus
                                        />
                                    ) : (
                                        <p className="text-sm text-base-content/70">
                                            {formData.description || 'No description available'}
                                        </p>
                                    )}
                                </div>

                                <div className={`transition-all duration-300 ${hasDescription ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                    <label className="text-sm font-medium block mb-2">Images</label>
                                    <ServiceImageUploader
                                        serviceName={formData.name}
                                        userId={userId}
                                        shopId={shopId}
                                        initialImages={formData.images}
                                        setIsImageUploading={setIsImageUploading}
                                        onImagesUpdate={(newImages) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                images: newImages
                                            }));
                                            setHasImage(newImages.length > 0);
                                        }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-base-200">
                <button
                    onClick={() => {
                        setIsFormVisible(false);
                        setIsExpanded(false);
                        setFormData({
                            name: '',
                            price: '',
                            duration: '',
                            description: '',
                            images: [],
                            icon: <Scissors className="w-5 h-5" />
                        });
                    }}
                    className="btn btn-ghost btn-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={() => {
                        if (!isExpanded && isFormValid) {
                            setIsExpanded(true);
                        } else if (isExpanded && isFormValid && hasDescription && hasImage) {
                            handleSubmit();
                        }
                    }}
                    disabled={!isFormValid || (isExpanded && (!hasDescription || !hasImage))}
                    className="btn btn-primary btn-sm"
                >
                    {isExpanded ? 'Save' : 'Continue'}
                </button>
            </div>
        </motion.div>
    );
};

export default AddServiceCard;