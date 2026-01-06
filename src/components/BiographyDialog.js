import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Book, X} from 'lucide-react';
import { sanitizeHTML } from '../utils/sanitize';

const BiographyDialog = ({isOpen, onClose, biography, shopName}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto"
                onClick={onClose}
            >
                <div className="min-h-screen px-4 py-6 flex items-center justify-center">
                    <motion.div
                        initial={{opacity: 0, scale: 0.95, y: 20}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        exit={{opacity: 0, scale: 0.95, y: 20}}
                        transition={{type: "spring", duration: 0.5}}
                        className="bg-base-100 rounded-lg shadow-xl w-full max-w-2xl relative my-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-base-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Book className="w-5 h-5 text-primary"/>
                                <h3 className="text-lg font-semibold">{shopName}</h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="btn btn-ghost btn-sm btn-circle"
                            >
                                <X className="w-5 h-5"/>
                            </button>
                        </div>

                        {/* Content */}
                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            className="p-6 overflow-y-auto max-h-[calc(100vh-16rem)]"
                        >
                            {biography ? (
                                <div
                                    dangerouslySetInnerHTML={{__html: sanitizeHTML(biography)}}
                                    className="prose max-w-none prose-sm prose-headings:text-base-content prose-p:text-base-content/80
                  prose-strong:text-base-content prose-a:text-primary hover:prose-a:text-primary/80
                  prose-ul:text-base-content/80 prose-ol:text-base-content/80"
                                />
                            ) : (
                                <div className="text-base-content/70 italic text-center">
                                    <p>No biography available</p>
                                </div>
                            )}
                        </motion.div>

                        {/* Footer */}
                        <div className="p-4 border-t border-base-200 flex justify-end">
                            <button
                                onClick={onClose}
                                className="btn btn-sm btn-ghost"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BiographyDialog;