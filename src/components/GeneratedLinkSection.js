/**
 * @fileoverview GeneratedLinkSection Component
 * 
 * A component for managing and displaying generated registration links for employees.
 * 
 * Key Features:
 * - Dynamic link generation
 * - Link management and revocation
 * - Clipboard integration
 * - Visual feedback
 * - Expiration handling
 * 
 * Technical Features:
 * - Firebase Firestore integration
 * - Secure token generation
 * - Animated transitions
 * - Mobile responsiveness
 * 
 * Props:
 * @param {Object} generatedLinks - Collection of active registration links
 * @param {Object} copiedLinks - State of copied links
 * @param {Function} setCopiedLinks - Handler for copy state
 * @param {Function} revokeToken - Handler for link revocation
 * @param {Object} t - Translation object
 * @param {string} shopId - Current shop identifier
 * 
 * @example
 * <GeneratedLinkSection
 *   generatedLinks={links}
 *   copiedLinks={copiedState}
 *   setCopiedLinks={updateCopiedState}
 *   revokeToken={handleRevoke}
 *   t={translations}
 *   shopId="shop123"
 * />
 */

import React from 'react';
import { Link, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import {doc, serverTimestamp, setDoc} from 'firebase/firestore';
import { db } from '../firebase';
import {nanoid} from "nanoid";

const GeneratedLinkSection = ({ generatedLinks, copiedLinks, setCopiedLinks, revokeToken, t, shopId }) => {
    const generateRegistrationLink = async () => {
        const token = nanoid(16);
        const registrationLink = `${window.location.origin}/employee-register/${shopId}/${token}`;

        // Maintain correct collection reference
        const shopRef = doc(db, 'tempShops', shopId);
        await setDoc(shopRef, {
            employeeRegistrationTokens: {
                [token]: {
                    created: serverTimestamp(),
                    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    used: false,
                    usedBy: null,
                    status: 'pending'
                }
            }
        }, { merge: true });

        await Swal.fire({
            title: t.linkGenerated,
            text: t.linkExpiry,
            icon: 'success',
            timer: 2000
        });

        return registrationLink;
    };

    return (
        <div className="grid gap-4">
            {Object.entries(generatedLinks).map(([token, link]) => (
                <motion.div
                    key={token}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="card bg-base-100 shadow hover:shadow-md transition-all"
                >
                    <div className="card-body p-4">
                        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between w-full">
                            <div className="flex-1 min-w-0 break-words">
                                <div className="flex items-center gap-2 mb-2 sm:mb-0">
                                    <Link className="w-4 h-4 text-primary flex-shrink-0" />
                                    <span className="font-mono text-sm break-all pr-2">
                    {link}
                  </span>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end flex-shrink-0">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="btn btn-error btn-sm flex-shrink-0"
                                    onClick={() => revokeToken(token)}
                                >
                                    Revoke
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`btn ${copiedLinks[token] ? 'btn-success' : 'btn-ghost'} 
                    btn-sm gap-2 transition-all duration-300 flex-shrink-0 min-w-[90px]`}
                                    onClick={() => {
                                        navigator.clipboard.writeText(link);
                                        setCopiedLinks(prev => ({
                                            ...prev,
                                            [token]: true
                                        }));

                                        Swal.fire({
                                            title: 'Copied!',
                                            icon: 'success',
                                            toast: true,
                                            position: 'bottom',
                                            showConfirmButton: false,
                                            timer: 4000,
                                            timerProgressBar: true,
                                        });

                                        setTimeout(() => {
                                            setCopiedLinks(prev => ({
                                                ...prev,
                                                [token]: false
                                            }));
                                        }, 4000);
                                    }}
                                >
                                    {copiedLinks[token] ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Copied!
                                        </>
                                    ) : (
                                        t.copyLink
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default GeneratedLinkSection;