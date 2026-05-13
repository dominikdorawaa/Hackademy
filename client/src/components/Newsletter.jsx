import React, { useEffect, useRef, useState } from 'react';

const Newsletter = () => {
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -4% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      style={{
        padding: '60px 0',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'linear-gradient(to bottom, var(--bg-dark), #08101c)',
      }}
    >
      <div
        ref={wrapRef}
        className={`container nl-reveal${inView ? ' nl-reveal--inview' : ''}`}
      >
        <h2 className="section-title" style={{ fontSize: '2rem' }}>Bądź na bieżąco</h2>
        <p style={{ color: 'var(--text-gray)', marginBottom: '2rem' }}>
          Otrzymuj nowe wyzwania i poradniki prosto na maila.
        </p>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '10px' }}>
          <input
            type="email"
            placeholder="Wpisz swój email"
            style={{
              flex: '1',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #374151',
              background: '#1f2937',
              color: 'white',
            }}
          />
          <button type="button" className="btn btn-primary">Subskrybuj</button>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
