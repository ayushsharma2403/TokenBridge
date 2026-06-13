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
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS sessions (session_id VARCHAR(150) NOT NULL, messages LONGTEXT NOT NULL, provider VARCHAR(50) DEFAULT 'claude', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (session_id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS usage_log (id INT AUTO_INCREMENT, session_id VARCHAR(150) NOT NULL, tokens_used INT NOT NULL, call_type VARCHAR(50) DEFAULT 'chat', logged_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id))""")
    conn.commit()
    c.close()
    conn.close()
    print("[DB] Tables ready.")
