import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import BattleScene from '../components/arena/BattleScene';
import type { BattleKind, BattleResult, BattleSide } from '../components/arena/battleAnimation';

const avatars = ['prototype-alpha', 'prototype-bravo', 'prototype-charlie', 'prototype-delta', 'prototype-echo', 'prototype-foxtrot'];

export default function ArenaPrototypePage() {
  const { reducedMotion } = useTheme();
  const [systemMotion, setSystemMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [seeds, setSeeds] = useState([avatars[0], avatars[1]]);
  const [hp, setHp] = useState([100, 100]);
  const [attacker, setAttacker] = useState<BattleSide>('left');
  const [result, setResult] = useState<BattleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState('Wybierz scenariusz, żeby zobaczyć animację walki.');
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setSystemMotion(query?.matches ?? false);
    query?.addEventListener('change', update);
    return () => query?.removeEventListener('change', update);
  }, []);
  const impact = useCallback((event: BattleResult) => {
    if (event.kind === 'clash') { setMessage('Obaj poprawnie. Pociski się znoszą, HP bez zmian.'); return; }
    const target = event.attacker === 'left' ? 1 : 0;
    setHp(previous => previous.map((value, index) => index === target ? event.kind === 'defeat' ? 0 : Math.max(0, value - 20) : value));
    setMessage(event.kind === 'defeat' ? `${event.attacker === 'left' ? 'Bajt' : 'Iskra'} wygrywa pojedynek.` : `${target === 0 ? 'Bajt' : 'Iskra'} traci 20 HP.`);
  }, []);
  const complete = useCallback(() => setBusy(false), []);
  const reset = () => {
    setGeneration(value => value + 1); setResult(null); setHp([100, 100]); setBusy(false);
    setMessage('Nowa próba. Obaj gracze mają 100 HP.');
  };
  const play = (kind: BattleKind) => {
    if (busy || hp.some(value => value === 0)) return;
    if (kind === 'hit' && hp[attacker === 'left' ? 1 : 0] <= 20) kind = 'defeat';
    if (kind === 'defeat') setHp(previous => previous.map((value, index) => index === (attacker === 'left' ? 1 : 0) ? 20 : value));
    setBusy(true); setMessage(kind === 'clash' ? 'Obaj wojownicy przygotowują atak…' : 'Ładowanie pocisku…');
    setResult({ id: crypto.randomUUID(), kind, attacker });
  };
  const locked = busy || hp.some(value => value === 0);
  return <div className="arena-prototype">
    <Link to="/arena">← Wróć do Areny</Link>
    <header className="arena-prototype-header"><div><h1>Pojedynek avatarów</h1>
      <p>Poprawna odpowiedź to atak. Dwie poprawne odpowiedzi to zderzenie pocisków i zero obrażeń.</p></div>
      <span className="arena-prototype-badge">Podgląd animacji</span>
    </header>
    <BattleScene key={generation} left={{ name: 'Bajt', avatarSeed: seeds[0], hp: hp[0] }} right={{ name: 'Iskra', avatarSeed: seeds[1], hp: hp[1] }}
      result={result} reducedMotion={reducedMotion || systemMotion} onImpact={impact} onComplete={complete} />
    <p className="arena-prototype-status" role="status" aria-live="polite" aria-atomic="true">{message}</p>
    <div className="arena-prototype-controls">
      <fieldset disabled={locked}><legend>Atakujący</legend><div>
        <label><input type="radio" name="attacker" checked={attacker === 'left'} onChange={() => setAttacker('left')} />Bajt</label>
        <label><input type="radio" name="attacker" checked={attacker === 'right'} onChange={() => setAttacker('right')} />Iskra</label>
      </div></fieldset>
      <div className="arena-prototype-actions">
        <Button disabled={locked} onClick={() => play('hit')}>Trafienie</Button>
        <Button variant="outline" disabled={locked} onClick={() => play('clash')}>Zderzenie pocisków</Button>
        <Button variant="outline" disabled={locked} onClick={() => play('defeat')}>Porażka</Button>
        <Button variant="ghost" disabled={busy} onClick={reset}>Reset</Button>
      </div>
    </div>
    <div className="arena-prototype-avatars">{(['Bajt', 'Iskra'] as const).map((name, index) => <label key={name}>Avatar: {name}
      <select value={seeds[index]} disabled={busy} onChange={event => { const value = event.target.value; setSeeds(previous => previous.map((seed, position) => index === position ? value : seed)); reset(); }}>
        {avatars.map((seed, option) => <option key={seed} value={seed}>Wariant {option + 1}</option>)}
      </select>
    </label>)}</div>
    <p className="arena-prototype-note">Dane demonstracyjne. Podgląd nie zmienia Elo ani wyników meczów.{reducedMotion || systemMotion ? ' Ograniczenie animacji jest włączone.' : ''}</p>
  </div>;
}
