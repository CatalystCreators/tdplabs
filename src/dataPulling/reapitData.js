/**
 * TODO: create middleware that pulls data from Reapit APIs and push that data to Hubspot
 * TODO: do the same for Hubspot
 * * PACKAGE REQUIREMENTS
 *      - dotenv
 *      - axios
 *      - node-cron
 * * Data should be fetched every 5 minutes
 * ! How to regenerate new token??
*/

const dotenv = require('dotenv').config();
const axios = require('axios');

const Applicants = require('../models/applicants_V1');
const Contacts = require('../models/contacts_V1');
const Areas = require("../models/areas");
const Sources = require("../models/sources");
const NodeCache = require('node-cache');
const Reapit_Applicants = require('../models/reapitApplicants');
const Archived_Reapit_Contacts = require('../models/archivedReapitApplicants');
const Reapit_Contacts = require('../models/reapitContacts');

// const { 
//     findDocumentsWithProjection,
//     findDocument,
//     createDocument
// } = require('./cache');
const fs = require('fs');
const cache = new NodeCache();
// var config = {
//     method: 'post',
//     maxBodyLength: Infinity,
//     url: `${process.env.master_url}`,
//     data:{
//         config: {
//             method: 'get',
//             maxBodyLength: Infinity,
//             url: `https://platform.reapit.cloud/contacts/?pageSize=${pageSize}&pageNumber=${pageNumber}`,
//             headers: {
//                 'accept': 'application/json',
//                 'api-version': '2020-01-31',
//                 'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
//                 'Reapit-Customer': 'HAH'
//             }
//         }
//     }
// }
const hubspot = require('@hubspot/api-client');
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_TOKEN });

//*---------------------------------------------------------------------------------------------------
//*-----------------------------* GET DATA APIS *-----------------------------------------------------

async function fetchReapitData() {
    try {
      var pageSize = 99;
      var pageNumber = 1;
      var finalData = [];
      var testingData = [];
      var flag = true;
      //console.log(process.env.REAPIT_TOKEN);
      var finalApplicants = []
      var archivedFinalApplicants = []
      while (flag) {
        var config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.master_url}`,
          data:{
            config: {
              method: 'get',
              maxBodyLength: Infinity,
              url: `https://platform.reapit.cloud/applicants/?pageSize=${pageSize}&pageNumber=${pageNumber}&age=new&embed=areas&embed=negotiators&embed=source`,
              headers: {
                'accept': 'application/json',
                'api-version': '2020-01-31',
                'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                'Reapit-Customer': 'HAH'
              }
            }
          }
        }

        try {
            //flag = false
            const reapit_data = await axios(config);
            var xData = [...reapit_data.data._embedded]
            var datav2 = []

            for (var x of xData) {
                finalApplicants.push({"data": x})
            }
            
            console.log(`Reapit data loading...${pageNumber}`);
            if (pageNumber === reapit_data.data.totalPageCount) {
              flag = false;
              console.log("Applicants fetched.");
            }
            // flag = false
            pageNumber = pageNumber + 1;
        } catch (error) {
            flag = true
            console.log(error, "retrying again applicants.");
        }
      }
      //console.log(finalApplicants)
      var applicant_number = finalApplicants.length;
      console.log("Total applicants from Reapit: ", applicant_number);
      // fs.writeFileSync('applicants1.json', JSON.stringify(finalApplicants))
      return {
        reapitApplicants: finalApplicants,
        archivedApplicants: archivedFinalApplicants
      }
    } catch (error) {
      console.error("An error occurred while fetching Reapit data:", error);
      throw error;
    }
}

