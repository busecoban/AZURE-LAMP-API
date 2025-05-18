const sql = require("mssql");

const config = {
  user: "ibrahim@seniorprojectdb",
  password: "Passw0rd!",
  server: "seniorprojectdb.database.windows.net",
  database: "seniorprojectdb",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function updateDeviceStatus(deviceId, status) {
  try {
    const pool = await sql.connect(config);
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

async function getDeviceStatus(deviceId) {
  try {
    const pool = await sql.connect(config);
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
    console.error("❌ DB'den okuma hatası:", err.message);
    return null;
  }
}

module.exports = {
  updateDeviceStatus,
  getDeviceStatus,
};
