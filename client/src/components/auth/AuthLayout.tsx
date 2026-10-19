import '../../pages/Auth.css';
import { Fragment } from 'react';
import type { PropsWithChildren } from 'react';

const points = [
  { title: 'Ścieżki nauki', text: 'Pokoje CTF ułożone krok po kroku, od podstaw.' },
  { title: 'Arena', text: 'Pojedynki na żywo i ranking Elo.' },
  { title: 'Postępy', text: 'XP, poziomy i ranking ze znajomymi.' },
];

type AuthLayoutProps = PropsWithChildren<{ heading: string[]; lead: string }>;

const AuthLayout = ({ children, heading, lead }: AuthLayoutProps) => {
  return (
    <div className="auth-page">
      <aside className="auth-intro" aria-label="Hackademy">
        <div>
          <h2 className="auth-intro-title">{heading.map((line, index) => <Fragment key={line}>{index > 0 && ' '}<span>{line}</span></Fragment>)}</h2>
          <p className="auth-intro-lead">{lead}</p>
        </div>
        <ul className="auth-points">
          {points.map(point => (
            <li key={point.title}>
              <div>
                <strong>{point.title}</strong>
                <span>{point.text}</span>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <div className="auth-form">{children}</div>
    </div>
  );
};

export default AuthLayout;