async function fetchArchivedReapitData() {
    try {
      var pageSize = 99;
      var pageNumber = 1;
      var flag = true;
      
      var archivedFinalApplicants = []
      while (flag) {
        var config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.master_url}`,
          data:{
            config: {
              method: 'get',
              maxBodyLength: Infinity,
              url: `https://platform.reapit.cloud/applicants/?pageSize=${pageSize}&pageNumber=${pageNumber}&age=new&embed=areas&embed=negotiators&embed=source&fromArchive=true`,
              headers: {
                'accept': 'application/json',
                'api-version': '2020-01-31',
                'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                'Reapit-Customer': 'HAH'
              }
            }
          }
        }

        try {
            const reapit_data = await axios(config);
            var xData = [...reapit_data.data._embedded]
            var datav2 = []

            for (var x of xData) {
                // await Archived_Reapit_Applicants.create({"data": x})
                archivedFinalApplicants.push({"data": x})
            }
            xData.forEach(async (x) => await Archived_Reapit_Applicants.create({"data":x}))
            // flag = false
            
            console.log(`Archived Reapit data loading...${pageNumber}`);
            if (pageNumber === reapit_data.data.totalPageCount) {
              flag = false;
              console.log("Archived Applicants fetched.");
            }
            pageNumber = pageNumber + 1;
        } catch (error) {
            flag = true
            console.log(error, "retrying again applicants.");
        }
      }
      //console.log(finalApplicants)
      var applicant_number = archivedFinalApplicants.length;
      console.log("Total archived applicants from Reapit: ", applicant_number);
      
      return {
        archivedApplicants: archivedFinalApplicants
      }
    } catch (error) {
      console.error("An error occurred while fetching Reapit data:", error);
      throw error;
    }
}

async function negotiatorsData() {
    try {
      var pageSize = 99;
      var pageNumber = 1;
      var finalData = [];
      
      var flag = true;
      while (flag) {
        
        var negotiatorsConfig = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.master_url}`,
          data:{
            config: {
              method: 'get',
              maxBodyLength: Infinity,
              url: `https://platform.reapit.cloud/negotiators/?pageSize=${pageSize}&pageNumber=${pageNumber}`,
              headers: {
                'accept': 'application/json',
                'api-version': '2020-01-31',
                'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                'Reapit-Customer': 'HAH'
              }
            }
          }
          
        }
  
        const negotiators = await axios(negotiatorsConfig);
        finalData.push(...negotiators.data._embedded);
  
        console.log(`Negotiators Data loading...${pageNumber}`);
  
        if (pageNumber === negotiators.data.totalPageCount) {
          flag = false;
  
          console.log(`Negotiators Data Loaded Successfully.`);
        }
        pageNumber = pageNumber + 1;
      }
      console.log("Negotiators: ", finalData.length);
      return finalData;
    } catch (error) {
      console.error("An error occurred while fetching Negotiators data:", error);
      throw error;
    }
}

async function fetchAllAreas() {
    try {
      var pageSize = 99;
      var pageNumber = 1;
      var finalData = [];
      
      var flag = true;
      while (flag) {
        
        var areasConfig = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.master_url}`,
          data:{
            config: {
              method: 'get',
              maxBodyLength: Infinity,
              url: `https://platform.reapit.cloud/areas/?pageSize=${pageSize}&pageNumber=${pageNumber}`,
              headers: {
                'accept': 'application/json',
                'api-version': '2020-01-31',
                'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                'Reapit-Customer': 'HAH'
              }
            }
          }
          
        }
  
        const areas = await axios(areasConfig);

        // var xData = [...areas.data._embedded];

        // xData.forEach(async (x) => await Areas.create(x));
        
        finalData.push(...areas.data._embedded);
  
        console.log(`Areas Data loading...${pageNumber}`);
  
        if (pageNumber === areas.data.totalPageCount) {
          flag = false;
          console.log(`Areas Data Loaded Successfully.`);
        }
        pageNumber = pageNumber + 1;
      }
      console.log("Areas: ", finalData.length);
      // fs.writeFileSync('areas.json', JSON.stringify(finalData))
      return finalData;
    } catch (error) {
      console.error("An error occurred while fetching areas data:", error);
      throw error;
    }
}

