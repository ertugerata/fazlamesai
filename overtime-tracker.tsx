import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Calendar, Users, Clock, Download, Upload, Plus, Trash2, FileUp } from 'lucide-react';
import * as XLSX from 'xlsx';

// Custom Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">&times;</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};


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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sundayReason, setSundayReason] = useState('');
  const [modalData, setModalData] = useState(null);
  
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

    const newLogs = JSON.parse(JSON.stringify(workLogs)); // Deep copy to avoid mutation issues
    
    jsonData.forEach(row => {
      const empName = row['Ad Soyad'];
      const emp = employees.find(e => e.name === empName);
      if (!emp) return;

      if (!newLogs[emp.id]) {
        newLogs[emp.id] = {};
      }

      Object.keys(row).forEach(header => {
        const match = header.match(/^(\d{4}-\d{2}-\d{2}) \((Gündüz|Akşam)\)$/);
        if (match) {
          const date = match[1];
          const type = match[2] === 'Gündüz' ? 'day' : 'evening';
          const hours = parseFloat(row[header]) || 0;

          if (hours > 0) {
            if (!newLogs[emp.id][date]) {
              newLogs[emp.id][date] = { day: 0, evening: 0 };
            }
            newLogs[emp.id][date][type] = hours;

            const dayOfWeek = new Date(date).getDay();
            if (dayOfWeek === 0) {
              newLogs[emp.id][date].reason = 'Excel\'den toplu yüklendi';
            }
          }
        }
      });
    });

    setWorkLogs(newLogs);
    alert('Çalışma saatleri başarıyla yüklendi!');
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
    const newLogValue = { ...currentLog, [type]: parseFloat(value) || 0 };

    if (dayOfWeek === 0 && (newLogValue.day > 0 || newLogValue.evening > 0) && !newLogValue.reason) {
      setModalData({ empId, date, value, type, dayOfWeek });
      setIsModalOpen(true);
      return;
    }

    setWorkLogs({
      ...workLogs,
      [empId]: {
        ...(workLogs[empId] || {}),
        [date]: newLogValue
      }
    });
  };

  const handleSundayReasonSubmit = () => {
    if (!modalData || !sundayReason) return;
    const { empId, date, value, type } = modalData;
    const currentLog = workLogs[empId]?.[date] || { day: 0, evening: 0 };
    const newLog = { ...currentLog, [type]: parseFloat(value) || 0, reason: sundayReason };

    setWorkLogs({
      ...workLogs,
      [empId]: {
        ...(workLogs[empId] || {}),
        [date]: newLog
      }
    });
    setIsModalOpen(false);
    setSundayReason('');
    setModalData(null);
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

  const exportToExcel = () => {
    const data = employees.map(emp => {
      const calc = calculateOvertime(emp.id);
      return {
        'Ad Soyad': emp.name,
        'Çalışan No': emp.empId || '-',
        'Beklenen Saat': calc.expectedHours,
        'Fazla Gündüz': calc.extraDayHours,
        'Toplam Akşam': calc.totalEveningHours,
        'Cumartesi Gündüz': calc.saturdayDayHours,
        'Cumartesi Akşam': calc.saturdayEveningHours,
        'Pazar Gündüz': calc.sundayDayHours,
        'Pazar Akşam': calc.sundayEveningHours,
        'Toplam Fazla Mesai': calc.totalOvertime,
        'Toplam Ödeme (₺)': calc.totalPayment.toFixed(2),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fazla Mesai Raporu');
    XLSX.writeFile(workbook, `fazla-mesai-raporu-${selectedMonth}.xlsx`);
  };

  const downloadWorkLogTemplate = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(selectedMonth);
    
    const headers = ['Ad Soyad'];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      headers.push(`${dateStr} (Gündüz)`);
      headers.push(`${dateStr} (Akşam)`);
    }

    const data = employees.map(emp => {
      const row = { 'Ad Soyad': emp.name };
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        row[`${dateStr} (Gündüz)`] = '';
        row[`${dateStr} (Akşam)`] = '';
      }
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Çalışma Saatleri');
    XLSX.writeFile(workbook, `calisma-saati-sablonu-${selectedMonth}.xlsx`);
  };

  return (
    <div className="bg-[#F3F4F6] min-h-screen font-sans">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Pazar Günü Çalışma Nedeni"
      >
        <div className="space-y-4">
          <p>Pazar günü çalışması için lütfen bir neden belirtin.</p>
          <textarea
            value={sundayReason}
            onChange={(e) => setSundayReason(e.target.value)}
            className="w-full p-2 border rounded"
            rows="3"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              İptal
            </button>
            <button
              onClick={handleSundayReasonSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Kaydet
            </button>
          </div>
        </div>
      </Modal>
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-800">Fazla Mesai Takip</h1>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Download className="w-5 h-5" />
                Dışa Aktar
              </button>
            </div>
          </div>

          <div className="flex gap-4 border-b">
            {[
              { id: 'employees', label: 'Çalışanlar', icon: <Users size={18} /> },
              { id: 'worklog', label: 'Çalışma Saatleri', icon: <Calendar size={18} /> },
              { id: 'holidays', label: 'Tatil Günleri', icon: <Calendar size={18} /> },
              { id: 'report', label: 'Rapor', icon: <Calendar size={18} /> },
              { id: 'settings', label: 'Ayarlar', icon: <Users size={18} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors rounded-t-lg ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pt-6">
          {activeTab === 'employees' && (
            <div className="space-y-8">
              <div className="bg-[#F3F4F6] p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-4 text-gray-700">Tek Çalışan Ekle</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="Ad Soyad"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="md:col-span-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Çalışan No (opsiyonel)"
                    value={newEmployee.id}
                    onChange={(e) => setNewEmployee({ ...newEmployee, id: e.target.value })}
                    className="md:col-span-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addEmployee}
                    className="md:col-span-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Ekle
                  </button>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-2 text-gray-700">Excel'den Çalışan Yükle</h3>
                <p className="text-gray-600 mb-4">Excel'de şu sütunlar olmalı: "Ad Soyad", "Çalışan No"</p>
                <div className="flex">
                  <label className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 cursor-pointer transition-colors flex items-center gap-2">
                    <FileUp className="w-5 h-5" />
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

              <div className="bg-[#F3F4F6] p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-2 text-gray-700">Toplu Çalışan Ekle</h3>
                <p className="text-gray-600 mb-4">Her satıra: Ad Soyad, Çalışan No</p>
                <textarea
                  placeholder="Ahmet Yılmaz, 1001&#10;Ayşe Demir, 1002&#10;Mehmet Kaya, 1003"
                  value={bulkEmployees}
                  onChange={(e) => setBulkEmployees(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addBulkEmployees}
                  className="mt-4 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Toplu Ekle
                </button>
              </div>

              <div className="bg-[#F3F4F6] p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-4 text-gray-700">Çalışan Listesi ({employees.length})</h3>
                <div className="space-y-3">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
                      <div>
                        <p className="font-semibold text-gray-800">{emp.name}</p>
                        {emp.empId && <p className="text-sm text-gray-500">No: {emp.empId}</p>}
                      </div>
                      <button
                        onClick={() => removeEmployee(emp.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
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
            <div className="space-y-6">
              <div className="bg-[#F3F4F6] p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-2 text-gray-700">Excel'den Çalışma Saatleri Yükle</h3>
                <p className="text-gray-600 mb-4">
                  Excel'de: "Ad Soyad" sütunu + Tarih sütunları (YYYY-AA-GG (Gündüz/Akşam) formatında)
                </p>
                <div className="flex items-center gap-4">
                  <label className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 cursor-pointer transition-colors flex items-center gap-2">
                    <FileUp className="w-5 h-5" />
                    Excel Yükle
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleWorkLogFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={downloadWorkLogTemplate}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Şablon İndir
                  </button>
                </div>
              </div>

              {employees.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Önce çalışan ekleyin</p>
              ) : (
                employees.map(emp => {
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const daysInMonth = getDaysInMonth(selectedMonth);
                  
                  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
                  return (
                    <div key={emp.id} className="bg-white p-6 rounded-lg shadow-sm">
                      <h3 className="font-bold text-xl mb-4 text-gray-700">{emp.name}</h3>
                      <div className="grid grid-cols-7 gap-3">
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const day = i + 1;
                          const date = new Date(year, month - 1, day);
                          const dayOfWeek = date.getDay();
                          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const isSunday = dayOfWeek === 0;
                          const isSaturday = dayOfWeek === 6;
                          const isHoliday = holidays.includes(dateStr) || officialHolidays2025.some(h => h.date === dateStr);
                          
                          const log = workLogs[emp.id]?.[dateStr] || { day: 0, evening: 0 };
                          return (
                            <div key={day} className={`text-center p-3 rounded-lg border ${isHoliday ? 'bg-red-50 border-red-200' : isSunday ? 'bg-pink-50 border-pink-200' : isSaturday ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                              <div className="flex items-center justify-center mb-2">
                                <div className={`text-xs font-bold uppercase ${isSunday || isSaturday ? 'text-red-600' : 'text-gray-500'}`}>
                                  {dayNames[dayOfWeek]}
                                </div>
                                {log.reason && (
                                  <div className="relative group ml-1">
                                    <FileUp className="w-4 h-4 text-blue-500 cursor-pointer" />
                                    <div className="absolute bottom-full mb-2 w-48 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      {log.reason}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className={`text-xl font-semibold mb-2 ${isSunday || isSaturday ? 'text-red-600' : 'text-gray-800'}`}>
                                {day}
                              </div>
                              <div className="space-y-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  placeholder="G"
                                  value={log.day || ''}
                                  onChange={(e) => updateWorkLog(emp.id, dateStr, e.target.value, 'day', dayOfWeek)}
                                  className="w-full px-2 py-1 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  title="Gündüz"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  placeholder="A"
                                  value={log.evening || ''}
                                  onChange={(e) => updateWorkLog(emp.id, dateStr, e.target.value, 'evening', dayOfWeek)}
                                  className="w-full px-2 py-1 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
            <div className="space-y-8">
              <div className="bg-[#F3F4F6] p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-2 text-gray-700">Ara Verilen Günler</h3>
                <p className="text-gray-600 mb-4">Öğretmenlerin çalışmadığı günleri ekleyin (örn: yarıyıl tatili)</p>
                <div className="flex">
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value && !holidays.includes(e.target.value)) {
                        setHolidays([...holidays, e.target.value].sort());
                      }
                    }}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="mt-6 space-y-3">
                  {holidays.map(date => (
                    <div key={date} className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
                      <span className="font-semibold text-gray-800">{date}</span>
                      <button
                        onClick={() => setHolidays(holidays.filter(d => d !== date))}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#F3F4F6] p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-4 text-gray-700">2025 Resmi Tatiller (Otomatik)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {officialHolidays2025.map(holiday => (
                    <div key={holiday.date} className="bg-white p-4 rounded-lg shadow-sm text-center">
                      <p className="font-semibold text-gray-800">{holiday.date}</p>
                      <p className="text-sm text-gray-500">{holiday.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-8">
              <div className="bg-[#F3F4F6] p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-2 text-gray-700">Hesaplama Mantığı</h3>
                <ul className="text-gray-600 space-y-1 list-disc list-inside">
                  <li>Çalışılması gereken gün sayısı otomatik hesaplanır (Pzt-Cuma, tatiller hariç).</li>
                  <li>Beklenen saat = Çalışılması gereken gün × 4.</li>
                  <li>Normal günlerde (Pzt-Cuma) bu saatten fazlası fazla mesaidir.</li>
                  <li>Cumartesi ve Pazar günleri çalışılan tüm saatler fazla mesaidir.</li>
                </ul>
              </div>

              {employees.map(emp => {
                const calc = calculateOvertime(emp.id);
                return (
                  <div key={emp.id} className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="font-bold text-2xl mb-4 text-blue-600">{emp.name}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-blue-800">Beklenen Saat</p>
                        <p className="text-3xl font-bold text-blue-600">{calc.expectedHours}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-green-800">Hafta İçi Gündüz</p>
                        <p className="text-3xl font-bold text-green-600">{calc.totalDayHours} <span className="text-lg">saat (Fazla: {calc.extraDayHours})</span></p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-purple-800">Hafta İçi Akşam</p>
                        <p className="text-3xl font-bold text-purple-600">{calc.totalEveningHours} <span className="text-lg">saat</span></p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-yellow-800">Cumartesi (G+A)</p>
                        <p className="text-3xl font-bold text-yellow-600">{calc.saturdayDayHours + calc.saturdayEveningHours} <span className="text-lg">saat</span></p>
                      </div>
                      <div className="bg-pink-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-pink-800">Pazar (G+A)</p>
                        <p className="text-3xl font-bold text-pink-600">{calc.sundayDayHours + calc.sundayEveningHours} <span className="text-lg">saat</span></p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-orange-800">Toplam Fazla Mesai</p>
                        <p className="text-3xl font-bold text-orange-600">{calc.totalOvertime} <span className="text-lg">saat</span></p>
                      </div>
                    </div>
                    <div className="mt-6 bg-gray-800 text-white p-6 rounded-lg text-right">
                      <p className="text-lg font-semibold text-gray-300">Toplam Hak Ediş</p>
                      <p className="text-4xl font-bold">
                        {calc.totalPayment.toFixed(2)} ₺
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div className="bg-[#F3F4F6] p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-4 text-gray-700">Fazla Mesai Ücret Ayarları</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <label htmlFor="dayRate" className="block text-lg font-semibold text-gray-800 mb-2">
                      Gündüz Fazla Mesai Saat Ücreti (₺)
                    </label>
                    <input
                      type="number"
                      id="dayRate"
                      value={dayRate}
                      onChange={(e) => setDayRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xl"
                    />
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <label htmlFor="eveningRate" className="block text-lg font-semibold text-gray-800 mb-2">
                      Akşam/Hafta Sonu Fazla Mesai Saat Ücreti (₺)
                    </label>
                    <input
                      type="number"
                      id="eveningRate"
                      value={eveningRate}
                      onChange={(e) => setEveningRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<OvertimeTracker />);