import api from './axios'

export const register = (data) => api.post('/auth/register', data)
export const login    = (data) => api.post('/auth/login', data)
export const logout   = ()     => api.post('/auth/logout')
export const logoutAll = (keepCurrent) => api.post('/auth/logout-all', { keepCurrent })
export const getMe    = ()     => api.get('/users/me')

export const verifyEmail       = (token) => api.get(`/auth/verify-email/${token}`)
export const resendVerification = (email) => api.post('/auth/resend-email-verification', { email })
export const forgotPassword    = (email) => api.post('/auth/forgot-password', { email })
export const resetPassword     = (resetToken, newPassword) =>
  api.post(`/auth/reset-password/${resetToken}`, { newPassword })

export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword })

export const getSessions      = ()          => api.get('/auth/sessions')
export const revokeSession    = (sessionId) => api.delete(`/auth/sessions/${sessionId}`)
export const revokeAllOther   = ()          => api.post('/auth/logout-all', { keepCurrent: true })

export const updateProfile = (data) => api.patch('/users/me', data)
export const deleteAccount = (password) => api.delete('/users/me', { data: { password } })
