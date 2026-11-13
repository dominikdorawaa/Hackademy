import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { AvatarSprite } from '../components/arena/avatar/AvatarSprite';
import { useAvatarAtlas } from '../components/arena/avatar/useAvatarAtlas';
import { AVATAR_ATLASES } from '../components/arena/avatar/fighters';
import { DEFAULT_AVATAR, fromAvatarConfig } from '../components/arena/avatar/avatarModel';
import type { VictoryDance } from '../components/arena/avatar/avatarModel';
import { DANCE_OPTIONS, OUTFITS } from '../components/arena/avatar/avatarOptions';
import { dancePreview } from '../components/arena/avatar/movePreviews';
import { findReaction } from '../components/arena/battle/quickChat';
import { BytesAmount } from '../components/shop/BytesAmount';
import { BalanceCard } from '../components/shop/BalanceCard';
import { PixelSprite } from '../components/PixelSprite';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { buyItem, errorMessage } from '../services/shopApi';
import { formatBytes } from '../lib/bytes';
import type { ShopCategory, ShopItem } from '../types/api';
import '../components/room/room.css';
import './ShopPage.css';

const TABS: { id: ShopCategory; label: string; empty: string }[] = [
  { id: 'DANCE', label: 'Tańce', empty: '' },
  { id: 'OUTFIT', label: 'Ubrania', empty: 'Nowe stroje pojawią się w Sklepie wkrótce.' },
  { id: 'QUICK_CHAT', label: 'Teksty do czatu', empty: '' },
];

export function describeItem(item: ShopItem) {
  if (item.category === 'DANCE') {
    const dance = DANCE_OPTIONS[item.reference as VictoryDance];
    return { name: `Taniec ${dance?.name ?? item.reference}`, description: `${dance?.description ?? ''} Zatańczysz go po wygranej i z szybkiego czatu.`.trim() };
  }
  if (item.category === 'QUICK_CHAT') {
    const reaction = findReaction(item.reference);
    return { name: reaction?.text ?? item.reference, description: `${reaction?.meaning ? `${reaction.meaning} ` : ''}Do szybkiego czatu w walce i na podium.` };
  }
  const outfit = OUTFITS.find(entry => entry.id === item.reference);
  return { name: outfit?.name ?? item.reference, description: outfit?.description ?? '' };
}

function DancePreview({ dance }: { dance: VictoryDance }) {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const avatar = { ...(fromAvatarConfig(user?.avatar) ?? DEFAULT_AVATAR), dance };
  const atlas = useAvatarAtlas(avatar);
  if (!atlas) return <span className="shop-item-stage" aria-hidden="true" />;
  return <span className="shop-item-stage">
    <AvatarSprite atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[avatar.outfit].atlasHeight} frames={dancePreview(dance, reduced)} frameTime={110}
      reducedMotion={reduced} label={`Podgląd tańca ${DANCE_OPTIONS[dance]?.name ?? dance} na Twoim awatarze`} />
  </span>;
}

function ChatPreview({ reference }: { reference: string }) {
  const reduced = useReducedMotion();
  const reaction = findReaction(reference);
  const sprite = reaction?.sprite;
  return <span className="shop-item-stage">
    {sprite ? <PixelSprite sprite={sprite} scale={sprite.width > 60 ? 2 : 3} duration={sprite.frames * 110} still={reduced} />
      : <span className="shop-item-bubble">{reaction?.text ?? reference}</span>}
  </span>;
}

function ItemPreview({ item }: { item: ShopItem }) {
  if (item.category === 'DANCE') return <DancePreview dance={item.reference as VictoryDance} />;
  if (item.category === 'QUICK_CHAT') return <ChatPreview reference={item.reference} />;
  return <span className="shop-item-stage" aria-hidden="true" />;
}

