import { db } from "./db";
import { projects, ProjectStatus } from "@shared/schema";

async function seed() {
  console.log("Seeding database with sample data...");

  // Check if projects already exist
  const existingProjects = await db.select().from(projects);
  if (existingProjects.length > 0) {
    console.log("Database already has data, skipping seed.");
    return;
  }

  // Helper function to ensure dates are in valid range
  const ensureValidDate = (date: Date) => {
    if (date.getFullYear() < 2024) {
      date.setFullYear(2024);
    }
    return date;
  };

  // Insert sample projects with valid dates
  const sampleProjects = [
    {
      clientName: "Alice",
      packageCount: 10,
      selectedCount: 12,
      extras: 2,
      dueDate: ensureValidDate(new Date(2025, 7, 7)), // Aug 7, 2025
      status: ProjectStatus.AWAITING_PAYMENT,
      invoicePaid: false,
      assignedTo: null,
      rating: null,
    },
    {
      clientName: "Bob",
      packageCount: 5,
      selectedCount: 5,
      extras: 0,
      dueDate: ensureValidDate(new Date(2025, 7, 9)), // Aug 9, 2025
      status: ProjectStatus.READY_FOR_RETOUCHING,
      invoicePaid: true,
      assignedTo: null,
      rating: null,
    },
    {
      clientName: "Charlie",
      packageCount: 8,
      selectedCount: 8,
      extras: 0,
      dueDate: ensureValidDate(new Date(2025, 7, 5)), // Aug 5, 2025
      status: ProjectStatus.REVIEW,
      invoicePaid: true,
      assignedTo: "Lucky",
      rating: null,
    },
    {
      clientName: "Daisy",
      packageCount: 7,
      selectedCount: 10,
      extras: 3,
      dueDate: ensureValidDate(new Date(2025, 7, 2)), // Aug 2, 2025
      status: ProjectStatus.DELIVERED,
      invoicePaid: true,
      assignedTo: "Earl",
      rating: 5,
    },
    {
      clientName: "Eve",
      packageCount: 4,
      selectedCount: 4,
      extras: 0,
      dueDate: ensureValidDate(new Date(2025, 7, 8)), // Aug 8, 2025
      status: ProjectStatus.ASSIGNED,
      invoicePaid: true,
      assignedTo: "Dr Asa",
      rating: null,
    },
  ];

  await db.insert(projects).values(sampleProjects);
  console.log("Database seeded successfully!");
}

// Run seed function if called directly
seed().catch(console.error);

export { seed };