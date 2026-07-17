# ============================================================
# eCabinet API (.NET 8) — build đa tầng.
# Tầng build: SDK biên dịch + publish; tầng chạy: ASP.NET runtime gọn.
# EXPOSE 3000 (nginx 'web' proxy sang api:3000 không đổi so với backend Node).
# ============================================================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore theo csproj trước (tận dụng cache layer)
COPY ECabinet.sln ./
COPY ECabinet.Api/ECabinet.Api.csproj ECabinet.Api/
COPY ECabinet.Tests/ECabinet.Tests.csproj ECabinet.Tests/
RUN dotnet restore ECabinet.Api/ECabinet.Api.csproj

# Chép toàn bộ mã & publish (Release)
COPY . .
RUN dotnet publish ECabinet.Api/ECabinet.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

# PORT mặc định 3000 (App.cs đọc env PORT; listen 0.0.0.0:3000)
ENV PORT=3000
ENV ASPNETCORE_URLS=http://0.0.0.0:3000
EXPOSE 3000

ENTRYPOINT ["dotnet", "ECabinet.Api.dll"]
