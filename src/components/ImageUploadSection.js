import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Edit, Info, Check, X} from 'lucide-react';

const ImageUploadSection = ({ images, setImages, language, setFormTouched }) => {
    const [showInfo, setShowInfo] = useState(true);

    const translations = {
        en: {
            title: "Shop Images",
            dropzoneText: "Drag 'n' drop images here, or click to select",
            benefits: {
                title: "Why images matter?",
                points: [
                    "First impressions: Professional photos increase booking rates by 70%",
                    "Trust building: Clear shop images help build customer confidence",
                    "Showcase style: Display your unique atmosphere and services",
                    "Mobile optimized: Images adapt perfectly to all devices"
                ]
            },
            editNote: "Images can be edited anytime in Shop Settings after publishing",
            imageCount: "images selected",
            removeImage: "Remove image"
        },
        tr: {
            title: "Dükkan Görselleri",
            dropzoneText: "Görselleri sürükleyip bırakın veya tıklayarak seçin",
            benefits: {
                title: "Görseller neden önemli?",
                points: [
                    "İlk izlenim: Profesyonel fotoğraflar rezervasyon oranlarını %70 artırır",
                    "Güven oluşturma: Net dükkan görselleri müşteri güvenini artırır",
                    "Tarz gösterimi: Benzersiz atmosferinizi ve hizmetlerinizi sergileyin",
                    "Mobil uyumlu: Görseller tüm cihazlara mükemmel uyum sağlar"
                ]
            },
            editNote: "Görseller yayınlandıktan sonra Dükkan Ayarları'ndan düzenlenebilir",
            imageCount: "görsel seçildi",
            removeImage: "Görseli kaldır"
        },
        ar: {
            title: "صور المحل",
            dropzoneText: "اسحب وأفلت الصور هنا، أو انقر للاختيار",
            benefits: {
                title: "لماذا الصور مهمة؟",
                points: [
                    "الانطباع الأول: الصور الاحترافية تزيد معدلات الحجز بنسبة 70٪",
                    "بناء الثقة: صور المحل الواضحة تساعد في بناء ثقة العملاء",
                    "عرض الأسلوب: اعرض أجواءك وخدماتك الفريدة",
                    "متوافق مع الجوال: الصور تتكيف بشكل مثالي مع جميع الأجهزة"
                ]
            },
            editNote: "يمكن تعديل الصور في أي وقت في إعدادات المحل بعد النشر",
            imageCount: "صور مختارة",
            removeImage: "إزالة الصورة"
        },
        de: {
            title: "Shop-Bilder",
            dropzoneText: "Bilder hier ablegen oder klicken zum Auswählen",
            benefits: {
                title: "Warum sind Bilder wichtig?",
                points: [
                    "Erster Eindruck: Professionelle Fotos steigern Buchungsraten um 70%",
                    "Vertrauensbildung: Klare Shop-Bilder stärken das Kundenvertrauen",
                    "Style präsentieren: Zeigen Sie Ihre einzigartige Atmosphäre und Services",
                    "Mobiloptimiert: Bilder passen sich perfekt an alle Geräte an"
                ]
            },
            editNote: "Bilder können nach der Veröffentlichung jederzeit in den Shop-Einstellungen bearbeitet werden",
            imageCount: "Bilder ausgewählt",
            removeImage: "Bild entfernen"
        }
    };

    const t = translations[language];

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: 'image/*',
        onDrop: (acceptedFiles) => {
            setImages([...images, ...acceptedFiles.map(file => Object.assign(file, {
                preview: URL.createObjectURL(file)
            }))]);
            setFormTouched(true);
        }
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ImageIcon className="w-6 h-6" />
                    {t.title}
                </h2>
                <button
                    onClick={() => setShowInfo(!showInfo)}
                    className="btn btn-ghost btn-circle"
                >
                    <Info className="w-5 h-5" />
                </button>
            </div>

            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-base-200 p-6 rounded-xl"
                    >
                        <h3 className="text-lg font-semibold mb-4">{t.benefits.title}</h3>
                        <div className="space-y-3">
                            {t.benefits.points.map((point, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-center gap-2"
                                >
                                    <Check className="w-5 h-5 text-primary" />
                                    <span>{point}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 transition-all duration-200 ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-base-300'
                }`}
            >
                <input {...getInputProps()} />
                <div className="text-center">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 text-base-content/50" />
                    <p className="text-lg">{t.dropzoneText}</p>
                </div>
            </div>

            <AnimatePresence>
                {images.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                    >
                        {images.map((file, index) => (
                            <motion.div
                                key={file.name}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                layout
                                className="relative group aspect-square"
                            >
                                <img
                                    src={file.preview}
                                    alt={`Upload ${index + 1}`}
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                    onClick={() => {
                                        const newImages = [...images];
                                        newImages.splice(index, 1);
                                        setImages(newImages);
                                        setFormTouched(true);
                                    }}
                                    className="absolute top-2 right-2 bg-base-100/80 hover:bg-base-100 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-base-content/70 italic"
            >
                {t.editNote}
            </motion.p>
        </motion.div>
    );
};

export default ImageUploadSection;