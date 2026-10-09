# ⚙️ Реестр команд (commands.json)

Одной из уникальных архитектурных особенностей NijiPanel является полное отсутствие захардкоженных bash-строк в кодовой базе бэкенда.

Все системные команды платформы вынесены во внешний реестр `commands.json` и синхронизируются с таблицей базы данных `command_templates`.

---

## 💡 Зачем нужен отдельный реестр команд?

1. **Гибкость дистрибутивов:**  
   Разные дистрибутивы Linux могут использовать разные пути к утилитам (например, `/usr/sbin/service` вместо `systemctl`, `iptables-legacy` вместо `nftables`, `ash` вместо `bash` в Alpine).
2. **Кастомизация без перекомпиляции:**  
   Системный администратор может изменить параметры зондов, добавить дополнительные флаги логирования или таймауты прямо через веб-интерфейс панели.
3. **Прозрачность и безопасность:**  
   Вы всегда точно знаете, какие именно команды выполняет панель на ваших серверах, можете провести аудит безопасности или ограничить выполняемые команды политиками `sudoers`.

---

## 🗂️ 56 системных команд платформы по категориям

| Категория | Кол-во | Примеры ключей | Назначение |
| :--- | :--- | :--- | :--- |
| **Docker** | 16 | `Docker.ListContainers`, `Docker.InspectStateBatch`, `Docker.PrunePreview`, `Docker.InspectCrashDump` | Мониторинг, краш-детекция, Smart Prune и управление контейнерами |
| **Users** | 9 | `Users.List`, `Users.Create`, `Users.Lock`, `Users.ToggleSudo`, `Users.Delete` | Аудит пользователей, sudo и блокировка доступа |
| **Firewall** | 7 | `Firewall.UfwStatus`, `Firewall.UfwAddRule`, `Firewall.Fail2banStatus`, `Firewall.Fail2banUnban` | Управление сетевым экраном UFW и разбан в Fail2ban |
| **Files** | 7 | `Files.DiskUsageTreemap`, `Files.CreateArchive`, `Files.ExtractArchive`, `Files.DirectTransfer` | Расчет дискового пространства, архивация zip/tar и rsync перенос |
| **Packages** | 6 | `Packages.AptCheck`, `Packages.AptUpgrade`, `Packages.DnfCheck`, `Packages.PacmanUpgrade` | Проверка обновлений и апгрейд пакетов разных ОС |
| **System** | 4 | `System.StatsProbe`, `System.HardwareBenchmark`, `System.LiveSockets`, `System.HardeningSshPort` | Телеметрия хоста, бенчмарк, открытые сокеты и миграция порта SSH |
| **Systemd** | 4 | `Systemd.ListServices`, `Systemd.ServiceAction`, `Systemd.ServiceLogs` | Инвентаризация служб, управление состоянием и журнал journalctl |
| **Cron** | 2 | `Cron.List`, `Cron.SaveRaw` | Чтение и безопасная установка crontab через Base64 |
| **Network** | 1 | `Network.Probe` | Инспекция интерфейсов (`ip -j addr`), маршрутов и GeoIP |

---

## 📝 Структура шаблона команды

Каждая команда описывается JSON-объектом следующего формата:

```json
{
  "key": "System.StatsProbe",
  "category": "System",
  "description": "Probe CPU, RAM, Disk, Net I/O, uptime and Docker engine presence",
  "timeoutSeconds": 10,
  "command": "echo '---OS---'\nif [ -f /etc/os-release ]; then . /etc/os-release; echo \"$PRETTY_NAME\"; else uname -srm; fi\necho '---UPTIME---'\nuptime -p 2>/dev/null || uptime | awk '{print $3,$4}'\necho '---LOAD---'\ncat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || echo ''\necho '---MEM---'\nfree -m 2>/dev/null | awk 'NR==2{printf \"%d|%d|%.1f / %.1f GB (%.0f%%)\", $3, $2, $3/1024, $2/1024, ($2>0 ? $3*100/$2 : 0)}'\necho ''\necho '---DISK---'\ndf -m / 2>/dev/null | awk 'NR==2{printf \"%d|%d|%.1f / %.1f GB (%s)\", $3, $2, $3/1024, $2/1024, $5}'\necho ''\necho '---NET---'\nawk 'NR>2 && $1 !~ /lo:/ {rx+=$2; tx+=$10} END {printf \"RX: %.2f GB | TX: %.2f GB\", rx/1024/1024/1024, tx/1024/1024/1024}' /proc/net/dev 2>/dev/null || echo ''\necho '---CPU---'\ntop -bn1 2>/dev/null | grep \"Cpu(s)\" | sed \"s/.*, *\\([0-9.]*\\)%* id.*/\\1/\" | awk '{printf \"%d\", 100 - $1}' || echo '0'\necho '---DOCKER---'\ndocker --version 2>/dev/null || echo 'Not installed'"
}
```

### Подстановка параметров:
В теле команды поддерживаются шаблонные подстановки в фигурных скобках (например, `{containerId}`, `{newPort}`, `{unitName}`, `{path}`, `{action}`). Бэкенд безопасно экранирует аргументы перед передачей в SSH-сессию.

---

## 🛠️ Встроенный редактор в панели

В разделе настроек **Settings -> Commands Registry** доступен графический менеджер команд:

* **Поиск по ключу и описанию:** быстрый ввод названия команды.
* **Фильтры категорий:** табы `All`, `System`, `Docker`, `Network`, `Files`, `Firewall`, `Users`, `Packages`.
* **Инлайн-редактирование:** подсветка синтаксиса bash, возможность изменить таймаут выполнения в секундах.
* **Статус-бейдж `CUSTOMIZED`:** модифицированные команды отмечаются золотистым бейджем, чтобы администратор видел отклонения от эталона.
* **Сброс к дефолтным значениям (Reset to Factory Defaults):** кнопка сброса возвращает отредактированную команду к оригинальному виду из исходного файла `commands.json`.
