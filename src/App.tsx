import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Users, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';

interface Token {
  number: number;
  patientName: string;
  status: 'current' | 'waiting' | 'completed';
  timestamp: string;
  department: string;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Available departments
  const departments: Department[] = [
    { id: 'all', name: 'All Departments', color: 'blue' },
    { id: 'general', name: 'General Medicine', color: 'emerald' },
    { id: 'cardiology', name: 'Cardiology', color: 'red' },
    { id: 'orthopedics', name: 'Orthopedics', color: 'orange' },
    { id: 'pediatrics', name: 'Pediatrics', color: 'pink' },
    { id: 'dermatology', name: 'Dermatology', color: 'purple' },
    { id: 'neurology', name: 'Neurology', color: 'indigo' },
  ];

  // Mock token data with departments
  const [allTokens] = useState<Token[]>([
    { number: 45, patientName: 'Robert Brown', status: 'completed', timestamp: '10:15 AM', department: 'general' },
    { number: 46, patientName: 'Maria Garcia', status: 'completed', timestamp: '10:30 AM', department: 'cardiology' },
    { number: 47, patientName: 'Sarah Johnson', status: 'completed', timestamp: '10:45 AM', department: 'general' },
    { number: 48, patientName: 'Michael Chen', status: 'current', timestamp: '11:00 AM', department: 'general' },
    { number: 49, patientName: 'Emma Davis', status: 'waiting', timestamp: '11:15 AM', department: 'general' },
    { number: 50, patientName: 'James Wilson', status: 'waiting', timestamp: '11:30 AM', department: 'orthopedics' },
    { number: 51, patientName: 'Lisa Anderson', status: 'waiting', timestamp: '11:45 AM', department: 'cardiology' },
    { number: 52, patientName: 'David Miller', status: 'waiting', timestamp: '12:00 PM', department: 'pediatrics' },
    { number: 53, patientName: 'Anna Thompson', status: 'waiting', timestamp: '12:15 PM', department: 'general' },
    { number: 54, patientName: 'John Davis', status: 'waiting', timestamp: '12:30 PM', department: 'dermatology' },
  ]);

  // Filter tokens based on selected department
  const tokens = selectedDepartment === 'all' 
    ? allTokens 
    : allTokens.filter(token => token.department === selectedDepartment);

  const currentToken = tokens.find(token => token.status === 'current');
  const currentIndex = tokens.findIndex(token => token.status === 'current');
  const previousToken = currentIndex > 0 ? tokens[currentIndex - 1] : null;
  const nextToken = currentIndex < tokens.length - 1 ? tokens[currentIndex + 1] : null;
  const upcomingTokens = tokens.filter(token => token.status === 'waiting').slice(1, 4);

