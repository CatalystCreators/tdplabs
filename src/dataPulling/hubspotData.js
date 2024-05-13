const dotenv = require('dotenv').config();
const axios = require('axios');
const hubspot = require('@hubspot/api-client');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck({
    maxConcurrent: 9,
    minTime: 100
});
const fs = require('fs');

const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_TOKEN });

async function fetchHubspotData() {

    var Owners = await hubspotClient.apiRequest({
        method: 'get',
        path: `/crm/v3/owners/`
    });
    var ownersData = await Owners.json();
    //console.log(ownersData.results.length);
    
    console.log('Hubspot Data loaded successfully.');
    return {
        owners: ownersData.results,
    };
}

//fetchHubspotData()
  
// *OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchContactsFromHubspot(){
    let result = [];
    
    const limit = 100;
    let after = 0;
    const properties = [
        'hubspot_owner_id','email','deal_owner',
        'date_of_birth','firstname','lastname',
        'phone','mobilephone','activity_type', 'alternate_email',
        'amenities','amount','deal_name','pipeline', 'contact_source',
        'marketing_mode', 'currency', 'active', 'message_inquiry_comments', 'client_type',
        'department_id', 'potential_client', 'min_bedrooms', 'max_bedrooms','home_phone_number',
        'min_bathrooms', 'max_bathrooms', 'reapit_contact_id', 'price_from', 'price_to', 'officeids', 'archived'
    ];
    const propertiesWithHistory = undefined;
    const associations = undefined;
    const archived = false;

    try {
        while(after !== null){
            const apiResponse = await limiter.schedule(async () => {
                return hubspotClient.crm.contacts.basicApi.getPage(
                  limit,
                  after,
                  properties,
                  propertiesWithHistory,
                  associations,
                  archived
                );
            });

            // let contacts = apiResponse.results.filter((f) =>{
            //     if(f.properties.lastname) return f;
            // });

            result = result.concat(apiResponse.results);
            if(apiResponse.paging && apiResponse.paging.next){
                after = apiResponse.paging.next.after;
                console.log(after)
            }else{
                after = null;
            }
            // console.log(apiResponse.paging.next.after)
        }
        console.log("Total contacts from Hubspot: ", result.length);
        // fs.writeFileSync('hsContactsDump.json', JSON.stringify(result))
        return result
    } catch (error) {
        console.log(error);
        return error;
    }
}

