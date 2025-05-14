import { Admin } from "../models/admin.model.js";
import { Agent } from "../models/agent.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import Client from "../models/client.loan.model.js";
import { DefaultedEMI } from "../models/client.loan.model.js";
import { Loan } from "../models/client.loan.model.js";
import { v4 as uuidv4 } from "uuid";
import twilio from "twilio";
import isSameDay from "date-fns/isSameDay";

const generateAccessAndRefrshToken = async (adminId) => {
  try {
    const admin = await Admin.findById(adminId);
    const accessToken = admin.generateAccessToken();
    const refreshToken = admin.generateRefreshToken();

    admin.refreshToken = refreshToken;
    await admin.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "SOMETHING went wrong while generating refresh and access token"
    );
  }
};

// Register Admin
export const registerAdmin = asyncHandler(async (req, res) => {
  const { username, email, password, profileImage } = req.body;
  // if (username || email || password === "") {
  //   throw new apiError(400 , "All Fields are required")
  // }
  if ([username, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All Fields are required");
  }
  const totalAdmins = await Admin.countDocuments();
  if (totalAdmins > 0) {
    throw new ApiError(403, "Admin already exists. Only one admin is allowed.");
  }
  const profileImagelocalpath = req.file?.path;
  const profile = await uploadOnCloudinary(profileImagelocalpath);

  const admin = await Admin.create({
    username: username.toLowerCase(),
    email,
    password,
    profileImage: profile?.url || "",
  });
  const createdAdmin = await Admin.findById(admin._id).select(
    "-password -refreshToken"
  );
  if (!createdAdmin) {
    throw new ApiError(500, "SOMETHING went wrong while registering user");
  }
  return res
    .status(201)
    .json(new ApiResponse(201, "Admin created successfully", createdAdmin));
});

// Login Admin
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if ((!email && !username) || !password) {
    throw new ApiError(400, "Email/Username and Password are required");
  }
  const admin = await Admin.findOne({
    $or: [{ username }, { email }],
  });

  if (!admin) {
    throw new ApiError(404, "Admin does not exist");
  }
  const isMatch = await admin.isPasswordCorrect(password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefrshToken(
    admin._id
  );

  const loggedinAdmin = await Admin.findById(admin._id).select(
    "-password -refreshToken"
  );

  // cookies only modifiable from server when  we do httpOnly: true, secure: true
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
        { admin: loggedinAdmin, accessToken, refreshToken }, // here we are handeling the case where admin wants to set his cokkies him self in his local system may be he wants to login from another device
        "Admin logged in successfully"
      )
    );
});

// logout admin
export const logoutAdmin = asyncHandler(async (req, res) => {
  await Admin.findByIdAndUpdate(
    req.admin._id,
    {
      $set: {
        refreshToken: undefined, // removing refresh token from database
      },
    },
    {
      new: true,
    }
  );
  //clear cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "Admin logged out successfully"));
});

// Add Agent
export const addAgent = asyncHandler(async (req, res) => {
  const { fullname, email, agentusername, password, fathername, photo } =
    req.body;
  if (
    [fullname, email, agentusername, password].some(
      (field) => field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All Fields are required");
  }

  // check if agent already exists
  const agentExist = await Agent.findOne({ agentusername });
  if (agentExist) {
    throw new ApiError(400, "Agent already exists");
  }

  // agent photo
  const agentProfile = await uploadOnCloudinary(req.file?.path);

  const newAgent = await Agent.create({
    fullname,
    email,
    agentusername,
    password,
    fathername,
    photo: agentProfile?.url || "",
  });

  const createdAgent = await Agent.findById(newAgent._id).select(
    "-password -refreshToken"
  );
  if (!createdAgent) {
    throw new ApiError(500, "SOMETHING went wrong while registering user");
  }
  return res
    .status(201)
    .json(new ApiResponse(201, "Agent created successfully", createdAgent));
});

//remove agent
export const removeAgent = asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new ApiError(404, "Agent not found");
  }
  agent.refreshtoken = undefined;
  await agent.save({ validateBeforeSave: false });
  const deletedAgent = await Agent.findByIdAndDelete(agentId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Agent removed successfully"));
});

//show all agent list
export const agentList = asyncHandler(async (req, res) => {
  const agents = await Agent.find();
  return res.status(200).json(new ApiResponse(200, agents, "Agent list"));
});

