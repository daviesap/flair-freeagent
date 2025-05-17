import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

function AdminDashboard() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUsers() {
            try {
                const querySnapshot = await getDocs(collection(db, "users"));
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setUsers(data);
            } catch (error) {
                console.error("Error fetching users:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchUsers();
    }, []);

    if (loading) return <p>Loading...</p>;

    return (
        <div className="p-6">
            <h1>FreeAgent Admin Dashboard</h1>
            <div className="max-w-4xl mx-auto border rounded-lg overflow-hidden bg-white shadow-lg">
                <div className="flex bg-gray-200 font-semibold text-gray-700">
                    <div className="w-1/3">User ID</div>
                    <div className="w-1/3">Token</div>
                    <div className="w-1/3">Expires at</div>
                </div>

                {users.map(user => {
                    const formattedDate = formatPrettyDate(user.expires_at);
                    return (
                        <div className="flex border-t hover:bg-gray-50">
                            <div className="w-1/3">{user.id}</div>
                            <div className="w-1/3 break-words p-3">{user.access_token}</div>
                            <div className="w-1/3 p-3">{formattedDate}</div>
                            
                        </div>
                    );
                })}

            </div>
        </div>
    );
}

export default AdminDashboard;

function formatPrettyDate(isoString) {
    if (!isoString) return "Invalid date";

    const date = new Date(isoString);

    const options = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Europe/London", // Adjust if needed
    };

    return date
        .toLocaleString("en-GB", options)
        .replace(",", "") // Remove comma after weekday
        .replace(/(\d+)(st|nd|rd|th)?/, (match, d) => `${addOrdinal(d)}`);
}

function addOrdinal(day) {
    const d = parseInt(day, 10);
    if ([11, 12, 13].includes(d % 100)) return `${d}th`;
    const lastDigit = d % 10;
    if (lastDigit === 1) return `${d}st`;
    if (lastDigit === 2) return `${d}nd`;
    if (lastDigit === 3) return `${d}rd`;
    return `${d}th`;
}