// fetchContactsFromHubspot()
// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchDealsFromHubspot(){
    let result = [];
    const limit = 50;
    let after = 0;
    var properties = [
        'alternate_email','amenities','amount',
        'assigned_date','booking_date','city',
        'client_s_budget','client_type','closedate',
        'country','createdate','hs_created_by_user_id',
        'date_of_birth','deal_currency_code','deal_category',
        'description','deal_source','developer','first_name',
        'last_name','hs_analytics_latest_source',
        'latest_source','lead_status','managed_by_admin_staff',
        'mobile_number','nationality','hs_analytics_source',
        'phone_number','type_of_deal','property_type',
        'pipeline','project_name','hs_object_id',
        'sub_community','max_bathrooms','max_bedrooms',
        'min_bathrooms','min_bedrooms','activity_type',
        'email','unit_type','views','hubspot_owner_id',
        'message_inquiry_comments','price_to','price_from',
        'down_payment_deposit_amount','buying_consultant_commission_amount','buying_consultant_commission_percentage','company_commission_amount',
        'company_commission_amount','dealname','dealstage',
        'applicant_id', 'price_from', 'price_to', 'active',
        'qualfication_status', 'future_prospecting_date',
        'community', 'reason_for_looking', 'selling_status','reapit_applicant_id',
        'future_prospecting_timeframe', 'home_phone_number','archived_status'
    ];
    const propertiesWithHistory = ['dealstage'];
    const associations = ["contacts"];
    const archived = false;

    try {
        //console.log(after);
        while(after !== null){
            const apiResponse = await limiter.schedule(async () => {
                return hubspotClient.crm.deals.basicApi.getPage(
                  limit,
                  after,
                  properties,
                  propertiesWithHistory,
                  associations,
                  archived
                );
            });
            
            let deals = apiResponse.results.filter((f) =>{
                if(f.properties.pipeline == "default") return f;
            });
            result = result.concat(apiResponse.results);
            if(apiResponse.paging && apiResponse.paging.next){
                after = apiResponse.paging.next.after;
            }else{
                after = null;
            }
        }
        
        console.log("Total deals from Husbpot: ",result.length);
        return result
    } catch (error) {
        console.log(error);
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchOwnersFromHubspot(){
    let result = [];
    
    var email = undefined;
    var after = undefined;
    var limit = 100;
    var archived = false;

    try {
        while(after !== null){
            
            const apiResponse = await limiter.schedule(async () => {
                return hubspotClient.crm.owners.ownersApi.getPage(
                  email, after, limit, archived
                );
            });
            result = result.concat(apiResponse.results);
            if(apiResponse.paging && apiResponse.paging.next){
                after = apiResponse.paging.next.after;
            }else{
                after = null;
            }
        }
        console.log("Total owners from Hubspot: ", result.length);
        return result
    } catch (error) {
        console.log(error);
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
// ! check
async function fetchDealOwnerById(id){
    var ownerId = id;
    var idProperty = "id";
    var archived = false;

    try {
        const apiResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.owners.ownersApi.getById(
                ownerId, 
                idProperty, 
                archived
            )
        });
        console.log("Deal Owner fetched for id: ", id);
        return apiResponse
    } catch (error) {
        console.log(error);
        return error
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
// ! check
async function createNewDeal(body){
    const SimplePublicObjectInput = body;
    try {
        const createDealResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.deals.basicApi.create(SimplePublicObjectInput);
        })
        console.log("Deal created in Hubspot successfully");
        return createDealResponse;
    } catch (error) {
        console.log("Failure in creating new deal on Hubspot.");
        console.log(error)
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function createAssociation(dealId, contactId){

    let config = {
        method: 'put',
        maxBodyLength: Infinity,
        url: `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contact/${contactId}/deal_to_contact`,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer pat-eu1-511425c4-569a-456f-a2db-dacd2eaab42d'
        }
    };

    axios.request(config)
    .then((response) => {
        console.log(`Association created successfuly deal: ${dealId} and contact: ${contactId}`);
        console.log(JSON.stringify(response.data));
    })
    .catch((error) => {
        console.log(error, 'Is this the same');
    });
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
// !check
async function createNewContact(body){
    var SimplePublicObjectInput = body;
    try {
        const createContactResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.contacts.basicApi.create(SimplePublicObjectInput);
        });
        console.log("Contact created in Hubspot successfully");
        return createContactResponse;
    } catch (error) {
        console.log(error.body, "Failure in creating new contact on Hubspot.")
        console.log(error)
        console.log(error.body.message.split("Existing ID: ")[1])
        return error.body.message.split("Existing ID: ")[1];
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
// ! check
async function fetchContactById(id){
    const contactId = id;
    var properties = [
        'hubspot_owner_id','email','deal_owner',
        'date_of_birth','firstname','lastname',
        'phone','mobilephone','activity_type', 'alternate_email',
        'amenities','amount','deal_name','pipeline', 'contact_source',
        'marketing_mode', 'currency', 'active', 'message_inquiry_comments', 'client_type', 'hubspot_owner_id',
        'department_id', 'potential_client', 'min_bedrooms', 'max_bedrooms','home_phone_number',
        'min_bathrooms', 'max_bathrooms', 'reapit_contact_id', 'price_from', 'price_to', 'officeids'
    ];
    const propertiesWithHistory = undefined;
    const associations = undefined;
    const archived = false;

    try {
        const apiResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.contacts.basicApi.getById(contactId, properties, propertiesWithHistory, associations, archived);
        })
        console.log("Contact fetched from Hubspot for id: ", id);
        // console.log(apiResponse)
        return apiResponse;
    } catch (e) {
        console.log("Error in fetching contact from hubspot for id: ", id);
        return e;
    }
}

async function searchFunction(object, parameter, value){
    try {

        let data = JSON.stringify({
            "filterGroups": [
                {
                    "filters": [
                        {
                            "value": value,
                            "propertyName": parameter,
                            "operator": "EQ"
                        }
                    ]
                }
            ]
        })
        
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `https://api.hubapi.com/crm/v3/objects/${object}/search`,
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
            },
            data : data
        };

        const apiResponse = await limiter.schedule(async () => {
            return axios(config)
        })
        // console.log(apiResponse.data.results[0])
        var searchResult = apiResponse.data.results[0]
        var details = {}
        if(object === "deals" && searchResult){
            details = await fetchDealById(searchResult.id)
            // console.log(details)
            return details
        } else if(object === "contacts" && searchResult){
            details = await fetchContactById(searchResult.id)
            return details
        }
        // console.log(details)
        return details
    } catch (error) {
        console.log(error,"Search operation failed")
        return error
    }
}

