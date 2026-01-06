import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, doc, updateDoc, getDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
    Scissors, DollarSign, Clock, Image as ImageIcon, Edit, Trash, Plus, Save, X, AlertTriangle, CheckCircle, Camera
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const ShopServicesTab = ({ shop, user }) => {
    const [services, setServices] = useState([]);
    const [editingService, setEditingService] = useState(null);
    const [isAddingService, setIsAddingService] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const formRef = useRef(null);

    useEffect(() => {
        if (shop?.services) {
            setServices(shop.services);
        }
    }, [shop]);

    const filteredServices = services.filter(service => {
        const matchesSearch = searchQuery === '' ||
            service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            service.description?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = categoryFilter === 'all' ||
            service.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    // Extract categories from services
    const categories = ['all', ...new Set(services.map(service => service.category).filter(Boolean))];

    const handleAddService = () => {
        setEditingService(null);
        setIsAddingService(true);

        // Scroll to form
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleEditService = (service) => {
        setIsAddingService(false);
        setEditingService({
            ...service,
            tempImages: [] // For new images being uploaded
        });

        // Scroll to form
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSaveService = async (event) => {
        event.preventDefault();

        // Form validation
        const form = event.target;
        const name = form.serviceName.value.trim();
        const price = parseFloat(form.price.value);
        const duration = parseInt(form.duration.value);
        const description = form.description?.value.trim();
        const category = form.category?.value.trim();

        if (!name || isNaN(price) || isNaN(duration) || duration <= 0) {
            setErrorMessage('Please fill in all required fields with valid values');
            return;
        }

        setIsSaving(true);
        setErrorMessage('');

        try {
            // Create the service object
            const serviceData = {
                name,
                price: price.toFixed(2),
                duration: duration.toString(),
                description: description || '',
                category: category || 'Other',
                // We'll handle images separately
            };

            // Handle image uploads for new service or editing
            const isNewService = isAddingService;
            const existingImages = isNewService ? [] : (editingService.imageUrls || []);
            let newImageUrls = [...existingImages];

            // Upload any new images
            const tempImages = isNewService ?
                form.serviceImage?.files :
                editingService.tempImages;

            if (tempImages && tempImages.length > 0) {
                for (let i = 0; i < tempImages.length; i++) {
                    const file = tempImages[i];

                    // Skip if it's not a file object (might be an existing URL)
                    if (!(file instanceof File)) continue;

                    const imagePath = `shops/${shop.id}/services/${name}/${Date.now()}_${file.name}`;
                    const imageRef = ref(storage, imagePath);

                    await uploadBytes(imageRef, file);
                    const imageUrl = await getDownloadURL(imageRef);
                    newImageUrls.push(imageUrl);
                }
            }

            // Add imageUrls to the service data
            serviceData.imageUrls = newImageUrls;

            // Update Firestore
            const shopRef = doc(db, 'barberShops', shop.id);
            const shopDoc = await getDoc(shopRef);

            if (shopDoc.exists()) {
                const currentServices = shopDoc.data().services || [];

                if (isNewService) {
                    // Add new service
                    await updateDoc(shopRef, {
                        services: [...currentServices, serviceData],
                        lastUpdated: serverTimestamp()
                    });

                    setSuccessMessage('Service added successfully');
                } else {
                    // Update existing service
                    const updatedServices = currentServices.map(service =>
                        service.name === editingService.name ? serviceData : service
                    );

                    await updateDoc(shopRef, {
                        services: updatedServices,
                        lastUpdated: serverTimestamp()
                    });

                    setSuccessMessage('Service updated successfully');
                }

                // Update local state
                setServices(isNewService ?
                    [...services, serviceData] :
                    services.map(service => service.name === editingService.name ? serviceData : service)
                );

                // Reset form
                setIsAddingService(false);
                setEditingService(null);
                form.reset();
            }
        } catch (error) {
            console.error('Error saving service:', error);
            setErrorMessage('Failed to save service. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteService = async (service) => {
        // Confirm deletion
        if (!window.confirm(`Are you sure you want to delete ${service.name}?`)) {
            return;
        }

        try {
            // Delete service images from storage if they exist
            if (service.imageUrls && service.imageUrls.length > 0) {
                for (const imageUrl of service.imageUrls) {
                    try {
                        // Extract the storage path from the URL
                        const urlPath = imageUrl.split('?')[0]; // Remove query params
                        const storagePath = urlPath.split('.com/o/')[1];
                        if (storagePath) {
                            const decodedPath = decodeURIComponent(storagePath);
                            const imageRef = ref(storage, decodedPath);
                            await deleteObject(imageRef);
                        }
                    } catch (imgError) {
                        console.error('Error deleting image:', imgError);
                        // Continue with deletion even if image deletion fails
                    }
                }
            }

            // Update Firestore by removing the service
            const shopRef = doc(db, 'barberShops', shop.id);
            const shopDoc = await getDoc(shopRef);

            if (shopDoc.exists()) {
                const updatedServices = shopDoc.data().services.filter(s => s.name !== service.name);

                await updateDoc(shopRef, {
                    services: updatedServices,
                    lastUpdated: serverTimestamp()
                });

                // Update local state
                setServices(services.filter(s => s.name !== service.name));
                setSuccessMessage('Service deleted successfully');
            }
        } catch (error) {
            console.error('Error deleting service:', error);
            setErrorMessage('Failed to delete service. Please try again.');
        }
    };

    const handleCancelEdit = () => {
        setIsAddingService(false);
        setEditingService(null);
        setErrorMessage('');
    };

    const categories5 = ['All', 'Haircut', 'Beard', 'Coloring', 'Treatment', 'Other'];
    const durations = [15, 30, 45, 60, 90, 120];

    // Service form component
    const ServiceForm = ({ isEditing = false }) => {
        const service = isEditing ? editingService : null;
        const [selectedImages, setSelectedImages] = useState([]);
        const [previewUrls, setPreviewUrls] = useState(isEditing ? service?.imageUrls || [] : []);

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
            accept: {
                'image/*': []
            },
            onDrop: (acceptedFiles) => {
                const newFiles = acceptedFiles.map(file =>
                    Object.assign(file, {
                        preview: URL.createObjectURL(file)
                    })
                );

                if (isEditing) {
                    setEditingService({
                        ...service,
                        tempImages: [...(service.tempImages || []), ...newFiles]
                    });
                    setPreviewUrls([...previewUrls, ...newFiles.map(file => file.preview)]);
                } else {
                    setSelectedImages([...selectedImages, ...newFiles]);
                    setPreviewUrls([...previewUrls, ...newFiles.map(file => file.preview)]);
                }
            }
        });

        const removeImage = (index) => {
            if (isEditing) {
                // If it's an existing URL, just remove from the preview but keep in the service
                if (index < (service.imageUrls?.length || 0)) {
                    const newUrls = [...previewUrls];
                    newUrls.splice(index, 1);
                    setPreviewUrls(newUrls);

                    const newImageUrls = [...(service.imageUrls || [])];
                    newImageUrls.splice(index, 1);

                    setEditingService({
                        ...service,
                        imageUrls: newImageUrls
                    });
                } else {
                    // It's a temp image, remove it from tempImages
                    const adjustedIndex = index - (service.imageUrls?.length || 0);
                    const newTempImages = [...(service.tempImages || [])];
                    newTempImages.splice(adjustedIndex, 1);

                    setEditingService({
                        ...service,
                        tempImages: newTempImages
                    });

                    const newUrls = [...previewUrls];
                    newUrls.splice(index, 1);
                    setPreviewUrls(newUrls);
                }
            } else {
                const newImages = [...selectedImages];
                newImages.splice(index, 1);
                setSelectedImages(newImages);

                const newUrls = [...previewUrls];
                newUrls.splice(index, 1);
                setPreviewUrls(newUrls);
            }
        };

        return (
            <motion.div
                ref={formRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="card bg-base-100 shadow-lg mb-6"
            >
                <div className="card-body">
                    <h3 className="card-title flex items-center gap-2">
                        <Scissors className="w-5 h-5" />
                        {isEditing ? 'Edit Service' : 'Add New Service'}
                    </h3>

                    <form onSubmit={handleSaveService}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Service Name *</span>
                                </label>
                                <input
                                    type="text"
                                    name="serviceName"
                                    defaultValue={service?.name || ''}
                                    className="input input-bordered"
                                    placeholder="E.g., Men's Haircut"
                                    required
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Category</span>
                                </label>
                                <select
                                    name="category"
                                    defaultValue={service?.category || 'Other'}
                                    className="select select-bordered"
                                >
                                    {categories5.map(cat => (
                                        <option key={cat} value={cat === 'All' ? 'Other' : cat}>
                                            {cat === 'All' ? 'Other' : cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Price (€) *</span>
                                </label>
                                <div className="flex">
                  <span className="input-group-addon px-3 py-2 bg-base-300 border border-base-300 rounded-l-md flex items-center">
                    <DollarSign className="w-4 h-4" />
                  </span>
                                    <input
                                        type="number"
                                        name="price"
                                        defaultValue={service?.price || ''}
                                        className="input input-bordered rounded-l-none w-full"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Duration (minutes) *</span>
                                </label>
                                <div className="flex">
                  <span className="input-group-addon px-3 py-2 bg-base-300 border border-base-300 rounded-l-md flex items-center">
                    <Clock className="w-4 h-4" />
                  </span>
                                    <select
                                        name="duration"
                                        defaultValue={service?.duration || '30'}
                                        className="select select-bordered rounded-l-none w-full"
                                        required
                                    >
                                        {durations.map(duration => (
                                            <option key={duration} value={duration}>
                                                {duration} min
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="form-control mb-4">
                            <label className="label">
                                <span className="label-text">Description</span>
                            </label>
                            <textarea
                                name="description"
                                defaultValue={service?.description || ''}
                                className="textarea textarea-bordered h-24"
                                placeholder="Describe your service..."
                            ></textarea>
                        </div>

                        <div className="form-control mb-4">
                            <label className="label">
                                <span className="label-text">Service Images</span>
                            </label>

                            {/* Image Dropzone */}
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'}`}
                            >
                                <input {...getInputProps({ name: 'serviceImage' })} />
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Camera className="w-8 h-8 text-base-content/50" />
                                    {isDragActive ? (
                                        <p>Drop the images here...</p>
                                    ) : (
                                        <p>Drag & drop images here, or click to select files</p>
                                    )}
                                </div>
                            </div>

                            {/* Image Previews */}
                            {previewUrls.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-4">
                                    {previewUrls.map((url, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={url}
                                                alt={`Preview ${index + 1}`}
                                                className="w-full h-24 object-cover rounded-md"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1 right-1 bg-error text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {errorMessage && (
                            <div className="alert alert-error mb-4">
                                <AlertTriangle className="w-5 h-5" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="btn btn-ghost"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="btn btn-primary gap-2"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs"></span>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Save Service
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            {/* Success Message */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="alert alert-success mb-4"
                    >
                        <CheckCircle className="w-5 h-5" />
                        <span>{successMessage}</span>
                        <button
                            className="btn btn-sm btn-ghost ml-auto"
                            onClick={() => setSuccessMessage('')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Form for adding/editing service */}
            <AnimatePresence>
                {(isAddingService || editingService) && (
                    <ServiceForm isEditing={!!editingService} />
                )}
            </AnimatePresence>

            {/* List Header with Search and Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-bold">Service Management</h3>
                    <p className="text-sm text-base-content/60">
                        Manage your service offerings and pricing
                    </p>
                </div>

                <button
                    onClick={handleAddService}
                    className="btn btn-primary gap-2"
                    disabled={isAddingService || editingService}
                >
                    <Plus className="w-4 h-4" />
                    Add Service
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search services..."
                        className="input input-bordered w-full pl-10"
                    />
                    <Scissors className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-base-content/40" />
                </div>

                <div className="flex gap-2">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="select select-bordered"
                    >
                        <option value="all">All Categories</option>
                        {categories.filter(cat => cat !== 'all').map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Services List */}
            <div className="flex-1 overflow-auto">
                {filteredServices.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-10"
                    >
                        <Scissors className="w-12 h-12 mx-auto text-base-content/20 mb-4" />
                        <h4 className="text-lg font-semibold mb-2">No services found</h4>
                        <p className="text-base-content/60 mb-6">
                            {services.length === 0
                                ? "You haven't added any services yet."
                                : "No services match your search criteria."}
                        </p>

                        {services.length === 0 && (
                            <button
                                onClick={handleAddService}
                                className="btn btn-primary"
                            >
                                Add Your First Service
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredServices.map((service) => (
                            <motion.div
                                key={service.name}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <figure className="relative h-36">
                                    {service.imageUrls && service.imageUrls.length > 0 ? (
                                        <img
                                            src={service.imageUrls[0]}
                                            alt={service.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-base-200">
                                            <ImageIcon className="w-8 h-8 text-base-content/30" />
                                        </div>
                                    )}

                                    {service.category && (
                                        <div className="absolute top-2 left-2 badge badge-sm badge-primary">
                                            {service.category}
                                        </div>
                                    )}
                                </figure>

                                <div className="card-body p-4">
                                    <div className="flex justify-between items-start">
                                        <h2 className="card-title text-lg">{service.name}</h2>
                                        <div className="text-lg font-bold">€{service.price}</div>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-base-content/70 mb-2">
                                        <Clock className="w-4 h-4" />
                                        <span>{service.duration} min</span>
                                    </div>

                                    {service.description && (
                                        <p className="text-sm line-clamp-2">{service.description}</p>
                                    )}

                                    <div className="card-actions justify-end mt-2">
                                        <button
                                            onClick={() => handleEditService(service)}
                                            className="btn btn-sm btn-outline gap-1"
                                        >
                                            <Edit className="w-4 h-4" />
                                            Edit
                                        </button>

                                        <button
                                            onClick={() => handleDeleteService(service)}
                                            className="btn btn-sm btn-outline btn-error gap-1"
                                        >
                                            <Trash className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopServicesTab;