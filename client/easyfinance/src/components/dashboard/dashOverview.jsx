// File: components/dashboard/dashOverview.jsx

import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Cell,
  Legend,
  Tooltip,
} from "recharts";
import {
  CreditCard,
  TrendingUp,
  Users,
  Clock,
  Search,
  FileDown,
} from "lucide-react";
import { getTodayCollections } from "../../services/api"; // You'll need to add this API function
import * as XLSX from "xlsx"; // Import xlsx library

const COLORS = ["#0088FE", "#FF8042"];
const DARK_COLORS = ["#60a5fa", "#fb923c"];

const DashboardOverview = ({ analytics, darkMode, transparentCharts }) => {
  const [todayCollections, setTodayCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [exporting, setExporting] = useState(false);

  // Fetch today's collections when component mounts
  useEffect(() => {
    const fetchTodayCollections = async () => {
      try {
        setLoading(true);
        const response = await getTodayCollections();
        setTodayCollections(response.data);
      } catch (error) {
        console.error("Error fetching today's collections:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayCollections();
  }, []);

  // Prepare data for pie chart
  const pieData = [
    { name: "Recovered", value: analytics.totalAmountRecovered },
    { name: "Remaining", value: analytics.totalAmountRemaining },
  ];

  // Calculate percentages for pie chart
  const totalAmount =
    analytics.totalAmountRecovered + analytics.totalAmountRemaining;
  const recoveredPercentage = Math.round(
    (analytics.totalAmountRecovered / totalAmount) * 100
  );
  const remainingPercentage = 100 - recoveredPercentage;

  // Calculate today's collection total
  const todayTotal = todayCollections.reduce(
    (sum, collection) => sum + collection.amountCollected,
    0
  );

  // Filter collections based on search term
  const filteredCollections = todayCollections.filter(
    (collection) =>
      collection.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.agentName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to export today's collections to Excel
  const exportToExcel = () => {
    try {
      setExporting(true);

      // Format the data for Excel
      const excelData = todayCollections.map((collection) => ({
        "Client Name": collection.clientName,
        "Loan Number": collection.loanNumber,
        "Amount Collected": collection.amountCollected,
        "Payment Mode": collection.paymentMode,
        Status: collection.status,
        Agent: collection.agentName || "Admin",
        Time: new Date(collection.date).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        Date: new Date(collection.date).toLocaleDateString(),
        "Reciever Name": collection.recieverName,
      }));

      // Add total row
      excelData.push({
        "Client Name": "",
        "Loan Number": "",
        "Amount Collected": todayTotal,
        "Payment Mode": "",
        Status: "",
        Agent: "",
        Time: "",
        Date: "TOTAL",
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Today's Collections");

      // Format the date for the filename
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

      // Export to file
      XLSX.writeFile(workbook, `Collections_${dateStr}.xlsx`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const chartColors = darkMode ? DARK_COLORS : COLORS;

  const statCardClass = `stat-card p-6 ${
    darkMode ? "text-white" : "text-gray-800"
  }`;

  const chartContainerClass = `chart-container rounded-xl p-4 ${
    transparentCharts
      ? "bg-transparent"
      : darkMode
      ? "bg-gray-800/80"
      : "bg-white/80"
  }`;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Loans Card */}
        <div className={statCardClass}>
          <div className="flex justify-between">
            <div>
              <p
                className={`text-sm ${
                  darkMode ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Total Loans
              </p>
              <h3 className="text-2xl font-bold mt-1">
                ₹ {analytics.totalLoanDisbursed.toLocaleString()}
              </h3>
            </div>
            <div
              className={`p-3 rounded-full ${
                darkMode ? "bg-blue-900/30" : "bg-blue-100"
              }`}
            >
              <CreditCard
                className={darkMode ? "text-blue-400" : "text-blue-600"}
                size={24}
              />
            </div>
          </div>
        </div>

        {/* Amount Recovered Card */}
        <div className={statCardClass}>
          <div className="flex justify-between">
            <div>
              <p
                className={`text-sm ${
                  darkMode ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Amount Recovered
              </p>
              <h3 className="text-2xl font-bold mt-1">
                ₹ {analytics.totalAmountRecovered.toLocaleString()}
              </h3>
            </div>
            <div
              className={`p-3 rounded-full ${
                darkMode ? "bg-green-900/30" : "bg-green-100"
              }`}
            >
              <TrendingUp
                className={darkMode ? "text-green-400" : "text-green-600"}
                size={24}
              />
            </div>
          </div>
        </div>

        {/* EMIs Collected Card */}
        <div className={statCardClass}>
          <div className="flex justify-between">
            <div>
              <p
                className={`text-sm ${
                  darkMode ? "text-gray-300" : "text-gray-500"
                }`}
              >
                EMIs Collected
              </p>
              <h3 className="text-2xl font-bold mt-1">
                {analytics.totalEmisCollected}
              </h3>
            </div>
            <div
              className={`p-3 rounded-full ${
                darkMode ? "bg-indigo-900/30" : "bg-indigo-100"
              }`}
            >
              <Clock
                className={darkMode ? "text-indigo-400" : "text-indigo-600"}
                size={24}
              />
            </div>
          </div>
        </div>

        {/* Defaulters Card */}
        {/* <div className={statCardClass}>
          <div className="flex justify-between">
            <div>
              <p
                className={`text-sm ${
                  darkMode ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Defaulters
              </p>
              <h3 className="text-2xl font-bold mt-1">
                {analytics.defaulterCount}
              </h3>
            </div>
            <div
              className={`p-3 rounded-full ${
                darkMode ? "bg-red-900/30" : "bg-red-100"
              }`}
            >
              <Users
                className={darkMode ? "text-red-400" : "text-red-600"}
                size={24}
              />
            </div>
          </div>
        </div> */}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className={`${chartContainerClass} w-full`}>
          <h3
            className={`text-lg sm:text-xl font-semibold mb-4 ${
              darkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Loan Recovery Status
          </h3>

          <div className="w-full h-[300px] sm:h-[320px] md:h-[340px] lg:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `₹ ${value.toLocaleString()}`,
                    "Amount",
                  ]}
                  contentStyle={{
                    backgroundColor: darkMode
                      ? "rgba(30, 41, 59, 0.85)"
                      : "rgba(255, 255, 255, 0.85)",
                    color: darkMode ? "#fff" : "#000",
                    border: "none",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{
                    fontSize: "0.85rem",
                    paddingTop: "0.5rem",
                  }}
                  formatter={(value) => (
                    <span style={{ color: darkMode ? "#e5e7eb" : "#374151" }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col xs:flex-row justify-around items-center gap-2 mt-4">
            <div>
              <p
                className={`font-medium ${
                  darkMode ? "text-blue-400" : "text-blue-600"
                }`}
              >
                Recovered: {recoveredPercentage}%
              </p>
            </div>
            <div>
              <p
                className={`font-medium ${
                  darkMode ? "text-orange-400" : "text-orange-600"
                }`}
              >
                Remaining: {remainingPercentage}%
              </p>
            </div>
          </div>
        </div>

        {/* Today's Collections Table */}
        <div className={chartContainerClass}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <h3
                className={`text-lg font-semibold ${
                  darkMode ? "text-white" : "text-gray-800"
                } mr-3`}
              >
                Today's Collections
              </h3>
              <button
                onClick={exportToExcel}
                disabled={loading || exporting || todayCollections.length === 0}
                className={`
    flex items-center justify-center gap-1.5
    px-2 py-1 text-xs
    sm:px-3 sm:py-1.5 sm:text-sm
    md:px-4 md:py-2
    rounded-lg
    transition-colors
    disabled:cursor-not-allowed
    mr-3
    ${
      darkMode
        ? "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800/40"
        : "bg-yellow-500 hover:bg-green-600 text-black disabled:bg-red-500"
    }
  `}
                aria-label="Export to Excel"
              >
                <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                <span className="hidden xs:inline">
                  {exporting ? "Exporting..." : "Export to Excel"}
                </span>
                <span className="xs:hidden">
                  {exporting ? "..." : "Excle Sheet ⬇"}
                </span>
              </button>
            </div>
            <div
              className={`relative ${
                darkMode ? "text-white" : "text-gray-800"
              }`}
            >
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-8 pr-4 py-2 rounded-lg text-sm w-full sm:w-48 ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-300 text-gray-800 placeholder-gray-500"
                } border focus:outline-none focus:ring-2 ${
                  darkMode ? "focus:ring-blue-500" : "focus:ring-blue-400"
                }`}
              />
              <Search
                size={16}
                className="absolute left-2 top-2.5 text-gray-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto" style={{ maxHeight: "360px" }}>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div
                  className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
                    darkMode ? "border-blue-400" : "border-blue-600"
                  }`}
                ></div>
              </div>
            ) : todayCollections.length === 0 ? (
              <div
                className={`text-center py-16 ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                No collections recorded today
              </div>
            ) : (
              <table
                className={`min-w-full divide-y ${
                  darkMode ? "divide-gray-700" : "divide-gray-200"
                }`}
              >
                <thead className={darkMode ? "bg-gray-800" : "bg-gray-50"}>
                  <tr>
                    <th
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Client
                    </th>
                    <th
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Amount
                    </th>
                    <th
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Payment Mode
                    </th>
                    <th
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Agent
                    </th>
                    <th
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Time
                    </th>
                    <th
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Reciever
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    darkMode ? "divide-gray-700" : "divide-gray-200"
                  }`}
                >
                  {filteredCollections.map((collection, index) => (
                    <tr
                      key={index}
                      className={
                        darkMode ? "hover:bg-gray-700/50" : "hover:bg-gray-50"
                      }
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`flex-shrink-0 h-8 w-8 rounded-full ${
                              darkMode ? "bg-gray-700" : "bg-gray-200"
                            } flex items-center justify-center`}
                          >
                            <span
                              className={
                                darkMode ? "text-gray-300" : "text-gray-600"
                              }
                            >
                              {collection.clientName?.charAt(0).toUpperCase() ||
                                "C"}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div
                              className={`text-sm font-medium ${
                                darkMode ? "text-white" : "text-gray-900"
                              }`}
                            >
                              {collection.clientName}
                            </div>
                            <div
                              className={`text-xs ${
                                darkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              {collection.loanNumber}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className={`text-sm font-medium ${
                            darkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          ₹ {collection.amountCollected.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          {collection.paymentMode}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            collection.status === "Paid"
                              ? darkMode
                                ? "bg-green-900/30 text-green-300"
                                : "bg-green-100 text-green-800"
                              : collection.status === "Partial"
                              ? darkMode
                                ? "bg-yellow-900/30 text-yellow-300"
                                : "bg-yellow-100 text-yellow-800"
                              : darkMode
                              ? "bg-red-900/30 text-red-300"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {collection.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          {collection.agentName || "Admin"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            darkMode ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          {new Date(collection.date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          {collection.recieverName || "Admin"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Total for today */}
          <div
            className={`flex justify-end mt-4 pt-4 ${
              darkMode ? "border-t border-gray-700" : "border-t border-gray-200"
            }`}
          >
            <div
              className={`flex items-center justify-between px-4 py-2 rounded-lg ${
                darkMode
                  ? "bg-blue-900/20 text-blue-300"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              <span className="font-semibold mr-3">Total Collected Today:</span>
              <span className="font-bold">₹ {todayTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
