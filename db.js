const sql = require("mssql");
const config = {
  user: "busecoban",
  password: "Buse.485607",
  server: "homeautomation-server.database.windows.net",
  database: "HomeAutomation-db",
  options: { encrypt: true, trustServerCertificate: false },
};
const DEVICE_ID = 4;
async function updateDeviceStatus(status) {
  const pool = await sql.connect(config);
  await pool
    .request()
    .input("deviceId", sql.Int, DEVICE_ID)
    .input("status", sql.Bit, status)
    .query("UPDATE Devices SET Status = @status WHERE Id = @deviceId");
}
async function getDeviceStatus() {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("deviceId", sql.Int, DEVICE_ID)
    .query("SELECT Status FROM Devices WHERE Id = @deviceId");
  return result.recordset.length ? result.recordset[0].Status : null;
}
module.exports = { updateDeviceStatus, getDeviceStatus };
