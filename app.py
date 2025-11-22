import sqlite3
import openpyxl
from flask import Flask, render_template, request, jsonify, send_file
from database import init_db, get_db_connection
import json
import os
from datetime import datetime, date
from io import BytesIO

# --- Constants ---
OFFICIAL_HOLIDAYS_2025 = [
    {'date': '2025-01-01', 'description': 'Yılbaşı'},
    {'date': '2025-03-31', 'description': 'Ramazan Bayramı'},
    {'date': '2025-04-01', 'description': 'Ramazan Bayramı'},
    {'date': '2025-04-02', 'description': 'Ramazan Bayramı'},
    {'date': '2025-04-23', 'description': 'Ulusal Egemenlik'},
    {'date': '2025-05-01', 'description': 'Emek ve Dayanışma'},
    {'date': '2025-05-19', 'description': 'Gençlik ve Spor'},
    {'date': '2025-06-27', 'description': 'Kurban Bayramı'},
    {'date': '2025-06-28', 'description': 'Kurban Bayramı'},
    {'date': '2025-06-29', 'description': 'Kurban Bayramı'},
    {'date': '2025-06-30', 'description': 'Kurban Bayramı'},
    {'date': '2025-08-30', 'description': 'Zafer Bayramı'},
    {'date': '2025-09-05', 'description': 'Kurban Bayramı'},
    {'date': '2025-09-06', 'description': 'Kurban Bayramı'},
    {'date': '2025-09-07', 'description': 'Kurban Bayramı'},
    {'date': '2025-09-08', 'description': 'Kurban Bayramı'},
    {'date': '2025-10-29', 'description': 'Cumhuriyet Bayramı'},
]


# Uygulamayı başlatmadan önce veritabanının var olduğundan emin ol
if not os.path.exists('overtime.db'):
    print("Veritabanı bulunamadı, oluşturuluyor...")
    init_db()

app = Flask(__name__)

# --- Helper Functions ---
def get_days_in_month(year_month):
    year, month = map(int, year_month.split('-'))
    return (date(year, month + 1, 1) - date(year, month, 1)).days if month < 12 else 31

def get_working_days_in_month(year_month, custom_holidays):
    year, month = map(int, year_month.split('-'))
    days_in_month = get_days_in_month(year_month)
    working_days = 0
    official_holiday_dates = [h['date'] for h in OFFICIAL_HOLIDAYS_2025]

    for day in range(1, days_in_month + 1):
        current_date = date(year, month, day)
        date_str = current_date.isoformat()
        if current_date.weekday() < 5 and date_str not in custom_holidays and date_str not in official_holiday_dates:
            working_days += 1
    return working_days

# --- Ana Sayfa ---
@app.route('/')
def index():
    return render_template('index.html')

# --- Ayarlar API ---
@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = get_db_connection()
    settings = conn.execute('SELECT key, value FROM settings').fetchall()
    conn.close()
    return jsonify({s['key']: s['value'] for s in settings})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json
    conn = get_db_connection()
    for key, value in data.items():
        conn.execute("UPDATE settings SET value = ? WHERE key = ?", (str(value), key))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Ayarlar güncellendi.'})

# --- Çalışanlar API ---
@app.route('/api/employees', methods=['GET'])
def get_employees():
    conn = get_db_connection()
    employees = conn.execute('SELECT id, name, emp_id, payment_type, fixed_salary FROM employees ORDER BY name').fetchall()
    conn.close()
    return jsonify([dict(emp) for emp in employees])

@app.route('/api/employees', methods=['POST'])
def add_employee():
    data = request.json
    name, emp_id = data.get('name'), data.get('emp_id')
    if not name: return jsonify({'error': 'İsim zorunludur.'}), 400

    conn = get_db_connection()
    cursor = conn.execute("INSERT INTO employees (name, emp_id) VALUES (?, ?)", (name, emp_id))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    # Yeni eklenen çalışanın tam bilgisini dön
    new_employee = {'id': new_id, 'name': name, 'emp_id': emp_id, 'payment_type': 'asgari_ucret_fazla_mesai', 'fixed_salary': 0}
    return jsonify(new_employee), 201

