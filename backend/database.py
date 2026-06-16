import mysql.connector
from mysql.connector import Error
from config import DB_CONFIG


def connect():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        raise ConnectionError(f"MySQL connection failed: {e}")


def setup():
    conn = connect()
    c    = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            name           VARCHAR(100) NOT NULL,
            email          VARCHAR(150) NOT NULL UNIQUE,
            password_hash  VARCHAR(255),
            google_id      VARCHAR(100),
            reset_token    VARCHAR(100),
            reset_expires  DATETIME,
            created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active      BOOLEAN  DEFAULT TRUE
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id  VARCHAR(150) NOT NULL,
            user_id     INT,
            messages    LONGTEXT     NOT NULL,
            provider    VARCHAR(50)  DEFAULT 'claude',
            created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (session_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS usage_log (
            id          INT AUTO_INCREMENT,
            session_id  VARCHAR(150) NOT NULL,
            user_id     INT,
            tokens_used INT          NOT NULL,
            call_type   VARCHAR(50)  DEFAULT 'chat',
            logged_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_session_id (session_id),
            INDEX idx_user_id    (user_id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS tokenvault (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            session_id    VARCHAR(150) NOT NULL,
            user_id       INT,
            provider      VARCHAR(50)  NOT NULL,
            call_type     VARCHAR(50)  DEFAULT 'chat',
            input_tokens  INT          DEFAULT 0,
            output_tokens INT          DEFAULT 0,
            total_tokens  INT          DEFAULT 0,
            cost_usd      FLOAT        DEFAULT 0.0,
            tokens_saved  INT          DEFAULT 0,
            saving_source VARCHAR(50)  DEFAULT 'none',
            logged_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_session  (session_id),
            INDEX idx_provider (provider),
            INDEX idx_user     (user_id)
        )
    """)

    conn.commit()
    c.close()
    conn.close()
    print("[DB] All tables ready.")
