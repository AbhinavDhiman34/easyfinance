import React, { useEffect, useState } from "react";
import { getAllClients } from "../../services/api"; // adjust to your API import
import { Eye, Search, Filter, ChevronRight, ArrowLeft, X } from "lucide-react";
import ClientLoans from "../details/ClientLoan";
import LoanDetailsShow from "../details/LoanDetail";
import { fetchAllDefaultedClients } from "../../services/api";
import DefaultEmiViewer from "../details/DefaultEmiViewer"; // adjust path as needed

import LoanAnalyticsCards from "./LoanAnalytic"; // adjust path if needed
import { getAdminDashboardAnalyticsData } from "../../services/api";


const LoanManagementTable = () => {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [defaultedClientIds, setDefaultedClientIds] = useState({});
  const [showDefaultEmis, setShowDefaultEmis] = useState(false);
  const [viewingClientId, setViewingClientId] = useState(null);

  const [analytics, setAnalytics] = useState([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await getAdminDashboardAnalyticsData();

        console.log("Analytics data:", res.data);
        setAnalytics(res?.data); // access `.data` because your response wraps it in ApiResponse
      } catch (err) {
        console.error("Error fetching analytics:", err);
      }
    };
  
    fetchAnalytics();
  }, []);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await getAllClients(); // API should return client list with loans array
        setClients(response.data); // adjust based on your API structure
        setFilteredClients(response.data);
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  useEffect(() => {
    const fetchDefaultedClients = async () => {
      try {
        const data = await fetchAllDefaultedClients(); // this is an object
        console.log("Fetched defaultedClientIds:", data);
        setDefaultedClientIds(data); // ✅ no forEach needed!
      } catch (err) {
        console.error("Error fetching defaulted clients:", err);
      }
    };

    if (clients.length > 0) {
      fetchDefaultedClients();
    }
  }, [clients]);

  useEffect(() => {
    // Filter clients based on search term
    if (searchTerm.trim() === "") {
      setFilteredClients(clients);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = clients.filter(
        (client) =>
          client.clientName.toLowerCase().includes(term) ||
          (client.clientPhoneNumbers &&
            client.clientPhoneNumbers.some((phone) => phone.includes(term)))
      );
      setFilteredClients(filtered);
    }
  }, [searchTerm, clients]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const getBreadcrumbs = () => {
    if (selectedLoanId) {
      return (
        <div className="flex items-center text-sm text-gray-500 mb-6">
          <button
            onClick={() => setSelectedLoanId(null)}
            className="hover:text-blue-600 flex items-center"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Loans
          </button>
          <ChevronRight size={14} className="mx-2" />
          <span className="font-medium text-gray-700">Loan Details</span>
        </div>
      );
    }

    if (selectedClient) {
      return (
        <div className="flex items-center text-sm text-gray-500 mb-6">
          <button
            onClick={() => setSelectedClient(null)}
            className="hover:text-blue-600 flex items-center"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Clients
          </button>
          <ChevronRight size={14} className="mx-2" />
          <span className="font-medium text-gray-700">
            {selectedClient.clientName}'s Loans
          </span>
        </div>
      );
    }

    return null;
  };

  
  return (
    
    <div className="p-6 bg-gray-50 min-h-screen">
      
      {showDefaultEmis && viewingClientId && (
              <DefaultEmiViewer
                clientId={viewingClientId}
                onClose={() => {
                  setShowDefaultEmis(false);
                  setViewingClientId(null);
                }}
              />
            )}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Client Loan Management
        </h2>

        {analytics && <LoanAnalyticsCards analytics={analytics} darkMode={false} />}



        {getBreadcrumbs()}

        {selectedLoanId ? (
          <div className="bg-white rounded-lg shadow-md">
            <LoanDetailsShow
              loanId={selectedLoanId}
              onBack={() => setSelectedLoanId(null)}
            />
          </div>
        ) : selectedClient ? (
          <div className="bg-white rounded-lg shadow-md">
            <ClientLoans
              clientId={selectedClient._id}
              onBack={() => setSelectedClient(null)}
              onViewLoanDetails={(loanId) => setSelectedLoanId(loanId)}
            />
          </div>
        ) : (
          <>
            <div className="bg-white p-4 rounded-lg shadow-md mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by client name or phone number..."
                  className="pl-10 pr-10 py-2 border border-gray-300 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {filteredClients.length}{" "}
                  {filteredClients.length === 1 ? "client" : "clients"} found
                </div>
                <div className="flex items-center text-sm">
                  <Filter size={16} className="text-gray-400 mr-1" />
                  <span className="text-gray-500">
                    Filter options could go here
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Client Name
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Phone Number
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        No. of Loans
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Actions
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Default Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <tr
                          key={client._id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">
                              {client.clientName}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {client.clientPhoneNumbers?.[0] || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {client.loans?.length || 0}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelectedClient(client)}
                              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm text-sm font-medium"
                            >
                              <Eye size={16} className="mr-2" />
                              View Loans
                            </button>
                          </td>
                          <td>
                            {defaultedClientIds[client._id] && (
                              <div className="default-status">
                                <p>
                                  Status:{" "}
                                  <span style={{ color: "red" }}>Default</span>
                                </p>
                                <button
                                  onClick={() => {
                                    setViewingClientId(client._id);
                                    setShowDefaultEmis(true);
                                  }}
                                >
                                  View
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="4"
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          No clients found matching your search criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
             
              {filteredClients.length > 10 && (
                <div className="bg-white px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Showing <span className="font-medium">1</span> to{" "}
                      <span className="font-medium">10</span> of{" "}
                      <span className="font-medium">
                        {filteredClients.length}
                      </span>{" "}
                      clients
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                        Previous
                      </button>
                      <button className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-500 hover:bg-gray-50">
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoanManagementTable;
