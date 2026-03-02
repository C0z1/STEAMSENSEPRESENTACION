
// Client-side auth helpers
export interface SteamUser {
  steam_id: string
  display_name: string
  avatar_url: string
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('steamsense_token')
}

export function setToken(token: string) {
  localStorage.setItem('steamsense_token', token)
}

export function clearToken() {
  localStorage.removeItem('steamsense_token')
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Decode JWT payload without verification (verification happens server-side)
export function decodeToken(token: string): SteamUser | null {
  try {
    const payload = token.split('.')[1]
    const pad = 4 - payload.length % 4
    const decoded = JSON.parse(atob(payload + '='.repeat(pad === 4 ? 0 : pad)))
    if (!decoded.sub || decoded.exp < Date.now() / 1000) return null
    return {
      steam_id:     decoded.sub,
      display_name: decoded.name,
      avatar_url:   decoded.avatar || '',
    }
  } catch {
    return null
  }
}

export function getUserFromStorage(): SteamUser | null {
  const token = getToken()
  return token ? decodeToken(token) : null
}