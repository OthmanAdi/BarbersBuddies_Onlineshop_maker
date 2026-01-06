const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const transporter = nodemailer.createTransport({
    service: 'gmail', // or your email service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

exports.sendDeletionConfirmation = functions.firestore
    .document('deletedAccounts/{docId}')
    .onCreate(async (snap, context) => {
        const userData = snap.data();

        const emailTemplates = {
            en: {
                subject: 'Account Deletion Confirmation - BarbersBuddies',
                body: `
                    <h2>Account Deletion Confirmation</h2>
                    <p>Dear ${userData.name},</p>
                    <p>This email confirms that your BarbersBuddies account has been successfully deleted.</p>
                    <p>If you didn't request this deletion, please contact our support immediately.</p>
                    <p>Thank you for using BarbersBuddies.</p>
                `
            },
            tr: {
                subject: 'Hesap Silme Onayı - BarbersBuddies',
                body: `
                    <h2>Hesap Silme Onayı</h2>
                    <p>Sayın ${userData.name},</p>
                    <p>BarbersBuddies hesabınızın başarıyla silindiğini onaylarız.</p>
                    <p>Bu silme işlemini siz talep etmediyseniz, lütfen derhal destek ekibimizle iletişime geçin.</p>
                    <p>BarbersBuddies'ı kullandığınız için teşekkür ederiz.</p>
                `
            }
            // Add other language templates as needed
        };

        const template = emailTemplates[userData.language] || emailTemplates.en;

        const mailOptions = {
            from: '"BarbersBuddies" <noreply@barbersbuddies.com>',
            to: userData.email,
            subject: template.subject,
            html: template.body
        };

        try {
            await transporter.sendMail(mailOptions);
            // Delete the document after sending email
            await snap.ref.delete();
            return null;
        } catch (error) {
            console.error('Error sending email:', error);
            throw new functions.https.HttpsError('internal', 'Error sending deletion confirmation email');
        }
    });