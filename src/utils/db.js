// MongoDB database client

const mongoose = require('mongoose');
const { simpleLogger } = require('./logger');

// MongoDB Settings
const uri = process.env.MONGODB_URI;
const serverSelectionTimeoutMS = 1000 * 15; // 15 seconds timeout for all requests

// Create email schema
const statuses = ['pending', 'retry', 'failed', 'sent'];
const emailSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  mailId: { type: String, required: true },
  status: { type: String, enum: statuses, default: statuses[0] },
  attempts: { type: Number, default: 0 },
  error: String,
  userId: String,
  others: Object,
}, { timestamps: true, collection: 'emails' });

// Validations and constraints for creating and updating an email record
emailSchema.pre('validate', () => {
  // Set status to failed if error message is set/present
  if (this.error) this.status = statuses.at(-1);

  // Require error an message for failed emails
  if (!this.error && statuses.slice(1, -1).includes(this.status)) {
    throw new SyntaxError('Error message must be set for retry/failed status (set this.error)');
  }
});

// Create Email class
const Email = mongoose.model('Email', emailSchema);

/**
 * Client used to connect to the MongoDB database used by this server.
 */
class DBClient {
  constructor() {
    this.loading = true;
    this.connected = false;

    // Create connection to MongoDB database
    this.connect();
    // Set connection events callbacks
    mongoose.connection.on('error', (error) => {
      simpleLogger('error', { ...error, service: 'MongoDB'}, `Error connecting to MongoDB: ${error.message}`);
      this.ping(); // Try to reconnect immediately if disconnected
    }).on('disconnected', () => {
      this.connected = false;
      this.connect(); // Try to reconnect immediately
    }).on('connected', () => {
      this.connected = true;
      if (this.loading) {
        delete this.loading;
        simpleLogger('info', { service: 'MongoDB'}, 'MongoDB connection established successfully!');
      }
    });
  }

  /**
   * Creates a connection to MongoDB database if one has not been created yet.
   * @returns {mongoose.<object>} Client for Mongoose connection to MongoDB.
   */
  connect() {
    return mongoose.connect(uri, { serverSelectionTimeoutMS }).catch(() => {
      // this block prevents server from crashing when initial connection fails
    });
  }

  /**
   * Returns current MongoDB database connection state. Tries to reconnect if disconnected.
   * @returns {boolean} `true` if connection is active or `false` otherwise.
   */
  ping() {
    if (this.loading && mongoose.connection.readyState === 0) {
      simpleLogger('debug', { service: 'MongoDB'}, 'Reconnecting to MongoDB database. . .');
      this.connect();
    }
    return this.connected;
    // return mongoose.connection.readyState === 1;
  }
}

// Create client to connect to database
const dbClient = new DBClient();

module.exports = { dbClient, Email, statuses };
