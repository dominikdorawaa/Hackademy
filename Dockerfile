# Etap 1: Budowanie aplikacji
FROM maven:3.9-eclipse-temurin-17 AS build
# Ustawiamy katalog roboczy
WORKDIR /app
# Kopiujemy pliki
COPY . .
# Budujemy aplikację (dodajemy flagę wskazującą lokalizację pom.xml jeśli jest głębiej)
RUN mvn -f server/pom.xml clean package -DskipTests

# Etap 2: Uruchamianie aplikacji
FROM eclipse-temurin:17-jdk
WORKDIR /app
# Kopiujemy plik .jar z etapu budowania
COPY --from=build /app/server/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]