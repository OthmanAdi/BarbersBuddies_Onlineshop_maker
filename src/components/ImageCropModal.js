import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-image-crop/dist/ReactCrop.css';
import { X, ZoomIn, ZoomOut, Save } from 'lucide-react';

function imageCropModal(mediaWidth, mediaHeight, aspect) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight
        ),
        mediaWidth,
        mediaHeight
    );
}

const ImageCropModal = ({ isOpen, onClose, imageSrc, onCropComplete }) => {
    const [crop, setCrop] = useState();
    const [scale, setScale] = useState(1);
    const imageRef = useRef(null);
    const [completedCrop, setCompletedCrop] = useState(null);

    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;
        const crop = imageCropModal(width, height, 1);
        setCrop(crop);
    };

    const handleZoomIn = () => {
        setScale(prev => Math.min(prev + 0.1, 3));
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(prev - 0.1, 0.5));
    };

    const handleSave = async () => {
        if (!completedCrop || !imageRef.current) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const image = imageRef.current;

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        canvas.width = completedCrop.width;
        canvas.height = completedCrop.height;

        ctx.drawImage(
            image,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            completedCrop.width,
            completedCrop.height
        );

        canvas.toBlob((blob) => {
            const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
            onCropComplete(file);
            onClose();
        }, 'image/jpeg', 0.95);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.95 }}
                        className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Adjust Profile Picture
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Cropper */}
                        <div className="relative p-4">
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                                className="max-h-[60vh]"
                            >
                                <img
                                    ref={imageRef}
                                    src={imageSrc}
                                    alt="Crop me"
                                    style={{ transform: `scale(${scale})` }}
                                    onLoad={onImageLoad}
                                    className="max-w-full transition-transform"
                                />
                            </ReactCrop>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleZoomOut}
                                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors"
                                >
                                    <ZoomOut className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleZoomIn}
                                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors"
                                >
                                    <ZoomIn className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Save
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ImageCropModal;