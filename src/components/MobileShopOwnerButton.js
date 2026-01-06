import React, {useEffect, useState} from 'react';
import {MessageSquare} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {collection, getDocs, onSnapshot, query, where} from 'firebase/firestore';
import {db} from '../firebase';

const MobileChatButton = ({user, userType, theme, isMenuOpen, isVisible}) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [userShops, setUserShops] = useState([]);
    const navigate = useNavigate();

    // First, get all shops owned by this user
    useEffect(() => {
        if (!user || userType !== 'shop-owner') return;

        const fetchUserShops = async () => {
            try {
                const shopsRef = collection(db, 'barberShops');
                const q = query(shopsRef, where('ownerId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                const shopIds = querySnapshot.docs.map(doc => doc.id);
                setUserShops(shopIds);
            } catch (error) {
                console.error('Error fetching user shops:', error);
            }
        };

        fetchUserShops();
    }, [user, userType]);

    // Then, listen for unread messages for all user's shops
    useEffect(() => {
        if (!user || userType !== 'shop-owner' || userShops.length === 0) return;

        const messagesRef = collection(db, 'messages');
        const q = query(
            messagesRef,
            where('shopId', 'in', userShops),
            where('read', '==', false),
            where('senderType', '==', 'customer')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log('Unread mobile messages:', snapshot.docs.length);
            setUnreadCount(snapshot.docs.length);
        }, (error) => {
            console.error('Error in messages snapshot:', error);
        });

        return () => unsubscribe();
    }, [user, userType, userShops]);

    if (!user || userType !== 'shop-owner') return null;

    return (
        <div className="relative inline-block mr-4 float-right">
            <button
                onClick={() => navigate('/shop-messages')}
                className="btn btn-sm btn-circle bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300"
            >
                <MessageSquare className="w-4 h-4"/>
                {unreadCount > 0 && (
                    <div className="absolute -top-2 -right-2 flex items-center">
                        <div className={`
                            rounded-full px-2 py-0.5 text-xs font-semibold
                            ${theme === 'luxury'
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }
                        `}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                        <div className={`
                            absolute -top-1 -right-1 w-2 h-2 rounded-full 
                            ${theme === 'luxury' ? 'bg-green-500' : 'bg-red-500'} 
                            animate-pulse
                        `}/>
                    </div>
                )}
            </button>
        </div>
    );
};

export default MobileChatButton;