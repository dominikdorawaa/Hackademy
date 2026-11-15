# Hackademy glossary

## Profile

- **Practice area:** a room category with at least one solved room. Counts cover all recorded solutions, not just recent activity; they are evidence of practice rather than a certification.
- **Completed path:** a current learning path with at least one room and all its rooms solved by the user. Empty and incomplete paths are excluded. Completion is evaluated against current room membership.
- **Room assignment:** a room placed in one chapter of a path. A room may be assigned to many paths but to only one chapter of each. Its content, solves and XP are shared: solving it once counts in every path that contains it. A player may open it when any published path unlocks it.
- **Activity:** daily solved-room counts in the last eighty-four days shown in the profile calendar.
- **Earned badge:** an awarded achievement with its name, description, acquisition date and percentage of users who earned it.
- **Member profile:** another user's profile available to authenticated members. Copying its URL does not enable anonymous access.
- **Dashboard metrics:** raw XP, progression and recent solutions remain on the dashboard rather than being repeated in the profile.
- **Learning rank:** the title (Freshman to Architect) and level derived from XP, shown in the profile header.
- **Arena league:** the league derived from arena Elo (Script Kiddie to Zero-day), shown in the profile header next to the Elo value and kept distinct from the learning rank.
- **Profile completion:** the share of filled profile elements (avatar, bio, interests and, once a badge has been earned, the badge showcase) shown in the owner's setup prompt.

## Kurs UKOS

**Kurs UKOS**:
Ścieżka nauki podstaw Linuksa oraz HTML i CSS oparta na programie zajęć UKOS. Postęp kursu jest niezależny od globalnego XP i rankingu Hackademy.

**Laboratorium UKOS**:
Część kursu poświęcona określonemu tematowi, łącząca objaśnienia z praktycznymi ćwiczeniami.

**Krok ćwiczenia**:
Pojedynczy cel ucznia zaliczany po poprawnym wykonaniu wymaganego polecenia albo osiągnięciu wymaganego rezultatu.

**Zaliczenie polecenia**:
Potwierdzenie poprawnego wykonania wskazanego polecenia w środowisku ćwiczenia. Samo wpisanie tekstu polecenia nie wystarcza.

**Zaliczenie rezultatu**:
Potwierdzenie wymaganego stanu lub wyniku pracy ucznia. Dopuszcza różne poprawne sposoby rozwiązania, o ile ćwiczenie nie wymaga konkretnej metody.

**Aktywny krok**:
Aktualny cel ucznia podlegający ocenie. Polecenia wykonane przed jego rozpoczęciem nie zaliczają go z wyprzedzeniem.

**Warsztat laboratorium**:
Przestrzeń plików, w której uczeń wykonuje ćwiczenia danego laboratorium. Jej reset nie usuwa zdobytych zaliczeń.

**Egzamin ścieżki**:
Samodzielny sprawdzian bez podpowiedzi w osobnym pokoju na końcu całej ścieżki UKOS. Laboratoria nie kończą się własnym egzaminem.

## Shop

- **Bajt (Byte):** the in-app currency. Code may still call it `coins` (`CoinPackage`, `top_up_orders.coins`); the UI always says Bajt, Bajty or Bajtów.
- **Wallet:** a user's Bajt balance. It never goes below zero and every change is written to the transaction history.
- **Shop item:** a paid dance, outfit or quick chat line. A user owns it after one purchase and owns it forever.
- **Top-up:** an order that turns real money into Bajty through a payment provider. Without a configured provider top-ups are off.
- **Wallet adjustment:** an admin adding or removing Bajty from a user's wallet with a required reason.
