// PageBuilderWrapper.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import PageBuilder from './PageBuilder';

const PageBuilderWrapper = () => {
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const { shopId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchShop = async () => {
            try {
                const shopDoc = await getDoc(doc(db, 'barberShops', shopId));
                if (shopDoc.exists()) {
                    setShop({ id: shopDoc.id, ...shopDoc.data() });
                }
            } catch (error) {
                console.error('Error fetching shop:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchShop();
    }, [shopId]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-100">
                <div className="loading loading-spinner loading-lg text-primary"></div>
            </div>
        );
    }

    if (!shop) {
        return <div>Shop not found</div>;
    }

    return (
        <PageBuilder
            shop={shop}
            onClose={() => navigate('/account')}
            onSave={(updatedShop) => {
                // Handle save
                navigate('/account');
            }}
        />
    );
};

export default PageBuilderWrapper;