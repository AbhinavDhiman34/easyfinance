import { useState, useEffect } from "react";
import axios from "axios";
import { collectEMI } from "../../services/api.js";
import { getClientDetailsById } from "../../services/api.js";

function CollectEMI({
  clientId,
  loanId,
  onClose,
  embedded = false,
  isAgent = false,
}) {
  const [client, setClient] = useState({});
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  console.log("client", client);

  const [formData, setFormData] = useState({
    amountCollected: "",
    status: "Paid",
    location: {
      coordinates: [0, 0],
      address: "Unknown location",
    },
    paymentMode: "Cash",
    recieverName: "",
  });
  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);
        const rolePrefix = isAgent ? "agent" : "admin";
        console.log(
          "Fetching client:",
          clientId,
          "via",
          `/api/v1/${rolePrefix}/getClientdata/${clientId}`
        );

        // const response = await axios.get(
        //   `http://localhost:8000/api/v1/admin/getClientdata/${clientId}`
        // );

        const response = await getClientDetailsById(clientId, {
          withCredentials: true,
        });

        console.log("response", response);

        if (response.statusCode === 200) {
          setClient(response.data);
          setClient(response);
          console.log("response.data", response.data);

          const loanData = response.data.loans.find((l) => l._id === loanId);
          if (loanData) {
            setLoan(loanData);
            setFormData((prev) => ({
              ...prev,
              amountCollected: loanData.emiAmount || "",
            }));
          } else {
            setError("Loan not found");
          }
        } else {
          setError(response.data.message || "Failed to fetch client details");
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "An error occurred while fetching client details"
        );
        console.error("Error fetching client:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
    getLocation();
  }, [clientId, loanId]);

  const getLocation = () => {
    if (navigator.geolocation) {
      setGettingLocation(true);
      setLocationError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          const address = `Lat: ${coords.lat.toFixed(
            6
          )}, Lng: ${coords.lng.toFixed(6)}`;

          setUserLocation({
            coordinates: [coords.lng, coords.lat],
            address,
          });

          setFormData((prev) => ({
            ...prev,
            location: {
              coordinates: [coords.lng, coords.lat],
              address,
            },
          }));

          setGettingLocation(false);
        },
        (err) => {
          setLocationError(`Error getting location: ${err.message}`);
          setGettingLocation(false);
          console.error("Geolocation error:", err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting EMI for:", clientId, loanId, formData);

    // if (!formData.amountCollected || formData.amountCollected <= 0) {
    //   setError("Please enter a valid amount");
    //   return;
    // }

    if (
      !userLocation ||
      !userLocation.coordinates ||
      userLocation.coordinates[0] === 0
    ) {
      setError(
        "Location access is required to submit this form. Please allow location."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await collectEMI(
        clientId,
        loanId,
        {
          amountCollected: Number(formData.amountCollected),
          status: formData.status,
          location: formData.location,
          paymentMode: formData.paymentMode,
          recieverName:
            formData.paymentMode !== "cash" ? formData.recieverName : "",
        },
        isAgent
      );

      if (response.data.success) {
        setSuccess(true);
        if (onClose) onClose();

        // ✅ Reload the page after a brief delay
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        setError(response.data.message || "Failed to collect EMI");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "An error occurred while collecting EMI"
      );
      console.error("Error collecting EMI:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // const markAsDefaulted = async () => {
  //   setFormData((prev) => ({
  //     ...prev,
  //     status: "Defaulted",
  //   }));
  
  //   // Wait for next render tick
  //   setTimeout(() => {
  //     handleSubmit({ preventDefault: () => {} });
  //   }, 0);
  // };
  const getStatusBasedOnAmount = () => {
    if (!loan || !formData.amountCollected) return "Defaulted";

    const amount = parseFloat(formData.amountCollected);
    const emiAmount = loan.emiAmount || 0;

    if (amount >= emiAmount) return "Paid";
    if (amount > 0) return "Partial";
    return "Defaulted";
  };

  useEffect(() => {
    if (loan && formData.amountCollected) {
      const status = getStatusBasedOnAmount();
      setFormData((prev) => ({ ...prev, status }));
    }
  }, [formData.amountCollected, loan]);

  return (
    <div
      className={`flex flex-col ${
        !embedded ? "md:flex-row min-h-screen" : ""
      } bg-gradient-to-br from-blue-50 to-indigo-50 transition-all duration-300`}
    >
      {!embedded && <Sidebar activeItem="collections" />}
      <div className="flex flex-1 justify-center items-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 transform transition-all duration-300 hover:shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 rounded-full p-3 mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-blue-700 text-center">
              Collect EMI
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
              <p className="text-blue-600 font-medium">
                Loading client details...
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6 animate-pulse">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="transform transition-all duration-200 hover:translate-y-px">
                <label className="block text-sm font-semibold text-blue-700 mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={client?.data?.clientName || ""}
                  readOnly
                  className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 shadow-sm transition-all duration-200"
                />
              </div>

              <div className="transform transition-all duration-200 hover:translate-y-px">
                <label className="block text-sm font-semibold text-blue-700 mb-2">
                  Loan Amount
                </label>
                <input
                  type="text"
                  value={loan?.loanAmount || ""}
                  readOnly
                  className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 shadow-sm transition-all duration-200"
                />
              </div>

              <div className="transform transition-all duration-200 hover:translate-y-px">
                <label className="block text-sm font-semibold text-blue-700 mb-2">
                  EMI Amount
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                    ₹
                  </span>
                  <input
                    type="number"
                    name="amountCollected"
                    value={formData.amountCollected}
                    onChange={handleChange}
                    placeholder="Enter EMI Amount"
                    className="w-full pl-8 pr-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-sm"
                  />
                </div>
              </div>

              <div className="transform transition-all duration-200 hover:translate-y-px">
                <label className="block text-sm font-semibold text-blue-700 mb-2">
                  EMI Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-sm appearance-none bg-white"
                  style={{
                    backgroundImage:
                      'url(\'data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%232563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\')',
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 1rem center",
                    paddingRight: "3rem",
                  }}
                >
                  <option value="Paid">Paid</option>
                  <option value="Defaulted">Defaulted</option>
                </select>
              </div>

              <div className="transform transition-all duration-200 hover:translate-y-px">
                <label className=" text-sm font-semibold text-blue-700 mb-2 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Current Location
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={userLocation?.address || "Fetching location..."}
                    readOnly
                    className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 shadow-sm transition-all duration-200"
                  />
                  {gettingLocation && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>

              {locationError && (
                <div className="text-red-500 text-sm px-3 py-2 bg-red-50 rounded-md border-l-4 border-red-500 animate-pulse">
                  {locationError}
                </div>
              )}
              {/* Payment Mode */}
              <div className="transform transition-all duration-200 hover:translate-y-px">
                <label className="block text-sm font-semibold text-blue-700 mb-2">
                  Payment Mode
                </label>
                <select
                  name="paymentMode"
                  value={formData.paymentMode}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm appearance-none"
                  style={{
                    backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%232563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>')`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 1rem center",
                    paddingRight: "3rem",
                  }}
                >
                  <option value="Cash">Cash</option>

                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              {formData.paymentMode !== "cash" && (
                <div className="transform transition-all duration-200 hover:translate-y-px">
                  <label className="block text-sm font-semibold text-blue-700 mb-2">
                    Receiver Name
                  </label>
                  <input
                    type="text"
                    name="recieverName"
                    value={formData.recieverName}
                    onChange={handleChange}
                    placeholder="Enter Receiver's Name"
                    className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm transition-all duration-200"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg flex items-center justify-center ${
                  submitting ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    Collect EMI
                  </>
                )}
              </button>
              {/* <button
                variant="outlined"
                color="error"
                disabled={submitting}
                style={{ marginLeft: "10px" }}
                onClick={markAsDefaulted}
              >
                Mark EMI as Default
              </button> */}
             

              {success && (
                <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-md animate-pulse">
                  <div className="flex">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="font-medium">EMI Collected Successfully!</p>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default CollectEMI;
