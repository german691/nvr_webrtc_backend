import "dotenv/config";

export const EDGE_HOST = process.env.EDGE_HOST || "192.168.1.101";
export const EDGE_PORT = process.env.EDGE_PORT || 22;
export const EDGE_USER = process.env.EDGE_USER || "root";
export const EDGE_PASS = process.env.EDGE_PASS || "tecno26";
export const API_PORT = process.env.API_PORT || process.env.PORT || 3000;
export const DEBUG_MODE = process.env.DEBUG_MODE === "true";

export const JWT_SECRET = process.env.JWT_SECRET || "4345ee152ce84f7292bf45cd58a6f99e211e67c9e9c4a02c79b6b0175dbe5765";

export const NVR_USERNAME = process.env.NVR_USERNAME || "tecnologia";
export const NVR_PASSWORD = process.env.NVR_PASSWORD || "Tecn02026+";

export const EDGE_CONFIG = {
  host: EDGE_HOST,
  port: parseInt(EDGE_PORT, 10),
  username: EDGE_USER,
  password: EDGE_PASS,
};

