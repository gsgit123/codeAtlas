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


dotenv.config();
const PORT=process.env.PORT||3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB!"))
  .catch((err) => console.error("MongoDB connection error:", err));


const app = express();

app.use(cors());
app.use(express.json());



const upload=multer({
    dest:"uploads/"
})

app.post("/api/upload",upload.single("repo"),async(req,res)=>{
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
            file_count:fileCount
        });

        await project.save();
        res.json({ message: "Upload success", project_id: projectId, status: "processing" });

        
    }catch(error){
        console.error("Upload error:",error);
        res.status(500).json({error:"Upload failed"});
    }
});

app.get("/api/projects", async (req, res) => {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
});

app.get("/api/projects/:id", async (req, res) => {
    const project = await Project.findOne({ project_id: req.params.id });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
});


app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
