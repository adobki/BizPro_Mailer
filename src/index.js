// Utility for sending emails from a Vercel.com server

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const logsRouter = require('./logs');
const { simpleLogger } = require('./utils/logger');
const { mongoose, dbClient, Email, statuses } = require('./utils/db');

// Server settings
const port = process.env.EXPRESS_PORT || 5555;
const user = process.env.MAILER_USER;
const pass = process.env.MAILER_PASS;
const auth = process.env.auth;
const app = new express();
app.use(express.json());
app.use(cors({ credentials: true })); // Enable CORS across this server

// Mailer settings
// const connectionTimeout = 5000; const greetingTimeout = connectionTimeout;
// const socketTimeout = connectionTimeout; const dnsTimeout = connectionTimeout;
const maxRetries = 5;
const transporter = nodemailer.createTransport({
  auth: { user, pass },
  service: 'gmail',
  // service: 'gmail', connectionTimeout, greetingTimeout, socketTimeout, dnsTimeout,
});

let connectionStatus = false;
/**
 * Mailer Connection test
 */
function ping(){
  transporter.verify((error) => {
    if (error) {
      simpleLogger('error', { ...error, service: 'conntest' }, 'Mail server connection failed!\nReconnecting. . .');
      connectionStatus = false;
      ping();
    } else {
      if (connectionStatus) return;
      simpleLogger('info', { service: 'conntest' }, 'Mail server connection established sucessfully!');
      connectionStatus = true;
    }
  }); setTimeout(() => { }, 500);
}

// Test/initialise mailer connection
transporter.verify((error) => {
  if (error) {
    simpleLogger('error', { ...error, service: 'conntest' }, 'Mail server init error!');
    ping();
  }  else simpleLogger('info', {service: 'conntest'}, 'Mail server connection established sucessfully!');
});

// Health check route controller
app.get('/api/v1/health', (req, res) => res.json({ status: true, db: dbClient.ping() }));

// Logs previewer routes controllers
app.use('/api/v1/logs', logsRouter);

