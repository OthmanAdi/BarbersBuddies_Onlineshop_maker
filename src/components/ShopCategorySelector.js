import React, {useContext, useEffect, useState} from 'react';
import {CheckCircle, TagIcon} from 'lucide-react';
import {AnimatePresence, motion} from 'framer-motion';
import LanguageContext from './LanguageContext';

const SHOP_CATEGORIES = [{
    id: 'traditional',
    icon: '💈',
    translations: {
        en: {
            label: 'Traditional Barbering',
            description: 'Classic cuts and traditional barbering services'
        },
        tr: {
            label: 'Geleneksel Berberlik',
            description: 'Klasik kesimler ve geleneksel berberlik hizmetleri'
        },
        ar: {
            label: 'الحلاقة التقليدية',
            description: 'قصات كلاسيكية وخدمات حلاقة تقليدية'
        },
        de: {
            label: 'Traditionelles Barbering',
            description: 'Klassische Schnitte und traditionelle Barbier-Dienstleistungen'
        }
    }
}, {
    id: 'african',
    icon: '✨',
    translations: {
        en: {
            label: 'African & Textured Hair',
            description: 'Specialized in African, Caribbean & textured hair types'
        },
        tr: {
            label: 'Afrika & Dokulu Saç',
            description: 'Afrika, Karayip ve dokulu saç tipleri konusunda uzmanlaşmış'
        },
        ar: {
            label: 'الشعر الأفريقي والمجعد',
            description: 'متخصصون في أنواع الشعر الأفريقي والكاريبي والمجعد'
        },
        de: {
            label: 'Afrikanisches & strukturiertes Haar',
            description: 'Spezialisiert auf afrikanische, karibische & strukturierte Haartypen'
        }
    }
}, {
    id: 'kids',
    icon: '👶',
    translations: {
        en: {
            label: 'Kids Specialist',
            description: 'Child-friendly environment and specialized kids services'
        },
        tr: {
            label: 'Çocuk Uzmanı',
            description: 'Çocuk dostu ortam ve özel çocuk hizmetleri'
        },
        ar: {
            label: 'متخصص أطفال',
            description: 'بيئة صديقة للأطفال وخدمات متخصصة للأطفال'
        },
        de: {
            label: 'Kinderspezialist',
            description: 'Kinderfreundliche Umgebung und spezialisierte Kinderdienstleistungen'
        }
    }
}, {
    id: 'premium-grooming',
    icon: '👑',
    translations: {
        en: {
            label: 'Premium Grooming',
            description: 'Luxury grooming experiences with premium products and personalized service'
        },
        tr: {
            label: 'Premium Bakım',
            description: 'Premium ürünler ve kişiselleştirilmiş hizmet ile lüks bakım deneyimleri'
        },
        ar: {
            label: 'العناية الفاخرة',
            description: 'تجارب عناية فاخرة مع منتجات متميزة وخدمة شخصية'
        },
        de: {
            label: 'Premium-Pflege',
            description: 'Luxuriöse Pflegeerlebnisse mit Premium-Produkten und persönlichem Service'
        }
    }
}, {
    id: 'hair-therapy',
    icon: '🌿',
    translations: {
        en: {
            label: 'Hair Therapy',
            description: 'Specialized treatments for hair health and restoration'
        },
        tr: {
            label: 'Saç Terapisi',
            description: 'Saç sağlığı ve yenilenmesi için özel tedaviler'
        },
        ar: {
            label: 'علاج الشعر',
            description: 'علاجات متخصصة لصحة الشعر وترميمه'
        },
        de: {
            label: 'Haartherapie',
            description: 'Spezialisierte Behandlungen für Haargesundheit und -wiederherstellung'
        }
    }
}, {
    id: 'beard-master',
    icon: '🧔',
    translations: {
        en: {
            label: 'Beard Master',
            description: 'Expert beard sculpting and precision trimming services'
        },
        tr: {
            label: 'Sakal Ustası',
            description: 'Uzman sakal şekillendirme ve hassas kesim hizmetleri'
        },
        ar: {
            label: 'خبير اللحية',
            description: 'خدمات نحت اللحية المتخصصة والتشذيب الدقيق'
        },
        de: {
            label: 'Bart-Meister',
            description: 'Experten-Bartskulptur und Präzisionstrimming-Services'
        }
    }
}, {
    id: 'vip-lounge',
    icon: '🎭',
    translations: {
        en: {
            label: 'VIP Lounge',
            description: 'Exclusive private styling suite with premium amenities'
        },
        tr: {
            label: 'VIP Salon',
            description: 'Premium olanaklarla özel stil süiti'
        },
        ar: {
            label: 'صالة كبار الشخصيات',
            description: 'جناح تصفيف خاص حصري مع وسائل راحة متميزة'
        },
        de: {
            label: 'VIP Lounge',
            description: 'Exklusive private Styling-Suite mit Premium-Annehmlichkeiten'
        }
    }
}, {
    id: 'royal-shave',
    icon: '👑',
    translations: {
        en: {
            label: 'Royal Shave',
            description: 'Luxury hot towel shave with premium grooming ritual'
        },
        tr: {
            label: 'Kraliyet Tıraşı',
            description: 'Premium bakım ritueli ile lüks sıcak havlu tıraşı'
        },
        ar: {
            label: 'الحلاقة الملكية',
            description: 'حلاقة فاخرة بالمنشفة الساخنة مع طقوس العناية المتميزة'
        },
        de: {
            label: 'Royal Rasur',
            description: 'Luxuriöse Heißtuch-Rasur mit Premium-Pflegeritual'
        }
    }
}, {
    id: 'hair-tattoo',
    icon: '✂️',
    translations: {
        en: {
            label: 'Hair Tattoo',
            description: 'Artistic hair designs and precision pattern work'
        },
        tr: {
            label: 'Saç Dövmesi',
            description: 'Artistik saç tasarımları ve hassas desen çalışması'
        },
        ar: {
            label: 'وشم الشعر',
            description: 'تصاميم شعر فنية وعمل أنماط دقيقة'
        },
        de: {
            label: 'Haar-Tattoo',
            description: 'Künstlerische Haardesigns und Präzisionsmusterarbeit'
        }
    }
}, {
    id: 'color-master',
    icon: '🎨',
    translations: {
        en: {
            label: 'Color Master',
            description: 'Advanced hair coloring and creative color techniques'
        },
        tr: {
            label: 'Renk Ustası',
            description: 'İleri seviye saç boyama ve yaratıcı renk teknikleri'
        },
        ar: {
            label: 'سيد الألوان',
            description: 'تقنيات متقدمة لتلوين الشعر وتقنيات الألوان الإبداعية'
        },
        de: {
            label: 'Farb-Meister',
            description: 'Fortgeschrittene Haarfärbung und kreative Farbtechniken'
        }
    }
}, {
    id: 'texture-expert',
    icon: '💫',
    translations: {
        en: {
            label: 'Texture Expert',
            description: 'Specialized in all hair textures and curl patterns'
        },
        tr: {
            label: 'Doku Uzmanı',
            description: 'Tüm saç dokuları ve bukle desenlerinde uzmanlaşmış'
        },
        ar: {
            label: 'خبير النسيج',
            description: 'متخصص في جميع أنواع نسيج الشعر وأنماط التجعيد'
        },
        de: {
            label: 'Textur-Experte',
            description: 'Spezialisiert auf alle Haartexturen und Lockenmuster'
        }
    }
}, {
    id: 'scalp-specialist',
    icon: '👨‍⚕️',
    translations: {
        en: {
            label: 'Scalp Specialist',
            description: 'Expert scalp treatments and hair loss solutions'
        },
        tr: {
            label: 'Saç Derisi Uzmanı',
            description: 'Uzman saç derisi tedavileri ve saç dökülmesi çözümleri'
        },
        ar: {
            label: 'أخصائي فروة الرأس',
            description: 'علاجات فروة الرأس الخبيرة وحلول تساقط الشعر'
        },
        de: {
            label: 'Kopfhaut-Spezialist',
            description: 'Experten-Kopfhautbehandlungen und Haarausfallslösungen'
        }
    }
}, {
    id: 'extension-pro',
    icon: '💁‍♀️',
    translations: {
        en: {
            label: 'Extension Pro',
            description: 'Professional hair extension services and maintenance'
        },
        tr: {
            label: 'Kaynak Uzmanı',
            description: 'Profesyonel saç kaynak hizmetleri ve bakımı'
        },
        ar: {
            label: 'محترف التمديد',
            description: 'خدمات تمديد الشعر المحترفة والصيانة'
        },
        de: {
            label: 'Extensions-Profi',
            description: 'Professionelle Haarverlängerungsservices und Wartung'
        }
    }
}, {
    id: 'bridal-expert',
    icon: '👰',
    translations: {
        en: {
            label: 'Bridal Expert',
            description: 'Specialized wedding and event hair styling services'
        },
        tr: {
            label: 'Gelin Uzmanı',
            description: 'Özel düğün ve etkinlik saç şekillendirme hizmetleri'
        },
        ar: {
            label: 'خبير العرائس',
            description: 'خدمات تصفيف شعر متخصصة للزفاف والمناسبات'
        },
        de: {
            label: 'Braut-Experte',
            description: 'Spezialisierte Hochzeits- und Event-Frisurenservices'
        }
    }
}, {
    id: 'trend-setter',
    icon: '🌟',
    translations: {
        en: {
            label: 'Trend Setter',
            description: 'Latest fashion trends and innovative styling techniques'
        },
        tr: {
            label: 'Trend Belirleyici',
            description: 'En son moda trendleri ve yenilikçi şekillendirme teknikleri'
        },
        ar: {
            label: 'صانع الاتجاهات',
            description: 'أحدث صيحات الموضة وتقنيات التصفيف المبتكرة'
        },
        de: {
            label: 'Trendsetter',
            description: 'Neueste Modetrends und innovative Styling-Techniken'
        }
    }
},
    {
        id: 'precision-fade',
        icon: '✂️',
        translations: {
            en: {
                label: 'Precision Fade',
                description: 'Specialized in perfect gradual fades and blends'
            },
            tr: {
                label: 'Hassas Fade',
                description: 'Mükemmel aşamalı geçişler ve harmanlamalarda uzmanlaşmış'
            },
            ar: {
                label: 'فيد دقيق',
                description: 'متخصص في التلاشي التدريجي المثالي والمزج'
            },
            de: {
                label: 'Präzisions-Fade',
                description: 'Spezialisiert auf perfekte graduelle Übergänge und Abstufungen'
            }
        }
    }, {
        id: 'luxury-spa',
        icon: '💆‍♂️',
        translations: {
            en: {
                label: 'Luxury Hair Spa',
                description: 'Premium hair spa treatments with massage and aromatherapy'
            },
            tr: {
                label: 'Lüks Saç Spa',
                description: 'Masaj ve aromaterapi ile premium saç spa tedavileri'
            },
            ar: {
                label: 'سبا الشعر الفاخر',
                description: 'علاجات سبا الشعر الممتازة مع التدليك والعلاج بالعطور'
            },
            de: {
                label: 'Luxus-Haar-Spa',
                description: 'Premium-Haar-Spa-Behandlungen mit Massage und Aromatherapie'
            }
        }
    }, {
        id: 'keratin-specialist',
        icon: '✨',
        translations: {
            en: {
                label: 'Keratin Specialist',
                description: 'Expert in keratin treatments and hair smoothing services'
            },
            tr: {
                label: 'Keratin Uzmanı',
                description: 'Keratin tedavileri ve saç düzleştirme hizmetlerinde uzman'
            },
            ar: {
                label: 'أخصائي الكيراتين',
                description: 'خبير في علاجات الكيراتين وخدمات تنعيم الشعر'
            },
            de: {
                label: 'Keratin-Spezialist',
                description: 'Experte für Keratin-Behandlungen und Haar-Glättungs-Services'
            }
        }
    }, {
        id: 'mens-styling',
        icon: '👨',
        translations: {
            en: {
                label: 'Men\'s Styling',
                description: 'Contemporary men\'s hairstyling and grooming services'
            },
            tr: {
                label: 'Erkek Stilist',
                description: 'Çağdaş erkek saç şekillendirme ve bakım hizmetleri'
            },
            ar: {
                label: 'تصفيف الرجال',
                description: 'خدمات تصفيف وتجميل الشعر العصرية للرجال'
            },
            de: {
                label: 'Herren-Styling',
                description: 'Zeitgemäße Herrenfrisuren und Pflegeservices'
            }
        }
    }, {
        id: 'balayage-expert',
        icon: '🎨',
        translations: {
            en: {
                label: 'Balayage Expert',
                description: 'Specialized in hand-painted highlights and color effects'
            },
            tr: {
                label: 'Balayage Uzmanı',
                description: 'Elle boyanan röfleler ve renk efektlerinde uzmanlaşmış'
            },
            ar: {
                label: 'خبير البالياج',
                description: 'متخصص في الإبراز اليدوي وتأثيرات الألوان'
            },
            de: {
                label: 'Balayage-Experte',
                description: 'Spezialisiert auf handgemalte Highlights und Farbeffekte'
            }
        }
    }, {
        id: 'japanese-straightening',
        icon: '🎌',
        translations: {
            en: {
                label: 'Japanese Straightening',
                description: 'Permanent thermal reconditioning and straightening'
            },
            tr: {
                label: 'Japon Düzleştirme',
                description: 'Kalıcı termal yeniden şartlandırma ve düzleştirme'
            },
            ar: {
                label: 'التنعيم الياباني',
                description: 'إعادة التكييف الحراري الدائم والتنعيم'
            },
            de: {
                label: 'Japanische Glättung',
                description: 'Permanente thermische Restrukturierung und Glättung'
            }
        }
    }, {
        id: 'wedding-specialist',
        icon: '👰',
        translations: {
            en: {
                label: 'Wedding Specialist',
                description: 'Complete bridal party styling and special event services'
            },
            tr: {
                label: 'Düğün Uzmanı',
                description: 'Eksiksiz gelin grubu stillendirme ve özel etkinlik hizmetleri'
            },
            ar: {
                label: 'أخصائي الزفاف',
                description: 'خدمات تصفيف حفلات الزفاف الكاملة والمناسبات الخاصة'
            },
            de: {
                label: 'Hochzeits-Spezialist',
                description: 'Komplettes Brautparty-Styling und Services für besondere Anlässe'
            }
        }
    }, {
        id: 'dreadlock-specialist',
        icon: '🔒',
        translations: {
            en: {
                label: 'Dreadlock Specialist',
                description: 'Expert installation and maintenance of all dreadlock styles'
            },
            tr: {
                label: 'Rasta Uzmanı',
                description: 'Tüm rasta stillerinin uzman kurulumu ve bakımı'
            },
            ar: {
                label: 'أخصائي الضفائر',
                description: 'تركيب وصيانة احترافية لجميع أنماط الضفائر'
            },
            de: {
                label: 'Dreadlock-Spezialist',
                description: 'Experten-Installation und Pflege aller Dreadlock-Stile'
            }
        }
    }, {
        id: 'kids-first-cut',
        icon: '🎈',
        translations: {
            en: {
                label: 'Kids First Cut',
                description: 'Specialized in first haircuts and children\'s styling'
            },
            tr: {
                label: 'İlk Kesim',
                description: 'İlk saç kesimi ve çocuk stillerinde uzmanlaşmış'
            },
            ar: {
                label: 'أول قصة للأطفال',
                description: 'متخصص في قصات الشعر الأولى وتصفيف الأطفال'
            },
            de: {
                label: 'Erster Kinderhaarschnitt',
                description: 'Spezialisiert auf erste Haarschnitte und Kinderfrisuren'
            }
        }
    }, {
        id: 'perm-specialist',
        icon: '🌀',
        translations: {
            en: {
                label: 'Perm Specialist',
                description: 'Expert in modern perms and wave treatments'
            },
            tr: {
                label: 'Perma Uzmanı',
                description: 'Modern perma ve dalga tedavilerinde uzman'
            },
            ar: {
                label: 'أخصائي البيرم',
                description: 'خبير في البيرم الحديث وعلاجات التمويج'
            },
            de: {
                label: 'Dauerwellen-Spezialist',
                description: 'Experte für moderne Dauerwellen und Wellenbehandlungen'
            }
        }
    }];

