import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {AnimatePresence, motion} from 'framer-motion';
import {doc, getDoc, serverTimestamp, writeBatch} from 'firebase/firestore';
import {db, storage} from '../firebase';
import {getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {nanoid} from 'nanoid';
import EmployeeForm from './EmployeeForm';
import {Camera, Scissors, X} from 'lucide-react';
import {useDropzone} from 'react-dropzone';
import Swal from 'sweetalert2';
import ImageCropModal from "./ImageCropModal";
import {useLanguage} from '../components/LanguageContext';
import confetti from "canvas-confetti";

const EmployeeRegisterPage = () => {
    const {shopId, token} = useParams();
    const navigate = useNavigate();
    const [shop, setShop] = useState(null);
    // const [isLoading, setIsLoading] = useState(true);
    const [isTokenValid, setIsTokenValid] = useState(false);

    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const [targetShopRef, setTargetShopRef] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const {language} = useLanguage();

    const onDrop = acceptedFiles => {
        const file = acceptedFiles[0];
        if (file) {
            setSelectedImage(URL.createObjectURL(file));
            setCropModalOpen(true);
        }
    };

    const handleCropComplete = (croppedFile) => {
        setCurrentEmployee({
            ...currentEmployee,
            photo: croppedFile
        });
    };

    const [currentEmployee, setCurrentEmployee] = useState({
        name: '',
        photo: null,
        expertise: [],
        schedule: {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        }
    });

    const {getRootProps, getInputProps} = useDropzone({
        accept: 'image/*',
        onDrop,
        multiple: false
    });
    useEffect(() => {
        const validateToken = async () => {
            try {
                console.log('Starting validation with shopId:', shopId);
                const tempShopDoc = await getDoc(doc(db, 'tempShops', shopId));
                console.log('TempShop data:', tempShopDoc.data());

                let targetDoc;
                let targetShopId = shopId;
                let targetCollection = 'barberShops';

                if (tempShopDoc.exists() && tempShopDoc.data().publishedShopId) {
                    console.log('Found publishedShopId:', tempShopDoc.data().publishedShopId);
                    targetShopId = tempShopDoc.data().publishedShopId;
                    targetDoc = await getDoc(doc(db, 'barberShops', targetShopId));
                    console.log('BarberShop data from publishedShopId:', targetDoc.data());
                } else {
                    console.log('No publishedShopId, checking barberShops directly');
                    targetDoc = await getDoc(doc(db, 'barberShops', shopId));
                    if (!targetDoc.exists()) {
                        console.log('No barberShop found, falling back to tempShop');
                        targetDoc = tempShopDoc;
                        targetCollection = 'tempShops';
                    }
                }

                console.log('Final target collection:', targetCollection);
                console.log('Final target shopId:', targetShopId);
                console.log('Target doc exists:', targetDoc.exists());

                if (!targetDoc.exists()) {
                    console.error('No valid shop document found!');
                    throw new Error('Shop not found');
                }

                const shopData = targetDoc.data();
                console.log('Shop data:', shopData);
                setShop(shopData);
                setTargetShopRef(doc(db, targetCollection, targetShopId));
                console.log('Set targetShopRef to:', `${targetCollection}/${targetShopId}`);

                const tokenData = shopData.employeeRegistrationTokens?.[token];
                console.log('Token data:', tokenData);

                if (!tokenData) {
                    console.error('Token not found in shop data');
                    throw new Error('Invalid token');
                }

                const expiryDate = tokenData.expires.toDate();
                console.log('Token expiry:', expiryDate, 'Current time:', new Date());

                if (expiryDate < new Date()) {
                    console.error('Token expired');
                    throw new Error('Token expired');
                }
                if (tokenData.used) {
                    console.error('Token already used by:', tokenData.usedBy);
                    throw new Error('Token already used');
                }

                console.log('Token validation successful');
                setIsTokenValid(true);
            } catch (error) {
                console.error('Detailed validation error:', error);
                console.error('Error stack:', error.stack);
                Swal.fire({
                    title: 'Error',
                    text: 'This registration link is invalid or has expired.',
                    icon: 'error'
                }).then(() => navigate('/'));
            } finally {
                setIsLoading(false);
            }
        };

        validateToken();
    }, [shopId, token, navigate]);

    const handleSubmit = async () => {
        try {
            setIsLoading(true); // This will show scissors loader since we already have the conditional render
            console.log('Starting submit with targetShopRef:', targetShopRef?.path);

            const photoRef = ref(storage, `shops/${targetShopRef.id}/employees/${currentEmployee.name}-${nanoid(6)}`);
            console.log('Uploading photo to:', photoRef.fullPath);
            await uploadBytes(photoRef, currentEmployee.photo);
            const photoUrl = await getDownloadURL(photoRef);
            console.log('Photo uploaded, URL:', photoUrl);

            const newEmployee = {
                ...currentEmployee,
                id: nanoid(),
                photo: photoUrl,
                registeredAt: new Date(),
                registrationToken: token
            };
            console.log('New employee data:', newEmployee);

            const batch = writeBatch(db);
            console.log('Adding employee to:', targetShopRef.path);

            // Get current employees first
            const currentDoc = await getDoc(targetShopRef);
            const currentEmployees = currentDoc.data()?.employees || [];
            console.log('Current employees:', currentEmployees);

            batch.update(targetShopRef, {
                employees: [...currentEmployees, newEmployee],
                [`employeeRegistrationTokens.${token}`]: {
                    used: true,
                    usedBy: newEmployee.id,
                    status: 'completed',
                    completedAt: serverTimestamp()
                }
            });

            console.log('Committing batch write...');
            await batch.commit();
            console.log('Batch write successful');

            setIsLoading(false); // Hide scissors loader
            fireWorkConfetti(); // Trigger confetti
            setShowSuccess(true); // Show success message

            // Wait for animations to complete before navigating
            setTimeout(() => {
                navigate('/registration-success');
            }, 8000);

        } catch (error) {
            console.error('Submit error:', error);
            console.error('Error stack:', error.stack);
            console.error('TargetShopRef state:', targetShopRef);
            setIsLoading(false);
            throw error;
        }
    };


    const fireWorkConfetti = () => {
        const colors = ['#FFC0CB', '#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C'];
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = {startVelocity: 20, spread: 180, ticks: 100, zIndex: 0};

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 30 * (timeLeft / duration);

            confetti({
                ...defaults,
                particleCount,
                origin: {x: randomInRange(0.2, 0.4), y: Math.random() - 0.2},
                colors: colors.slice(0, 3)
            });
            confetti({
                ...defaults,
                particleCount,
                origin: {x: randomInRange(0.6, 0.8), y: Math.random() - 0.2},
                colors: colors.slice(2)
            });
        }, 400);
    };

