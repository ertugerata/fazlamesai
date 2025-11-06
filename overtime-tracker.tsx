import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Calendar, Users, Clock, Download, Upload, Plus, Trash2, FileUp } from 'lucide-react';
import * as XLSX from 'xlsx';

function OvertimeTracker() {
  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem('employees');
    return saved ? JSON.parse(saved) : [];
  });
  const [workLogs, setWorkLogs] = useState(() => {
    const saved = localStorage.getItem('workLogs');
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    // Migration for old data structure
    Object.keys(parsed).forEach(empId => {
      Object.keys(parsed[empId]).forEach(date => {
        if (typeof parsed[empId][date] === 'number') {
          parsed[empId][date] = { day: parsed[empId][date], evening: 0 };
        }
      });
    });
    return parsed;
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [holidays, setHolidays] = useState(() => {
    const saved = localStorage.getItem('holidays');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState('employees');
  
  const [dayRate, setDayRate] = useState(() => {
    const saved = localStorage.getItem('dayRate');
    return saved ? JSON.parse(saved) : 100;
  });
  const [eveningRate, setEveningRate] = useState(() => {
    const saved = localStorage.getItem('eveningRate');
    return saved ? JSON.parse(saved) : 120;
  });

  const [newEmployee, setNewEmployee] = useState({ name: '', id: '' });
  const [bulkEmployees, setBulkEmployees] = useState('');
  
  const officialHolidays2025 = [
    { date: '2025-01-01', description: 'Yılbaşı' },
    { date: '2025-03-31', description: 'Ramazan Bayramı' },
    { date: '2025-04-01', description: 'Ramazan Bayramı' },
    { date: '2025-04-02', description: 'Ramazan Bayramı' },
    { date: '2025-04-23', description: 'Ulusal Egemenlik' },
    { date: '2025-05-01', description: 'Emek ve Dayanışma' },
    { date: '2025-05-19', description: 'Gençlik ve Spor' },
    { date: '2025-06-27', description: 'Kurban Bayramı' },
    { date: '2025-06-28', description: 'Kurban Bayramı' },
    { date: '2025-06-29', description: 'Kurban Bayramı' },
    { date: '2025-06-30', description: 'Kurban Bayramı' },
    { date: '2025-08-30', description: 'Zafer Bayramı' },
    { date: '2025-09-05', description: 'Kurban Bayramı' },
    { date: '2025-09-06', description: 'Kurban Bayramı' },
    { date: '2025-09-07', description: 'Kurban Bayramı' },
    { date: '2025-09-08', description: 'Kurban Bayramı' },
    { date: '2025-10-29', description: 'Cumhuriyet Bayramı' },
    { date: '2025-12-02', description: 'Ramazan Bayramı' },
    { date: '2025-12-03', description: 'Ramazan Bayramı' },
    { date: '2025-12-04', description: 'Ramazan Bayramı' },
    { date: '2025-12-05', description: 'Ramazan Bayramı' }
  ];

  useEffect(() => {
    localStorage.setItem('employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('workLogs', JSON.stringify(workLogs));
  }, [workLogs]);

  useEffect(() => {
    localStorage.setItem('holidays', JSON.stringify(holidays));
  }, [holidays]);

  useEffect(() => {
    localStorage.setItem('dayRate', JSON.stringify(dayRate));
  }, [dayRate]);

  useEffect(() => {
    localStorage.setItem('eveningRate', JSON.stringify(eveningRate));
  }, [eveningRate]);

  const handleEmployeeFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const newEmps = jsonData.map(row => ({
      name: row['Ad Soyad'] || row['Ad'] || row['İsim'] || '',
      empId: row['Çalışan No'] || row['No'] || '',
      id: Date.now().toString() + Math.random()
    })).filter(emp => emp.name);

    setEmployees([...employees, ...newEmps]);
  };

  const handleWorkLogFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const newLogs = { ...workLogs };
    
    jsonData.forEach(row => {
      const empName = row['Ad Soyad'] || row['Ad'] || row['İsim'];
      const emp = employees.find(e => e.name === empName);
      
      if (emp) {
        Object.keys(row).forEach(key => {
          if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
            if (!newLogs[emp.id]) newLogs[emp.id] = {};
            newLogs[emp.id][key] = parseFloat(row[key]) || 0;
          }
        });
      }
    });

    setWorkLogs(newLogs);
  };

  const addEmployee = () => {
    if (newEmployee.name && newEmployee.id) {
      setEmployees([...employees, { ...newEmployee, id: Date.now().toString() }]);
      setNewEmployee({ name: '', id: '' });
    }
  };

  const addBulkEmployees = () => {
    const lines = bulkEmployees.split('\n').filter(l => l.trim());
    const newEmps = lines.map(line => {
      const [name, empId] = line.split(',').map(s => s.trim());
      return { name, id: Date.now().toString() + Math.random(), empId };
    });
    setEmployees([...employees, ...newEmps]);
    setBulkEmployees('');
  };

  const removeEmployee = (id) => {
    setEmployees(employees.filter(e => e.id !== id));
    const newLogs = { ...workLogs };
    delete newLogs[id];
    setWorkLogs(newLogs);
  };

  const updateWorkLog = (empId, date, value, type, dayOfWeek) => {
    const currentLog = workLogs[empId]?.[date] || { day: 0, evening: 0 };
    let newLog = { ...currentLog, [type]: parseFloat(value) || 0 };

    if (dayOfWeek === 0 && (newLog.day > 0 || newLog.evening > 0) && !newLog.reason) {
      const reason = prompt('Pazar günü çalışması için lütfen bir açıklama girin:');
      if (reason) {
        newLog.reason = reason;
      } else {
        return; // Do not update if no reason is provided for Sunday work
      }
    }

    setWorkLogs({
      ...workLogs,
      [empId]: {
        ...(workLogs[empId] || {}),
        [date]: newLog
      }
    });
  };

  const getDaysInMonth = (yearMonth) => {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const getWorkingDaysInMonth = (yearMonth) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(yearMonth);
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const isOfficialHoliday = officialHolidays2025.some(h => h.date === dateStr);
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidays.includes(dateStr) && !isOfficialHoliday) {
        workingDays++;
      }
    }
    return workingDays;
  };

  const calculateOvertime = (empId) => {
    const logs = workLogs[empId] || {};
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(selectedMonth);

    let totalDayHours = 0;
    let totalEveningHours = 0;
    let saturdayDayHours = 0;
    let saturdayEveningHours = 0;
    let sundayDayHours = 0;
    let sundayEveningHours = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const log = logs[dateStr] || { day: 0, evening: 0 };

      if (dayOfWeek === 0) { // Sunday
        sundayDayHours += log.day;
        sundayEveningHours += log.evening;
      } else if (dayOfWeek === 6) { // Saturday
        saturdayDayHours += log.day;
        saturdayEveningHours += log.evening;
      } else { // Weekday
        totalDayHours += log.day;
        totalEveningHours += log.evening;
      }
    }

    const workingDays = getWorkingDaysInMonth(selectedMonth);
    const expectedHours = workingDays * 4;
    const extraDayHours = Math.max(0, totalDayHours - expectedHours);
    
    const totalOvertime = extraDayHours + totalEveningHours + saturdayDayHours + saturdayEveningHours + sundayDayHours + sundayEveningHours;
    const totalPayment = (extraDayHours * dayRate) + ((totalEveningHours + saturdayDayHours + saturdayEveningHours + sundayDayHours + sundayEveningHours) * eveningRate);

    return {
      workingDays,
      expectedHours,
      totalDayHours,
      extraDayHours,
      totalEveningHours,
      saturdayDayHours,
      saturdayEveningHours,
      sundayDayHours,
      sundayEveningHours,
      totalOvertime,
      totalPayment,
    };
  };

  const exportToCSV = () => {
    let csv = 'Ad,Çalışan No,Beklenen Saat,Fazla Gündüz,Toplam Akşam,Cumartesi Gündüz,Cumartesi Akşam,Pazar Gündüz,Pazar Akşam,Toplam Fazla Mesai,Toplam Ödeme (₺)\n';
    employees.forEach(emp => {
      const calc = calculateOvertime(emp.id);
      csv += `${emp.name},${emp.empId || '-'},${calc.expectedHours},${calc.extraDayHours},${calc.totalEveningHours},${calc.saturdayDayHours},${calc.saturdayEveningHours},${calc.sundayDayHours},${calc.sundayEveningHours},${calc.totalOvertime},${calc.totalPayment.toFixed(2)}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fazla-mesai-${selectedMonth}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-800">Fazla Mesai Takip</h1>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Dışa Aktar
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-6 border-b">
            {['employees', 'worklog', 'holidays', 'report', 'settings'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'employees' && '👥 Çalışanlar'}
                {tab === 'worklog' && '📅 Çalışma Saatleri'}
                {tab === 'holidays' && '🏖️ Tatil Günleri'}
                {tab === 'report' && '📊 Rapor'}
                {tab === 'settings' && '⚙️ Ayarlar'}
              </button>
            ))}
          </div>

          {activeTab === 'employees' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 p-6 rounded-lg" data-testid="single-employee-form">
                <h3 className="font-semibold text-lg mb-4">Tek Çalışan Ekle</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Ad Soyad"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="flex-1 px-4 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Çalışan No (opsiyonel)"
                    value={newEmployee.id}
                    onChange={(e) => setNewEmployee({ ...newEmployee, id: e.target.value })}
                    className="flex-1 px-4 py-2 border rounded-lg"
                  />
                  <button
                    onClick={addEmployee}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Ekle
                  </button>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Excel'den Çalışan Yükle</h3>
                <p className="text-sm text-gray-600 mb-3">Excel'de şu sütunlar olmalı: "Ad Soyad", "Çalışan No"</p>
                <div className="flex items-center gap-3">
                  <label className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer flex items-center gap-2">
                    <FileUp className="w-4 h-4" />
                    Excel Seç
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleEmployeeFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Toplu Çalışan Ekle</h3>
                <p className="text-sm text-gray-600 mb-3">Her satıra: Ad Soyad, Çalışan No</p>
                <textarea
                  placeholder="Ahmet Yılmaz, 1001&#10;Ayşe Demir, 1002&#10;Mehmet Kaya, 1003"
                  value={bulkEmployees}
                  onChange={(e) => setBulkEmployees(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg h-32"
                />
                <button
                  onClick={addBulkEmployees}
                  className="mt-3 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Toplu Ekle
                </button>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Çalışan Listesi ({employees.length})</h3>
                <div className="space-y-2">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between bg-white p-4 rounded-lg">
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        {emp.empId && <p className="text-sm text-gray-500">No: {emp.empId}</p>}
                      </div>
                      <button
                        onClick={() => removeEmployee(emp.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'worklog' && (
            <div className="space-y-4">
              <div className="bg-orange-50 p-6 rounded-lg mb-4">
                <h3 className="font-semibold text-lg mb-4">Excel'den Çalışma Saatleri Yükle</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Excel'de: "Ad Soyad" sütunu + Tarih sütunları (2025-01-01, 2025-01-02 formatında)
                </p>
                <label className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer flex items-center gap-2 inline-flex">
                  <FileUp className="w-4 h-4" />
                  Excel Seç
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleWorkLogFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {employees.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Önce çalışan ekleyin</p>
              ) : (
                employees.map(emp => {
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const daysInMonth = getDaysInMonth(selectedMonth);
                  
                  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
                  return (
                    <div key={emp.id} className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="font-semibold text-lg mb-4">{emp.name}</h3>
                      <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const day = i + 1;
                          const date = new Date(year, month - 1, day);
                          const dayOfWeek = date.getDay();
                          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const isHoliday = holidays.includes(dateStr) || officialHolidays2025.some(h => h.date === dateStr);
                          
                          const log = workLogs[emp.id]?.[dateStr] || { day: 0, evening: 0 };
                          return (
                            <div key={day} className={`text-center p-2 rounded-lg ${isHoliday ? 'bg-red-100' : isWeekend ? 'bg-yellow-100' : 'bg-white'}`}>
                              <div className="flex items-center justify-center">
                                <div className={`text-xs font-bold mb-1 ${isWeekend ? 'text-red-500' : 'text-gray-600'}`}>
                                  {dayNames[dayOfWeek]}
                                </div>
                                {log.reason && (
                                  <div className="relative group ml-1">
                                    <FileUp className="w-3 h-3 text-blue-500" />
                                    <div className="absolute bottom-full mb-2 w-48 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                      {log.reason}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className={`text-sm mb-2 ${isWeekend ? 'text-red-500' : 'text-gray-600'}`}>
                                {day}
                              </div>
                              <div className="space-y-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  placeholder="G"
                                  value={log.day || ''}
                                  onChange={(e) => updateWorkLog(emp.id, dateStr, e.target.value, 'day', dayOfWeek)}
                                  className="w-full px-1 py-0.5 text-xs border rounded"
                                  title="Gündüz"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  placeholder="A"
                                  value={log.evening || ''}
                                  onChange={(e) => updateWorkLog(emp.id, dateStr, e.target.value, 'evening', dayOfWeek)}
                                  className="w-full px-1 py-0.5 text-xs border rounded"
                                  title="Akşam"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'holidays' && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Ara Verilen Günler</h3>
                <p className="text-sm text-gray-600 mb-3">Öğretmenlerin çalışmadığı günleri ekleyin (örn: yarıyıl tatili)</p>
                <div className="flex gap-3">
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value && !holidays.includes(e.target.value)) {
                        setHolidays([...holidays, e.target.value]);
                      }
                    }}
                    className="px-4 py-2 border rounded-lg"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {holidays.map(date => (
                    <div key={date} className="flex items-center justify-between bg-white p-3 rounded">
                      <span>{date}</span>
                      <button
                        onClick={() => setHolidays(holidays.filter(d => d !== date))}
                        className="text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">2025 Resmi Tatiller (Otomatik)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {officialHolidays2025.map(holiday => (
                    <div key={holiday.date} className="bg-white p-3 rounded text-center">
                      <p className="font-semibold">{holiday.date}</p>
                      <p className="text-gray-600">{holiday.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 p-6 rounded-lg mb-6">
                <h3 className="font-semibold text-lg mb-2">Hesaplama Mantığı</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Çalışılması gereken gün sayısı otomatik hesaplanır (Pzt-Cuma, tatiller hariç)</li>
                  <li>• Beklenen saat = Çalışılması gereken gün × 4</li>
                  <li>• Normal günlerde (Pzt-Cuma) bu saatten fazlası fazla mesaidir</li>
                  <li>• Cumartesi günü çalışılan tüm saatler fazla mesaidir</li>
                </ul>
              </div>

              {employees.map(emp => {
                const calc = calculateOvertime(emp.id);
                return (
                  <div key={emp.id} className="bg-white border-2 border-gray-200 p-6 rounded-lg">
                    <h3 className="font-bold text-xl mb-4 text-indigo-600">{emp.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg col-span-1">
                        <p className="text-sm text-gray-600">Beklenen Saat</p>
                        <p className="text-2xl font-bold text-blue-600">{calc.expectedHours}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg col-span-2">
                        <p className="text-sm text-gray-600">Hafta İçi Mesai (Gündüz)</p>
                        <p className="text-2xl font-bold text-green-600">{calc.totalDayHours} saat (Fazla: {calc.extraDayHours})</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Hafta İçi (Akşam)</p>
                        <p className="text-2xl font-bold text-purple-600">{calc.totalEveningHours} saat</p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Cumartesi (G+A)</p>
                        <p className="text-2xl font-bold text-yellow-600">{calc.saturdayDayHours + calc.saturdayEveningHours} saat</p>
                      </div>
                      <div className="bg-pink-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Pazar (G+A)</p>
                        <p className="text-2xl font-bold text-pink-600">{calc.sundayDayHours + calc.sundayEveningHours} saat</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Toplam Fazla Mesai</p>
                        <p className="text-2xl font-bold text-orange-600">{calc.totalOvertime} saat</p>
                      </div>
                    </div>
                    <div className="mt-4 bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-lg border-2 border-cyan-300">
                      <div className="text-right">
                        <p className="text-sm text-gray-600 mb-1">Toplam Hak Ediş</p>
                        <p className="text-4xl font-bold text-cyan-600">
                          {calc.totalPayment.toFixed(2)} ₺
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Fazla Mesai Ücret Ayarları</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <label htmlFor="dayRate" className="block text-sm font-medium text-gray-700 mb-2">
                      Gündüz Fazla Mesai Saat Ücreti (₺)
                    </label>
                    <input
                      type="number"
                      id="dayRate"
                      value={dayRate}
                      onChange={(e) => setDayRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <label htmlFor="eveningRate" className="block text-sm font-medium text-gray-700 mb-2">
                      Akşam/Hafta Sonu Fazla Mesai Saat Ücreti (₺)
                    </label>
                    <input
                      type="number"
                      id="eveningRate"
                      value={eveningRate}
                      onChange={(e) => setEveningRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<OvertimeTracker />);