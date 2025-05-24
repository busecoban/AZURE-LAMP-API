const swaggerDocs = require("./swagger");

require("dotenv").config();
const express = require("express");
const { Client } = require("azure-iothub");
const { Message } = require("azure-iot-common");
const sql = require("mssql");

const app = express();
app.use(express.json());

// IoT & DB ayarları
const connectionString = process.env.IOTHUB_CONNECTION_STRING;
const targetDevice = process.env.DEVICE_ID;
const DEVICE_ID = 4;

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

const serviceClient = Client.fromConnectionString(connectionString);

// 🔄 Veritabanına yaz (yalnızca ON/OFF)
async function updateDeviceStatusInDb(status) {
  try {
    const pool = await sql.connect(sqlConfig);
    await pool
      .request()
      .input("deviceId", sql.Int, DEVICE_ID)
      .input("status", sql.Bit, status)
      .query("UPDATE Devices SET Status = @status WHERE Id = @deviceId");

    console.log("🗃️ DB güncellendi:", { deviceId: DEVICE_ID, status });
  } catch (err) {
    console.error("❌ DB güncellenemedi:", err.message);
  }
}

// 🔍 Veritabanından oku
async function getDeviceStatusFromDb() {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("deviceId", sql.Int, DEVICE_ID)
      .query("SELECT Status FROM Devices WHERE Id = @deviceId");

    if (result.recordset.length > 0) {
      return result.recordset[0].Status;
    } else {
      return null;
    }
  } catch (err) {
    console.error("❌ DB okuma hatası:", err.message);
    return null;
  }
}

/**
 * @swagger
 * /api/lamp:
 *   post:
 *     summary: Lamba cihazına komut gönderir (ON, OFF veya renk).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - command
 *             properties:
 *               command:
 *                 type: string
 *                 example: "ON"
 *     responses:
 *       200:
 *         description: Komut başarıyla gönderildi ve gerekiyorsa DB güncellendi.
 *       400:
 *         description: Geçersiz komut.
 *       500:
 *         description: IoT Hub'a komut gönderilemedi.
 */
app.post("/api/lamp", (req, res) => {
  const { command } = req.body;

  const isOnOff = command === "ON" || command === "OFF";
  const isHexColor = /^#[0-9A-Fa-f]{6}$/.test(command);

  if (!isOnOff && !isHexColor) {
    return res.status(400).json({ error: "Geçersiz komut" });
  }

  const message = new Message(command);
  message.ack = "full";
  message.messageId = Date.now().toString();

  serviceClient.send(targetDevice, message, async (err) => {
    if (err) {
      console.error("❌ IoT komut hatası:", err.message);
      return res.status(500).json({ error: "Komut gönderilemedi." });
    }

    console.log("✅ IoT'ye komut gönderildi:", command);

    if (isOnOff) {
      const newStatus = command === "ON" ? 1 : 0;
      await updateDeviceStatusInDb(newStatus);
      return res
        .status(200)
        .json({ message: `Komut ve DB güncellendi: ${command}` });
    }

    res.status(200).json({ message: `Renk komutu gönderildi: ${command}` });
  });
});

/**
 * @swagger
 * /api/lamp/status:
 *   get:
 *     summary: Lambanın açık mı kapalı mı olduğunu döner.
 *     responses:
 *       200:
 *         description: Cihaz durumu döner.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 1
 *       404:
 *         description: Cihaz bulunamadı.
 */
app.get("/api/lamp/status", async (req, res) => {
  const status = await getDeviceStatusFromDb();

  if (status === null) {
    return res.status(404).json({ error: "Cihaz bulunamadı" });
  }

  res.status(200).json({ status });
});

// 🌍 API Başlat
app.listen(3000, () => {
  swaggerDocs(app);
  console.log("✅ API çalışıyor: http://localhost:3000");
  console.log("📚 Swagger dokümantasyonu: http://localhost:3000/api-docs");
});
