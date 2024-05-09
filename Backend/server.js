const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors')
//below two for to upload image in database
const multer = require('multer');
const path = require('path'); 
const fs = require('fs');



const app = express();
const port = 3090;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
// below for to show image 
app.use(express.static('public'));

// Session configuration
app.use(session({
 // secret: 'your_secret_key',
 secret: 'Server_Things',
  resave: false,
  saveUninitialized: true
}));


// Create MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'music',
  port: 3306
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database and listening on port', port);
});




/*
USAGE : To signup  a new user details
URL :   http://localhost:3030/signup
Method : post
Fields : name, userid, email, password, randomKey, tokenkey
 tokenkey is to find the user 
Signup is the endpoint
*/
app.post('/signup', (req, res) => {
  const { name, userid, email, password, randomKey, tokenkey } = req.body;

  // Check if userid already exists
  const checkUseridSql = 'SELECT * FROM signup WHERE userid = ?';
  db.query(checkUseridSql, [userid], (err, userResult) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      return res.status(500).json({ error: 'An error occurred while checking userid' });
    }

    // If userid already exists, return error
    if (userResult.length > 0) {
      return res.status(400).json({ error: 'User ID already exists' });
    }

    // If userid doesn't exist, proceed to check email
    const checkEmailSql = 'SELECT * FROM signup WHERE email = ?';
    db.query(checkEmailSql, [email], (err, emailResult) => {
      if (err) {
        console.error('Error executing MySQL query:', err);
        return res.status(500).json({ error: 'An error occurred while checking email' });
      }

      // If email already exists, return error
      if (emailResult.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // If neither userid nor email exists, proceed with signup
      const sql = 'INSERT INTO signup (name, userid, email, password, randomKey, tokenkey) VALUES (?, ?, ?, ?, ?, ?)';
      db.query(sql, [name, userid, email, password, randomKey, tokenkey], (err, result) => {
        if (err) {
          console.error('Error executing MySQL query:', err);
          return res.status(500).json({ error: 'An error occurred while signing up' });
        }
        console.log('User signed up successfully');
        const newUser = {
          name,
          userid,
          email,
          password,
          randomKey,
          tokenkey
        };
        console.log('User signed up successfully:', newUser);
        return res.status(200).json({ message: 'User signed up successfully' });
      });
    });
  });
});




/*
USAGE : To login a user 
URL :   http://localhost:3030/login
Method : post
Fields : login, password
login End point url
*/
app.post('/login', (req, res) => {
  const { login, password } = req.body;
  const sql = 'SELECT * FROM signup WHERE (userid = ? OR email = ?)';
  db.query(sql, [login, login], (err, result) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      return res.status(500).json({ error: 'An error occurred while logging in' });
    }

    if (result.length === 0) {
      // No user found with the provided userid or email
      return res.status(401).json({ error: 'Userid or email wrong' });
    }

    // User found, now check password
    const user = result[0];
    if (user.password !== password) {
      // Incorrect password
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Password correct, set session data
    req.session.isLoggedIn = true;
    req.session.user = user;

    // Login successful
    console.log('User logged in successfully');
    console.log(user.id);
   // console.log('Session data set:', req.session);
    return res.status(200).json({ 
      message: 'User logged in successfully', 
      isLoggedIn: true, 
      user });
  });
});




/*
USAGE : to get the user details
URL :   http://localhost:3030/navbar
Method : get
Navbar Endpoint
*/
app.get('/navbar', (req, res) => {
  // Check if user is logged in
  if (req.session.isLoggedIn) {
    // User is logged in, send relevant data from session
   // console.log('User ID:', req.session.user.id);
    res.json({ isLoggedIn: true, user: req.session.user });
  } else {
    // User is not logged in
    res.json({ isLoggedIn: false });
  }
});








/*
USAGE : To user-profile a new user details 
URL :   http://localhost:3030/user-profile
Method : get
Fields : here it will check the login user email id and  show his profile information
 tokenkey is to find the user 
user-profile end point url
*/
app.get('/user-profile', (req, res) => {
  const userEmail = req.session.user && req.session.user.email;
  if (!userEmail) {
    res.status(400).json({ error: 'User email not found in session' });
    return;
  }

  db.query('SELECT * FROM signup WHERE email = ?', [userEmail], (err, result) => {
    if (err) {
      console.error('Error fetching user profile data:', err);
      res.status(500).json({ error: 'An error occurred while fetching user profile data' });
      return;
    }

    if (result.length === 0) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    // Send the user profile data to the frontend
    const user = result[0];
    res.json({ user });
  });
});






