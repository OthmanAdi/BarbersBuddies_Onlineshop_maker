import React, {useEffect, useRef, useState} from 'react';
import {CheckCircle, ChevronLeft, ChevronRight, MessageSquare, Send, Smile, Trash2, XCircle} from 'lucide-react';
import {AnimatePresence, motion} from 'framer-motion';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import './ChatStyle.css';
import {
    addDoc,
    collection,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import {auth, db} from '../firebase';
import Swal from "sweetalert2";

const ShopMessagesView = () => {
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [selectedChat, setSelectedChat] = useState(null);
    const [message, setMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [userShops, setUserShops] = useState([]);
    const [isCustomerTyping, setIsCustomerTyping] = useState(false);
    const chatEndRef = useRef(null);
    const [localConversations, setLocalConversations] = useState([]);

    // Fetch all shops owned by the current user
    useEffect(() => {
        const fetchUserShops = async () => {
            const shopsRef = collection(db, 'barberShops');
            const q = query(shopsRef, where('ownerId', '==', auth.currentUser.uid));
            const querySnapshot = await getDocs(q);
            const shopIds = querySnapshot.docs.map(doc => doc.id);
            setUserShops(shopIds);
        };

        if (auth.currentUser) {
            fetchUserShops();
        }
    }, []);

    // Fetch all conversations for the shops
    useEffect(() => {
        if (!userShops.length) return;

        // Create a map to store our conversations
        const conversationMap = new Map();

        // First, fetch all unique conversations
        const bookingsRef = collection(db, 'bookings');
        const conversationsQuery = query(bookingsRef, where('shopId', 'in', userShops));

        // Subscribe to bookings changes
        const bookingsUnsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
            // Handle deletions first
            snapshot.docChanges().forEach(change => {
                if (change.type === 'removed') {
                    conversationMap.delete(change.doc.id);
                }
            });

            // Then handle additions and modifications
            snapshot.docs.forEach(doc => {
                const bookingData = doc.data();
                conversationMap.set(doc.id, {
                    bookingId: doc.id,
                    customerId: bookingData.userEmail,
                    customerName: bookingData.userName,
                    shopId: bookingData.shopId,
                    lastMessage: '',
                    timestamp: null,
                    unreadCount: 0,
                    status: bookingData.status,
                    cancelledBy: bookingData.cancelledBy,
                    cancellationReason: bookingData.cancellationReason,
                    appointmentDetails: {
                        date: bookingData.selectedDate,
                        time: bookingData.selectedTime,
                        services: bookingData.selectedServices,
                        totalPrice: bookingData.totalPrice
                    }
                });
            });

            // Update state after booking changes
            updateConversationsState();
        });

        // Subscribe to messages
        const messagesRef = collection(db, 'messages');
        const allMessagesQuery = query(messagesRef, where('shopId', 'in', userShops), orderBy('timestamp', 'desc'));

        // Function to update conversations state
        const updateConversationsState = () => {
            // Sort conversations by latest message timestamp
            const sortedConversations = [...conversationMap.values()]
                .filter(conv => conv.timestamp) // Only show conversations with messages
                .sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());

            setConversations(sortedConversations);
            setLocalConversations(sortedConversations);
        };

        // Listen to all messages for real-time updates
        const messagesUnsubscribe = onSnapshot(allMessagesQuery, (snapshot) => {
            // Handle message changes (including deletions)
            snapshot.docChanges().forEach(change => {
                const messageData = change.doc.data();
                const conversationKey = messageData.bookingId;

                if (conversationMap.has(conversationKey)) {
                    const conversation = conversationMap.get(conversationKey);

                    if (change.type === 'removed') {
                        // If this was the last message, we need to find the new last message
                        if (conversation.lastMessage === messageData.content) {
                            conversation.lastMessage = '';
                            conversation.timestamp = null;
                        }
                        // Adjust unread count if necessary
                        if (messageData.senderType === 'customer' && !messageData.read) {
                            conversation.unreadCount = Math.max(0, conversation.unreadCount - 1);
                        }
                    } else {
                        // Update last message details if this is newer
                        if (!conversation.timestamp || messageData.timestamp?.toMillis() > conversation.timestamp?.toMillis()) {
                            conversation.lastMessage = messageData.content;
                            conversation.timestamp = messageData.timestamp;
                        }

                        // Update unread count for new/modified messages
                        if (messageData.senderType === 'customer' && !messageData.read) {
                            if (change.type === 'added') {
                                conversation.unreadCount++;
                            }
                        }
                    }
                }
            });

            // Update state after processing message changes
            updateConversationsState();
        });

        // Cleanup subscriptions
        return () => {
            bookingsUnsubscribe();
            messagesUnsubscribe();
        };
    }, [userShops]);

    // Watch for typing indicator
    useEffect(() => {
        if (!selectedChat?.bookingId) return;

        const typingRef = doc(db, 'typing', selectedChat.bookingId);
        const unsubscribe = onSnapshot(typingRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setIsCustomerTyping(data?.customer_typing || false);
            }
        });

        return () => unsubscribe();
    }, [selectedChat]);

    // Fetch messages for selected chat
    useEffect(() => {
        if (!selectedChat?.bookingId) return;

        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, where('bookingId', '==', selectedChat.bookingId), orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs.map(doc => ({
                id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate()
            }));

            setMessages(newMessages);

            // Mark messages as read
            snapshot.docs.forEach(async (doc) => {
                const messageData = doc.data();
                if (!messageData.read && messageData.senderType === 'customer') {
                    await updateDoc(doc.ref, {read: true});
                }
            });
        });

        return () => unsubscribe();
    }, [selectedChat]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);

    const handleSendMessage = async () => {
        if (!message.trim() || !selectedChat) return;

        try {
            // Validate and sanitize appointment details
            const sanitizedAppointmentDetails = {
                date: selectedChat.appointmentDetails?.date || '',
                time: selectedChat.appointmentDetails?.time || '',
                services: selectedChat.appointmentDetails?.services || [],
                totalPrice: selectedChat.appointmentDetails?.totalPrice || 0 // Provide default value
            };

            // Validate that we have the minimum required fields
            if (!selectedChat.bookingId || !selectedChat.shopId || !selectedChat.customerId) {
                throw new Error('Missing required chat information');
            }

            const messageData = {
                bookingId: selectedChat.bookingId,
                content: message.trim(),
                senderId: auth.currentUser.uid,
                senderType: 'shop',
                shopId: selectedChat.shopId,
                customerId: selectedChat.customerId,
                customerName: selectedChat.customerName || 'Customer', // Fallback value
                timestamp: serverTimestamp(),
                read: false,
                appointmentDetails: sanitizedAppointmentDetails
            };

            // Log the message data before sending (for debugging)
            console.log('Sending message with data:', messageData);

            await addDoc(collection(db, 'messages'), messageData);
            setMessage('');

            // Force scroll to bottom
            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
            }, 100);

        } catch (error) {
            console.error('Error sending message:', error);
            // Show a more user-friendly error message
            Swal.fire({
                title: 'Error!',
                text: 'Failed to send message. Please try again.',
                icon: 'error',
                confirmButtonText: 'Ok'
            });
        }
    };

    const handleDeleteChat = async (chatId, e) => {
        e.stopPropagation(); // Prevent chat selection when clicking delete

        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33', // Error color from DaisyUI
                cancelButtonColor: '#3085d6', // Neutral color from DaisyUI
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                // Delete all messages for this chat
                const messagesRef = collection(db, 'messages');
                const q = query(messagesRef, where('bookingId', '==', chatId));
                const snapshot = await getDocs(q);

                const batch = writeBatch(db);
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });

                await batch.commit();

                // Immediately update local state
                setLocalConversations(prev => prev.filter(conv => conv.bookingId !== chatId));

                // If this chat was selected, clear selection
                if (selectedChat?.bookingId === chatId) {
                    setSelectedChat(null);
                }

                // Show success message
                await Swal.fire({
                    title: 'Deleted!',
                    text: 'The conversation has been deleted.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            await Swal.fire({
                title: 'Error!', text: 'Failed to delete chat. Please try again.', icon: 'error'
            });
        }
    };

    return (<div className="h-screen bg-gray-100 flex relative">
            {/* Sidebar with Chat List */}
            <AnimatePresence mode="wait">
                {isSidebarOpen && (<motion.div
                        initial={{width: 0, opacity: 0}}
                        animate={{width: 320, opacity: 1}}
                        exit={{width: 0, opacity: 0}}
                        transition={{duration: 0.2}}
                        className="bg-white h-full shadow-lg relative flex flex-col"
                    >
                        {/* Sidebar Header */}
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-2xl font-semibold text-gray-800">Barber Chat</h2>
                            <p className="text-sm text-gray-500">Manage your customer conversations</p>
                        </div>

                        {/* Chat List */}
                        <div className="flex-1 overflow-y-auto">
                            <AnimatePresence>
                                {localConversations.map((chat, index) => (<motion.div
                                        key={chat.bookingId}
                                        initial={{x: -20, opacity: 0}}
                                        animate={{x: 0, opacity: 1}}
                                        transition={{delay: index * 0.05}}
                                        onClick={() => setSelectedChat(chat)}
                                        className={`
                                            group p-4 border-b border-gray-200 cursor-pointer
                                            hover:bg-gray-50 transition-colors duration-200
                                            ${selectedChat?.bookingId === chat.bookingId ? 'bg-gray-50' : ''}
                                            ${chat.unreadCount > 0 ? 'bg-blue-50' : ''}
                                        `}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="avatar">
                                                <div
                                                    className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <span className="text-lg text-blue-600">
                                                        {chat.customerName.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                                            {chat.customerName}
                                                            {chat.unreadCount > 0 && (
                                                                <span className="badge badge-primary badge-sm">
                                                                    {chat.unreadCount}
                                                                </span>)}
                                                        </h3>
                                                        <p className="text-sm text-gray-500 truncate">
                                                            {chat.lastMessage || 'No messages yet'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400">
                                                            {chat.timestamp?.toDate().toLocaleTimeString([], {
                                                                hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                        <button
                                                            onClick={(e) => handleDeleteChat(chat.bookingId, e)}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity
                                                                duration-200 hover:text-red-500 btn btn-ghost btn-xs btn-circle"
                                                            title="Delete conversation"
                                                        >
                                                            <Trash2 className="w-4 h-4"/>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>))}
                            </AnimatePresence>
                        </div>
                    </motion.div>)}
            </AnimatePresence>

            {/* Sidebar Toggle Button */}
            <motion.button
                initial={false}
                animate={{left: isSidebarOpen ? '320px' : '0px'}}
                transition={{duration: 0.2}}
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="absolute top-1/2 -translate-y-1/2 z-20"
            >
                <div className={`
                    bg-white shadow-lg hover:bg-gray-100 
                    transition-colors duration-200
                    p-3 rounded-full border border-gray-200
                    ${!isSidebarOpen && 'rounded-full border'}
                `}>
                    {isSidebarOpen ? (<ChevronLeft className="w-5 h-5 text-gray-700"/>) : (
                        <ChevronRight className="w-5 h-5 text-gray-700"/>)}
                </div>
            </motion.button>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {selectedChat ? (<>
                        {/* Sticky Header */}
                        <div className="sticky top-0 z-20 bg-white shadow-sm">
                            <div className="p-6 border-b border-gray-200">
                                <div className="max-w-3xl mx-auto">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-bold text-gray-800">Booking Details</h3>
                                        {selectedChat.status === 'cancelled' && (
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="badge badge-error gap-1">
                                                    <XCircle className="w-4 h-4"/>
                                                    Cancelled
                                                </div>
                                                {selectedChat.cancelledBy === 'customer' && (
                                                    <div className="badge badge-outline badge-sm">
                                                        Cancelled by customer
                                                    </div>)}
                                            </div>)}
                                    </div>
                                    <div
                                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm text-gray-600">
                                        <div>
                                            <span className="text-gray-400">Date:</span>
                                            <br/>
                                            {selectedChat.appointmentDetails?.date}
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Time:</span>
                                            <br/>
                                            {selectedChat.appointmentDetails?.time}
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Services:</span>
                                            <br/>
                                            {selectedChat.appointmentDetails?.services.map(s => `${s.name} (${s.duration || '30'}min)`).join(', ')}
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Total:</span>
                                            <br/>
                                            €{selectedChat.appointmentDetails?.totalPrice}
                                            <span className="block text-xs text-gray-400 mt-1">
                                                Duration: {selectedChat.appointmentDetails?.services.reduce((total, service) => total + (parseInt(service.duration) || 30), 0)} min
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Messages Area */}
                        <div className="flex-1 overflow-y-auto px-6 py-4" style={{paddingBottom: "100px"}}>
                            <div className="max-w-3xl mx-auto space-y-6">
                                {messages.map((msg) => (<div
                                        key={msg.id}
                                        className={`flex ${msg.senderType === 'shop' ? 'justify-end' : 'justify-start'} `}
                                    >
                                        <motion.div
                                            initial={{opacity: 0, y: 20}}
                                            animate={{opacity: 1, y: 0}}
                                            transition={{duration: 0.3}}
                                            className={`max-w-[75%] p-4 rounded-lg ${msg.senderType === 'shop' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'} shadow`}
                                        >
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                            <div
                                                className="flex items-center justify-end gap-2 mt-2 text-xs opacity-80">
                                                <span>
                                                    {msg.timestamp?.toLocaleTimeString([], {
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </span>
                                                {msg.senderType === 'shop' && msg.read && (
                                                    <CheckCircle className="w-4 h-4"/>)}
                                            </div>
                                        </motion.div>
                                    </div>))}
                                {isCustomerTyping && (<div className="flex justify-start">
                                        <div className="bg-gray-200 px-4 py-2 rounded-lg flex items-center space-x-1">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                            <div
                                                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce animation-delay-200"></div>
                                            <div
                                                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce animation-delay-400"></div>
                                        </div>
                                    </div>)}
                                <div ref={chatEndRef}/>
                            </div>
                        </div>

                        {/* Fixed Input Area */}
                        <div
                            className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-md"
                        >
                            <div className="p-6">
                                <div className="max-w-3xl mx-auto flex items-center gap-4 relative">
                                    {/* Emoji Picker */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                        >
                                            <Smile className="w-6 h-6"/>
                                        </button>
                                        {showEmojiPicker && (<div className="absolute bottom-full mb-2">
                                                <Picker
                                                    data={data}
                                                    onEmojiSelect={(emoji) => {
                                                        setMessage(prev => prev + emoji.native);
                                                        setShowEmojiPicker(false);
                                                    }}
                                                    theme="light"
                                                    perLine={8}
                                                />
                                            </div>)}
                                    </div>

                                    {/* Message Input */}
                                    <input
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type your message..."
                                        className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />

                                    {/* Send Button */}
                                    <button
                                        className={`flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none transition-colors duration-200
                                        ${!message.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={handleSendMessage}
                                        disabled={!message.trim()}
                                    >
                                        <Send className="w-5 h-5"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>) : (// Empty State
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <MessageSquare className="w-20 h-20 mx-auto mb-6 opacity-20"/>
                            <p className="text-lg">Select a conversation to start messaging</p>
                        </div>
                    </div>)}
            </div>
        </div>);
};

export default ShopMessagesView;