// add a client
export const addClient = asyncHandler(async (req, res) => {
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
      emiAmount = totalTenureDays
        ? totalPayable / totalTenureDays
        : totalPayable;
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
      new ApiResponse(
        201,
        { newClient },
        "Client and loan(s) added successfully"
      )
    );
});

// update client details
export const updatedClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const {
    clientName,
    clientPhone,
    temporaryAddress,
    permanentAddress,
    shopAddress,
    houseAddress,
    email,
  } = req.body;

  const updatedClient = await Client.findByIdAndUpdate(
    clientId,
    {
      clientName,
      clientPhone,
      temporaryAddress,
      permanentAddress,
      shopAddress,
      houseAddress,
      email,
    },
    { new: true }
  );

  if (!updatedClient) {
    throw new ApiError(404, "Client not found or could not be updated");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedClient, "Client updated successfully"));
});

//remove a client


export const removeClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  const client = await Client.findById(clientId);
  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  // Delete all defaulted EMIs related to this client
  await DefaultedEMI.deleteMany({ clientId });

  // Now delete the client
  await Client.findByIdAndDelete(clientId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Client and related Defaulted EMIs removed successfully"));
});



// export const removeClient = asyncHandler(async (req, res) => {
//   const { clientId } = req.params;

//   const client = await Client.findById(clientId);
//   if (!client) {
//     throw new ApiError(404, "Client not found");
//   }

//   await Client.findByIdAndDelete(clientId);

//   return res
//     .status(200)
//     .json(new ApiResponse(200, {}, "Client removed successfully"));
// });

// get a agent details



export const agentDetails = asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new ApiError(404, "Agent not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, agent, "Agent details fetched successfully"));
});

// show all clients
export const clientList = asyncHandler(async (req, res) => {
  const clients = await Client.find();
  return res.status(200).json(new ApiResponse(200, clients, "client list"));
});

// particular loan details
export const loanDetails = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  const client = await Client.findOne({ "loans._id": loanId });
  if (!client) throw new ApiError(404, "Loan not found");

  const loan = client.loans.id(loanId);
  if (!loan) throw new ApiError(404, "Loan not found");

  const rawLoan = loan.toObject();
  rawLoan.clientId = client._id;
  // ✅ Always recalculate interest from principal and rate
  const interest = (rawLoan.loanAmount * rawLoan.interestRate) / 100;
  rawLoan.totalInterest = Math.round(interest);
  rawLoan.totalRepayment = rawLoan.loanAmount + rawLoan.totalInterest;

  // 💰 Payments
  rawLoan.amountPaid = rawLoan.totalCollected;
  rawLoan.emisPaid = rawLoan.emiRecords.length || 0;
  rawLoan.endDate = rawLoan.dueDate;
  rawLoan.clientName = client.clientName;

  // 📅 Next EMI Date
  let nextEmiDate = null;
  const paidEmis = rawLoan.emiRecords.length;
  const startDate = new Date(rawLoan.startDate);

  if (rawLoan.emiType === "Daily") {
    nextEmiDate = new Date(
      startDate.getTime() + (paidEmis + 1) * 24 * 60 * 60 * 1000
    );
  } else if (rawLoan.emiType === "Weekly") {
    nextEmiDate = new Date(
      startDate.getTime() + (paidEmis + 1) * 7 * 24 * 60 * 60 * 1000
    );
  } else if (rawLoan.emiType === "Monthly") {
    const next = new Date(startDate);
    next.setMonth(next.getMonth() + paidEmis + 1);
    nextEmiDate = next;
  }

  rawLoan.nextEmiDate = nextEmiDate;

  // 👤 Creator Info
  let createdByUser = await Admin.findById(loan.createdBy).select("username");
  if (!createdByUser) {
    createdByUser = await Agent.findById(loan.createdBy).select("fullname");
  }

  rawLoan.createdByName =
    createdByUser?.fullname || createdByUser?.username || "Unknown";
  rawLoan.createdById = createdByUser?._id || loan.createdBy;

  return res
    .status(200)
    .json(new ApiResponse(200, rawLoan, "Loan details fetched successfully"));
});

//show client details with all details
export const clientDetails = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const client = await Client.findById(clientId).populate("loans");
  return res
    .status(200)
    .json(new ApiResponse(200, client, "client details fetched successfully"));
});

// fetch all loans
export const loanList = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  if (!clientId) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Client ID is required"));
  }

  const client = await Client.findById(clientId);

  if (!client) {
    return res.status(404).json(new ApiResponse(404, null, "Client not found"));
  }

  // Now send client's loans array
  return res
    .status(200)
    .json(
      new ApiResponse(200, client.loans, "Client loans fetched successfully")
    );
});

