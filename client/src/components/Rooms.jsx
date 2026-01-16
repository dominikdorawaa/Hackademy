import React from 'react';

const Rooms = () => {
  return (
    <section className="rooms-showcase" id="rooms">
      <div className="container">
        <h2 className="section-title">Przegląd Pokoi</h2>
        <p className="section-subtitle">
          Zobacz, nad czym pracują inni. Zarejestruj się, aby uzyskać dostęp.
        </p>

        <div className="rooms-grid">
          <div className="room-card">
            <div className="room-top-badge"><i className="fas fa-lock"></i></div>
            <div className="room-image-placeholder">
              <span className="difficulty-badge diff-easy">Łatwy</span>
            </div>
            <div className="room-body">
              <h3 className="room-title">Podstawy Pentestingu</h3>
              <div className="room-tags">Web • OWASP • Security</div>

              <div className="room-locked-footer">
                <span className="lock-info"
                  ><i className="fas fa-user-lock"></i> Wymagane konto</span
                >
                <span>2,403 graczy</span>
              </div>
            </div>
          </div>

          <div className="room-card">
            <div className="room-top-badge"><i className="fas fa-lock"></i></div>
            <div className="room-image-placeholder">
              <span className="difficulty-badge diff-medium">Średni</span>
            </div>
            <div className="room-body">
              <h3 className="room-title">Eskalacja Linuxa</h3>
              <div className="room-tags">Linux • PrivEsc • Bash</div>

              <div className="room-locked-footer">
                <span className="lock-info"
                  ><i className="fas fa-user-lock"></i> Wymagane konto</span
                >
                <span>1,100 graczy</span>
              </div>
            </div>
          </div>

          <div className="room-card">
            <div className="room-top-badge"><i className="fas fa-lock"></i></div>
            <div className="room-image-placeholder">
              <span className="difficulty-badge diff-hard">Trudny</span>
            </div>
            <div className="room-body">
              <h3 className="room-title">Buffer Overflow Prep</h3>
              <div className="room-tags">Binary • Exploit • Reverse</div>

              <div className="room-locked-footer">
                <span className="lock-info"
                  ><i className="fas fa-user-lock"></i> Wymagane konto</span
                >
                <span>850 graczy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Rooms;
