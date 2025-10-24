// Utility for sending emails from a Render.com server

import { Hono } from "hono@4";
import { cors } from "hono/cors";
const nodemailer = require("nodemailer");

// Server settings
const app = new Hono();
const port = process.env.EXPRESS_PORT;
const user = process.env.MAILER_USER;
const pass = process.env.MAILER_PASS;
const auth = process.env.auth;

// Mailer settings
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user, pass },
});

// Mailer Connection test
transporter.verify((error) => {
  if (error) {
    console.error("Mail server init error!");
    console.error(error);
  } else console.log("Mail server connection established sucessfully!");
});

// // Function to test the server
// function mailerTest(c) {
//   const { req, res } = c;
//   console.log({ req, res });
//   return {
//     status: "ok",
//     keys: Object.keys(c).join(", "),
//     req,
//     res,
//     env: { port, user, pass },
//   };
// }

// Function to send emails
async function sendMail(c) {
  // Test request body parsing to catch/handle errors
  try {
    const { from, to, subject, html } = await c.req.json();
  } catch {
    return { error: "Invalid or no JSON provided in body", code: 400 };
  }

  // Parse required parameters from request body
  const { from, to, subject, html } = await c.req.json();
  // .catch(() => ({ error: "Invalid or no JSON provided in body", code: 400 }));

  // Check authorization and return 403 error if unauthorized
  let authorization = (await c.req.header("authorization"))?.split(" ") || "";
  console.log({ authorization });
  authorization =
    authorization.length === 2 && authorization[0] === "Bearer"
      ? authorization[1]
      : undefined;
  console.log({ authorization, auth }, typeof authorization, typeof auth);
  if (authorization !== auth) return { error: "Access denied", code: 403 };

  // Send the mail to user
  const email = await transporter
    .sendMail({ from, to, subject, html })
    .catch((error) => console.error(error))
    .then(() => console.log("Email sent to user"));

  return {
    code: 200,
    result: {
      status: "ok",
      // payload,
      payload: { from, to, subject, html },
      // keys: Object.keys(c).join(", "),
      authorization,
      email,
      // json: await c.req.json(),
      // env: { port, user, pass },
      // body: await c.req.parseBody(),
      header: await c.req.header(),
    },
  };
}

app.use("/*", cors());
app.get("/api/v1/health", (c) => c.json({ status: true }));

// app.get("/sendmail", (c) => { return c.json(mailerTest(c)); });
// app.get("/sendmail/", (c) => { return c.json(mailerTest(c)); });

app.post("/sendmail", async (c) => {
  const { result, error, code } = await sendMail(c);
  return c.json({ result, error }, code);
});
app.post("/sendmail/", async (c) => {
  const { result, error, code } = await sendMail(c);
  return c.json({ result, error }, code);
});

// port: import.meta.env.PORT ?? port,
Bun.serve({ port, fetch: app.fetch });
