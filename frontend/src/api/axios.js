import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // send httpOnly cookies
  timeout: 15000,
})

// ---- Response interceptor: auto-refresh on 401 TOKEN_EXPIRED ----
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    const code = err.response?.data?.code

    if (
      err.response?.status === 401 &&
      code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => api(original))
          .catch(e => Promise.reject(e))
      }

      original._retry = true
      isRefreshing = true

      try {
        await api.post('/auth/refresh-token')
        processQueue(null)
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        // Redirect to login — clear any stale state
        window.dispatchEvent(new CustomEvent('auth:logout'))
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(err)
  },
)

export default api
