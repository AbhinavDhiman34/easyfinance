import jwt from "jsonwebtoken";
import { Agent } from "../models/agent.model.js";
import Client  from "../models/client.loan.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import twilio from "twilio";
import isSameDay from 'date-fns/isSameDay';
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { DefaultedEMI } from "../models/client.loan.model.js";
import { v4 as uuidv4 } from "uuid";

const generateAccessAndRefrshToken = async (agentId) => {
  try {
    const agent = await Agent.findById(agentId);
    const accessToken = agent.generateAccessToken();
    const refreshToken = agent.generateRefreshToken();
    agent.refreshtoken = refreshToken;
    await agent.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "SOMETHING went wrong while generating refresh and access token"
    );
  }
};
// ==========================
// Agent Login
// ==========================
export const agentLogin = asyncHandler(async (req, res) => {
  const { agentusername, email, password } = req.body;

  const agent = await Agent.findOne({
    $or: [{ agentusername }, { email }],
  });

  if ((!email && !agentusername) || !password) {
    throw new ApiError(400, "Email/Username and Password are required");
  }
  if (!agent) {
    throw new ApiError(401, "Agent not found");
  }

  const isPasswordCorrect = await agent.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefrshToken(
    agent._id
  );
  const loggedinAgent = await Agent.findById(agent._id).select(
    "-password -refreshtoken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { agent: loggedinAgent, accessToken, refreshToken }, // here we are handeling the case where admin wants to set his cokkies him self in his local system may be he wants to login from another device
        "Agent logged in successfully"
      )
    );
});

// In controllers/agent.controller.js or create a new function in admin.controller.js

export const searchClients = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }
    
    // Assuming you have a Client model
    const clients = await Client.find({
      clientName: { $regex: query, $options: 'i' } // Case-insensitive search
    }).select('clientName clientPhone email _id'); // Select only necessary fields
    
    return res.status(200).json({
      success: true,
      data: clients
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({
      success: false,
      message: "Error searching clients",
      error: error.message
    });
  }
};

