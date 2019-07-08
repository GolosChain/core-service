# CORE-SERVICE

**CORE-SERVICE** является набором корневых классов и утилит для микросервисов CyberWay.

Основные возможности:

-   Базовый класс виртуального сервиса, на основе которого строятся все микросервисы.  
    Каждый микросервис содержит в себе 1 или более виртуальных сервисов, работающих асинхронно и скомпанованных в древовидную структуру зависимостей.  
    Базовый класс предлагает общий интерфейс и некоторые утилитные методы для работы, подробнее в описании самого класса.

-   Виртуальный сервис для подписки на блоки, генерируемые блокчейном CyberWay.

-   Виртуальный сервис восстановления пропущенный блоков на случай если микросервис был перезапущен или произошло что-либо иное подобное.

-   Виртуальный сервис работы с базой данных MongoDB, используя Mongoose.

-   Виртуальный сервис связи микросервисов, позволяющий осуществлять двухстороннюю связь между микросервисами через HTTP, используя JSON-RPC, добавляя к этому возможность множественного ответа на единичный запрос JSON-RPC (например для подписки на что-либо).

-   Утилиты и обертки для работы со временем, логами и переменными окружения.

-   StatsD мониторинг.

Набор `ENV`, которые можно определять для корневых классов:

-   `GLS_CONNECTOR_HOST` - адрес, который будет использован для входящих подключений связи микросервисов.  
    Дефолтное значение - `127.0.0.1`

-   `GLS_CONNECTOR_PORT` - адрес порта, который будет использован для входящих подключений связи микросервисов.  
    Дефолтное значение - `3000`

-   `GLS_METRICS_HOST` - адрес хоста для метрик StatsD.  
    Дефолтное значение - `127.0.0.1`

-   `GLS_METRICS_PORT` - адрес порта для метрик StatsD.  
    Дефолтное значение - `8125`

-   `GLS_MONGO_CONNECT` - строка подключения к базе MongoDB.  
    Дефолтное значение - `mongodb://mongo/admin`

-   `GLS_DAY_START` - время начала нового дня в часах относительно UTC, используется для таких вещей как валидация "1 пост в сутки".  
    Дефолтное значение - `3` _(день начинается в 00:00 по Москве)._

-   `GLS_CYBERWAY_CONNECT` - строка подключения к блокчейну CyberWay как клиент.

-   `GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME` - имя сервера рассыльщика блоков.

-   `GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME` - имя клиента для подключения к рассыльщику блоков.

-   `GLS_BLOCKCHAIN_BROADCASTER_CONNECT` - строка подключения к рассыльщику блоков, может содержать авторизацию.

-   `GLS_BLOCK_SUBSCRIBER_REPLAY_TIME_DELTA` - дельта времени для реплея блоков при запуске, необходимо для восстановления пропущенных блоков.  
    Дефолтное значение - `600000` _(10 минут)_

-   `GLS_BLOCK_SUBSCRIBER_CLEANER_INTERVAL` - интервал запуска систем очистки подписчика блоков.  
    Дефолтное значение - `600000` _(10 минут)_

-   `GLS_BLOCK_SUBSCRIBER_LAST_BLOCK_STORE` - количество сохраняемых блоков из прошлого для подписчика на блоки.  
    Дефолтное значение - `1000`

-   `GLS_SYSTEM_METRICS` - включает логирование системных показателей системы для Prometheus.  
    Дефолтное значение - `false`

-   `GLS_EXTERNAL_CALLS_METRICS` - включает метрики по исходящим запросами сервиса. Изначально собираются только метрики по входящим запросам.  
    Дефолтное значение - `false`

-   `GLS_USE_ONLY_RECENT_BLOCKS` - режим при котором подписчик блоков не пытается скачать все пропущенные с последнего запуска блоки, а берет всегда текущие.  
    (Применяется для разработки, чтобы не ждать все пропущенные блоки)  
    Дефолтное значение - `false`

-   `GLS_RECENT_BLOCKS_TIME_DELTA` - параметр для найстройки режима `GLS_USE_ONLY_RECENT_BLOCKS`, выставляет на сколько времени в прошлое надо брать блоки.  
    Дефолтное значение - `300000` (5 минут)

-   `GLS_LOCAL_METRICS` - переключает метрики с Prometheus на локальные, имеет два варианта значения: log и file, при log метрики будут выводиться каждые 30 секунд в консоль, при file будет писаться файл stats.txt в корень проекта каждый 2 секунды.  
    Дефолтное значение - `false`

-   `GLS_PRESERVE_LOCAL_METRICS` - сохранять метрики прошлога запуска в файл stats-\${TIMESTAMP}.txt  
    Дефолтное значение - `false`

-   `GLS_ALLOW_TRANSACTION_MISS` - включает режим подписчика блоков разрешающий пропускать тразакции после пятиминутного ожидания, но при этом активно логируя этот факт в консоль.  
    Дефолтное значение - `false`

-   `GLS_WAIT_FOR_TRANSACTION_TIMEOUT` - таймаут ожидания транзакции при формировании блока (ms)
    Дефолтное значение - `300000` (5 минут)

-   `GLS_MAX_IN_FLIGHT_TRANSACTIONS` - количество паралельно загружаемых транзакций подписчиком блоков  
    Дефолтное значение - `5`

-   `GLS_TRANSACTIONS_TIME_GAP` - временной запас за сколько времени нужно начинать собирать транзакции до времени блока (ms)  
    Дефолтное значение - `60000` (1 минута)