/*
USAGE : it will destroy the server 
URL :   http://localhost:3030/logout
Method : get
Logout Endpoint
*/
app.post('/logout', (req, res) => {
  // Clear session data
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
     // sessionStorage.setItem('token', JSON.stringify(response.data.user.tokenkey));
    console.log(req.session);
      return res.status(500).json({ error: 'An error occurred during logout' });
    }
    // Session destroyed successfully
   // sessionStorage.setItem('token', JSON.stringify(response.data.user.tokenkey));
    console.log('User logged out successfully');
   // console.log(req.session);
    return res.status(200).json({Logout:"Successfully", success: true });
  });
});







/*
USAGE : here it will save the data after login  
URL :   http://localhost:3030/updateprofile
Method : post
Fields : here it will save the data as per email and userid 
Update profile endpoint
*/
const storage = multer.diskStorage({
  destination: (req, file ,cb ) =>{
     cb(null,'public/userimages')
  },
  filename:(req, file, cd) => {
    cd(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  }
});
const  updateprofile = multer({
  storage: storage
});
app.post('/updateprofile', updateprofile.single('image'), (req, res) => {
  const newImage = req.file;
  const { name, userid, email, phoneno, dob, gender } = req.body;

  // Retrieve the old image file name from the database
  db.query('SELECT image FROM signup WHERE email = ? AND userid = ?', [email, userid], (err, result) => {
    if (err) {
      console.error('Error fetching old image:', err);
      res.status(500).json({ error: 'An error occurred while updating profile' });
      return;
    }

    const oldImage = result[0]?.image;

    // Determine the image to use based on whether a new image is uploaded
    const imageToUpdate = newImage ? newImage.filename : oldImage;

    // SQL query to update profile where email and userid match
    const sql = 'UPDATE signup SET name = ?, phoneno = ?, dob = ?, gender = ?, image = ? WHERE email = ? AND userid = ?';
    const values = [name, phoneno, dob, gender, imageToUpdate, email, userid];

    // Execute the query to update the user profile with the new image or previous image
    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'An error occurred while updating profile' });
        return;
      }

      // Check if there's an existing image associated with the user and a new image is uploaded
      if (oldImage && newImage) {
        const oldImagePath = path.join(__dirname, 'public', 'userimages', oldImage);

        // Delete the older image
        fs.unlink(oldImagePath, (err) => {
          if (err) {
            console.error('Error deleting old image:', err);
            return;
          }
          console.log(oldImage);
          console.log(newImage);
          console.log('Old image deleted successfully');
        });
      }

      console.log('Profile updated successfully');
      res.status(200).json({ message: 'Profile updated successfully' });
    });
  });
});






/*
USAGE : To store music uploads of a user 
URL :   http://localhost:3030/songs
Method : post
Fields : songid, songname, songdescription, songlicence, songprice, songimage, songpreview, songoriginal
here image is optinal
songs End point url
*/
const istorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define destinations for image and audio files
    if (file.fieldname === 'songimage') {
      cb(null, 'public/songfilesupload/images');
    } else if (file.fieldname === 'songpreview') {
      cb(null, 'public/songfilesupload/preview');
    }else if (file.fieldname === 'songoriginal') {
      cb(null, 'public/songfilesupload/original');
    } else {
      cb(new Error('Invalid fieldname'));
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const imgpreviewupload = multer({storage: istorage});

app.post('/songs', imgpreviewupload.fields([{ name: 'songimage' }, { name: 'songpreview' },{name: 'songoriginal'} ]), (req, res) => {
  // Extract other song details from req.body
  const { songid, songname, songdescription, songlicence, songprice } = req.body;

  // Access uploaded files using req.files
  let songimage = '';
  let songpreview = '';
  let songoriginal =' ';

  if (req.files['songimage']) {
    // Extract file name from the path
    const imageName = req.files['songimage'][0].filename;
    songimage = imageName; // Save only the file name
  }
  if (req.files['songpreview']) {
    // Extract file name from the path
    const previewName = req.files['songpreview'][0].filename;
    songpreview = previewName; // Save only the file name
  }
  if (req.files['songoriginal']) {
    // Extract file name from the path
    const songOriginalName = req.files['songoriginal'][0].filename;
  //  console.log('Song Original Filename:', songOriginalName);
    songoriginal = songOriginalName; // Save only the file name
  }

  // Insert song details into MySQL database
  const sql = 'INSERT INTO musicuploadsongs (songid, songname, songdescription, songlicence, songprice, songimage, songpreview, songoriginal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const values = [songid, songname, songdescription, songlicence, songprice, songimage, songpreview, songoriginal];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error inserting song into database:', err);
      return res.status(500).json({ error: 'An error occurred while uploading the song' });
    }

    console.log('Song uploaded successfully');
    console.log(values);
    res.status(200).json({ message: 'Song uploaded successfully' });
  });
});

