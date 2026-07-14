import express from "express";
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose";
import multer from "multer";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import Project from "./models/Project.js";
import axios from "axios";
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { createServer } from "http";
import { Server } from "socket.io";


dotenv.config();
const PORT=process.env.PORT||3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB!"))
  .catch((err) => console.error("MongoDB connection error:", err));


const app = express();
const httpServer = createServer(app);
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(httpServer, {
    cors: { origin: allowedOrigin, credentials: true }
});

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.on("subscribe", (userId) => {
        console.log(`Socket ${socket.id} subscribed to room ${userId}`);
        socket.join(userId);
    });
    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
    });
});

// Fix #2: Lock CORS to specific frontend origin
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

// Fix #3: 50MB upload size limit + only accept zip files
const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
            cb(null, true);
        } else {
            cb(new Error("Only .zip files are allowed"), false);
        }
    }
})

app.post("/api/upload", ClerkExpressRequireAuth(), upload.single("repo"), async(req,res)=>{
    try{
        if(!req.file)return res.status(400).json({error:"No zip file uploaded"});
        const projectId=crypto.randomUUID();
        const zipPath=req.file.path;

        const extractFolderPath=path.join(process.cwd(),"uploads",projectId);
        fs.mkdirSync(extractFolderPath,{recursive:true});

        const zip=new AdmZip(zipPath);
        zip.extractAllTo(extractFolderPath,true);

        const fileCount=zip.getEntries().length;

        fs.unlinkSync(zipPath);

        const project=new Project({
            name:req.file.originalname.replace(".zip",""),
            project_id:projectId,
            status:"processing",
            file_count:fileCount,
            userId: req.auth.userId
        });

        await project.save();
        // Fix #7: Use env var for engine URL
        const engineUrl = process.env.ENGINE_URL || "http://localhost:8000";
        axios.post(`${engineUrl}/api/parse`, {
            project_id: projectId,
            folder_path: extractFolderPath
        }).catch(err => console.log("failed to trigger python engine", err.message));
        res.json({ message: "Upload success", project_id: projectId, status: "processing" });

        
    }catch(error){
        console.error("Upload error:",error);
        res.status(500).json({error:"Upload failed"});
    }
});

app.get("/api/projects", ClerkExpressRequireAuth(), async (req, res) => {
    const projects = await Project.find({ userId: req.auth.userId }).sort({ createdAt: -1 });
    res.json(projects);
});

app.get("/api/projects/:id", ClerkExpressRequireAuth(), async (req, res) => {
    const project = await Project.findOne({ project_id: req.params.id, userId: req.auth.userId });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
});

app.delete("/api/projects/:id", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const project = await Project.findOne({ project_id: req.params.id, userId: req.auth.userId });
        if (!project) return res.status(404).json({ error: "Project not found" });

        const engineUrl = process.env.ENGINE_URL || "http://localhost:8000";
        await axios.delete(`${engineUrl}/api/projects/${req.params.id}`);

        await Project.deleteOne({ project_id: req.params.id });
        res.json({ message: "Project deleted successfully" });
    } catch (error) {
        console.error("Delete project error:", error.message);
        res.status(500).json({ error: "Failed to delete project" });
    }
});

app.patch("/api/projects/:id/status",async(req,res)=>{
    try{
        const {status, progress_text, progress_percent, summary}=req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (progress_text !== undefined) updateData.progress_text = progress_text;
        if (progress_percent !== undefined) updateData.progress_percent = progress_percent;
        if (summary !== undefined) updateData.summary = summary;

        const project=await Project.findOneAndUpdate(
            {project_id:req.params.id},
            updateData,
            {new: true}
        );
        
        if (project) {
            console.log(`Emitting update to ${project.userId}:`, project.progress_text);
            io.to(project.userId).emit("project_update", project);
        }
        
        res.json(project);
    }catch(error){
        console.error("status update error:",error);
        res.status(500).json({error:"failed to update project status"});
    }
})


app.post("/api/query", ClerkExpressRequireAuth(), async(req,res)=>{
    try{
        const {project_id,question}=req.body;
        // Verify user owns project
        const project = await Project.findOne({ project_id, userId: req.auth.userId });
        if (!project) return res.status(403).json({ error: "Unauthorized" });
        const engineUrl = process.env.ENGINE_URL || "http://localhost:8000";
        const response=await axios.post(`${engineUrl}/api/query`,{
            project_id,
            question
        });
        
        const ans = response.data;
        project.chat_history.push({ role: 'user', text: question });
        project.chat_history.push({ 
            role: 'assistant', 
            text: ans.answer, 
            route: ans.route, 
            files_used: ans.files_used, 
            nodes_used: ans.nodes_used 
        });
        await project.save();

        res.json(ans);
    }catch(error){
        console.error("query error:",error);
        res.status(500).json({error:"failed to answer query"});
    }
});

app.get("/api/projects/:id/graph", ClerkExpressRequireAuth(), async(req,res)=>{
    try {
        // Verify user owns project
        const project = await Project.findOne({ project_id: req.params.id, userId: req.auth.userId });
        if (!project) return res.status(403).json({ error: "Unauthorized" });

        const engineUrl = process.env.ENGINE_URL || "http://localhost:8000";
        const response=await axios.get(`${engineUrl}/api/graph/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        console.error("Graph proxy error:", error.message);
        res.status(500).json({ error: "Failed to fetch graph" });
    }
})

app.get("/api/projects/:id/file", ClerkExpressRequireAuth(), async(req,res)=>{
    try {
        // Verify user owns project
        const project = await Project.findOne({ project_id: req.params.id, userId: req.auth.userId });
        if (!project) return res.status(403).json({ error: "Unauthorized" });
        
        const path = req.query.path;
        if (!path) return res.status(400).json({ error: "Path query parameter is required" });

        const engineUrl = process.env.ENGINE_URL || "http://localhost:8000";
        const response=await axios.get(`${engineUrl}/api/file/${req.params.id}`, { params: { path } });
        res.json(response.data);
    } catch (error) {
        console.error("File proxy error:", error.message);
        res.status(500).json({ error: "Failed to fetch file content" });
    }
})


app.get("/", (req, res) => {
    res.send("Hello World!");
});

// Fix: Catch Clerk authentication errors so they don't crash the server
app.use((err, req, res, next) => {
    console.error("Express Error:", err.message);
    res.status(401).json({ error: 'Unauthenticated!' });
});

httpServer.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
