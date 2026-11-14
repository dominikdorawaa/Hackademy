import { bytesNumber, bytesWord } from '../../lib/bytes';
import './BytesAmount.css';


export function BytesAmount({ amount, className = '' }: { amount: number; className?: string }) {
  return <span className={`bytes-amount ${className}`.trim()}>
    <img className="bytes-coin" src="/assets/shop/bajt.png" alt="" width={32} height={32} />
    <span aria-hidden="true">{bytesNumber.format(amount)}</span>
    <span className="sr-only">{bytesNumber.format(amount)} {bytesWord(amount)}</span>
  </span>;
}
