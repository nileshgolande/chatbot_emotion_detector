import axios from "axios";

const baseURL = process.env.REACT_APP_API_URL || "";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) {
    throw new Error("no refresh token");
  }
  const { data } = await axios.post(
    `${baseURL}/api/auth/token/refresh/`,
    { refresh },
    { headers: { "Content-Type": "application/json" } },
  );
  localStorage.setItem("access", data.access);
  if (data.refresh) {
    localStorage.setItem("refresh", data.refresh);
  }
  return data.access;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        await refreshPromise;
        const token = localStorage.getItem("access");
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
        }
        return api(original);
      } catch {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      }
    }
    return Promise.reject(error);
  },
);

export default api;
export { baseURL };
