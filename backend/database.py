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
            email          VARCHAR(150) NULL UNIQUE,
            password_hash  VARCHAR(255),
            google_id      VARCHAR(100),
            reset_token    VARCHAR(100),
            reset_expires  DATETIME,
            created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active      BOOLEAN  DEFAULT TRUE
        )
    """)
    try:
        c.execute("ALTER TABLE users MODIFY email VARCHAR(150) NULL")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL AFTER email")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE users ADD COLUMN dob DATE NULL AFTER email")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE users ADD COLUMN age INT NULL AFTER dob")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'Free' AFTER age")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE users ADD COLUMN language VARCHAR(20) DEFAULT 'en' AFTER subscription_tier")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE usage_log ADD COLUMN user_id INT AFTER session_id")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE usage_log ADD COLUMN provider VARCHAR(50) DEFAULT 'claude' AFTER user_id")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE tokenvault ADD COLUMN user_id INT AFTER session_id")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

    try:
        c.execute("ALTER TABLE sessions ADD COLUMN user_id INT AFTER session_id")
    except Exception as e:
        print(f"[DB Migration] Skipped (likely already applied): {e}")

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
            provider    VARCHAR(50)  DEFAULT 'claude',
            tokens_used INT          NOT NULL,
            call_type   VARCHAR(50)  DEFAULT 'chat',
            logged_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_session_id (session_id),
            INDEX idx_user_id    (user_id),
            INDEX idx_provider   (provider)
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
