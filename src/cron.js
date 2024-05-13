const cron = require('node-cron');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const express = require('express');
const app = express();
const cors = require('cors')
const { Worker } = require('worker_threads');
const axios = require('axios');
const async = require('async')
const fs = require('fs');
const { fetchReapitData, fetchArchivedReapitData } = require('./dataPulling/reapitData')
const { contactsData, archivedContactsData } = require('./dataPulling/reapitData');
const {
    ReapitDataTransfer,
    HubspotDataTransfer,
    ExistingHubspotDataTransfer,
    createNegotiatorsFromDealOwners,
    journalToNote,
    noteToJournal,
    contactJournal2Note,
    reapitContactToHubpotViaWebhooks,
    existingReapitContactsToHubspot,
    dealActivityToJournal,
    contactNotes2Journals,
    archiveReapitApplicantsJournalsSync,
    updateRoleInHubspot,
    updateArchive
} = require('./dataSyncing/dataSync');

const { createNewNegotiator, createNewSource } = require("./dataPulling/reapitData");

const {
    transferToHubspot,
    transferToReapit,
    archiveDataTransferToHubspot,
    transferContactsToReapit
} = require('./dataSyncing/dataTransfer');

const dotenv = require('dotenv').config()
const { connectDB } = require('../src/dataPulling/cache');
connectDB()
const Contacts = require('./models/contacts_V1');
const Applicants = require('./models/applicants_V1')
const WebhooksTest = require("./models/webhooksTest");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



async function productionLogin() {

    try {
        const reapitAppId = process.env.appId;
        const reapitClientCode = process.env.clientCode;
        const reapitApiUrl = 'https://connect.reapit.cloud/token';
        const clientId = process.env.productionClient;
        const clientSecret = process.env.productionSecret;
        const grantType = 'client_credentials';
        // console.log(reapitAppId, reapitClientCode, clientId)
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const data = new URLSearchParams();
        data.append('grant_type', grantType);

        let config = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': "Basic `${authHeader}`"
            }
        }

        config = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': "Basic " + authHeader
            }
        }
        const response = await axios.post(reapitApiUrl, data, config)

        const { access_token, expires_in } = response.data;

        process.env.REAPIT_TOKEN = access_token
        // console.log(access_token);
        // console.log("Access token fetched...");

        setTimeout(productionLogin, (expires_in - 60) * 1000)

    } catch (error) {
        console.log(error);
    }
}

productionLogin()

async function starter1() {
    //Will call all the Reapit contacts and save in DB, one time funcation
    // it is required only if DB is unavailable for some reason
    // ELSE NOT REQUIRED - will take 1.5 hours to save all contacts, archives etc in DB
    // contactsData()
    // await fetchArchivedReapitData()
    // await fetchReapitData()
    // archivedContactsData()
    // await updateArchive()
    // const count = await Contacts.find()
    // console.log(count.length)
    // fs.writeFileSync('reapitContacts.json', JSON.stringify(count))
    // const data = fs.readFileSync('reapitContacts.json')
    // console.log(JSON.parse(data))
    // await archiveReapitApplicantsJournalsSync()
    // await contactJournal2Note()
    // await archiveDataTransferToHubspot()
    // await transferToHubspot() //Not needed, webhooks are used
    // await journalToNote()  //Reapit journals to hubspot notes - need to observe if H&H complaints of SYNC issue, if so use it
    //This is for transferring data from Hubspot to Reapit
    //Now HS supports, so we need to rewrite the Webhooks for transferring from HS and Reapit
    await Promise.all([
        dealActivityToJournal(),
        transferToReapit()
    ]);
    // await dealActivityToJournal();
    // await transferToReapit();

    // await transferContactsToReapit()
    // await Promise.all([
    // await transferToReapit()
    //     // archiveDataTransferToHubspot(),
    //     contactJournal2Note(),
    //     contactNotes2Journals(),
    //     journalToNote(),
    //     dealActivityToJournal()
    // ])
}

async function oneTimer() {

    // const data = fs.readFileSync('applicants1.json')
    // console.log(JSON.parse(data))
    // const applicants = JSON.parse(data)
    // var filter = []
    // for(var applicant of applicants){
    //     if(applicant.data.negotiatorIds.length > 1){

    //     }
    // }
    // console.log(filter)

    // await transferToHubspot();
    // await journalToNote()
    // await existingReapitContactsToHubspot()
    // await archivedContactsData()
    // await updateRoleInHubspot()
}


// setTimeout(starter1, 10000);

// setTimeout(() => {
//     console.log("waiting for access token...")
// }, 4000);

// setInterval(starter1, 2 * 60 * 60 * 1000);
// * every 1 hours
// cron.schedule('0 * * * *', () => {
//     starter1()
// });

// cron.schedule('0 */2 * * *', async () => {
//     await Promise.all([
//         transferContactsToReapit()
//     ])
// })


// cron.schedule('0 0 * * *', async () => {
//     await createNegotiatorsFromDealOwners();
// });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.get('/', async (req, res) => {
    return res.status(200).json({
        message: "Welcome TO Haus and Haus"
    });
});

app.post('/transfer-to-hubspot', async (req, res) => {
    try {
        // console.log(req.body);
        HubspotDataTransfer(req.body);

        return res.status(200).json({
            message: "TRANSFER TO HUBSPOT IN PROGRESS...",
        });
    } catch (error) {
        return res.status(400).json({
            message: "TRANSFER TO HUBSPOT INCOMPLETE.",
            error: error
        });
    }
});

//HS Webhooks to be implemented for CONTACTS
app.post('/contact', async (req, res) => {
    try {
        // console.log(req.body);
        const data = req.body;
        reapitContactToHubpotViaWebhooks(data)
        if (data.topicId == "contacts.created") {
            var contactBody = data.new;

            const createContact = await Contacts.create({ data: contactBody })
            return res.status(201).json({
                message: "New contact created in DB",
                result: createContact
            })

        } else if (data.topicId == "contacts.modified") {
            var contactBody = data.new;
            var updateDB = await Contacts.findOneAndUpdate({ "data.id": contactBody.id }, { data: contactBody }, { upsert: true });

            return res.status(200).json({
                message: "Contact updated in DB",
                result: updateDB
            })
        }
        //await reapitContactToHubpotViaWebhooks(data);
        //const contacts = await Contacts.find();
    } catch (error) {
        return res.status(400).json({
            message: "Error in creating new contact.",
            error: error
        });
    }
});

//HS Webhooks to be implemented for DEALS

app.post('/hubspot-deals-test', async (req, res) => {
    try {
        // console.log(req.body)
        await WebhooksTest.create(req.body)

        return res.status(200).json({ message: 'success' })

    } catch (error) {
        return res.status(400).json({
            message: "Error in deals endpoint",
            error: error,
        });
    }
})

app.post('/test-negotiator', async (req, res) => {
    try {
        const newNegotiator = req.body;

        // console.log(newNegotiator);
        // const createNegotiator = await createNewNegotiator(newNegotiator);
        // const createNegotiator = await createNegotiatorsFromDealOwners();
        // console.log(createNegotiator);
        // res.send(createNegotiator);
    
        const createSource = await createNewSource(newNegotiator);
        
    }
    catch (err) {
        console.log("this is ---------------------------------" + err);
    }

})
app.listen(8080, () => {
    console.log("server started at port 8080.");
});