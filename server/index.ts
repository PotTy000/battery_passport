import cors from "cors";
import express from "express";
import {
  CONTRACT_ID,
  CONTRACT_FUNCTIONS,
  getContractRuntime,
  isValidStellarContractId,
} from "./services/contractService.js";

const app = express();
const port = Number(process.env.PORT || 8787);

type FeedbackRecord = {
  wallet: string;
  role: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type InteractionRecord = {
  wallet: string;
  action: string;
  txHash?: string;
  serial?: string;
  createdAt: string;
};

const feedback: FeedbackRecord[] = [];
const interactions: InteractionRecord[] = [];

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "battery-passport-level4-server",
    contractId: CONTRACT_ID,
    contractIdValid: isValidStellarContractId(CONTRACT_ID),
    checkedAt: new Date().toISOString(),
  });
});

app.get("/api/config", (_request, response) => {
  response.json(getContractRuntime());
});

app.get("/api/functions", (_request, response) => {
  response.json({
    functions: CONTRACT_FUNCTIONS,
  });
});

app.post("/api/feedback", (request, response) => {
  const body = request.body as Partial<FeedbackRecord>;

  const record: FeedbackRecord = {
    wallet: String(body.wallet || "anonymous"),
    role: String(body.role || "unknown"),
    rating: Number(body.rating || 0),
    comment: String(body.comment || ""),
    createdAt: new Date().toISOString(),
  };

  feedback.unshift(record);

  response.status(201).json({
    ok: true,
    record,
    totalFeedback: feedback.length,
  });
});

app.get("/api/feedback", (_request, response) => {
  response.json({
    total: feedback.length,
    feedback,
  });
});

app.post("/api/interactions", (request, response) => {
  const body = request.body as Partial<InteractionRecord>;

  const record: InteractionRecord = {
    wallet: String(body.wallet || "unknown"),
    action: String(body.action || "unknown"),
    txHash: body.txHash ? String(body.txHash) : undefined,
    serial: body.serial ? String(body.serial) : undefined,
    createdAt: new Date().toISOString(),
  };

  interactions.unshift(record);

  response.status(201).json({
    ok: true,
    record,
    totalInteractions: interactions.length,
    uniqueWallets: new Set(interactions.map((item) => item.wallet)).size,
  });
});

app.get("/api/interactions", (_request, response) => {
  response.json({
    total: interactions.length,
    uniqueWallets: new Set(interactions.map((item) => item.wallet)).size,
    interactions,
  });
});

app.listen(port, () => {
  console.log(`Battery Passport Level 4 server running on port ${port}`);
});