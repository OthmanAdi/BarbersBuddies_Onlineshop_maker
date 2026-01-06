import React, { useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { motion } from 'framer-motion';
import { ImagePlus, X, Loader } from 'lucide-react';

const ServiceImageUploader = ({
                                  setIsImageUploading,
                                  serviceName,
                                  userId,
                                  initialImages = [],
                                  onImagesUpdate,
                                  shopId,
                                  maxImages = 6
                              }) => {
    const [images, setImages] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        setImages(initialImages);
    }, [initialImages]);

    const handleImageSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setIsUploading(true);
        setIsImageUploading(true);

        try {
            const uploadPromises = files.map(async (file) => {
                const imageRef = ref(
                    storage,
                    // Using shopName instead of shopId for storage path
                    `shops/${userId}/services/${serviceName}/${Date.now()}_${file.name}`
                );

                await uploadBytes(imageRef, file);
                const downloadURL = await getDownloadURL(imageRef);

                return {
                    url: downloadURL,
                    path: imageRef.fullPath,
                    name: file.name
                };
            });

            const uploadedImages = await Promise.all(uploadPromises);
            const newImages = [...images, ...uploadedImages];
            setImages(newImages);
            onImagesUpdate(newImages);

        } catch (error) {
            console.error('Error uploading images:', error);
        } finally {
            setIsUploading(false);
            setIsImageUploading(false);
        }
    };

    const removeImage = (indexToRemove) => {
        const newImages = images.filter((_, i) => i !== indexToRemove);
        setImages(newImages);
        onImagesUpdate(newImages);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {images.map((image, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden">
                        <img
                            src={image.url}
                            alt={`Service ${i + 1}`}
                            className="w-full h-full object-cover"
                        />
                        <motion.button
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-base-100/80 text-base-content hover:bg-base-100 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </motion.button>
                    </div>
                ))}

                {images.length < maxImages && !isUploading && (
                    <label className="cursor-pointer group">
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageSelect}
                            className="hidden"
                        />
                        <div className="aspect-square rounded-lg border-2 border-dashed border-base-300 hover:border-primary transition-colors flex items-center justify-center bg-base-200/50 hover:bg-base-200">
                            <ImagePlus className="w-6 h-6 text-base-content/50 group-hover:text-primary transition-colors" />
                        </div>
                    </label>
                )}

                {isUploading && (
                    <div className="aspect-square rounded-lg border-2 border-primary border-dashed flex items-center justify-center bg-base-200/50">
                        <Loader className="w-6 h-6 text-primary animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServiceImageUploader;