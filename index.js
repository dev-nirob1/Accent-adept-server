const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json())

app.use('/', (req, res) => {
    res.send('working nicely')
})
app.listen(port, () => {
    console.log(`app is running on port ${port}`)
})