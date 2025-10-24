// Utility for sending emails from a Vercel.com server

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

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
    console.error('Mail server init error!');
    console.error(error);
  } else console.log('Mail server connection established sucessfully!');
});

// Route controllers
app.get('/api/v1/health', (req, res) => res.json({ status: true }));
app.post('/api/v1/sendmail', async (req, res) => {
  // Test request body parsing to catch/handle errors
  try {
    console.log('\n\n Trying. . . \n\n')
    if (!Object.keys(req.body).length) return res.status(400)
      .json({ error: 'Invalid or no JSON provided in body' });
  } catch {
    console.error('Body parsing error. Invalid data format');
    return res.status(415).json({
      error: 'Parsing error. Invalid data format',
      resolve: 'Request data must be in JSON format',
    });
  }

  // Parse required parameters from request body
  const { from, to, subject, html } = req.body;

  // Check authorization and return 403 error if unauthorized
  let authorization = req.headers?.authorization?.split(' ') || '';
  authorization = authorization.length === 2 && authorization[0] === 'Bearer' ? authorization[1] : undefined;
  if (authorization !== auth) return res.status(403).json({ error: 'Access denied' });

  // Send the mail to user
  const email = await transporter.sendMail({ from, to, subject, html })
    .catch((error) => ({ error: 'Email sending failed', payload: error }))
    .then((payload) => payload);
  
  if (email.error || !email.accepted) {
    console.error('Email sending failed:', email.error, email.payload || email)
    return res.status(400).json({ error: 'Email sending failed' });
  }

  return res.status(200).json({
    authorization,
    payload: { from, to, subject, html },
    email: `Email sent to ${email.accepted[0]}`,
    headers: req.headers,
  });
});

// Handler for unregistered routes/methods
app.use('/', (req, res) => res.status(404).json({ error: '404 not found' }));


// Start the server
app.listen(port, () => { console.log(`Server running on http://localhost:${port}\n`); });
