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
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [holidays, setHolidays] = useState(() => {
    const saved = localStorage.getItem('holidays');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState('employees');
  
  const [newEmployee, setNewEmployee] = useState({ name: '', id: '' });
  const [bulkEmployees, setBulkEmployees] = useState('');
  
  const officialHolidays2025 = [
    '2025-01-01', '2025-03-31', '2025-04-01', '2025-04-02', '2025-04-03',
    '2025-04-23', '2025-05-01', '2025-05-19', '2025-06-27', '2025-06-28',
    '2025-06-29', '2025-06-30', '2025-08-30', '2025-09-05', '2025-09-06',
    '2025-09-07', '2025-09-08', '2025-10-29', '2025-12-02', '2025-12-03',
    '2025-12-04', '2025-12-05'
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

  const updateWorkLog = (empId, date, hours) => {
    setWorkLogs({
      ...workLogs,
      [empId]: {
        ...(workLogs[empId] || {}),
        [date]: parseFloat(hours) || 0
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
      
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidays.includes(dateStr) && !officialHolidays2025.includes(dateStr)) {
        workingDays++;
      }
    }
    return workingDays;
  };

  const calculateOvertime = (empId) => {
    const logs = workLogs[empId] || {};
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(selectedMonth);
    
    let regularHours = 0;
    let saturdayHours = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hours = logs[dateStr] || 0;
      
      if (dayOfWeek === 6) {
        saturdayHours += hours;
      } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        regularHours += hours;
      }
    }
    
    const workingDays = getWorkingDaysInMonth(selectedMonth);
    const expectedHours = workingDays * 4;
    const extraRegularHours = Math.max(0, regularHours - expectedHours);
    const totalOvertime = extraRegularHours + saturdayHours;
    
    return {
      workingDays,
      expectedHours,
      regularHours,
      saturdayHours,
      extraRegularHours,
      totalOvertime
    };
  };

  const exportToCSV = () => {
    let csv = 'Ad,Çalışan No,Çalışılması Gereken Gün,Beklenen Saat,Normal Saat,Cumartesi Saat,Fazla Normal Saat,Toplam Fazla Mesai\n';
    employees.forEach(emp => {
      const calc = calculateOvertime(emp.id);
      csv += `${emp.name},${emp.empId || '-'},${calc.workingDays},${calc.expectedHours},${calc.regularHours},${calc.saturdayHours},${calc.extraRegularHours},${calc.totalOvertime}\n`;
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
            {['employees', 'worklog', 'holidays', 'report'].map(tab => (
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
                          const isHoliday = holidays.includes(dateStr) || officialHolidays2025.includes(dateStr);
                          
                          return (
                            <div key={day} className="text-center">
                              <div className={`text-xs mb-1 ${isWeekend ? 'text-red-500' : 'text-gray-600'}`}>
                                {day}
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="0"
                                value={workLogs[emp.id]?.[dateStr] || ''}
                                onChange={(e) => updateWorkLog(emp.id, dateStr, e.target.value)}
                                className={`w-full px-2 py-1 text-sm border rounded ${
                                  isHoliday ? 'bg-red-100' : isWeekend ? 'bg-yellow-100' : 'bg-white'
                                }`}
                              />
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
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {officialHolidays2025.map(date => (
                    <div key={date} className="bg-white p-2 rounded text-center">
                      {date}
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Çalışılması Gereken Gün</p>
                        <p className="text-2xl font-bold text-blue-600">{calc.workingDays}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Beklenen Saat</p>
                        <p className="text-2xl font-bold text-purple-600">{calc.expectedHours}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Çalışılan Normal Saat</p>
                        <p className="text-2xl font-bold text-green-600">{calc.regularHours}</p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Cumartesi Saat</p>
                        <p className="text-2xl font-bold text-yellow-600">{calc.saturdayHours}</p>
                      </div>
                    </div>
                    <div className="mt-4 bg-gradient-to-r from-red-50 to-orange-50 p-6 rounded-lg border-2 border-orange-300">
                      <p className="text-sm text-gray-600 mb-1">Toplam Fazla Mesai</p>
                      <p className="text-4xl font-bold text-orange-600">{calc.totalOvertime} saat</p>
                      <p className="text-xs text-gray-500 mt-2">
                        ({calc.extraRegularHours} normal + {calc.saturdayHours} cumartesi)
                      </p>
                    </div>
                  </div>
                );
              })}
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