/// === agent logout
export const agentLogout = asyncHandler(async (req, res) => {
  await Agent.findByIdAndUpdate(
    req.agent._id,
    {
      $set: {
        refreshToken: undefined, // removing refresh token from database
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "agent logged out successfully"));
});

//emi collection log 

const clientTwilio = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_FROM
const toAdminNumber = process.env.ADMIN_WHATSAPP_TO
export const AgentcollectEMI = asyncHandler(async (req, res) => {
  const { clientId, loanId } = req.params;
  const { amountCollected, status, location, paymentMode, recieverName } = req.body;
  const agentId = req.agent._id;

  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const loan = client.loans.id(loanId);
  if (!loan) throw new ApiError(404, "Loan not found");

  const today = new Date();

  // Normalize status
  const allowedStatuses = ["Paid", "Defaulted"];
  const normalizedStatus = allowedStatuses.includes(status) ? status : "Paid";

  const emiAmount = loan.emiAmount;
  const numberOfEmisPaid = Math.floor(amountCollected / emiAmount);

  // Record EMI or defaults
  for (let i = 0; i < numberOfEmisPaid; i++) {
    let emiDate = new Date(today);

    if (loan.emiType === "Daily") {
      emiDate.setDate(today.getDate() + i);
    } else if (loan.emiType === "Weekly") {
      emiDate.setDate(today.getDate() + i * 7);
    } else if (loan.emiType === "Monthly") {
      emiDate.setMonth(today.getMonth() + i);
    }

    if (normalizedStatus === "Paid") {
      loan.emiRecords.push({
        date: emiDate,
        amountCollected: emiAmount,
        status: "Paid",
        collectedBy: agentId,
        location,
        paymentMode,
        recieverName,
      });
    } else {
      const defaultedEmi = new DefaultedEMI({
        date: emiDate,
        clientId,
        loanId,
        amountDue: emiAmount,
        location,
        recordedBy: agentId,
        reason: "Marked Default",
      });
      await defaultedEmi.save();
    }
  }

  // Update loan stats
  if (normalizedStatus === "Paid") {
    loan.totalCollected += amountCollected;
  }

  loan.totalAmountLeft = loan.totalPayable - loan.totalCollected;
  loan.updatedAt = new Date();

  // Recalculate paid EMIs
  loan.paidEmis = loan.emiRecords.filter((e) => e.status === "Paid").length;

  // Update next EMI date
  if (numberOfEmisPaid > 0) {
    let baseDate = loan.nextEmiDate ? new Date(loan.nextEmiDate) : new Date(loan.startDate);

    if (loan.emiType === "Daily") {
      baseDate.setDate(baseDate.getDate() + numberOfEmisPaid);
    } else if (loan.emiType === "Weekly") {
      baseDate.setDate(baseDate.getDate() + numberOfEmisPaid * 7);
    } else if (loan.emiType === "Monthly") {
      baseDate.setMonth(baseDate.getMonth() + numberOfEmisPaid);
    }

    loan.nextEmiDate = baseDate;
  }

  loan.totalEmis = loan.tenureMonths ?? loan.tenureDays ?? 0;
  loan.totalInterest = loan.totalPayable - loan.loanAmount;
  loan.totalRepayment = loan.totalPayable;

  client.markModified("loans");
  await client.save();

  const updatedLoan = client.loans.id(loanId);
  const agent = await Agent.findById(agentId);

  // WhatsApp Notification
  // if (normalizedStatus === "Defaulted") {
  //   const messageBody = `⚠️ *EMI Default Alert!*\n\n📛 *Client:* ${client.clientName}\n💰 *Amount Due:* ₹${amountCollected}\n🕒 *Recorded At:* ${today.toLocaleString()}\n🧑‍💼 *Updated By:* ${agent.fullname}\n\n🚨 Please take necessary action.`;

  //   await clientTwilio.messages.create({
  //     from: fromWhatsAppNumber,
  //     to: toAdminNumber,
  //     body: messageBody,
  //   });
  // } else {
  //   const [lng, lat] = location.coordinates;
  //   const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
  //   const messageBody = `📢 *EMI Collected!*\n👤 *Client:* ${client.clientName}\n💸 *Amount:* ₹${amountCollected}\n🕒 *Time:* ${today.toLocaleString()}\n📍 *Location:* ${mapsLink}\n🙋‍♂️ *Collected By:* ${agent.fullname}\n💳 *Payment Mode:* ${paymentMode}`;

  //   await clientTwilio.messages.create({
  //     from: fromWhatsAppNumber,
  //     to: toAdminNumber,
  //     body: messageBody,
  //   });
  // }

  res.status(200).json(
    new ApiResponse(200, updatedLoan, "EMI collected and recorded successfully")
  );
});


// export const AgentaddClient = asyncHandler(async (req, res) => {
//   const { clientName, clientPhone, clientAddress, clientPhoto, email } = req.body;
//   let loans = [];
//   if (req.body.loans) {
//     try {
//       loans = typeof req.body.loans === "string"
//         ? JSON.parse(req.body.loans)
//         : req.body.loans;
//     } catch (error) {
//       throw new ApiError(400, "Invalid format for loans");
//     }
//   }

//   const existingClient = await Client.findOne({
//     $or: [{ clientPhone }, { clientName }],
//   });

//   if (existingClient) {
//     throw new ApiError(400, "Client already exists");
//   }

//   const clientpic = await uploadOnCloudinary(req.file?.path);
//   console.log(req);
  
//   const creatorId = req.admin?._id || req.agent?._id;
//   console.log("🔁 creatorId:", creatorId);
  
//   if (!creatorId) {
//     throw new ApiError(401, "Missing creator information (admin or agent).");
//   }

//   const processedLoans = loans.map((loan) => {
//     const {
//       loanAmount,
//       interestRate,
//       tenureDays,
//       tenureMonths,
//       emiType,
//       startDate = new Date()
//     } = loan;

//     const principal = Number(loanAmount);
//     const rate = Number(interestRate);
//     const totalTenureDays = Number(tenureDays || 0);
//     const totalTenureMonths = Number(tenureMonths || 0);
//     const tenureInYears = totalTenureMonths ? totalTenureMonths / 12 : totalTenureDays / 365;
   
//     const interest = (loanAmount * interestRate * tenureInYears) / 100;
//     const totalPayable = principal + interest;
//     const disbursedAmount = principal - interest;
//     const totalAmountLeft = totalPayable;

//     const start = new Date(startDate);
//     const dueDate = new Date(start.getTime() + totalTenureDays * 24 * 60 * 60 * 1000);
//     if (isNaN(dueDate.getTime())) {
//       throw new ApiError(400, "Invalid due date calculated from tenure");
//     }

//     // ✅ EMI calculation based on total repayment
//     let emiAmount = 0;
//     if (emiType === "Daily") {
//       emiAmount = totalTenureDays ? totalPayable / totalTenureDays : totalPayable;
//     } else if (emiType === "Weekly") {
//       const weeks = Math.ceil(totalTenureDays / 7) || 1;
//       emiAmount = totalPayable / weeks;
//     } else if (emiType === "Monthly") {
//       const months = totalTenureMonths || Math.floor(totalTenureDays / 30) || 1;
//       emiAmount = totalPayable / months;
//     } else if (emiType === "Full Payment") {
//       emiAmount = totalPayable;
//     }

//     emiAmount = Math.round(emiAmount);

//     return {
//       uniqueLoanNumber: uuidv4(),
//       loanAmount: principal,
//       disbursedAmount,
//       interestRate: rate,
//       tenureDays: totalTenureDays,
//       tenureMonths: totalTenureMonths,
//       emiType,
//       emiAmount,
//       totalPayable,
//       totalCollected: 0,
//       totalAmountLeft,
//       startDate: start,
//       dueDate,
//       emiRecords: [],
//       status: "Ongoing",
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       createdBy: creatorId
//     };
//   });

//   const newClient = await Client.create({
//     clientName,
//     clientPhone,
//     clientAddress,
//     clientPhoto: clientpic?.url || "",
//     loans: processedLoans,
//     email,
//   });

//   return res.status(201).json(
//     new ApiResponse(201, { newClient }, "Client and loan(s) added successfully")
//   );
// });

export const AgentaddClient = asyncHandler(async (req, res) => {
  const {
    clientName,
    clientPhoneNumbers,
    temporaryAddress,
    permanentAddress,
    shopAddress,
    houseAddress,
    email,
    referalName,
    referalNumber,
  } = req.body;

  // ✅ Extract lat/lng from req.body and build location object
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;

  const location =
    latitude && longitude
      ? {
          lat: Number(latitude),
          lng: Number(longitude),
          address: `Lat: ${latitude}, Lng: ${longitude}`,
        }
      : null;

  let loans = [];
  if (req.body.loans) {
    try {
      loans =
        typeof req.body.loans === "string"
          ? JSON.parse(req.body.loans)
          : req.body.loans;
    } catch (error) {
      throw new ApiError(400, "Invalid format for loans");
    }
  }

  let googleMapsLink = "";
  if (latitude && longitude) {
    googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  const existingClient = await Client.findOne({
    $or: [{ clientPhoneNumbers }, { clientName }],
  });

  if (existingClient) {
    throw new ApiError(400, "Client already exists");
  }

  const clientpic = await uploadOnCloudinary(req.files?.clientPhoto?.[0]?.path);
  const shoppic = await uploadOnCloudinary(req.files?.shopPhoto?.[0]?.path);
  const housepic = await uploadOnCloudinary(req.files?.housePhoto?.[0]?.path);

  const documentFiles = req.files?.documents || [];
  const documentUrls = [];
  for (const file of documentFiles) {
    const uploaded = await uploadOnCloudinary(file.path);
    if (uploaded?.url) {
      documentUrls.push(uploaded.url);
    }
  }

  const creatorId = req.admin?._id || req.agent?._id;
  if (!creatorId) {
    throw new ApiError(401, "Missing creator information (admin or agent).");
  }

  const processedLoans = loans.map((loan) => {
    const {
      loanAmount,
      interestRate,
      tenureDays,
      tenureMonths,
      emiType,
      startDate = new Date(),
    } = loan;

    const principal = Number(loanAmount);
    const rate = Number(interestRate);
    const totalTenureDays = Number(tenureDays || 0);
    const totalTenureMonths = Number(tenureMonths || 0);
    const tenureInYears = totalTenureMonths
      ? totalTenureMonths / 12
      : totalTenureDays / 365;

    const interest = (principal * rate * tenureInYears) / 100;
    const totalPayable = principal + interest;
    const disbursedAmount = principal - interest;
    const totalAmountLeft = totalPayable;

    const start = new Date(startDate);
    const dueDate = new Date(
      start.getTime() + totalTenureDays * 24 * 60 * 60 * 1000
    );
    if (isNaN(dueDate.getTime())) {
      throw new ApiError(400, "Invalid due date calculated from tenure");
    }

    let emiAmount = 0;
    if (emiType === "Daily") {
      emiAmount = totalTenureDays ? totalPayable / totalTenureDays : totalPayable;
    } else if (emiType === "Weekly") {
      const weeks = Math.ceil(totalTenureDays / 7) || 1;
      emiAmount = totalPayable / weeks;
    } else if (emiType === "Monthly") {
      const months = totalTenureMonths || Math.floor(totalTenureDays / 30) || 1;
      emiAmount = totalPayable / months;
    } else if (emiType === "Full Payment") {
      emiAmount = totalPayable;
    }

    emiAmount = Math.round(emiAmount);

    return {
      uniqueLoanNumber: uuidv4(),
      loanAmount: principal,
      disbursedAmount,
      interestRate: rate,
      tenureDays: totalTenureDays,
      tenureMonths: totalTenureMonths,
      emiType,
      emiAmount,
      totalPayable,
      totalCollected: 0,
      totalAmountLeft,
      startDate: start,
      dueDate,
      emiRecords: [],
      status: "Ongoing",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: creatorId,
    };
  });

  const newClient = await Client.create({
    clientName,
    clientPhoneNumbers,
    temporaryAddress,
    permanentAddress,
    shopAddress,
    houseAddress,
    clientPhoto: clientpic?.url || "",
    shopPhoto: shoppic?.url || "",
    housePhoto: housepic?.url || "",
    documents: documentUrls,
    loans: processedLoans,
    email,
    referalName,
    referalNumber,
    googleMapsLink,
    location, // ✅ Location now saved correctly
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, { newClient }, "Client and loan(s) added successfully")
    );
});





export const AgentgetEmiCollectionData = asyncHandler(async (req, res) => {
  const { agentId } = req.params;  // agentId from the request params
  console.log("agentId", agentId);
  
  // Fetch clients who have any EMI records collected by the specified agent
  const clients = await Client.find({
    "loans.emiRecords.collectedBy": agentId,  // Ensure we check EMI records collected by this agent
  });

  if (!clients.length) throw new ApiError(404, "No EMI collection data found for this agent");

  const emiCollectionData = [];
  let totalCollected = 0;

  // Iterate through each client and their loans, and collect EMI data that matches the agentId
  clients.forEach(client => {
    client.loans.forEach(loan => {
      loan.emiRecords.forEach(emi => {
        // Check if the EMI was collected by the specified agent
        if (emi.collectedBy?.toString() === agentId) {
          emiCollectionData.push({
            clientName: client.clientName,
            loanNumber: loan.uniqueLoanNumber,
            amountCollected: emi.amountCollected,
            date: emi.date,
            status: emi.status,
            location: emi.location,
          });
          totalCollected += emi.amountCollected;  // Keep track of the total collected amount
        }
      });
    });
  });

  // Send response with total collected and EMI records collected by this agent
  res.status(200).json(
    new ApiResponse(200, {
      totalCollected,
      emiCollectionData,
    }, "EMI collection data retrieved successfully for the agent")
  );
});