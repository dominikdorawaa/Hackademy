FROM maven:3.9.16-eclipse-temurin-17 AS build
WORKDIR /app
COPY server/pom.xml server/pom.xml
RUN mvn -f server/pom.xml dependency:go-offline -B
COPY server/src server/src
RUN mvn -f server/pom.xml package -B -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 10001 --create-home appuser
COPY --from=build /app/server/target/*.jar /app/app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
