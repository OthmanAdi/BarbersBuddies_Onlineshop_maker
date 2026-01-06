import React, {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {CheckCircle, Copy, Download, Mail, Printer, X} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const InvoiceDialog = ({
                           isOpen,
                           onClose,
                           booking,
                           shopDetails
                       }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen || !booking || !shopDetails) return null;

    const invoiceNumber = `INV-${booking.id?.slice(0, 8).toUpperCase()}`;
    const invoiceDate = new Date().toLocaleDateString('en-GB');
    const dueDate = new Date(booking.selectedDate).toLocaleDateString('en-GB');

    const totalAmount = booking.selectedServices?.reduce(
        (sum, service) => sum + parseFloat(service.price),
        0
    ) || 0;

    const generatePDF = () => {
        // Create new PDF document
        const doc = new jsPDF();

        // Add shop logo/header
        doc.setFontSize(20);
        doc.setTextColor(44, 62, 80);
        doc.text(shopDetails.name, 20, 20);

        // Add invoice details
        doc.setFontSize(10);
        doc.setTextColor(52, 73, 94);
        doc.text([
            `Invoice #: ${invoiceNumber}`,
            `Date: ${invoiceDate}`,
            `Due Date: ${dueDate}`,
        ], 20, 35);

        // Add shop details
        doc.text([
            shopDetails.address,
            `Phone: ${shopDetails.phoneNumber}`,
            `Email: ${shopDetails.email}`,
        ], 20, 55);

        // Add customer details
        doc.setFontSize(12);
        doc.text('Bill To:', 20, 75);
        doc.setFontSize(10);
        doc.text([
            booking.userName,
            booking.userEmail,
            booking.userPhone || 'No phone provided',
        ], 20, 82);

        // Add services table
        const tableData = booking.selectedServices?.map(service => [
            service.name,
            `${service.duration || 30} min`,
            `€${parseFloat(service.price).toFixed(2)}`,
        ]) || [];

        doc.autoTable({
            startY: 100,
            head: [['Service', 'Duration', 'Price']],
            body: tableData,
            foot: [[
                'Total',
                `${booking.selectedServices?.reduce((total, service) =>
                    total + (parseInt(service.duration) || 30), 0)} min`,
                `€${totalAmount.toFixed(2)}`
            ]],
            theme: 'grid',
            headStyles: {
                fillColor: [52, 73, 94],
                textColor: [255, 255, 255],
                fontSize: 10,
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontSize: 10,
                fontStyle: 'bold',
            },
            styles: {
                fontSize: 9,
                cellPadding: 5,
            },
        });

        // Add total amount
        const finalY = doc.previousAutoTable.finalY || 120;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Amount: €${totalAmount.toFixed(2)}`, 150, finalY + 20);

        // Add footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(128, 128, 128);
        doc.text([
            'Thank you for your business!',
            `${shopDetails.name} - ${shopDetails.address}`,
            `Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`,
        ], 20, 270, {
            align: 'left',
        });

        // Add appointment details
        doc.setFontSize(9);
        doc.setTextColor(52, 73, 94);
        doc.text([
            'Appointment Details:',
            `Date: ${new Date(booking.selectedDate).toLocaleDateString('en-GB')}`,
            `Time: ${booking.selectedTime}`,
            `Status: ${booking.status}`,
        ], 20, finalY + 40);

        // Save the PDF
        doc.save(`Invoice-${invoiceNumber}.pdf`);
    };

    const handleCopyToClipboard = () => {
        const invoiceText = `
Invoice #${invoiceNumber}
${shopDetails.name}
${shopDetails.address}

Bill To:
${booking.userName}
${booking.userEmail}
${booking.userPhone || 'No phone provided'}

Date: ${invoiceDate}
Due Date: ${dueDate}

Services:
${booking.selectedServices?.map(service =>
            `${service.name} (${service.duration || 30}min): €${service.price}`
        ).join('\n')}

Total Duration: ${booking.selectedServices?.reduce((total, service) =>
            total + (parseInt(service.duration) || 30), 0)} min
Total Amount: €${totalAmount.toFixed(2)}
`;

        navigator.clipboard.writeText(invoiceText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleEmailShare = () => {
        const subject = `Invoice ${invoiceNumber} from ${shopDetails.name}`;
        const body = `Please find your invoice attached for services on ${dueDate}.`;
        window.location.href = `mailto:${booking.userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] overflow-hidden">
                    <div className="min-h-screen w-full" style={{paddingTop: 'env(safe-area-inset-top, 20px)'}}>
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            className="fixed inset-0 bg-black/50"
                            onClick={onClose}
                        />
                        <motion.div
                            initial={{y: "100%"}}
                            animate={{y: 0}}
                            exit={{y: "100%"}}
                            transition={{type: "spring", damping: 25}}
                            className="relative bg-base-100 w-full h-[90vh] mt-16 overflow-hidden flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Fixed Header */}
                            <div className="sticky top-0 z-20 bg-base-100 border-b border-base-200">
                                <div className="flex justify-between items-center p-4">
                                    <div>
                                        <h2 className="text-lg font-bold">Invoice</h2>
                                        <p className="text-xs text-base-content/60">{invoiceNumber}</p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="btn btn-ghost btn-sm btn-circle"
                                    >
                                        <X className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                                {/* Business & Client Info */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-base-200/50 p-3 rounded-lg">
                                        <h3 className="text-sm font-semibold mb-2">From:</h3>
                                        <div className="text-sm text-base-content/80 space-y-1">
                                            <p className="font-medium">{shopDetails.name}</p>
                                            <p className="text-xs">{shopDetails.address}</p>
                                            <p className="text-xs">{shopDetails.email}</p>
                                            <p className="text-xs">{shopDetails.phoneNumber}</p>
                                        </div>
                                    </div>
                                    <div className="bg-base-200/50 p-3 rounded-lg">
                                        <h3 className="text-sm font-semibold mb-2">Bill To:</h3>
                                        <div className="text-sm text-base-content/80 space-y-1">
                                            <p className="font-medium">{booking.userName}</p>
                                            <p className="text-xs">{booking.userEmail}</p>
                                            <p className="text-xs">{booking.userPhone || 'No phone provided'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-base-200/50 p-3 rounded-lg">
                                        <h3 className="text-sm font-semibold mb-1">Invoice Date:</h3>
                                        <p className="text-xs text-base-content/80">{invoiceDate}</p>
                                    </div>
                                    <div className="bg-base-200/50 p-3 rounded-lg">
                                        <h3 className="text-sm font-semibold mb-1">Appointment:</h3>
                                        <p className="text-xs text-base-content/80">{dueDate}</p>
                                        <p className="text-xs text-base-content/80">{booking.selectedTime}</p>
                                    </div>
                                </div>

                                {/* Services Table */}
                                <div className="bg-base-200/50 rounded-lg p-3">
                                    <h3 className="text-sm font-semibold mb-3">Services:</h3>
                                    <div className="overflow-x-auto -mx-2">
                                        <table className="table table-sm w-full">
                                            <thead>
                                            <tr className="text-xs">
                                                <th className="bg-base-200/50">Service</th>
                                                <th className="bg-base-200/50 text-right">Duration</th>
                                                <th className="bg-base-200/50 text-right">Price</th>
                                            </tr>
                                            </thead>
                                            <tbody className="text-xs">
                                            {booking.selectedServices?.map((service, index) => (
                                                <tr key={index}>
                                                    <td className="py-2">{service.name}</td>
                                                    <td className="text-right">{service.duration || 30} min</td>
                                                    <td className="text-right">€{service.price}</td>
                                                </tr>
                                            ))}
                                            <tr className="font-bold text-xs">
                                                <td className="py-2">Total</td>
                                                <td className="text-right">
                                                    {booking.selectedServices?.reduce((total, service) =>
                                                        total + (parseInt(service.duration) || 30), 0)} min
                                                </td>
                                                <td className="text-right">€{totalAmount.toFixed(2)}</td>
                                            </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Fixed Action Buttons at Bottom */}
                            <div
                                className="sticky bottom-0 bg-base-100 border-t border-base-200 p-3 flex flex-wrap gap-2 justify-end">
                                <button
                                    onClick={handleCopyToClipboard}
                                    className="btn btn-ghost btn-sm gap-1 px-2"
                                >
                                    {copied ? (
                                        <CheckCircle className="w-3 h-3 text-success"/>
                                    ) : (
                                        <Copy className="w-3 h-3"/>
                                    )}
                                    <span className="text-xs">Copy</span>
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="btn btn-ghost btn-sm gap-1 px-2"
                                >
                                    <Printer className="w-3 h-3"/>
                                    <span className="text-xs">Print</span>
                                </button>
                                <button
                                    onClick={handleEmailShare}
                                    className="btn btn-ghost btn-sm gap-1 px-2"
                                >
                                    <Mail className="w-3 h-3"/>
                                    <span className="text-xs">Email</span>
                                </button>
                                <button
                                    onClick={generatePDF}
                                    className="btn btn-primary btn-sm gap-1 px-3"
                                >
                                    <Download className="w-3 h-3"/>
                                    <span className="text-xs">PDF</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default InvoiceDialog;