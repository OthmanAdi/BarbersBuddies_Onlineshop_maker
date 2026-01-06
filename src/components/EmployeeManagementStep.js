/**
 * @fileoverview EmployeeManagementStep Component
 * 
 * A comprehensive employee management interface for barbershops. Supports both direct 
 * employee addition and self-registration workflows.
 * 
 * Key Features:
 * - Direct employee management with profile details
 * - Self-registration link generation
 * - Employee scheduling
 * - Expertise management
 * - Photo upload and cropping
 * - Multi-language support
 * 
 * Props:
 * @param {string} shopId - Current shop identifier
 * @param {Function} onBack - Handler for navigation back
 * @param {Function} onNext - Handler for navigation forward
 * @param {string} language - Current language selection
 * @param {Function} setFormTouched - Form state handler
 * 
 * @example
 * <EmployeeManagementStep
 *   shopId="shop123"
 *   onBack={handleBack}
 *   onNext={handleNext}
 *   language="en"
 *   setFormTouched={updateFormState}
 * />
 */

import React, {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Calendar, Camera, Check, Link, Scissors, Trash2, UserPlus, Users, X} from 'lucide-react';
import {useDropzone} from 'react-dropzone';
import {nanoid} from 'nanoid';
import {db, storage} from '../firebase';
import {getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {doc, serverTimestamp, setDoc, updateDoc} from 'firebase/firestore';
import EmployeeForm from "./EmployeeForm";
import Swal from "sweetalert2";
import GeneratedLinkSection from "./GeneratedLinkSection";
import ImageCropModal from "./ImageCropModal";
import {createRoot} from "react-dom/client";

const EmployeeManagementStep = ({shopId, onBack, onNext, language = 'en', setFormTouched }) => {
    const [selectedOption, setSelectedOption] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [generatedLinks, setGeneratedLinks] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [copiedLinks, setCopiedLinks] = useState({});
    const [hasSelectedOption, setHasSelectedOption] = useState(false);

    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

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

    // Direct employee management state
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

    const translations = {
        en: {
            title: "Employee Management",
            subtitle: "Choose how you want to manage your employees",
            directOption: "Add Employees Directly",
            selfRegisterOption: "Let Employees Self-Register",
            directDescription: "Add your employees' information, photos, and schedules yourself",
            selfRegisterDescription: "Generate unique links for employees to add their own information",
            optional: "Optional",
            addEmployee: "Add Employee",
            generateLink: "Generate Registration Link",
            employeeName: "Employee Name",
            expertise: "Areas of Expertise",
            schedule: "Work Schedule",
            photoUpload: "Upload Photo",
            save: "Save",
            next: "Continue",
            back: "Back",
            linkGenerated: "Registration link generated",
            copyLink: "Copy Link",
            addAnother: "Add Another Employee",
            finish: "Finish",
            dropzoneText: "Drag and drop photo here or click to select",
            expertiseHint: "Enter expertise areas (e.g., haircuts, coloring)",
            scheduleHint: "Set employee's working hours",
            linkExpiry: "Link expires in 7 days",
            deleteEmployee: "Remove Employee",
            editEmployee: "Edit Employee",
            confirmDelete: "Are you sure you want to remove this employee?",
            photoRequired: "Photo is required",
            nameRequired: "Name is required",
            expertiseRequired: "At least one area of expertise is required",
            scheduleRequired: "Work schedule is required",
            backToSelection: "Back to Selection"
        },
        tr: {
            title: "Çalışan Yönetimi",
            subtitle: "Çalışanlarınızı nasıl yönetmek istediğinizi seçin",
            directOption: "Çalışanları Doğrudan Ekle",
            selfRegisterOption: "Çalışanların Kendilerini Kaydetmesine İzin Ver",
            directDescription: "Çalışanlarınızın bilgilerini, fotoğraflarını ve programlarını kendiniz ekleyin",
            selfRegisterDescription: "Çalışanların kendi bilgilerini ekleyebilmeleri için benzersiz bağlantılar oluşturun",
            optional: "İsteğe Bağlı",
            addEmployee: "Çalışan Ekle",
            generateLink: "Kayıt Bağlantısı Oluştur",
            employeeName: "Çalışan Adı",
            expertise: "Uzmanlık Alanları",
            schedule: "Çalışma Programı",
            photoUpload: "Fotoğraf Yükle",
            save: "Kaydet",
            next: "Devam Et",
            back: "Geri",
            linkGenerated: "Kayıt bağlantısı oluşturuldu",
            copyLink: "Bağlantıyı Kopyala",
            addAnother: "Başka Çalışan Ekle",
            finish: "Bitir",
            dropzoneText: "Fotoğrafı buraya sürükleyin veya seçmek için tıklayın",
            expertiseHint: "Uzmanlık alanlarını girin (örn. saç kesimi, boyama)",
            scheduleHint: "Çalışanın çalışma saatlerini ayarlayın",
            linkExpiry: "Bağlantı 7 gün içinde sona erer",
            deleteEmployee: "Çalışanı Kaldır",
            editEmployee: "Çalışanı Düzenle",
            confirmDelete: "Bu çalışanı kaldırmak istediğinizden emin misiniz?",
            photoRequired: "Fotoğraf gereklidir",
            nameRequired: "İsim gereklidir",
            expertiseRequired: "En az bir uzmanlık alanı gereklidir",
            scheduleRequired: "Çalışma programı gereklidir",
            backToSelection: "Seçim Ekranına Dön"
        },
        ar: {
            title: "إدارة الموظفين",
            subtitle: "اختر كيفية إدارة موظفيك",
            directOption: "إضافة الموظفين مباشرة",
            selfRegisterOption: "السماح للموظفين بالتسجيل الذاتي",
            directDescription: "أضف معلومات موظفيك وصورهم وجداولهم بنفسك",
            selfRegisterDescription: "إنشاء روابط فريدة للموظفين لإضافة معلوماتهم الخاصة",
            optional: "اختياري",
            addEmployee: "إضافة موظف",
            generateLink: "إنشاء رابط التسجيل",
            employeeName: "اسم الموظف",
            expertise: "مجالات الخبرة",
            schedule: "جدول العمل",
            photoUpload: "تحميل الصورة",
            save: "حفظ",
            next: "متابعة",
            back: "رجوع",
            linkGenerated: "تم إنشاء رابط التسجيل",
            copyLink: "نسخ الرابط",
            addAnother: "إضافة موظف آخر",
            finish: "إنهاء",
            dropzoneText: "اسحب وأفلت الصورة هنا أو انقر للاختيار",
            expertiseHint: "أدخل مجالات الخبرة (مثل قص الشعر، الصباغة)",
            scheduleHint: "تعيين ساعات عمل الموظف",
            linkExpiry: "الرابط ينتهي خلال 7 أيام",
            deleteEmployee: "إزالة الموظف",
            editEmployee: "تعديل الموظف",
            confirmDelete: "هل أنت متأكد من رغبتك في إزالة هذا الموظف؟",
            photoRequired: "الصورة مطلوبة",
            nameRequired: "الاسم مطلوب",
            expertiseRequired: "مطلوب مجال خبرة واحد على الأقل",
            scheduleRequired: "جدول العمل مطلوب",
            backToSelection: "العودة إلى شاشة الاختيار"
        },
        de: {
            title: "Mitarbeiterverwaltung",
            subtitle: "Wählen Sie aus, wie Sie Ihre Mitarbeiter verwalten möchten",
            directOption: "Mitarbeiter direkt hinzufügen",
            selfRegisterOption: "Mitarbeiter selbst registrieren lassen",
            directDescription: "Fügen Sie Informationen, Fotos und Zeitpläne Ihrer Mitarbeiter selbst hinzu",
            selfRegisterDescription: "Generieren Sie einzigartige Links für Mitarbeiter, um ihre eigenen Informationen hinzuzufügen",
            optional: "Optional",
            addEmployee: "Mitarbeiter hinzufügen",
            generateLink: "Registrierungslink generieren",
            employeeName: "Mitarbeitername",
            expertise: "Fachgebiete",
            schedule: "Arbeitszeiten",
            photoUpload: "Foto hochladen",
            save: "Speichern",
            next: "Weiter",
            back: "Zurück",
            linkGenerated: "Registrierungslink wurde generiert",
            copyLink: "Link kopieren",
            addAnother: "Weiteren Mitarbeiter hinzufügen",
            finish: "Fertigstellen",
            dropzoneText: "Foto hier ablegen oder zum Auswählen klicken",
            expertiseHint: "Geben Sie Fachgebiete ein (z.B. Haarschnitt, Färben)",
            scheduleHint: "Legen Sie die Arbeitszeiten des Mitarbeiters fest",
            linkExpiry: "Link läuft in 7 Tagen ab",
            deleteEmployee: "Mitarbeiter entfernen",
            editEmployee: "Mitarbeiter bearbeiten",
            confirmDelete: "Sind Sie sicher, dass Sie diesen Mitarbeiter entfernen möchten?",
            photoRequired: "Foto ist erforderlich",
            nameRequired: "Name ist erforderlich",
            expertiseRequired: "Mindestens ein Fachgebiet ist erforderlich",
            scheduleRequired: "Arbeitszeiten sind erforderlich",
            backToSelection: "Zurück zur Auswahl"
        }
    };

    const t = translations[language];

    const {getRootProps, getInputProps} = useDropzone({
        accept: 'image/*',
        onDrop,
        multiple: false
    });

    const ScissorsLoader = ({message}) => (
        <div className="scissors-loader">
            <div className="loader-content">
                <Scissors className="animate-scissor"/>
                <p>{message}</p>
            </div>
        </div>
    );

    const handleAddEmployee = async () => {
        setFormTouched(true);

        // Validation checks
        if (!shopId) {
            Swal.fire({
                title: 'Error',
                text: 'Please create the shop first before adding employees',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            return;
        }

        if (!currentEmployee.name.trim()) {
            Swal.fire({
                title: 'Error',
                text: t.nameRequired,
                icon: 'error'
            });
            return;
        }

        if (!currentEmployee.photo) {
            Swal.fire({
                title: 'Error',
                text: t.photoRequired,
                icon: 'error'
            });
            return;
        }

        if (currentEmployee.expertise.length === 0) {
            Swal.fire({
                title: 'Error',
                text: t.expertiseRequired,
                icon: 'error'
            });
            return;
        }

        // Check if at least one day has some hours set
        const hasSchedule = Object.values(currentEmployee.schedule).some(day =>
            Array.isArray(day) && day.length > 0
        );

        if (!hasSchedule) {
            Swal.fire({
                title: 'Error',
                text: t.scheduleRequired,
                icon: 'error'
            });
            return;
        }

        let loadingContainer;
        let root;

        try {
            // Create and show scissors loader
            loadingContainer = document.createElement('div');
            document.body.appendChild(loadingContainer);
            root = createRoot(loadingContainer);
            root.render(<ScissorsLoader message="Adding employee..." />);

            let photoUrl = '';
            if (currentEmployee.photo) {
                const photoRef = ref(storage, `shops/${shopId}/employees/${currentEmployee.name}-${nanoid(6)}`);
                await uploadBytes(photoRef, currentEmployee.photo);
                photoUrl = await getDownloadURL(photoRef);
            }

            const newEmployee = {
                ...currentEmployee,
                id: nanoid(),
                photo: photoUrl
            };

            // Update local state
            const updatedEmployees = [...employees, newEmployee];
            setEmployees(updatedEmployees);

            // Get reference to the shop document
            const shopRef = doc(db, 'tempShops', shopId);

            try {
                // First try to update
                await updateDoc(shopRef, {
                    employees: updatedEmployees
                });
            } catch (updateError) {
                // If update fails because document doesn't exist, create it
                if (updateError.code === 'not-found') {
                    await setDoc(shopRef, {
                        employees: updatedEmployees,
                        id: shopId,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                } else {
                    throw updateError;
                }
            }

            // Clean up scissors loader
            if (root && loadingContainer) {
                root.unmount();
                document.body.removeChild(loadingContainer);
            }

            // Show success message
            await Swal.fire({
                title: 'Success!',
                text: 'Employee added successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            // Reset form
            setCurrentEmployee({
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

        } catch (error) {
            console.error('Error adding employee:', error);

            // Clean up scissors loader on error
            if (root && loadingContainer) {
                root.unmount();
                document.body.removeChild(loadingContainer);
            }

            Swal.fire({
                title: 'Error',
                text: 'Failed to add employee. Please try again.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    };

    const handleDeleteEmployee = async (employeeId) => {
        setFormTouched(true);
        // Show confirmation dialog first
        const result = await Swal.fire({
            title: t.confirmDelete,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626', // red-600
            confirmButtonText: t.deleteEmployee,
            cancelButtonText: t.back,
        });

        if (result.isConfirmed) {
            setIsLoading(true);
            try {
                // Remove from local state
                const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
                setEmployees(updatedEmployees);

                // Update Firebase
                const shopRef = doc(db, 'barberShops', shopId);
                await updateDoc(shopRef, {
                    employees: updatedEmployees
                });

                await Swal.fire({
                    title: 'Success!',
                    text: 'Employee removed successfully',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });

            } catch (error) {
                console.error('Error removing employee:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Failed to remove employee. Please try again.',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            } finally {
                setIsLoading(false);
            }
        }
    };

    const generateRegistrationLink = async () => {
        setFormTouched(true);
        const token = nanoid(16);
        const registrationLink = `${window.location.origin}/employee-register/${shopId}/${token}`;

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

        setGeneratedLinks(prev => ({
            ...prev,
            [token]: registrationLink
        }));

        await Swal.fire({
            title: t.linkGenerated,
            text: t.linkExpiry,
            icon: 'success',
            timer: 2000
        });

        return registrationLink;
    };

    // Add revoke token function
    const revokeToken = async (token) => {
        try {
            const shopRef = doc(db, 'tempShops', shopId);
            await updateDoc(shopRef, {
                [`employeeRegistrationTokens.${token}`]: {
                    revoked: true,
                    revokedAt: serverTimestamp()
                }
            });

            setGeneratedLinks(prev => {
                const newLinks = { ...prev };
                delete newLinks[token];
                return newLinks;
            });

            await Swal.fire({
                title: 'Link Revoked',
                text: 'Registration link has been revoked successfully',
                icon: 'success',
                timer: 2000
            });
        } catch (error) {
            console.error('Error revoking token:', error);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">{t.title}</h2>
                <p className="text-base-content/70">
                    {t.subtitle}
                    <span className="ml-2 text-sm bg-base-200 px-2 py-1 rounded">
                        {t.optional}
                    </span>
                </p>
            </div>

            {/* Option Selection */}
            {!selectedOption && (
                <div className="grid md:grid-cols-2 gap-6">
                    <motion.button
                        whileHover={{scale: 1.02}}
                        whileTap={{scale: 0.98}}
                        className="card bg-base-100 shadow-lg hover:shadow-xl transition-all"
                        onClick={() => setSelectedOption('direct')}
                    >
                        <div className="card-body">
                            <Users className="w-12 h-12 text-primary mb-4"/>
                            <h3 className="card-title">{t.directOption}</h3>
                            <p className="text-base-content/70">{t.directDescription}</p>
                        </div>
                    </motion.button>

                    <motion.button
                        whileHover={{scale: 1.02}}
                        whileTap={{scale: 0.98}}
                        className="card bg-base-100 shadow-lg hover:shadow-xl transition-all"
                        onClick={() => setSelectedOption('self')}
                    >
                        <div className="card-body">
                            <UserPlus className="w-12 h-12 text-primary mb-4"/>
                            <h3 className="card-title">{t.selfRegisterOption}</h3>
                            <p className="text-base-content/70">{t.selfRegisterDescription}</p>
                        </div>
                    </motion.button>
                </div>
            )}

            {/* Direct Employee Management */}
            <AnimatePresence mode="wait">
                {selectedOption === 'direct' && (
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -20}}
                        className="space-y-6"
                    >

                        <button
                            onClick={() => setSelectedOption(null)}
                            className="btn btn-ghost btn-sm gap-2 mb-4"
                        >
                            <X className="w-4 h-4"/>
                            {language === 'tr' ? 'Seçim Ekranına Dön' :
                                language === 'ar' ? 'العودة إلى شاشة الاختيار' :
                                    language === 'de' ? 'Zurück zur Auswahl' :
                                        'Back to Selection'}
                        </button>


                        {/* Employee List */}
                        <div className="grid gap-4">
                            {employees.map(employee => (
                                <motion.div
                                    key={employee.id}
                                    initial={{opacity: 0, y: 20}}
                                    animate={{opacity: 1, y: 0}}
                                    exit={{opacity: 0, y: -20}}
                                    className="card bg-base-100 shadow hover:shadow-md transition-all"
                                >
                                    <div className="card-body flex flex-row items-center p-4">
                                        {employee.photo && (
                                            <img
                                                src={employee.photo}
                                                alt={employee.name}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                        )}
                                        <div className="flex-1 ml-4">
                                            <h3 className="font-semibold">{employee.name}</h3>
                                            <p className="text-sm text-base-content/70">
                                                {employee.expertise.join(', ')}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <motion.button
                                                whileHover={{scale: 1.1}}
                                                whileTap={{scale: 0.9}}
                                                onClick={() => handleDeleteEmployee(employee.id)}
                                                className="btn btn-ghost btn-sm text-error"
                                                disabled={isLoading}
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </motion.button>
                                            <motion.button
                                                whileHover={{scale: 1.1}}
                                                whileTap={{scale: 0.9}}
                                                onClick={() => {/* Handle edit */
                                                }}
                                                className="btn btn-ghost btn-sm"
                                            >
                                                <Calendar className="w-4 h-4"/>
                                            </motion.button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Add Employee Form */}
                        {/*<div className="card bg-base-100 shadow-lg">*/}
                        {/*    <div className="card-body">*/}
                        {/*        <h3 className="card-title">{t.addEmployee}</h3>*/}

                        {/*        <div className="form-control">*/}
                        {/*            <label className="label">*/}
                        {/*                <span className="label-text">{t.employeeName}</span>*/}
                        {/*            </label>*/}
                        {/*            <input*/}
                        {/*                type="text"*/}
                        {/*                className="input input-bordered"*/}
                        {/*                value={currentEmployee.name}*/}
                        {/*                onChange={e => setCurrentEmployee({*/}
                        {/*                    ...currentEmployee,*/}
                        {/*                    name: e.target.value*/}
                        {/*                })}*/}
                        {/*            />*/}
                        {/*        </div>*/}

                        {/*        <div className="form-control">*/}
                        {/*            <label className="label">*/}
                        {/*                <span className="label-text">{t.photoUpload}</span>*/}
                        {/*            </label>*/}
                        {/*            <div {...getRootProps()}*/}
                        {/*                 className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">*/}
                        {/*                <input {...getInputProps()} />*/}
                        {/*                {currentEmployee.photo ? (*/}
                        {/*                    <div className="relative inline-block">*/}
                        {/*                        <img*/}
                        {/*                            src={URL.createObjectURL(currentEmployee.photo)}*/}
                        {/*                            alt="Preview"*/}
                        {/*                            className="w-24 h-24 rounded-lg object-cover"*/}
                        {/*                        />*/}
                        {/*                        <button*/}
                        {/*                            onClick={(e) => {*/}
                        {/*                                e.stopPropagation();*/}
                        {/*                                setCurrentEmployee({*/}
                        {/*                                    ...currentEmployee,*/}
                        {/*                                    photo: null*/}
                        {/*                                });*/}
                        {/*                            }}*/}
                        {/*                            className="absolute -top-2 -right-2 bg-base-100 rounded-full shadow"*/}
                        {/*                        >*/}
                        {/*                            <X className="w-4 h-4"/>*/}
                        {/*                        </button>*/}
                        {/*                    </div>*/}
                        {/*                ) : (*/}
                        {/*                    <Camera className="w-8 h-8 mx-auto text-base-content/40"/>*/}
                        {/*                )}*/}
                        {/*            </div>*/}
                        {/*        </div>*/}

                        {/*        /!* Add the EmployeeForm component here *!/*/}
                        {/*        <EmployeeForm*/}
                        {/*            employee={currentEmployee}*/}
                        {/*            onUpdate={setCurrentEmployee}*/}
                        {/*            language={language}*/}
                        {/*        />*/}

                        {/*        <button*/}
                        {/*            className="btn btn-primary mt-4"*/}
                        {/*            onClick={handleAddEmployee}*/}
                        {/*            disabled={isLoading}*/}
                        {/*        >*/}
                        {/*            {isLoading ? (*/}
                        {/*                <span className="loading loading-spinner"></span>*/}
                        {/*            ) : (*/}
                        {/*                t.save*/}
                        {/*            )}*/}
                        {/*        </button>*/}
                        {/*    </div>*/}
                        {/*</div>*/}

                        {/* Add Employee Form */}
                        <div className="card bg-base-100 shadow-lg">
                            <div className="card-body">
                                <h3 className="card-title">{t.addEmployee}</h3>

                                {/* Name Input */}
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">{t.employeeName}</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="input input-bordered"
                                        value={currentEmployee.name}
                                        onChange={e => setCurrentEmployee({
                                            ...currentEmployee,
                                            name: e.target.value
                                        })}
                                    />
                                </div>

                                {/* Photo Upload */}
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">{t.photoUpload}</span>
                                    </label>
                                    <div {...getRootProps()}
                                         className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors">
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
                                                    <p className="mt-2 text-sm text-base-content/60">{t.dropzoneText}</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    </div>
                                </div>

                                {/* Enhanced Employee Form */}
                                <div className="mt-6">
                                    <EmployeeForm
                                        employee={currentEmployee}
                                        onUpdate={setCurrentEmployee}
                                        language={language}
                                    />
                                </div>

                                <motion.button
                                    whileHover={{scale: 1.02}}
                                    whileTap={{scale: 0.98}}
                                    className="btn btn-primary mt-6"
                                    onClick={handleAddEmployee}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <span className="loading loading-spinner"></span>
                                    ) : (
                                        t.save
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Self Registration */}
                {selectedOption === 'self' && (
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -20}}
                        className="space-y-6"
                    >

                        <button
                            onClick={() => setSelectedOption(null)}
                            className="btn btn-ghost btn-sm gap-2 mb-4"
                        >
                            <X className="w-4 h-4"/>
                            {language === 'tr' ? 'Seçim Ekranına Dön' :
                                language === 'ar' ? 'العودة إلى شاشة الاختيار' :
                                    language === 'de' ? 'Zurück zur Auswahl' :
                                        'Back to Selection'}
                        </button>


                        {/* Generated Links */}
                        <div className="grid gap-4">
                            <GeneratedLinkSection
                                generatedLinks={generatedLinks}
                                copiedLinks={copiedLinks}
                                setCopiedLinks={setCopiedLinks}
                                revokeToken={revokeToken}
                                t={t}
                                shopId={shopId}
                            />
                        </div>

                        <button
                            className="btn btn-primary w-full"
                            onClick={generateRegistrationLink}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="loading loading-spinner"></span>
                            ) : (
                                t.generateLink
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Navigation */}
            {!selectedOption && (
                <div className="flex justify-between pt-6">
                    <button onClick={onBack} className="btn btn-ghost">
                        {t.back}
                    </button>
                    <button
                        onClick={() => onNext({hasEmployees: employees.length > 0 || Object.keys(generatedLinks).length > 0})}
                        className="btn btn-primary"
                    >
                        {t.next}
                    </button>
                </div>
            )}

            <ImageCropModal
                isOpen={cropModalOpen}
                onClose={() => setCropModalOpen(false)}
                imageSrc={selectedImage}
                onCropComplete={handleCropComplete}
            />
        </div>
    );
};

export default EmployeeManagementStep;