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
async function loginFromRefreshToken() {
    try {
        const formData = new URLSearchParams();
        formData.append('redirect_uri', 'https://developers.reapit.cloud/apps');
        formData.append('client_id', '4l6j0unqol4k02bsl6q89odem5');
        formData.append('grant_type', 'refresh_token');
        formData.append('refresh_token', 'eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.f_q_VsdgpCwHgaxYVlA1o0Q5BdgNpSR52G8Am07CZU1iKiI1_DjUWtT89bWOEZHCPMk61V0li5VzNgcnV_LPbPr-b7UOcN5bt1rBKVe0dc4cPdo54oSBuHmhr-mv_T0v3KM_HVX-acb_5BMh3zkqSYeykCcsWJsmW-RtAtLr5uXOQUnJu7rQzBagzn7ZBsTY1msT-IK_f4Ud2pEtTuzvBsDWhkKkrwULtD_b_Pt0n6TwtGmzBXqvyh3w_qa1Kza89ol3ccz-ODntFnEqwhV-j35M7WUAJxeRmFLd2sMGXBQCz6p_sTK_vPsqoxBXir9QlplBsp06Yhz2o8K48kPmeQ.CxT5eWgi8oOSkTGX.M25U7P_ohPqD99roAQ0jHVqb7EvXFhngNsxLEkxDyA88TSuwKUFTUBgDOy7X_Ty6x-zqXCjrIERvoVWFDfLt_gCr5q8CIhgAbyjXRxyfvP14-UT3Bmc02kQSLDbY1cOejw_uSIAxuibXx-RFCWXrQc17Z33r4Kh-VTgWnWty9JA7DLH9wcLyw1T1vNCmBpBjaedWb9Jp10AtTEF81k2c2dV3f4l0BXtEQQy6GVG2sOH5cj4Rk02G9TJ8c2Sm6iusbZt65mvBevZqrdaAfG_25oFxJSBfYIdIDmEeEs7ozeu3tL863pa4hw_vyaRuWc9_yBa21ycKynNELMFfL4g-HyDrZfcC3GF67TDogiC2vkT14UFevhqvMyjXpq6ojlroWZO0YuSAMaw0-klQAC1I81maTE9UgJpmZrDts3LMemUb_RI1ZMY7-V7X3GuYJYv5_OZMwqSkMJSu4nSUwGV36uZ5knMxUDaz3flTZTyx7niNodFsVm7uDnuhQuDp2i74OJY6SsNHBRC0Ol9YxBHfgD-YbciUIZSisd_J8tVIVKVd9JBrxJfnmmahYrmMc0aQkJVhMgtsIaagOkRyE2IR68PPo2IJZJZWFpEkFrIE1Q5ApbymrFU8pecTHsVlqnuJ1eikFo84etF44zyu59dwZV7fXMMuQXVgNoBwA37yETOOprrUHnBPimAKehvv-GKQ4RxTwcy6kYcIbksldvsX4e6NTZJ8Z4NR9o10VJpZWhEUL94SHhQoCwm069_azxbG8qjxphcUzAG5JOjiIHylLYp3v6pnCtvN4NmvWgVRcLyrfNfT8Y8SEIzS-XCEAEP6_oEMG5U1hQ-CwL2w6aoNzrimZ8E2MGONxZdkzzPSV6ddxTD62_VIPrf_pxWm3wEzF2lWDftQ4BOaHi5isljEeyFFIy9gBTy5Vy-jrsuqxUyc6ZsUahIUUZcdZMT8B_zM9vi9kojA6uFu5l0PiUptDa9QdSF-37t6orlzyiT8DLWdUP0wPJnAtC6esFw1bQqma_ShPrIKdnwf-qjv8GugE-7DGMDIoAYjFTLbNVEFpccQAEabWrk-89Q2CyZlbig4LXd18mVs7Fp0GEnE_hGokMQpcm4ZDwgL6SpL3VYyWybZGr25hzyswlv21R0h11DgkIlHYSqCTg6O0BbNnaA1VeQxfjt1wo9Ig54b8vyVQD7BB9X0ifse56Jb62XDh7kfvRh_jhY1Mh7aFIzGPSxA_hIP6PsYQTcaEIIpsK_7WYtgCg42f8pfASAN0VHIUW0sJPX8XKAYDD6ZUf44NIIwao0gLfSU79xB6VWZSiFtvOBIOmjWlKQG-bo4ZDPalNSKVLqG4uwd-rmprDRnR8vA_idVmIDv1-kXK5ud0fxJB3s7CAuQIbGjE_tjjLZIidubgeu4b1Ip0AHwllPzW7mVa4AaYi2w2tkqUq-DBtze2dbBYqtDsIpFOwvdmAO4Ac4m4sfAX_OGBU0Can7AI6wjaGXSClQO2hKU2kcoqobT5Y9gdeNBIMDc0hbK3RJJSAtM84SREpXj6cmRmVHiEUHylMxr4dmcUZnTaHPd36jEVVG9nIFoqqO84mWl5oKhUHBumlLkU5ITBDyAqm9axgBeT2vGT_43cHnKtmKt3Kgljk4Pu4jBAwWeMh0n2tXxBRgT0ypxA_DeWOsxASkJwq77-adhqTxvcaN-hJrOTruPOV7flMP2vUm_NPb3zKQ-cdLXyMMhkADCoX14Kbp2Ca9AuW7dFaZVEhdTy8C_ci0f8vR6C9ThvzewN5J7KNPkF8k5fbYVqt4qIRzmGttSzzkLY7zGKT_nvf77LggmvRn2iq-eV8w28HtiJX6yHm4_VGisX4Bz84IwQZQVMTxkk1E5dhgXcKmNaQoWd7FJJDF0GFg3jtQMpNylxYA84LZU2eyDrNOm2M6GB6R8389SoELnIq69FKOU9nQ-3XMITWFTTbBzP6SR6y3MdXrpr40lZv3BrlIYxZ3Gr0YlnJ-C1tKezPsaaB6EJHd5J6a-BeBFAgSjmtj5bv0zrj1Wu9H9ZtA90sZ02a2xrYQ79Ey1zepshlDQQSc5lsg0-t4CW4Xe2BlT2PGKE5GBADFNA8N9dPxWPpPDb-hEbaYT4sGcX84K5SLCt2LVgYCzFh7P-XXqHFKhYrxp80b8M23O5sM_3Vlinq4dNUoK-MpDJKcTka2C4Yae1FgJ84QR7wa4kEhDFyQgxsW1Ev4kmGUdaBJrI3g4E_YyF96_JN-8Rt1lSDKfmW-nRU9roBk3zH6SfFHJ3ZExPvVOrjoCATaMJ7iM2JvYSNs3uLEr9M9bHLExeo9RiQczBxPEh9AvnN-YtyUaV5eG-ECLZLVTcRuH09DisOdRXkpmiQw-Q_n6aOoM9RzDyrjDLuaH2IrV3eJDuVSZZm7G1El3n9bVFy-Uz24YhDMwD2N6qbkKFOZ4VYncLWunVcXzfKzQBunxCccGqpCTDSsXSmB7xhSlc4k09b2Vp1o7wVj57-To1RyVbsWbvci6CjiT6I4hxbMX0KdIXB6JpuSZgA5mu3RfhAZk2TKe0tsNeE7r2GtjT53GkKoIgdkfTuENDxIZ7M4Fs9FwoprNtvqdQDENX_uBaKvY-dFmfW-MxJ9ymgIdiPjQfT3qoQ6bDNC7V_Uehz6hECSf8d2tHzJL6xfBtKCMmPmP4eczTqsG_WlwR7T3LJIHqul8bzHykE8htkLeckYFA_c6iT4gODRxBAffa-LrRfT1h6HVbblJVx40nOmgey3ZJuqorQt_hmMAlWVuokAUeBjIBGn6ALS04id4MGYnv5qNmPNyI4ydtAwlkLGpl3vdWRJ2TV1aeihs9ALjr7C7FE0aAnX7ScE60xQoWtLX59gsPt1HGDMk6ZNQEf0rBjiPEtxhS5KjwPW-ywCUx1s3AWJUjjn-t1U6BHL4rXDl-q-gJtcnSKmVLJ26IjQ2RNDR4UkoV04-4LqIr-wcfPVTTAQ-qAMZ2R66QGdyfr-KWHpRJU4UTO1hiGm9XwDkS8rdYfxfwX0A1Bxl6ZqgbPYII1Uxx8ajtaepmKQBrR172ZOwm5QXkfeIyT46vZmoeF_9ePMhZyvBG_dh0aaqaebBmcmnBg6hMt7UBXN1Jm1ZXRERTMULTqpUNutYu-_Aoow6mv7UMxve1Vs9RCA_OA_GriDXsUqlJLKXsV_xIU2fWEfNRQIIjCptcn0DhXS-WJMDkxGWYb4_mizo_R05X--IYzsKX4lueUTyevyGwZ73t1IPoWei7qAmjIOHMj9t6tFAPUm_TlY2BwwEKozq4abicgRTZKZlWVTKwegqr_gwRT7HLui7rsgt0_0B8dj3vAJ9RRsDO6KnNyMpi2RkKXOD75BhZM4UsR4VhCmBI_nWmICZ0Kxwvkucn7zYI-7gyKSY2l7rWKLaHkqLr0aUdOf5NXg_E90Dz020tGurog2Dp-qFp_bgQ-jKTs3Ref6PflwkAQsn9TQs7gQrds9wvmxPSqLkSSdz0wsmYvLLM05DxzPOVxGOU6-0ABlwlXjQZkjDEXjc48CpZAk2QpQ7yYCEBvrrqyF49a1O6MN94w99YYR0neQdnjcpqeBe3rJ7g1INcvA.CwcGBC7XOCHkaUwqGT2EOQ')
        const res = await axios.post('https://connect.reapit.cloud/token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': 'XSRF-TOKEN=45fd3c33-e485-48c8-a5a6-d65313cefae0'
            }
        })
        return res.data.access_token;
    }
    catch (err) {
        console.log(err);
    }
}


