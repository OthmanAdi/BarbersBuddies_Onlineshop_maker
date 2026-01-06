import React, {useEffect, useState} from 'react';
import {Bell, X} from 'lucide-react';
import {collection, doc, getDocs, onSnapshot, orderBy, query, where, writeBatch} from 'firebase/firestore';
import {db} from '../firebase';
import {formatDistanceToNow} from 'date-fns';
import './NotificationAnimations.css';
import { motion, AnimatePresence } from 'framer-motion';
const MobileNotificationButton = ({ user, userType, theme, isMenuOpen, isVisible }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [buttonPosition, setButtonPosition] = useState({ top: 0, right: 0 });


    useEffect(() => {
        if (!user || !userType || userType !== 'shop-owner') return;

        let unsubscribe = () => {
        };

        const setupNotificationListener = async () => {
            try {
                const shopsRef = collection(db, 'barberShops');
                const shopsQuery = query(shopsRef, where('ownerId', '==', user.uid));
                const shopsSnapshot = await getDocs(shopsQuery);

                if (shopsSnapshot.empty) {
                    return;
                }

                const shopIds = shopsSnapshot.docs.map(doc => doc.id);

                const notificationsRef = collection(db, 'notifications');
                const notificationsQuery = query(
                    notificationsRef,
                    where('shopId', 'in', shopIds),
                    orderBy('createdAt', 'desc')
                );

                unsubscribe = onSnapshot(notificationsQuery,
                    (snapshot) => {
                        const newNotifications = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            read: doc.data().read || false,
                            visuallyRead: doc.data().read || false
                        }));
                        setNotifications(newNotifications);
                        setUnreadCount(newNotifications.filter(n => !n.read).length);
                    },
                    (error) => {
                        console.error('Mobile Notification listener error:', error);
                    }
                );
            } catch (error) {
                console.error('Error setting up mobile notifications:', error);
            }
        };

        setupNotificationListener();
        return () => unsubscribe();
    }, [user, userType]);

    // const markNotificationsAsRead = async (notifications) => {
    //     const batch = writeBatch(db);
    //
    //     notifications.forEach((notification) => {
    //         if (!notification.read) {
    //             const notifRef = doc(db, 'notifications', notification.id);
    //             batch.update(notifRef, {
    //                 read: true,
    //                 visuallyRead: true
    //             });
    //         }
    //     });
    //
    //     await batch.commit();
    // };

    const handleDropdownToggle = async () => {
        if (!isOpen) {
            // Set visual state immediately
            setNotifications(prevNotifications =>
                prevNotifications.map(notification => ({
                    ...notification,
                    visuallyRead: true  // For dot indicator
                }))
            );
        } else {
            // When closing, update both visual and read states
            try {
                await markNotificationsAsRead(notifications);
                setNotifications(prevNotifications =>
                    prevNotifications.map(notification => ({
                        ...notification,
                        read: true,
                        visuallyRead: true
                    }))
                );
                setUnreadCount(0);
            } catch (error) {
                console.error('Error updating notification states:', error);
            }
        }
        setIsOpen(!isOpen);
    };

    const clearAllNotifications = async () => {
        try {
            const batch = writeBatch(db);

            setNotifications(prev => prev.map(n => ({...n, isClearing: true})));
            await new Promise(resolve => setTimeout(resolve, 100));

            notifications.forEach((notification) => {
                const notifRef = doc(db, 'notifications', notification.id);
                batch.delete(notifRef);
            });

            await batch.commit();
            await new Promise(resolve => setTimeout(resolve, 500));

            setNotifications([]);
            setUnreadCount(0);

        } catch (error) {
            console.error('Error clearing notifications:', error);
            setNotifications(prev => prev.map(n => ({...n, isClearing: false})));
        }
    };

    const getTimeAgo = (timestamp) => {
        if (!timestamp?.toDate) return '';
        return formatDistanceToNow(timestamp.toDate(), {addSuffix: true});
    };

    if (!user || !userType || userType !== 'shop-owner') {
        return null;
    }

    const updateButtonPosition = (event) => {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        setButtonPosition({
            top: rect.top,
            right: window.innerWidth - rect.right,
        });
    };

    const handleOpen = async (event) => {
        updateButtonPosition(event);
        setIsOpen(true);

        // Set visual state immediately
        setNotifications(prevNotifications =>
            prevNotifications.map(notification => ({
                ...notification,
                visuallyRead: true
            }))
        );

        // Update Firebase
        try {
            await markNotificationsAsRead(notifications);
            setNotifications(prevNotifications =>
                prevNotifications.map(notification => ({
                    ...notification,
                    read: true,
                    visuallyRead: true
                }))
            );
            setUnreadCount(0);
        } catch (error) {
            console.error('Error updating notification states:', error);
        }
    };

    const markNotificationsAsRead = async (notifications) => {
        const batch = writeBatch(db);

        notifications.forEach((notification) => {
            if (!notification.read) {
                const notifRef = doc(db, 'notifications', notification.id);
                batch.update(notifRef, {
                    read: true,
                    visuallyRead: true
                });
            }
        });

        await batch.commit();
    };

    return (
        <>
            <motion.button
                onClick={handleOpen}
                className="btn btn-ghost rounded-full hover:bg-primary/10 hover:text-primary transition-colors duration-200 relative"
            >
                <Bell className="w-6 h-6" />
                {notifications.some(n => !n.visuallyRead) && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`absolute -top-1 -right-1 w-2 h-2 rounded-full
                            ${theme === 'luxury' ? 'bg-success' : 'bg-error'}`}
                    />
                )}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{
                            position: 'fixed',
                            top: buttonPosition.top,
                            right: buttonPosition.right,
                            width: '48px',
                            height: '48px',
                            borderRadius: '9999px',
                        }}
                        animate={{
                            top: '4rem',  // Changed from top: 0 to match navbar height
                            right: 0,
                            width: '100vw',
                            height: 'calc(100vh - 4rem)', // Changed to account for navbar space
                            borderRadius: '0px',
                        }}
                        exit={{
                            top: buttonPosition.top,
                            right: buttonPosition.right,
                            width: '48px',
                            height: '48px',
                            borderRadius: '9999px',
                        }}
                        transition={{
                            type: "spring",
                            damping: 30,
                            stiffness: 300
                        }}
                        className="bg-base-100 fixed z-50 overflow-hidden"
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: 0.2 }}
                            className="h-full flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center p-4 border-b border-base-200">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-base">Notifications</h3>
                                    {/*{unreadCount > 0 && (*/}
                                        <span className={`badge badge-sm ${theme === 'luxury' ? 'badge-success' : 'badge-error'}`}>
                                            {unreadCount} new
                                        </span>
                                    {/*)}*/}
                                </div>
                                <div className="flex items-center gap-4">
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={clearAllNotifications}
                                            className="btn btn-ghost btn-sm"
                                        >
                                            Clear
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="btn btn-ghost btn-circle"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Notifications List */}
                            <motion.div
                                className="overflow-y-auto flex-1"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ delay: 0.3 }}
                            >
                                {notifications.length > 0 ? (
                                    <div className="divide-y divide-base-200">
                                        {notifications.map((notification, index) => (
                                            <motion.div
                                                key={notification.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ delay: index * 0.05 }}
                                                className={`p-4 ${!notification.read ? 'bg-base-200/50' : ''}`}
                                            >
                                                <div className="flex gap-3">
                                                    <span className="text-2xl flex-shrink-0">
                                                        {notification.type === 'new_booking' ? '📅' :
                                                            notification.type === 'booking_cancelled' ? '❌' :
                                                                notification.type === 'booking_modified' ? '🔄' : '📢'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <h4 className="font-medium text-sm line-clamp-1">
                                                                {notification.title}
                                                            </h4>
                                                            {!notification.visuallyRead && (
                                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5
                                                                    ${theme === 'luxury' ? 'bg-success' : 'bg-error'}`}
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-base-content/70 mt-1 break-words line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                        <div className="flex justify-between items-center mt-2">
                                                            <span className="text-xs text-base-content/50">
                                                                {getTimeAgo(notification.createdAt)}
                                                            </span>
                                                            {notification.totalPrice && (
                                                                <span className="text-xs font-medium bg-base-200 px-2 py-1 rounded-full">
                                                                    ${notification.totalPrice}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="p-8 text-center text-base-content/60"
                                    >
                                        <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                        <p>No notifications yet</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default MobileNotificationButton;
