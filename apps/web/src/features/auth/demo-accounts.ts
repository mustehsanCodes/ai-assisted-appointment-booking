export const DEMO_ACCOUNTS = [
  {
    role: "USER" as const,
    label: "Demo user",
    description: "Book consultations & chat",
    email: "demo@example.com",
    password: "DemoPassword123!",
  },
  {
    role: "ADMIN" as const,
    label: "Administrator",
    description: "Operations overview",
    email: "admin@example.com",
    password: "DemoPassword123!",
  },
] as const;