// searchFunction("deals", "applicant_id", "OPN235144");

// searchFunction("contacts","reapit_contact_id", "DUB19007617")
// !check
async function fetchDealById(id){
    const contactId = id;
    var properties = [
        'alternate_email','amenities','amount',
        'assigned_date','booking_date','city',
        'client_s_budget','client_type','closedate',
        'country','createdate','hs_created_by_user_id',
        'date_of_birth','deal_currency_code','deal_category',
        'description','deal_source','developer','first_name',
        'last_name','hs_analytics_latest_source',
        'latest_source','lead_status','managed_by_admin_staff',
        'mobile_number','nationality','hs_analytics_source',
        'phone_number','type_of_deal','property_type',
        'pipeline','project_name','hs_object_id',
        'sub_community','max_bathrooms','max_bedrooms',
        'min_bathrooms','min_bedrooms','activity_type',
        'email','unit_type','views','hubspot_owner_id',
        'message_inquiry_comments','price_to','price_from',
        'down_payment_deposit_amount','buying_consultant_commission_amount','buying_consultant_commission_percentage','company_commission_amount',
        'company_commission_amount','dealname','dealstage',
        'applicant_id', 'price_from', 'price_to', 'active',
        'qualfication_status', 'future_prospecting_date',
        'community', 'reason_for_looking', 'selling_status','reapit_applicant_id',
        'future_prospecting_timeframe', 'home_phone_number','archived_status'
    ];
    const propertiesWithHistory = undefined;
    const associations = ["contacts"];
    const archived = false;

    try {
        const apiResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.deals.basicApi.getById(contactId, properties, propertiesWithHistory, associations, archived);
        })
        console.log("Deal fetched from Hubspot for id: ", id);
        var result = []
        result.push(apiResponse)
        // fs.writeFileSync('testDeal.json', JSON.stringify(result))
        // console.log(apiResponse.associations.contacts)
        return apiResponse;
    } catch (e) {
        console.log("Error in fetching contact from hubspot for id: ", id);
        // console.log(e)
        return e;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function updateDealInHubspot(updates){
    console.log('Updating started...');
    const dealId = `${updates.properties.hs_object_id}`;

    delete updates.properties.hs_object_id;
    delete updates.properties.hs_created_by_user_id;
    delete updates.properties.hs_analytics_latest_source;
    delete updates.properties.hs_analytics_source;
    const SimplePublicObjectInput = {properties: updates.properties};
    const idProperty = undefined;

    try {
        const updateResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.deals.basicApi.update(dealId,SimplePublicObjectInput,idProperty);
        })
        console.log("----------update completed---------------");
        return updateResponse
    } catch (e) {
        console.log(e.body, "Error in updating Hubspot deal.");
        return e
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function updateContactInHubspot(updateJson){
    try {
        const updateResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.contacts.basicApi.update(updateJson.id, updateJson.data);
        })
        console.log("Contact updated successfully for archived applicant.");
        return updateResponse
    } catch (error) {
        console.log(error);
        console.log(updateJson);
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function createNote(body){

    let config = {
        method: 'POST',
        maxBodyLength: Infinity,
        url: `https://api.hubapi.com/crm/v3/objects/notes`,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
        },
        data: body
    };

    axios.request(config)
    .then((response) => {
        console.log(response.data);
    })
    .catch((error) => {
        console.log(error, 'Error in creating note in Hubspot');
    });
}