const translations = {
    en: {
        title: 'Shop Categories',
        selectHint: 'Select at least one category',
        showMore: 'Show More',
        showLess: 'Show Less',
        required: 'Please select at least one category',
        searchPlaceholder: 'Search categories...',
        clearSearch: 'Clear search',
        noResults: 'No categories found'
    },
    tr: {
        title: 'Dükkan Kategorileri',
        selectHint: 'En az bir kategori seçin',
        showMore: 'Daha Fazla Göster',
        showLess: 'Daha Az Göster',
        required: 'Lütfen en az bir kategori seçin',
        searchPlaceholder: 'Kategorilerde ara...',
        clearSearch: 'Aramayı temizle',
        noResults: 'Kategori bulunamadı'
    },
    ar: {
        title: 'فئات المحل',
        selectHint: 'اختر فئة واحدة على الأقل',
        showMore: 'عرض المزيد',
        showLess: 'عرض أقل',
        required: 'الرجاء اختيار فئة واحدة على الأقل',
        searchPlaceholder: 'البحث في الفئات...',
        clearSearch: 'مسح البحث',
        noResults: 'لم يتم العثور على فئات'
    },
    de: {
        title: 'Geschäftskategorien',
        selectHint: 'Wählen Sie mindestens eine Kategorie',
        showMore: 'Mehr Anzeigen',
        showLess: 'Weniger Anzeigen',
        required: 'Bitte wählen Sie mindestens eine Kategorie',
        searchPlaceholder: 'Kategorien durchsuchen...',
        clearSearch: 'Suche löschen',
        noResults: 'Keine Kategorien gefunden'
    }
};

