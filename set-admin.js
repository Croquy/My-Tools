#!/usr/bin/env node

/**
 * Script pour poser le claim 'admin' sur un utilisateur Firebase
 * Utilise l'Admin SDK — nécessite un fichier de service account
 * 
 * Usage:
 *   node set-admin.js <UID> [serviceAccountPath]
 * 
 * Exemple:
 *   node set-admin.js user123 ./serviceAccountKey.json
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const uid = process.argv[2];
const serviceAccountPath = process.argv[3] || './serviceAccountKey.json';

if (!uid) {
  console.error('❌ Usage: node set-admin.js <UID> [serviceAccountPath]');
  console.error('Exemple: node set-admin.js user123 ./serviceAccountKey.json');
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Fichier de service account introuvable: ${serviceAccountPath}`);
  console.error('Téléchargez-le depuis Firebase Console > Paramètres > Comptes de service');
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log(`⏳ Pose du claim 'admin' sur l'utilisateur: ${uid}`);

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✅ Claim 'admin' posé avec succès pour ${uid}`);
    console.log('L\'utilisateur devra se reconnecter pour que les droits prennent effet.');
    process.exit(0);
  })
  .catch(err => {
    console.error(`❌ Erreur: ${err.message}`);
    process.exit(1);
  });
