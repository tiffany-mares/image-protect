FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY mvnw mvnw.cmd pom.xml ./
COPY .mvn .mvn
RUN sh mvnw -q dependency:go-offline
COPY src src
RUN sh mvnw -q package -DskipTests

FROM eclipse-temurin:21-jre
COPY --from=build /src/target/auth-service-0.0.1-SNAPSHOT.jar /app.jar
EXPOSE 8081
ENV SERVER_PORT=8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "/app.jar"]