const containerVariants = {
    hidden: {opacity: 0},
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: {y: 20, opacity: 0},
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 24
        }
    }
};

const ShopCategorySelector = ({value = [], onChange, error}) => {
    const {language} = useContext(LanguageContext);
    const [isExpanded, setIsExpanded] = useState(false);
    const [filteredCategories, setFilteredCategories] = useState(SHOP_CATEGORIES);
    const [searchTerm, setSearchTerm] = useState('');
    const [columns, setColumns] = useState(1);
    const t = translations[language];

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 640) setColumns(1);
            else if (width < 1024) setColumns(2);
            else if (width < 1280) setColumns(3);
            else setColumns(4);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const filtered = SHOP_CATEGORIES.filter(category =>
            category.translations[language].label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            category.translations[language].description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredCategories(filtered);
    }, [searchTerm, language]);

    const handleSelect = (categoryId) => {
        const newValue = value.includes(categoryId)
            ? value.filter(id => id !== categoryId)
            : [...value, categoryId];
        onChange(newValue);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <label className="block text-sm font-medium">
                    {t.title}
                    <span className="text-error">*</span>
                </label>
                <div className="relative w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        className="input input-bordered w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <motion.button
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                            whileHover={{scale: 1.1}}
                            whileTap={{scale: 0.9}}
                            onClick={() => setSearchTerm('')}
                        >
                            ✕
                        </motion.button>
                    )}
                </div>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="relative"
            >
                <div className="relative">
                    <motion.div
                        layout
                        className={`grid gap-3 ${!isExpanded ? 'max-h-[400px] overflow-y-auto pr-2' : ''}`}
                        style={{
                            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'var(--primary) transparent'
                        }}
                    >
                        {filteredCategories.map(category => {
                            const isSelected = value.includes(category.id);
                            return (
                                <motion.button
                                    key={category.id}
                                    variants={itemVariants}
                                    layout
                                    onClick={() => handleSelect(category.id)}
                                    className={`
                                        relative p-4 rounded-lg text-left transition-all duration-300
                                        ${isSelected ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300'}
                                        group flex flex-col gap-3 overflow-hidden
                                    `}
                                    whileHover={{scale: 1.02, y: -2}}
                                    whileTap={{scale: 0.98}}
                                >
                                    <AnimatePresence>
                                        {isSelected && (
                                            <motion.div
                                                initial={{scale: 0, rotate: -180}}
                                                animate={{scale: 1, rotate: 0}}
                                                exit={{scale: 0, rotate: 180}}
                                                className="absolute right-2 top-2"
                                            >
                                                <CheckCircle className="w-5 h-5"/>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <span className="text-3xl">{category.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-sm">
                                            {category.translations[language].label}
                                        </h3>
                                        {isExpanded && (
                                            <motion.p
                                                initial={{opacity: 0, height: 0}}
                                                animate={{opacity: 1, height: 'auto'}}
                                                exit={{opacity: 0, height: 0}}
                                                className="text-xs opacity-70 mt-1"
                                            >
                                                {category.translations[language].description}
                                            </motion.p>
                                        )}
                                    </div>

                                    <motion.div
                                        className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-10"
                                        initial={false}
                                        whileHover={{opacity: 0.1}}
                                    />
                                </motion.button>
                            );
                        })}
                    </motion.div>

                    {filteredCategories.length > 6 && (
                        <motion.button
                            layout
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full h-12 flex items-center justify-center text-sm mt-4 group"
                            whileHover={{scale: 1.02}}
                            whileTap={{scale: 0.98}}
                        >
                            <span>{isExpanded ? t.showLess : t.showMore}</span>
                            <motion.span
                                animate={{rotate: isExpanded ? 180 : 0}}
                                transition={{duration: 0.3}}
                                className="ml-2 group-hover:translate-y-0.5 transition-transform"
                            >
                                ▼
                            </motion.span>
                        </motion.button>
                    )}
                </div>
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.p
                        initial={{opacity: 0, y: -10}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -10}}
                        className="text-sm text-error mt-2 flex items-center gap-2"
                    >
                        <TagIcon className="w-4 h-4"/>
                        {t.required}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ShopCategorySelector;