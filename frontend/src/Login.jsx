import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Only allow your email
      if (user.email === "andrew@flair.london") {
        onLogin(user);
      } else {
        setError("Access denied: unauthorized email.");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-20 p-6 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="block w-full border mb-2 p-2 rounded"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="block w-full border mb-2 p-2 rounded"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        onClick={login}
        className="mt-2 w-full bg-blue-600 text-white font-semibold p-2 rounded hover:bg-blue-700"
      >
        Sign In
      </button>
    </div>
  );
}

export default Login;