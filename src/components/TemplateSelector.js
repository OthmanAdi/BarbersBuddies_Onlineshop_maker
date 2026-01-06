import React, {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {ArrowBigDown, Book, Camera, Check, Layout, Sparkles} from 'lucide-react';

const TemplateSelector = ({onTemplateSelect, selectedTemplate, language = 'en'}) => {
    const [showTemplates, setShowTemplates] = useState(false);

    const templates = [
        {
            id: 'classic',
            title: language === 'tr' ? 'Klasik Profesyonel' :
                language === 'ar' ? 'كلاسيكي محترف' :
                    language === 'de' ? 'Klassisch Professionell' :
                        'Classic Professional',
            description: language === 'tr' ? 'Geleneksel, üst düzey berber' :
                language === 'ar' ? 'صالون حلاقة تقليدي راقي' :
                    language === 'de' ? 'Traditioneller, gehobener Barbershop' :
                        'Traditional, upscale barbershop',
            icon: Book
        },
        {
            id: 'modern',
            title: language === 'tr' ? 'Modern Stüdyo' :
                language === 'ar' ? 'ستوديو عصري' :
                    language === 'de' ? 'Modernes Studio' :
                        'Modern Studio',
            description: language === 'tr' ? 'Çağdaş stil merkezi' :
                language === 'ar' ? 'مركز الأناقة المعاصر' :
                    language === 'de' ? 'Zeitgenössische Style-Location' :
                        'Contemporary style hub',
            icon: Camera
        },
        {
            id: 'family',
            title: language === 'tr' ? 'Aile Berberi' :
                language === 'ar' ? 'صالون العائلة' :
                    language === 'de' ? 'Familien-Barbershop' :
                        'Family Barbershop',
            description: language === 'tr' ? 'Sıcak, aile dostu ortam' :
                language === 'ar' ? 'أجواء عائلية ودودة' :
                    language === 'de' ? 'Warme, familienfreundliche Atmosphäre' :
                        'Welcoming, family-friendly',
            icon: Layout
        }
    ];

    return (
        <div className="relative w-full">
            <motion.button
                className="btn btn-outline w-full gap-2 justify-between"
                onClick={() => setShowTemplates(!showTemplates)}
                whileHover={{scale: 1.01}}
                whileTap={{scale: 0.99}}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4"/>
                    <span>
            {language === 'tr' ? 'Şablon Seç' :
                language === 'ar' ? 'اختر قالباً' :
                    language === 'de' ? 'Vorlage wählen' :
                        'Choose Template'}
          </span>
                </div>
                <ArrowBigDown className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`}/>
            </motion.button>

            <AnimatePresence>
                {showTemplates && (
                    <motion.div
                        initial={{opacity: 0, y: -20}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -20}}
                        transition={{duration: 0.2}}
                        className="absolute z-50 left-0 right-0 mt-2 bg-base-100 rounded-lg shadow-xl border border-base-200"
                    >
                        <div className="p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">
                                    {language === 'tr' ? 'Profesyonel Şablonlar' :
                                        language === 'ar' ? 'قوالب احترافية' :
                                            language === 'de' ? 'Professionelle Vorlagen' :
                                                'Professional Templates'}
                                </h3>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setShowTemplates(false)}
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {templates.map((template) => {
                                    const isSelected = selectedTemplate === template.id;
                                    const Icon = template.icon;

                                    return (
                                        <motion.div
                                            key={template.id}
                                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                                isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                                            }`}
                                            onClick={() => {
                                                onTemplateSelect(template);
                                                setShowTemplates(false);
                                            }}
                                            whileHover={{scale: 1.01}}
                                            whileTap={{scale: 0.99}}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`p-2 rounded-full ${isSelected ? 'bg-primary text-primary-content' : 'bg-base-200'}`}>
                                                    <Icon className="w-5 h-5"/>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="font-medium">{template.title}</h4>
                                                        {isSelected && (
                                                            <Check className="w-4 h-4 text-primary"/>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-base-content/70 mt-1">
                                                        {template.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TemplateSelector;