  const selectedDept = departments.find(dept => dept.id === selectedDepartment);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      setLastRefresh(new Date());
      // In a real application, you would fetch new data here
    }, 30000);
    return () => clearInterval(refreshTimer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDepartmentColor = (colorName: string) => {
    const colors: { [key: string]: string } = {
      blue: 'from-blue-500 to-blue-600',
      emerald: 'from-emerald-500 to-emerald-600',
      red: 'from-red-500 to-red-600',
      orange: 'from-orange-500 to-orange-600',
      pink: 'from-pink-500 to-pink-600',
      purple: 'from-purple-500 to-purple-600',
      indigo: 'from-indigo-500 to-indigo-600',
    };
    return colors[colorName] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-y-auto">
      {/* Header with Department Selection */}
      <div className="flex justify-between items-start mb-12">
        <div className="flex-1">
          <h1 className="text-5xl font-bold text-slate-800 mb-2">Patient Queue Display</h1>
          <p className="text-2xl text-slate-600 mb-6">Medical Center - Token Management System</p>
          
          {/* Department Selection */}
          <div className="flex items-center space-x-4">
            <Building2 className="w-6 h-6 text-slate-600" />
            <span className="text-xl font-medium text-slate-700">Department:</span>
            <select 
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="text-xl px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
            >
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-4xl font-mono text-slate-800 mb-2">{formatTime(currentTime)}</div>
          <div className="text-xl text-slate-600">{formatDate(currentTime)}</div>
          <div className="flex items-center text-lg text-slate-500 mt-2">
            <RefreshCw className="w-5 h-5 mr-2" />
            Last updated: {formatTime(lastRefresh)}
          </div>
        </div>
      </div>

      {/* Department Info Banner */}
      {selectedDepartment !== 'all' && (
        <div className={`bg-gradient-to-r ${getDepartmentColor(selectedDept?.color || 'blue')} text-white rounded-2xl p-6 mb-8 shadow-lg`}>
          <div className="flex items-center justify-center">
            <Building2 className="w-8 h-8 mr-3" />
            <h2 className="text-3xl font-bold">{selectedDept?.name}</h2>
            <span className="ml-4 bg-white/20 px-4 py-2 rounded-full text-lg">
              {tokens.filter(t => t.status === 'waiting').length} patients waiting
            </span>
          </div>
        </div>
      )}

      {/* Main Token Display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Previous Token */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-lg">
          <div className="flex items-center justify-center mb-6">
            <ChevronLeft className="w-8 h-8 text-slate-500 mr-2" />
            <h2 className="text-xl font-semibold text-slate-600">Previous</h2>
          </div>
          {previousToken ? (
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-400 mb-3">#{previousToken.number}</div>
              <div className="text-2xl font-medium text-slate-600 mb-2">{previousToken.patientName}</div>
              <div className="text-lg text-slate-500 flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 mr-2" />
                {previousToken.timestamp}
              </div>
              <div className="text-base text-slate-500 capitalize mb-2">
                {departments.find(d => d.id === previousToken.department)?.name || previousToken.department}
              </div>
              <div className="text-base text-emerald-600 font-medium">Completed</div>
            </div>
          ) : (
            <div className="text-center text-slate-400">
              <div className="text-3xl mb-3">-</div>
              <div className="text-lg">No previous token</div>
            </div>
          )}
        </div>

        {/* Current Token */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-12 shadow-2xl transform scale-110">
          <div className="text-center text-white">
            <h2 className="text-4xl font-semibold mb-8 flex items-center justify-center">
              <Users className="w-10 h-10 mr-4" />
              Now Serving
            </h2>
            {currentToken ? (
              <>
                <div className="text-8xl font-bold mb-8">#{currentToken.number}</div>
                <div className="text-5xl font-medium mb-6">{currentToken.patientName}</div>
                <div className="text-3xl opacity-90 flex items-center justify-center mb-6">
                  <Clock className="w-8 h-8 mr-3" />
                  {currentToken.timestamp}
                </div>
                <div className="text-2xl opacity-90 mb-8">
                  {departments.find(d => d.id === currentToken.department)?.name || currentToken.department}
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6">
                  <div className="text-2xl font-medium">Please proceed to consultation room</div>
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-8">-</div>
                <div className="text-3xl">No current token</div>
              </>
            )}
          </div>
        </div>

        {/* Next Token */}
        <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl p-6 border-2 border-amber-200 shadow-lg">
          <div className="flex items-center justify-center mb-6">
            <h2 className="text-xl font-semibold text-amber-700 mr-2">Next</h2>
            <ChevronRight className="w-8 h-8 text-amber-600" />
          </div>
          {nextToken ? (
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-600 mb-3">#{nextToken.number}</div>
              <div className="text-2xl font-medium text-amber-800 mb-2">{nextToken.patientName}</div>
              <div className="text-lg text-amber-700 flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 mr-2" />
                {nextToken.timestamp}
              </div>
              <div className="text-base text-amber-700 capitalize mb-2">
                {departments.find(d => d.id === nextToken.department)?.name || nextToken.department}
              </div>
              <div className="text-base text-amber-700 font-medium">Please be ready</div>
            </div>
          ) : (
            <div className="text-center text-amber-600">
              <div className="text-3xl mb-3">-</div>
              <div className="text-lg">No next token</div>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Tokens */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-lg">
        <h3 className="text-2xl font-semibold text-slate-700 mb-4 text-center">Upcoming Tokens</h3>
        {upcomingTokens.length > 0 ? (
          <div className="max-h-64 overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingTokens.map((token, index) => (
                <div key={token.number} className="bg-white rounded-xl p-4 border border-slate-150 shadow-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-600 mb-2">#{token.number}</div>
                    <div className="text-lg font-medium text-slate-700 mb-1">{token.patientName}</div>
                    <div className="text-sm text-slate-500 flex items-center justify-center mb-1">
                      <Clock className="w-4 h-4 mr-1" />
                      {token.timestamp}
                    </div>
                    <div className="text-xs text-slate-500 capitalize">
                      {departments.find(d => d.id === token.department)?.name || token.department}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-8">
            <div className="text-4xl mb-4">📋</div>
            <div className="text-lg">No upcoming tokens</div>
            <div className="text-sm mt-2">All patients have been served</div>
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="mt-8 text-center">
        <div className="text-xl text-slate-600 mb-2">
          Queue Status: {tokens.filter(t => t.status === 'waiting').length} patients waiting
          {selectedDepartment !== 'all' && ` in ${selectedDept?.name}`}
        </div>
        <div className="text-lg text-slate-500">
          System Status: Online • Auto-refresh every 30 seconds
        </div>
      </div>
    </div>
  );
}

export default App;