async function createBatchNote(bodyArr){

    var batchArray = []
    for(let i = 0; i < bodyArr.length; i+=99){
        let chunk = bodyArr.slice(i, i + 99)
        batchArray.push(chunk)
    }


    for(var batch of batchArray){
        var BatchInputSimplePublicObjectInputForCreate = {
            inputs: batch
        }
        let config = {
            method: 'POST',
            maxBodyLength: Infinity,
            url: `https://api.hubapi.com/crm/v3/objects/notes/batch/create`,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
            },
            data: BatchInputSimplePublicObjectInputForCreate
        };
    
        axios.request(config)
        .then((response) => {
            console.log(response.data);
        })
        .catch((error) => {
            console.log(error, 'Error in creating note in Hubspot');
        });
    }
    
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchNoteById(ids){
    var properties = [
        "hs_note_body", "hubspot_owner_id", "hs_timestamp"
    ];
    const propertiesWithHistory = undefined;
    const associations = undefined;
    const archived = false;
    const idProperty = undefined;

    try {
        var batchArray = []
        for(let i = 0; i < ids.length; i += 99){
            let chunk = ids.slice(i, i + 99)
            batchArray.push(chunk)
        }

        // await limiter.schedule(async () => {
        //   return hubspotClient.crm.owners.ownersApi.getPage(
        //     email,
        //     after,
        //     limit,
        //     archived
        //   );
        // });

        var notesInfo = []
        for(let batch of batchArray){
            //console.log(batch.length);
            const apiResponse = await limiter.schedule(async () => {
                return hubspotClient.crm.objects.notes.batchApi.read({
                  inputs: batch.map((id) => ({ id })),
                  properties,
                  propertiesWithHistory,
                  associations,
                  archived,
                  idProperty,
                });
            })
            // await hubspotClient.crm.objects.notes.batchApi.read({
            //     inputs: batch.map(id => ({ id })),
            //     properties,
            //     propertiesWithHistory,
            //     associations,
            //     archived,
            //     idProperty
            // });

            notesInfo = notesInfo.concat(apiResponse.results)
            .filter(result => result.id) // Filter out notes that were not found
        }

        //console.log(notesInfo);
        // .map(result => result.body); // Extract the desired information from each note
        console.log("Notes details fetched from HubSpot:", notesInfo.length);
        return notesInfo;
    } catch (error) {
        console.log("Error in fetching notes by ids:", error);
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchMeetingById(id){
    var properties = [
        "hs_meeting_title", "hs_meeting_body", "hs_meeting_external_URL", "hs_meeting_outcome", "hubspot_owner_id", "hs_meeting_start_time", "hs_activity_type"
    ]
    const propertiesWithHistory = undefined;
    const associations = undefined;
    const archived = false;
    const idProperty = undefined;

    try {
        const apiResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.objects.meetings.basicApi.getById(
                id, 
                properties, 
                propertiesWithHistory, 
                associations, 
                archived, 
                idProperty 
            );
        })
        console.log("Meeting fetched from Hubspot for id: ", id);
        return apiResponse;
    } catch (error) {
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchMeetingsforDeal(id){
    try {
        var config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.hubapi.com/crm/v3/objects/deals/${id}/associations/meetings`,
            headers: { 
              'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
            }
        };
    
        const response = await limiter.schedule(async () =>{
            return axios(config);
        })
        var meetingIds = response.data.results;
        var meetingInfo = [];
        for(var nid of meetingIds){
            const info = await fetchMeetingById(nid.id)
            if(info.id){
                meetingInfo.push(info);
            }
        }
        console.log(`Meetings associated to dealId: ${id} are ${meetingInfo.length}`);
        return meetingInfo
    } catch (error) {
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchCallById(id){
    var properties = [
        "hs_call_body", "hubspot_owner_id", "hs_timestamp", "hs_call_duration", "hs_call_status", "hs_call_title"
    ]
    const propertiesWithHistory = undefined;
    const associations = undefined;
    const archived = false;
    const idProperty = undefined;

    try {
        const apiResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.objects.calls.basicApi.getById(id, properties, propertiesWithHistory, associations, archived, idProperty );
        })
        console.log("Call fetched from Hubspot for id: ", id);
        return apiResponse;
    } catch (error) {
        console.log("Error in fetching call from Hubspot.");
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchEmailById(id){
    var properties = [
        "hs_email_text", "hubspot_owner_id", "hs_timestamp", "hs_email_subject", "hs_email_status", "hs_email_to_email"
    ]
    const propertiesWithHistory = undefined;
    const associations = undefined;
    const archived = false;
    const idProperty = undefined;

    try {
        const apiResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.objects.emails.basicApi.getById(id, properties, propertiesWithHistory, associations, archived, idProperty );
        }); 
        console.log("Email fetched from Hubspot for id: ", id);
        return apiResponse;
    } catch (error) {
        console.log("Error in fetching email from Hubspot");
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchEmailsforDeal(id){
    try {
        
        var config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.hubapi.com/crm/v3/objects/deals/${id}/associations/emails`,
            headers: { 
              'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
            }
        };
    
        const response = await limiter.schedule(async () => {
            return axios(config);
        })
        var emailsIds = response.data.results;
        var emailInfo = [];
        for(var nid of emailsIds){
            const info = await fetchEmailById(nid.id)
            if(info.id){
                emailInfo.push(info);
            }
        }
        console.log(`Emails associated to dealId: ${id} are ${emailInfo.length}`);
        return emailInfo
    } catch (error) {
        console.log("Error in fetching emails for deal from Hubspot.");
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchCallsforDeal(id){
    try {
        
        var config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.hubapi.com/crm/v3/objects/deals/${id}/associations/calls`,
            headers: { 
              'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
            }
        };
    
        const response = await limiter.schedule(async () => {
            return axios(config);
        })
        var callsIds = response.data.results;
        var callInfo = [];
        for(var nid of callsIds){
            const info = await fetchCallById(nid.id)
            if(info.id){
                callInfo.push(info);
            }
        }
        console.log(`Calls associated to dealId: ${id} are ${callInfo.length}`);
        return callInfo
    } catch (error) {
        console.log("Error in fetching calls for deal from Hubspot.");
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchTaskById(id){
    var properties = [
        "hs_task_body", "hubspot_owner_id", "hs_timestamp", "hs_task_subject", "hs_task_status" 
    ]
    const propertiesWithHistory = undefined;
    const associations = undefined;
    const archived = false;
    const idProperty = undefined;

    try {
        const apiResponse = await limiter.schedule(async () => {
            return hubspotClient.crm.objects.tasks.basicApi.getById(id, properties, propertiesWithHistory, associations, archived, idProperty );
        })
        console.log("Task fetched from Hubspot for id: ", id);
        return apiResponse;
    } catch (error) {
        console.log("Error in fetching task for id: ", id);
        return error;
    }
}

// * OPTIMISED AS PER ME - CHECK WITH BRAMHESH SIR
async function fetchTasksforDeal(id){
    try {
        
        var config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.hubapi.com/crm/v3/objects/deals/${id}/associations/tasks`,
            headers: { 
              'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
            }
        };
    
        const response = await limiter.schedule(async () => {
            return axios(config);
        })
        var tasksIds = response.data.results;
        var taskInfo = [];
        for(var nid of tasksIds){
            const info = await fetchTaskById(nid.id)
            if(info.id){
                taskInfo.push(info);
            }
        }
        console.log(`Tasks associated to dealId: ${id} are ${taskInfo.length}`);
        return taskInfo
    } catch (error) {
        console.log("Error in fetching tasks for deal from Hubspot");
        return error;
    }
}

// * tested
async function fetchNotesForDeal(id) {
    try {
        var notesInfo = [];
        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.hubapi.com/crm/v3/objects/deals/${id}/associations/notes?limit=500`,
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
            }
        };
  
        const response = await limiter.schedule(async () => {
            return axios(config);
        })
        const notesIds = response.data.results;
        const noteIdsArray = notesIds.map(nid => nid.id); // Extract note ids into an array
        //console.log(noteIdsArray.length);
        notesInfo = await fetchNoteById(noteIdsArray);
        
        console.log(`Notes associated with dealId ${id}: ${notesInfo.length}`);
        return notesInfo;
    } catch (error) {
        console.log("Error in fetching notes for deal from HubSpot.", error);
        return error;
    }
}

// *tested
async function fetchNotesForContact(id){
    try {
        var notesInfo = [];
        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.hubapi.com/crm/v3/objects/contacts/${id}/associations/notes?limit=500`,
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
            }
        };
  
        const response = await limiter.schedule(async () => {
            return axios(config);
        })
        const notesIds = response.data.results;
        const noteIdsArray = notesIds.map(nid => nid.id); // Extract note ids into an array
        //console.log(noteIdsArray.length);
        notesInfo = await fetchNoteById(noteIdsArray);
        
        console.log(`Notes associated with contactId ${id}: ${notesInfo.length}`);
        return notesInfo;
    } catch (error) {
        console.log("Error in fetching notes for contact from HubSpot.", error);
        return error;
    }
}

