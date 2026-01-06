// PageBuilder.js
import React, {useEffect, useState} from 'react';
import {ChromePicker} from 'react-color';
import {AnimatePresence, motion} from 'framer-motion';
import {doc, updateDoc} from 'firebase/firestore';
import {db} from '../firebase';
import {Eye, Save, X} from 'lucide-react';
import ModifiedShopLandingPage from "./ModifiedShopLandingPage";

const PageBuilder = ({shop, onClose, onSave}) => {
    const [loading, setLoading] = useState(true);
    const [currentTheme, setCurrentTheme] = useState(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [activePanel, setActivePanel] = useState('layout');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [selectedColor, setSelectedColor] = useState(null);
    const [activeBlocks, setActiveBlocks] = useState(shop.blocks || [
        {id: 'header', type: 'header', active: true},
        {id: 'services', type: 'services', active: true},
        {id: 'gallery', type: 'gallery', active: true},
        {id: 'team', type: 'team', active: true},
        {id: 'contact', type: 'contact', active: true},
        {id: 'reviews', type: 'reviews', active: true},
        {id: 'availability', type: 'availability', active: true}
    ]);
    const [editableContent, setEditableContent] = useState({});

    // State for all customizable elements
    useEffect(() => {
        if (shop) {
            setCurrentTheme(shop.theme || {
                colors: {
                    primary: '#2563eb',
                    secondary: '#7c3aed',
                    accent: '#f59e0b',
                    background: '#ffffff'
                },
                typography: {
                    headingFont: 'Inter',
                    bodyFont: 'Inter',
                    fontSize: 'base'
                },
                animations: {
                    enabled: true,
                    duration: 0.3,
                    type: 'fade'
                }
            });
            setActiveBlocks(shop.blocks || [
                { id: 'header', type: 'header', active: true },
                { id: 'services', type: 'services', active: true },
                { id: 'gallery', type: 'gallery', active: true },
                { id: 'team', type: 'team', active: true },
                { id: 'contact', type: 'contact', active: true },
                { id: 'reviews', type: 'reviews', active: true },
                { id: 'availability', type: 'availability', active: true },
                { id: 'cta', type: 'cta', active: true },
                { id: 'features', type: 'features', active: true },
                { id: 'footer', type: 'footer', active: true }
            ]);
            setLoading(false);
        }
    }, [shop]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-100">
                <div className="loading loading-spinner loading-lg text-primary"></div>
            </div>
        );
    }





    // Save changes to Firebase
    const handleSave = async () => {
        try {
            await updateDoc(doc(db, 'barberShops', shop.id), {
                theme: currentTheme,
                blocks: activeBlocks,
                lastUpdated: new Date()
            });

            onSave({
                ...shop,
                theme: currentTheme,
                blocks: activeBlocks
            });

            onClose();
        } catch (error) {
            console.error('Error saving customizations:', error);
        }
    };

    // Toggle block visibility
    const toggleBlock = (blockId) => {
        setActiveBlocks(blocks =>
            blocks.map(block =>
                block.id === blockId
                    ? {...block, active: !block.active}
                    : block
            )
        );
    };

    // Update theme color
    const handleColorChange = (color) => {
        if (selectedColor) {
            setCurrentTheme(theme => ({
                ...theme,
                colors: {
                    ...theme.colors,
                    [selectedColor]: color.hex
                }
            }));
        }
    };

    // Render the editor interface
    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Editor Sidebar */}
            <div className="w-80 bg-base-200 border-r border-base-300 overflow-y-auto">
                <div className="p-4 border-b border-base-300">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold">Page Builder</h2>
                        <button onClick={onClose} className="btn btn-ghost btn-sm">
                            <X className="w-4 h-4"/>
                        </button>
                    </div>
                </div>

                {/* Editor Tabs */}
                <div className="flex border-b border-base-300">
                    {['layout', 'style', 'content'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActivePanel(tab)}
                            className={`flex-1 p-3 text-sm font-medium transition-colors
                ${activePanel === tab
                                ? 'border-b-2 border-primary text-primary'
                                : 'text-base-content/60 hover:text-base-content'}`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Panel Content */}
                <div className="p-4 space-y-6">
                    {activePanel === 'layout' && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-sm text-base-content/60">Active Sections</h3>
                            {activeBlocks.map(block => (
                                <div
                                    key={block.id}
                                    className="flex items-center justify-between p-3 bg-base-100 rounded-lg"
                                >
                                    <span className="font-medium capitalize">{block.id}</span>
                                    <button
                                        onClick={() => toggleBlock(block.id)}
                                        className={`btn btn-sm ${block.active ? 'btn-primary' : 'btn-ghost'}`}
                                    >
                                        {block.active ? 'Active' : 'Inactive'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {activePanel === 'style' && (
                        <div className="space-y-6">
                            {/* Colors */}
                            <div className="space-y-4">
                                <h3 className="font-medium text-sm text-base-content/60">Colors</h3>
                                {Object.entries(currentTheme.colors).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className="flex items-center justify-between p-3 bg-base-100 rounded-lg"
                                    >
                                        <span className="font-medium capitalize">{key}</span>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-6 h-6 rounded cursor-pointer border border-base-300"
                                                style={{backgroundColor: value}}
                                                onClick={() => {
                                                    setSelectedColor(key);
                                                    setShowColorPicker(true);
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Typography */}
                            <div className="space-y-4">
                                <h3 className="font-medium text-sm text-base-content/60">Typography</h3>
                                <select
                                    value={currentTheme.typography.headingFont}
                                    onChange={(e) => setCurrentTheme(theme => ({
                                        ...theme,
                                        typography: {
                                            ...theme.typography,
                                            headingFont: e.target.value
                                        }
                                    }))}
                                    className="select select-bordered w-full"
                                >
                                    <option value="Inter">Inter</option>
                                    <option value="Poppins">Poppins</option>
                                    <option value="Roboto">Roboto</option>
                                </select>
                            </div>

                            {/* Animations */}
                            <div className="space-y-4">
                                <h3 className="font-medium text-sm text-base-content/60">Animations</h3>
                                <div className="form-control">
                                    <label className="label cursor-pointer">
                                        <span className="label-text">Enable Animations</span>
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            checked={currentTheme.animations.enabled}
                                            onChange={(e) => setCurrentTheme(theme => ({
                                                ...theme,
                                                animations: {
                                                    ...theme.animations,
                                                    enabled: e.target.checked
                                                }
                                            }))}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-base-200 border-t border-base-300">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPreviewMode(!previewMode)}
                            className="btn btn-secondary flex-1"
                        >
                            {previewMode ? <Eye className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            {previewMode ? 'Edit' : 'Preview'}
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn btn-primary flex-1"
                        >
                            <Save className="w-4 h-4"/>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-base-100 overflow-y-auto">
                <div
                    className={`transition-all duration-300
            ${previewMode ? 'pointer-events-none' : 'pointer-events-auto'}`}
                >
                    {/* Render modified version of ShopLandingPage here */}
                    <ModifiedShopLandingPage
                        shop={shop}
                        theme={currentTheme}
                        activeBlocks={activeBlocks}
                        isEditing={!previewMode}
                        onUpdate={(field, value) => {
                            setEditableContent(prev => ({
                                ...prev,
                                [field]: value
                            }));
                        }}
                    />
                </div>
            </div>

            {/* Color Picker Modal */}
            <AnimatePresence>
                {showColorPicker && (
                    <motion.div
                        initial={{opacity: 0, scale: 0.9}}
                        animate={{opacity: 1, scale: 1}}
                        exit={{opacity: 0, scale: 0.9}}
                        className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
                        onClick={() => setShowColorPicker(false)}
                    >
                        <div
                            className="bg-base-100 p-4 rounded-lg shadow-xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <ChromePicker
                                color={currentTheme.colors[selectedColor]}
                                onChange={handleColorChange}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ModifiedShopLandingPage.js component that extends the original ShopLandingPage
// with editing capabilities - will provide in next section

export default PageBuilder;