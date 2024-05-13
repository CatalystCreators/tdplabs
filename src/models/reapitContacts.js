const mongoose = require('mongoose');

const reapitContactsSchema = mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('Reapit_Contacts', reapitContactsSchema);