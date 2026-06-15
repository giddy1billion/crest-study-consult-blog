import path from "node:path";
import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Load environment variables from .env
config();

export default defineConfig({
  schema: path.join(__dirname, "prisma/schema.prisma"),
});
