FROM eclipse-temurin:21-jdk-alpine
RUN adduser -D -u 1001 sandbox
WORKDIR /sandbox
COPY RobotHarness.java /sandbox/RobotHarness.java
COPY entrypoint.sh /sandbox/entrypoint.sh
RUN chmod +x /sandbox/entrypoint.sh
USER sandbox
ENTRYPOINT ["/sandbox/entrypoint.sh"]
