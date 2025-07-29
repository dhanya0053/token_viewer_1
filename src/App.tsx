import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Department, Doctor } from './types';
import QueueDisplay from './pages/QueuePage';
import LoginPage from './pages/LoginPage';
import AdminSignupPage from './pages/AdminSignupPage';
import AnalyticsPage from './pages/AnalyticsPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { api } from './lib/api';
import QueuePage from './pages/QueuePage';

// API response type for reference
interface ApiResponse<T> {
  message: string;
  data: T;
}

const AppContent: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  // Fetch departments and doctors data
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch departments
        const [departmentsRes, doctorsRes] = await Promise.all([
          api<Department[]>('/departments'),
          api<Doctor[]>('/doctors')
        ]);

        if (!departmentsRes || !doctorsRes) {
          throw new Error('Failed to fetch data from server');
        }

        const departmentsData: Department[] = departmentsRes;
        const doctorsData: Doctor[] = doctorsRes;

        setDepartments(departmentsData);
        setDoctors(doctorsData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  // Render loading state
  if (isLoading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Loading data...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        {isAuthenticated && (
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold text-gray-900">Queue Management System</h1>
                <div className="space-x-4">
                  <Link
                    to="/analytics"
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    View Analytics
                  </Link>
                  <button
                    onClick={() => {
                      // Handle logout
                      localStorage.removeItem('token');
                      window.location.href = '/login';
                    }}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
              <nav className="flex space-x-4">
                <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
                  Queue
                </Link>
                <Link to="/analytics" className="text-gray-600 hover:text-gray-800 font-medium">
                  Analytics
                </Link>
              </nav>
            </div>
          </header>
        )}
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/signup" element={<AdminSignupPage />} />
      <Route 
        path="/analytics" 
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        } 
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {departments.length > 0 && doctors.length > 0 ? (
              <QueuePage
                departments={departments}
                doctors={doctors}
              />
            ) : (
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600">No data available. Please check your connection.</p>
                </div>
              </div>
            )}
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <AppContent />
        </div>
      </AuthProvider>
    </Router>
  );
};

export default App;
