const dotenv = require('dotenv').config();
const axios = require('axios');

const hubspot = require('@hubspot/api-client');
const Contacts = require('../models/contacts_V1');
const {
    ReapitDataTransfer,
    HubspotDataTransfer,
    ExistingHubspotDataTransfer,
    archiveReapitApplicants,
    hubspotContactsToReapit
} = require('./dataSync');
const {getContactById, findApplicant} = require('../dataPulling/reapitData');

const {createBulkContacts} = require('../dataPulling/hubspotData');
const fs = require('fs')
const ID_Track = require('../dbConfig/idMapModel');
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_TOKEN});

// const applicantDuplicacyLog = fs.createWriteStream('duplicacyLogs.json', { flags: 'a'})
async function transferToReapit(){
    console.log('Transfer to Reapit...');
    const body = await ReapitDataTransfer();

    console.log(`No update: ${body.transferToReapit?.length}, New Data: ${body.newReapitData?.length}, toUpdate: ${body.updateReapitData?.length}`);

    console.log(body.newReapitData[0])
    // return
    // console.log(body.newReapitData[1])
    // console.log(body.newReapitData[2])
    // console.log(body.updateReapitData[0])

    // return
    var successArr = [];
    var failureArr = [];

    var requestLog = []
    for(var data of body.newReapitData){

        var config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.master_url}`,
            data:{
                config: {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: 'https://platform.reapit.cloud/applicants/',
                    headers: {
                        'Content-Type': 'application/json-patch+json',
                        'api-version': '2023-02-15',
                        'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                        'Reapit-Customer': 'HAH'
                    },
                    data : data
                }
            }
        }
        try {

            var associatedEmails = []
            var associatedMobilePhones = []
            const associatedContacts = data.related.map(item => item.associatedId)
            for(var contact of associatedContacts){
                const fetchDetails = await getContactById(`https://platform.reapit.cloud/contacts/${contact}`)
                if(fetchDetails.email){
                    associatedEmails.push(fetchDetails.email)
                }
                if(fetchDetails.mobilePhone){
                    associatedMobilePhones.push(fetchDetails.mobilePhone)
                }
            }
            // console.log(associatedEmails)
            var queryString = associatedEmails.map(email => `emailAddresses=${email}`).join('&')
            var queryString1 = associatedMobilePhones.map(mobilephone => `contactDetail=${mobilephone}`).join('&')
            // console.log(queryString)
            const matchApplicant = await findApplicant(queryString,queryString1)
            // console.log(matchApplicant, "applicant")
            if(matchApplicant && matchApplicant["_embedded"]?.length > 0){
                console.log("Applicant already present.")
                var applicantToMap = {}
                if(matchApplicant["_embedded"].length === 1){
                    applicantToMap = matchApplicant["_embedded"][0]
                }else {
                    applicantToMap = matchApplicant["_embedded"].reduce((acc, currentObject) => {
                        if (!acc || new Date(currentObject.modified) > new Date(acc.modified)) {
                          return currentObject;
                        }
                        return acc;
                    }, null);
                }

                console.log("Latest Applicant to Map:", applicantToMap)

                delete data.related

                var logEntry = {
                    data: data,
                    associatedContacts: associatedContacts,
                    associatedEmails: associatedEmails,
                    associatedMobilePhones: associatedMobilePhones,
                    matchInApplicant: true,
                    matchResults: matchApplicant,
                    message: "Pushed to update applicants array."
                }

                // applicantDuplicacyLog.write(JSON.stringify(logEntry, null, 2) + '\n')

                body.updateReapitData.push({
                    id: applicantToMap.id,
                    eTag: applicantToMap._eTag,
                    data: data
                });

                const updateDealInHubspot = await hubspotClient.crm.deals.basicApi.update(data.metadata.hsObjectId,{
                    properties: {
                        applicant_id: applicantToMap.id
                    }
                },undefined);

            }else{

                // var matchArchivedApplicant = await findApplicant(`fromArchive=true&${queryString}`,queryString1)
                // if (
                //   matchArchivedApplicant &&
                //   matchArchivedApplicant["_embedded"].length > 0
                // ){
                //     console.log("Applicant present in archived base.");
                //     var applicantToMap = {};
                //     if (matchArchivedApplicant["_embedded"].length === 1) {
                //       applicantToMap = matchArchivedApplicant["_embedded"][0];
                //     } else {
                //       applicantToMap = matchArchivedApplicant["_embedded"].reduce(
                //         (acc, currentObject) => {
                //           if (
                //             acc ||
                //             new Date(currentObject.modified) >
                //               new Date(acc.modified)
                //           ) {
                //             return currentObject;
                //           }
                //           return acc;
                //         },
                //         null
                //       );
                //     }

                //     console.log("Archived Applicant to Map:", applicantToMap);

                //     delete data.related;

                //     var logEntry = {
                //       data: data,
                //       associatedContacts: associatedContacts,
                //       associatedEmails: associatedEmails,
                //       associatedMobilePhones: associatedMobilePhones,
                //       matchInApplicant: true,
                //       matchResults: matchArchivedApplicant,
                //       message: "Pushed to update applicants array.",
                //     };

                //     // applicantDuplicacyLog.write(
                //     //   JSON.stringify(logEntry, null, 2) + "\n"
                //     // );

                //     body.updateReapitData.push({
                //       id: applicantToMap.id,
                //       eTag: applicantToMap._eTag,
                //       data: data,
                //     });

                //     const updateDealInHubspot =
                //       await hubspotClient.crm.deals.basicApi.update(
                //         data.metadata.hsObjectId,
                //         {
                //           properties: {
                //             applicant_id: applicantToMap.id,
                //           },
                //         },
                //         undefined
                //       );
                // } else{

                var logEntry = {
                    data: data,
                    associatedContacts: associatedContacts,
                    associatedEmails: associatedEmails,
                    matchInApplicant: false,
                    matchResults: matchApplicant,
                    message: "Creating new applicant.",
                };
                //applicantDuplicacyLog.write(JSON.stringify(logEntry, null, 2) + '\n')
                // now even if one associated email id matches with the reapit applicant we will not
                // insert the deal
                const response = await axios(config);

                console.log(response.headers)
                // update applicant id to hubspot deal
                if(response.headers.location){
                    console.log("uploaded to reapit", response.headers.location, data.metadata.hsObjectId);
                    var id = response.headers.location.split("/")
                    console.log(id[id.length - 1]);

                    const updateDealInHubspot = await hubspotClient.crm.deals.basicApi.update(data.metadata.hsObjectId,{
                        properties: {
                            applicant_id: id[id.length - 1]
                        }
                    },undefined);
                }
            
            }

        } catch (error) {
            console.log(error.message);
            console.log('error in sending data to reapit');
        }
    }

    // fs.writeFileSync('logs.json', JSON.stringify(requestLog))

    // for (var toUpdate of body.updateReapitData){
    //     var id = toUpdate.id;
    //     Object.keys(toUpdate.data).forEach(key => {
    //         if (toUpdate.data[key] === undefined || toUpdate.data[key] === null) {
    //           delete toUpdate.data[key];
    //         }
    //     });

    //     Object.keys(toUpdate.data.metadata).forEach(key => {
    //         if (toUpdate.data.metadata[key] === undefined || toUpdate.data.metadata[key] === null) {
    //           delete toUpdate.data.metadata[key];
    //         }
    //     });

    //     try {
    //         var config = {
    //             method: 'post',
    //             maxBodyLength: Infinity,
    //             url: `${process.env.master_url}`,
    //             data:{
    //                 config: {
    //                     method: 'patch',
    //                     maxBodyLength: Infinity,
    //                     url: `https://platform.reapit.cloud/applicants/${toUpdate.id}`,
    //                     headers: {
    //                         // If-Match: "ETCH"
    //                         'If-Match': `${toUpdate.eTag}`,
    //                         'api-version': '2023-02-15',
    //                         'Content-Type': 'application/json',
    //                         'Authorization': 'Bearer ' + process.env.REAPIT_TOKEN,
    //                         'Reapit-Customer': 'HAH'
    //                     },
    //                     data: JSON.stringify(toUpdate.data)
    //                 }
    //             }
    //         }

    //         var response = await axios(config);
    //         console.log(`update successfull: ${response.headers}`);
    //     } catch (error) {
    //         console.log(error);
    //     }
    // }
}

