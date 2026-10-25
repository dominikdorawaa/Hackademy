import type { ClerkProvider } from '@clerk/react';
import type { ComponentProps } from 'react';
import { dark } from '@clerk/themes';

type ClerkAppearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>;

const palettes = {
  dark: {
    surface: '#151f30',
    raised: '#1c2840',
    track: '#26344f',
    field: '#0f1724',
    ink: '#e8edf5',
    muted: '#9eabbf',
    border: '#7a8cab',
    hairline: 'rgba(255, 255, 255, 0.08)',
    link: '#6ea2ff',
    ring: 'rgba(110, 162, 255, 0.35)',
    dangerRing: 'rgba(255, 138, 128, 0.3)',
    hover: '#0a55db',
    danger: '#ff8a80',
    success: '#2fd0b0',
    warning: '#e3b341',
  },
  light: {
    surface: '#f9fafb',
    raised: '#eef1f6',
    track: '#cfd7e3',
    field: '#ffffff',
    ink: '#111827',
    muted: '#4b5563',
    border: '#6b7385',
    hairline: 'rgba(15, 23, 36, 0.1)',
    link: '#0b55db',
    ring: 'rgba(11, 85, 219, 0.25)',
    dangerRing: 'rgba(198, 40, 40, 0.2)',
    hover: '#0845b8',
    danger: '#c62828',
    success: '#0a7d68',
    warning: '#8a5d00',
  },
};

const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
const font = 'Archivo, system-ui, sans-serif';

