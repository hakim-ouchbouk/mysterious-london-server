const mongoose = require("mongoose");

const attractionSchema = new mongoose.Schema({
  addedBy: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },

  address: String,

  imageURL: String,
});

module.exports = mongoose.model("Attraction", attractionSchema);
