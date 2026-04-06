const mongoose = require('mongoose');
require("dotenv").config();

exports.connect = () => {
    if (!process.env.DATABASE_URL) {
        console.error("Missing DATABASE_URL. Add it to backend/.env");
        process.exit(1);
    }

    mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log("Database Connection established successfully");
    })
    .catch((err) => {
        console.error("Database connection error:", err);
        if (err && err.codeName === "AtlasError" && err.code === 8000) {
            console.error("Atlas auth failed. Verify DATABASE_URL username/password and URL-encode special characters in password.");
        }
        console.log("Connection Issues with Database");
        process.exit(1);
    });
};