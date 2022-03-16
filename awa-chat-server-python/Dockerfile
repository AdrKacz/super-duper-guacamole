FROM python:3.9.10

# Port to expose
EXPOSE 8765

RUN pip install --upgrade pip
RUN pip install websockets

WORKDIR /app
COPY src/main.py main.py
CMD python -u main.py