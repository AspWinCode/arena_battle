FROM python:3.12-slim
RUN useradd -m -u 1001 sandbox
WORKDIR /sandbox
COPY runner.py /sandbox/runner.py
USER sandbox
ENTRYPOINT ["python", "-u", "/sandbox/runner.py"]
