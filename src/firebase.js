import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDKdpKbssB1IhS14icJymTKtw64tL--R5s",
  authDomain: "table-tap-78146.firebaseapp.com",
  projectId: "table-tap-78146",
  storageBucket: "table-tap-78146.firebasestorage.app",
  messagingSenderId: "864484632523",
  appId: "1:864484632523:web:be7d8eeaa2fb16d722784e",
  measurementId: "G-1X3CFXR3HZ"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
const auth = getAuth(app);

export { app, db, auth };
