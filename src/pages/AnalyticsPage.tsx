import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllDepartmentsAnalytics, type DepartmentAnalytics } from '../lib/analyticsApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const DepartmentCard = ({ analytics }: { analytics: DepartmentAnalytics }) => (
  <div className="bg-white rounded-lg shadow p-6 mb-6">
    <h2 className="text-2xl font-bold mb-4">{analytics.department.name}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Appointments" value={analytics.totalAppointments} />
      <StatCard label="Avg. Wait Time (min)" value={analytics.averageWaitTime} />
      <StatCard label="Patients Served" value={analytics.totalPatientsServed} />
      <StatCard label="Active Doctors" value={analytics.activeDoctors} />
    </div>
    
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80">
        <h3 className="text-lg font-semibold mb-2">Appointment Distribution</h3>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: 'Completed', value: Math.floor(analytics.totalAppointments * 0.7) },
                { name: 'Pending', value: Math.ceil(analytics.totalAppointments * 0.3) },
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name = '', percent = 0 }: { name?: string, percent?: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {[0, 1].map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <div className="h-80">
        <h3 className="text-lg font-semibold mb-2">Department Stats</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[
              { name: 'Services', value: analytics.totalServices },
              { name: 'Doctors', value: analytics.activeDoctors },
            ]}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    
    <div className="text-sm text-gray-500 mt-4">
      Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
    </div>
  </div>
);

const StatCard = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-gray-50 p-4 rounded-lg">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<DepartmentAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const data = await fetchAllDepartmentsAnalytics();
        setAnalytics(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to load analytics data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Department Analytics</h1>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {analytics.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No department analytics available.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {analytics.map((deptAnalytics) => (
              <DepartmentCard key={deptAnalytics.department.id} analytics={deptAnalytics} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
