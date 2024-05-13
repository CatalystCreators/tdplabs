const mongoose = require('mongoose');

const reapitContactsSchema = mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('Contacts', reapitContactsSchema);