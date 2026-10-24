export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;
export const USERNAME_TAKEN = 'Ta nazwa jest zajęta';

export function usernameProblem(name: string) {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return `Nazwa użytkownika musi mieć od ${USERNAME_MIN} do ${USERNAME_MAX} znaków`;
  if (!USERNAME_PATTERN.test(name)) return 'Nazwa może zawierać tylko litery, cyfry, _ i -';
  return null;
}
