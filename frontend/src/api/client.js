import axios from "axios";

// Ek shared axios instance banate hain jo poore app mein use hoga.
// Isse har jagah baseURL aur headers repeat nahi karne padte.
const client = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// Request interceptor: har request jaane se PEHLE ye chalta hai.
// Agar localStorage mein token hai, to header mein
// "Authorization: Bearer <token>" automatically add ho jata hai.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;