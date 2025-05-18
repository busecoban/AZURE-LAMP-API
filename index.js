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

// 🔄 Veritabanına yaz
async function updateDeviceStatusInDb(deviceId, status) {
  try {
    const pool = await sql.connect(sqlConfig);
    await pool
      .request()
      .input("deviceId", sql.Int, deviceId)
      .input("status", sql.Bit, status)
      .query("UPDATE Devices SET Status = @status WHERE Id = @deviceId");

    console.log("🗃️ DB güncellendi:", { deviceId, status });
  } catch (err) {
    console.error("❌ DB güncellenemedi:", err.message);
  }
}

// 🔍 Veritabanından oku
async function getDeviceStatusFromDb(deviceId) {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("deviceId", sql.Int, deviceId)
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

// 🔌 Komut gönder + DB güncelle
app.post("/api/lamp", (req, res) => {
  const { command } = req.body;
  const deviceId = parseInt(req.query.deviceId || "1");

  if (!["ON", "OFF"].includes(command)) {
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

    const newStatus = command === "ON" ? 1 : 0;
    await updateDeviceStatusInDb(deviceId, newStatus);

    res.status(200).json({ message: `Komut ve DB güncellendi: ${command}` });
  });
});

// 📥 Durumu oku
app.get("/api/lamp/status", async (req, res) => {
  const deviceId = parseInt(req.query.deviceId || "1");
  const status = await getDeviceStatusFromDb(deviceId);

  if (status === null) {
    return res.status(404).json({ error: "Cihaz bulunamadı" });
  }

  res.status(200).json({ status });
});

// 🌍 Başlat
app.listen(3000, () => {
  console.log("✅ API çalışıyor: http://localhost:3000");
});
