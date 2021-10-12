const cloudinary = require("cloudinary").v2;

const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure:true
});

let cloudinaryDeleteImages = (images) => {
  let public_ids = images.map((image) => image.public_id);
  cloudinary.api.delete_resources(public_ids);
};

let cloudinaryUploader = ({ path, originalname }) => {
  return new Promise((resolve) => {
    cloudinary.uploader
      .upload(path, {
        public_id: `arcane-london/${originalname}`,
      })
      .then(({ url, public_id }) => {
        resolve({ url, public_id: String(public_id) });
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
      .then(({ data }) => {
        let geocode = data.results[0]
          ? data.results[0].geometry.location
          : { lat: 0, lng: 0 };

        resolve(geocode);
      });
  });
};

module.exports = { cloudinaryUploader, getGeocode, cloudinaryDeleteImages };