async function fetchAllSources() {
    try {
        var pageSize = 99;
        var pageNumber = 1;
        var finalData = [];
        
        var flag = true;
        while (flag) {
            
            var sourcesConfig = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `${process.env.master_url}`,
                data:{
                    config: {
                        method: 'get',
                        maxBodyLength: Infinity,
                        url: `https://platform.reapit.cloud/sources/?pageSize=${pageSize}&pageNumber=${pageNumber}`,
                        headers: {
                            'accept': 'application/json',
                            'api-version': '2020-01-31',
                            'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                            'Reapit-Customer': 'HAH'
                        }
                    }
                }
            }
        
            const sources = await axios(sourcesConfig);

            // var xData = [...sources.data._embedded];
            // console.log(xData)
            // xData.forEach(async (x) => {
            //     await Sources.create(x)
            // });
            finalData.push(...sources.data._embedded);
        
            console.log(`Sources Data loading...${pageNumber}`);
        
            if (pageNumber === sources.data.totalPageCount) {
                flag = false;
                console.log(`Sources Data Loaded Successfully.`);
            }
            pageNumber = pageNumber + 1;
        }
        console.log("Sources: ",finalData.length);
        // fs.writeFileSync('sources.json', JSON.stringify(finalData))
        return finalData;
    } catch (error) {
        console.error("An error occurred while fetching sources data:", error);
        throw error;
    }
}

async function contactsData(){
    var pageSize = 100;
    var pageNumber = 1;
    var finalData = [];
    var testingData = [];
    var flag = true;
    while(flag){
        var config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.master_url}`,
            data:{
                config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/contacts/?pageSize=${pageSize}&pageNumber=${pageNumber}&embed=relationships&embed=negotiators&embed=source`,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
                }
            }
        }
        
        const contact_data = await axios(config);
        var xData = [...contact_data.data._embedded]

        xData.forEach(async (x) => await Contacts.create({"data": x}))

        // *await transferToHubspot(contactsArray)

        // testingData.push(...contact_data.data._embedded);
        // flag = false;

        
        console.log(`Contact data loading...${pageNumber} ---- ${contact_data.data._embedded.length}`);
        if(pageNumber === contact_data.data.totalPageCount){
            flag = false;
            console.log("Reapit contacts fetched.");
        }
        pageNumber = pageNumber + 1;
    }
    
    return Contacts.find();
}


async function archivedContactsData(){
    var pageSize = 100;
    var pageNumber = 1;
    var finalData = [];
    var testingData = [];
    var flag = true;
    while(flag){
        var config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.master_url}`,
            data:{
                config: {
                    method: 'get',
                    maxBodyLength: Infinity,
                    url: `https://platform.reapit.cloud/contacts?embed=relationships&embed=negotiators&embed=source&fromArchive=true&pageSize=${pageSize}&pageNumber=${pageNumber}`,
                    headers: {
                        'accept': 'application/json',
                        'api-version': '2020-01-31',
                        'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                        'Reapit-Customer': 'HAH'
                    }
                }
            }
        }
        
        const contact_data = await axios(config);
        var xData = [...contact_data.data._embedded]

        xData.forEach(async (x) => await Contacts.create({"data":x}))

        // *await transferToHubspot(contactsArray)

        // testingData.push(...contact_data.data._embedded);
        // flag = false;

        
        console.log(`Archived Contact data loading...${pageNumber} ---- ${contact_data.data._embedded.length}`);
        // flag = false
        if(pageNumber === contact_data.data.totalPageCount){
            flag = false;
            console.log("Archived Reapit contacts fetched.");
        }
        pageNumber = pageNumber + 1;
    }
    
    // fs.writeFileSync('archiveContactsBase.json', JSON.stringify(finalData))
    return finalData;
}

// *---------------------------------------------------------------------------------------------------
// *------------------------------------* GET DATA BY ID APIS *----------------------------------------

// ? to be tested
async function getContactById(url){
    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: url,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
            }
        }
    }

    try {
        
        const apiResponse = await axios(config);
    
        //console.log(apiResponse.data);
        return apiResponse.data
    } catch (error) {
        return error
    }

}

// ? to be tested
async function fetchNegotiatorById(id){

    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/negotiators/${id}`,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
            }
        }
    }
    
    try {
        const response = await axios(config);
        //console.log(response);
        return response.data;  
    } catch (error) {
        return error
    }
}

// ? to be tested
async function fetchApplicantById(id){

    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/applicants/${id}?embed=negotiators`,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
            }
        }
    }
    
    try {
        const response = await axios(config);
        console.log(response);
        return response.data;  
    } catch (error) {
        return error
    }
}


