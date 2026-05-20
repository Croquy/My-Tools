/*
  Firebase helper pour QuizZone et autres outils.
  Déplace le service ici pour partager entre modules.
  Complète firebaseConfig avec les valeurs de ton projet Firebase.
  Ce fichier peut être réutilisé dans d'autres projets statiques.
*/

const firebaseConfig = {
  apiKey: "AIzaSyD-6RyyXjpUIXTLpGN-7xwUo3tB22jOENo",
  authDomain: "quiz-coeli.firebaseapp.com",
  projectId: "quiz-coeli",
  storageBucket: "quiz-coeli.firebasestorage.app",
  messagingSenderId: "755575329446",
  appId: "1:755575329446:web:33d09076149e3b74091a67"
};

const FirestoreService = {
  db: null,
  initialized: false,
  adminPassword: null,
  isAdminLoggedIn: false,

  init(config) {
    if (this.initialized) return;
    if (!config || !config.projectId) {
      throw new Error('Firebase config manquante ou incomplète.');
    }
    firebase.initializeApp(config);
    this.db = firebase.firestore();
    this.initialized = true;
  },

  // Charge le mot de passe admin depuis Firestore
  async loadAdminPassword() {
    try {
      const doc = await this.getDoc('settings', 'admin');
      this.adminPassword = doc && doc.admin_pwd ? doc.admin_pwd : 'admin';
      return this.adminPassword;
    } catch (e) {
      console.warn('Erreur chargement mot de passe admin:', e);
      this.adminPassword = 'admin';
      return this.adminPassword;
    }
  },

  // Vérifie le mot de passe admin
  checkAdminPassword(pwd) {
    if (!this.adminPassword) return false;
    const isValid = pwd === this.adminPassword;
    if (isValid) {
      this.isAdminLoggedIn = true;
      localStorage.setItem('admin_session', Date.now().toString());
    }
    return isValid;
  },

  // Se déconnecte de l'accès admin
  adminLogout() {
    this.isAdminLoggedIn = false;
    localStorage.removeItem('admin_session');
  },

  // Sauvegarde le mot de passe admin dans Firestore
  async saveAdminPassword(newPassword) {
    try {
      await this.setDoc('settings', 'admin', { admin_pwd: newPassword });
      this.adminPassword = newPassword;
      return true;
    } catch (e) {
      console.warn('Erreur sauvegarde mot de passe admin:', e);
      throw e;
    }
  },

  async getDoc(collection, id) {
    const snapshot = await this.db.collection(collection).doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  },

  async getCollection(collection) {
    try {
      const querySnapshot = await this.db.collection(collection).get({ source: 'server' });
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Erreur getCollection:', error);
      return [];
    }
  },

  async setDoc(collection, id, data) {
    try {
      return await this.db.collection(collection).doc(id).set(data, { merge: true });
    } catch (error) {
      console.warn('Erreur setDoc:', error);
      throw error;
    }
  },

  async deleteDoc(collection, id) {
    try {
      return await this.db.collection(collection).doc(id).delete();
    } catch (error) {
      console.warn('Erreur deleteDoc:', error);
      throw error;
    }
  },

  async batchSet(collection, docs) {
    try {
      const batch = this.db.batch();
      docs.forEach(doc => {
        const ref = this.db.collection(collection).doc(doc.id);
        batch.set(ref, doc, { merge: true });
      });
      return await batch.commit();
    } catch (error) {
      console.warn('Erreur batchSet:', error);
      throw error;
    }
  }
};

window.FirestoreService = FirestoreService;
window.firebaseConfig = firebaseConfig;
