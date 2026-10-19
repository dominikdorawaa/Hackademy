import { render, screen } from '@testing-library/react';
import { plPL } from '@clerk/localizations';
import { dark } from '@clerk/themes';
import { describe, expect, it } from 'vitest';
import AuthLayout from './AuthLayout';
import { clerkAppearance } from './clerkAppearance';
import { clerkLocalization } from './clerkLocalization';

describe('Clerk appearance', () => {
  it('uses the Hackademy dark palette with the brand blue', () => {
    const appearance = clerkAppearance('dark');
    expect(appearance.theme).toBe(dark);
    expect(appearance.variables).toMatchObject({ colorPrimary: '#0b63ff', colorBackground: '#151f30', borderRadius: '6px' });
    expect(appearance.captcha).toEqual({ theme: 'dark', size: 'flexible' });
    expect(appearance.options).toMatchObject({ animations: true });
  });

  it('switches every colour for the light theme', () => {
    const appearance = clerkAppearance('light');
    expect(appearance.theme).toBeUndefined();
    expect(appearance.variables).toMatchObject({ colorBackground: '#f9fafb', colorForeground: '#111827', colorRing: '#0b55db' });
    expect(appearance.captcha).toEqual({ theme: 'light', size: 'flexible' });
  });

  it('turns motion off when the learner asks for less motion', () => {
    const appearance = clerkAppearance('dark', true);
    const elements = appearance.elements as Record<string, Record<string, unknown>>;
    expect(appearance.options).toMatchObject({ animations: false });
    expect(elements.formButtonPrimary.transition).toBe('none');
    expect(elements.formButtonPrimary['&:hover']).toMatchObject({ transform: 'none' });
  });

  it('keeps code steps aligned and readable', () => {
    const elements = clerkAppearance('dark').elements as Record<string, Record<string, unknown>>;
    expect(elements.identityPreview).toMatchObject({ alignSelf: 'flex-start', width: 'auto', justifyContent: 'flex-start' });
    expect(elements.otpCodeFieldInputs).toMatchObject({ justifyContent: 'flex-start' });
    expect(elements.formResendCodeLink['&:disabled, &[data-disabled]']).toEqual({ color: '#9eabbf', opacity: 1 });
    expect(elements.otpCodeFieldInput['&[data-variant="default"][data-focus-within="true"]']).toEqual({ boxShadow: '0 0 0 2px #6ea2ff, 0 0 0 5px rgba(110, 162, 255, 0.35)' });
  });

  it('respects the system reduced motion setting by default', () => {
    const elements = clerkAppearance('dark').elements as Record<string, Record<string, unknown>>;
    expect(elements.formButtonPrimary['@media (prefers-reduced-motion: reduce)']).toEqual({ transition: 'none' });
    expect(elements.formButtonPrimary['&:hover']).toMatchObject({ transform: 'translateY(-1px)' });
  });
});

describe('Clerk localization', () => {
  it('fills the Polish gaps and keeps the rest of plPL', () => {
    expect(clerkLocalization.formFieldInputPlaceholder__signUpPassword).toBe('Utwórz hasło');
    expect(clerkLocalization.formFieldAction__forgotPassword).toBe('Nie pamiętasz hasła?');
    expect(clerkLocalization.signUp?.start?.title).toBe('Załóż konto');
    expect(clerkLocalization.signIn?.protectCheck?.title).toBe('Sprawdzamy Twoje żądanie');
    expect(clerkLocalization.unstable__errors?.form_code_incorrect).toMatch(/Kod jest nieprawidłowy/);
    expect(clerkLocalization.signIn?.start?.actionLink).toBe(plPL.signIn?.start?.actionLink);
    expect(clerkLocalization.unstable__errors?.form_password_incorrect).toBe(plPL.unstable__errors?.form_password_incorrect);
  });
});

describe('AuthLayout', () => {
  it('shows the heading, the lead and what Hackademy offers next to the form', () => {
    render(<AuthLayout heading={['Zdobywaj flagi.', 'Ucz się.']} lead="Po polsku."><form aria-label="Formularz" /></AuthLayout>);
    expect(screen.getByRole('heading', { level: 2, name: 'Zdobywaj flagi. Ucz się.' })).toBeInTheDocument();
    expect(screen.getByText('Po polsku.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('form', { name: 'Formularz' })).toBeInTheDocument();
  });
});
