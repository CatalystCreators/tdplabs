const NodeCache = require('node-cache');
const mongoose = require('mongoose');
const cache = new NodeCache();
const { MongoClient, ObjectId } = require('mongodb')


const newURI = "mongodb+srv://cloudservers:71UFyJKMm6nWFZA5@cluster0.uj9nq.mongodb.net/HausNHaus?retryWrites=true&w=majority";

const connectDB = async () => {
    try {      
        const conn = await mongoose.connect(newURI);
        console.log(`MongoDB connection established: ${conn.connection.host}`);
    } catch (error) {
        console.log(error)
        process.exit(1);
        return error;
    }
}

module.exports = { 
    connectDB, 
}