# 🚀 Быстрый старт & Установка

Руководство по установке, развертыванию и первоначальной конфигурации NijiPanel.

---

## 📋 Системные требования

### Для хоста панели NijiPanel:
* **Docker Engine 24.0+** и **Docker Compose v2** (рекомендуется)
* Либо **Linux x64/arm64** с установленным **.NET 10 Runtime**
* Минимум **256 МБ RAM** (типичное потребление: ~60–120 МБ)
* **50 МБ** свободного места на диске

### Для целевых управляемых серверов (Fleet):
* Любой дистрибутив Linux (**Ubuntu, Debian, Debian-based, CentOS, AlmaLinux, Rocky, Fedora, Arch Linux, Alpine**)
* Доступ по **SSH (OpenSSH Server)** по паролю или по SSH-ключу
* Учетная запись с правами `sudo` (для выполнения системных действий)
* Установленный Docker (опционально, для работы контейнерных модулей)

---

## 🐳 Развертывание через Docker Compose (Рекомендуемый способ)

Создайте директорию для NijiPanel и перейдите в нее:

```bash
mkdir -p /opt/nijipanel && cd /opt/nijipanel
```

Создайте файл `docker-compose.yml`:

```yaml
services:
  nijipanel:
    image: ghcr.io/perdub/nijipanel:latest
    container_name: nijipanel
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./nijipanel_data:/data
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ASPNETCORE_URLS=http://+:8080
      - DATABASE_PATH=/data/nijipanel.db
      - DATA_DIR=/data
```

Запустите контейнер в фоновом режиме:

```bash
docker compose up -d
```

Откройте веб-интерфейс в браузере:  
👉 **`http://<IP-вашего-сервера>:8080`**

---

## 💻 Развертывание через Docker CLI

Если вы предпочитаете единичную команду Docker:

```bash
docker run -d \
  --name nijipanel \
  --restart unless-stopped \
  -p 8080:8080 \
  -v /opt/nijipanel/data:/data \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ASPNETCORE_URLS=http://+:8080 \
  -e DATABASE_PATH=/data/nijipanel.db \
  -e DATA_DIR=/data \
  ghcr.io/perdub/nijipanel:latest
```

---

## 🛠️ Сборка и локальная разработка из исходников

Если вы хотите собрать NijiPanel локально или внести изменения:

### 1. Требования:
* **.NET 10 SDK** (`dotnet --version` >= 10.0.100)
* **Node.js 22+** и **npm**
* **Git**

### 2. Клонирование репозитория:
```bash
git clone https://github.com/perdub/NijiPanel.git
cd NijiPanel
```

### 3. Сборка фронтенда (React 19):
```bash
cd src/NijiPanel.Frontend
npm install
npm run build
cd ../..
```
> Статический бандл автоматически компилируется в `src/NijiPanel.Backend/wwwroot` и встраивается в веб-сервер .NET.

### 4. Запуск бэкенда (.NET 10):
```bash
cd src/NijiPanel.Backend
dotnet run
```
Сервер запустится на портах `http://localhost:5000` и `https://localhost:5001` (или согласно `appsettings.json`).

### 5. Режим параллельной разработки (Live Reload):
Для мгновенного горячего обновления фронтенда (Vite HMR):
```bash
# В терминале 1:
cd src/NijiPanel.Backend && dotnet run

# В терминале 2:
cd src/NijiPanel.Frontend && npm run dev
```
Vite будет проксировать запросы `/api` и `/ws` на локальный порт бэкенда 5000.

---

## 🧙 Мастер первого запуска (Setup Wizard)

При первом переходе на страницу панели вас встретит интерактивный мастер начальной настройки:

![Onboarding Setup](screenshots/01_setup.png)

Онбординг разбит на 4 понятных шага:

1. **Создание учетной записи Администратора:**
   * Задайте имя пользователя (по умолчанию `admin`) и надежный мастер-пароль.
   * Пароль хэшируется криптостойким алгоритмом **PBKDF2** (SHA-256, 100 000 итераций).
2. **Генерация Мастер-ключа (Fleet Master Key):**
   * NijiPanel автоматически генерирует уникальную пару RSA ключей (2048 или 4096 бит).
   * Вы получаете публичный SSH-ключ (`ssh-rsa AAAAB3Nza...`) и готовую однострочную команду для добавления в `~/.ssh/authorized_keys` целевых серверов:
     ```bash
     mkdir -p ~/.ssh && echo "ssh-rsa <KEY> nijipanel-fleet-master" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
     ```
3. **Подключение первого сервера:**
   * Укажите имя хоста, IP-адрес/домен, порт SSH (22 по умолчанию), имя пользователя (`root` или `ubuntu`) и метод аутентификации (Мастер-ключ, кастомный приватный ключ или пароль).
   * Кнопка **«Test Connection»** мгновенно проверяет соединение и статус доступности.
4. **Выбор начального стека:**
   * Возможность в 1 клик установить базовые инструменты (Docker, Fail2ban, UFW, htop, curl, git) на подключенный сервер.

После завершения мастера вы автоматически попадаете в **Fleet Overview**.

---

## ⚙️ Переменные окружения

Конфигурация бэкенда может быть переопределена через переменные окружения:

| Переменная | По умолчанию | Описание |
| :--- | :--- | :--- |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Среда выполнения ASP.NET Core (`Production`, `Development`). |
| `ASPNETCORE_URLS` | `http://+:8080` | URL и порты привязки веб-сервера Kestrel. |
| `DATABASE_PATH` | `./nijipanel.db` | Абсолютный путь к базе данных SQLite. Рекомендуется `/data/nijipanel.db`. |
| `DATA_DIR` | `./` | Директория хранения мастер-ключа и резервных копий. |
| `JWT_SECRET` | *(auto-generated)* | Секретный ключ подписи JWT. При отсутствии генерируется устойчивый криптографический ключ. |
| `ENABLE_SWAGGER` | `false` | Включение интерактивного интерфейса Swagger OpenAPI в проде. |

---

## 💾 Сохранение данных (Data Persistence)

Все данные NijiPanel сохраняются в каталоге монтирования (например, `./nijipanel_data` или `/data` в контейнере):
* **`nijipanel.db`** — SQLite база данных (таблицы хостов, портов, заметок, туннелей, истории метрик, алертов, шаблонов команд, пользователей панели и Passkey кредов).
* **`master_key.json`** — зашифрованные мастер-ключи инфраструктуры.
* **`file_shares/`** — временные файлы и метаданные публичных ссылок.

Для создания резервной копии достаточно скопировать папку `nijipanel_data` или воспользоваться встроенной функцией зашифрованного экспорта в разделе **Settings -> Backup**.
