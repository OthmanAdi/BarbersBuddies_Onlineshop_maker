import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {Check, X, Search, Store, Loader2, AlertCircle} from 'lucide-react';
import {useMediaQuery} from "react-responsive";

const ShopNameValidator = ({ onNameValidated, initialName = '' }) => {
    const [name, setName] = useState(initialName);
    const [status, setStatus] = useState({
        isChecking: false,
        isAvailable: null,
        suggestions: [],
        similar: []
    });


    const isDesktop = useMediaQuery({ minWidth: 1024 });
    const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });
    const isMobile = useMediaQuery({ maxWidth: 767 });


    const generateSuggestions = (baseName) => {
        const suggestions = new Set();
        const base = baseName.trim();

        ['Barbershop', 'Salon', 'Grooming'].forEach(suffix =>
            suggestions.add(`${base} ${suffix}`));

        ['Classic', 'Modern', 'Elite', 'Prime'].forEach(prefix => {
            suggestions.add(`${prefix} ${base}`);
            suggestions.add(`${base} ${prefix}`);
        });

        if (!base.toLowerCase().startsWith('the ')) {
            suggestions.add(`The ${base}`);
        }

        return Array.from(suggestions)
            .filter(s => s.length <= 30)
            .slice(0, 6);
    };

    const checkName = async (value) => {
        if (!value.trim()) {
            setStatus({
                isChecking: false,
                isAvailable: null,
                suggestions: [],
                similar: []
            });
            return;
        }

        setStatus(prev => ({ ...prev, isChecking: true }));

        try {
            const nameSearch = value.toLowerCase().trim();
            const exactQuery = query(
                collection(db, 'shopNames'),
                where('nameSearch', '==', nameSearch)
            );

            const similarQuery = query(
                collection(db, 'shopNames'),
                orderBy('nameSearch'),
                where('nameSearch', '>=', nameSearch),
                where('nameSearch', '<=', nameSearch + '\uf8ff'),
                limit(5)
            );

            const [exactMatch, similarMatches] = await Promise.all([
                getDocs(exactQuery),
                getDocs(similarQuery)
            ]);

            const isAvailable = exactMatch.empty;
            const similarShops = similarMatches.docs.map(doc => doc.data().name);

            let suggestions = [];
            if (!isAvailable) {
                suggestions = generateSuggestions(value);

                const validSuggestions = await Promise.all(
                    suggestions.map(async suggestion => {
                        const suggestionQuery = query(
                            collection(db, 'shopNames'),
                            where('nameSearch', '==', suggestion.toLowerCase().trim())
                        );
                        const exists = !(await getDocs(suggestionQuery)).empty;
                        return { suggestion, exists };
                    })
                );

                suggestions = validSuggestions
                    .filter(({ exists }) => !exists)
                    .map(({ suggestion }) => suggestion);
            }

            setStatus({
                isChecking: false,
                isAvailable,
                suggestions,
                similar: similarShops
            });

            onNameValidated({ name: value, isAvailable });

        } catch (error) {
            console.error('Name check error:', error);
            setStatus({
                isChecking: false,
                isAvailable: null,
                suggestions: [],
                similar: []
            });
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (name) checkName(name);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [name]);

    const getSuggestionGridCols = () => {
        if (isDesktop) return 'grid-cols-2';
        if (isTablet) return 'grid-cols-2';
        if (isMobile) return 'grid-cols-1';
        return 'grid-cols-2';
    };

    const getPadding = () => {
        if (isDesktop) return 'p-4';
        if (isTablet) return 'p-3';
        if (isMobile) return 'p-2';
        return 'p-4';
    };

    const getGap = () => {
        if (isDesktop) return 'gap-2';
        if (isTablet) return 'gap-2';
        if (isMobile) return 'gap-1.5';
        return 'gap-2';
    };


    return (
        <div className="space-y-2">
            <div className="relative">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full input input-bordered transition-all duration-300 
                       ${status.isAvailable === true ? 'input-success pr-12 border-2' :
                        status.isAvailable === false ? 'input-error pr-12 border-2' : 'pr-12'}
                       ${isMobile ? 'text-sm h-10' : 'text-base'}`}
                    placeholder="Enter shop name"
                />

                <AnimatePresence mode="wait">
                    {status.isChecking ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 
                               ${isMobile ? 'scale-75' : ''}`}
                        >
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        </motion.div>
                    ) : status.isAvailable === true ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{
                                opacity: 1,
                                scale: [0.5, 1.2, 1],
                                rotate: [0, 20, 0]
                            }}
                            transition={{ duration: 0.4 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 
                               ${isMobile ? 'scale-75' : ''}`}
                        >
                            <Check className="w-5 h-5 text-success" />
                        </motion.div>
                    ) : status.isAvailable === false ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{
                                opacity: 1,
                                scale: [0.5, 1.2, 1],
                                rotate: [0, -20, 0]
                            }}
                            transition={{ duration: 0.4 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 
                               ${isMobile ? 'scale-75' : ''}`}
                        >
                            <X className="w-5 h-5 text-error" />
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {status.isAvailable === false && status.suggestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 20 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className={`mt-4 bg-base-200 rounded-lg overflow-hidden shadow-lg border border-base-300
                           ${isMobile ? 'mx-0' : 'mx-auto'}`}
                    >
                        <div className={getPadding()}>
                            <div className={`flex items-center ${getGap()} mb-3 text-error
                               ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                <AlertCircle className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                                <h3 className="font-medium">This name is taken - Try these alternatives:</h3>
                            </div>
                            <div className={`grid ${getSuggestionGridCols()} ${getGap()}`}>
                                {status.suggestions.map((suggestion, idx) => (
                                    <motion.button
                                        key={idx}
                                        onClick={() => setName(suggestion)}
                                        className={`btn btn-sm bg-base-100 hover:bg-base-300 justify-start gap-2 w-full group
                                           ${isMobile ? 'h-8 min-h-0 text-xs' : ''}`}
                                        whileHover={{ scale: isMobile ? 1.01 : 1.02, transition: { duration: 0.2 } }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Store className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-primary group-hover:scale-110 transition-transform`} />
                                        <span className="truncate">{suggestion}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ShopNameValidator;