@app.route('/api/employees/<int:id>', methods=['PUT'])
def update_employee(id):
    data = request.json
    payment_type = data.get('payment_type')
    fixed_salary = data.get('fixed_salary')

    conn = get_db_connection()
    conn.execute(
        "UPDATE employees SET payment_type = ?, fixed_salary = ? WHERE id = ?",
        (payment_type, fixed_salary, id)
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Çalışan güncellendi.'})

@app.route('/api/employees/bulk', methods=['POST'])
def add_bulk_employees():
    employees_data = request.json.get('employees', [])
    if not employees_data: return jsonify({'error': 'Çalışan listesi boş.'}), 400

    conn = get_db_connection()
    conn.executemany("INSERT INTO employees (name, emp_id) VALUES (?, ?)",
                     [(e.get('name'), e.get('emp_id')) for e in employees_data])
    conn.commit()
    conn.close()
    return jsonify({'message': f'{len(employees_data)} çalışan eklendi.'}), 201

@app.route('/api/employees/upload', methods=['POST'])
def upload_employees():
    file = request.files.get('file')
    if not file: return jsonify({'error': 'Dosya bulunamadı.'}), 400

    wb = openpyxl.load_workbook(file)
    sheet = wb.active
    employees_to_add = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        name, emp_id = row[0], row[1]
        if name: employees_to_add.append({'name': name, 'emp_id': emp_id})

    if not employees_to_add: return jsonify({'message': 'Eklenecek çalışan bulunamadı.'})

    conn = get_db_connection()
    conn.executemany("INSERT INTO employees (name, emp_id) VALUES (?, ?)",
                     [(e['name'], e['emp_id']) for e in employees_to_add])
    conn.commit()
    conn.close()
    return jsonify({'message': f'{len(employees_to_add)} çalışan Excel\'den eklendi.'})

@app.route('/api/employees/<int:id>', methods=['DELETE'])
def delete_employee(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM employees WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Çalışan silindi.'})

# --- Tatiller API ---
@app.route('/api/holidays', methods=['GET'])
def get_holidays():
    conn = get_db_connection()
    holidays = conn.execute('SELECT date FROM holidays ORDER BY date').fetchall()
    conn.close()
    return jsonify([h['date'] for h in holidays])

@app.route('/api/holidays', methods=['POST'])
def add_holiday():
    date = request.json.get('date')
    if not date: return jsonify({'error': 'Tarih zorunludur.'}), 400
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO holidays (date) VALUES (?)", (date,))
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Bu tarih zaten ekli.'}), 409
    finally: conn.close()
    return jsonify({'message': 'Tatil eklendi.'}), 201

@app.route('/api/holidays/<string:date>', methods=['DELETE'])
def delete_holiday(date):
    conn = get_db_connection()
    conn.execute('DELETE FROM holidays WHERE date = ?', (date,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Tatil silindi.'})

# --- Çalışma Saatleri API ---
@app.route('/api/worklogs/<string:year_month>', methods=['GET'])
def get_work_logs(year_month):
    conn = get_db_connection()
    logs_data = conn.execute(
        "SELECT employee_id, date, day_hours, evening_hours, sunday_reason FROM work_logs WHERE strftime('%Y-%m', date) = ?",
        (year_month,)
    ).fetchall()
    conn.close()
    result = {}
    for log in logs_data:
        emp_id = str(log['employee_id'])
        if emp_id not in result: result[emp_id] = {}
        result[emp_id][log['date']] = {'day': log['day_hours'], 'evening': log['evening_hours'], 'reason': log['sunday_reason']}
    return jsonify(result)

@app.route('/api/worklogs', methods=['POST'])
def update_work_log():
    data = request.json
    emp_id, date, log_type, value, reason = data.get('empId'), data.get('date'), data.get('type'), data.get('value', 0), data.get('reason')
    if not all([emp_id, date, log_type]): return jsonify({'error': 'Eksik parametre.'}), 400

    try:
        value = int(value or 0)
    except (ValueError, TypeError):
        return jsonify({'error': 'Saat değeri tam sayı olmalıdır.'}), 400

    field = 'day_hours' if log_type == 'day' else 'evening_hours'
    conn = get_db_connection()
    existing_log = conn.execute("SELECT id FROM work_logs WHERE employee_id = ? AND date = ?", (emp_id, date)).fetchone()
    if existing_log:
        query = f"UPDATE work_logs SET {field} = ?"
        params = [value]
        if reason is not None:
            query += ", sunday_reason = ?"
            params.append(reason)
        query += " WHERE id = ?"
        params.append(existing_log['id'])
        conn.execute(query, tuple(params))
    else:
        other_field = 'evening_hours' if log_type == 'day' else 'day_hours'
        conn.execute(f"INSERT INTO work_logs (employee_id, date, {field}, {other_field}, sunday_reason) VALUES (?, ?, ?, 0, ?)",
                     (emp_id, date, value, reason))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Çalışma saati güncellendi.'})

@app.route('/api/worklogs/upload', methods=['POST'])
def upload_worklogs():
    file = request.files.get('file')
    if not file: return jsonify({'error': 'Dosya bulunamadı.'}), 400

    conn = get_db_connection()
    employees = {e['name']: e['id'] for e in conn.execute("SELECT id, name FROM employees").fetchall()}
    wb = openpyxl.load_workbook(file)

    def process_sheet(sheet_name, type_):
        if sheet_name not in wb.sheetnames: return
        sheet = wb[sheet_name]
        headers = [cell.value for cell in sheet[1]]
        for row in sheet.iter_rows(min_row=2, values_only=True):
            emp_name = row[0]
            if emp_name in employees:
                emp_id = employees[emp_name]
                for i, hours in enumerate(row[1:], 1):
                    if hours:
                        try:
                            # Değeri önce float'a çevirip sonra int'e yuvarlayarak ondalıklı girişleri de kabul et
                            hours_val = int(float(hours))
                            if hours_val > 0:
                                date_str = headers[i]
                                update_work_log_db(conn, emp_id, date_str, type_, hours_val)
                        except (ValueError, TypeError):
                            # Hatalı formatı görmezden gel ve devam et
                            continue

    process_sheet('Gündüz Mesaisi', 'day')
    process_sheet('Akşam Mesaisi', 'evening')

    conn.commit()
    conn.close()
    return jsonify({'message': 'Çalışma saatleri yüklendi.'})

def update_work_log_db(conn, emp_id, date_str, log_type, value):
    field = 'day_hours' if log_type == 'day' else 'evening_hours'
    existing = conn.execute("SELECT id FROM work_logs WHERE employee_id = ? AND date = ?", (emp_id, date_str)).fetchone()
    if existing:
        conn.execute(f"UPDATE work_logs SET {field} = ? WHERE id = ?", (value, existing['id']))
    else:
        other_field = 'evening_hours' if log_type == 'day' else 'day_hours'
        conn.execute(f"INSERT INTO work_logs (employee_id, date, {field}, {other_field}) VALUES (?, ?, ?, 0)",
                     (emp_id, date_str, value))

@app.route('/api/worklogs/template/<string:year_month>', methods=['GET'])
def download_worklog_template(year_month):
    conn = get_db_connection()
    employees = conn.execute("SELECT name FROM employees ORDER BY name").fetchall()
    conn.close()

    wb = openpyxl.Workbook()
    day_sheet = wb.active
    day_sheet.title = "Gündüz Mesaisi"
    evening_sheet = wb.create_sheet("Akşam Mesaisi")

    headers = ['Ad Soyad'] + [f"{year_month}-{str(day).zfill(2)}" for day in range(1, get_days_in_month(year_month) + 1)]
    day_sheet.append(headers)
    evening_sheet.append(headers)

    for emp in employees:
        day_sheet.append([emp['name']])
        evening_sheet.append([emp['name']])

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(output, as_attachment=True, download_name=f'calisma-sablonu-{year_month}.xlsx')


# --- Raporlama API ---
@app.route('/api/report/<string:year_month>', methods=['GET'])
def get_report(year_month):
    conn = get_db_connection()
    employees = conn.execute("SELECT * FROM employees").fetchall()
    logs_data = conn.execute("SELECT * FROM work_logs WHERE strftime('%Y-%m', date) = ?", (year_month,)).fetchall()
    holidays = [h['date'] for h in conn.execute("SELECT date FROM holidays").fetchall()]
    settings = {s['key']: float(s['value']) for s in conn.execute("SELECT key, value FROM settings").fetchall()}
    conn.close()

    logs_by_emp = {}
    for log in logs_data:
        emp_id = log['employee_id']
        if emp_id not in logs_by_emp: logs_by_emp[emp_id] = {}
        logs_by_emp[emp_id][log['date']] = log

    report = [calculate_payment_for_employee(emp, year_month, logs_by_emp.get(emp['id'], {}), holidays, settings) for emp in employees]
    return jsonify(report)

def calculate_payment_for_employee(emp, year_month, logs, custom_holidays, settings):
    year, month = map(int, year_month.split('-'))
    days_in_month = get_days_in_month(year_month)

    # Saatleri kategorilere ayır
    weekday_day, weekday_evening, weekend_day, weekend_evening = 0, 0, 0, 0
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        log = logs.get(d.isoformat(), {'day_hours': 0, 'evening_hours': 0})
        is_weekend = d.weekday() >= 5
        is_holiday = d.isoformat() in custom_holidays or d.isoformat() in [h['date'] for h in OFFICIAL_HOLIDAYS_2025]

        if is_weekend or is_holiday:
            weekend_day += log['day_hours']
            weekend_evening += log['evening_hours']
        else:
            weekday_day += log['day_hours']
            weekday_evening += log['evening_hours']

    payment_type = emp['payment_type']
    fixed_salary = float(emp['fixed_salary'] or 0)
    day_rate = settings.get('dayRate', 0)
    evening_rate = settings.get('eveningRate', 0)

    overtime_hours = 0
    overtime_payment = 0
    total_payment = 0
    calculation_details = ""

    # Yalnızca Fazla Mesai
    if payment_type == 'yalnizca_fazla_mesai':
        overtime_hours = weekday_day + weekday_evening + weekend_day + weekend_evening
        overtime_payment = (weekday_day * day_rate) + ((weekday_evening + weekend_day + weekend_evening) * evening_rate)
        total_payment = overtime_payment
        calculation_details = "Tüm saatler fazla mesai olarak hesaplandı."

    # Asgari Ücret + Fazla Mesai
    elif payment_type == 'asgari_ucret_fazla_mesai':
        working_days = get_working_days_in_month(year_month, custom_holidays)
        expected_hours = working_days * 4
        extra_weekday_day = max(0, weekday_day - expected_hours)

        overtime_hours = extra_weekday_day + weekday_evening + weekend_day + weekend_evening
        overtime_payment = (extra_weekday_day * day_rate) + ((weekday_evening + weekend_day + weekend_evening) * evening_rate)
        total_payment = settings.get('minimumWage', 0) + overtime_payment
        calculation_details = f"{working_days} iş günü için {expected_hours} saat düşüldü."

    # Sabit Maaş
    elif payment_type == 'sabit_maas':
        overtime_hours = 0
        overtime_payment = 0
        total_payment = fixed_salary
        calculation_details = "Yalnızca sabit maaş alır, fazla mesai hesaplanmaz."

    # Sabit Maaş + Nöbet
    elif payment_type == 'sabit_maas_nobet':
        # Nöbet, hafta sonu veya tatil günleri tutulur varsayımı
        overtime_hours = weekend_day + weekend_evening
        overtime_payment = (weekend_day + weekend_evening) * evening_rate # Nöbetler akşam ücretinden hesaplansın
        total_payment = fixed_salary + overtime_payment
        calculation_details = "Hafta sonu ve tatil günleri nöbet ücreti olarak eklendi."

    return {
        'emp_id': emp['id'], 'name': emp['name'], 'empId': emp['emp_id'],
        'paymentType': payment_type, 'fixedSalary': fixed_salary,
        'weekdayDayHours': weekday_day, 'weekdayEveningHours': weekday_evening,
        'weekendDayHours': weekend_day, 'weekendEveningHours': weekend_evening,
        'totalHours': weekday_day + weekday_evening + weekend_day + weekend_evening,
        'overtimeHours': overtime_hours,
        'overtimePayment': overtime_payment,
        'totalPayment': total_payment,
        'minimumWage': settings.get('minimumWage', 0) if payment_type == 'asgari_ucret_fazla_mesai' else 0,
        'calculationDetails': calculation_details
    }

@app.route('/api/report/export/<string:year_month>', methods=['GET'])
def export_report(year_month):
    report_data = get_report(year_month).get_json()
    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.title = "Maaş Raporu"

    headers = ['Ad Soyad', 'Çalışan No', 'Ödeme Tipi', 'Sabit Maaş', 'Asgari Ücret',
               'Fazla Mesai Saati', 'Fazla Mesai Ödemesi', 'Toplam Hakediş', 'Açıklama']
    sheet.append(headers)

    for data in report_data:
        sheet.append([
            data['name'], data['empId'], data['paymentType'],
            f"{data['fixedSalary']:.2f}", f"{data['minimumWage']:.2f}",
            data['overtimeHours'], f"{data['overtimePayment']:.2f}",
            f"{data['totalPayment']:.2f}", data['calculationDetails']
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(output, as_attachment=True, download_name=f'maas-raporu-{year_month}.xlsx')

@app.route('/api/export_all', methods=['GET'])
def export_all_data():
    conn = get_db_connection()

    # Verileri çek
    employees = conn.execute("SELECT id, name, emp_id, payment_type, fixed_salary FROM employees ORDER BY name").fetchall()
    work_logs = conn.execute("""
        SELECT e.name, w.date, w.day_hours, w.evening_hours, w.sunday_reason
        FROM work_logs w JOIN employees e ON w.employee_id = e.id
        ORDER BY e.name, w.date
    """).fetchall()
    holidays = conn.execute("SELECT date FROM holidays ORDER BY date").fetchall()
    settings = conn.execute("SELECT key, value FROM settings").fetchall()

    conn.close()

    wb = openpyxl.Workbook()

    # Çalışanlar Sayfası
    ws_employees = wb.active
    ws_employees.title = "Çalışanlar"
    ws_employees.append(['ID', 'Ad Soyad', 'Çalışan No', 'Ödeme Tipi', 'Sabit Maaş'])
    for emp in employees:
        ws_employees.append([emp['id'], emp['name'], emp['emp_id'], emp['payment_type'], emp['fixed_salary']])

    # Çalışma Saatleri Sayfası
    ws_worklogs = wb.create_sheet("Çalışma Saatleri")
    ws_worklogs.append(['Ad Soyad', 'Tarih', 'Gündüz Saati', 'Akşam Saati', 'Pazar Gerekçesi'])
    for log in work_logs:
        ws_worklogs.append([log['name'], log['date'], log['day_hours'], log['evening_hours'], log['sunday_reason']])

    # Tatiller Sayfası
    ws_holidays = wb.create_sheet("Tatiller")
    ws_holidays.append(['Tarih'])
    for holiday in holidays:
        ws_holidays.append([holiday['date']])

    # Ayarlar Sayfası
    ws_settings = wb.create_sheet("Ayarlar")
    ws_settings.append(['Ayar', 'Değer'])
    for setting in settings:
        ws_settings.append([setting['key'], setting['value']])

    # Dosyayı hafızada oluştur
    output = BytesIO()
    wb.save(output)
    output.seek(0)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return send_file(output, as_attachment=True, download_name=f'fazla_mesai_yedek_{timestamp}.xlsx')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
