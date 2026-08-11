import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  sparkplayPrisma?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.sparkplayPrisma) {
    globalForPrisma.sparkplayPrisma = new PrismaClient();
  }
  return globalForPrisma.sparkplayPrisma;
}
