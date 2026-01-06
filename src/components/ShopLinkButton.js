import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Share2, Copy, ExternalLink, Check } from 'lucide-react';

const ShopLinkButton = ({ uniqueUrl }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const fullUrl = `${window.location.origin}/shop/${uniqueUrl}`;

    const handleCopy = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleVisit = (e) => {
        e.stopPropagation();
        window.open(fullUrl, '_blank');
    };

    return (
        <div className="mt-4">
            <motion.div
                className="relative rounded-xl overflow-hidden border border-primary/20"
                animate={{
                    scale: isExpanded ? 1.02 : 1,
                    borderColor: isExpanded ? 'hsl(var(--p))' : 'transparent'
                }}
                transition={{ duration: 0.3 }}
            >
                <motion.button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full p-3 flex items-center justify-between bg-base-200/50 hover:bg-base-200 transition-colors duration-300"
                    whileHover={{ backgroundColor: 'hsl(var(--b2))' }}
                >
                    <div className="flex items-center gap-3">
                        <motion.div
                            animate={{ rotate: isExpanded ? 360 : 0 }}
                            transition={{ duration: 0.5 }}
                            className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"
                        >
                            <Globe className="w-4 h-4 text-primary" />
                        </motion.div>
                        <span className="font-medium text-base-content/90">
                            Shop Website
                        </span>
                    </div>
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Share2 className="w-4 h-4 text-primary opacity-60" />
                    </motion.div>
                </motion.button>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-base-200/50"
                        >
                            <div className="p-4 space-y-3">
                                <div className="rounded-lg bg-base-300/50 p-3">
                                    <div className="text-sm text-base-content/70 break-all">
                                        {fullUrl}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <motion.button
                                        onClick={handleCopy}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
                                                 bg-primary/10 hover:bg-primary/20 text-primary"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {copied ? (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="flex items-center gap-2"
                                            >
                                                <Check className="w-4 h-4" />
                                                <span className="text-sm font-medium">Copied!</span>
                                            </motion.div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Copy className="w-4 h-4" />
                                                <span className="text-sm font-medium">Copy URL</span>
                                            </div>
                                        )}
                                    </motion.button>

                                    <motion.button
                                        onClick={handleVisit}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
                                                 bg-primary text-primary-content hover:bg-primary/90"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span className="text-sm font-medium">Visit</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default ShopLinkButton;