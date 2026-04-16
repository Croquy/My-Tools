/*
  Firebase helper pour QuizZone.
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

  init(config) {
    if (this.initialized) return;
    if (!config || !config.projectId) {
      throw new Error('Firebase config manquante ou incomplète.');
    }
    firebase.initializeApp(config);
    this.db = firebase.firestore();
    this.initialized = true;
  },

  async getDoc(collection, id) {
    const snapshot = await this.db.collection(collection).doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  },

  async setDoc(collection, id, data) {
    return this.db.collection(collection).doc(id).set(data, { merge: true });
  },

  async deleteDoc(collection, id) {
    return this.db.collection(collection).doc(id).delete();
  },

  async getCollection(collection) {
    const snapshot = await this.db.collection(collection).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async batchSet(collection, docs) {
    const batch = this.db.batch();
    docs.forEach(doc => {
      const ref = this.db.collection(collection).doc(doc.id);
      batch.set(ref, doc, { merge: true });
    });
    return batch.commit();
  }
};

window.FirestoreService = FirestoreService;
window.firebaseConfig = firebaseConfig;
