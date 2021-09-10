const cloudinary = require("cloudinary").v2;

const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

let cloudinaryUploader = ({ path, originalname }) => {
  return new Promise((resolve) => {
    cloudinary.uploader
      .upload(path, {
        public_id: `arcane-london/${originalname}`,
      })
      .then(({ url }) => {
        resolve(url);
      });
  });
};

let getGeocode = (address) => {
  return new Promise((resolve) => {
    client
      .geocode({
        params: {
          address,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      })
      .then(({data}) => {
        resolve(data.results[0].geometry.location);
      });
  });
};

module.exports = { cloudinaryUploader, getGeocode };
