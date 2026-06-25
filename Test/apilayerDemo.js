const axios = require("axios");
const fs = require("fs");


async function parseResumeWithAPILayer(filePath) {
  const apiKey = 'YUuI37Qmk4e3MQdMReX1KCgEGRWojGvb';

  try {
    // The API wants the raw resume FILE (PDF/DOCX), not text you've already
    // read the file as raw binary data
    const fileBuffer = fs.readFileSync(filePath);

    // Send a POST request to APILayer Resume Parser upload endpoint
    const response = await axios.post(
      'https://api.apilayer.com/resume_parser/upload',
      //Send the resume file data as the request body
      fileBuffer,
      {
        headers: {
    // Send APILayer API key for authentication
          apikey: apiKey,
          'Content-Type': 'application/octet-stream'
        }
      }
    );

    // Convert the API response data into nicely formatted JSON
    // null, 2 means indent the JSON with 2 spaces
    // This helps us inspect the real response structure first
    console.log(JSON.stringify(response.data, null, 2)); // inspect real shape first
    return response.data;
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

parseResumeWithAPILayer('./sample.pdf');