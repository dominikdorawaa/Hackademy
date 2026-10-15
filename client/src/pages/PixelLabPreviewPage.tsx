import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import '../components/arena/BattleScene.css';
import './PixelLabPreviewPage.css';

const base = '/assets/arena/pixellab/';
const frames = Array.from({ length: 8 }, (_, index) => `${base}bajt-attack-${index}.png`);

export default function PixelLabPreviewPage() {
  const { reducedMotion } = useTheme();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [systemMotion, setSystemMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const motionDisabled = reducedMotion || systemMotion;
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const change = () => { setSystemMotion(query?.matches ?? false); setPlaying(false); setFrame(0); };
    query?.addEventListener('change', change);
    return () => query?.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!playing || motionDisabled) return;
    const timer = window.setTimeout(() => {
      if (frame === frames.length - 1) { setPlaying(false); setFrame(0); }
      else setFrame(value => value + 1);
    }, 110);
    return () => window.clearTimeout(timer);
  }, [frame, playing, motionDisabled]);
  const stop = () => { setPlaying(false); setFrame(0); };
  const active = playing && !motionDisabled;
  return <div className="arena-prototype pixellab-preview">
    <Link to="/arena/prototype">← Wróć do pojedynku avatarów</Link>
    <header className="arena-prototype-header"><div><h1>Pierwszy wojownik PixelLab</h1>
      <p>Pełna postać i osiem klatek ataku wygenerowanych na podstawie tego samego wzorca.</p></div>
      <span className="arena-prototype-badge">Próbka graficzna</span>
    </header>
    <div className="pixellab-comparison">
      <figure><div className="pixellab-character"><img src={`${base}bajt-idle.png`} alt="Wojownik w granatowej kurtce z niebieskimi detalami, zwrócony w prawo" width="128" height="128" /></div><figcaption>Postać bazowa</figcaption></figure>
      <figure><div className="pixellab-character"><img src={active ? frames[frame] : `${base}bajt-idle.png`} alt="Podgląd ataku energetyczną rękawicą" width="128" height="128" /></div><figcaption>Animacja ataku</figcaption></figure>
    </div>
    <div className="pixellab-playback">
      <Button onClick={() => { setFrame(0); setPlaying(true); }} disabled={active || motionDisabled}>Odtwórz atak</Button>
      <Button variant="outline" onClick={stop} disabled={!active}>Zatrzymaj</Button>
      <p role="status">{motionDisabled ? 'Ograniczenie animacji jest włączone. Wszystkie klatki znajdziesz poniżej.' : active ? 'Odtwarzanie ataku…' : 'Gotowe do odtworzenia.'}</p>
    </div>
    <h2>Klatki do porównania</h2>
    <div className="pixellab-frames">{frames.map((src, index) => <figure key={src}><img src={src} alt={`Klatka ataku ${index + 1}`} width="128" height="128" /><figcaption>{index + 1}</figcaption></figure>)}</div>
    <p className="arena-prototype-note">Materiały wygenerowane w PixelLab. To próbka do oceny wyglądu i spójności ruchu, jeszcze nie postać używana w meczu. Odtwarzanie korzysta z zapisanych plików, bez zapytań do API.</p>
  </div>;
}
