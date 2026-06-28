FROM docker.m.daocloud.io/library/python:3.11-slim-bookworm
RUN pip install --no-cache-dir -i https://pypi.doubanio.com/simple/ aiohttp
COPY dist /app/dist
COPY serve.py /app/serve.py
WORKDIR /app
EXPOSE 80
CMD ["python3", "serve.py"]
