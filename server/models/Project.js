import mongoose from 'mongoose';

const projectSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    status:{
        type:String,
        enum:["uploading","processing","ready","error"],
        default:"uploading"
    },
    file_count:{
        type:Number,
        default:0
    },
    progress_text: {
        type: String,
        default: ""
    },
    progress_percent: {
        type: Number,
        default: 0
    },
    summary: {
        type: String,
        default: ""
    },
    chat_history: {
        type: Array,
        default: []
    },
    project_id:{
        type:String,
        required:true,
        unique:true
    },
    userId: {
        type: String,
        required: true
    }

},
{timestamps:true}
)

export default mongoose.model("Project",projectSchema);