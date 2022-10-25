# Build the Go API
FROM golang:1.19-alpine as go_builder
RUN mkdir /app
WORKDIR /app
COPY . /app
RUN GOOS=linux GOARCH=amd64 go build -o /boltdbapp

FROM alpine:latest
RUN mkdir /app
COPY --from=go_builder /boltdbapp /app/boltdbapp
COPY ./www/build /app/www/build
ENV GIN_MODE=release
EXPOSE 8080
WORKDIR /app
CMD ./boltdbapp