// * took nearly 20 minutes, will excedd since worst case is we have

//#################################################################################################
// MANUAL UPDATE API https://platform.reapit.cloud/contacts/${contact.id} - for missing owners in RT
//##################################################################################################

async function transferContactsToReapit(){
    console.log("Contact syncing to reapit...");

    const result = await hubspotContactsToReapit();
    console.log(`Contacts to create: ${result.createBatch.length} | Contacts to update: ${result.updateBatch.length} | No change: ${result.noChangeBatch.length}`);

    // console.log(result.createBatch)
    // console.log(result.updateBatch)
    // return
    for(var contact of result.createBatch){
        try {

            var config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `${process.env.master_url}`,
                data:{
                    config: {
                        method: 'post',
                        maxBodyLength: Infinity,
                        url: 'https://platform.reapit.cloud/contacts/',
                        headers: {
                            'api-version': '2023-02-15',
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + process.env.REAPIT_TOKEN,
                            'Reapit-Customer': 'HAH'
                        },
                        data: contact
                    }
                }
            }

            const response = await axios(config);
            console.log("Contact uploaded.",response.headers.location);
            if(response.headers.location){
                var id = response.headers.location.split("/");
                const updateContactInHubspot = await hubspotClient.crm.contacts.basicApi.update(contact.metadata.hubspotContactId, {
                    properties: {
                        reapit_contact_id: id[id.length - 1]
                    }
                }, undefined);

                // this is unnecessary because when we create a contact in reapit through webhook, it will also create it in DB.
                var latestContact = await getContactById(response.headers.location)
                if(latestContact.id) {
                    await Contacts.create({data: latestContact})
                    console.log("contact inserted inDB")
                }else{
                    console.log("error in storing contact to DB")
                }

            }else{
                console.log("Failure in creating contact.");
            }

        } catch (error) {
            console.log(error, "error in sending contact to reapit");
        }
    }
