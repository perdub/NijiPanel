# 📖 REST API Reference

NijiPanel предоставляет полнофункциональный REST API для автоматизации управления серверным флотом, интеграции с CI/CD пайплайнами и создания собственных сценариев мониторинга.

---

## 🔒 Аутентификация

Все запросы к API (за исключением `/api/auth/status`, `/api/auth/login`, `/api/auth/setup` и `/d/{token}`) требуют передачи JWT токена в заголовке `Authorization`:

```http
Authorization: Bearer <your_jwt_token>
```

---

## 🧭 Сводная таблица эндпоинтов

### 1. Аутентификация и сессии (`/api/auth`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/auth/status` | Проверка статуса первоначальной настройки и текущей сессии |
| `POST` | `/api/auth/setup` | Первоначальная настройка администратора (Username + Password) |
| `POST` | `/api/auth/login` | Вход по паролю с выдачей JWT токена |
| `POST` | `/api/auth/change-password` | Смена текущего пароля администратора |
| `POST` | `/api/auth/passkey/register/challenge` | Генерация WebAuthn Challenge для регистрации ключа |
| `POST` | `/api/auth/passkey/register/verify` | Верификация и сохранение публичного ключа Passkey |
| `POST` | `/api/auth/passkey/login/challenge` | Генерация WebAuthn Challenge для биометрического входа |
| `POST` | `/api/auth/passkey/login/verify` | Верификация подписи Passkey и выпуск JWT токена |
| `GET` | `/api/auth/passkey/list` | Список зарегистрированных аппаратных ключей Passkeys |
| `DELETE`| `/api/auth/passkey/{id}` | Отзыв и удаление зарегистрированного ключа Passkey |

---

### 2. Управление серверами Fleet (`/api/hosts`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts` | Получение списка всех подключенных серверов |
| `POST` | `/api/hosts` | Добавление нового сервера в инфраструктуру |
| `GET` | `/api/hosts/{id}` | Получение детальной конфигурации сервера |
| `PUT` | `/api/hosts/{id}` | Обновление настроек подключения сервера |
| `DELETE`| `/api/hosts/{id}` | Удаление сервера из панели |
| `POST` | `/api/hosts/{id}/test` | Проверка доступности SSH-соединения |
| `GET` | `/api/hosts/{id}/stats` | Запрос оперативной телеметрии (CPU, RAM, Disk, Uptime) |
| `GET` | `/api/hosts/{id}/metrics/history` | Получение исторического временного ряда для sparklines |
| `POST` | `/api/hosts/{id}/benchmark` | Запуск неразрушающего аппаратного бенчмарка |
| `POST` | `/api/hosts/{id}/randomize-port` | Автоматическая миграция демона SSH на высокий порт (20000–59000) |
| `GET` | `/api/hosts/{id}/network` | Получение топологии сети, интерфейсов, CIDR и GeoIP |
| `POST` | `/api/hosts/inspect-network` | Предварительный сетевой аудит параметров хоста до добавления |

---

### 3. Docker Контейнеры & Шаблоны (`/api/hosts/{id}/docker`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/docker/containers` | Список всех контейнеров хоста со статусами |
| `GET` | `/api/hosts/{id}/docker/containers/{cid}` | Детальная инспекция контейнера (`docker inspect`) |
| `GET` | `/api/hosts/{id}/docker/containers/{cid}/crash-dump` | Получение краш-дампа и логов упавшего контейнера |
| `POST` | `/api/hosts/{id}/docker/containers/{cid}/action` | Управление: `start`, `stop`, `restart`, `kill`, `pause`, `remove` |
| `GET` | `/api/hosts/{id}/docker/containers/{cid}/logs?tail=200` | Получение последних N строк логов контейнера |
| `GET` | `/api/hosts/{id}/docker/prune/preview` | Расчет освобождаемого дискового пространства перед prune |
| `POST` | `/api/hosts/{id}/docker/prune/execute` | Выполнение выборочной очистки неиспользуемых ресурсов Docker |
| `GET` | `/api/hosts/{id}/docker/templates` | Каталог 32+ проверенных шаблонов приложений App Store |
| `POST` | `/api/hosts/{id}/docker/templates/deploy` | 1-Click деплой шаблона с подстановкой переменных окружения |
| `GET` | `/api/docker/hub-search?q={query}` | Поиск публичных образов в официальном реестре Docker Hub |

---

### 4. Docker Compose Studio (`/api/hosts/{id}/compose`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/compose/projects` | Поиск и перечисление файлов Compose на сервере |
| `GET` | `/api/hosts/{id}/compose/details?filePath={path}` | Парсинг сервисов, сетей и томов compose-файла |
| `POST` | `/api/hosts/{id}/compose/validate` | Проверка синтаксиса через `docker compose config --dry-run` |
| `POST` | `/api/hosts/{id}/compose/action` | Выполнение команд: `up`, `down`, `restart`, `pull`, `build` |
| `GET` | `/api/hosts/{id}/compose/logs?filePath={path}` | Чтение агрегированных логов стека |