export function clerkAppearance(theme: string, reducedMotion = false): ClerkAppearance {
  const isDark = theme === 'dark';
  const still = { transition: 'none' };
  const motion = reducedMotion ? still : { '@media (prefers-reduced-motion: reduce)': still };
  const shift = (y: string) => reducedMotion
    ? { transform: 'none' }
    : { transform: `translateY(${y})`, '@media (prefers-reduced-motion: reduce)': { transform: 'none' } };
  const c = isDark ? palettes.dark : palettes.light;
  const focus = { outline: `2px solid ${c.link}`, outlineOffset: '3px', boxShadow: 'none' };
  const button = {
    minHeight: '48px',
    borderRadius: '6px',
    fontFamily: font,
    fontSize: '1rem',
    fontWeight: 650,
    textTransform: 'none' as const,
    letterSpacing: 'normal',
    transition: `background-color 160ms ${ease}, transform 160ms ${ease}`,
    '&:active': shift('1px'),
    '&:focus-visible': focus,
    ...motion,
  };
  const variant = '&[data-variant="default"]';
  const focused = `${variant}:focus-within, ${variant}[data-focus-within="true"]`;
  const invalid = `${variant}[data-feedback="error"]`;
  const fieldOutline = {
    [variant]: { boxShadow: `0 0 0 1px ${c.border}` },
    [`${variant}:hover`]: { boxShadow: `0 0 0 1px ${c.muted}` },
    [focused]: { boxShadow: `0 0 0 1px ${c.link}, 0 0 0 4px ${c.ring}` },
    [invalid]: { boxShadow: `0 0 0 1px ${c.danger}` },
    [`${invalid}:focus-within, ${invalid}[data-focus-within="true"]`]: { boxShadow: `0 0 0 1px ${c.danger}, 0 0 0 4px ${c.dangerRing}` },
  };

  return {
    theme: isDark ? dark : undefined,
    captcha: { theme: isDark ? 'dark' : 'light', size: 'flexible' },
    options: {
      socialButtonsPlacement: 'top',
      socialButtonsVariant: 'auto',
      logoPlacement: 'none',
      animations: !reducedMotion,
    },
    variables: {
      colorPrimary: '#0b63ff',
      colorPrimaryForeground: '#ffffff',
      colorBackground: c.surface,
      colorForeground: c.ink,
      colorMuted: c.raised,
      colorMutedForeground: c.muted,
      colorInput: c.field,
      colorInputForeground: c.ink,
      colorBorder: c.border,
      colorRing: c.link,
      colorDanger: c.danger,
      colorSuccess: c.success,
      colorWarning: c.warning,
      colorShadow: 'transparent',
      fontFamily: font,
      fontFamilyButtons: font,
      fontSize: '1rem',
      borderRadius: '6px',
    },
    elements: {
      rootBox: { width: '100%' },
      cardBox: { width: '100%', maxWidth: 'none', borderRadius: '6px', border: 'none', boxShadow: 'none', background: c.surface },
      card: { background: c.surface, border: 'none', boxShadow: 'none', borderRadius: 0, padding: '32px 28px 24px', gap: '28px', '@media (max-width: 900px)': { padding: '24px 20px 20px', gap: '24px' } },
      header: { alignItems: 'flex-start', textAlign: 'left', gap: '6px' },
      headerTitle: { fontSize: '1.75rem', fontWeight: 800, fontStretch: '85%', letterSpacing: '-0.02em', lineHeight: 1.1, color: c.ink },
      headerSubtitle: { fontSize: '0.9375rem', color: c.muted, lineHeight: 1.5 },
      main: { gap: '24px' },
      socialButtons: { gap: '12px' },
      socialButtonsBlockButton: {
        ...button,
        background: c.raised,
        color: c.ink,
        border: 'none',
        boxShadow: `inset 0 0 0 1px ${c.hairline}`,
        '&:hover': { background: c.track },
      },
      socialButtonsProviderIcon__github: { filter: 'none' },
      socialButtonsBlockButtonText: { fontSize: '1rem', fontWeight: 650, color: c.ink },
      socialButtonsIconButton: { ...button, background: c.raised, border: 'none', boxShadow: `inset 0 0 0 1px ${c.hairline}`, '&:hover': { background: c.track } },
      dividerLine: { background: c.track },
      dividerText: { color: c.muted, fontSize: '0.875rem' },
      form: { gap: '20px' },
      formFieldLabel: { fontSize: '0.875rem', fontWeight: 600, color: c.ink },
      formFieldInput: {
        minHeight: '48px',
        borderRadius: '6px',
        fontSize: '1rem',
        background: c.field,
        color: c.ink,
        transition: `box-shadow 160ms ${ease}`,
        ...motion,
        '&::placeholder': { color: c.muted, opacity: 1 },
        ...fieldOutline,
      },
      formFieldInputShowPasswordButton: { color: c.muted, '&:hover': { color: c.ink }, '&:focus-visible': focus },
      formFieldAction: { color: c.link, fontWeight: 600, fontSize: '0.875rem' },
      formFieldHintText: { color: c.muted },
      formFieldErrorText: { color: c.danger, fontSize: '0.875rem' },
      formFieldSuccessText: { color: c.success, fontSize: '0.875rem' },
      formFieldWarningText: { color: c.warning, fontSize: '0.875rem' },
      formButtonPrimary: {
        ...button,
        background: '#0b63ff',
        backgroundImage: 'none',
        color: '#ffffff',
        border: 'none',
        boxShadow: 'none',
        '&::after': { display: 'none' },
        '&:hover': { background: c.hover, ...shift('-1px') },
        '&:hover:active': shift('1px'),
      },
      buttonArrowIcon: { display: 'none' },
      formHeader: { alignItems: 'flex-start', textAlign: 'left' },
      formHeaderTitle: { color: c.ink, fontWeight: 600 },
      formHeaderSubtitle: { color: c.muted },
      formResendCodeLink: {
        alignSelf: 'flex-start',
        padding: 0,
        color: c.link,
        fontSize: '0.9375rem',
        fontWeight: 600,
        opacity: 1,
        '&:hover': { color: c.link, textDecoration: 'underline', textUnderlineOffset: '4px' },
        '&:disabled, &[data-disabled]': { color: c.muted, opacity: 1 },
        '&:focus-visible': { ...focus, borderRadius: '4px' },
      },
      // Clerk positions the OTP feedback absolutely inside an unnamed wrapper, so the field must stretch
      // to give that wrapper a width, and the text spans it instead of shrinking to min-content.
      otpCodeField: { alignSelf: 'stretch', alignItems: 'stretch', gap: '16px' },
      otpCodeFieldErrorText: { left: 0, right: 0 },
      otpCodeFieldSuccessText: { left: 0, right: 0 },
      otpCodeFieldInputContainer: { alignSelf: 'flex-start' },
      otpCodeFieldInputs: { justifyContent: 'flex-start', gap: '8px' },
      otpCodeFieldInput: {
        '&&': {
          width: '48px',
          height: '52px',
          borderRadius: '6px',
          fontSize: '1.375rem',
          fontWeight: 700,
          background: c.field,
          color: c.ink,
          '@media (max-width: 420px)': { width: '44px', height: '48px' },
        },
        [variant]: { borderWidth: 0, boxShadow: `0 0 0 1px ${c.border}` },
        [`${variant}:has(> div)`]: { boxShadow: `0 0 0 1px ${c.muted}` },
        [`${variant}[data-focus-within="true"]`]: { boxShadow: `0 0 0 2px ${c.link}, 0 0 0 5px ${c.ring}` },
        [`${variant}[data-feedback="success"]`]: { boxShadow: `0 0 0 1px ${c.success}` },
        [`${variant}[data-feedback="error"]`]: { boxShadow: `0 0 0 1px ${c.danger}` },
      },
      identityPreview: {
        alignSelf: 'flex-start',
        width: 'auto',
        maxWidth: '100%',
        justifyContent: 'flex-start',
        gap: '8px',
        marginTop: '6px',
        padding: '4px 4px 4px 12px',
        background: c.raised,
        border: 'none',
        borderRadius: '6px',
      },
      identityPreviewText: { color: c.ink, fontSize: '0.9375rem', textAlign: 'left' },
      identityPreviewEditButton: { color: c.link, '&:focus-visible': focus },
      alternativeMethodsBlockButton: {
        ...button,
        background: c.raised,
        color: c.ink,
        border: 'none',
        boxShadow: `inset 0 0 0 1px ${c.hairline}`,
        '&:hover': { background: c.track },
      },
      backLink: { color: c.link, fontWeight: 600 },
      alert: { borderRadius: '6px', border: 'none', background: c.raised },
      alertText: { color: c.ink },
      footer: { background: c.surface },
      footerAction: {
        '&&': { alignSelf: 'stretch', margin: 0, padding: '16px 28px 20px', justifyContent: 'flex-start' },
        '@media (max-width: 900px)': { '&&': { padding: '16px 20px 20px' } },
      },
      footerActionText: { color: c.muted, fontSize: '0.9375rem' },
      footerActionLink: {
        color: c.link,
        fontWeight: 600,
        fontSize: '0.9375rem',
        textDecoration: 'underline',
        textDecorationColor: 'transparent',
        textUnderlineOffset: '4px',
        transition: `text-decoration-color 160ms ${ease}`,
        ...motion,
        '&:hover': { color: c.link, textDecorationColor: 'currentColor' },
        '&:focus-visible': { ...focus, borderRadius: '4px' },
      },
    },
  };
}
