import type { ClerkProvider } from '@clerk/react';
import type { ComponentProps } from 'react';
import { plPL } from '@clerk/localizations';

type ClerkLocalization = NonNullable<ComponentProps<typeof ClerkProvider>['localization']>;

const protectCheck = {
  loading: 'Wczytuję…',
  retryButton: 'Spróbuj ponownie',
  subtitle: 'Poczekaj chwilę, sprawdzamy, czy wszystko jest w porządku.',
  title: 'Sprawdzamy Twoje żądanie',
};

export const clerkLocalization: ClerkLocalization = {
  ...plPL,
  formFieldInputPlaceholder__emailAddress: 'np. jan@example.com',
  formFieldInputPlaceholder__password: 'Wpisz hasło',
  formFieldInputPlaceholder__signUpPassword: 'Utwórz hasło',
  formFieldInputPlaceholder__username: 'Wpisz nazwę użytkownika',
  formFieldInput__emailAddress_format: 'Przykładowy format: jan@example.com',
  formFieldAction__forgotPassword: 'Nie pamiętasz hasła?',
  identityPreviewEditButton__emailAddress: 'Zmień adres e-mail',
  identityPreviewEditButton__identifier: 'Zmień login',
  identityPreviewEditButton__phoneNumber: 'Zmień numer telefonu',
  socialButtonsBlockButton: 'Kontynuuj przez {{provider|titleize}}',
  signIn: {
    ...plPL.signIn,
    start: {
      ...plPL.signIn?.start,
      title: 'Zaloguj się',
      titleCombined: 'Zaloguj się',
      subtitle: 'Witaj ponownie w Hackademy.',
      subtitleCombined: 'Witaj ponownie w Hackademy.',
    },
    password: {
      ...plPL.signIn?.password,
      title: 'Wpisz hasło',
      subtitle: 'Jeszcze jeden krok i wracasz do Hackademy.',
    },
    emailCode: {
      ...plPL.signIn?.emailCode,
      title: 'Sprawdź skrzynkę',
      subtitle: 'Wpisz kod, który wysłaliśmy na Twój adres e-mail.',
    },
    forgotPasswordAlternativeMethods: {
      ...plPL.signIn?.forgotPasswordAlternativeMethods,
      title: 'Nie pamiętasz hasła?',
      label__alternativeMethods: 'Albo zaloguj się w inny sposób',
    },
    forgotPassword: {
      ...plPL.signIn?.forgotPassword,
      formTitle: 'Kod do resetu hasła',
      title: 'Zresetuj hasło',
      subtitle: 'aby ustawić nowe hasło',
      subtitle_email: 'Wpisz kod, który wysłaliśmy na Twój adres e-mail',
      resendButton: 'Kod nie dotarł? Wyślij ponownie',
    },
    resetPassword: {
      ...plPL.signIn?.resetPassword,
      successMessage: 'Hasło zostało zmienione. Trwa logowanie…',
    },
    passwordCompromised: { ...plPL.signIn?.passwordCompromised, title: 'Hasło wyciekło' },
    passwordUntrusted: { ...plPL.signIn?.passwordUntrusted, title: 'Hasło niezaufane' },
    protectCheck,
  },
  signUp: {
    ...plPL.signUp,
    start: {
      ...plPL.signUp?.start,
      title: 'Załóż konto',
      titleCombined: 'Załóż konto',
      subtitle: 'Zacznij od pierwszego pokoju i zdobywaj XP.',
      subtitleCombined: 'Zacznij od pierwszego pokoju i zdobywaj XP.',
    },
    emailCode: {
      ...plPL.signUp?.emailCode,
      title: 'Potwierdź adres e-mail',
      subtitle: 'Wpisz kod, który wysłaliśmy na Twoją skrzynkę.',
      formSubtitle: 'Kod znajdziesz w wiadomości od Hackademy',
      resendButton: 'Kod nie dotarł? Wyślij ponownie',
    },
    continue: {
      ...plPL.signUp?.continue,
      subtitle: 'Brakuje jeszcze kilku informacji.',
    },
    protectCheck,
  },
  unstable__errors: {
    ...plPL.unstable__errors,
    form_identifier_not_found: 'Nie ma konta z tym adresem e-mail. Sprawdź adres albo załóż konto.',
    form_code_incorrect: 'Kod jest nieprawidłowy. Sprawdź go i spróbuj ponownie.',
    form_param_type_invalid: 'Wpisana wartość ma nieprawidłowy typ.',
    form_param_type_invalid__email_address: 'Wpisz poprawny adres e-mail.',
    form_param_type_invalid__phone_number: 'Wpisz poprawny numer telefonu.',
    form_password_compromised__sign_in: 'To hasło pojawiło się w wycieku danych. Zresetuj hasło, aby się zalogować.',
    form_password_matches_identifier: 'Hasło nie może być takie samo jak adres e-mail, numer telefonu ani nazwa użytkownika.',
    form_password_untrusted__sign_in: 'Twoje hasło mogło wyciec. Zaloguj się w inny sposób, a potem ustaw nowe hasło.',
    form_new_password_matches_current: 'Nowe hasło musi różnić się od obecnego.',
    action_blocked: 'Nie udało się wykonać tej akcji. Spróbuj ponownie później.',
    oauth_access_denied: 'Nie udzielono dostępu do konta.',
    ticket_expired_code: 'Ten link wygasł. Zacznij od nowa albo poproś o nowy link.',
    ticket_invalid_code: 'Ten link jest nieważny albo został już użyty. Zacznij od nowa albo poproś o nowy link.',
    too_many_unverified_identifications: 'Na tym koncie czeka zbyt wiele niepotwierdzonych danych. Usuń niepotrzebne lub spróbuj za kilka minut.',
    protect_check_execution_failed: 'Weryfikacja nie powiodła się. Spróbuj ponownie.',
    protect_check_invalid_script: 'Nie udało się wczytać weryfikacji. Jeśli problem się powtarza, napisz do nas.',
    protect_check_invalid_sdk_url: 'Nie udało się uruchomić weryfikacji. Napisz do nas.',
    protect_check_required: 'To logowanie wymaga dodatkowej weryfikacji. Spróbuj ponownie lub wybierz inny sposób logowania.',
    protect_check_script_load_failed: 'Nie udało się wczytać weryfikacji. Sprawdź połączenie i spróbuj ponownie.',
    protect_check_timed_out: 'Weryfikacja trwała zbyt długo. Spróbuj ponownie.',
    protect_check_unsupported_environment: 'Ta przeglądarka nie obsługuje weryfikacji. Otwórz stronę w zwykłej przeglądarce.',
  },
};