//add new loan object to the client array to client
export const addLoanToClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { loans } = req.body;

  if (!Array.isArray(loans) || loans.length === 0) {
    throw new ApiError(400, "No loan data provided");
  }

  const client = await Client.findById(clientId);
  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  // ✅ Determine the creator (admin or agent)
  const creatorId = req.admin?._id || req.agent?._id;
  if (!creatorId) {
    throw new ApiError(401, "Unauthorized: Creator information missing");
  }

  for (const loanData of loans) {
    const {
      loanAmount,
      interestRate,
      tenureDays,
      tenureMonths,
      emiType,
      startDate: rawStartDate,
    } = loanData;

    const start = rawStartDate ? new Date(rawStartDate) : new Date();
    let dueDate;

    if (tenureDays) {
      dueDate = new Date(
        start.getTime() + Number(tenureDays) * 24 * 60 * 60 * 1000
      );
    } else if (tenureMonths) {
      dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + Number(tenureMonths));
    } else {
      throw new ApiError(
        400,
        "Either tenureDays or tenureMonths must be provided"
      );
    }

    const interest = (loanAmount * interestRate) / 100;
    const disbursedAmount = loanAmount - interest;

    let emiAmount = 0;
    if (emiType === "Daily" && tenureDays) {
      emiAmount = Math.round(loanAmount / tenureDays);
    } else if (emiType === "Weekly" && tenureDays) {
      const weeks = Math.ceil(tenureDays / 7);
      emiAmount = Math.round(loanAmount / weeks);
    } else if (emiType === "Monthly" && tenureMonths) {
      emiAmount = Math.round(loanAmount / tenureMonths);
    } else if (emiType === "Full Payment") {
      emiAmount = loanAmount;
    } else {
      throw new ApiError(400, "Invalid EMI Type");
    }

    // ✅ Build new loan with createdBy
    const newLoan = {
      uniqueLoanNumber: uuidv4(),
      loanAmount,
      disbursedAmount,
      interestRate,
      tenureDays: tenureDays || null,
      tenureMonths: tenureMonths || null,
      emiType,
      emiAmount,
      totalPayable: loanAmount,
      totalCollected: 0,
      totalAmountLeft: loanAmount,
      startDate: start,
      dueDate,
      emiRecords: [],
      status: "Ongoing",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: creatorId, // ✅ Required field
    };

    client.loans.push(newLoan);
  }

  await client.save();

  return res
    .status(201)
    .json(new ApiResponse(201, client, "Loan(s) added successfully"));
});

//remove loan once completed
export const removeLoanFromClient = asyncHandler(async (req, res) => {
  const { clientId, loanId } = req.params;
  console.log(clientId, loanId);

  const client = await Client.findById(clientId);
  const loanExists = client.loans.id(loanId);


  

  if (!loanExists) {
    throw new ApiError(404, "Loan not found");
  }

  if (!client) {
    throw new ApiError(404, "Client not found");
  }
  await DefaultedEMI.deleteMany({ loanId });
  client.loans.pull(loanId);
  await client.save();
  return res
    .status(200)
    .json(
      new ApiResponse(200, client, "Loan removed from client successfully")
    );
});

// get analatics admin view
export const getAdminDashboardAnalytics = asyncHandler(async (req, res) => {
  const clients = await Client.find();

  let totalLoanDisbursed = 0;
  let totalAmountRecovered = 0;
  let totalAmountRemaining = 0;
  let totalEmisCollected = 0;
  let defaulterCount = 0;

  clients.forEach((client) => {
    client.loans.forEach((loan) => {
      totalLoanDisbursed += loan.loanAmount;
      totalAmountRemaining += loan.totalAmountLeft;

      loan.emiRecords.forEach((emi) => {
        totalEmisCollected += 1;

        if (emi.status === "Paid") {
          totalAmountRecovered += emi.amountCollected;
        } else if (emi.status === "Defaulted") {
          defaulterCount += 1;
        }
      });
    });
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalLoanDisbursed,
        totalAmountRecovered,
        totalAmountRemaining,
        totalEmisCollected,
        defaulterCount,
      },
      "Admin dashboard analytics fetched successfully"
    )
  );
});

