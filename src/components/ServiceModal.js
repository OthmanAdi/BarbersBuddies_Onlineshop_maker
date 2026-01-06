import { motion } from 'framer-motion';
import { Calendar, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const ServiceModal = ({ service, shopId, onClose, t }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const urls = service.imageUrl ? [service.imageUrl] : (service.imageUrls || []);
  const hasImages = urls.length > 0;
  const canNavigateImages = hasImages && urls.length > 1;

  const nextImage = () => {
    setCurrentImageIndex((prev) => prev === urls.length - 1 ? 0 : prev + 1);
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => prev === 0 ? urls.length - 1 : prev - 1);
  };

  return (
      <div className="modal modal-open">
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="modal-box max-w-3xl w-11/12 p-0 bg-base-100"
        >
          <button onClick={onClose} className="absolute right-2 top-2 btn btn-sm btn-ghost btn-circle z-10">
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col md:flex-row">
            {hasImages && (
                <div className="relative w-full md:w-1/2 aspect-square">
                  <img
                      src={urls[currentImageIndex]}
                      alt={service.name}
                      className="w-full h-full object-cover"
                  />
                  {canNavigateImages && (
                      <>
                        <button onClick={previousImage} className="absolute left-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm btn-ghost bg-base-100/80 hover:bg-base-100">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm btn-ghost bg-base-100/80 hover:bg-base-100">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-base-100/80 text-xs">
                          {currentImageIndex + 1} / {urls.length}
                        </div>
                      </>
                  )}
                </div>
            )}

            <div className="p-6 w-full md:w-1/2 flex flex-col h-full">
              <h3 className="text-2xl font-bold mb-2">{service.name}</h3>

              <div className="flex items-center gap-4 mb-6">
                <div className="badge badge-success text-lg py-3">€{service.price}</div>
                {service.duration && (
                    <div className="flex items-center gap-1 text-base-content/70">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration} min</span>
                    </div>
                )}
              </div>

              {service.description && (
                  <div className="prose prose-sm max-w-none mb-6">
                    <p>{service.description}</p>
                  </div>
              )}

              <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:gap-4">
                <button onClick={onClose} className="btn btn-outline flex-1">Close</button>
                <Link to={`/book/${shopId}?service=${service.name}`} className="btn btn-primary flex-1 gap-2">
                  <Calendar className="w-5 h-5" />
                  {t.bookNow}
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
  );
};

export default ServiceModal;