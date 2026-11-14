import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { bytesNumber, bytesWord } from '../../lib/bytes';


export function BalanceCard({ balance, topUp = false }: { balance: number | null; topUp?: boolean }) {
  return <div className="shop-balance" aria-live="polite">
    <img className="shop-balance-coin" src="/assets/shop/bajt.png" alt="" width={48} height={48} />
    <div className="shop-balance-text">
      <span className="shop-balance-label">Twoje saldo</span>
      {balance === null ? <span className="shop-balance-amount">…</span> : <span className="shop-balance-amount">
        <span aria-hidden="true">{bytesNumber.format(balance)}</span>
        <span className="sr-only">{bytesNumber.format(balance)} {bytesWord(balance)}</span>
      </span>}
    </div>
    {topUp && <Link className="shop-balance-action" to="/shop/top-up" aria-label="Doładuj Bajty"><Plus size={18} aria-hidden="true" />Doładuj</Link>}
  </div>;
}
