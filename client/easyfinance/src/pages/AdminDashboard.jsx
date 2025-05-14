import React, { useState, useEffect } from "react";
import {
  getAllAgents,
  deleteAgent,
  getAllClients,
  getAdminDashboardAnalyticsData,
  deleteClient,
  logoutAdmin,
} from "../services/api";
import { useNavigate } from "react-router-dom";
import DashboardOverview from "../components/dashboard/dashOverview";
import ClientManagement from "../components/dashboard/client";
import AgentManagement from "../components/dashboard/agent";
import ResponsiveSidebar from "../components/dashboard/sidebar";
import LoanManagementTable from "../components/dashboard/loan";
import { 
  Loader, 
  Moon, 
  Sun, 
  BarChart3, 
  Users, 
  UserCog,
  Landmark,
  Menu
} from "lucide-react";

const AdminDashboard = () => {
  // State management
  const [analytics, setAnalytics] = useState({
    totalLoanDisbursed: 0,
    totalAmountRecovered: 0,
    totalAmountRemaining: 0,
    totalEmisCollected: 0,
    defaulterCount: 0,
  });
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [addingLoanClientId, setAddingLoanClientId] = useState(null);
  const [viewMode, setViewMode] = useState("clients");
  const [darkMode, setDarkMode] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  const navigate = useNavigate();

  // Window resize handler for responsiveness
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial data loading and theme setup
  useEffect(() => {
    // Check if user has a preferred theme stored or use system preference
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
    
    // Add CSS variable for blur backdrop support
    document.documentElement.style.setProperty('--blur-bg', 'rgba(255, 255, 255, 0.7)');
    document.documentElement.style.setProperty('--blur-bg-dark', 'rgba(17, 24, 39, 0.75)');
    
    // Fetch dashboard data
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const analyticsResponse = await getAdminDashboardAnalyticsData();
      const clientsResponse = await getAllClients();
      const agentsResponse = await getAllAgents();

      setAnalytics(analyticsResponse.data);
      setClients(clientsResponse.data);
      setAgents(agentsResponse.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleClientAdded = () => {
    setShowForm(false);
    fetchClients();
  };

  const handleDeleteClient = async (clientId) => {
    if (window.confirm("Are you sure you want to delete this client?")) {
      try {
        await deleteClient(clientId);
        alert("Client deleted successfully!");
        setClients(clients.filter((client) => client._id !== clientId));
      } catch (error) {
        console.error("Error deleting client:", error);
        alert(`Failed to delete client: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await logoutAdmin();
        alert("Logged out successfully!");
        window.location.href = "/login";
      } catch (error) {
        console.error("Logout failed:", error);
        alert(`Failed to logout: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  const handleDeleteAgent = async (id) => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      try {
        await deleteAgent(id);
        alert("Agent deleted successfully!");
        setAgents(agents.filter((agent) => agent._id !== id));
      } catch (err) {
        alert("Failed to delete agent.");
        console.error("Error deleting agent:", err);
      }
    }
  };

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await getAllAgents();
      setAgents(response.data);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      alert(`Error fetching agents: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await getAllClients();
      setClients(response.data);
    } catch (error) {
      console.error("Failed to fetch clients:", error);
      alert(`Error fetching clients: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter agents based on search term
  const filteredAgents = agents.filter(
    (agent) =>
      agent.fullname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.agentusername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show loading state
  if (loading) {
    return (
      <div className={`flex items-center justify-center h-screen ${
        darkMode 
          ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white' 
          : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-900'
      }`}>
        <div className="flex flex-col items-center backdrop-blur-sm p-8 rounded-xl shadow-lg bg-white/10 dark:bg-gray-800/30">
          <Loader size={48} className={`animate-spin ${darkMode ? 'text-blue-400' : 'text-blue-500'} mb-4`} />
          <div className="text-xl font-semibold">
            Loading dashboard...
          </div>
        </div>
      </div>
    );
  }

  const viewIcons = {
    dashboard: <BarChart3 size={20} />,
    clients: <Users size={20} />,
    agents: <UserCog size={20} />,
    loans: <Landmark size={20} />
  };

  // Determine if we're on mobile view
  const isMobile = windowSize.width < 1024;

  return (
    <div className={`flex flex-col min-h-screen transition-all duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white' 
        : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-900'
    }`}>
      {/* Responsive Sidebar Component */}
      <ResponsiveSidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        handleLogout={handleLogout} 
        darkMode={darkMode}
      />

      {/* Main Content Container */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isMobile ? 'ml-0' : 'ml-64'}`}>
        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {/* Top Bar */}
          <div className={`sticky top-0 p-4 backdrop-blur-md backdrop-filter flex justify-between items-center z-10 ${
            darkMode 
              ? 'bg-gray-800/70 border-b border-gray-700 shadow-lg' 
              : 'bg-white/70 border-b border-gray-200 shadow-sm'
          }`}>
            <div className="flex items-center">
              {/* Space for hamburger menu on mobile */}
              {isMobile && <div className="w-8 mr-2"></div>}
              
              {viewIcons[activeView] && (
                <span className={`mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {viewIcons[activeView]}
                </span>
              )}
              <h2 className="text-xl font-semibold truncate">
                {activeView === "dashboard" && "Dashboard Overview"}
                {activeView === "clients" && "Client Management"}
                {activeView === "agents" && "Agent Management"}
                
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-full transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-700/80 text-yellow-300 hover:bg-gray-600 hover:text-yellow-200' 
                    : 'bg-gray-200/80 text-gray-700 hover:bg-gray-300/80 hover:text-gray-900'
                }`}
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button> */}
              
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                  darkMode 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600' 
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                } text-white shadow-md`}>
                  A
                </div>
                <span className={`${darkMode ? 'text-gray-200' : 'text-gray-700'} ${isMobile ? 'hidden' : 'block'}`}>Admin</span>
              </div>
            </div>
          </div>

          {/* Main Content with Glass Effect - Scrollable Area */}
          <div className="p-4">
            <div className={`rounded-xl ${
              darkMode 
                ? 'bg-gray-800/30 shadow-xl backdrop-blur-md backdrop-filter' 
                : 'bg-white/60 shadow-lg backdrop-blur-md backdrop-filter'
            } p-4`}>
              {/* Dashboard Content */}
              {activeView === "dashboard" && (
                <DashboardOverview analytics={analytics} darkMode={darkMode} transparentCharts={true} />
              )}

              {/* Clients View */}
              {activeView === "clients" && (
                <ClientManagement 
                  clients={clients}
                  selectedClientId={selectedClientId}
                  setSelectedClientId={setSelectedClientId}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  showForm={showForm}
                  setShowForm={setShowForm}
                  handleClientAdded={handleClientAdded}
                  handleDeleteClient={handleDeleteClient}
                  addingLoanClientId={addingLoanClientId}
                  setAddingLoanClientId={setAddingLoanClientId}
                  fetchClients={fetchClients}
                  selectedLoanId={selectedLoanId}
                  setSelectedLoanId={setSelectedLoanId}
                  darkMode={darkMode}
                  transparentCharts={true}
                  isMobile={isMobile}
                />
              )}

              {/* Agents View */}
              {activeView === "agents" && (
                <AgentManagement 
                  agents={agents}
                  fetchAgents={fetchAgents}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  filteredAgents={filteredAgents}
                  handleDeleteAgent={handleDeleteAgent}
                  loading={loading}
                  navigate={navigate}
                  darkMode={darkMode}
                  transparentCharts={true}
                  isMobile={isMobile}
                />
              )}

              {/* Loans View */}
              {activeView === "loans" && <LoanManagementTable/>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;