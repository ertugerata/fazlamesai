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
    employees = conn.execute('SELECT id, name, emp_id FROM employees ORDER BY name').fetchall()
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
    return jsonify({'id': new_id, 'name': name, 'emp_id': emp_id}), 201

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
                    if hours and float(hours) > 0:
                        date_str = headers[i]
                        update_work_log_db(conn, emp_id, date_str, type_, float(hours))

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
    employees = conn.execute("SELECT id, name, emp_id FROM employees").fetchall()
    logs_data = conn.execute("SELECT * FROM work_logs WHERE strftime('%Y-%m', date) = ?", (year_month,)).fetchall()
    holidays = [h['date'] for h in conn.execute("SELECT date FROM holidays").fetchall()]
    settings = {s['key']: float(s['value']) for s in conn.execute("SELECT key, value FROM settings").fetchall()}
    conn.close()

    logs_by_emp = {}
    for log in logs_data:
        emp_id = log['employee_id']
        if emp_id not in logs_by_emp: logs_by_emp[emp_id] = {}
        logs_by_emp[emp_id][log['date']] = log

    report = []
    for emp in employees:
        report.append(calculate_overtime_for_employee(emp, year_month, logs_by_emp.get(emp['id'], {}), holidays, settings))

    return jsonify(report)

def calculate_overtime_for_employee(emp, year_month, logs, custom_holidays, settings):
    year, month = map(int, year_month.split('-'))
    days_in_month = get_days_in_month(year_month)

    total_day = 0; total_evening = 0; sat_day = 0; sat_evening = 0; sun_day = 0; sun_evening = 0

    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        log = logs.get(d.isoformat(), {'day_hours': 0, 'evening_hours': 0})
        if d.weekday() == 5:
            sat_day += log['day_hours']; sat_evening += log['evening_hours']
        elif d.weekday() == 6:
            sun_day += log['day_hours']; sun_evening += log['evening_hours']
        else:
            total_day += log['day_hours']; total_evening += log['evening_hours']

    working_days = get_working_days_in_month(year_month, custom_holidays)
    expected_hours = working_days * 4
    extra_day_hours = max(0, total_day - expected_hours)

    total_overtime = extra_day_hours + total_evening + sat_day + sat_evening + sun_day + sun_evening
    total_payment = (extra_day_hours * settings.get('dayRate', 0)) + \
                    ((total_evening + sat_day + sat_evening + sun_day + sun_evening) * settings.get('eveningRate', 0))

    return {
        'emp_id': emp['id'], 'name': emp['name'], 'empId': emp['emp_id'],
        'workingDays': working_days, 'expectedHours': expected_hours,
        'totalDayHours': total_day, 'extraDayHours': extra_day_hours,
        'totalEveningHours': total_evening, 'saturdayDayHours': sat_day, 'saturdayEveningHours': sat_evening,
        'sundayDayHours': sun_day, 'sundayEveningHours': sun_evening,
        'totalOvertime': total_overtime, 'totalPayment': total_payment,
    }

@app.route('/api/report/export/<string:year_month>', methods=['GET'])
def export_report(year_month):
    # This reuses the logic from get_report, which is slightly inefficient but simple
    report_data = get_report(year_month).get_json()

    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.title = "Fazla Mesai Raporu"

    headers = ['Ad Soyad', 'Çalışan No', 'Beklenen Saat', 'Fazla Gündüz', 'Toplam Akşam',
               'Cumartesi Gündüz', 'Cumartesi Akşam', 'Pazar Gündüz', 'Pazar Akşam',
               'Toplam Fazla Mesai', 'Toplam Ödeme (₺)']
    sheet.append(headers)

    for row_data in report_data:
        sheet.append([
            row_data['name'], row_data['empId'], row_data['expectedHours'], row_data['extraDayHours'],
            row_data['totalEveningHours'], row_data['saturdayDayHours'], row_data['saturdayEveningHours'],
            row_data['sundayDayHours'], row_data['sundayEveningHours'], row_data['totalOvertime'],
            f"{row_data['totalPayment']:.2f}"
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(output, as_attachment=True, download_name=f'fazla-mesai-raporu-{year_month}.xlsx')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
