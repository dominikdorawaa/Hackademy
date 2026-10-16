# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Polish-speaking beginner-to-intermediate learners of cybersecurity (students). After signing in they land on the dashboard to return to their current learning path, see their progress, and check where they stand against others.

Secondary: experts who author CTF rooms and paths, and administrators who run the platform (separate admin panel).

## Product Purpose

Hackademy teaches cybersecurity through hands-on CTF (Capture The Flag) exercises in isolated lab environments, in Polish. Success means a learner keeps coming back, finishes rooms and paths, and grows in skill measured by solved rooms, XP and level.

## Positioning

Two mechanisms carry the product, and both should be visible in it:

- **Structured learning paths:** ordered rooms that guide a learner step by step, with locked, in-progress and solved states.
- **Live competition:** a real-time Arena, Elo rating, ranking and friends.

## Operating Context

- Rooms (CTF tasks) belong to paths; each room has a difficulty (EASY, MEDIUM, HARD, INSANE) and an XP reward.
- Progression: XP gives a level (100 XP per level) and a rank title (Freshman, Junior, Apprentice, Developer, Senior, Architect).
- Hints, a tutorial, badges, friends, a public ranking, member profiles with an 84-day activity calendar.
- Users switch between dark and light themes.

## Capabilities and Constraints

- React + Vite + Tailwind v4 frontend, Spring Boot + PostgreSQL backend, JWT auth, STOMP/SockJS realtime.
- Interface language is Polish.
- Terminology lives in `docs/glossary.md`. Dashboard metrics (XP, level, progression, Elo, recent solutions) live on the dashboard, not the profile.

## Brand Commitments

- The name **Hackademy**.
- The brand blue `#0b63ff`.

Everything else (typefaces, grounds, component style) may change.

## Evidence on Hand

Real product data only: rooms, paths, ranking and user stats come from the API. No testimonials, user counts or partners exist; do not invent them.

## Product Principles

1. The next step is always obvious: a learner sees where they stopped and how to continue.
2. Progress is earned and measurable: show real solved rooms, XP and rank, never vanity numbers.
3. Learning and competition live side by side; neither hides the other.
4. Polish first: copy reads naturally in Polish.
