import express from "express";
import cors from "cors";
import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import { connectDb } from "./config/db.config.js";
import authRoutes from "./routes/auth.routes.js";


const PORT = process.env.PORT || 5000;

const app = express();

// middlewares
app.use(cors());
app.use(express.json());



// db

connectDb();


// routes
app.get("/", (req, res) => {
    res.send("api is working");
});

app.use("/api/auth", authRoutes);


const server = http.createServer(app);
server.on("error", (error) => {
    if(error.code === "EADDRINUSE"){
        console.error(`PORT ${PORT} is already in use`);
        process.exit(1);
    }

    throw error;
});

server.listen(PORT, () => {
    console.log(`server started on http://localhost:${PORT}`);
});