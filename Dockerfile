# Dockerfile 示例
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/


COPY . .

EXPOSE 5555

CMD ["python", "app.py"]
