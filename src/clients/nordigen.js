import NordigenClient from 'nordigen-node';
import * as process from 'process';
import dotenv from "dotenv";

dotenv.config();

export const client = new NordigenClient({
  secretId: process.env.SECRET_ID,
  secretKey: process.env.SECRET_KEY,
});
