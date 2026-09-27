const ADMIN_PASSWORD = 'Admin1234';
const STORAGE_KEY = 'asd_admin_session_auth';

export function verifyAdminPassword(password: string): boolean {
  return password.trim() === ADMIN_PASSWORD;
}

export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(STORAGE_KEY) === 'true';
}

export function setAdminAuthenticated(auth: boolean): void {
  if (typeof window === 'undefined') return;
  if (auth) {
    sessionStorage.setItem(STORAGE_KEY, 'true');
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
