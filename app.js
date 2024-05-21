const express = require('express');
const app = express();
const http = require('http').Server(app);
const cors = require('cors');
require('dotenv').config();
const admin = require('firebase-admin');
const credentials = require('./firebase-adminsdk.json');

admin.initializeApp({credential:admin.credential.cert(credentials)});

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };
  
app.use(cors(corsOptions));
  
const mongoose = require('mongoose');
mongoose.connect("mongodb+srv://nkword1899:TP8SH1EJk6I45PnT@co2emissioncalculation.mq4im1l.mongodb.net/?retryWrites=true&w=majority&appName=CO2EmissionCalculation");

const vehicleRoutes = require('./routes/vehicle');

app.use(express.json()); // for parsing application/json
app.use('/api', vehicleRoutes);

http.listen(3000, function(){
    console.log('Server is running');
})