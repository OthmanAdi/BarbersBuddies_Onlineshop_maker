import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Store, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SuccessView = ({ shopData }) => {
    const navigate = useNavigate();

    useEffect(() => {
        const elements = document.querySelectorAll('.fade-out');
        elements.forEach(el => {
            el.style.opacity = '0';
            setTimeout(() => el.style.display = 'none', 300);
        });
    }, []);

    const handleAccountView = () => {
        navigate('/account');
    };

    const handleShopView = () => {
        // Access uniqueUrl directly from shopData.storeData as that's the structure from GoogleBusinessStep
        const uniqueUrl = shopData?.storeData?.uniqueUrl;
        if (uniqueUrl) {
            window.location.href = `/shop/${uniqueUrl}`;
        }
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-b from-primary/5 to-primary/10 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
            >
                {/* Animated Background */}
                <div className="relative">
                    <motion.div
                        className="absolute inset-0 bg-primary/10 rounded-3xl blur-xl"
                        initial={{ scale: 0 }}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            repeatType: "reverse"
                        }}
                    />

                    <motion.div
                        className="relative bg-base-100 rounded-3xl p-8 shadow-2xl overflow-hidden"
                        initial={{ y: 50 }}
                        animate={{ y: 0 }}
                    >
                        {/* Animated Store Icon */}
                        <motion.div
                            className="w-24 h-24 mx-auto mb-8 rounded-full bg-primary flex items-center justify-center"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", duration: 1.5 }}
                        >
                            <Store className="w-12 h-12 text-primary-content" />
                        </motion.div>

                        {/* Store Name with Gradient */}
                        <motion.div
                            className="text-center space-y-4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent pb-2 max-w-full truncate">
                                {shopData?.storeData?.name || shopData?.name}
                            </h1>

                            {/* Success Message - Now Clickable */}
                            <motion.button
                                className="w-full relative group"
                                onClick={handleAccountView}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="absolute inset-0 blur-sm bg-primary/20 rounded-full 
                                              group-hover:bg-primary/30 transition-colors" />
                                <p className="relative text-lg font-medium text-primary-content/80 
                                            bg-primary/10 py-3 px-6 rounded-full
                                            group-hover:bg-primary/20 transition-colors">
                                    Your shop is now live! 🎉
                                </p>
                            </motion.button>

                            {/* Visit Shop Button */}
                            {/* <motion.button
                                onClick={handleShopView}
                                className="mt-4 w-full relative group"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.5 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="flex items-center justify-center gap-2 py-3 px-6 
                                              bg-secondary/10 rounded-full text-secondary-content/80
                                              hover:bg-secondary/20 transition-colors">
                                    <span>Visit Your Shop Website</span>
                                    <ExternalLink className="w-4 h-4" />
                                </div>
                            </motion.button> */}
                        </motion.div>

                        {/* Decorative Elements */}
                        <motion.div
                            className="absolute inset-0 pointer-events-none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.5 }}
                        >
                            {[...Array(3)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-32 h-32 rounded-full bg-primary/5"
                                    initial={{ scale: 0, x: -50, y: -50 }}
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        x: Math.random() * 200 - 100,
                                        y: Math.random() * 200 - 100,
                                    }}
                                    transition={{
                                        duration: 3,
                                        delay: i * 0.2,
                                        repeat: Infinity,
                                        repeatType: "reverse"
                                    }}
                                />
                            ))}
                        </motion.div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};

export default SuccessView;