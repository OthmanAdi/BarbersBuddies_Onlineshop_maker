import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { sanitizeHTML } from '../utils/sanitize';

const AboutUsSection = ({ shop, t }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-7xl mx-auto bg-base-100"
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main About Content - Now Full Width */}
                <div className="lg:col-span-2 card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                    <div className="card-body">
                        <h3 className="text-2xl font-bold mb-4">{t.aboutUs}</h3>
                        <div
                            className="shop-description prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(shop.biography) }}
                        />
                    </div>
                </div>

                {/* Contact Info Card - Moved to Side */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                    <div className="card-body">
                        <h3 className="text-xl font-bold mb-4">Contact Information</h3>
                        <div className="space-y-4 bg-base-200/50 p-4 rounded-lg">
                            <a href={`tel:${shop.phoneNumber}`}
                               className="flex items-center gap-3 hover:text-primary transition-colors p-2 rounded-lg hover:bg-base-200">
                                <Phone className="w-5 h-5"/>
                                <span>{shop.phoneNumber}</span>
                            </a>
                            <a href={`mailto:${shop.email}`}
                               className="flex items-center gap-3 hover:text-primary transition-colors p-2 rounded-lg hover:bg-base-200">
                                <Mail className="w-5 h-5"/>
                                <span>{shop.email}</span>
                            </a>
                            <a href={`https://maps.google.com/?q=${shop.address}`}
                               target="_blank"
                               rel="noreferrer"
                               className="flex items-center gap-3 hover:text-primary transition-colors p-2 rounded-lg hover:bg-base-200">
                                <MapPin className="w-5 h-5"/>
                                <span>{shop.address}</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default AboutUsSection;