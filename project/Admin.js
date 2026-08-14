// setupAdmin.js
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

async function createFirstAdmin() {
  try {
    const dataDir = path.join(__dirname, "data");
    const filePath = path.join(dataDir, "users.json");

    // 1. Agar data folder nahi hai, toh pehle wo banayega
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 2. Default credentials (Environment variables support ke sath)
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@smartsalon.com")
      .toLowerCase()
      .trim();
    const plainPassword = process.env.ADMIN_PASS || "admin123";

    let existingUsers = [];

    // 3. Purani file check karein taaki existing users wipe-out na hon
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        existingUsers = fileContent ? JSON.parse(fileContent) : [];
      } catch (err) {
        console.error(
          "Warning: Existing users.json corrupted or unreadable. Creating fresh backup.",
        );
        existingUsers = [];
      }
    }

    // 4. Check karein ki Admin account pehle se exist karta hai ya nahi
    const adminExists = existingUsers.some(
      (u) =>
        u.role === "admin" ||
        (u.email && u.email.toLowerCase().trim() === adminEmail),
    );

    if (adminExists) {
      console.log(
        "Admin account pehle se exist karta hai. No duplicate created.",
      );
      return;
    }
    // 5. Password ko encrypt (hash) karein
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const adminId = "admin_" + Date.now().toString();
    // 6. Admin ka data tayar karein
    const initialAdmin = {
      id: adminId,
      _id: adminId,
      name: "Salon Manager",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
      createdAt: new Date().toISOString(),
    };
    existingUsers.push(initialAdmin);
    // 7. Data ko users.json file mein save kar dein
    fs.writeFileSync(filePath, JSON.stringify(existingUsers, null, 2), "utf-8");
    console.log("Pehla Admin successfully create ho gaya!");
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${plainPassword}`);
    console.log(`Data saved in -> data/users.json`);
  } catch (error) {
    console.error("❌ Error during setupAdmin execution:", error);
  }
}
createFirstAdmin();
