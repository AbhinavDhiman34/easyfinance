import { useState, useEffect } from "react";
import { AgentcollectEMI, getClientDetails } from "../../services/agentAPI";

const AgentEmiCollection = ({ clientId, loanId, onClose }) => {
  const [client, setClient] = useState({});
  const [loan, setLoan] = useState(null);
  const [formData, setFormData] = useState({
    amountCollected: "",
    status: "Paid",
    location: { coordinates: [0, 0], address: "Unknown location" },
    paymentMode: "Cash",
    recieverName: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const res = await getClientDetails(clientId);
        if (res.statusCode === 200) {
          setClient(res.data);
          const loanData = res.data.loans.find((l) => l._id === loanId);
          if (loanData) {
            setLoan(loanData);
            setFormData((prev) => ({
              ...prev,
              amountCollected: loanData.emiAmount || "",
            }));
          } else {
            setError("Loan not found.");
          }
        } else {
          setError(res.message || "Failed to fetch client");
        }
      } catch (err) {
        setError("Error fetching client: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    const getLocation = () => {
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported.");
        return;
      }

      setGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const address = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

          setFormData((prev) => ({
            ...prev,
            location: { coordinates: [lng, lat], address },
          }));

          setGettingLocation(false);
        },
        (err) => {
          setLocationError("Error getting location. Please allow access.");
          console.error("Location error:", err);
          setGettingLocation(false);
        }
      );
    };

    fetchClient();
    getLocation();
  }, [clientId, loanId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.location || formData.location.coordinates[0] === 0) {
      setError("Location is required. Please allow access.");
      return;
    }

    try {
      const payload = {
        amountCollected: Number(formData.amountCollected),
        status: formData.status,
        location: formData.location,
        paymentMode: formData.paymentMode,
        recieverName: formData.paymentMode !== "Cash" ? formData.recieverName : "",
      };

      const res = await AgentcollectEMI(clientId, loanId, payload);

      if (res?.data?.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          if (onClose) onClose();
          window.location.reload();
        }, 800);
      } else {
        setError("EMI submission failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Error collecting EMI.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 text-blue-700">Collect EMI</h2>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Client Name" value={client.clientName} readOnly />
          <FormField label="Loan Amount" value={loan?.loanAmount || ""} readOnly />

          <FormField
            label="Amount Collected"
            name="amountCollected"
            type="number"
            value={formData.amountCollected}
            onChange={handleChange}
            required
          />

          <FormField
            label="Location"
            value={formData.location.address || "Fetching location..."}
            readOnly
          />

          {locationError && (
            <p className="text-red-500 text-sm">{locationError}</p>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">EMI Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="Paid">Paid</option>
              {/* <option value="Partial">Partial</option> */}
              <option value="Defaulted">Defaulted</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Payment Mode</label>
            <select
              name="paymentMode"
              value={formData.paymentMode}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Online">Online</option>
            </select>
          </div>

          {formData.paymentMode !== "Cash" && (
            <FormField
              label="Receiver's Name"
              name="recieverName"
              value={formData.recieverName}
              onChange={handleChange}
              required
            />
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            Submit EMI
          </button>

          {success && (
            <p className="text-green-600 text-center">
              EMI collected successfully!
            </p>
          )}
        </form>
      )}

      <button
        onClick={onClose}
        className="mt-4 text-blue-600 hover:underline text-sm"
      >
        ← Back
      </button>
    </div>
  );
};

const FormField = ({ label, ...props }) => (
  <div>
    <label className="block text-sm text-gray-600 mb-1">{label}</label>
    <input
      {...props}
      className="w-full border rounded px-3 py-2 bg-white disabled:bg-gray-100"
    />
  </div>
);

export default AgentEmiCollection;