// Mailer route controller
app.post('/api/v1/sendmail', async (req, res) => {
  const service = 'sendmail';
  ping() // Test mail server connection first
  // Check authorization and return 403 error if unauthorized
  let authorization = req.headers?.authorization?.split(' ') || '';
  authorization = authorization.length === 2 && authorization[0] === 'Bearer' ? authorization[1] : undefined;
  if (authorization !== auth) {
    simpleLogger('debug', { service, authorization: req.headers?.authorization, resCode: 403 },
      `Missing/invalid authorization header: Access denied\n authorization: ${req.headers?.authorization}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  // Test request body parsing to catch/handle errors
  try {
    if (!Object.keys(req.body).length) {
      simpleLogger('debug', { service, resCode: 400 }, 'Error: Invalid or no JSON data provided in body');
      return res.status(400).json({ error: 'Invalid or no JSON data provided in body' });
    }
  } catch (error) {
    simpleLogger('error', { ...error, service, resCode: 400 }, 'Body parsing error. Invalid data format');
    return res.status(415).json({
      error: 'Parsing error. Invalid data format',
      resolve: 'Request data must be in JSON format',
    });
  }

  // Parse and validate required fields from request body
  const { from, to, subject, html, mailId } = req.body; let missing;
  if (!html || typeof html !== 'string') missing = {error: '`html` is required. Must be string containing HTML code'};
  if (!subject || typeof subject !== 'string') missing = {error: '`subject` is required. Must be a string'};
  if (!to || typeof to !== 'string') missing = {error: '`to` is required. Must be an email address string'};
  if (!from || typeof from !== 'string') missing = {error: '`from` is required. Must be an email address string'};
  if (!mailId || typeof mailId !== 'string') missing = { error: '`mailId` is required. Must be string of sent mail\'s ID' };
  if (missing) {
    const fields = { from, to, subject, html, mailId };
    const text = JSON.stringify(fields).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    simpleLogger('debug', { service, fields, resCode: 400 },
      `Missing/invalid field: ${missing.error}\n fields: ${text}`);
    return res.status(400).json({ ...missing, resolve: 'mailId, from, to, subject, and html are all required' });
  }

  // Send the mail to user
  ping() // Test mail server connection first
  const email = await transporter.sendMail({ from, to, subject, html })
    .catch((error) => ({ error }))
    .then((payload) => payload);
  
  if (email.error || !email.accepted) {
    simpleLogger('error', { ...email, service }, `Email sending failed: ${email.error || email.payload}`);
    // await Email.insertOne({ from, to, subject, html, mailId }); // Queue failed email for automatic retry
    await Email.findOneAndUpdate({ from, to, subject, html, mailId }, // Queue failed email for automatic retry
      { status: statuses[1], $inc: { attempts: 1 } }, { upsert: true });
    return res.status(400).json({ error: 'Email sending failed' });
  } simpleLogger('info', { service }, `[${mailId}] email sent to ${email.accepted[0]}`);

  return res.status(200).json({
    authorization,
    payload: { from, to, subject, html, mailId },
    email: `${mailId} email sent to ${email.accepted[0]}`,
    headers: req.headers,
  });
});

/**
 * Automatically sends emails queued in the database while the worker/service below was offline.
 * This is required as the worker only treats changes that are made while it is online.
 */
async function retryPending() {
  const service = 'retryPending';
  let ttl = 500;
  while (!dbClient.ping()) {
    setTimeout(() => {
      simpleLogger('debug', { service },
        'retryPending waiting for MongoDB connection init. . .')
    }, ttl * 1000); ttl *= 2;
  }

  const pendingEmails = await Email.find({ status: { $ne: statuses.at(-1) }, attempts: { $lt: maxRetries } });
  let index = pendingEmails.length;
  if (!pendingEmails) simpleLogger('debug', { service }, 'No pending emails in queue.');
  else simpleLogger('debug', { service },
    `🔥${pendingEmails.length} unsent emails found in queue. Processing them first. . .`);

  // pendingEmails.forEach(email => {
  pendingEmails.forEach(async (currentEmail) => {
    const { mailId, id, status, attempts } = currentEmail;
    const idx = index; index -= 1; // Create internal copy to maintain value against race conditions
    simpleLogger('debug', { service }, `🔥 Old queued email: ${idx} [${id}:${mailId}]`);

    // Send the mail to user
    const email = await transporter.sendMail(currentEmail.toObject())
      .catch((error) => ({ error }))
      .then((payload) => payload);
    
    if (!email.accepted?.length) {
      simpleLogger('error', { ...email, service }, `Queued email ${idx} sending failed: ${email.error || email.payload}`);
    } else simpleLogger('info', { service }, `🔥 [${id}:${mailId}] queued email ${idx} sent to ${email.accepted[0]}`);

    // Update email's status in the database
    currentEmail.status = statuses.at(email.accepted?.length ? -1 : 1);
    currentEmail.error = email.error || undefined;
    currentEmail.attempts += 1;
    if (currentEmail.attempts > maxRetries) currentEmail.status = statuses.at(-2);
    currentEmail.save();
  });
}; mongoose.connection.on('connected', () => { retryPending(); }); // Run retryPending when DB connects

/**
 * Worker/service that automatically sends emails queued in the database by watching
 * for new inserts using MongoDB change streams.
 */
Email.watch().on('change', async (change) => {
  const service = 'eWorker';
  if (change.operationType === 'insert') {
    const newEmail = change.fullDocument;
    const { mailId } = newEmail; const id = newEmail._id?.toString();
    if (newEmail.status === statuses.at(-1)) {
      simpleLogger('debug', { service },
        `🔥 New email queued: [${id}:${mailId}]\nIgnored as status=${statuses.at(-1)}`);
      return;
    } simpleLogger('debug', { service }, `🔥 New email queued: [${id}:${mailId}]`);

    // Send the mail to user
    const email = await transporter.sendMail(newEmail)
      .catch((error) => ({ error }))
      .then((payload) => payload);
    
    if (!email.accepted?.length) {
      simpleLogger('error', { ...email, service }, `Queued email sending failed: ${email.error || email.payload}`);
    } else simpleLogger('info', { service }, `🔥 [${id}:${mailId}] queued email sent to ${email.accepted[0]}`);

    // Update email's status in the database
    newEmail.status = statuses.at(email.accepted?.length ? -1 : 1);
    newEmail.error = email.error;
    newEmail.attempts += 1;
    if (newEmail.attempts >= maxRetries) newEmail.status = statuses.at(-2);
    await Email.findByIdAndUpdate(id, newEmail);
  } else if (change.operationType !== 'delete') {
    const changedEmail = await Email.findById(change.documentKey?._id);
    const { mailId, attempts, status } = changedEmail; const id = changedEmail._id?.toString();
    if (statuses.slice(-2).includes(status)) return; // Ignore status === 'failed' || 'sent'
    if (attempts >= maxRetries) { // Ignore failed email due to maximum retry attempts limit
      simpleLogger('info', { service },
        `Skipped email: [${id}:${mailId}] due to maxRetries\n status: ${status}, attempts: ${attempts}`);
      return;
    } simpleLogger('info', { service }, `Retrying unsuccessful email: [${id}:${mailId}]`);

    // Send the mail to user
    const email = await transporter.sendMail(changedEmail.toObject())
      .catch((error) => ({ error }))
      .then((payload) => payload);
    
    if (!email.accepted?.length) {
      simpleLogger('error', { ...email, service }, `Queued email sending failed: ${email.error || email.payload}`);
    } else simpleLogger('info', { service }, `🔥 [${id}:${mailId}] queued email sent to ${email.accepted[0]}`);

    // Update email's status in the database
    changedEmail.status = statuses.at(email.accepted?.length ? -1 : 1);
    changedEmail.error = email.error;
    changedEmail.attempts += 1;
    if (changedEmail.attempts > maxRetries) changedEmail.status = statuses.at(-2);
    changedEmail.save();
  }
});

// Handler for unregistered routes/methods
app.use('/', (req, res) => res.status(404).json({ error: '404 not found' }));


// Start the server
app.listen(port, () => {
  simpleLogger('info', { service: 'mailer' }, `Server running on http://localhost:${port}\n`);
});
