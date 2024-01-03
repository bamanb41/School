const express = require('express');
const fileUpload = require('express-fileupload');
const Client = require('ssh2-sftp-client');
const fs = require('fs').promises;

const app = express();
const port = 7000;


app.use(fileUpload());

// SFTP configuration
const sftp = new Client();

// Function to create a directory if it doesn't exist
const createDirectory = async (remotePath) => {
    try {
        // Check if the directory exists
        const stat = await sftp.stat(remotePath);

        if (!stat.isDirectory()) {
            // If it's not a directory, create one
            await sftp.mkdir(remotePath, true);
        }
    } catch (err) {
        // If the directory doesn't exist, create one
        await sftp.mkdir(remotePath, true);
    }
};

// Function to list files in a directory
const listFiles = async (remotePath) => {
    try {
      // Get the list of files in the directory
      const files = await sftp.list(remotePath);
  
      return files.map(file => file.name);
    } catch (err) {
      console.error(err);
      return [];
    }
  };


// Express route for uploading images
app.post('/upload-image', async (req, res) => {
    try {
        const { files, body } = req;

        if (!files || Object.keys(files).length === 0 || !body.gallery) {
            return res.status(400).send('Invalid request. Make sure to provide gallery type and files.');
        }

        const imageFile = files.image;
        const fileName = imageFile.name;
        const galleryType = body.gallery;

        // Connect to the Ubuntu server via SFTP
        await sftp.connect({
            host: '103.69.196.162',
            port: 22,
            username: 'user1',
            password: 'Home@12#$'
        });

        // Specify the base remote path where you want to store the files
        const baseRemotePath = '/home/user1/SchoolAPI/gallery/';

        // Create a directory for the gallery type if it doesn't exist
        const galleryPath = `${baseRemotePath}${galleryType}`;
        await createDirectory(galleryPath);

        // Specify the remote path where you want to save the file
        const remotePath = `${galleryPath}/${fileName}`;

        // Upload the file to the server
        await sftp.put(imageFile.data, remotePath);

        // Disconnect from the server
        await sftp.end();

        res.send('Image uploaded successfully!');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error uploading image.');
    }
});
  
// Express route for serving images in a gallery as Base64
app.get('/view-images/:gallery', async (req, res) => {
    try {
        const { gallery } = req.params;

        // Specify the base remote path where you want to store the files
        const baseRemotePath = '/home/user1/SchoolAPI/gallery/';

        // Specify the remote path for the gallery type
        const galleryPath = `${baseRemotePath}${gallery}`;

        // Connect to the Ubuntu server via SFTP
        await sftp.connect({
            host: '103.69.196.162',
            port: 22,
            username: 'user1',
            password: 'Home@12#$'
        });

        // Get the list of files in the directory
        const files = await listFiles(galleryPath);

        // Generate an array of image data as Base64
        const imageArray = await Promise.all(
            files.map(async (file) => {
                const remotePath = `${galleryPath}/${file}`;
                const imageContentBuffer = await sftp.get(remotePath);
                const imageBase64 = imageContentBuffer.toString('base64');
                return { filename: file, data: imageBase64 };
            })
        );

        // Disconnect from the server
        await sftp.end();

        // Set response headers for JSON
        res.setHeader('Content-Type', 'application/json');

        // Send the JSON array of image data as Base64 as the response
        res.json({ gallery, images: imageArray });
    } catch (err) {
        console.error(err);

        // Ensure to disconnect from the server in case of an error
        if (sftp && sftp.end) {
            await sftp.end();
        }

        res.status(500).send('Error serving images.');
    }
});

const connectSftp = async () => {
    console.log('Connecting to SFTP...');
    await sftp.connect({
      host: '103.69.196.162',
      port: 22,
      username: 'user1',
      password: 'Home@12#$'
    });
    console.log('Connected to SFTP.');
  };
  
  const disconnectSftp = async () => {
    if (sftp && sftp.end) {
      console.log('Disconnecting from SFTP...');
      await sftp.end();
      console.log('Disconnected from SFTP.');
    }
  };
  
  app.get('/list-subdirectories', async (req, res) => {
    try {
      await connectSftp();
  
      // Specify the base remote path where you want to store the files
      const baseRemotePath = '/home/user1/SchoolAPI/gallery/';
  
      // Get the list of files and directories in the gallery directory
      const entries = await sftp.list(baseRemotePath);
  
      // Filter out sub-directories from the list of entries
      const subdirectories = entries.filter(entry => entry.type === 'd').map(directory => directory.name);
  
      // Set response headers for JSON
      res.setHeader('Content-Type', 'application/json');
  
      // Send the JSON array of sub-directories as the response
      res.json({ subdirectories });
    } catch (err) {
      console.error(err);
  
      res.status(500).send('Error listing sub-directories.');
    } finally {
      // Disconnect from the server after completing the operation
      await disconnectSftp();
    }
  });
  
// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
