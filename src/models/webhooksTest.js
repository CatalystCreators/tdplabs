const mongoose = require("mongoose");

const webhooksSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model("WebhooksTest", webhooksSchema);