function ItemCard({ item, balance, busy, onBuy }: { item: ShopItem; balance: number; busy: boolean; onBuy: (item: ShopItem) => void }) {
  const { name, description } = describeItem(item);
  const short = balance < item.price;
  return <li className="shop-item" data-owned={item.owned || undefined}>
    <ItemPreview item={item} />
    <div className="shop-item-body">
      <h3>{name}</h3>
      <p>{description}</p>
    </div>
    <div className="shop-item-foot">
      {item.owned ? <>
        <span className="shop-owned"><Check size={16} aria-hidden="true" />Kupione</span>
        {item.category === 'DANCE' && <Link className="shop-link" to="/arena/avatar">Ustaw w kreatorze</Link>}
      </> : <>
        <BytesAmount amount={item.price} className="shop-price" />
        <button type="button" className="shop-button" disabled={busy || short} onClick={() => onBuy(item)}
          aria-label={`Kup ${name} za ${formatBytes(item.price)}`}>
          {short && <Lock size={14} aria-hidden="true" />}{short ? 'Za mało Bajtów' : 'Kup'}
        </button>
        {short && <Link className="shop-link" to="/shop/top-up">Doładuj</Link>}
      </>}
    </div>
  </li>;
}

export default function ShopPage() {
  const { sessionKey } = useAuth();
  const { shop, status, refresh, replace } = useShop();
  const [tab, setTab] = useState<ShopCategory>('DANCE');
  const [confirm, setConfirm] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const auth = { sessionKey };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try { await work(); }
    catch { setMessage({ kind: 'error', text: 'Nie udało się połączyć z serwerem.' }); }
    finally { setBusy(false); }
  };

  const buy = (item: ShopItem) => run(async () => {
    setConfirm(null);
    const response = await buyItem(item.id, auth);
    if (!response.ok) { setMessage({ kind: 'error', text: await errorMessage(response, 'Nie udało się kupić przedmiotu.') }); refresh(); return; }
    replace(await response.json());
    setMessage({ kind: 'ok', text: `Kupione: ${describeItem(item).name}.` });
  });

  const moveTab = (event: KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = (next + TABS.length) % TABS.length;
    setTab(TABS[target].id);
    tabs.current[target]?.focus();
  };

  const current = TABS.find(entry => entry.id === tab)!;
  const items = shop?.items.filter(item => item.category === tab) ?? [];

  return <div className="room-tokens shop-page">
    <section className="shop-hero" aria-labelledby={`${id}-title`}>
      <div className="shop-hero-inner">
        <div>
          <h1 id={`${id}-title`}>Sklep</h1>
          <p>Za Bajty kupisz nowe tańce, stroje i teksty do szybkiego czatu w Arenie.</p>
        </div>
        <BalanceCard balance={shop?.balance ?? null} topUp />
      </div>
    </section>

    <div className="shop-shell">
      {message && <p className={`shop-message is-${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {status === 'error' && !shop && <p className="shop-message is-error" role="alert">
        Nie udało się wczytać Sklepu. <button type="button" className="shop-link" onClick={refresh}>Spróbuj ponownie</button>
      </p>}

      <div className="shop-tabs" role="tablist" aria-label="Kategorie Sklepu">
        {TABS.map((entry, index) => <button key={entry.id} ref={element => { tabs.current[index] = element; }} type="button" role="tab"
          id={`${id}-tab-${entry.id}`} aria-selected={tab === entry.id} aria-controls={`${id}-panel`} tabIndex={tab === entry.id ? 0 : -1}
          onClick={() => setTab(entry.id)} onKeyDown={event => moveTab(event, index)}>{entry.label}</button>)}
      </div>

      <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} className="shop-panel">
        {!shop ? <p className="shop-empty">{status === 'error' ? 'Sklep jest chwilowo niedostępny.' : 'Wczytuję Sklep…'}</p>
          : items.length === 0 ? <p className="shop-empty">{current.empty}</p>
          : <ul className="shop-items">{items.map(item => <ItemCard key={item.id} item={item} balance={shop.balance} busy={busy} onBuy={setConfirm} />)}</ul>}
      </section>

    </div>

    <AlertDialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kupić {confirm ? describeItem(confirm).name : ''}?</AlertDialogTitle>
          <AlertDialogDescription>
            {confirm && shop ? `Zapłacisz ${formatBytes(confirm.price)}. Po zakupie zostanie Ci ${formatBytes(shop.balance - confirm.price)}.` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (confirm) void buy(confirm); }}>Kup</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </div>;
}