---

### 5. Файловый менеджер SFTP & Шеринг (`/api/hosts/{id}/files`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/files/list?path={path}` | Просмотр содержимого директории (имена, размеры, права) |
| `GET` | `/api/hosts/{id}/files/read?path={path}` | Чтение текстового содержимого файла в Monaco Editor |
| `POST` | `/api/hosts/{id}/files/write` | Сохранение изменений файла на сервер |
| `POST` | `/api/hosts/{id}/files/create-file` | Создание пустого файла |
| `POST` | `/api/hosts/{id}/files/create-folder` | Создание директории (`mkdir -p`) |
| `DELETE`| `/api/hosts/{id}/files?path={path}` | Удаление файла или рекурсивное удаление каталога |
| `POST` | `/api/hosts/{id}/files/rename` | Переименование или перемещение файла/каталога |
| `GET` | `/api/hosts/{id}/files/stream?path={path}` | Потоковое скачивание или просмотр бинарных файлов |
| `POST` | `/api/hosts/{id}/files/upload?targetDir={dir}` | Загрузка файла через multipart/form-data |
| `POST` | `/api/hosts/{id}/files/direct-transfer` | Прямой rsync/scp перенос между двумя серверами флота |
| `GET` | `/api/hosts/{id}/files/disk-usage` | Построение Treemap диска с исключением псевдо-ФС |
| `POST` | `/api/hosts/{id}/files/archive` | Серверное сжатие файлов в `.zip` или `.tar.gz` |
| `POST` | `/api/hosts/{id}/files/extract` | Распаковка архива прямо на сервере |
| `POST` | `/api/share` | Создание публичной ссылки на скачивание (TTL, пароль, лимит) |
| `GET` | `/api/share/host/{hostId}` | Список активных ссылок шаринга для хоста |
| `DELETE`| `/api/share/{id}` | Отзыв и деактивация публичной ссылки |
| `GET` | `/d/{token}` | Публичный шлюз скачивания файла по токену |

---

### 6. Системные службы Systemd (`/api/hosts/{id}/systemd`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/systemd/services` | Список всех юнитов systemd с активными состояниями |
| `POST` | `/api/hosts/{id}/systemd/services/{unit}/action` | Управление: `start`, `stop`, `restart`, `enable`, `disable` |
| `GET` | `/api/hosts/{id}/systemd/services/{unit}/logs` | Просмотр системного журнала `journalctl` с фильтрами |

---

### 7. Пользователи Linux (`/api/hosts/{id}/users`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/users` | Список учетных записей Linux, UID, групп и sudo |
| `POST` | `/api/hosts/{id}/users` | Создание пользователя с оболочкой и правами sudo |
| `POST` | `/api/hosts/{id}/users/{user}/lock` | Блокировка входа по паролю (`passwd -l`) |
| `POST` | `/api/hosts/{id}/users/{user}/unlock` | Разблокировка учетной записи (`passwd -u`) |
| `POST` | `/api/hosts/{id}/users/{user}/toggle-sudo` | Добавление или отзыв привилегий sudo / wheel |
| `DELETE`| `/api/hosts/{id}/users/{user}?removeHome=true`| Удаление пользователя и его домашней директории |

---

### 8. Обновления ОС (`/api/hosts/{id}/packages`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/packages/check` | Проверка доступных обновлений безопасности APT/DNF/Pacman |
| `POST` | `/api/hosts/{id}/packages/upgrade` | Фоновый неинтерактивный апгрейд пакетов |

---

### 9. Firewall & Fail2ban (`/api/hosts/{id}/firewall`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/firewall/rules` | Просмотр правил сетевого экрана UFW |
| `POST` | `/api/hosts/{id}/firewall/rules` | Создание правила файрвола (порт, протокол, IP) |
| `DELETE`| `/api/hosts/{id}/firewall/rules/{ruleNumber}` | Удаление правила по его индексу в таблице |
| `GET` | `/api/hosts/{id}/firewall/fail2ban` | Мониторинг активных изоляторов и заблокированных IP |
| `POST` | `/api/hosts/{id}/firewall/fail2ban/unban` | Мгновенный разбан заблокированного IP-адреса |

---

### 10. Планировщик задач Cron (`/api/hosts/{id}/cron`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/cron` | Получение распарсенного списка задач crontab |
| `GET` | `/api/hosts/{id}/cron/raw` | Получение исходного сырого текста crontab |
| `PUT` | `/api/hosts/{id}/cron/raw` | Сохранение crontab через безопасный Base64 пайп |
| `POST` | `/api/hosts/{id}/cron` | Добавление новой задачи в планировщик |
| `PUT` | `/api/hosts/{id}/cron/{lineIndex}` | Редактирование существующей задачи |
| `DELETE`| `/api/hosts/{id}/cron/{lineIndex}` | Удаление задачи из расписания |
| `POST` | `/api/hosts/{id}/cron/{lineIndex}/toggle` | Включение/отключение задачи (комментирование) |
| `POST` | `/api/hosts/{id}/cron/run` | Немедленный тестовый запуск команды задачи |

