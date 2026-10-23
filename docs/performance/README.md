# Wydajność klasy i wielu kart

Realizacja #206 jest podzielona na cztery PR, do przeglądu i scalania w kolejności etapów. Każdy następny PR bazuje na poprzednim.

1. [Awarie i limity](classroom-stage-one.md): PR #235.
2. [Żądania na kartę](classroom-stage-two.md): PR #236.
3. [SQL, cache i pamięć](classroom-stage-three.md): PR #237.
4. [Ładowanie i pomiar końcowy](classroom-stage-four.md): czwarty PR serii.

Potwierdzone lokalnie: brak błędów dla 30 i 300 jednoczesnych żądań dashboardu, osiem razy mniej regularnych żądań na bezczynny dashboard, stałe 4 SQL serwisu społecznościowego dla 5 i 30 znajomych oraz główny JS mniejszy o 47,30%.

## Odtworzenie w PowerShell

Wymagany Docker i Java 17 lub nowsza. Polecenia działają na izolowanym PostgreSQL z Testcontainers, bez połączenia z bazą produkcyjną.

```powershell
$env:JAVA_TOOL_OPTIONS = '-Xmx160m'
mvn -f server/pom.xml '-Dtest=ClassroomEntryLoadTest,RealtimeQueryBudgetTest' test
mvn -f server/pom.xml '-Dtest=ClassroomHttpLoadTest' '-Dclassroom.http=true' '-Dclassroom.minutes=3' test
Remove-Item Env:\JAVA_TOOL_OPTIONS
```

Raporty powstają w server/target: classroom-stage-one.json, realtime-query-budget.json, friendship-query-plans.txt i classroom-http.json. Pliki w tym katalogu zachowują wyniki konkretnych przebiegów.

Sam test obciążenia nie zastępuje kontroli produkcji. Poszczególne raporty rozróżniają pomiar sterty od RSS, MockMvc od HTTP i klienta STOMP od prawdziwej przeglądarki.