//AHABB - Some ids aer missed while updating the contacys in RT
    for(var contact of result.updateBatch){
        try {
            if(contact.id){
                var latestContact = await getContactById(`https://platform.reapit.cloud/contacts/${contact.id}`);
                var config = {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: `${process.env.master_url}`,
                    data:{
                        config: {
                            method: 'patch',
                            maxBodyLength: Infinity,
                            url: `https://platform.reapit.cloud/contacts/${contact.id}`,
                            headers: {
                                // If-Match: "ETCH"
                                'If-Match': `${latestContact._eTag}`,
                                'api-version': '2023-02-15',
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + process.env.REAPIT_TOKEN,
                                'Reapit-Customer': 'HAH'
                            },
                            data: JSON.stringify(contact.data)
                        }
                    }
                }

                const response = await axios(config);
                console.log(response.headers.etag, "Contact successfully updated.");
                const temp_contact = await getContactById(`https://platform.reapit.cloud/contacts/${contact.id}`)
                if(temp_contact._eTag){
                    const updateInDb = await Contacts.findOneAndUpdate({"data.id": contact.id}, {
                        "data._eTag": temp_contact._eTag,
                        "data.modified": temp_contact.modified
                    })
                    console.log("etag updated in DB");
                }
            }

        } catch (error) {
            console.log(error, "error in updating contact on reapit.");
        }
    }

}

async function transferToHubspot(){
    console.log('Transfer to Hubspot...');
    const result = await ExistingHubspotDataTransfer();
    //console.log(`Length of newHubspotDealsData : ${result.newHubspotDealsData.length}`);
    console.log(`No update: ${result.transferToHubspotDeals.length}, NewData: ${result.newHubspotDealsData.length}, toUpdate: ${result.updateHubspotDealsData.length}`);
    //console.log(result.updateHubspotDealsData)
    // return
    // for(var body of result.newHubspotDealsData){

    //     const SimplePublicObjectInput = body;

    //     try {
    //         const createDealResponse = await hubspotClient.crm.deals.basicApi.create(SimplePublicObjectInput);
    //         //console.log(createDealResponse);
    //         console.log("Transfered to Hubspot successfully...");
    //     } catch (error) {
    //         console.log(error.body);
    //         //console.log(Object.keys(error));
    //     }
    // }

    for( var updates of result.updateHubspotDealsData){
        console.log('Updating started...');
        const dealId = `${updates.properties.hs_object_id}`;

        delete updates.properties.hs_object_id;
        delete updates.properties.hs_created_by_user_id;
        delete updates.properties.hs_analytics_latest_source;
        delete updates.properties.hs_analytics_source;
        const SimplePublicObjectInput = {properties: updates.properties};
        //console.log(SimplePublicObjectInput);
        const idProperty = undefined;
        try {
            const updateResponse = await hubspotClient.crm.deals.basicApi.update(dealId,SimplePublicObjectInput,idProperty);
            console.log("update deal completed");
        } catch (e) {
            console.log(e.body);
        }
    }

    console.log("Transfer Completed : All applicants are created/updated successfully.");
}

async function archiveDataTransferToHubspot(){
    console.log("Archive data transfer to Hubspot function started.");

    var data = await archiveReapitApplicants();
    console.log(data)
    //console.log(data.newContact, data.updateContact)
    for(var newData of data.newContact){
        newData.associations = [];
        try {
            const createResponse = await hubspotClient.crm.contacts.basicApi.create(newData);
            console.log("New contact created for archived applicant.");
        } catch (error) {
            console.log(error);
            console.log(newData);
        }
    }

    for(var updateData of data.updateContact){
        try {
            const updateResponse = await hubspotClient.crm.contacts.basicApi.update(updateData.id, updateData.data);
            console.log("Contact updated successfully for archived applicant.");
        } catch (error) {
            console.log(error);
            console.log(updateData);
        }
    }
    // try {
    //     var uniqueEmails = [];
    //     var dataToBePushed = []
    //     for(var item of data.newContact){
    //         if(!uniqueEmails.includes(item.properties.email)){
    //             dataToBePushed.push(item)
    //             uniqueEmails.push(item.properties.email)
    //         }

    //     }
    //     // const deduplicatedArray = data?.newContact.reduce((accumulator, current) => {
    //     //     if (!uniqueEmails[current.email]) {
    //     //         uniqueEmails[current.email] = true;
    //     //         accumulator.push(current);
    //     //     }
    //     //     return accumulator;
    //     // }, []);
    //     // await createBulkContacts(dataToBePushed)
    // } catch (error) {
    //     console.log(error)
    // }

}

//transferToReapit()

module.exports = { transferToReapit, transferToHubspot, archiveDataTransferToHubspot, transferContactsToReapit }


//{
//     "statusCode": 400,
//     "dateTime": "2023-02-28T04:37:35.7105491Z",
//     "description": "Unable to create applicant: Entity \"Contact\" (OXF20000001) was not found."
//   }
