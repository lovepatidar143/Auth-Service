import api from './axios'

export const listUsers    = (params) => api.get('/admin/users', { params })
export const updateRole   = (userId, role)     => api.patch(`/admin/users/${userId}/role`,   { role })
export const updateStatus = (userId, isActive) => api.patch(`/admin/users/${userId}/status`, { isActive })
