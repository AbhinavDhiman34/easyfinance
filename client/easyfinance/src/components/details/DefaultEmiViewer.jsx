import React, { useEffect, useState } from "react";
import { fetchDefaultemis } from "../../services/api"; // assume this takes clientId
import PayDefaultEmiForm from "../forms/PayDefaultEmiForm";
import { X, RefreshCw, AlertCircle } from "lucide-react";

const DefaultEmiViewer = ({ clientId, onClose }) => {
  const [emis, setEmis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmi, setSelectedEmi] = useState(null);
  const [error, setError] = useState(null);

  const loadEmis = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDefaultemis(clientId);
      setEmis(data);
    } catch (err) {
      console.error("Failed to load EMIs", err);
      setError("Failed to load EMIs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmis();
  }, [clientId]);

  const refreshAfterPay = () => {
    setSelectedEmi(null);
    loadEmis();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Default EMIs</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadEmis}
              className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-pulse flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-blue-100"></div>
                <div className="mt-2 text-sm text-gray-500">Loading EMIs...</div>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-3">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <p className="text-gray-700">{error}</p>
              <button
                onClick={loadEmis}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : !emis || emis.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                <AlertCircle size={24} className="text-gray-400" />
              </div>
              <p>No default EMIs found for this client.</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Client Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Amount Due
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Due Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Loan ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {emis.map((emi) => (
                      <tr 
                        key={emi._id} 
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {emi.clientId?.clientName || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          ₹{Number(emi.amountDue).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(emi.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Defaulted
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {emi.loanId}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                            onClick={() => setSelectedEmi(emi)}
                          >
                            Pay Now
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEmi && (
        <PayDefaultEmiForm
          emi={selectedEmi}
          onClose={() => setSelectedEmi(null)}
          onSuccess={refreshAfterPay}
        />
      )}
    </div>
  );
};

export default DefaultEmiViewer;