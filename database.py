import sqlite3

def get_db_connection():
    """Veritabanına bir bağlantı oluşturur ve döner."""
    conn = sqlite3.connect('overtime.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Veritabanı tablolarını (eğer yoksa) oluşturur."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Employees tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            emp_id TEXT,
            payment_type TEXT DEFAULT 'asgari_ucret_fazla_mesai',
            fixed_salary REAL DEFAULT 0
        )
    ''')

    # Work Logs tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS work_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            day_hours REAL DEFAULT 0,
            evening_hours REAL DEFAULT 0,
            sunday_reason TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
        )
    ''')

    # Holidays tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS holidays (
            date TEXT PRIMARY KEY
        )
    ''')

    # Settings tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')

    # Varsayılan ayarları ekle
    try:
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('dayRate', '100'))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('eveningRate', '120'))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('minimumWage', '17002'))
    except sqlite3.IntegrityError:
        # Ayarlar zaten mevcut, atla
        pass

    conn.commit()
    conn.close()

if __name__ == '__main__':
    print("Veritabanı başlatılıyor...")
    init_db()
    print("Veritabanı başarıyla başlatıldı ve tablolar oluşturuldu.")
