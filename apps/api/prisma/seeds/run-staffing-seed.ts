// Thin wrapper to run seedStaffingMasterData from outside src/ (avoids rootDir issue)
import { PrismaClient } from '@prisma/client';
import { seedStaffingMasterData } from './staffing-master-data.js';

const prisma = new PrismaClient();
await seedStaffingMasterData(prisma);
await prisma.$disconnect();
