docker build -t work .
docker run -d \
  -p 5555:5555 \
  -v ./data.csv:/app/data.csv \
  --name work \
  work