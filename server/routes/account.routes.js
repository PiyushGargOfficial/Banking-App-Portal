/**
 * Account routes.
 *
 * Two groups of paths live here:
 *   - Nested under employee:  /employees/:id/accounts  (list, create)
 *   - Direct account ops:     /accounts/:accountId      (get, put, patch, delete)
 *
 * Mounted at /api in app.js so the absolute paths above become full URLs.
 * Keeping both in one router is fine because they're all "account operations"
 * conceptually - the URL shape just reflects which scope the caller starts from.
 */
const express = require('express');
const controller = require('../controllers/account.controller');

const router = express.Router();

// Employee-scoped (parent: employees)
router.get('/employees/:id/accounts', controller.listForEmployee);
router.post('/employees/:id/accounts', controller.createForEmployee);

// Account-scoped (direct)
router.get('/accounts/:accountId', controller.getById);
router.put('/accounts/:accountId', controller.replace);
router.patch('/accounts/:accountId', controller.patch);
router.delete('/accounts/:accountId', controller.close);

module.exports = router;