---

### 11. Порты, сокеты & Туннели (`/api/hosts/{id}/ports`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/hosts/{id}/ports/live-sockets` | Инспекция активных слушающих сокетов `ss -tulpn` |
| `GET` | `/api/hosts/{id}/ports` | Список пользовательских заметок и каталога портов |
| `POST` | `/api/hosts/{id}/ports` | Регистрация описания для порта |
| `DELETE`| `/api/hosts/{id}/ports/{portId}` | Удаление записи порта из каталога |
| `GET` | `/api/hosts/{id}/tunnels` | Список настроенных SSH-туннелей |
| `POST` | `/api/hosts/{id}/tunnels` | Создание туннеля (локальный/удаленный порт) |
| `POST` | `/api/hosts/{id}/tunnels/{tid}/start` | Запуск фонового туннеля |
| `POST` | `/api/hosts/{id}/tunnels/{tid}/stop` | Остановка туннеля |
| `DELETE`| `/api/hosts/{id}/tunnels/{tid}` | Удаление туннеля |

---

### 12. Реестр команд (`/api/commands`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/commands` | Получение всех 56 шаблонов системных команд |
| `GET` | `/api/commands/{key}` | Получение шаблона конкретной команды по ключу |
| `PUT` | `/api/commands/{key}` | Модификация bash-кода команды и ее таймаута |
| `POST` | `/api/commands/reset` | Сброс всех модификаций к заводским значениям `commands.json` |

---

### 13. Центр уведомлений и алертов (`/api/notifications`)

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/notifications` | Список системных оповещений и счетчик непрочитанных |
| `POST` | `/api/notifications/{id}/read` | Отметка алерта как прочитанного |
| `POST` | `/api/notifications/read-all` | Отметка всех алертов прочитанными |
| `DELETE`| `/api/notifications/{id}` | Удаление конкретного оповещения |
| `DELETE`| `/api/notifications/clear-all` | Полная очистка журнала уведомлений |
| `GET` | `/api/notifications/settings` | Получение настроек Telegram бота и Webhook URL |
| `POST` | `/api/notifications/settings` | Сохранение настроек каналов оповещений |
| `POST` | `/api/notifications/test` | Отправка тестового алерта в Telegram и Webhook |

---

## 💻 Примеры запросов cURL

### 1. Получение оперативной телеметрии сервера
```bash
curl -X GET "http://localhost:8080/api/hosts/7c9e6679-7425-40de-944b-e07fc1f90ae7/stats" \
  -H "Authorization: Bearer $NIJIPANEL_TOKEN"
```
**Пример ответа (200 OK):**
```json
{
  "isOnline": true,
  "cpuUsage": 14,
  "ramUsage": "2.4 / 7.8 GB (31%)",
  "diskUsage": "38.2 / 120.0 GB (32%)",
  "uptime": "up 14 days, 3 hours",
  "loadAvg": "0.18 0.22 0.19",
  "netIo": "RX: 14.82 GB | TX: 38.10 GB",
  "os": "Ubuntu 24.04 LTS (Noble Numbat)",
  "docker": "Docker version 27.3.1, build ce12230"
}
```

---

### 2. Запуск аппаратного экспресс-бенчмарка
```bash
curl -X POST "http://localhost:8080/api/hosts/7c9e6679-7425-40de-944b-e07fc1f90ae7/benchmark" \
  -H "Authorization: Bearer $NIJIPANEL_TOKEN"
```
**Пример ответа (200 OK):**
```json
{
  "cpuSha256Throughput": "1482 MB/s",
  "diskDirectWrite": "840 MB/s",
  "pingMinAvgMax": "1.2 / 2.1 / 3.4 ms",
  "healthScore": 96,
  "statusCategory": "High Performance",
  "durationSeconds": 11.2
}
```

---

### 3. Развертывание приложения из App Store (PostgreSQL)
```bash
curl -X POST "http://localhost:8080/api/hosts/7c9e6679-7425-40de-944b-e07fc1f90ae7/docker/templates/deploy" \
  -H "Authorization: Bearer $NIJIPANEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "postgres",
    "targetDir": "/opt/stacks/postgres",
    "envOverrides": {
      "POSTGRES_DB": "production_db",
      "POSTGRES_USER": "db_admin",
      "POSTGRES_PASSWORD": "strong_random_password_2026",
      "HOST_PORT": "5432"
    }
  }'
```
**Пример ответа (200 OK):**
```json
{
  "success": true,
  "stackPath": "/opt/stacks/postgres/docker-compose.yml",
  "output": "[+] Running 2/2\n ✔ Network postgres_default  Created\n ✔ Container postgres-postgres-1  Started"
}
```