//emi collection api and send message on wats app with current location of agent where he/she collected emi
const clientTwilio = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_FROM;
const toAdminNumber = process.env.ADMIN_WHATSAPP_TO;
export const collectEMI = asyncHandler(async (req, res) => {
  const { clientId, loanId } = req.params;
  const { amountCollected, status, location, paymentMode, recieverName } =
    req.body;
  const adminId = req.admin._id;

  // console.log("🔁 collectEMI params:", req.params);
  // console.log("📦 collectEMI body:", req.body);

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
  console.log("normalizedStatus", normalizedStatus);

  // Push individual EMI records
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
        status: normalizedStatus,
        collectedBy: adminId,
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
        recordedBy: adminId,
        reason: "Marked Default", // optionally add more info
      });
      await defaultedEmi.save();
    }

    console.log("hi");

    // ✅ If Defaulted, also log in loan.defaultedEmis
    //  if (normalizedStatus === "Defaulted") {

    // }
  }

  // Total collected and remaining
  if (status !== "Defaulted") {
    loan.totalCollected += amountCollected;
  }
  
  loan.totalAmountLeft = loan.totalPayable - loan.totalCollected;
  loan.updatedAt = new Date();

  // ✅ Recalculate paid EMIs
  loan.paidEmis = loan.emiRecords.filter((e) => e.status === "Paid").length;

  // ✅ Update next EMI date
  if (numberOfEmisPaid > 0) {
    let baseDate = loan.nextEmiDate
      ? new Date(loan.nextEmiDate)
      : new Date(loan.startDate);

    if (loan.emiType === "Daily") {
      baseDate.setDate(baseDate.getDate() + numberOfEmisPaid);
    } else if (loan.emiType === "Weekly") {
      baseDate.setDate(baseDate.getDate() + numberOfEmisPaid * 7);
    } else if (loan.emiType === "Monthly") {
      baseDate.setMonth(baseDate.getMonth() + numberOfEmisPaid);
    }

    loan.nextEmiDate = baseDate;
  }

  // Total EMIs & Interest
  loan.totalEmis = loan.tenureMonths ?? loan.tenureDays ?? 0;
  loan.totalInterest = loan.totalPayable - loan.loanAmount;
  loan.totalRepayment = loan.totalPayable;

  client.markModified("loans");
  await client.save();

  const updatedLoan = client.loans.id(loanId);
  const admin = await Admin.findById(adminId);

  // 📲 WhatsApp Notification
  if (normalizedStatus === "Defaulted") {
    const messageBody = `⚠️ *EMI Default Alert!*\n\n📛 *Client:* ${client.clientName}\n💰 *Amount Due:* ₹${amountCollected}\n🕒 *Recorded At:* ${today.toLocaleString()}\n👨‍💼 *Updated By:* ${admin.username}\n\n🚨 Please take necessary action.`;

    await clientTwilio.messages.create({
      from: fromWhatsAppNumber,
      to: toAdminNumber,
      body: messageBody,
    });
  } else {
    const [lng, lat] = location.coordinates;
    const googleMapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    const messageBody = `📢 *EMI Collected!*\n👤 *Client:* ${client.clientName}\n💸 *Amount:* ₹${amountCollected}\n🕒 *Time:* ${today.toLocaleString()}\n📍 *Location:* ${googleMapsLink}\n🙋‍♂️ *Collected By:* ${admin.username}\n💳 *Payment Mode:* ${paymentMode}`;

    await clientTwilio.messages.create({
      from: fromWhatsAppNumber,
      to: toAdminNumber,
      body: messageBody,
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedLoan,
        "EMI collected and recorded successfully"
      )
    );
});

//view emi collection history
export const viewEmiCollectionHistory = asyncHandler(async (req, res) => {
  const { clientId, loanId } = req.params;
  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const loan = client.loans.id(loanId);
  if (!loan) throw new ApiError(404, "Loan not found");

  if (!loan.emiRecords || loan.emiRecords.length === 0) {
    throw new ApiError(404, "No EMI collection history found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        loan.emiRecords,
        "EMI collection history retrieved successfully"
      )
    );
});

// get emi collection data of particular agent
export const getEmiCollectionData = asyncHandler(async (req, res) => {
  const { agentId } = req.params; // agentId from the request params

  // Fetch clients who have any EMI records collected by the specified agent
  const clients = await Client.find({
    "loans.emiRecords.collectedBy": agentId, // Ensure we check EMI records collected by this agent
  });

  if (!clients.length)
    throw new ApiError(404, "No EMI collection data found for this agent");

  const emiCollectionData = [];
  let totalCollected = 0;

  // Iterate through each client and their loans, and collect EMI data that matches the agentId
  clients.forEach((client) => {
    client.loans.forEach((loan) => {
      loan.emiRecords.forEach((emi) => {
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
          totalCollected += emi.amountCollected; // Keep track of the total collected amount
        }
      });
    });
  });

  // Send response with total collected and EMI records collected by this agent
  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalCollected,
        emiCollectionData,
      },
      "EMI collection data retrieved successfully for the agent"
    )
  );
});

