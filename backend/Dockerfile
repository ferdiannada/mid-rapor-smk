# Build Stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o migrate ./cmd/migrate/main.go

# Production Runner Stage
FROM alpine:3.20

WORKDIR /app

# Install Chromium for headless PDF rendering, fonts, and ca-certificates
RUN apk add --no-cache \
    chromium \
    font-noto \
    font-noto-cjk \
    font-dejavu \
    ca-certificates \
    tzdata

# Create symlink for google-chrome
RUN ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome

COPY --from=builder /app/server /app/server
COPY --from=builder /app/migrate /app/migrate
COPY --from=builder /app/migrations /app/migrations

ENV APP_ENV=production
ENV APP_PORT=8080
EXPOSE 8080

CMD ["/app/server"]
