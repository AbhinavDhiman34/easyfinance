import { Router } from "express";
import {
  agentLogin,
  agentLogout,
  AgentcollectEMI,
  AgentaddClient,
  searchClients,
  AgentgetEmiCollectionData
} from "../controllers/agent.controller.js";
import{
  clientList,
  clientDetails,
  loanList,
  
}from "../controllers/admin.controller.js"
import { verifyAgentJwt } from "../middlewares/agentAuth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";



const agentRoute = Router();
agentRoute.route("/login").post(agentLogin);



//secuted routes for agents
agentRoute.route("/logout").post(verifyAgentJwt , agentLogout);
agentRoute.route("/allclients").get(verifyAgentJwt , clientList)  


agentRoute.route("/collectemi/:clientId/:loanId").post(verifyAgentJwt,AgentcollectEMI); 



agentRoute.route("/addclient").post(upload.fields([
  { name: "clientPhoto", maxCount: 1 },
  { name: "shopPhoto", maxCount: 1 },
  { name: "housePhoto", maxCount: 1 },
  { name: "documents", maxCount: 10 },
]), verifyAgentJwt, AgentaddClient) 




agentRoute.route("/getClientdata/:clientId").get(verifyAgentJwt , clientDetails) 



agentRoute.route("/viewclientloan/:clientId/loans").get( loanList) 


agentRoute.route("/search-clients").get(verifyAgentJwt, searchClients);


agentRoute.route("/getEmiCollection/:agentId").get(verifyAgentJwt , AgentgetEmiCollectionData);


export default agentRoute