// ? to be tested
async function getSourceById(id){
    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/sources/${id}`,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
            }
        }
    }
    
    try {
        const response = await axios(config);
        //console.log(response.data);
        return response.data;  
    } catch (error) {
        //console.log(error);
        return error
    }
}

// ? to be tested
async function fetchAreaById(id){
    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/areas/${id}`,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
            }
        }
    }
    
    try {
        const response = await axios(config);
        return response.data;  
    } catch (error) {
        return error
    }
}

// ? to be tested
async function fetchRoleInContact(id){
    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/contacts/${id}?embed=relationships&embed=negotiators&embed=source`,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
            }
        }
    }
    
    try {
        const response = await axios(config);
        //console.log(response.data._embedded);
        return response.data._embedded;  
    } catch (error) {
        return error;
    }
}

async function fetchRelationshipsInContact(id){
    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/contacts/${id}/relationships`,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
            }
        }
    }
    
    try {
        const response = await axios(config);
        //console.log(response.data._embedded);
        return response.data;  
    } catch (error) {
        // console.log(error)
        return error;
    }
}

async function fetchApplicantJournal(id){

    try {
        var pageSize = 99;
        var pageNumber = 1;
        var finalData = [];
        
        var flag = true;
        while (flag) {
          
          var journalsConfig = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.master_url}`,
            data:{
              config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/journalEntries?pageSize=${pageSize}&pageNumber=${pageNumber}&associatedId=${id}`,
                headers: {
                  'accept': 'application/json',
                  'api-version': '2020-01-31',
                  'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                  'Reapit-Customer': 'HAH'
                }
              }
            }
            
          }
    
          const journals = await axios(journalsConfig);
          finalData.push(...journals.data._embedded);
    
          console.log(`journals Data loading...${pageNumber}`);
    
          if (pageNumber === journals.data.totalPageCount || journals.data.totalPageCount == 0 ) {
            flag = false;
    
            console.log(`journals Data Loaded Successfully.`);
          }
          
          pageNumber = pageNumber + 1;
        }
        console.log("journals: ", finalData.length);
        return finalData;
    } catch (error) {
        console.error("An error occurred while fetching Journals data:", error);
        throw error;
    }
    // var config = {
    //     method: 'post',
    //     maxBodyLength: Infinity,
    //     url: `${process.env.master_url}`,
    //     data:{
    //         config: {
    //             method: 'get',
    //             maxBodyLength: Infinity,
    //             url: `https://platform.reapit.cloud/journalEntries/?pageSize=99&associatedId=${id}`,
    //             headers: {
    //                 'accept': 'application/json',
    //                 'api-version': '2020-01-31',
    //                 'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
    //                 'Reapit-Customer': 'HAH'
    //             }
    //         }
    //     }
    // }
    
    // try {
    //     const response = await axios(config);
    //     //console.log(response.data._embedded);
    //     return response.data._embedded;  
    // } catch (error) {
    //     return error
    // }
}

async function findApplicant(filter, filter1){
    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://platform.reapit.cloud/applicants/?age=new&${filter}&${filter1}`,
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                }
            }
        }
    }
    
    try {
        const response = await axios(config);
        return response.data;  
    } catch (error) {
        return error
    }
}

// *----------------------------------------------------------------------------------------------------
// *--------------------------------* POST DATA APIS *--------------------------------------------------

