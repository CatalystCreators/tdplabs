const mongoose = require('mongoose');
const dotenv = require('dotenv').config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI)
        console.log(`Mongo connection established: ${conn.connection.host}`);
    } catch (error) {
        console.log('Error connecting to Mongo', error);
        process.exit(1);
    }
}

module.exports = connectDB;