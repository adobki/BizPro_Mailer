// Utility for sending emails from a Vercel.com server

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const logsRouter = require('./logs');
const { simpleLogger } = require('./utils/logger');

// Server settings
const port = process.env.EXPRESS_PORT || 5555;
const user = process.env.MAILER_USER;
const pass = process.env.MAILER_PASS;
const auth = process.env.auth;
const app = new express();
app.use(express.json());
app.use(cors({ credentials: true })); // Enable CORS across this server

// Mailer settings
const connectionTimeout = 5000; const greetingTimeout = connectionTimeout;
const socketTimeout = connectionTimeout; const dnsTimeout = connectionTimeout;
const transporter = nodemailer.createTransport({
  auth: { user, pass },
  service: 'gmail', connectionTimeout, greetingTimeout, socketTimeout, dnsTimeout,
});

// Mailer Connection test
transporter.verify((error) => {
  if (error) {
    simpleLogger('error', { ...error, service: 'conntest' }, 'Mail server init error!')
  }  else simpleLogger('info', {service: 'conntest'}, 'Mail server connection established sucessfully!')
});

// Health check route controller
app.get('/api/v1/health', (req, res) => res.json({ status: true }));

// Logs previewer routes controllers
app.use('/api/v1/logs', logsRouter);

// Mailer route controller
app.post('/api/v1/sendmail', async (req, res) => {
  // Check authorization and return 403 error if unauthorized
  let authorization = req.headers?.authorization?.split(' ') || '';
  authorization = authorization.length === 2 && authorization[0] === 'Bearer' ? authorization[1] : undefined;
  if (authorization !== auth) {
    simpleLogger('debug', { service: 'sendmail', authorization: req.headers?.authorization, resCode: 403 },
      `Missing/invalid authorization header: Access denied\n authorization: ${req.headers?.authorization}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  // Test request body parsing to catch/handle errors
  try {
    if (!Object.keys(req.body).length) {
      simpleLogger('debug', { service: 'sendmail', resCode: 400 }, 'Error: Invalid or no JSON data provided in body');
      return res.status(400).json({ error: 'Invalid or no JSON data provided in body' });
    }
  } catch (error) {
    simpleLogger('error', { ...error, service: 'sendmail', resCode: 400 }, 'Body parsing error. Invalid data format');
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
    simpleLogger('debug', { service: 'sendmail', fields, resCode: 400 },
      `Missing/invalid field: ${missing.error}\n fields: ${text}`);
    return res.status(400).json({ ...missing, resolve: 'mailId, from, to, subject, and html are all required' });
  }

  // Send the mail to user
  const email = await transporter.sendMail({ from, to, subject, html })
    .catch((error) => ({ error }))
    .then((payload) => payload);
  
  if (email.error || !email.accepted) {
    simpleLogger('error', { ...email, service: 'sendmail' }, `Email sending failed: ${email.error || email.payload}`);
    return res.status(400).json({ error: 'Email sending failed' });
  } simpleLogger('info', { service: 'sendmail' }, `${mailId} email sent to ${email.accepted[0]}`);

  return res.status(200).json({
    authorization,
    payload: { from, to, subject, html, mailId },
    email: `${mailId} email sent to ${email.accepted[0]}`,
    headers: req.headers,
  });
});

// Handler for unregistered routes/methods
app.use('/', (req, res) => res.status(404).json({ error: '404 not found' }));


// Start the server
app.listen(port, () => {
  simpleLogger('info', { service: 'mailer' }, `Server running on http://localhost:${port}\n`);
});