// ? to be tested
async function createNewNegotiator(body){
    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.master_url}`,
        data:{
            config: {
                method: 'post',
                headers: {
                    'accept': 'application/json',
                    'api-version': '2020-01-31',
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                },
                url: 'https://platform.reapit.cloud/negotiators/',
                data: body
            }
        }
    }
    
    try {
        const response = await axios(config);
        //console.log(response);
        return response.headers.location;
    } catch (error) {
        return error.message
    }
}

// ? to be tested
async function createNewContactInReapit(body){

    let data = body;
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
                    'Content-Type': 'application/json-patch+json',
                    'accept': 'application/json', 
                    'api-version': '2020-01-31', 
                    'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                    'Reapit-Customer': 'HAH'
                },
                data : data
            }
        }
    }
    
    try {
        
        const response  = await axios.request(config);
        console.log(response.headers.location, "res we want.");
        if(response.headers.location){
            var id = response.headers.location.split("/");
            const updateContactInHubspot = await hubspotClient.crm.contacts.basicApi.update(data.metadata.hubspotContactId, {
                properties: {
                    reapit_contact_id: id[id.length - 1]
                }
            }, undefined);

            // this is unnecessary because when we create a contact in reapit through webhook, it will also create it in DB.
            // var latestContact = await getContactById(response.headers.location)
            // if(latestContact.id) {
            //     await Contacts.create({data: latestContact})
            //     console.log("contact inserted inDB")
            // }else{
            //     console.log("error in storing contact to DB")
            // }
            
        }else{
            console.log("Failure in creating contact.");
        }
        // const updateContactInHubspot = await hubspotClient.crm.contacts.basicApi.update(data.metadata.hubspotContactId, {
        //     properties: {
        //         reapit_contact_id: id[id.length - 1]
        //     }
        // }, undefined);
        return response.headers;
    } catch (error) {
        console.log(data);
        return error.message;
    }
} 

// ? to be tested
async function createNewArea(body){
    try {
        var config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.master_url}`,
            data:{
                config: {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: 'https://platform.reapit.cloud/areas/',
                    headers: { 
                        'Content-Type': 'application/json-patch+json',
                        'accept': 'application/json', 
                        'api-version': '2020-01-31', 
                        'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                        'Reapit-Customer': 'HAH'
                    },
                    data : body
                }
            }
        }
        //console.log(data);
        const response = await axios(config);
        console.log(response.headers.location);
        var id = response.headers.location.split("/")
        return id[id.length - 1];
    } catch (error) {
        console.log(error?.message);
        return error;
    }
}

// ? to be tested
async function createNewSource(body){
    try {
        var config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.master_url}`,
            data:{
                config: {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: 'https://platform.reapit.cloud/sources/',
                    headers: { 
                        'Content-Type': 'application/json-patch+json',
                        'accept': 'application/json', 
                        'api-version': '2020-01-31', 
                        'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                        'Reapit-Customer': 'HAH'
                    },
                    data : body
                }
            }
        }
        //console.log(data);
        const response = await axios(config);
        console.log(response.headers.location);
        var id = response.headers.location.split("/")
        return id[id.length - 1];
    } catch (error) {
        console.log(error);
        return error
    }
}

async function createJournal(body){
    try {
        var config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.master_url}`,
            data:{
                config: {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: 'https://platform.reapit.cloud/journalEntries/',
                    headers: { 
                        'Content-Type': 'application/json-patch+json',
                        'accept': 'application/json', 
                        'api-version': '2020-01-31', 
                        'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                        'Reapit-Customer': 'HAH'
                    },
                    data : body
                }
            }
        }
        //console.log(data);
        const response = await axios(config);
        console.log(response.status)
        return response.status;
        
    } catch (error) {
        //console.log(error);
        return error;
    }
}

async function createBulkJournalEntries(arr){
    try {

        var batchArray = []
        for(let i = 0; i < arr.length; i += 99){
            let chunk = arr.slice(i, i + 99)
            batchArray.push(chunk)
        }

        for(var batch of batchArray){

            var config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `${process.env.master_url}`,
                data:{
                    config: {
                        method: 'post',
                        maxBodyLength: Infinity,
                        url: 'https://platform.reapit.cloud/journalEntries/bulk',
                        headers: { 
                            'Content-Type': 'application/json-patch+json',
                            'accept': 'application/json', 
                            'api-version': '2020-01-31', 
                            'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
                            'Reapit-Customer': 'HAH'
                        },
                        data : {createJournalEntry: batch}
                    }
                }
            }
            const response = await axios(config);
            console.log(response.status)
        }
        //console.log(data);
        return 204;
        
    } catch (error) {
        //console.log(error);
        return error;
    }
}

