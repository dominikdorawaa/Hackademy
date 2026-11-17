import './PremiumCrown.css';

export function PremiumCrown({ className }: { className?: string }) {
  return <span className={['premium-crown', className].filter(Boolean).join(' ')} role="img" aria-label="Premium">
    <span className="premium-crown-sprite" aria-hidden="true" />
  </span>;
}
