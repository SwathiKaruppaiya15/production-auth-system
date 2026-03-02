const express = require('express'); // for import express
const cookieParser = require('cookie-parser'); // for import cookie-parser

const routes = require('./routes'); // for import routes, this file contains all the routes
const app = express(); // exp instance

//middleware
app.use(express.json());
app.use(cookieParser());

//routes
app.use('/api', routes);

app.get('/health', (req,res) => {
    res.status(200).json({
        status : 'success',
        message : 'Server is running'
    })
})

module.exports = app;