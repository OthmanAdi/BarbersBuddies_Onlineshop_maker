import {useState} from 'react';
import {Check, Copy} from 'lucide-react';

const CopyLinkButton = ({linkToCopy}) => {
    const [showCheck, setShowCheck] = useState(false);
    const [showAlert, setShowAlert] = useState(false);

    const handleCopy = async () => {
        try {
            // Simple copy implementation that works across platforms
            const textArea = document.createElement("textarea");
            textArea.value = linkToCopy;
            textArea.style.position = "absolute";
            textArea.style.left = "-9999px";
            textArea.style.top = "-9999px";
            document.body.appendChild(textArea);

            if (navigator.userAgent.match(/ipad|iphone/i)) {
                textArea.contentEditable = true;
                textArea.readOnly = false;
                const range = document.createRange();
                range.selectNodeContents(textArea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textArea.setSelectionRange(0, 999999);
            } else {
                textArea.select();
            }

            document.execCommand('copy');
            document.body.removeChild(textArea);

            // Show success states
            setShowCheck(true);
            setShowAlert(true);

            // Auto hide alert after 2 seconds
            setTimeout(() => {
                setShowAlert(false);
            }, 2000);

            // Reset icon after 3 seconds
            setTimeout(() => {
                setShowCheck(false);
            }, 3000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <>
            {/* Animated Alert */}
            <div
                className={`fixed top-0 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ease-in-out
                ${showAlert
                    ? 'translate-y-4 opacity-100'
                    : '-translate-y-full opacity-0'
                }`}
            >
                <div className="bg-green-50 border-l-4 border-green-400 p-4 shadow-lg rounded-lg
                      sm:min-w-[320px] min-w-[280px] mx-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <Check className="h-5 w-5 text-green-400"/>
                            <p className="ml-3 text-sm text-green-800 font-medium">
                                Link copied to clipboard!
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Animated Copy Button */}
            <button
                onClick={handleCopy}
                className="btn btn-ghost btn-sm"
            >
                <div className="relative w-4 h-4">
                    <div className={`absolute inset-0 transition-all duration-300 transform
                        ${showCheck ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                        <Copy className="w-4 h-4"/>
                    </div>
                    <div className={`absolute inset-0 transition-all duration-300 transform
                        ${showCheck ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                        <Check className="w-4 h-4 text-green-500"/>
                    </div>
                </div>
            </button>
        </>
    );
};

export default CopyLinkButton;