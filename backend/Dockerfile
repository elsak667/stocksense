FROM docker.m.daocloud.io/library/python:3.11-slim-bookworm
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir "numpy<2" -i https://pypi.doubanio.com/simple/ && \
    pip install --no-cache-dir -e ".[dev]" -i https://pypi.doubanio.com/simple/
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
