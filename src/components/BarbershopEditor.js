import React, {useEffect, useRef, useState} from 'react';
import {Editor} from '@tinymce/tinymce-react';
import {ArrowBigDown, Book, HelpCircle, Layout, Scissors} from 'lucide-react';
import {AnimatePresence, motion} from 'framer-motion';
import RightAlignedFullscreenWrapper from "./RightAlignedFullscreenWrapper";

const BARBERSHOP_TEMPLATES = [
    {
        title: 'Classic Professional',
        description: 'Traditional, upscale barbershop',
        id: 'classic',
        content: `
      <div class="shop-description">
        <h2 class="main-title">Welcome to [Your Shop Name]</h2>
        <p class="intro">Step into a world of timeless grooming and professional service. With [X] years of expertise, we blend traditional barbering with modern style.</p>
        
        <h3 class="section-title">Our Expertise</h3>
        <ul class="feature-list">
          <li>✂️ Traditional haircuts & modern styles</li>
          <li>✂️ Expert beard grooming & shaping</li>
          <li>✂️ Professional hot towel shaves</li>
          <li>✂️ Premium hair treatments</li>
        </ul>

        <h3 class="section-title">The Experience</h3>
        <ul class="highlight-list">
          <li>✓ Master barbers with years of experience</li>
          <li>✓ Premium products and tools</li>
          <li>✓ Clean, comfortable environment</li>
          <li>✓ Attention to detail</li>
        </ul>

        <div class="location-section">
          <h3 class="section-title">Visit Us</h3>
          <p>Located in [your area], we offer a welcoming atmosphere where you can relax and trust in expert care.</p>
        </div>
      </div>
    `
    },
    {
        title: 'Modern Studio',
        description: 'Contemporary style hub',
        id: 'modern',
        content: `
      <div class="shop-description">
        <h2 class="main-title">Experience [Your Shop Name]</h2>
        <p class="intro">Your destination for contemporary style and expert grooming. We're not just barbers - we're style consultants dedicated to your look.</p>

        <h3 class="section-title">Signature Services</h3>
        <ul class="feature-list">
          <li>🔥 Custom fade techniques</li>
          <li>🔥 Modern beard design</li>
          <li>🔥 Precision haircuts</li>
          <li>🔥 Style consultation</li>
        </ul>

        <div class="experience-section">
          <h3 class="section-title">Premium Experience</h3>
          <ul class="highlight-list">
            <li>✓ Personal style consultation</li>
            <li>✓ Relaxing scalp massage</li>
            <li>✓ Professional styling</li>
            <li>✓ Grooming advice</li>
          </ul>
        </div>

        <div class="commitment-section">
          <h3 class="section-title">Our Commitment</h3>
          <p>We stay ahead of trends while maintaining the highest standards of service.</p>
        </div>
      </div>
    `
    },
    {
        title: 'Family Barbershop',
        description: 'Welcoming, family-friendly',
        id: 'family',
        content: `
      <div class="shop-description">
        <h2 class="main-title">[Your Shop Name] - Family Barbershop</h2>
        <p class="intro">A trusted neighborhood barbershop serving families and clients of all ages. We create a welcoming environment where everyone feels at home.</p>

        <h3 class="section-title">Services for Everyone</h3>
        <ul class="feature-list">
          <li>👨 Men's haircuts</li>
          <li>👦 Children's haircuts</li>
          <li>👴 Senior styling</li>
          <li>👨‍👦 Family packages</li>
        </ul>

        <div class="promise-section">
          <h3 class="section-title">Our Promise</h3>
          <ul class="highlight-list">
            <li>✓ Patient, friendly service</li>
            <li>✓ Family-friendly atmosphere</li>
            <li>✓ Affordable prices</li>
            <li>✓ Convenient scheduling</li>
          </ul>
        </div>

        <div class="welcome-section">
          <h3 class="section-title">Visit Us</h3>
          <p>Bring the whole family to [Your Shop Name]. We ensure everyone leaves looking and feeling their best.</p>
        </div>
      </div>
    `
    }
];

