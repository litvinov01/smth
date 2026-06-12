FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py ./
COPY agent_smith ./agent_smith

# The repository is bind-mounted read-only at runtime; the index persists in a volume.
ENV AGENT_SMITH_REPO_ROOT=/repo \
    AGENT_SMITH_STORAGE_DIR=/app/.storage

ENTRYPOINT ["python", "main.py"]
