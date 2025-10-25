// Routes for previewing system logs

const express = require('express');
const { logs, printedLogs, htmlLogs } = require('./utils/logger');
const { htmlHeader, htmlFooter, htmlScripts } = require('./html_parts');

// Create router for logs
const logsRouter = express.Router();

// Route for previewing log objects as is, in JSON format
logsRouter.get('/', (req, res) => res.status(200).json(logs));

// Route for previewing logs as formatted/pretty-printed strings
logsRouter.get('/print', (req, res) => res.status(200).json(printedLogs.map(log => log.log)));

// Route for previewing logs in an interactive HTML webpage
logsRouter.get('/print/:level', (req, res) => {
  res.status(200).json(printedLogs.filter(log => log.level === req.params.level).map(log => log.log));
}); logsRouter.get(['/printhtml', '/printhtml/:level'], (req, res) => {
  const { level } = req.params;
  // Get route/next route name from request url by analysing its path
  const path = req.url.split('/').slice(2).length ? '.' : 'printhtml';
  let levels = Object.keys(logs).map(level => {
    const btnClass = level === req.params.level ? 'current ' : '';
    return `<a class="${btnClass}button" href="${path}/${level}">${level}</a>`;
  }).join('');
  // levels = `<a class="${path === '.' ? 'current ' : ''}button" href="${path === '.' ? './' : 'printhtml'}">ALL</a>${levels}`;
  levels = `<a class="${path === '.' ? 'current ' : ''}button" href="${path === '.' ? './' : 'printhtml'}">ALL</a>${levels}`;
  const title = `Session Logs ${level ? `- ${level.toUpperCase()} ` : ''}| BizPro`;
  const header = `${htmlHeader.replaceAll('{{ title }}', title).replace('{{ levels }}', levels)}`;
  const currentLogs = level ? htmlLogs.filter(log => log[2] === level) : htmlLogs;
  if (!currentLogs.length) return res.status(200).send(`${header.replace('{{ table }}', '')}${htmlFooter}`);

  const headings = ['S/N', 'Timestamp', 'Level', 'SID/Service', 'TNX', 'Message'];
  let table = `<tr>${headings.map((th, idx) => `<th onclick="sortTable(${idx})">${th}</th>`).join('')}</tr>`;
  currentLogs.forEach(log => {
    const row = log.map(data => `<td>${data}</td>`);
    table += `<tr>${row.join('')}</tr>`;
  }); res.status(200).send(`${header.replace('{{ table }}', table)}${htmlScripts}${htmlFooter}`);
});

module.exports = logsRouter;
