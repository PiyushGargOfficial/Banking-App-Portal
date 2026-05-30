/**
 * Audit routes.
 *
 * Mounted at /api in app.js so the absolute path below becomes the
 * full URL. Only a GET endpoint exists - the trail is append-only and
 * written by the services on the back of normal employee/account writes.
 */
const express = require('express');
const controller = require('../controllers/audit.controller');

const router = express.Router();

router.get('/employees/:id/audit', controller.listForEmployee);

module.exports = router;