async function updateReapitContact(body){
    try {
        var latestContact = await getContactById(
          `https://platform.reapit.cloud/contacts/${body.id}`
        );
        var config = {
          method: "post",
          maxBodyLength: Infinity,
          url: `${process.env.master_url}`,
          data: {
            config: {
              method: "patch",
              maxBodyLength: Infinity,
              url: `https://platform.reapit.cloud/contacts/${body.id}`,
              headers: {
                // If-Match: "ETCH"
                "If-Match": `${latestContact._eTag}`,
                "api-version": "2023-02-15",
                "Content-Type": "application/json",
                Authorization: "Bearer " + process.env.REAPIT_TOKEN,
                "Reapit-Customer": "HAH",
              },
              data: JSON.stringify(body.data),
            },
          },
        };

        const response = await axios(config);
        console.log("Contact successfully updated. ", body.id);
        return {data: body, success: true}
    } catch (error) {
        return error
    }
}

// *----------------------------------------------------------------------------------------------------

async function login(){
    try {
        const apiUrl = 'https://connect.reapit.cloud/token';
        const clientId = process.env.clientId; // Your client ID
        const clientSecret = process.env.clientSecret; // Your client secret
        const username = process.env.username; // Your Reapit username
        const password = process.env.password; // Your Reapit password

        const requestBody = new URLSearchParams();
        requestBody.append('grant_type', 'client_credentials');
        requestBody.append('client_id', clientId);
        requestBody.append('client_secret', clientSecret);
        requestBody.append('username', username);
        requestBody.append('password', password);

        const response = await axios.post(apiUrl, requestBody.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        
        const accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in;
        process.env.REAPIT_TOKEN = accessToken
        
        //console.log(process.env.REAPIT_TOKEN);
        //setTimeout(login, 2000)
        setTimeout(login, (expiresIn - 60)*1000);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function productionLogin(){

    try {
        const reapitAppId = process.env.appId;
        const reapitClientCode = process.env.clientCode;
        const reapitApiUrl = 'https://connect.reapit.cloud/token';
        const clientId = process.env.productionClient;
        const clientSecret = process.env.productionSecret;
        const grantType = 'client_credentials';
        console.log(reapitAppId, reapitClientCode, clientId)
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
        const data = new URLSearchParams();
        data.append('grant_type', grantType);
    
        const config = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${authHeader}`
            }
        }
    
        const response = await axios.post(reapitApiUrl, data, config)
        
        const {access_token, expires_in} = response.data;

        process.env.REAPIT_TOKEN = access_token
        console.log(access_token);
        console.log("Access token fetched...");

        setTimeout(productionLogin, (expires_in - 60)*1000)

    } catch (error) {
        console.log(error);
    }
}

async function test1(){
    await productionLogin()
    fetchApplicantJournal("OPN233042")
    fetchAllSources();
    //createJournal({"associatedType":"applicant","associatedId":"TLH230207","description":"Deal Activity |  moved the deal to Qualified Interest (Offplan Sales Pipeline) | 2023-05-22T13:48:58.493Z","negotiatorId":"JAS"})
    // fetchAllAreas()
    // negotiatorsData()
    // fetchAllAreas()
    // fetchAllAreas()
    // negotiatorsData()
    // fetchReapitData()
}

// test1()

module.exports = {
  fetchReapitData,
  fetchApplicantById,
  createNewSource,
  fetchAllSources,
  getSourceById,
  fetchNegotiatorById,
  negotiatorsData,
  getContactById,
  createNewNegotiator,
  contactsData,
  fetchAllAreas,
  fetchAreaById,
  createNewArea,
  createNewContactInReapit,
  fetchApplicantJournal,
  createJournal,
  fetchRoleInContact,
  reapitContacts: cache.get("reapitContacts"),
  reapitApplicants: cache.get("reapitApplicants"),
  createBulkJournalEntries,
  fetchArchivedReapitData,
  archivedContactsData,
  fetchRelationshipsInContact,
  findApplicant,
  updateReapitContact,
};