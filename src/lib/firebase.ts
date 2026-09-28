import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

async function testConnection() {
  try {
    // Non-blocking background check
    await getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});
  } catch (error) {
    // Ignore initial connection/offline unavailability during app bootstrap
  }
}
testConnection();
