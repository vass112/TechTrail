// Firebase Configuration for TechTrail
// SECURITY NOTE: This key is restricted to vass112.github.io in the Google Cloud Console.
const firebaseConfig = {
    apiKey: "AIzaSyCCbWAnX9mm2vVtzbCX9zkVS6unSi_MQ30",
    authDomain: "techtrail-1857e.firebaseapp.com",
    projectId: "techtrail-1857e",
    storageBucket: "techtrail-1857e.firebasestorage.app",
    messagingSenderId: "273832751733",
    appId: "1:273832751733:web:a928e750a6ac2e961afe3c",
    measurementId: "G-VSSCE6FW6F"
};

// Global Initialization
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.auth = firebase.auth();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();
}