async function createBulkContacts(contactsArray){

    
    for(var contact of contactsArray){
        contact.associations = []
    }

    var batchArray = []
    for(let i = 0; i < contactsArray.length; i+=99){
        let chunk = contactsArray.slice(i, i + 99)
        batchArray.push(chunk)
    }
    var count = 0;
    for(var batch of batchArray){
        var BatchInputSimplePublicObjectInputForCreate = {
            inputs: batch
        }

        try {
            const apiResponse = await limiter.schedule(async () => {
                return hubspotClient.crm.contacts.batchApi.create(BatchInputSimplePublicObjectInputForCreate)
            })
            // console.log(apiResponse)
            count ++
            console.log(`batch count: `, count)
        } catch (error) {
            console.log(error.message)
            count ++
            console.log("error batch count: ", count)
            continue;
        }
    }
}

async function updateBulkContacts(contactsArray){

    
    for(var contact of contactsArray){
        contact.associations = []
    }

    var batchArray = []
    for(let i = 0; i < contactsArray.length; i+=99){
        let chunk = contactsArray.slice(i, i + 99)
        batchArray.push(chunk)
    }
    var count = 0;
    for(var batch of batchArray){
        var BatchInputSimplePublicObjectInputForCreate = {
            inputs: batch
        }

        try {
            const apiResponse = await limiter.schedule(async () => {
                return hubspotClient.crm.deals.batchApi.update(BatchInputSimplePublicObjectInputForCreate)
            })
            // console.log(apiResponse)
            count ++
            console.log(`batch count: `, count)
        } catch (error) {
            console.log(error.message)
            count ++
            console.log("error batch count: ", count)
            continue;
        }
    }
}

//fetchNotesForContact("564")

//fetchNotesForDeal("7520545773")
  
// fetchDealById("8678676709")
module.exports = { fetchHubspotData, fetchDealOwnerById, createNewContact, fetchContactById, createNewDeal, createAssociation, updateDealInHubspot, updateContactInHubspot, createNote, fetchNotesForDeal, fetchNotesForContact, fetchContactsFromHubspot, fetchDealsFromHubspot, fetchTasksforDeal, fetchCallsforDeal, fetchEmailsforDeal, fetchMeetingsforDeal, fetchOwnersFromHubspot, createBatchNote, createBulkContacts, updateBulkContacts, searchFunction, fetchDealById }

