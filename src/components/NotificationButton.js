import React, {useEffect, useState} from 'react';
import {Bell} from 'lucide-react';
import {collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch} from 'firebase/firestore';
import {db} from '../firebase';
import {formatDistanceToNow} from 'date-fns';
import './NotificationAnimations.css';

const NotificationButton = ({user, userType, theme}) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

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
                        console.error('Notification listener error:', error);
                    }
                );
            } catch (error) {
                console.error('Error setting up notifications:', error);
            }
        };

        setupNotificationListener();
        return () => unsubscribe();
    }, [user, userType]);

    const markNotificationsAsRead = async (notifications) => {
        const batch = writeBatch(db);

        notifications.forEach((notification) => {
            if (!notification.read) {
                const notifRef = doc(db, 'notifications', notification.id);
                batch.update(notifRef, {
                    read: true,
                    visuallyRead: true // Add visuallyRead to Firebase
                });
            }
        });

        await batch.commit();
    };

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

    const markAsRead = async (notificationId) => {
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            await updateDoc(notificationRef, {
                read: true,
                visuallyRead: true // Add visuallyRead to Firebase
            });
            console.log('Marked notification as read:', notificationId);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const getTimeAgo = (timestamp) => {
        if (!timestamp?.toDate) return '';
        return formatDistanceToNow(timestamp.toDate(), {addSuffix: true});
    };

    if (!user || !userType || userType !== 'shop-owner') {
        return null;
    }

    return (
        <div className="dropdown dropdown-end z-50">
            <label tabIndex={0}
                   onClick={handleDropdownToggle}
                   className="btn btn-ghost btn-sm rounded-full hover:bg-primary/10 hover:text-primary transition-colors duration-200">
                <Bell className="w-6 h-6"/> 
                {notifications.some(n => !n.visuallyRead) && (
                    <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse
        ${theme === 'luxury' ? 'bg-success' : 'bg-error'}`}
                    />
                )}
            </label>

            <div tabIndex={0}
                 className={`dropdown-content menu shadow-lg bg-base-100 rounded-box w-96 mt-4 max-h-[80vh] overflow-hidden flex flex-col ${
                     isOpen ? 'block' : 'hidden'
                 }`}
            >
                <div className="flex justify-between items-center px-4 py-2 border-b border-base-200">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className={`badge badge-sm ${theme === 'luxury' ? 'badge-success' : 'badge-error'}`}>
                            {unreadCount} new
                        </span>
                        )}
                    </div>
                    {notifications.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                clearAllNotifications();
                            }}
                            className="notification-clear-btn btn btn-ghost btn-xs hover:btn-primary
                  transition-all duration-200 flex items-center gap-1 text-xs font-medium"
                        >
                            <span>Clear all</span>
                            <span className="sparkle-icon">✨</span>
                        </button>
                    )}
                </div>

                <div className="overflow-y-auto flex-1 max-h-[60vh]">
                    {notifications.length > 0 ? (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`notification-item p-4 hover:bg-base-200 cursor-pointer 
                    transition-colors duration-200 border-b border-base-200/50 last:border-b-0
                    ${!notification.read ? 'bg-base-200/50' : ''}
                    ${notification.isClearing ? 'clearing' : ''}`}
                                style={{
                                    animationDelay: `${notifications.indexOf(notification) * 0.1}s`
                                }}
                            >
                                <div className="flex gap-3">
                                <span className="text-2xl flex-shrink-0">
                                    {notification.type === 'new_booking' ? '📅' :
                                        notification.type === 'booking_cancelled' ? '❌' :
                                            notification.type === 'booking_modified' ? '🔄' : '📢'}
                                </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className="font-medium text-sm line-clamp-1">{notification.title}</h4>
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
                                                <span
                                                    className="text-xs font-medium bg-base-200 px-2 py-1 rounded-full">
                                                ${notification.totalPrice}
                                            </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-base-content/60">
                            <Bell className="w-8 h-8 mx-auto mb-3 opacity-20"/>
                            <p>No notifications yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationButton;