import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()

DB_FILE = os.getenv('DATABASE_FILE', 'overtime.db')

def get_db_connection():
    """Veritabanına bir bağlantı oluşturur ve döner."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Veritabanı tablolarını (eğer yoksa) oluşturur."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Salary Types tablosu (Yeni)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS salary_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            include_min_wage INTEGER DEFAULT 0,
            include_fixed_salary INTEGER DEFAULT 0,
            include_fixed_overtime_pay INTEGER DEFAULT 0,
            include_fixed_hours_quota INTEGER DEFAULT 0,
            include_overtime_calc INTEGER DEFAULT 0,
            include_on_call INTEGER DEFAULT 0
        )
    ''')

    # Employees tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            emp_id TEXT,
            branch TEXT,
            payment_type TEXT DEFAULT 'asgari_ucret_fazla_mesai',
            salary_type_id INTEGER,
            fixed_salary REAL DEFAULT 0,
            fixed_hours REAL DEFAULT 0,
            fixed_overtime_pay REAL DEFAULT 0,
            fixed_day_hours REAL DEFAULT 0,
            fixed_evening_hours REAL DEFAULT 0,
            FOREIGN KEY (salary_type_id) REFERENCES salary_types (id)
        )
    ''')

    # Mevcut tabloya yeni kolonları ekle (Migration)
    cursor.execute("PRAGMA table_info(employees)")
    columns = [info[1] for info in cursor.fetchall()]

    if 'fixed_hours' not in columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN fixed_hours REAL DEFAULT 0")
    if 'fixed_overtime_pay' not in columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN fixed_overtime_pay REAL DEFAULT 0")
    if 'fixed_day_hours' not in columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN fixed_day_hours REAL DEFAULT 0")
    if 'fixed_evening_hours' not in columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN fixed_evening_hours REAL DEFAULT 0")
    if 'branch' not in columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN branch TEXT")
    if 'salary_type_id' not in columns:
        print("Migrating: Adding salary_type_id column to employees table...")
        cursor.execute("ALTER TABLE employees ADD COLUMN salary_type_id INTEGER REFERENCES salary_types(id)")

    # Work Logs tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS work_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            day_hours INTEGER DEFAULT 0,
            evening_hours INTEGER DEFAULT 0,
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
        pass

    # Varsayılan Maaş Opsiyonlarını (Salary Types) Ekle ve Göç Yap
    cursor.execute("SELECT COUNT(*) FROM salary_types")
    if cursor.fetchone()[0] == 0:
        print("Migrating: Seeding default salary types...")
        # (name, min_wage, fixed_sal, fixed_ot_pay, fixed_quota, ot_calc, on_call)
        defaults = [
            ('Asgari Ücret + Fazla Mesai', 1, 0, 0, 0, 1, 0),
            ('Yalnızca Sabit Maaş', 0, 1, 0, 0, 0, 0),
            ('Sabit Maaş + Nöbet', 0, 1, 0, 0, 0, 1),
            ('Yalnızca Fazla Mesai', 0, 0, 0, 0, 1, 0),
            ('Asgari Ücret + Sabit FM Saati (Eski)', 1, 0, 0, 1, 0, 0), # Mapped to Quota
            ('Asgari Ücret + Sabit FM Ücreti', 1, 0, 1, 0, 0, 0),
            ('Asgari Ücret + Ders Saati + Nöbet', 1, 0, 0, 1, 0, 1)
        ]

        type_map = {} # old_key -> new_id

        # Insert and capture IDs
        for d in defaults:
            cursor.execute("""
                INSERT INTO salary_types (name, include_min_wage, include_fixed_salary, include_fixed_overtime_pay, include_fixed_hours_quota, include_overtime_calc, include_on_call)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, d)
            type_map[d[0]] = cursor.lastrowid

        # Old Key Map
        key_map = {
            'asgari_ucret_fazla_mesai': 'Asgari Ücret + Fazla Mesai',
            'sabit_maas': 'Yalnızca Sabit Maaş',
            'sabit_maas_nobet': 'Sabit Maaş + Nöbet',
            'yalnizca_fazla_mesai': 'Yalnızca Fazla Mesai',
            'asgari_ucret_sabit_saat': 'Asgari Ücret + Sabit FM Saati (Eski)',
            'asgari_ucret_sabit_ucret': 'Asgari Ücret + Sabit FM Ücreti',
            'asgari_ucret_ders_saati_nobet': 'Asgari Ücret + Ders Saati + Nöbet'
        }

        # Update existing employees
        print("Migrating: Updating employee salary_type_id references...")
        cursor.execute("SELECT id, payment_type, fixed_hours FROM employees")
        emps = cursor.fetchall()
        for emp in emps:
            old_type = emp['payment_type']
            if old_type in key_map:
                new_type_name = key_map[old_type]
                new_id = type_map.get(new_type_name)
                if new_id:
                    cursor.execute("UPDATE employees SET salary_type_id = ? WHERE id = ?", (new_id, emp['id']))

                    # Özel Göç: asgari_ucret_sabit_saat (Eski) -> fixed_hours verisini fixed_evening_hours'a taşı
                    if old_type == 'asgari_ucret_sabit_saat' and emp['fixed_hours']:
                         cursor.execute("UPDATE employees SET fixed_evening_hours = ? WHERE id = ?", (emp['fixed_hours'], emp['id']))

    conn.commit()
    conn.close()

if __name__ == '__main__':
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    logger.info(f"Veritabanı başlatılıyor... (Dosya: {DB_FILE})")
    init_db()
    logger.info("Veritabanı başarıyla başlatıldı ve tablolar oluşturuldu.")
