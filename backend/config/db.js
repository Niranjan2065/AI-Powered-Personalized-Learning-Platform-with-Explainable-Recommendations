// ============================================================
// config/db.js - MongoDB Connection Configuration
// ============================================================
// Handles connection to MongoDB with retry logic and event listeners

const mongoose = require('mongoose');

/**
 * Connect to MongoDB
 * Uses MONGO_URI from environment variables
 * Implements connection events for monitoring
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options help prevent deprecation warnings
      // and ensure stable connections
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database: ${conn.connection.name}`);

    // ---- Connection Event Listeners ----

    // Fires when connection is established after being lost
    mongoose.connection.on('connected', () => {
      console.log('🔗 Mongoose connected to MongoDB');
    });

    // Fires on any connection error
    mongoose.connection.on('error', (err) => {
      console.error(`❌ Mongoose connection error: ${err.message}`);
    });

    // Fires when connection is closed
    mongoose.connection.on('disconnected', () => {
      console.log('🔌 Mongoose disconnected from MongoDB');
    });

    // ---- Graceful Shutdown ----
    // When the Node process ends, close the MongoDB connection cleanly
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🛑 MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return conn;

  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    console.error('💡 Make sure MongoDB is running: sudo service mongod start');
    console.error('💡 Or check your MONGO_URI in the .env file');
    // Exit process with failure code
    process.exit(1);
  }
};

module.exports = connectDB;
