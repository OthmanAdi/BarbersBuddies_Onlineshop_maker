import React, {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {MessageSquare, Star, X} from 'lucide-react';
import {collection, getDocs, orderBy, query, where} from 'firebase/firestore';
import {db} from '../firebase';

const ReviewDialogPortal = ({shopId, initialRating = 0, reviewCount = 0, distribution = {}, isOpen, onClose}) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [averageRating, setAverageRating] = useState(0);

    useEffect(() => {
        const fetchReviews = async () => {
            if (!isOpen) return;

            try {
                const ratingsRef = collection(db, 'ratings');
                const q = query(ratingsRef, where('shopId', '==', shopId), where('status', '==', 'active'), orderBy('createdAt', 'desc'));

                const querySnapshot = await getDocs(q);
                const fetchedReviews = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        userName: data.userName,
                        date: data.appointmentDate,
                        time: data.appointmentTime,
                        services: data.services.map(service => service.name),
                        rating: data.rating,
                        comment: data.review,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        helpful: data.helpful || 0
                    };
                });

                const totalRating = fetchedReviews.reduce((sum, review) => sum + review.rating, 0);
                const avgRating = fetchedReviews.length > 0 ? totalRating / fetchedReviews.length : 0;
                setAverageRating(avgRating);
                setReviews(fetchedReviews);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching reviews:', error);
                setLoading(false);
            }
        };

        fetchReviews();
    }, [isOpen, shopId]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const formatDate = (dateString, timeString) => {
        try {
            const date = new Date(dateString);
            const time = timeString.split(':');
            date.setHours(parseInt(time[0]), parseInt(time[1]));
            return date.toLocaleString();
        } catch (error) {
            return 'Invalid Date';
        }
    };

    if (!isOpen) return null;

    return createPortal(<>
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
        />
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <div
                className="bg-base-100 w-full max-w-lg rounded-lg shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Rest of your modal content remains the same */}
                <div className="flex items-center justify-between p-4 border-b border-base-200">
                    <div>
                        <h2 className="text-xl font-semibold text-base-content">Customer Reviews</h2>
                        {reviews.length > 0 && (<div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 fill-warning text-warning"/>
                                    <span className="font-medium">{averageRating.toFixed(1)}</span>
                                </div>
                                <span className="text-base-content/60 text-sm">
                                        ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                                    </span>
                            </div>)}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-base-200 text-base-content/70 hover:text-base-content transition-colors"
                    >
                        <X className="w-5 h-5"/>
                    </button>
                </div>

                {/* Reviews List */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {/* Your existing reviews list content */}
                    {loading ? (<div className="flex items-center justify-center py-8">
                            <div className="loading loading-spinner loading-md"></div>
                        </div>) : reviews.length > 0 ? (<div className="space-y-4">
                            {reviews.map((review) => (<div
                                    key={review.id}
                                    className="p-4 rounded-lg bg-base-200/50 space-y-3"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium text-base-content">{review.userName}</h4>
                                            <p className="text-sm text-base-content/70">
                                                {formatDate(review.date, review.time)}
                                            </p>
                                        </div>
                                        <div className="flex gap-0.5">
                                            {[...Array(5)].map((_, i) => (<Star
                                                    key={i}
                                                    className={`w-4 h-4 ${i < review.rating ? 'text-warning fill-warning' : 'text-base-300'}`}
                                                />))}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {review.services.map((service, i) => (<span
                                                key={i}
                                                className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                                            >
                                                    {service}
                                                </span>))}
                                    </div>

                                    <p className="text-sm text-base-content/80">{review.comment}</p>

                                    {review.helpful > 0 && (
                                        <div className="text-xs text-base-content/60 flex items-center gap-1">
                                            <span>{review.helpful} people found this helpful</span>
                                        </div>)}
                                </div>))}
                        </div>) : (<div className="text-center py-8">
                            <MessageSquare className="w-12 h-12 mx-auto text-base-content/20 mb-2"/>
                            <p className="text-base-content/60">No reviews yet</p>
                        </div>)}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-base-200">
                    <button
                        onClick={onClose}
                        className="w-full py-2 px-4 bg-base-200 hover:bg-base-300 text-base-content rounded-md transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </>, document.body);
};

// ReviewTrigger component
const ReviewTrigger = ({shopId, initialRating = 0, reviewCount = 0, distribution = {}}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (<>
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center px-2 h-8 text-sm gap-1 rounded-md hover:bg-base-200 text-base-content/70 hover:text-primary transition-all"
            >
                <MessageSquare className="w-4 h-4"/>
                <span>Reviews ({reviewCount})</span>
                {initialRating > 0 && (<div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-warning text-warning"/>
                        <span>{initialRating}</span>
                    </div>)}
            </button>

            <ReviewDialogPortal
                shopId={shopId}
                initialRating={initialRating}
                reviewCount={reviewCount}
                distribution={distribution}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </>);
};

export default ReviewTrigger;