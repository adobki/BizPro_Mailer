// BizPro Mailer API #keepAlive utility for Vercel.app by @adobki

let count = 1; const dob = new Date();

/**
 * Sends a request at intervals to a free Vercel.app server to keep it alive
 * @param {String} url The API's URL to fetch data from.
 * @param {Number} ttl Request interval (time in seconds).
 */
function keepAlive(url, ttl = 10) { // default 10 seconds interval
  require('request')(url, (error, response, body) => {
    const { statusCode } = response, runStats = { dob, count }; body = body.replace(/\n/g, ''); count++;
    if (error) console.error({ error: `${error.name}: ${error.code}`, statusCode: 404, runStats });
    else console.log({ body, statusCode, runStats });

    // Wait for given interval then call function again
    setTimeout(() => keepAlive(url, ttl), ttl * 1000);
  });
}

// Call recursive function to send requests at intervals
keepAlive('https://bizpro.vercel.app/api/v1/sendmail');
