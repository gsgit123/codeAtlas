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
    project_id:{
        type:String,
        required:true,
        unique:true
    }

},
{timestamps:true}
)

export default mongoose.model("Project",projectSchema);