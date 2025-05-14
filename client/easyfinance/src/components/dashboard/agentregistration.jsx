import React, { useState } from "react";
import { UserPlus, Loader, Upload, X } from "lucide-react";
import { registerAgent } from "../../services/api.js";

const AgentRegisterForm = ({ onAgentAdded }) => {
  const [formData, setFormData] = useState({
    agentusername: "",
    fullname: "",
    email: "",
    fathername: "",
    password: "",
    photo: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        photo: file,
      }));
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setFormData((prev) => ({
      ...prev,
      photo: null,
    }));
    setPhotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formPayload = new FormData();
      formPayload.append("agentusername", formData.agentusername);
      formPayload.append("fullname", formData.fullname);
      formPayload.append("email", formData.email);
      formPayload.append("fathername", formData.fathername);
      formPayload.append("password", formData.password);
      if (formData.photo) {
        formPayload.append("photo", formData.photo);
      }

      await registerAgent(formPayload);

      // Clear form
      setFormData({
        agentusername: "",
        fullname: "",
        email: "",
        fathername: "",
        password: "",
        photo: null,
      });
      setPhotoPreview(null);

      // Notify success
      alert("Agent registered successfully!");

      // Refresh agent list
      if (onAgentAdded) onAgentAdded();
    } catch (error) {
      console.error("Error registering agent:", error);
      alert(
        `Failed to register agent: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-8">
      <div className="flex items-center mb-6">
        <UserPlus size={22} className="text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-800">Register New Agent</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Username Field */}
          <div className="space-y-2">
            <label className="block text-gray-700 text-sm font-medium">
              Username
            </label>
            <input
              type="text"
              name="agentusername"
              value={formData.agentusername}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter username"
              required
            />
          </div>

          {/* Full Name Field */}
          <div className="space-y-2">
            <label className="block text-gray-700 text-sm font-medium">
              Full Name
            </label>
            <input
              type="text"
              name="fullname"
              value={formData.fullname}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter full name"
              required
            />
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <label className="block text-gray-700 text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="example@email.com"
              required
            />
          </div>

          {/* Father's Name Field */}
          <div className="space-y-2">
            <label className="block text-gray-700 text-sm font-medium">
              Father's Name
            </label>
            <input
              type="text"
              name="fathername"
              value={formData.fathername}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter father's name"
              required
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="block text-gray-700 text-sm font-medium">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter password"
              required
            />
          </div>

          {/* Photo Upload Field */}
          <div className="space-y-2">
            <label className="block text-gray-700 text-sm font-medium">
              Upload Photo
            </label>
            {photoPreview ? (
              <div className="relative w-full h-32">
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="h-full object-cover rounded-md border border-gray-300"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 focus:outline-none"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-md p-4 text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <div className="mt-1">
                  <label className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-700 text-sm">
                      Click to upload photo
                    </span>
                    <input
                      type="file"
                      name="photo"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="sr-only"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white py-2.5 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader size={18} className="animate-spin mr-2" />
                Registering...
              </>
            ) : (
              <>
                <UserPlus size={18} className="mr-2" />
                Register Agent
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AgentRegisterForm;