require("dotenv").config();
const express = require("express");
const { Client } = require("azure-iothub");
const { Message } = require("azure-iot-common");

const app = express();
app.use(express.json());

// 🔐 Azure IoT Hub bağlantısı
const connectionString = process.env.IOTHUB_CONNECTION_STRING;
const targetDevice = process.env.DEVICE_ID;

const serviceClient = Client.fromConnectionString(connectionString);

// 🔌 API: /api/lamp
app.post("/api/lamp", async (req, res) => {
  const { command } = req.body;

  if (!["ON", "OFF", "STATUS"].includes(command)) {
    return res
      .status(400)
      .send("❌ Geçersiz komut. Sadece ON / OFF / STATUS gönderilebilir.");
  }

  const message = new Message(command);
  message.ack = "full";
  message.messageId = Date.now().toString();

  serviceClient.open((err) => {
    if (err) {
      console.error("❌ MQTT bağlantısı kurulamadı:", err.message);
      return res.status(500).send("Azure bağlantı hatası");
    }

    serviceClient.send(targetDevice, message, (err) => {
      if (err) {
        console.error("❌ Komut gönderilemedi:", err.toString());
        return res.status(500).send("Komut gönderilemedi");
      }

      console.log("✅ Komut gönderildi:", command);
      res.send(`Komut gönderildi: ${command}`);
    });
  });
});

// 🌍 Sunucuyu dış IP'den erişilebilir başlat (React Native için önemli!)
app.listen(3000, "0.0.0.0", () => {
  console.log("✅ API çalışıyor: http://192.168.1.102:3000");
});
