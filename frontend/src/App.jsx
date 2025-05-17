// App.jsx
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import { signOut } from "firebase/auth";
import AdminDashboard from "./components/AdminDashboard";// Import AdminDashboard


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
    <div className="max-w-4xl mx-auto border rounded-lg overflow-hidden bg-gray-200">
      <AdminDashboard />

      <button
        onClick={handleLogout}
        className="block mx-auto mt-4 px-4 py-2 bg-gray-300 text-white font-semibold rounded hover:bg-red-600"
      >
        Log out
      </button>

    </div>


  );

}


export default App;

