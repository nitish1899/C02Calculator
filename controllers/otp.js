const otpGenerator = require('otp-generator');
const otpModel = require('../models/otp');
const userModel = require('../models/user')
const axios = require('axios');

require('dotenv').config();

const sendOtp = async (req, res) => {
    try {
        const otp = otpGenerator.generate(4, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });

        const cDate = new Date();
        const mobileNumber = req.body.mobileNumber;

        const existingUser = await userModel.findOne({ mobileNumber });

        if (existingUser) {
            return res.status(400).json({ status: "failed", msg: "User already exists" });
        }

        await otpModel.findOneAndUpdate({ mobileNumber },
            { otp, otpExpiration: new Date(cDate.getTime()) },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await axios.get('https://www.fast2sms.com/dev/bulkV2', {
            params: {
                authorization: process.env.FAST2SMS_API_KEY,
                variables_values: otp,
                route: 'otp',
                numbers: mobileNumber
            }
        });

        // console.log('sent otp')
        return res.status(201).json('OTP sent successfully!');
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(400).json({ success: false, message: 'Failed to send OTP.' });
    }
}

const verifyOtp = async (req, res) => {
    try {

        const existingOtp = await otpModel.findOne({ mobileNumber: req.body.mobileNumber });
        console.log('existingOtpDetails', existingOtp);
        if (!existingOtp.otp) {
            throw new Error('Otp does not exists');
        }

        // otp expiration time is 5 minutes
        const cDate = new Date();

        if (cDate.getTime() > (existingOtp.otpExpiration + 300000)) {
            throw new Error('Otp expired');
        }

        if (existingOtp.otp != req.body.otp) {
            throw new Error('Invalid otp')
        }

        return res.status(201).json({ success: true })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error?.message
        })
    }
}

module.exports = { sendOtp, verifyOtp };