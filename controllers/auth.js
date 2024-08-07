const userModel = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function register(req, res) {
  try {
    const { userName, mobileNumber, pin } = req.body;

    // const existingUser = await User.findOne({ mobileNumber });

    // if (existingUser) {
    //   return res.status(400).json({ status: "failed", msg: "User already exists" });
    // }

    const hashPin = await bcrypt.hash(pin.toString(), 10);

    // Find and update the user if they exist, or create a new user if they don't
    const newUser = await userModel.findOneAndUpdate(
      { mobileNumber },  // Find user by mobile number
      { userName, pin: hashPin }, // Update or set these fields
      { new: true, upsert: true, setDefaultsOnInsert: true } // Options: return the new doc if one is upserted
    );

    // Create a JWT token
    const token = jwt.sign(
      {
        mobileNumber: newUser.mobileNumber,
        id: newUser._id,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: '1d' }
    );

    // Respond with the user details and token
    return res.status(201).json({
      status: 'created',
      statusbar: '201 Created',
      msg: 'User is created successfully',
      data: {
        userId: newUser._id,
        userName: newUser.userName,
        mobileNumber: newUser.mobileNumber,
        token: token,
      },
    });
  } catch (error) {
    return res.status(404).json({
      status: 'failed',
      error: error?.message,
    });
  }
}

async function login(req, res) {
  try {
    const { mobileNumber, pin } = req.body;
    const existingUser = await userModel.findOne({ mobileNumber });
    // console.log('existingUser', existingUser)
    if (!existingUser) {
      // user is not registered yet need to register yourself.
      throw new Error("User does not exist");
    }

    // console.log(' existingUser.pin', existingUser.pin)
    const isPinCorrect = await bcrypt.compare(pin.toString(), existingUser.pin);
    // console.log('isPinCorrect', isPinCorrect)

    if (!isPinCorrect)
      throw new Error("Incorrect pin found");

    // const token = jwt.sign(
    //   {
    //     mobileNumber: existingUser.mobileNumber,
    //     id: existingUser._id,
    //   },
    //   process.env.TOKEN_SECRET,
    //   { expiresIn: "1d" }
    // );

    return res.status(200).json({
      status: "success",
      data: {
        userId: existingUser._id,
        userName: existingUser.userName,
        mobileNumber: existingUser.mobileNumber,
        // image:existingUser.image,
        // token: token,
      },
    })
  } catch (error) {
    // console.log("Internal server error", error)

    return res.status(404).json({
      status: "failed",
      error: error.message,
    })
  }
}

async function forgotPin(req, res) {
  try {
    const { mobileNumber, pin, confirmPin } = req.body;

    // Check if user exists
    const existingUser = await userModel.findOne({ mobileNumber });

    if (!existingUser) {
      return res.status(400).json({ status: 'failed', msg: "User doesn't exist" });
    }

    // Check if pin and confirmPin match
    if (pin !== confirmPin) {
      return res.status(400).json({ status: 'failed', msg: 'Pin and confirmPin must be the same' });
    }

    // Hash the new pin
    const hashPin = await bcrypt.hash(pin.toString(), 10);

    // Update the user's pin
    await userModel.findOneAndUpdate(
      { mobileNumber }, // Query to find the user
      { $set: { pin: hashPin } }, // Update to apply
      { new: true } // Options: return the updated document
    );

    // Respond with success message
    res.status(200).json({ status: 'success', msg: 'Pin has been updated successfully' });
  } catch (error) {
    res.status(404).json({
      status: 'failed',
      msg: 'Something went wrong',
      error: error?.message,
    });
  }
}

module.exports = { register, login, forgotPin };