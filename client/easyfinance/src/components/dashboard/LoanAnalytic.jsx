import React from "react";
import { CreditCard, TrendingUp, Clock } from "lucide-react";

const LoanAnalyticsCards = ({ analytics, darkMode }) => {
  const statCardClass = `p-6 rounded-lg shadow-md ${
    darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-800"
  }`;

  const formatCurrency = (value) =>
    typeof value === "number" ? `₹ ${value.toLocaleString()}` : "—";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      <div className={statCardClass}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">Total Loans Disbursed</p>
            <h3 className="text-2xl font-bold mt-1">
              {formatCurrency(analytics?.totalLoanDisbursed)}
            </h3>
          </div>
          <CreditCard className="text-blue-500" size={28} />
        </div>
      </div>
      <div className={statCardClass}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">Amount Recovered</p>
            <h3 className="text-2xl font-bold mt-1">
              {formatCurrency(analytics?.totalAmountRecovered)}
            </h3>
          </div>
          <TrendingUp className="text-green-500" size={28} />
        </div>
      </div>
      <div className={statCardClass}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">EMIs Collected</p>
            <h3 className="text-2xl font-bold mt-1">
              {analytics?.totalEmisCollected ?? "—"}
            </h3>
          </div>
          <Clock className="text-indigo-500" size={28} />
        </div>
      </div>
    </div>
  );
};

export default LoanAnalyticsCards;
