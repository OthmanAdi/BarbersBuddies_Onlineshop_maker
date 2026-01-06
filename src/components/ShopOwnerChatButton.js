import React, {useEffect, useState} from 'react';
import {MessageSquare} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {collection, getDocs, onSnapshot, query, where} from 'firebase/firestore';
import {db} from '../firebase';

const NavbarChatButton = ({user, userType, theme}) => {
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
        const q = query(messagesRef, where('shopId', 'in', userShops), // Use array-contains for multiple shops
            where('read', '==', false), where('senderType', '==', 'customer'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log('Unread messages:', snapshot.docs.length);
            setUnreadCount(snapshot.docs.length);
        }, (error) => {
            console.error('Error in messages snapshot:', error);
        });

        return () => unsubscribe();
    }, [user, userType, userShops]);

    if (!user || userType !== 'shop-owner') return null;

    return (<button
            onClick={() => navigate('/shop-messages')}
            className="btn btn-ghost rounded-full hover:bg-primary/10 hover:text-primary transition-colors duration-200 relative"
        >
            <div className="flex flex-col items-center">
                <MessageSquare className="w-6 h-6"/>
                {unreadCount > 0 && (<span className={`
                text-md font-semibold -mb-1
                ${theme === 'luxury' ? 'text-green-500' : 'text-red-500'}
            `}>
                {unreadCount > 99 ? '99+' : unreadCount}
            </span>)}
            </div>
            {unreadCount > 0 && (<div className={`
            absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full 
            ${theme === 'luxury' ? 'bg-green-500' : 'bg-red-500'} 
            animate-pulse
        `}/>)}
        </button>);
};

export default NavbarChatButton;