// Add the Scissors Loader component
    const ScissorsLoader = ({message}) => (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-base-100 rounded-lg p-8 shadow-xl flex flex-col items-center gap-4">
                <Scissors className="w-12 h-12 animate-[spin_2s_linear_infinite]"/>
                <p className="text-lg font-medium">{message}</p>
            </div>
        </div>
    );

    const SuccessMessage = ({language}) => {
        const translations = {
            en: {
                title: "Successfully Registered!",
                message: "You are now registered as an employee. Ask your store admin for the store URL to start getting bookings."
            },
            tr: {
                title: "Başarıyla Kaydoldunuz!",
                message: "Artık bir çalışan olarak kayıtlısınız. Randevu almaya başlamak için mağaza yöneticinizden mağaza URL'sini isteyin."
            },
            ar: {
                title: "تم التسجيل بنجاح!",
                message: "أنت الآن مسجل كموظف. اطلب من مدير المتجر عنوان URL للمتجر للبدء في تلقي الحجوزات."
            },
            de: {
                title: "Erfolgreich registriert!",
                message: "Sie sind jetzt als Mitarbeiter registriert. Fragen Sie Ihren Store-Administrator nach der Store-URL, um Buchungen zu erhalten."
            }
        };

        return (
            <motion.div
                initial={{opacity: 0, scale: 0.9}}
                animate={{opacity: 1, scale: 1}}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-40"
            >
                <div className="bg-base-100 rounded-2xl shadow-2xl p-6 md:p-8 max-w-3xl w-full">
                    <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(translations).map(([lang, text], i) => (
                            <motion.div
                                key={lang}
                                initial={{opacity: 0, y: 20}}
                                animate={{opacity: 1, y: 0}}
                                transition={{delay: i * 0.2}}
                                className="text-center space-y-4"
                            >
                                <h2 className={`text-2xl font-bold text-primary ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
                                    {text.title}
                                </h2>
                                <p className={`text-base text-base-content/80 ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
                                    {text.message}
                                </p>
                            </motion.div>
                        ))}
                    </motion.div>
                    <div className="mt-8 w-full h-1 bg-primary/20 rounded-full overflow-hidden">
                        <motion.div
                            initial={{width: 0}}
                            animate={{width: "100%"}}
                            transition={{duration: 5}}
                            className="h-full bg-primary"
                        />
                    </div>
                </div>
            </motion.div>
        );
    };


    // if (isLoading) {
    //     return (
    //         <div className="min-h-screen flex items-center justify-center">
    //             <div className="text-center">
    //                 <span className="loading loading-spinner loading-lg"></span>
    //                 <p className="mt-4">Validating registration link...</p>
    //             </div>
    //         </div>
    //     );
    // }

    if (!isTokenValid) return null;

    return (
        <div className="min-h-screen bg-base-100 py-12 px-4">
            <AnimatePresence>
                {!showSuccess && (
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -20}}
                        className="max-w-3xl mx-auto space-y-8"
                    >
                        <div className="text-center">
                            <motion.h1
                                initial={{opacity: 0}}
                                animate={{opacity: 1}}
                                className="text-3xl font-bold mb-2"
                            >
                                Join {shop.name}
                            </motion.h1>
                            <p className="text-base-content/70">
                                Complete your profile to join the team
                            </p>
                        </div>

                        <div className="card bg-base-100 shadow-xl">
                            <div className="card-body space-y-6">
                                {/* Name Input */}
                                <div>
                                    <label className="label">
                                        <span className="label-text">Your Name</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full"
                                        value={currentEmployee.name}
                                        onChange={e => setCurrentEmployee({
                                            ...currentEmployee,
                                            name: e.target.value
                                        })}
                                        placeholder="Enter your full name"
                                    />
                                </div>

                                {/* Photo Upload */}
                                <div>
                                    <label className="label">
                                        <span className="label-text">Your Photo</span>
                                    </label>
                                    <div {...getRootProps()}
                                         className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                                    >
                                        <input {...getInputProps()} />
                                        <motion.div
                                            initial={{opacity: 0}}
                                            animate={{opacity: 1}}
                                            className="relative inline-block"
                                        >
                                            {currentEmployee.photo ? (
                                                <>
                                                    <img
                                                        src={URL.createObjectURL(currentEmployee.photo)}
                                                        alt="Preview"
                                                        className="w-32 h-32 rounded-lg object-cover"
                                                    />
                                                    <motion.button
                                                        whileHover={{scale: 1.1}}
                                                        whileTap={{scale: 0.9}}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCurrentEmployee({
                                                                ...currentEmployee,
                                                                photo: null
                                                            });
                                                        }}
                                                        className="absolute -top-2 -right-2 bg-base-100 rounded-full shadow-lg p-1"
                                                    >
                                                        <X className="w-4 h-4"/>
                                                    </motion.button>
                                                </>
                                            ) : (
                                                <div className="p-8">
                                                    <Camera className="w-12 h-12 mx-auto text-base-content/40"/>
                                                    <p className="mt-2 text-sm text-base-content/60">
                                                        Upload your professional photo
                                                    </p>
                                                </div>
                                            )}
                                        </motion.div>
                                    </div>
                                </div>

                                {/* Employee Form (Expertise & Schedule) */}
                                <EmployeeForm
                                    employee={currentEmployee}
                                    onUpdate={setCurrentEmployee}
                                    language={language}
                                />

                                {/* Submit Button */}
                                <motion.button
                                    whileHover={{scale: 1.02}}
                                    whileTap={{scale: 0.98}}
                                    className="btn btn-primary w-full"
                                    onClick={handleSubmit}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <span className="loading loading-spinner"></span>
                                    ) : (
                                        'Complete Registration'
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {isLoading && <ScissorsLoader message="Saving your information..." />}
            <AnimatePresence>
                {showSuccess && <SuccessMessage language={language} />}
            </AnimatePresence>

            <ImageCropModal
                isOpen={cropModalOpen}
                onClose={() => setCropModalOpen(false)}
                imageSrc={selectedImage}
                onCropComplete={handleCropComplete}
            />
        </div>
    );
};

export default EmployeeRegisterPage;