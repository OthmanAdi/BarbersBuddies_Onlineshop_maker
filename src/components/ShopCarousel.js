import React, {useState} from "react";
import {AnimatePresence, motion} from "framer-motion";

const ShopCarousel = ({imageUrls}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // **Conditional Rendering**: Do not render the carousel if there are no images
    if (!imageUrls || imageUrls.length === 0) {
        return null; // Render nothing
    }

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
    };

    return (<div className="relative w-full max-w mx-auto">
            {/* Image Slider */}
            <div className="relative w-full h-60 overflow-hidden rounded-lg shadow-lg">
                <AnimatePresence>
                    <motion.img
                        key={imageUrls[currentIndex]}
                        src={imageUrls[currentIndex]}
                        alt={`Image ${currentIndex + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                        initial={{opacity: 0, scale: 0.95}}
                        animate={{opacity: 1, scale: 1}}
                        exit={{opacity: 0, scale: 0.95}}
                        transition={{duration: 0.4}}
                    />
                </AnimatePresence>
            </div>

            {/* Navigation Dots */}
            {imageUrls.length > 1 && (<div className="flex justify-center mt-4 space-x-2">
                    {imageUrls.map((_, index) => (<button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-3 h-3 rounded-full ${index === currentIndex ? "bg-primary" : "bg-gray-300"}`}
                            aria-label={`Go to image ${index + 1}`}
                        ></button>))}
                </div>)}

            {/* Navigation Buttons */}
            {imageUrls.length > 1 && (<>
                    <button
                        onClick={handlePrev}
                        className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/80 transition"
                        aria-label="Previous image"
                    >
                        ❮
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/80 transition"
                        aria-label="Next image"
                    >
                        ❯
                    </button>
                </>)}
        </div>);
};

export default ShopCarousel;
