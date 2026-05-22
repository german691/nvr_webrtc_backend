import "dotenv/config";

export const EDGE_HOST = process.env.EDGE_HOST || "192.168.1.101";
export const EDGE_PORT = process.env.EDGE_PORT || 22;
export const EDGE_USER = process.env.EDGE_USER || "root";
export const EDGE_PASS = process.env.EDGE_PASS || "tecno26";
export const API_PORT = process.env.API_PORT || 3000;

export const EDGE_CONFIG = {
  host: EDGE_HOST,
  port: parseInt(EDGE_PORT, 10),
  username: EDGE_USER,
  password: EDGE_PASS,
};
