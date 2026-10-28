const KEY = 'hackademy.account-deleted';

export function rememberAccountDeleted() {
  try { sessionStorage.setItem(KEY, '1'); } catch { return; }
}

export function accountWasDeleted() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function forgetAccountDeleted() {
  try { sessionStorage.removeItem(KEY); } catch { return; }
}
