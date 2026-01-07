// components/Footer.jsx
import React from 'react';
import {motion} from 'framer-motion';
import {Github, Instagram, Linkedin, Sparkles, Twitter} from 'lucide-react';

const Footer = () => {
    const footerSections = {
        product: {
            title: "Product",
            links: [
                {name: "Features", href: "#"},
                {name: "Pricing", href: "#"},
                {name: "Solutions", href: "#"},
                {name: "Integrations", href: "#"},
                {name: "Enterprise", href: "#"}
            ]
        },
        resources: {
            title: "Resources",
            links: [
                {name: "Documentation", href: "#"},
                {name: "API Reference", href: "#"},
                {name: "Community", href: "#"},
                {name: "Support Center", href: "#"},
                {name: "Status Page", href: "#"}
            ]
        },
        company: {
            title: "Company",
            links: [
                {name: "About Us", href: "#"},
                {name: "Blog", href: "#"},
                {name: "Careers", href: "#"},
                {name: "Press Kit", href: "#"},
                {name: "Contact", href: "#"}
            ]
        },
        legal: {
            title: "Legal",
            links: [
                {name: "Privacy Policy", href: "#"},
                {name: "Terms of Service", href: "#"},
                {name: "Cookie Policy", href: "#"},
                {name: "Security", href: "#"}
            ]
        }
    };

    const stats = [
        {number: "100%", label: "Free & Open Source"},
        {number: "MIT", label: "Licensed"},
        {number: "React", label: "& Firebase"},
        {number: "5min", label: "Setup Time"}
    ];

    const socialLinks = [
        {icon: Twitter, href: "#", label: "Twitter"},
        {icon: Linkedin, href: "#", label: "LinkedIn"},
        {icon: Github, href: "#", label: "GitHub"},
        {icon: Instagram, href: "#", label: "Instagram"}
    ];

    return (
        <motion.footer
            initial={{opacity: 0, y: 50}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.8}}
            className="relative mt-auto bg-gradient-to-b from-base-100 to-base-200 pt-16 pb-6 border-t border-base-300"
        >
            {/* Main Footer Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Stats Section */}
                <motion.div
                    initial={{opacity: 0, y: 20}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.2}}
                    className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-base-300"
                >
                    {stats.map((stat, index) => (
                        <div key={index} className="text-center">
                            <motion.div
                                whileHover={{scale: 1.05}}
                                className="text-2xl font-bold text-primary mb-1"
                            >
                                {stat.number}
                            </motion.div>
                            <div className="text-sm text-base-content/60">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Links Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-b border-base-300">
                    {Object.entries(footerSections).map(([key, section], index) => (
                        <motion.div
                            key={key}
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{delay: 0.1 * index}}
                        >
                            <h3 className="text-base-content font-semibold mb-4">
                                {section.title}
                            </h3>
                            <ul className="space-y-2">
                                {section.links.map((link) => (
                                    <li key={link.name}>
                                        <motion.a
                                            href={link.href}
                                            className="text-base-content/60 hover:text-primary transition-colors text-sm"
                                            whileHover={{x: 2}}
                                        >
                                            {link.name}
                                        </motion.a>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom Section */}
                <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    {/* Brand Section */}
                    <motion.div
                        className="flex flex-col items-center md:items-start gap-2"
                        whileHover={{scale: 1.02}}
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary"/>
                            <span className="text-base-content font-semibold">
                                Powered by Advanced AI
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-base-content/60">
                            <span>© 2026 BarbersBuddies</span>
                            <span>All rights reserved</span>
                        </div>
                    </motion.div>


                    {/* Social Links */}
                    <motion.div
                        className="flex items-center gap-4"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        transition={{delay: 0.6}}
                    >
                        {socialLinks.map((social, index) => (
                            <motion.a
                                key={index}
                                href={social.href}
                                aria-label={social.label}
                                className="p-2 rounded-full bg-base-300/50 hover:bg-primary/10 hover:text-primary
                                         transition-colors"
                                whileHover={{scale: 1.1, rotate: 5}}
                                whileTap={{scale: 0.95}}
                            >
                                <social.icon className="w-4 h-4"/>
                            </motion.a>
                        ))}
                    </motion.div>
                </div>
            </div>
        </motion.footer>
    );
};

export default Footer;