// loan status
export const updateLoanStatus = asyncHandler(async (req, res) => {
  const allowedStatuses = ["Ongoing", "Completed"];
  const { clientId, loanId } = req.params;
  const newstatus = req.body.newstatus || req.body.status;

  if (!allowedStatuses.includes(newstatus))
    throw new ApiError(400, "Invalid status value");

  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const loan = client.loans.id(loanId);
  if (!loan) throw new ApiError(404, "Loan not found");

  loan.status = newstatus;

  await client.save(); // Save the parent document

  res
    .status(200)
    .json(new ApiResponse(200, loan, "Loan status updated successfully"));
});

export const TodayCollection = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of the day

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Fetch client data with today's EMI records
  const clients = await Client.find({
    "loans.emiRecords.date": {
      $gte: today,
      $lt: tomorrow,
    },
  }).populate({
    path: "loans.emiRecords.collectedBy",
    model: "Agent",
    select: "fullname",
  });
  const todayCollections = [];

  for (const client of clients) {
    for (const loan of client.loans) {
      for (const emi of loan.emiRecords) {
        // Check if the EMI was collected today
        const emiDate = new Date(emi.date);
        if (emiDate >= today && emiDate < tomorrow) {
          // Find the agent who collected this EMI
          let agentName = "Admin";
          if (emi.collectedBy) {
            agentName = emi.collectedBy.fullname;
          }

          // Add formatted collection data
          todayCollections.push({
            clientName: client.clientName,
            loanNumber: loan.uniqueLoanNumber,
            amountCollected: emi.amountCollected,
            status: emi.status,
            paymentMode: emi.paymentMode,
            agentName: agentName,
            date: emi.date,
            location: emi.location,
            recieverName: emi?.recieverName || "Cash Payment",
          });
        }
      }
    }
  }

  todayCollections.sort((a, b) => new Date(b.date) - new Date(a.date));
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        todayCollections,
        "Today's collection data retrieved successfully"
      )
    );
});

// get default emi data

export const getDefaultEmi = asyncHandler(async (req, res) => {
  const defaultEmis = await DefaultedEMI.find();
    
  const defaultedClientsMap = defaultEmis.reduce((acc, emi) => {
    acc[emi.clientId.toString()] = true;
    return acc;
  }, {});

  res.status(200).json(new ApiResponse(
    200,
    defaultedClientsMap,
    "All defaulted client EMIs fetched successfully"
  ));
});



// get default emi by id of client 

export const getDefaultEmiById = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  const defaultEmis = await DefaultedEMI.find({ clientId })
  .populate("clientId", "clientName");
  
  res.status(200).json(new ApiResponse(
    200,
    defaultEmis,
    "All defaulted client EMIs fetched successfully"
  ));
});



// pay default emi

export const payDefaultEmi = asyncHandler(async (req, res) => {
  const { clientId, loanId } = req.params;
  const {
    emiId,
    amountCollected,
    collectedBy,
    paymentMode,
    recieverName,
    location,
  } = req.body;

  const collectedAmount = Number(amountCollected);
  if (isNaN(collectedAmount) || collectedAmount < 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  const client = await Client.findById(clientId);
  if (!client) return res.status(404).json({ message: "Client not found" });

  const loan = client.loans.id(loanId);
  if (!loan) return res.status(404).json({ message: "Loan not found" });

  const validatedEmi = loan.emiRecords.create({
    date: new Date(),
    amountCollected: collectedAmount,
    status: "Paid",
    collectedBy,
    paymentMode,
    recieverName,
    location,
  });

  loan.emiRecords.push(validatedEmi);

  loan.totalCollected += collectedAmount;
  loan.totalAmountLeft = Math.max(0, loan.totalAmountLeft - collectedAmount);
  loan.paidEmis += 1;
  loan.updatedAt = new Date();

  await DefaultedEMI.findByIdAndDelete(emiId);
  await client.save();

  res
    .status(200)
    .json(new ApiResponse(200, loan, "Default EMI paid successfully"));
});
