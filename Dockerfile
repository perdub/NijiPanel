# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

COPY src/ServerDeck.Frontend/package*.json ./
RUN npm install

COPY src/ServerDeck.Frontend/ ./
RUN npm run build

# Stage 2: Build Backend (.NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS backend-build
WORKDIR /app/backend

COPY src/ServerDeck.Backend/*.csproj ./
RUN dotnet restore

COPY src/ServerDeck.Backend/ ./
COPY --from=frontend-build /app/backend/wwwroot ./wwwroot/

RUN dotnet publish -c Release -o /app/publish

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /app/publish ./

ENV ASPNETCORE_URLS=http://+:8080
ENV DATABASE_PATH=/data/servers.db
EXPOSE 8080

VOLUME ["/data"]

ENTRYPOINT ["dotnet", "ServerDeck.Backend.dll"]
