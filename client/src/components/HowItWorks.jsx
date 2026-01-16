import React from 'react';

const HowItWorks = () => {
  return (
    <section className="how-it-works">
      <div className="container">
        <h2 className="section-title">Jak To Działa?</h2>
        <p className="section-subtitle">
          Rozpocznij swoją przygodę w 3 prostych krokach.
        </p>

        <div className="steps-grid">
          <div className="step-item">
            <div className="step-icon-box icon-blue">
              <i className="fas fa-door-open"></i>
            </div>
            <h3>Wybierz Pokój</h3>
            <p>
              Wybieraj spośród ponad 1200 pokoi CTF o różnym poziomie trudności
              i tematyce, od Web po Forensics.
            </p>
          </div>

          <div className="step-item">
            <div className="step-icon-box icon-red">
              <i className="fas fa-puzzle-piece"></i>
            </div>
            <h3>Rozwiąż Zadania</h3>
            <p>
              Pracuj nad praktycznymi wyzwaniami cyberbezpieczeństwa i ucz się
              poprzez działanie w przeglądarce.
            </p>
          </div>

          <div className="step-item">
            <div className="step-icon-box icon-purple">
              <i className="fas fa-trophy"></i>
            </div>
            <h3>Zdobywaj Odznaki</h3>
            <p>
              Zbieraj osiągnięcia i wspinaj się w rankingu, opanowując nowe
              umiejętności i techniki.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