app.get('/songsfiles', (req, res) => {
  const userId = req.session.user.id; 

  // SQL query to fetch songs associated with the logged-in user
  const sql = `
    SELECT *
    FROM musicuploadsongs
    WHERE songid = ?
  `;

  // Execute the SQL query
  db.query(sql, [userId], (err, result) => {
    if (err) {
    //  console.log(sql);
    //  console.log(userId);
      //console.log(result);
      console.error('Error retrieving songs from database:', err);
      return res.status(500).json({ error: 'An error occurred while retrieving songs' });
    }
  //  console.log(sql);
   // console.log(userId);
    //console.log(result);
    res.status(200).json(result);
  });
});


/*
USAGE : to get the hole songs which users upload 
URL :   http://localhost:3030/Homesongs
Method : get
Homesongs Endpoint
*/

app.get('/Homesongs', (req, res) => {
  // SQL query to fetch all songs
  const sql = `
    SELECT *
    FROM musicuploadsongs
  `;

  // Execute the SQL query
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error retrieving songs from database:', err);
      return res.status(500).json({ error: 'An error occurred while retrieving songs' });
    }
    res.status(200).json(result);
    //res.json({result });
  });
});

/*
USAGE : if user search for some to show the result 
URL :   http://localhost:3030/Searchtext
Method : get
Searchtext Endpoint
*/

app.get('/Searchtext', (req, res) => {
  const { songname } = req.query;

  if (!songname) {
    res.status(400).json({ error: 'Song name parameter is missing' });
    return;
  }

  db.query('SELECT * FROM musicuploadsongs WHERE songname LIKE ?', [`%${songname}%`], (err, result) => {
    if (err) {
      console.error('Error searching for songs:', err);
    //  res.status(500).json({ error: 'An error occurred while searching for songs' });
    console.log(songname)

      return;
    }

    if (result.length === 0) {
     // res.status(404).json({ error: 'No songs found with the provided name' });
   // console.log(songname)

      return;
    }

    // Send the matching songs data to the frontend
    res.json({ searchdata: result });
   // console.log(result);
 //   console.log(songname)
  });
});


/*
USAGE : To store song in  wishlist page which user likes 
URL :   http://localhost:3030/Add-To-Wishlist
Method : post
Fields : id, songname, songdescription, songimage, songpreview, songoriginal,songlicence, songprice
here image is optinal
here order should be imp
wishlist End point url
*/

