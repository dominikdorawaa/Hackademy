import { bytesWord } from '../../lib/bytes';
import './BytesAmount.css';

const number = new Intl.NumberFormat('pl-PL');

export function BytesAmount({ amount, className = '' }: { amount: number; className?: string }) {
  return <span className={`bytes-amount ${className}`.trim()}>
    <img className="bytes-coin" src="/assets/shop/bajt.png" alt="" width={32} height={32} />
    <span aria-hidden="true">{number.format(amount)}</span>
    <span className="sr-only">{number.format(amount)} {bytesWord(amount)}</span>
  </span>;
}
