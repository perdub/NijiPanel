using ServerDeck.Backend.Models;

namespace ServerDeck.Backend.Services;

public static class DockerTemplatesCatalog
{
    public static readonly List<AppTemplateDto> All = new()
    {
        // --- DATABASE ---
        new AppTemplateDto(
            "postgres",
            "PostgreSQL",
            "Database",
            "Powerful, open-source object-relational database system with high reliability.",
            "Database",
            new Dictionary<string, string>
            {
                ["POSTGRES_DB"] = "nijipanel",
                ["POSTGRES_USER"] = "postgres",
                ["POSTGRES_PASSWORD"] = "nijika_pg_secret_2026",
                ["HOST_PORT"] = "5432"
            },
            """
            services:
              postgres:
                image: postgres:16-alpine
                restart: unless-stopped
                environment:
                  POSTGRES_DB: ${POSTGRES_DB}
                  POSTGRES_USER: ${POSTGRES_USER}
                  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
                ports:
                  - "${HOST_PORT}:5432"
                volumes:
                  - pgdata:/var/lib/postgresql/data

            volumes:
              pgdata:
            """
        ),
        new AppTemplateDto(
            "mysql",
            "MySQL",
            "Database",
            "World's most popular open-source relational database engine.",
            "Database",
            new Dictionary<string, string>
            {
                ["MYSQL_ROOT_PASSWORD"] = "nijika_mysql_root_2026",
                ["MYSQL_DATABASE"] = "appdb",
                ["MYSQL_USER"] = "appuser",
                ["MYSQL_PASSWORD"] = "nijika_user_secret_2026",
                ["HOST_PORT"] = "3306"
            },
            """
            services:
              mysql:
                image: mysql:8.4
                restart: unless-stopped
                environment:
                  MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
                  MYSQL_DATABASE: ${MYSQL_DATABASE}
                  MYSQL_USER: ${MYSQL_USER}
                  MYSQL_PASSWORD: ${MYSQL_PASSWORD}
                ports:
                  - "${HOST_PORT}:3306"
                volumes:
                  - mysqldata:/var/lib/mysql

            volumes:
              mysqldata:
            """
        ),
        new AppTemplateDto(
            "redis",
            "Redis",
            "Database",
            "In-memory data structure store used as a database, cache, streaming engine, and message broker.",
            "Database",
            new Dictionary<string, string>
            {
                ["REDIS_PASSWORD"] = "nijika_redis_secret_2026",
                ["HOST_PORT"] = "6379"
            },
            """
            services:
              redis:
                image: redis:7-alpine
                restart: unless-stopped
                command: redis-server --requirepass ${REDIS_PASSWORD}
                ports:
                  - "${HOST_PORT}:6379"
                volumes:
                  - redisdata:/data

            volumes:
              redisdata:
            """
        ),
        new AppTemplateDto(
            "mongodb",
            "MongoDB",
            "Database",
            "Document-based distributed database designed for modern apps and the cloud era.",
            "Database",
            new Dictionary<string, string>
            {
                ["MONGO_INITDB_ROOT_USERNAME"] = "mongoroot",
                ["MONGO_INITDB_ROOT_PASSWORD"] = "nijika_mongo_root_2026",
                ["HOST_PORT"] = "27017"
            },
            """
            services:
              mongodb:
                image: mongo:7.0
                restart: unless-stopped
                environment:
                  MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
                  MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD}
                ports:
                  - "${HOST_PORT}:27017"
                volumes:
                  - mongodata:/data/db

            volumes:
              mongodata:
            """
        ),
        new AppTemplateDto(
            "clickhouse",
            "ClickHouse",
            "Database",
            "Fast open-source column-oriented database management system for real-time analytical reporting.",
            "Database",
            new Dictionary<string, string>
            {
                ["CLICKHOUSE_DB"] = "analytics",
                ["CLICKHOUSE_USER"] = "clickhouse",
                ["CLICKHOUSE_PASSWORD"] = "nijika_clickhouse_2026",
                ["HTTP_PORT"] = "8123",
                ["NATIVE_PORT"] = "9000"
            },
            """
            services:
              clickhouse:
                image: clickhouse/clickhouse-server:latest
                restart: unless-stopped
                environment:
                  CLICKHOUSE_DB: ${CLICKHOUSE_DB}
                  CLICKHOUSE_USER: ${CLICKHOUSE_USER}
                  CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
                ports:
                  - "${HTTP_PORT}:8123"
                  - "${NATIVE_PORT}:9000"
                volumes:
                  - chdata:/var/lib/clickhouse
                ulimits:
                  nofile:
                    soft: 262144
                    hard: 262144

            volumes:
              chdata:
            """
        ),
        new AppTemplateDto(
            "memcached",
            "Memcached",
            "Database",
            "High-performance, distributed memory object caching system.",
            "Database",
            new Dictionary<string, string>
            {
                ["HOST_PORT"] = "11211",
                ["MEMORY_MB"] = "128"
            },
            """
            services:
              memcached:
                image: memcached:alpine
                restart: unless-stopped
                command: memcached -m ${MEMORY_MB}
                ports:
                  - "${HOST_PORT}:11211"
            """
        ),
        new AppTemplateDto(
            "meilisearch",
            "Meilisearch",
            "Database",
            "Lightning-fast, highly relevant, and typo-tolerant search engine API.",
            "Database",
            new Dictionary<string, string>
            {
                ["MEILI_MASTER_KEY"] = "nijika_meili_master_key_2026",
                ["HOST_PORT"] = "7700"
            },
            """
            services:
              meilisearch:
                image: getmeili/meilisearch:v1.7
                restart: unless-stopped
                environment:
                  MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
                  MEILI_ENV: production
                ports:
                  - "${HOST_PORT}:7700"
                volumes:
                  - meilidata:/meili_data

            volumes:
              meilidata:
            """
        ),

        // --- WEB & CONTENT ---
        new AppTemplateDto(
            "nginx",
            "Nginx",
            "Web",
            "High-performance HTTP server, reverse proxy, and IMAP/POP3 proxy server.",
            "Globe",
            new Dictionary<string, string>
            {
                ["HTTP_PORT"] = "80",
                ["HTTPS_PORT"] = "443"
            },
            """
            services:
              nginx:
                image: nginx:alpine
                restart: unless-stopped
                ports:
                  - "${HTTP_PORT}:80"
                  - "${HTTPS_PORT}:443"
                volumes:
                  - nginx_html:/usr/share/nginx/html
                  - nginx_conf:/etc/nginx/conf.d

            volumes:
              nginx_html:
              nginx_conf:
            """
        ),
        new AppTemplateDto(
            "caddy",
            "Caddy",
            "Web",
            "Powerful, enterprise-ready open source web server with automatic HTTPS.",
            "Globe",
            new Dictionary<string, string>
            {
                ["HTTP_PORT"] = "80",
                ["HTTPS_PORT"] = "443"
            },
            """
            services:
              caddy:
                image: caddy:2-alpine
                restart: unless-stopped
                ports:
                  - "${HTTP_PORT}:80"
                  - "${HTTPS_PORT}:443"
                volumes:
                  - caddy_data:/data
                  - caddy_config:/config

            volumes:
              caddy_data:
              caddy_config:
            """
        ),
        new AppTemplateDto(
            "wordpress",
            "WordPress",
            "Web",
            "Publishing platform powering over 40% of the web with CMS, blogs, and stores.",
            "Globe",
            new Dictionary<string, string>
            {
                ["WORDPRESS_DB_PASSWORD"] = "nijika_wp_secret_2026",
                ["WORDPRESS_DB_NAME"] = "wordpress",
                ["HOST_PORT"] = "8080"
            },
            """
            services:
              db:
                image: mariadb:10.11
                restart: unless-stopped
                environment:
                  MYSQL_ROOT_PASSWORD: ${WORDPRESS_DB_PASSWORD}
                  MYSQL_DATABASE: ${WORDPRESS_DB_NAME}
                  MYSQL_USER: wordpress
                  MYSQL_PASSWORD: ${WORDPRESS_DB_PASSWORD}
                volumes:
                  - wpdbdata:/var/lib/mysql

              wordpress:
                image: wordpress:latest
                restart: unless-stopped
                depends_on:
                  - db
                environment:
                  WORDPRESS_DB_HOST: db:3306
                  WORDPRESS_DB_USER: wordpress
                  WORDPRESS_DB_PASSWORD: ${WORDPRESS_DB_PASSWORD}
                  WORDPRESS_DB_NAME: ${WORDPRESS_DB_NAME}
                ports:
                  - "${HOST_PORT}:80"
                volumes:
                  - wpdata:/var/www/html

            volumes:
              wpdbdata:
              wpdata:
            """
        ),
        new AppTemplateDto(
            "ghost",
            "Ghost",
            "Web",
            "Professional publishing platform for independent writers, creators, and journalists.",
            "Globe",
            new Dictionary<string, string>
            {
                ["GHOST_URL"] = "http://localhost:2368",
                ["HOST_PORT"] = "2368"
            },
            """
            services:
              ghost:
                image: ghost:5-alpine
                restart: unless-stopped
                environment:
                  url: ${GHOST_URL}
                  NODE_ENV: production
                ports:
                  - "${HOST_PORT}:2368"
                volumes:
                  - ghost_content:/var/lib/ghost/content

            volumes:
              ghost_content:
            """
        ),
        new AppTemplateDto(
            "directus",
            "Directus",
            "Web",
            "Instant Headless CMS and API for any SQL database, built with Node.js and Vue.",
            "Globe",
            new Dictionary<string, string>
            {
                ["DIRECTUS_KEY"] = "nijika-directus-key-2026",
                ["DIRECTUS_SECRET"] = "nijika-directus-secret-2026",
                ["ADMIN_EMAIL"] = "admin@example.com",
                ["ADMIN_PASSWORD"] = "nijika_admin_secret_2026",
                ["HOST_PORT"] = "8055"
            },
            """
            services:
              directus:
                image: directus/directus:latest
                restart: unless-stopped
                environment:
                  KEY: ${DIRECTUS_KEY}
                  SECRET: ${DIRECTUS_SECRET}
                  ADMIN_EMAIL: ${ADMIN_EMAIL}
                  ADMIN_PASSWORD: ${ADMIN_PASSWORD}
                  DB_CLIENT: sqlite3
                  DB_FILENAME: /directus/database/data.db
                ports:
                  - "${HOST_PORT}:8055"
                volumes:
                  - directus_data:/directus/database
                  - directus_uploads:/directus/uploads

            volumes:
              directus_data:
              directus_uploads:
            """
        ),
        new AppTemplateDto(
            "nextcloud",
            "Nextcloud",
            "Web",
            "Self-hosted productivity platform providing secure file storage, collaboration, and office suite.",
            "Cloud",
            new Dictionary<string, string>
            {
                ["NEXTCLOUD_ADMIN_USER"] = "admin",
                ["NEXTCLOUD_ADMIN_PASSWORD"] = "nijika_nextcloud_2026",
                ["HOST_PORT"] = "8080"
            },
            """
            services:
              nextcloud:
                image: nextcloud:apache
                restart: unless-stopped
                environment:
                  NEXTCLOUD_ADMIN_USER: ${NEXTCLOUD_ADMIN_USER}
                  NEXTCLOUD_ADMIN_PASSWORD: ${NEXTCLOUD_ADMIN_PASSWORD}
                ports:
                  - "${HOST_PORT}:80"
                volumes:
                  - nextcloud_data:/var/www/html

            volumes:
              nextcloud_data:
            """
        ),

        // --- TOOLS & UTILITIES ---
        new AppTemplateDto(
            "vaultwarden",
            "Vaultwarden",
            "Tools",
            "Lightweight Bitwarden-compatible password manager written in Rust.",
            "Shield",
            new Dictionary<string, string>
            {
                ["SIGNUPS_ALLOWED"] = "true",
                ["ADMIN_TOKEN"] = "nijika_vaultwarden_token_2026",
                ["HOST_PORT"] = "8080"
            },
            """
            services:
              vaultwarden:
                image: vaultwarden/server:latest
                restart: unless-stopped
                environment:
                  SIGNUPS_ALLOWED: ${SIGNUPS_ALLOWED}
                  ADMIN_TOKEN: ${ADMIN_TOKEN}
                ports:
                  - "${HOST_PORT}:80"
                volumes:
                  - vwdata:/data

            volumes:
              vwdata:
            """
        ),
        new AppTemplateDto(
            "uptime-kuma",
            "Uptime Kuma",
            "Tools",
            "Self-hosted monitoring tool with status pages, alert triggers, and response time charts.",
            "Activity",
            new Dictionary<string, string>
            {
                ["HOST_PORT"] = "3001"
            },
            """
            services:
              uptime-kuma:
                image: louislam/uptime-kuma:1
                restart: unless-stopped
                ports:
                  - "${HOST_PORT}:3001"
                volumes:
                  - uptime_kuma_data:/app/data

            volumes:
              uptime_kuma_data:
            """
        ),
        new AppTemplateDto(
            "portainer",
            "Portainer CE",
            "Tools",
            "Lightweight management UI which allows you to easily manage your Docker hosts.",
            "Layers",
            new Dictionary<string, string>
            {
                ["HTTP_PORT"] = "9000",
                ["HTTPS_PORT"] = "9443"
            },
            """
            services:
              portainer:
                image: portainer/portainer-ce:latest
                restart: unless-stopped
                ports:
                  - "${HTTP_PORT}:9000"
                  - "${HTTPS_PORT}:9443"
                volumes:
                  - /var/run/docker.sock:/var/run/docker.sock
                  - portainer_data:/data

            volumes:
              portainer_data:
            """
        ),
        new AppTemplateDto(
            "n8n",
            "n8n",
            "Tools",
            "Fair-code licensed workflow automation tool with extensive integrations and node system.",
            "Workflow",
            new Dictionary<string, string>
            {
                ["GENERIC_TIMEZONE"] = "UTC",
                ["N8N_PORT"] = "5678",
                ["HOST_PORT"] = "5678"
            },
            """
            services:
              n8n:
                image: n8nio/n8n:latest
                restart: unless-stopped
                environment:
                  GENERIC_TIMEZONE: ${GENERIC_TIMEZONE}
                  N8N_PORT: ${N8N_PORT}
                ports:
                  - "${HOST_PORT}:5678"
                volumes:
                  - n8n_data:/home/node/.n8n

            volumes:
              n8n_data:
            """
        ),
        new AppTemplateDto(
            "minio",
            "MinIO S3",
            "Tools",
            "High Performance, Kubernetes-native Object Storage with Amazon S3 API compatibility.",
            "HardDrive",
            new Dictionary<string, string>
            {
                ["MINIO_ROOT_USER"] = "minioadmin",
                ["MINIO_ROOT_PASSWORD"] = "nijika_minio_secret_2026",
                ["API_PORT"] = "9000",
                ["CONSOLE_PORT"] = "9001"
            },
            """
            services:
              minio:
                image: minio/minio:latest
                restart: unless-stopped
                command: server /data --console-address ":9001"
                environment:
                  MINIO_ROOT_USER: ${MINIO_ROOT_USER}
                  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
                ports:
                  - "${API_PORT}:9000"
                  - "${CONSOLE_PORT}:9001"
                volumes:
                  - minio_data:/data

            volumes:
              minio_data:
            """
        ),
        new AppTemplateDto(
            "rabbitmq",
            "RabbitMQ",
            "Tools",
            "Reliable and mature message and streaming broker with management UI.",
            "MessageSquare",
            new Dictionary<string, string>
            {
                ["RABBITMQ_DEFAULT_USER"] = "guest",
                ["RABBITMQ_DEFAULT_PASS"] = "nijika_rabbit_pass_2026",
                ["AMQP_PORT"] = "5672",
                ["MGMT_PORT"] = "15672"
            },
            """
            services:
              rabbitmq:
                image: rabbitmq:3-management-alpine
                restart: unless-stopped
                environment:
                  RABBITMQ_DEFAULT_USER: ${RABBITMQ_DEFAULT_USER}
                  RABBITMQ_DEFAULT_PASS: ${RABBITMQ_DEFAULT_PASS}
                ports:
                  - "${AMQP_PORT}:5672"
                  - "${MGMT_PORT}:15672"
                volumes:
                  - rabbit_data:/var/lib/rabbitmq

            volumes:
              rabbit_data:
            """
        ),
        new AppTemplateDto(
            "vikunja",
            "Vikunja",
            "Tools",
            "Open-source, self-hostable to-do app and project management suite.",
            "CheckSquare",
            new Dictionary<string, string>
            {
                ["VIKUNJA_SERVICE_JWTSECRET"] = "nijika_vikunja_jwt_secret_2026",
                ["HOST_PORT"] = "3456"
            },
            """
            services:
              vikunja:
                image: vikunja/vikunja:latest
                restart: unless-stopped
                environment:
                  VIKUNJA_SERVICE_JWTSECRET: ${VIKUNJA_SERVICE_JWTSECRET}
                ports:
                  - "${HOST_PORT}:3456"
                volumes:
                  - vikunja_files:/app/vikunja/files

            volumes:
              vikunja_files:
            """
        ),
        new AppTemplateDto(
            "home-assistant",
            "Home Assistant",
            "Tools",
            "Open source home automation platform putting local control and privacy first.",
            "Home",
            new Dictionary<string, string>
            {
                ["HOST_PORT"] = "8123"
            },
            """
            services:
              homeassistant:
                image: homeassistant/home-assistant:stable
                restart: unless-stopped
                ports:
                  - "${HOST_PORT}:8123"
                volumes:
                  - ha_config:/config
                  - /etc/localtime:/etc/localtime:ro

            volumes:
              ha_config:
            """
        ),
        new AppTemplateDto(
            "pi-hole",
            "Pi-hole",
            "Tools",
            "Network-wide ad and tracker blocker via custom DNS sinkhole.",
            "ShieldAlert",
            new Dictionary<string, string>
            {
                ["WEBPASSWORD"] = "nijika_pihole_secret_2026",
                ["DNS_PORT"] = "53",
                ["WEB_PORT"] = "8080"
            },
            """
            services:
              pihole:
                image: pihole/pihole:latest
                restart: unless-stopped
                environment:
                  TZ: 'UTC'
                  WEBPASSWORD: ${WEBPASSWORD}
                ports:
                  - "${DNS_PORT}:53/tcp"
                  - "${DNS_PORT}:53/udp"
                  - "${WEB_PORT}:80/tcp"
                volumes:
                  - pihole_etc:/etc/pihole
                  - pihole_dnsmasq:/etc/dnsmasq.d

            volumes:
              pihole_etc:
              pihole_dnsmasq:
            """
        ),
        new AppTemplateDto(
            "stirling-pdf",
            "Stirling-PDF",
            "Tools",
            "Robust, locally-hosted web application that lets you edit and transform PDF files.",
            "FileText",
            new Dictionary<string, string>
            {
                ["HOST_PORT"] = "8080"
            },
            """
            services:
              stirling-pdf:
                image: frooodle/s-pdf:latest
                restart: unless-stopped
                ports:
                  - "${HOST_PORT}:8080"
                environment:
                  DOCKER_ENABLE_SECURITY: 'false'
            """
        ),

        // --- DEV & REPOS ---
        new AppTemplateDto(
            "gitea",
            "Gitea",
            "Dev",
            "Painless self-hosted Git service written in Go with issues, milestones, and CI/CD.",
            "GitBranch",
            new Dictionary<string, string>
            {
                ["HTTP_PORT"] = "3000",
                ["SSH_PORT"] = "2222"
            },
            """
            services:
              gitea:
                image: gitea/gitea:latest
                restart: unless-stopped
                environment:
                  - USER_UID=1000
                  - USER_GID=1000
                ports:
                  - "${HTTP_PORT}:3000"
                  - "${SSH_PORT}:22"
                volumes:
                  - gitea_data:/data
                  - /etc/timezone:/etc/timezone:ro
                  - /etc/localtime:/etc/localtime:ro

            volumes:
              gitea_data:
            """
        ),
        new AppTemplateDto(
            "penpot",
            "Penpot",
            "Dev",
            "First open-source design and prototyping tool native for web teams and SVG.",
            "PenTool",
            new Dictionary<string, string>
            {
                ["PENPOT_SECRET_KEY"] = "nijika_penpot_secret_2026",
                ["HOST_PORT"] = "9001"
            },
            """
            services:
              penpot-frontend:
                image: penpotapp/frontend:latest
                restart: unless-stopped
                ports:
                  - "${HOST_PORT}:80"
                volumes:
                  - penpot_assets:/opt/data/assets

            volumes:
              penpot_assets:
            """
        ),
        new AppTemplateDto(
            "adminer",
            "Adminer",
            "Dev",
            "Full-featured database management tool in a single PHP file supporting MySQL, PG, SQLite.",
            "Database",
            new Dictionary<string, string>
            {
                ["HOST_PORT"] = "8080"
            },
            """
            services:
              adminer:
                image: adminer:latest
                restart: unless-stopped
                ports:
                  - "${HOST_PORT}:8080"
            """
        ),

        // --- ANALYTICS ---
        new AppTemplateDto(
            "grafana",
            "Grafana",
            "Analytics",
            "Open source analytics and interactive visualization web application.",
            "BarChart3",
            new Dictionary<string, string>
            {
                ["GF_SECURITY_ADMIN_USER"] = "admin",
                ["GF_SECURITY_ADMIN_PASSWORD"] = "nijika_grafana_2026",
                ["HOST_PORT"] = "3000"
            },
            """
            services:
              grafana:
                image: grafana/grafana:latest
                restart: unless-stopped
                environment:
                  GF_SECURITY_ADMIN_USER: ${GF_SECURITY_ADMIN_USER}
                  GF_SECURITY_ADMIN_PASSWORD: ${GF_SECURITY_ADMIN_PASSWORD}
                ports:
                  - "${HOST_PORT}:3000"
                volumes:
                  - grafana_data:/var/lib/grafana

            volumes:
              grafana_data:
            """
        ),
        new AppTemplateDto(
            "plausible",
            "Plausible Analytics",
            "Analytics",
            "Simple, open-source, lightweight (< 1 KB) and privacy-friendly Google Analytics alternative.",
            "TrendingUp",
            new Dictionary<string, string>
            {
                ["BASE_URL"] = "http://localhost:8000",
                ["SECRET_KEY_BASE"] = "nijika_plausible_secret_key_base_2026_at_least_64_bytes_long_here",
                ["HOST_PORT"] = "8000"
            },
            """
            services:
              plausible:
                image: plausible/analytics:latest
                restart: unless-stopped
                environment:
                  BASE_URL: ${BASE_URL}
                  SECRET_KEY_BASE: ${SECRET_KEY_BASE}
                ports:
                  - "${HOST_PORT}:8000"
                volumes:
                  - plausible_data:/var/lib/plausible

            volumes:
              plausible_data:
            """
        ),
        new AppTemplateDto(
            "prometheus",
            "Prometheus",
            "Analytics",
            "Leading open-source systems monitoring and alerting toolkit designed for reliability.",
            "Activity",
            new Dictionary<string, string>
            {
                ["HOST_PORT"] = "9090"
            },
            """
            services:
              prometheus:
                image: prom/prometheus:latest
                restart: unless-stopped
                ports:
                  - "${HOST_PORT}:9090"
                volumes:
                  - prom_data:/prometheus

            volumes:
              prom_data:
            """
        ),

        // --- MEDIA ---
        new AppTemplateDto(
            "jellyfin",
            "Jellyfin",
            "Media",
            "Free software media system that puts you in control of managing and streaming media.",
            "Tv",
            new Dictionary<string, string>
            {
                ["HOST_PORT"] = "8096"
            },
            """
            services:
              jellyfin:
                image: jellyfin/jellyfin:latest
                restart: unless-stopped
                ports:
                  - "${HOST_PORT}:8096"
                volumes:
                  - jellyfin_config:/config
                  - jellyfin_cache:/cache

            volumes:
              jellyfin_config:
              jellyfin_cache:
            """
        ),
        new AppTemplateDto(
            "transmission",
            "Transmission",
            "Media",
            "Fast, easy, and free BitTorrent client with Web UI and low memory footprint.",
            "Download",
            new Dictionary<string, string>
            {
                ["USER"] = "nijika",
                ["PASS"] = "nijika_pass_2026",
                ["WEB_PORT"] = "9091",
                ["PEER_PORT"] = "51413"
            },
            """
            services:
              transmission:
                image: lscr.io/linuxserver/transmission:latest
                restart: unless-stopped
                environment:
                  - PUID=1000
                  - PGID=1000
                  - USER=${USER}
                  - PASS=${PASS}
                ports:
                  - "${WEB_PORT}:9091"
                  - "${PEER_PORT}:51413"
                  - "${PEER_PORT}:51413/udp"
                volumes:
                  - trans_config:/config
                  - trans_downloads:/downloads

            volumes:
              trans_config:
              trans_downloads:
            """
        ),
        new AppTemplateDto(
            "qbittorrent",
            "qBittorrent",
            "Media",
            "Feature-rich, open-source BitTorrent client with intuitive Web UI and search plugins.",
            "Download",
            new Dictionary<string, string>
            {
                ["WEBUI_PORT"] = "8080",
                ["BT_PORT"] = "6881"
            },
            """
            services:
              qbittorrent:
                image: lscr.io/linuxserver/qbittorrent:latest
                restart: unless-stopped
                environment:
                  - PUID=1000
                  - PGID=1000
                  - WEBUI_PORT=${WEBUI_PORT}
                ports:
                  - "${WEBUI_PORT}:${WEBUI_PORT}"
                  - "${BT_PORT}:6881"
                  - "${BT_PORT}:6881/udp"
                volumes:
                  - qbit_config:/config
                  - qbit_downloads:/downloads

            volumes:
              qbit_config:
              qbit_downloads:
            """
        )
    };
}
