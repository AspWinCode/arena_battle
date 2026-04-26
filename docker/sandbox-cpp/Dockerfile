FROM gcc:13-slim
RUN useradd -m -u 1001 sandbox && \
    apt-get update && apt-get install -y --no-install-recommends nlohmann-json3-dev && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /sandbox
COPY harness.cpp /sandbox/harness.cpp
COPY entrypoint.sh /sandbox/entrypoint.sh
RUN chmod +x /sandbox/entrypoint.sh
USER sandbox
ENTRYPOINT ["/sandbox/entrypoint.sh"]