app.post('/Add-To-Wishlist', (req, res) => {
  const { id, songname, songdescription, songimage, songpreview, songoriginal,songlicence, songprice } = req.body;
  
  // Check if the song with the given songid exists in the wishlist
  db.query('SELECT * FROM wishlist WHERE id = ? AND songname = ? AND songdescription = ?  AND songimage = ? AND songpreview = ? AND songoriginal = ? AND songlicence = ? AND songprice = ? ', 
  [id, songname, songdescription, songimage, songpreview, songoriginal, songlicence, songprice,], 
  (err, rows) => {
    if (err) {
      console.error('Error checking song in wishlist:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (rows.length > 0) {
      console.log('Song is already in the wishlist');
      return res.status(400).json({ error: 'Song is already in the wishlist' });
    }

    // If a row with the given songid exists, the song is already in the wishlist
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Song is already in the wishlist' });
    }

    // If the song with the given songid doesn't exist, insert it into the wishlist
    const querywishlist = `INSERT INTO wishlist (id, songname, songdescription, songimage, songpreview, songoriginal, songlicence, songprice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(querywishlist, [id, songname, songdescription, songimage, songpreview, songoriginal, songlicence, songprice], (err, result) => {
      if (err) {
        console.error('Error adding song to wishlist:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      console.log('Song added to wishlist');
      res.json({ success: true });
    });
  });
});



/*
USAGE : if user add the to wishlist and it will show the data in wishlist
URL :   http://localhost:3030/wishlistsongs
Method : get
wishlistsongs Endpoint
*/

app.get('/wishlistsongs', (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'User session not found or missing user id' });
  }
  const userId = req.session.user.id; 
  //console.log(userId);

  // SQL query to fetch songs associated with the logged-in user
  const sql = `
    SELECT *
    FROM wishlist
    WHERE id = ?
  `;

  // Execute the SQL query
  db.query(sql, [userId], (err, result) => {
    if (err) {
    //  console.log(sql);
    //  console.log(userId);
      //console.log(result);
      console.error('Error retrieving songs from database:', err);
      return res.status(500).json({ error: 'An error occurred while retrieving songs' });
    }
  //  console.log(sql);
   // console.log(userId);
    //console.log(result);
    res.status(200).json(result);
  });
});



/*
USAGE : it will delete the song in wishlist
URL :   http://localhost:3030/deletewishlist
Method : post
deletewishlist Endpoint
*/

app.post('/deletewishlist', (req, res) => {
  const { id, songname, songdescription, songimage, songpreview, songoriginal,songlicence, songprice, } = req.body;
  
  const query = `DELETE FROM wishlist WHERE id = ?  AND songname = ? AND songdescription = ?  AND songimage = ? AND songpreview = ? AND songoriginal = ?  AND songlicence = ?  AND songprice = ?`;

  db.query(query, [id, songname, songdescription, songimage, songpreview, songoriginal,songlicence, songprice], (err, result) => {
    if (err) {
      console.error('Error deleting song from wishlist:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (result.affectedRows === 0) {
      console.log('Song is not in the wishlist');
      return res.status(404).json({ error: 'Song is not in the wishlist' });
    }

    console.log('Song deleted from wishlist');
    res.json({ success: true });
  });
});


/*
USAGE : To store song in  cart page which user likes 
URL :   http://localhost:3030/Add-To-Cart
Method : post
Fields : id, songname, songdescription, songimage, songpreview, songoriginal,songlicence, songprice
here image is optinal
here order should be imp
cart End point url
*/

app.post('/Add-To-Cart', (req, res) => {
  const { id, songname, songdescription, songimage, songpreview, songoriginal,songlicence, songprice } = req.body;
  
  // Check if the song with the given songid exists in the cart
  db.query('SELECT * FROM cart WHERE id = ? AND songname = ? AND songdescription = ?  AND songimage = ? AND songpreview = ? AND songoriginal = ? AND songlicence = ? AND songprice = ? ', 
  [id, songname, songdescription, songimage, songpreview, songoriginal, songlicence, songprice,], 
  (err, rows) => {
    if (err) {
      console.error('Error checking song in cart:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (rows.length > 0) {
      console.log('Song is already in the cart');
      return res.status(400).json({ error: 'Song is already in the cart' });
    }

    // If a row with the given songid exists, the song is already in the wishlist
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Song is already in the cart' });
    }

    // If the song with the given songid doesn't exist, insert it into the wishlist
    const querywishlist = `INSERT INTO cart (id, songname, songdescription, songimage, songpreview, songoriginal, songlicence, songprice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(querywishlist, [id, songname, songdescription, songimage, songpreview, songoriginal, songlicence, songprice], (err, result) => {
      if (err) {
        console.error('Error adding song to cart:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      console.log('Song added to cart');
      res.json({ success: true });
    });
  });
});

/*
USAGE : if user add the to Cart and it will show the data in Cart
URL :   http://localhost:3030/Cart-songs
Method : get
Cart-songs Endpoint
*/

app.get('/Cart-songs', (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'User session not found or missing user id' });
  }
  const userId = req.session.user.id; 
  //console.log(userId);

  // SQL query to fetch songs associated with the logged-in user
  const sql = `
    SELECT *
    FROM cart
    WHERE id = ?
  `;

  // Execute the SQL query
  db.query(sql, [userId], (err, result) => {
    if (err) {
    //  console.log(sql);
    //  console.log(userId);
      //console.log(result);
      console.error('Error retrieving songs from database:', err);
      return res.status(500).json({ error: 'An error occurred while retrieving songs' });
    }
  //  console.log(sql);
   // console.log(userId);
    //console.log(result);
    res.status(200).json(result);
  });
});


/*
USAGE : it will delete the song in Cart
URL :   http://localhost:3030/Delete-Cart-song
Method : post
Delete-Cart-song Endpoint
*/

app.post('/Delete-Cart-song', (req, res) => {
  const { id, songname, songdescription, songimage, songpreview, songoriginal,songlicence, songprice, } = req.body;
  
  const query = `DELETE FROM cart WHERE id = ?  AND songname = ? AND songdescription = ?  AND songimage = ? AND songpreview = ? AND songoriginal = ?  AND songlicence = ?  AND songprice = ?`;

  db.query(query, [id, songname, songdescription, songimage, songpreview, songoriginal,songlicence, songprice], (err, result) => {
    if (err) {
      console.error('Error deleting song from wishlist:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (result.affectedRows === 0) {
      console.log('Song is not in the Cart');
      return res.status(404).json({ error: 'Song is not in the Cart' });
    }

    console.log('Song deleted from Cart');
    res.json({ success: true });
  });
});




// Server Setup
app.get('/', (req, res) => {
  res.send('Server is running on port 3030');
});



// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
 