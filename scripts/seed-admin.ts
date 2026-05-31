import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? "系统管理员";

  if (password === "ChangeMe123!") {
    console.warn("ADMIN_PASSWORD is using the default value. Change it before real deployment.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE"
    },
    create: {
      username,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE"
    }
  });

  await prisma.adminProfile.upsert({
    where: { userId: user.id },
    update: { displayName },
    create: {
      userId: user.id,
      displayName
    }
  });

  console.log(`Seeded admin account: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
