const Vehicle = require('../models/vehicle');
const InputHistory = require('../models/inputHistory');
const User = require("../models/user");
const { orderBy, round } = require('lodash');
const axios = require('axios');
const { freeTrailCount, monthNames } = require('../constants');
const { HttpsProxyAgent } = require('https-proxy-agent');
const xml2js = require('xml2js');
require('dotenv').config();
const cron = require('node-cron');


let ulipToken = '';

// Placeholder function to simulate fetching the new ULIP token
async function fetchNewULIPToken() {
    const response = await axios.post('https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/user/login', {
        username: process.env.ULIP_USER_NAME,
        password: process.env.ULIP_PASSWORD
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    // Implement the logic to fetch the new ULIP token from the required source
    return response?.data?.response?.id; // Replace this with the actual new token
}

// Schedule a cron job to update the ULIP token every hour
cron.schedule('*/1 * * * *', async () => {
    try {
        // Function to fetch the new ULIP token
        ulipToken = await fetchNewULIPToken();
        // console.log('ULIP token ', ulipToken);
        // console.log('ULIP token updated successfully');
    } catch (error) {
        console.error('Error updating ULIP token:', error);
    }
});

const { v4: uuidv4 } = require('uuid');

function generateUuidNumber() {
    const uniqueId = uuidv4().split('-')[0]; // Shorten the UUID
    return `CERT-${uniqueId}`;
}

async function getDistance(sourcePincode, destinationPincode) {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/distancematrix/json`,
            {
                params: {
                    origins: sourcePincode,
                    destinations: destinationPincode,
                    key: process.env.GOOGLE_GEOCODING_API_KEY
                }
            }
        );

        if (!response) {
            throw new Error('Invalid pincode');
        }

        // Extract distance information
        const distanceInfo = response?.data?.rows[0]?.elements[0];
        const distance = distanceInfo?.distance?.text;
        // console.log(distance);
        return distance;
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
/*
async function insert(req, res) {
    try {
        // Create a new vehicle record using the request body
        const vehicleInfo = await Vehicle.create({
            category:req.body.category,
            type: req.body.type,
            standardLadenWeight: req.body.standardLadenWeight,
            co2EPercentageAbove2021: req.body.co2EPercentageAbove2021,
            co2EPercentageBelow2021: req.body.co2EPercentageBelow2021,
            lodedVehicleNomalizationPercentage: req.body.lodedVehicleNomalizationPercentage,
            emptyVehicleNomalizationPercentage: req.body.emptyVehicleNomalizationPercentage,
        });
        // Send the created vehicle record as a response
        return res.status(201).json(vehicleInfo);
    } catch (error) {
        // Handle any errors that occur during the creation
        console.error('Error creating vehicle:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
*/

async function findByVehicleCategory(vehicleCategory) {
    try {
        const vehicles = await Vehicle.find({ category: vehicleCategory });

        if (vehicles.length === 0) {
            throw new Error('No vehicles found for the specified type');
        }

        return vehicles;
    } catch (error) {
        // Handle any errors that occur during the query
        console.error('Error finding vehicles:', error.message);
        return error.message;
    }
}

async function parseXmlToJson(xml) {
    try {
        const parser = new xml2js.Parser();
        const vehicleJsonData = (await parser.parseStringPromise(xml))?.VehicleDetails;
        // console.log('vehicleJsonData', vehicleJsonData);
        return vehicleJsonData;
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}

async function findCO2Emission(req, res) {
    try {
        const { VechileNumber, SourcePincode, DestinationPincode, MobilisationDistance, DeMobilisationDistance, LoadedWeight } = req.body;
        const vehicleNumber = VechileNumber.replace(" ", '').toUpperCase();
        const options = {
            method: 'POST',
            url: 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/VAHAN/01',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ulipToken}`,
            },
            data: {
                vehiclenumber: vehicleNumber,
            },
        };

        // Validate vehicle number
        if (!/^[a-zA-Z0-9]+$/.test(vehicleNumber) || vehicleNumber.length > 10) {
            return res.status(400).json({ error: 'Invalid vehicle number. Only alphanumeric characters are allowed.' });
        }

        if (!Number(SourcePincode) || SourcePincode.length != 6 || !Number(DestinationPincode) || DestinationPincode.length != 6) {
            throw new Error('Invalid source or destination pincode');
        }

        const vehicleData = await axios.request(options);
        const vehicleDetails = vehicleData?.data?.response?.[0]?.response;

        // console.log('EV-Respose: ', vehicleData?.data?.response?.[0]?.response);
        // console.log((vehicleData?.data?.response?.[0]?.response).includes('ULIPNICDC')) 

        //  ULIPNICDC is not authorized to access Non-Transport vehicle data
        if (vehicleDetails.includes('ULIPNICDC')) {
            return res.status(404).json({ error: 'Non-Transport vehicle found' });
        }

        //  Vehicle Details not Found
        if (vehicleDetails.includes('Vehicle Details not Found')) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // rc_fuel_desc: ELECTRIC(BOV)

        // get vechileInfo using vehicle number
        // console.log('vehicleData', vehicleXMLData);
        const vehicleJsonData = (await parseXmlToJson(vehicleDetails));
        // console.log('vehicleDataType : ', typeof (vehicleJsonData));
        console.log('vehicleData : ', vehicleJsonData);


        // const vehicleInfo = vehicleData.data;
        // // console.log('vehicleInfo',vehicleInfo)
        const dateString = vehicleJsonData?.rc_regn_dt?.[0];
        const date = new Date(dateString);
        const year = date.getFullYear();
        const vehicleCategory = vehicleJsonData?.rc_vch_catg;
        console.log('vehicleCategory', vehicleCategory);
        // const vehicleOwner = vehicleJsonData?.rc_owner_name?.[0];

        // get other details for vechileType
        const vechileCategories = await findByVehicleCategory(vehicleCategory);
        const orderedVechileCategory = orderBy(vechileCategories, 'standardLadenWeight', 'desc');
        const ladenWeight = vehicleJsonData?.[0]?.rc_gvw - vehicleJsonData?.[0]?.rc_unld_wt;
        const nearestVechileCategory = orderedVechileCategory.filter(v => v.standardLadenWeight <= ladenWeight);

        const otherDetails = nearestVechileCategory.length ? nearestVechileCategory[0] : orderedVechileCategory[orderedVechileCategory.length - 1];
        // console.log('otherDetails', otherDetails);
        const distanceString = await getDistance(SourcePincode, DestinationPincode);
        // console.log('disString', distanceString);
        const distance = parseFloat(distanceString.replace(/[^\d.]/g, '')); // Removes non-numeric characters and parses as float

        if (!distance) {
            return res.status(404).json({ error: 'Invalid pin' });
        }

        // function getRandomNumber(min, max) {
        //     return Math.floor(Math.random() * (max - min + 1)) + min;
        // }

        // 1000 kg co2 emission is equivalent to 12 trees

        let co2Emission = 0;

        if (vehicleJsonData.rc_fuel_desc[0] !== 'ELECTRIC(BOV)') {
            if (year >= 2021) {
                console.log('above2021', otherDetails.co2EPercentageAbove2021);
                if (round((LoadedWeight), 2) > (0.5 * otherDetails.standardLadenWeight)) {
                    co2Emission = distance * otherDetails.co2EPercentageAbove2021;
                } else {
                    co2Emission = distance * otherDetails.co2EPercentageAbove2021 * otherDetails.lodedVehicleNomalizationPercentage / 100;
                }
            } else {
                console.log('below2021', otherDetails.co2EPercentageBelow2021);
                if (round((LoadedWeight), 2) > (0.5 * otherDetails.standardLadenWeight)) {
                    co2Emission = distance * otherDetails.co2EPercentageBelow2021;
                } else {
                    console.log(otherDetails)
                    co2Emission = distance * otherDetails.co2EPercentageBelow2021 * otherDetails.lodedVehicleNomalizationPercentage / 100;
                }
            }

            const mobilisationDistance = MobilisationDistance?.length ? Number(MobilisationDistance) : '';
            const deMobilisationDistance = DeMobilisationDistance?.length ? Number(DeMobilisationDistance) : '';

            if (mobilisationDistance || deMobilisationDistance) {
                console.log('extraDistance', (mobilisationDistance + deMobilisationDistance));
                if (year >= 2021) {
                    co2Emission = co2Emission + (MobilisationDistance + DeMobilisationDistance) * otherDetails.co2EPercentageAbove2021 * otherDetails.emptyVehicleNomalizationPercentage / 100;
                }
                else {
                    co2Emission = co2Emission + (MobilisationDistance + DeMobilisationDistance) * otherDetails.co2EPercentageBelow2021 * otherDetails.emptyVehicleNomalizationPercentage / 100;
                }
            }
        }



        //  const count = await InputHistory.countDocuments({ _user: userId });

        // if (count > freeTrailCount) {
        //     throw new Error('You have exceeded your free trial limit.');
        // }

        // await InputHistory.create({
        // vehicleNumber,
        //sourcePincode: SourcePincode,
        //destinationPincode: DestinationPincode,
        //lodedWeight: LoadedWeight,
        // mobilizationDistance: mobilisationDistance,
        //deMobilizationDistance: deMobilisationDistance,
        //_user: user,
        // })

        // console.log('overallEmission', co2Emission);
        let currentDate = new Date();
        let month = monthNames[currentDate.getMonth()];

        // // Formulate the desired date string
        const certificateIssueDate = `${month} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;

        return res.status(201).json({ co2Emission: round(co2Emission, 2), vehicleNumber, certificateIssueDate, certificateNumber: generateUuidNumber() });
    } catch (error) {
        // console.log('error is : ', error.message)
        return res.status(404).json({ error: error.message });
    }
}


module.exports = {
    findCO2Emission, findByVehicleCategory
};

