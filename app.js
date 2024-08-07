const express = require('express');
const app = express();
const http = require('http').Server(app);
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/database');

const corsOptions = {
  origin: '*',
  credentials: true
};

app.use(cors(corsOptions));

connectDB();

const authRoutes = require('./routes/auth');
const otpRoutes = require('./routes/otp');
const vehicleRoutes = require('./routes/vehicle');

app.use(express.json()); // for parsing application/json

app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/vehicle', vehicleRoutes);

app.use('/', (req, res) => res.json({ message: 'Welcome to CO2e Calculator' }));



http.listen(process.env.PORT || 4500, function () {
  console.log('Server is running');
});

