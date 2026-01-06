const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.onShopCreate = functions.firestore
    .document('barberShops/{shopId}')
    .onCreate((snap, context) => {
        const shopData = snap.data();
        return admin.firestore().collection('shopNames').doc(snap.id).set({
            name: shopData.name,
            nameSearch: shopData.name.toLowerCase().trim(),
            createdAt: shopData.createdAt || admin.firestore.FieldValue.serverTimestamp()
        });
    });

exports.onShopDelete = functions.firestore
    .document('barberShops/{shopId}')
    .onDelete((snap) => {
        return admin.firestore().collection('shopNames').doc(snap.id).delete();
    });

exports.onShopUpdate = functions.firestore
    .document('barberShops/{shopId}')
    .onUpdate((change) => {
        const newData = change.after.data();
        const oldData = change.before.data();
        if (newData.name !== oldData.name) {
            return admin.firestore().collection('shopNames').doc(change.after.id).update({
                name: newData.name,
                nameSearch: newData.name.toLowerCase().trim()
            });
        }
        return null;
    });