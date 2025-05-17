// App.jsx
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import { signOut } from "firebase/auth";


function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true); // Track loading state

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser?.email === "andrew@flair.london") {
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setCheckingAuth(false);
    });

    // Clean up the listener when component unmounts
    return () => unsubscribe();
  }, []);

  if (checkingAuth) return <p>Loading...</p>; // Optional: show a loading spinner

  if (!user) return <Login onLogin={setUser} />;

  const handleLogout = async () => {
  try {
    await signOut(auth);
    setUser(null); // Clear user in state
  } catch (error) {
    console.error("Logout error:", error);
  }
};

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">
        Tailwind is Working! 🎉
      </h1>
      <p className="text-lg text-gray-700">
        You are logged in as <strong>{user.email}</strong>
      </p>
      <button className="mt-6 px-4 py-2 bg-green-500 text-white font-semibold rounded hover:bg-green-600">
        Test Button
      </button>
      <button
        onClick={handleLogout}
        className="mt-4 px-4 py-2 bg-red-500 text-white font-semibold rounded hover:bg-red-600"
      >
        Log out
      </button>
    </div>
  );
  
}


export default App;