const BarbershopEditor = ({
                              language,
                              value,
                              onChange,
                              user
                          }) => {
    // const [showHelp, setShowHelp] = useState(true);
    const [showTemplates, setShowTemplates] = useState(false);
    const editorRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showHelp, setShowHelp] = useState(window.innerWidth >= 1049);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1049px)');

        const handleResize = (e) => {
            setShowHelp(e.matches);
        };

        mediaQuery.addListener(handleResize);
        return () => mediaQuery.removeListener(handleResize);
    }, []);

    const buttonClass = `btn btn-circle btn-primary shadow-lg ${
        window.innerWidth < 1049 ? 'animate-[shimmer_2s_ease-in-out_infinite]' : ''
    }`;

    const shimmerAnimation = `
       @keyframes shimmer {
           0% { opacity: 0.7 }
           50% { opacity: 1 }
           100% { opacity: 0.7 }
       }
   `;

    const handleTemplateSelect = (template) => {
        onChange(template.content);
        setShowTemplates(false);
    };

    const editorConfig = {
        min_height: isFullscreen ? window.innerHeight - 100 : 500,
        menubar: false,
        language: language === 'tr' ? 'tr' : language === 'ar' ? 'ar' : language === 'de' ? 'de' : 'en',
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'preview',
            'searchreplace', 'visualblocks', 'help', 'wordcount'
        ],
        toolbar: [
            'styles | bold italic underline | alignleft aligncenter alignright |',
            'bullist numlist | removeformat | undo redo'
        ].join(' '),
        content_style: `
      body {
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 16px;
        line-height: 1.6;
        padding: 1rem;
        background: #fff;
      }
      .shop-description {
        width: 100%;
        margin: 0;
      }
      .main-title {
        font-size: 2em;
        color: #1a1a1a;
        margin-bottom: 1em;
        border-bottom: 2px solid #eaeaea;
        padding-bottom: 0.5em;
      }
      .section-title {
        font-size: 1.4em;
        color: #333;
        margin: 1.5em 0 0.8em;
      }
      .intro {
        font-size: 1.1em;
        color: #555;
        margin-bottom: 1.5em;
      }
      .feature-list, .highlight-list {
        list-style: none;
        padding: 0;
        margin: 1em 0;
      }
      .feature-list li, .highlight-list li {
        margin: 0.8em 0;
        padding-left: 1.8em;
        position: relative;
      }
      .feature-list li:before {
        content: "";
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
      }
      .mce-content-body {
        margin: 0;
      }
    `,
        formats: {
            h2: {block: 'h2', classes: 'main-title'},
            h3: {block: 'h3', classes: 'section-title'},
            p: {block: 'p', classes: 'content-text'}
        },
        style_formats: [
            {title: 'Main Title', format: 'h2'},
            {title: 'Section Title', format: 'h3'},
            {title: 'Paragraph', format: 'p'}
        ],
        placeholder: language === 'tr' ? 'Salonunuzu profesyonel bir şekilde tanıtın...' :
            language === 'ar' ? 'قدم صالونك بشكل احترافي...' :
                language === 'de' ? 'Präsentieren Sie Ihren Salon professionell...' :
                    'Present your salon professionally...',
        directionality: language === 'ar' ? 'rtl' : 'ltr'
    };

    return (
        <>
            <style>{shimmerAnimation}</style>

            <div className="relative">
                <div className="mb-4 flex items-center justify-between">
                    <motion.button
                        className="btn btn-outline gap-2"
                        onClick={() => setShowTemplates(true)}
                        whileHover={{scale: 1.02}}
                        whileTap={{scale: 0.98}}
                    >
                        <ArrowBigDown className="w-4 h-4"/>
                        {language === 'tr' ? 'Şablon Seç' :
                            language === 'ar' ? 'اختر قالبًا' :
                                language === 'de' ? 'Vorlage wählen' :
                                    'Choose Template'}
                    </motion.button>
                </div>

                <AnimatePresence>
                    {showTemplates && (
                        <motion.div
                            initial={{opacity: 0, y: -20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            className="absolute z-40 top-12 left-0 right-0 bg-base-100 rounded-lg shadow-xl border border-base-200 p-4"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Select a Template</h3>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setShowTemplates(false)}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {BARBERSHOP_TEMPLATES.map((template) => (
                                    <motion.div
                                        key={template.id}
                                        className="p-4 border rounded-lg cursor-pointer hover:border-primary"
                                        whileHover={{scale: 1.02}}
                                        whileTap={{scale: 0.98}}
                                        onClick={() => handleTemplateSelect(template)}
                                    >
                                        <h4 className="font-semibold mb-2">{template.title}</h4>
                                        <p className="text-sm text-base-content/70">{template.description}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <RightAlignedFullscreenWrapper
                    editorRef={editorRef}
                    isFullscreen={isFullscreen}
                    setIsFullscreen={setIsFullscreen}
                >
                    <Editor
                        apiKey="6eke8w2nyjpg9rotzvxhe9klva3y1xetkxmbp50pjy5klfjb"
                        value={value}
                        onEditorChange={onChange}
                        init={editorConfig}
                    />
                </RightAlignedFullscreenWrapper>


                <div className="fixed bottom-4 right-4 z-40">
                    <motion.button
                        className="btn btn-circle btn-primary shadow-lg"
                        whileHover={{scale: 1.05}}
                        whileTap={{scale: 0.95}}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowHelp(!showHelp);
                        }}
                    >
                        <motion.div
                            animate={{
                                opacity: [0.6, 1, 0.6],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            <HelpCircle className="w-6 h-6"/>
                        </motion.div>
                    </motion.button>

                    <AnimatePresence>
                        {showHelp && (
                            <motion.div
                                initial={{opacity: 0, y: 20, scale: 0.95}}
                                animate={{opacity: 1, y: 0, scale: 1}}
                                exit={{opacity: 0, y: 20, scale: 0.95}}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30
                                }}
                                className="absolute bottom-16 right-0 w-80 bg-base-100 rounded-lg shadow-xl border border-base-200"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <div className="p-4">
                                    <h3 className="text-lg font-semibold mb-3">Tips for Success</h3>
                                    <ul className="space-y-3">
                                        <li className="flex items-center gap-2">
                                            <ArrowBigDown className="w-4 h-4 text-primary"/>
                                            Start with a professional template
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Layout className="w-4 h-4 text-primary"/>
                                            Keep sections clear and organized
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Scissors className="w-4 h-4 text-primary"/>
                                            Highlight your unique services
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Book className="w-4 h-4 text-primary"/>
                                            Include business hours and policies
                                        </li>
                                    </ul>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </>
    );
};

export default BarbershopEditor;