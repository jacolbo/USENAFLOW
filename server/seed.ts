import { db } from "./db";
import { users, projects, projectNotes, ProjectStatus } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq, sql } from "drizzle-orm";

export async function seed() {
  console.log("Seeding database with sample data...");

  try {
    // Check if users table exists and has data
    const existingUsers = await db.select().from(users).limit(1);
    
    if (existingUsers.length === 0) {
      console.log("Creating initial users with secure passwords...");
      
      // Create users with hashed passwords
      const usersToCreate = [
        {
          username: "admin",
          password: await hashPassword("rEx-sPort-1996"), // User's requested admin password
          name: "Anesu's Pops",
          role: "Admin",
          abbreviation: "AP",
          mustChangePassword: false,
        },
        {
          username: "sales", 
          password: await hashPassword("TempPass123!"),
          name: "Sales",
          role: "Sales",
          abbreviation: "SAL",
          mustChangePassword: true,
        },
        {
          username: "workflow",
          password: await hashPassword("TempPass123!"),
          name: "Workflow Manager", 
          role: "LeadRetoucher",
          abbreviation: "WFM",
          mustChangePassword: true,
        },
        {
          username: "data",
          password: await hashPassword("TempPass123!"),
          name: "Data Wrangler",
          role: "DataWrangler", 
          abbreviation: "DW",
          mustChangePassword: true,
        },
        {
          username: "earl",
          password: await hashPassword("TempPass123!"),
          name: "Earl",
          role: "Retoucher",
          abbreviation: "EC",
          mustChangePassword: true,
        },
        {
          username: "asa", 
          password: await hashPassword("TempPass123!"),
          name: "Dr Asa",
          role: "Retoucher",
          abbreviation: "ASA",
          mustChangePassword: true,
        },
        {
          username: "lucky",
          password: await hashPassword("TempPass123!"),
          name: "Lucky",
          role: "Retoucher", 
          abbreviation: "LM",
          mustChangePassword: true,
        }
      ];

      await db.insert(users).values(usersToCreate);
      console.log("✅ Users created successfully");
    } else {
      console.log("Database already has data, skipping seed.");
    }

    // Check if projects need to be seeded
    const existingProjects = await db.select().from(projects).limit(1);
    
    if (existingProjects.length === 0) {
      console.log("Creating sample projects...");
      
      const sampleProjects = [
        {
          clientName: "Alice Johnson",
          packageCount: 10,
          selectedCount: 12,
          extras: 2,
          dueDate: new Date(2025, 7, 7), // Aug 7, 2025
          status: ProjectStatus.AWAITING_PAYMENT,
          invoicePaid: false,
          assignedTo: null,
          rating: null,
          deliveredAt: null,
        },
        {
          clientName: "Bob Smith",
          packageCount: 5,
          selectedCount: 5,
          extras: 0,
          dueDate: new Date(2025, 7, 9), // Aug 9, 2025
          status: ProjectStatus.READY_FOR_RETOUCHING,
          invoicePaid: true,
          assignedTo: null,
          rating: null,
          deliveredAt: null,
        },
        {
          clientName: "Carol Davis",
          packageCount: 8,
          selectedCount: 10,
          extras: 2,
          dueDate: new Date(2025, 7, 12), // Aug 12, 2025
          status: ProjectStatus.ASSIGNED,
          invoicePaid: true,
          assignedTo: "Earl",
          rating: null,
          deliveredAt: null,
        }
      ];

      await db.insert(projects).values(sampleProjects);
      console.log("✅ Sample projects created successfully");
    }

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}