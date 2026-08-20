import { createContext, useContext, useEffect, useState } from "react";
import client from "../api/client";

// Context banate hain. Context ek "container" hai jo state ko
// poore app mein share karta hai, taaki har component ko alag-alag
// props pass nahi karni pade.
const AuthContext = createContext(null);

// AuthProvider ek component hai jo poori app ko wrap karega.
// Iske andar jo bhi component hai, wo useAuth() se auth state
// aur functions access kar sakta hai.
export function AuthProvider({ children }) {
  // isAuthenticated: boolean (logged in ya nahi)
  // user: current user ka data (email etc.)
  // token: access token
  //
  // State ko localStorage se initialize karte hain (lazy initializer),
  // taaki page reload hone par bhi login status bana rahe.
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem("access_token"));
  // Agar token hai to mount par /auth/me se user verify karte hain.
  // Token nahi hai to loading ki zaroorat nahi.
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("access_token")));

  // Mount hone par (page reload / fresh visit): agar localStorage mein
  // token pada hai to /auth/me se verify karte hain. Isse invalid/expired
  // token cleanup ho jata hai. Sirf EK baar chalta hai — login ke baad nahi,
  // warna login ke turant baad verification fail hone par fresh session
  // bhi wipe ho jata (white screen / logout loop).
  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    // Token nahi hai to loading pehle se false hai — kuch karne ki zaroorat nahi.
    if (!storedToken) return;

    client
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        // Token invalid/expired ho to cleanup kar ke logout karte hain.
        localStorage.removeItem("access_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // LOGIN: backend ke /auth/login ko call karte hain.
  // Response se token nikal kar localStorage + state mein save karte hain.
  const login = async (email, password) => {
    const res = await client.post("/auth/login", { email, password });
    const { access_token, user: loggedInUser } = res.data;

    localStorage.setItem("access_token", access_token);
    localStorage.setItem("auth_user", JSON.stringify(loggedInUser));

    setToken(access_token);
    setUser(loggedInUser);

    return res.data;
  };

  // SIGNUP: /auth/signup ko call karte hain.
  // Backend signup pe token nahi deta, isliye bas result return karte
  // hain — UI decide karega ki login page pe bhejna hai ya message dikhana.
  const signup = async (email, password, company_name) => {
    const res = await client.post("/auth/signup", { email, password, company_name });
    return res.data;
  };

  // LOGOUT: localStorage clear karke state reset karte hain.
  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token),
    loading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth() custom hook — koi bhi component isse call karke
// AuthContext ki poori value (state + functions) le sakta hai.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}