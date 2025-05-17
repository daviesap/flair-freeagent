// src/firebase.js

// Import only what you need
import { initializeApp } from "firebase/app"
// Optional: import analytics only if you’re using it
// import { getAnalytics } from "firebase/analytics"

// Your Firebase config object
const firebaseConfig = {
  apiKey: "AIzaSyDDSke2OGHKTOTAIzZAHsnEoFzOYWTbbTs",
  authDomain: "flair-freeagent.firebaseapp.com",
  projectId: "flair-freeagent",
  storageBucket: "flair-freeagent.appspot.com",
  messagingSenderId: "617527918078",
  appId: "1:617527918078:web:7330381cf02442033a94af",
  measurementId: "G-EEGYH1XJ2F"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Optional: Initialize Analytics if needed (must be used in a browser)
// const analytics = getAnalytics(app)

//Add authentication
import { getAuth } from "firebase/auth";

export const auth = getAuth();

export default app