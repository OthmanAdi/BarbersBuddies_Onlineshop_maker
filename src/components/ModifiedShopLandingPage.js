// ModifiedShopLandingPage.js
import React, {useEffect, useRef, useState} from 'react';
import {motion} from 'framer-motion';
import {
    Calendar,
    ChevronRight,
    Clock,
    Edit2,
    Image as ImageIcon,
    Mail,
    MapPin,
    Phone,
    Plus,
    Star,
    Trash2,
} from 'lucide-react';
import EditableText from './EditableText'; // Will provide this component next
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import {storage} from '../firebase';
import {getDownloadURL, ref, uploadBytes} from 'firebase/storage';

const ModifiedShopLandingPage = ({
                                     shop,
                                     theme,
                                     activeBlocks,
                                     isEditing,
                                     onUpdate
                                 }) => {

    const [editableContent, setEditableContent] = useState({
        name: shop?.name || '',
        description: shop?.biography || shop?.description || '',
        address: shop?.address || '',
        phone: shop?.phoneNumber || '',
        email: shop?.email || '',
        services: shop?.services || [],
        imageUrls: shop?.imageUrls || [],
        availability: shop?.availability || {},
        team: shop?.employees || [],
        reviews: shop?.reviews || []
    });

    // Safely check for blocks
    const isBlockActive = (blockId) => {
        return !activeBlocks || activeBlocks.find(b => b.id === blockId)?.active;
    };

    // Safely handle imageUrls in slider
    const sliderContent = editableContent.imageUrls.length > 0 ? editableContent.imageUrls : ['/default-image.jpg'];

    // State for managing editable content
    const [editingSection, setEditingSection] = useState(null);
    const [hoveredSection, setHoveredSection] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const imageInputRef = useRef(null);

    // Initialize editable content from shop data
    useEffect(() => {
        setEditableContent({
            name: shop.name,
            description: shop.biography || shop.description,
            address: shop.address,
            phone: shop.phoneNumber,
            email: shop.email,
            services: shop.services,
            imageUrls: shop.imageUrls,
            availability: shop.availability,
            team: shop.employees || [],
            reviews: shop.reviews || []
        });
    }, [shop]);

    // Slider settings
    const sliderSettings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
    };

    // Apply theme styles
    const themeStyles = {
        '--primary-color': theme.colors.primary,
        '--secondary-color': theme.colors.secondary,
        '--accent-color': theme.colors.accent,
        '--background-color': theme.colors.background,
        '--heading-font': theme.typography.headingFont,
        '--body-font': theme.typography.bodyFont,
        fontFamily: `var(--body-font), sans-serif`,
    };

    // Handle image upload
    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                // Show preview
                setPreviewImage(URL.createObjectURL(file));

                // Upload to Firebase Storage
                const imageRef = ref(storage, `shops/${shop.id}/images/${Date.now()}_${file.name}`);
                await uploadBytes(imageRef, file);
                const url = await getDownloadURL(imageRef);

                // Update content
                const newImageUrls = [...editableContent.imageUrls, url];
                setEditableContent(prev => ({
                    ...prev,
                    imageUrls: newImageUrls
                }));
                onUpdate('imageUrls', newImageUrls);

                // Clear preview
                setPreviewImage(null);
            } catch (error) {
                console.error('Error uploading image:', error);
            }
        }
    };

    // Editable Section Wrapper Component
    const EditableSection = ({
                                 id,
                                 isActive,
                                 children,
                                 className = ""
                             }) => {
        if (!isActive) return null;

        return (
            <motion.div
                className={`relative group ${className}`}
                onMouseEnter={() => isEditing && setHoveredSection(id)}
                onMouseLeave={() => isEditing && setHoveredSection(null)}
                initial={theme.animations.enabled ? {opacity: 0, y: 20} : false}
                animate={theme.animations.enabled ? {opacity: 1, y: 0} : false}
                transition={{duration: theme.animations.duration}}
            >
                {children}

                {isEditing && hoveredSection === id && (
                    <div
                        className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setEditingSection(id)}
                            className="btn btn-circle btn-sm btn-primary"
                        >
                            <Edit2 className="w-4 h-4"/>
                        </button>
                    </div>
                )}
            </motion.div>
        );
    };

    // Render the modified landing page
    return (
        <div style={themeStyles} className="min-h-screen bg-base-100">
            {/* Hero Section */}
            <EditableSection
                id="header"
                isActive={activeBlocks.find(b => b.id === 'header')?.active}
            >
                {isBlockActive('header') && (
                    <div className="relative min-h-[80vh] bg-base-100">
                        <Slider {...sliderSettings}>
                            {editableContent.imageUrls.map((url, index) => (
                                <div key={index} className="relative h-[80vh]">
                                    <div
                                        className="absolute inset-0 bg-cover bg-center"
                                        style={{backgroundImage: `url(${url})`}}
                                    >
                                        <div
                                            className="absolute inset-0 bg-gradient-to-b from-base-100/60 to-base-100/90"/>
                                    </div>
                                </div>
                            ))}
                        </Slider>

                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="text-center space-y-6 p-4">
                                <EditableText
                                    value={editableContent.name}
                                    onChange={(value) => {
                                        setEditableContent(prev => ({...prev, name: value}));
                                        onUpdate('name', value);
                                    }}
                                    isEditing={isEditing && editingSection === 'header'}
                                    className="text-6xl md:text-7xl font-bold text-base-content"
                                />

                                <EditableText
                                    value={editableContent.description}
                                    onChange={(value) => {
                                        setEditableContent(prev => ({...prev, description: value}));
                                        onUpdate('description', value);
                                    }}
                                    isEditing={isEditing && editingSection === 'header'}
                                    isRichText
                                    className="prose max-w-2xl mx-auto text-xl md:text-2xl text-base-content/80"
                                />

                                <div className="flex gap-4 justify-center">
                                    {isEditing ? (
                                        <button
                                            onClick={() => imageInputRef.current?.click()}
                                            className="btn btn-primary btn-lg gap-2"
                                        >
                                            <ImageIcon className="w-5 h-5"/>
                                            Add Image
                                        </button>
                                    ) : (
                                        <button className="btn btn-primary btn-lg gap-2">
                                            <Calendar className="w-5 h-5"/>
                                            Book Now
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick Info Bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-base-100/80 backdrop-blur-lg">
                            <div className="container mx-auto px-4 py-6">
                                <div className="flex flex-wrap justify-around gap-8 text-base-content">
                                    <InfoItem
                                        icon={Clock}
                                        label="Hours"
                                        value={editableContent.availability}
                                        isEditing={isEditing && editingSection === 'header'}
                                        onUpdate={(value) => {
                                            setEditableContent(prev => ({...prev, availability: value}));
                                            onUpdate('availability', value);
                                        }}
                                    />

                                    <InfoItem
                                        icon={Phone}
                                        label="Phone"
                                        value={editableContent.phone}
                                        isEditing={isEditing && editingSection === 'header'}
                                        onUpdate={(value) => {
                                            setEditableContent(prev => ({...prev, phone: value}));
                                            onUpdate('phone', value);
                                        }}
                                    />

                                    <InfoItem
                                        icon={MapPin}
                                        label="Address"
                                        value={editableContent.address}
                                        isEditing={isEditing && editingSection === 'header'}
                                        onUpdate={(value) => {
                                            setEditableContent(prev => ({...prev, address: value}));
                                            onUpdate('address', value);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </EditableSection>

            {/* Services Section */}
            <EditableSection
                id="services"
                isActive={activeBlocks.find(b => b.id === 'services')?.active}
                className="py-16"
            >
                {isBlockActive('services') && editableContent.services.length > 0 && (
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl font-bold text-center mb-8">Our Services</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {editableContent.services.map((service, index) => (
                                <ServiceCard
                                    key={index}
                                    service={service}
                                    isEditing={isEditing && editingSection === 'services'}
                                    onUpdate={(value) => {
                                        const newServices = [...editableContent.services];
                                        newServices[index] = value;
                                        setEditableContent(prev => ({...prev, services: newServices}));
                                        onUpdate('services', newServices);
                                    }}
                                    onDelete={() => {
                                        const newServices = editableContent.services.filter((_, i) => i !== index);
                                        setEditableContent(prev => ({...prev, services: newServices}));
                                        onUpdate('services', newServices);
                                    }}
                                />
                            ))}

                            {isEditing && editingSection === 'services' && (
                                <button
                                    onClick={() => {
                                        const newServices = [...editableContent.services, {
                                            name: 'New Service',
                                            price: '0',
                                            duration: '30'
                                        }];
                                        setEditableContent(prev => ({...prev, services: newServices}));
                                        onUpdate('services', newServices);
                                    }}
                                    className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all h-full flex items-center justify-center"
                                >
                                    <Plus className="w-8 h-8 text-base-content/60"/>
                                    <span className="mt-2 text-base-content/60">Add Service</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </EditableSection>

            {/* Team Section */}
            <EditableSection
                id="team"
                isActive={activeBlocks.find(b => b.id === 'team')?.active}
                className="py-16 bg-base-200"
            >
                {isBlockActive('team') && (
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl font-bold text-center mb-8">Our Team</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {editableContent.team.map((member, index) => (
                                <TeamMemberCard
                                    key={index}
                                    member={member}
                                    isEditing={isEditing && editingSection === 'team'}
                                    onUpdate={(value) => {
                                        const newTeam = [...editableContent.team];
                                        newTeam[index] = value;
                                        setEditableContent(prev => ({...prev, team: newTeam}));
                                        onUpdate('team', newTeam);
                                    }}
                                    onDelete={() => {
                                        const newTeam = editableContent.team.filter((_, i) => i !== index);
                                        setEditableContent(prev => ({...prev, team: newTeam}));
                                        onUpdate('team', newTeam);
                                    }}
                                />
                            ))}

                            {isEditing && editingSection === 'team' && (
                                <button
                                    onClick={() => {
                                        const newTeam = [...editableContent.team, {
                                            name: 'New Team Member',
                                            role: 'Barber',
                                            expertise: [],
                                            schedule: {}
                                        }];
                                        setEditableContent(prev => ({...prev, team: newTeam}));
                                        onUpdate('team', newTeam);
                                    }}
                                    className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all h-full flex items-center justify-center"
                                >
                                    <Plus className="w-8 h-8 text-base-content/60"/>
                                    <span className="mt-2 text-base-content/60">Add Team Member</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </EditableSection>

            {/* Reviews Section */}
            <EditableSection
                id="reviews"
                isActive={activeBlocks.find(b => b.id === 'reviews')?.active}
                className="py-16"
            >
                {isBlockActive('reviews') && editableContent.reviews.length > 0 && (
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl font-bold text-center mb-8">Client Reviews</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {editableContent.reviews.map((review, index) => (
                                <ReviewCard
                                    key={index}
                                    review={review}
                                    isEditing={isEditing && editingSection === 'reviews'}
                                    onUpdate={(value) => {
                                        const newReviews = [...editableContent.reviews];
                                        newReviews[index] = value;
                                        setEditableContent(prev => ({...prev, reviews: newReviews}));
                                        onUpdate('reviews', newReviews);
                                    }}
                                    onDelete={() => {
                                        const newReviews = editableContent.reviews.filter((_, i) => i !== index);
                                        setEditableContent(prev => ({...prev, reviews: newReviews}));
                                        onUpdate('reviews', newReviews);
                                    }}
                                />
                            ))}

                            {isEditing && editingSection === 'reviews' && (
                                <button
                                    onClick={() => {
                                        const newReviews = [...editableContent.reviews, {
                                            author: 'New Client',
                                            rating: 5,
                                            text: 'Write your review here...'
                                        }];
                                        setEditableContent(prev => ({...prev, reviews: newReviews}));
                                        onUpdate('reviews', newReviews);
                                    }}
                                    className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all h-full flex items-center justify-center"
                                >
                                    <Plus className="w-8 h-8 text-base-content/60"/>
                                    <span className="mt-2 text-base-content/60">Add Review</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </EditableSection>

            <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />

            {/* Gallery Section */}
            <EditableSection
                id="gallery"
                isActive={activeBlocks.find(b => b.id === 'gallery')?.active}
                className="py-16 bg-base-200"
            >
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-8">Gallery</h2>
                    {isBlockActive('gallery') && editableContent.imageUrls.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {editableContent.imageUrls.map((url, index) => (
                                <motion.div
                                    key={index}
                                    initial={{opacity: 0, scale: 0.9}}
                                    animate={{opacity: 1, scale: 1}}
                                    transition={{delay: index * 0.1}}
                                    className="relative aspect-square rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all group"
                                >
                                    <img
                                        src={url}
                                        alt={`Gallery ${index + 1}`}
                                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                                    />
                                    {isEditing && editingSection === 'gallery' && (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    const newUrls = editableContent.imageUrls.filter((_, i) => i !== index);
                                                    setEditableContent(prev => ({...prev, imageUrls: newUrls}));
                                                    onUpdate('imageUrls', newUrls);
                                                }}
                                                className="btn btn-error btn-circle"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {isEditing && editingSection === 'gallery' && (
                                <button
                                    onClick={() => imageInputRef.current?.click()}
                                    className="aspect-square rounded-3xl border-2 border-dashed border-base-content/20 flex flex-col items-center justify-center gap-4 hover:border-primary transition-colors"
                                >
                                    <Plus className="w-8 h-8 text-base-content/60"/>
                                    <span className="text-base-content/60">Add Image</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </EditableSection>

            {/* Contact Section */}
            <EditableSection
                id="contact"
                isActive={activeBlocks.find(b => b.id === 'contact')?.active}
                className="py-16"
            >
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-8">Contact Us</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <MapPin className="w-6 h-6 text-primary flex-shrink-0 mt-1"/>
                                <div>
                                    <h3 className="font-semibold mb-2">Address</h3>
                                    <EditableText
                                        value={editableContent.address}
                                        onChange={(value) => {
                                            setEditableContent(prev => ({...prev, address: value}));
                                            onUpdate('address', value);
                                        }}
                                        isEditing={isEditing && editingSection === 'contact'}
                                        className="text-base-content/80"
                                    />
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <Phone className="w-6 h-6 text-primary flex-shrink-0 mt-1"/>
                                <div>
                                    <h3 className="font-semibold mb-2">Phone</h3>
                                    <EditableText
                                        value={editableContent.phone}
                                        onChange={(value) => {
                                            setEditableContent(prev => ({...prev, phone: value}));
                                            onUpdate('phone', value);
                                        }}
                                        isEditing={isEditing && editingSection === 'contact'}
                                        className="text-base-content/80"
                                    />
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <Mail className="w-6 h-6 text-primary flex-shrink-0 mt-1"/>
                                <div>
                                    <h3 className="font-semibold mb-2">Email</h3>
                                    <EditableText
                                        value={editableContent.email}
                                        onChange={(value) => {
                                            setEditableContent(prev => ({...prev, email: value}));
                                            onUpdate('email', value);
                                        }}
                                        isEditing={isEditing && editingSection === 'contact'}
                                        className="text-base-content/80"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg overflow-hidden h-80">
                            {/* Placeholder for map - can be made interactive in the future */}
                            <div className="w-full h-full bg-base-200 flex items-center justify-center">
                                <MapPin className="w-12 h-12 text-base-content/40"/>
                            </div>
                        </div>
                    </div>
                </div>
            </EditableSection>

            {/* Availability Section */}
            <EditableSection
                id="availability"
                isActive={activeBlocks.find(b => b.id === 'availability')?.active}
                className="py-16 bg-base-200"
            >
                {isBlockActive('availability') && Object.keys(editableContent.availability).length > 0 && (
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl font-bold text-center mb-8">Opening Hours</h2>
                        <div className="max-w-md mx-auto space-y-4">
                            {Object.entries(editableContent.availability).map(([day, hours]) => (
                                <div
                                    key={day}
                                    className={`flex items-center justify-between p-4 rounded-lg bg-base-100
                  ${day === new Date().toLocaleDateString('en-US', {weekday: 'long'})
                                        ? 'ring-2 ring-primary'
                                        : ''
                                    }`}
                                >
                                    <span className="font-medium">{day}</span>
                                    {isEditing && editingSection === 'availability' ? (
                                        <div className="flex gap-2">
                                            <input
                                                type="time"
                                                value={hours?.open || ''}
                                                onChange={(e) => {
                                                    const newAvailability = {
                                                        ...editableContent.availability,
                                                        [day]: {...hours, open: e.target.value}
                                                    };
                                                    setEditableContent(prev => ({
                                                        ...prev,
                                                        availability: newAvailability
                                                    }));
                                                    onUpdate('availability', newAvailability);
                                                }}
                                                className="input input-bordered input-sm w-32"
                                            />
                                            <span>-</span>
                                            <input
                                                type="time"
                                                value={hours?.close || ''}
                                                onChange={(e) => {
                                                    const newAvailability = {
                                                        ...editableContent.availability,
                                                        [day]: {...hours, close: e.target.value}
                                                    };
                                                    setEditableContent(prev => ({
                                                        ...prev,
                                                        availability: newAvailability
                                                    }));
                                                    onUpdate('availability', newAvailability);
                                                }}
                                                className="input input-bordered input-sm w-32"
                                            />
                                        </div>
                                    ) : (
                                        <span>{hours ? `${hours.open} - ${hours.close}` : 'Closed'}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </EditableSection>

            {/* Bottom CTA */}
            <EditableSection
                id="cta"
                isActive={activeBlocks.find(b => b.id === 'cta')?.active}
                className="bg-primary text-primary-content py-16"
            >
                <div className="container mx-auto px-4 text-center">
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        className="space-y-6"
                    >
                        <h2 className="text-4xl font-bold">Ready to Book?</h2>
                        <p className="text-xl max-w-2xl mx-auto">
                            Book your appointment now and experience our premium services.
                        </p>
                        <button className="btn btn-lg btn-secondary gap-2 hover:gap-3 transition-all">
                            <Calendar className="w-6 h-6"/>
                            Book Now
                            <ChevronRight className="w-6 h-6"/>
                        </button>
                    </motion.div>
                </div>
            </EditableSection>

            {/* Footer */}
            <footer className="footer footer-center p-10 bg-base-200 text-base-content">
                <div>
                    <EditableText
                        value={editableContent.name}
                        onChange={(value) => {
                            setEditableContent(prev => ({...prev, name: value}));
                            onUpdate('name', value);
                        }}
                        isEditing={isEditing && editingSection === 'footer'}
                        className="text-2xl font-bold"
                    />
                    <EditableText
                        value={editableContent.address}
                        onChange={(value) => {
                            setEditableContent(prev => ({...prev, address: value}));
                            onUpdate('address', value);
                        }}
                        isEditing={isEditing && editingSection === 'footer'}
                    />
                    <EditableText
                        value={editableContent.phone}
                        onChange={(value) => {
                            setEditableContent(prev => ({...prev, phone: value}));
                            onUpdate('phone', value);
                        }}
                        isEditing={isEditing && editingSection === 'footer'}
                    />
                </div>
                <div>
                    <div className="grid grid-flow-col gap-4">
                        <a className="link link-hover">Privacy Policy</a>
                        <a className="link link-hover">Terms of Service</a>
                        <a className="link link-hover">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// Helper Components (ServiceCard, TeamMemberCard, ReviewCard, etc.)
const ServiceCard = ({ service = {}, isEditing = false, onUpdate = () => {}, onDelete = () => {} }) => {
    if (!service) return null;
    return (
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all"
        >
            <div className="card-body relative">
                {isEditing && (
                    <button
                        onClick={onDelete}
                        className="btn btn-error btn-circle btn-sm absolute top-2 right-2"
                    >
                        <Trash2 className="w-4 h-4"/>
                    </button>
                )}

                <EditableText
                    value={service.name}
                    onChange={(value) => onUpdate({...service, name: value})}
                    isEditing={isEditing}
                    className="card-title"
                />

                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary">€</span>
                    <EditableText
                        value={service.price}
                        onChange={(value) => onUpdate({...service, price: value})}
                        isEditing={isEditing}
                        className="text-2xl font-bold"
                    />
                </div>

                {isEditing && (
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Duration (minutes)</span>
                        </label>
                        <input
                            type="number"
                            value={service.duration}
                            onChange={(e) => onUpdate({...service, duration: e.target.value})}
                            className="input input-bordered"
                            min="1"
                            max="999"
                        />
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const TeamMemberCard = ({ member = {}, isEditing = false, onUpdate = () => {}, onDelete = () => {} }) => {
    if (!member) return null;
    return (
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all"
        >
            <div className="card-body relative">
                {isEditing && (
                    <button
                        onClick={onDelete}
                        className="btn btn-error btn-circle btn-sm absolute top-2 right-2"
                    >
                        <Trash2 className="w-4 h-4"/>
                    </button>
                )}

                <div className="avatar mx-auto">
                    <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                        <img
                            src={member.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                            alt={member.name}
                        />
                    </div>
                </div>

                <EditableText
                    value={member.name}
                    onChange={(value) => onUpdate({...member, name: value})}
                    isEditing={isEditing}
                    className="text-xl font-bold text-center mt-4"
                />

                {isEditing ? (
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Expertise (comma-separated)</span>
                        </label>
                        <input
                            value={member.expertise.join(', ')}
                            onChange={(e) => onUpdate({
                                ...member,
                                expertise: e.target.value.split(',').map(s => s.trim())
                            })}
                            className="input input-bordered"
                        />
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 justify-center">
                        {member.expertise.map((skill, index) => (
                            <span
                                key={index}
                                className="badge badge-primary badge-outline"
                            >
                {skill}
              </span>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const ReviewCard = ({ review = {}, isEditing = false, onUpdate = () => {}, onDelete = () => {} }) => {
    if (!review) return null;
    return (
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all"
        >
            <div className="card-body relative">
                {isEditing && (
                    <button
                        onClick={onDelete}
                        className="btn btn-error btn-circle btn-sm absolute top-2 right-2"
                    >
                        <Trash2 className="w-4 h-4"/>
                    </button>
                )}

                <div className="flex items-center gap-2 mb-4">
                    {[...Array(5)].map((_, i) => (
                        <Star
                            key={i}
                            className={`w-5 h-5 ${
                                i < review.rating
                                    ? 'text-primary fill-primary'
                                    : 'text-base-content/20'
                            } ${isEditing ? 'cursor-pointer' : ''}`}
                            onClick={() => isEditing && onUpdate({...review, rating: i + 1})}
                        />
                    ))}
                </div>

                <EditableText
                    value={review.text}
                    onChange={(value) => onUpdate({...review, text: value})}
                    isEditing={isEditing}
                    className="text-base-content/80 italic"
                />

                <div className="mt-4">
                    <EditableText
                        value={review.author}
                        onChange={(value) => onUpdate({...review, author: value})}
                        isEditing={isEditing}
                        className="font-semibold"
                    />
                </div>
            </div>
        </motion.div>
    );
};


// InfoItem Component for the Quick Info Bar
const InfoItem = ({ icon: Icon, label = '', value = '', isEditing = false, onUpdate = () => {} }) => {
    if (!Icon || !label) return null;
    return (
        <div className="flex items-center gap-3">
            <Icon className="text-primary w-6 h-6"/>
            <div>
                <p className="font-semibold">{label}</p>
                <EditableText
                    value={typeof value === 'object' ? JSON.stringify(value) : value}
                    onChange={onUpdate}
                    isEditing={isEditing}
                    className="text-base-content/80"
                />
            </div>
        </div>
    );
};

export default ModifiedShopLandingPage;