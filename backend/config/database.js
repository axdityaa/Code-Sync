const mongoose = require('mongoose');
require("dotenv").config();

const RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 10000);

exports.connect = () => {
    if (!process.env.DATABASE_URL) {
        console.error("Missing DATABASE_URL. Add it to backend/.env");
        return;
    }

    mongoose.connect(process.env.DATABASE_URL, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
    })
    .then(() => {
        console.log("Database Connection established successfully");
    })
    .catch((err) => {
        console.error("Database connection error:", err);
        if (err && err.codeName === "AtlasError" && err.code === 8000) {
            console.error("Atlas auth failed. Verify DATABASE_URL username/password and URL-encode special characters in password.");
        }
        console.log("Connection Issues with Database");

        // Keep API alive and retry DB connection in the background.
        setTimeout(() => {
            console.log(`Retrying database connection in ${RETRY_DELAY_MS / 1000}s...`);
            exports.connect();
        }, RETRY_DELAY_MS);
    });
};