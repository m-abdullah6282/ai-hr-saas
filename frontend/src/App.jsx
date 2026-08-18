import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Apply from "./pages/Apply.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Jobs from "./pages/Jobs.jsx";
import Login from "./pages/Login.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import Signup from "./pages/Signup.jsx";

// App mein saare routes define hain. /dashboard ke andar nested
// routes hain (Jobs default, Pipeline candidates ke liye).
export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/apply/:slug" element={<Apply />} />

      {/* Protected routes — ProtectedRoute guard laga hua hai */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      >
        {/* /dashboard pe default Jobs page */}
        <Route index element={<Jobs />} />
        {/* candidates pipeline */}
        <Route path="jobs/:jobId/candidates" element={<Pipeline />} />
      </Route>

      {/* Root: dashboard pe bhejo; auth nahi hai to ProtectedRoute /login le jayega */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}