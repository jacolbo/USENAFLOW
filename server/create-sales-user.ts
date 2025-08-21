import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function createSalesUser() {
  console.log("🔑 Creating Sales user account...");
  
  try {
    // Check if Sales user already exists
    const existingSalesUser = await db.select().from(users).where(eq(users.username, "Sales"));
    
    if (existingSalesUser.length > 0) {
      console.log("✅ Sales user already exists:");
      console.log(`   Username: ${existingSalesUser[0].username}`);
      console.log(`   ID: ${existingSalesUser[0].id}`);
      return existingSalesUser[0];
    }
    
    // Create the Sales user
    const salesPassword = "Sales2025!";
    console.log("📝 Creating new Sales user with credentials:");
    console.log(`   Username: Sales`);
    console.log(`   Password: ${salesPassword}`);
    
    const [newSalesUser] = await db
      .insert(users)
      .values({
        username: "Sales",
        password: salesPassword,
      })
      .returning();
    
    console.log("✅ Sales user created successfully:");
    console.log(`   ID: ${newSalesUser.id}`);
    console.log(`   Username: ${newSalesUser.username}`);
    console.log(`   Password: ${salesPassword}`);
    
    // Log this creation to a file for record keeping
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: "SALES_USER_CREATED",
      userId: newSalesUser.id,
      username: newSalesUser.username,
      password: salesPassword,
      createdBy: "system",
    };
    
    console.log("📋 Sales Account Details:");
    console.log("========================");
    console.log(`Username: Sales`);
    console.log(`Password: ${salesPassword}`);
    console.log(`User ID: ${newSalesUser.id}`);
    console.log(`Created: ${logEntry.timestamp}`);
    console.log("========================");
    
    return newSalesUser;
    
  } catch (error) {
    console.error("❌ Error creating Sales user:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSalesUser()
    .then(() => {
      console.log("🎉 Sales user setup completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed to create Sales user:", error);
      process.exit(1);
    });
}

export { createSalesUser };