// ? to be tested
async function createNewNegotiator(body){
    const Token = await loginFromRefreshToken();
    // var config = {
    //     method: 'post',
    //     maxBodyLength: Infinity,
    //     url: `${process.env.master_url}`,
    //     data:{
    //         config: {
    //             method: 'post',
    //             headers: {
    //                 'accept': 'application/json',
    //                 'api-version': '2020-01-31',
    //                 'Authorization': `Bearer ${process.env.REAPIT_TOKEN}`,
    //                 'Reapit-Customer': 'HAH'
    //             },
    //             url: 'https://platform.reapit.cloud/negotiators/',
    //             data: body
    //         }
            
    //     }
    // }
    var config = {
        method: 'post',
        headers: {
            'accept': 'application/json',
            'api-version': '2020-01-31',
            'Authorization': `Bearer ${Token}`,
            'Reapit-Customer': 'HAH'
        },
        url: 'https://platform.reapit.cloud/negotiators/',
        data: body
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

        config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://platform.reapit.cloud/sources/',
            headers: { 
                'Content-Type': 'application/json-patch+json',
                'accept': 'application/json', 
                'api-version': '2020-01-31', 
                'Authorization': `Bearer eyJraWQiOiJFXC9TcnVuTzVCR0xBMk1yT3phY2RjWFkwVVdqRVB1cVB5N3hIb1FWbnJGdz0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI3MmRjZGViZC05NGRkLTQ1ZjItYWIwMC03YmU3OWRiOTExZTgiLCJjb2duaXRvOmdyb3VwcyI6WyJGb3VuZGF0aW9uc0RldmVsb3BlciIsIkZvdW5kYXRpb25zRGV2ZWxvcGVyQWRtaW4iXSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmV1LXdlc3QtMi5hbWF6b25hd3MuY29tXC9ldS13ZXN0LTJfZVE3ZHJlTnpKIiwidmVyc2lvbiI6MiwiY2xpZW50X2lkIjoiNGw2ajB1bnFvbDRrMDJic2w2cTg5b2RlbTUiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImFnZW5jeUNsb3VkXC9sYW5kbG9yZHMucmVhZCBhZ2VuY3lDbG91ZFwvb2ZmaWNlcy53cml0ZSBhZ2VuY3lDbG91ZFwvb2ZmZXJzLnJlYWQgYWdlbmN5Q2xvdWRcL3Byb3BlcnRpZXMud3JpdGUgYWdlbmN5Q2xvdWRcL2FwcGxpY2FudHMud3JpdGUgYWdlbmN5Q2xvdWRcL3Rhc2tzLnJlYWQgYWdlbmN5Q2xvdWRcL2lkZW50aXR5Y2hlY2tzLnJlYWQgYWdlbmN5Q2xvdWRcL2lkZW50aXR5Y2hlY2tzLndyaXRlIGFnZW5jeUNsb3VkXC9rZXlzLnJlYWQgYWdlbmN5Q2xvdWRcL2xhbmRsb3Jkcy53cml0ZSBhZ2VuY3lDbG91ZFwvY29udmV5YW5jaW5nLndyaXRlIGFnZW5jeUNsb3VkXC9lbnF1aXJpZXMucmVhZCBhZ2VuY3lDbG91ZFwvc291cmNlcy53cml0ZSBvcGVuaWQgcHJvZmlsZSBhZ2VuY3lDbG91ZFwvbmVnb3RpYXRvcnMud3JpdGUgYWdlbmN5Q2xvdWRcL2FwcGxpY2FudHMucmVhZCBhZ2VuY3lDbG91ZFwvbmVnb3RpYXRvcnMucmVhZCBhZ2VuY3lDbG91ZFwvdmVuZG9ycy53cml0ZSBhZ2VuY3lDbG91ZFwvaW52b2ljZXMucmVhZCBhZ2VuY3lDbG91ZFwvam91cm5hbGVudHJpZXMucmVhZCBhZ2VuY3lDbG91ZFwvY29tcGFuaWVzLndyaXRlIGFnZW5jeUNsb3VkXC9wcm9wZXJ0aWVzLnJlYWQgYWdlbmN5Q2xvdWRcL3ZlbmRvcnMucmVhZCBhZ2VuY3lDbG91ZFwvY29udGFjdHMucmVhZCBhZ2VuY3lDbG91ZFwvZG9jdW1lbnRzLndyaXRlIGFnZW5jeUNsb3VkXC90YXNrcy53cml0ZSBhZ2VuY3lDbG91ZFwvdGVuYW5jaWVzLndyaXRlIGFnZW5jeUNsb3VkXC9jb21wYW5pZXMucmVhZCBhZ2VuY3lDbG91ZFwvZW5xdWlyaWVzLndyaXRlIGFnZW5jeUNsb3VkXC9jb252ZXlhbmNpbmcucmVhZCBhZ2VuY3lDbG91ZFwva2V5cy53cml0ZSBhZ2VuY3lDbG91ZFwvd29ya3NvcmRlcnMud3JpdGUgYWdlbmN5Q2xvdWRcL2RvY3VtZW50cy5yZWFkIGFnZW5jeUNsb3VkXC9vZmZlcnMud3JpdGUgYWdlbmN5Q2xvdWRcL2pvdXJuYWxlbnRyaWVzLndyaXRlIGFnZW5jeUNsb3VkXC9hcHBvaW50bWVudHMud3JpdGUgYWdlbmN5Q2xvdWRcL3RlbmFuY2llcy5yZWFkIGFnZW5jeUNsb3VkXC90cmFuc2FjdGlvbnMud3JpdGUgZW1haWwgYWdlbmN5Q2xvdWRcL2FyZWFzLndyaXRlIGFnZW5jeUNsb3VkXC9yZWZlcnJhbHMud3JpdGUgYWdlbmN5Q2xvdWRcL3JlZmVycmFscy5yZWFkIGFnZW5jeUNsb3VkXC9jb250YWN0cy53cml0ZSBvcmdhbmlzYXRpb25zXC91c2Vycy5yZWFkIGFnZW5jeUNsb3VkXC93b3Jrc29yZGVycy5yZWFkIGFnZW5jeUNsb3VkXC9vZmZpY2VzLnJlYWQgYWdlbmN5Q2xvdWRcL2FwcG9pbnRtZW50cy5yZWFkIGFnZW5jeUNsb3VkXC90cmFuc2FjdGlvbnMucmVhZCIsImF1dGhfdGltZSI6MTcxNTQ5OTAwNSwiZXhwIjoxNzE1NjIxNTQ4LCJpYXQiOjE3MTU2MTc5NDgsImp0aSI6ImUxMjFmZmZhLWU5MjktNDUxOC1iODJhLTI0ZTg4YTE2NzNmYiIsInVzZXJuYW1lIjoiNzJkY2RlYmQtOTRkZC00NWYyLWFiMDAtN2JlNzlkYjkxMWU4In0.MM_RiKpQg4Sq4OeJMPXOleEjUOYvQkLIg0YZc1-K8MjMz5eIOPC5eRyu8Ze32DtKVtyiDQOj5oUSX9U3jTKLAIauHwLMqsjqvbtQ-jHMDAfNOwYUO6y6N8fIWVNUUvKQF6WvJvOjh6cffAxhUd5jRU4YbdhI4vTMJu6kbOyI1v-zPpkIB66VZXGE9UaEdAdyxw8IJ56gWfYWL5G3t05KWnIXKAlCaVFMbYucpvnHhI3Qpa1XdqZ-dvYdRLt2I_rcow-NNuxRHyWKFb97COuFTBahZB4BjoNNqllF3jY-D3tjYYYWL03Ypg-w8GdFsqTW0pycQrXqn6pdze41AGABYw`,
                'Reapit-Customer': 'HAH'
            },
            data : body
        }
        // if status 500 then resend call
        console.log("new conf -------------" + JSON.stringify(config));
        //console.log(data);
        const response = await axios(config);
        console.log("this is the response ------------> " + response.data);
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