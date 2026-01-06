    import { useState, useEffect } from 'react';
    import { auth, db } from '../firebase';
    import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
    import { onAuthStateChanged } from 'firebase/auth';
    
    export const useAnalyticsData = (selectedDateRange) => {
        const [data, setData] = useState([]);
        const [isLoading, setIsLoading] = useState(true);
        const [error, setError] = useState(null);
    
        useEffect(() => {
            let unsubscribe = () => {};
    
            const fetchData = async (currentUser) => {
                try {
                    setIsLoading(true);
                    setError(null);
                    console.log('🔍 Starting fetchData with:', {
                        currentUser: currentUser?.uid,
                        selectedDateRange,
                    });
    
                    if (!currentUser) {
                        console.log('❌ No authenticated user');
                        setData([]);
                        return;
                    }
    
                    // 1. Get the shop for this user
                    const shopsRef = collection(db, 'barberShops');
                    const shopQuery = query(shopsRef, where('ownerId', '==', currentUser.uid));
                    const shopSnapshot = await getDocs(shopQuery);
    
                    if (shopSnapshot.empty) {
                        setData([]);
                        return;
                    }

                    const shopDoc = shopSnapshot.docs[0];
                    const shopId = shopDoc.id;
                    const shopCreatedAt = shopDoc.data().createdAt?.toDate() || new Date();
    
                    // 2. Get ALL bookings for this shop, ordered by creation date
                    const bookingsRef = collection(db, 'bookings');
                    const bookingsQuery = query(
                        bookingsRef,
                        where('shopId', '==', shopId),
                        orderBy('createdAt', 'desc')
                    );
    
                    const bookingsSnapshot = await getDocs(bookingsQuery);
    
                    if (bookingsSnapshot.empty) {
                        setData([]);
                        return;
                    }
    
                    // 3. Process ALL bookings
                    const bookingsMap = new Map();
    
                    bookingsSnapshot.docs.forEach(doc => {
                        const booking = doc.data();
                        const date = booking.selectedDate;
    
                        if (!bookingsMap.has(date)) {
                            bookingsMap.set(date, {
                                date,
                                revenue: 0,
                                completed: 0,
                                cancelled: 0,
                                upcoming: 0,
                                total: 0
                            });
                        }
    
                        const dateData = bookingsMap.get(date);
                        dateData.total++;
    
                        // Calculate revenue if booking isn't cancelled
                        if (booking.selectedServices && !booking.cancellationReason && booking.status !== 'cancelled') {
                            const revenue = booking.selectedServices.reduce((sum, service) =>
                                sum + (parseFloat(service.price) || 0), 0);
                            dateData.revenue += revenue;
                        }
    
                        // Status counting
                        if (booking.status === 'cancelled' || booking.cancellationReason) {
                            dateData.cancelled++;
                        } else if (booking.status === 'completed') {
                            dateData.completed++;
                            // Only count revenue for completed bookings
                            if (booking.selectedServices) {
                                const revenue = booking.selectedServices.reduce((sum, service) =>
                                    sum + (parseFloat(service.price) || 0), 0);
                                dateData.revenue += revenue;
                            }
                        } else {
                            const bookingDate = new Date(booking.selectedDate);
                            const now = new Date();
                            if (bookingDate > now) {
                                dateData.upcoming++;
                            } else {
                                dateData.completed++;
                            }
                        }
    
                        bookingsMap.set(date, dateData);
                    });
    
                    // 4. Convert map to array and sort by date
                    let processedData = Array.from(bookingsMap.values())
                        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
                    // 5. Filter based on selected date range if needed
                    const now = new Date();
                    const startDate = new Date(now);
    
                    switch(selectedDateRange) {
                        case 'week':
                            startDate.setDate(now.getDate() - 6);
                            break;
                        case 'month':
                            startDate.setMonth(now.getMonth() - 1);
                            break;
                        case 'year':
                            startDate.setFullYear(now.getFullYear() - 1);
                            break;
                        default:
                            // If no range specified, show all data since shop creation
                            startDate.setTime(shopCreatedAt.getTime());
                    }
    
                    processedData = processedData.filter(item => {
                        const itemDate = new Date(item.date);
                        // Get earliest possible date (shop creation or selected range start)
                        const rangeStartDate = startDate;
                        // No upper bound check - include all dates
                        return itemDate >= rangeStartDate;
                    });

                    setData(processedData);

                } catch (error) {
                    console.error('Error in analytics:', error);
                    setError(error);
                    setData([]);
                } finally {
                    setIsLoading(false);
                }
            };
    
            unsubscribe = onAuthStateChanged(auth, (user) => {
                console.log('🔐 Auth state changed:', {
                    userId: user?.uid,
                    isAuthenticated: !!user
                });
                if (user) {
                    fetchData(user);
                } else {
                    setData([]);
                    setIsLoading(false);
                }
            });
    
            return () => unsubscribe();
        }, [selectedDateRange]);
    
        return {
            data,
            isLoading,
            error
        };
    };