const mongoose = require('mongoose');

const idSchema = mongoose.Schema({
    hubspot_deals_id: { type: String },
    hubspot_contacts_id: { type: String },
    reapit_id: { type: String }
});

module.exports = mongoose.model('ID_Track', idSchema);