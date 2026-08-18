import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// ProtectedRoute ek "guard" component hai. Protected pages ko
// iske andar wrap karte hain. Agar user logged in nahi hai to
// /login pe redirect karta hai, warna children (actual page) render karta hai.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Jab tak mount-par auth check chal raha hai, kuch mat render karo
  // (flash / glitch se bachne ke liye).
  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}